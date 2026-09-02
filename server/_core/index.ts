import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./static";
import { assertProductionConfiguration } from "./env";
import { buildRuntimeHealth } from "./runtimeHealth";
import { createStagingLoginHandler } from "./stagingAuth";
import { getDb, getUserByOpenId, upsertUser } from "../db";
import { sdk } from "./sdk";
import { sql } from "drizzle-orm";

type RateLimitOptions = {
  maxRequests?: number;
  windowMs?: number;
  maxBuckets?: number;
  now?: () => number;
};

type SecurityHeadersOptions = {
  isProduction?: boolean;
};

type StructuredLogger = Pick<typeof console, "info" | "warn" | "error">;

type RequestLoggingOptions = {
  logger?: StructuredLogger;
  now?: () => number;
};

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function getDefaultBodyLimit() {
  return process.env.API_BODY_LIMIT?.trim() || "1mb";
}

export function getTrustProxySetting(
  environment: NodeJS.ProcessEnv = process.env
) {
  const raw = environment.TRUST_PROXY?.trim();
  if (!raw || raw === "false") return false;
  if (raw === "true") return true;
  const numeric = Number(raw);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : raw;
}

function getRateLimitKey(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function createRateLimitMiddleware(options: RateLimitOptions = {}) {
  const maxRequests = options.maxRequests ?? 120;
  const windowMs = options.windowMs ?? 60_000;
  const maxBuckets = Math.max(1, options.maxBuckets ?? 5_000);
  const now = options.now ?? Date.now;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const currentTime = now();
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= currentTime) buckets.delete(key);
    });

    const key = getRateLimitKey(req);
    const existing = buckets.get(key);
    const bucket = existing ?? { count: 0, resetAt: currentTime + windowMs };
    buckets.delete(key);

    if (bucket.count >= maxRequests) {
      buckets.set(key, bucket);
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));
      res.set("Retry-After", String(retryAfter));
      res.set("X-RateLimit-Limit", String(maxRequests));
      res.set("X-RateLimit-Remaining", "0");
      res.status(429).json({ error: "rate_limit_exceeded" });
      return;
    }

    bucket.count += 1;
    if (buckets.size >= maxBuckets) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    buckets.set(key, bucket);
    res.set("X-RateLimit-Limit", String(maxRequests));
    res.set("X-RateLimit-Remaining", String(maxRequests - bucket.count));
    next();
  };
}

function cspForEnvironment(isProduction: boolean) {
  const scriptSrc = isProduction
    ? "script-src 'self'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  const connectSrc = isProduction
    ? "connect-src 'self' https: wss:"
    : "connect-src 'self' http: https: ws: wss:";
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    connectSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

export function createSecurityHeadersMiddleware(
  options: SecurityHeadersOptions = {}
) {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
  return (req: Request, res: Response, next: NextFunction) => {
    res.set("Content-Security-Policy", cspForEnvironment(isProduction));
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.set("X-Frame-Options", "SAMEORIGIN");
    res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    if (isProduction && (req.secure || req.protocol === "https")) {
      res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    next();
  };
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{7,127}$/;

function getIncomingRequestId(req: Request) {
  const header = req.headers["x-request-id"];
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value === "string" && REQUEST_ID_PATTERN.test(value)) return value;
  return undefined;
}

function createRequestId() {
  return randomUUID().replace(/-/g, "");
}

export function createRequestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = getIncomingRequestId(req) ?? createRequestId();
    req.requestId = requestId;
    res.set("X-Request-Id", requestId);
    next();
  };
}

function routeWithoutQuery(req: Request) {
  const source = req.originalUrl || req.url || req.path || "unknown";
  return source.split("?")[0] || "unknown";
}

function redactForLog(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(token|code|secret|password|authorization)=([^&\s]+)/gi, "$1=[REDACTED]");
}

function requestLogPayload(req: Request, statusCode: number, durationMs: number) {
  const route = routeWithoutQuery(req);
  return {
    event: "request.completed",
    requestId: req.requestId ?? "unknown",
    method: req.method,
    route: redactForLog(route),
    surface: route.includes("calculate") ? "calculation" : "request",
    statusCode,
    durationMs,
  };
}

function shouldSkipRequestLog(req: Request) {
  const route = routeWithoutQuery(req);
  return (
    route === "/health" ||
    route === "/api/trpc/system.health" ||
    route.includes("system.health") ||
    route.startsWith("/assets/") ||
    /\.(?:css|gif|ico|jpg|jpeg|js|map|png|svg|webp|woff2?)$/i.test(route)
  );
}

export function createRequestLoggingMiddleware(
  options: RequestLoggingOptions = {}
) {
  const logger = options.logger ?? console;
  const now = options.now ?? Date.now;

  return (req: Request, res: Response, next: NextFunction) => {
    if (shouldSkipRequestLog(req)) {
      next();
      return;
    }

    const startedAt = now();

    res.once("finish", () => {
      const payload = requestLogPayload(req, res.statusCode, now() - startedAt);
      if (res.statusCode >= 500) logger.error(payload);
      else if (res.statusCode >= 400) logger.warn(payload);
      else logger.info(payload);
    });

    res.once("error", error => {
      logger.error({
        event: "request.error",
        requestId: req.requestId ?? "unknown",
        method: req.method,
        route: redactForLog(routeWithoutQuery(req)),
        surface: routeWithoutQuery(req).includes("calculate")
          ? "calculation"
          : "request",
        error: redactForLog(error instanceof Error ? error.message : String(error)),
      });
    });

    next();
  };
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  assertProductionConfiguration();
  const app = express();
  const server = createServer(app);
  app.set("trust proxy", getTrustProxySetting());
  app.use(createRequestIdMiddleware());
  app.use(createSecurityHeadersMiddleware());
  app.use(createRequestLoggingMiddleware());
  const sensitiveRouteLimiter = createRateLimitMiddleware();
  app.use(["/api/trpc", "/api/oauth/callback", "/api/staging-auth/login", "/manus-storage"], sensitiveRouteLimiter);
  app.use(express.json({ limit: getDefaultBodyLimit() }));
  app.use(express.urlencoded({ limit: getDefaultBodyLimit(), extended: true }));
  app.get("/health", async (_req, res) => {
    const payload = await buildRuntimeHealth({
      checkDatabase: async () => {
        const database = await getDb();
        if (!database) return false;
        await database.execute(sql`SELECT 1`);
        return true;
      },
    });
    res.status(payload.ok ? 200 : 503).json(payload);
  });
  app.post(
    "/api/staging-auth/login",
    createStagingLoginHandler({
      upsertUser,
      getUserByOpenId,
      createSessionToken: (openId, options) =>
        sdk.createSessionToken(openId, options),
    }),
  );
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    // Keep the development-only Vite/Manus instrumentation out of the
    // production server bundle. The non-literal import is resolved by tsx in
    // `pnpm dev` and intentionally remains external to the esbuild artifact.
    const developmentViteModule = "./vite";
    const { setupVite } = await import(developmentViteModule);
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch(console.error);
}
