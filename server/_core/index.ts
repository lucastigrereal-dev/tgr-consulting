import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { assertProductionConfiguration } from "./env";

type RateLimitOptions = {
  maxRequests?: number;
  windowMs?: number;
  now?: () => number;
};

export function getDefaultBodyLimit() {
  return process.env.API_BODY_LIMIT?.trim() || "1mb";
}

export function createRateLimitMiddleware(options: RateLimitOptions = {}) {
  const maxRequests = options.maxRequests ?? 120;
  const windowMs = options.windowMs ?? 60_000;
  const now = options.now ?? Date.now;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const currentTime = now();
    if (buckets.size > 5_000) {
      buckets.forEach((bucket, key) => {
        if (bucket.resetAt <= currentTime) buckets.delete(key);
      });
    }

    const ip =
      req.ip || req.socket.remoteAddress || req.headers["x-forwarded-for"] || "unknown";
    const key = Array.isArray(ip) ? ip.join(",") : String(ip).split(",")[0]!;
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > currentTime
        ? existing
        : { count: 0, resetAt: currentTime + windowMs };

    if (bucket.count >= maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));
      res.set("Retry-After", String(retryAfter));
      res.set("X-RateLimit-Limit", String(maxRequests));
      res.set("X-RateLimit-Remaining", "0");
      res.status(429).json({ error: "rate_limit_exceeded" });
      return;
    }

    bucket.count += 1;
    buckets.set(key, bucket);
    res.set("X-RateLimit-Limit", String(maxRequests));
    res.set("X-RateLimit-Remaining", String(maxRequests - bucket.count));
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
  app.set("trust proxy", 1);
  const sensitiveRouteLimiter = createRateLimitMiddleware();
  app.use(["/api/trpc", "/api/oauth/callback", "/manus-storage"], sensitiveRouteLimiter);
  app.use(express.json({ limit: getDefaultBodyLimit() }));
  app.use(express.urlencoded({ limit: getDefaultBodyLimit(), extended: true }));
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
