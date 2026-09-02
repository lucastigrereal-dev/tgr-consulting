import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { EventEmitter } from "node:events";
import path from "node:path";
import { OAUTH_STATE_COOKIE } from "@shared/const";
import {
  createRateLimitMiddleware,
  createRequestIdMiddleware,
  createRequestLoggingMiddleware,
  createSecurityHeadersMiddleware,
  getDefaultBodyLimit,
  getTrustProxySetting,
} from "./index";
import {
  DEV_OAUTH_STATE_COOKIE,
  getOAuthStateCookieName,
  getOAuthStateCookieOptions,
  getSessionCookieOptions,
} from "./cookies";
import { ENV } from "./env";
import { redactErrorForLog, sdk } from "./sdk";
import { registerStorageProxy } from "./storageProxy";

function request(overrides: Partial<Request> = {}) {
  return {
    protocol: "https",
    headers: {},
    ip: "203.0.113.10",
    path: "/api/trpc",
    socket: { remoteAddress: "203.0.113.10" },
    ...overrides,
  } as Request;
}

function response() {
  const result = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    redirectedTo: "",
    sentFile: "",
  };
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    status(code: number) {
      result.statusCode = code;
      res.statusCode = code;
      return res;
    },
    set(name: string, value: string) {
      result.headers[name] = value;
      return res;
    },
    json(body: unknown) {
      result.body = body;
      return res;
    },
    send(body: unknown) {
      result.body = body;
      return res;
    },
    redirect(code: number, url: string) {
      result.statusCode = code;
      result.redirectedTo = url;
      return res;
    },
    sendFile(file: string, callback?: (error?: Error) => void) {
      result.sentFile = file;
      callback?.();
      return res;
    },
  }) as unknown as Response;
  return { res, result };
}

describe("security hardening", () => {
  it("não confia em proxy por padrão e não deixa X-Forwarded-For burlar rate limit", () => {
    expect(getTrustProxySetting({})).toBe(false);
    expect(getTrustProxySetting({ TRUST_PROXY: "1" })).toBe(1);
    expect(getTrustProxySetting({ TRUST_PROXY: "loopback" })).toBe("loopback");

    const middleware = createRateLimitMiddleware({
      maxRequests: 1,
      windowMs: 10_000,
      now: () => 1_000,
    });
    const next = vi.fn();

    middleware(
      request({
        headers: { "x-forwarded-for": "198.51.100.1" },
        socket: { remoteAddress: "203.0.113.10" } as Request["socket"],
        ip: undefined,
      }),
      response().res,
      next
    );
    const second = response();
    middleware(
      request({
        headers: { "x-forwarded-for": "198.51.100.2" },
        socket: { remoteAddress: "203.0.113.10" } as Request["socket"],
        ip: undefined,
      }),
      second.res,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(second.result.statusCode).toBe(429);
  });

  it("usa limite global de body pequeno por padrão", () => {
    expect(getDefaultBodyLimit()).toBe("1mb");
  });

  it("aplica headers mínimos de segurança e HSTS só quando HTTPS em produção", () => {
    const middleware = createSecurityHeadersMiddleware({ isProduction: true });
    const secure = response();
    middleware(request({ protocol: "https", secure: true }), secure.res, vi.fn());

    expect(secure.result.headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(secure.result.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(secure.result.headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(secure.result.headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(secure.result.headers["Strict-Transport-Security"]).toContain("max-age=31536000");

    const local = response();
    middleware(request({ protocol: "http", secure: false }), local.res, vi.fn());
    expect(local.result.headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("mantém CSP de produção sem scripts inline e compatível com Google Fonts", () => {
    const middleware = createSecurityHeadersMiddleware({ isProduction: true });
    const secure = response();

    middleware(request({ protocol: "https", secure: true }), secure.res, vi.fn());

    const csp = secure.result.headers["Content-Security-Policy"];
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain(
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
    );
    expect(csp).toContain("font-src 'self' data: https://fonts.gstatic.com");
  });

  it("valida ou gera correlation id e devolve no header", () => {
    const middleware = createRequestIdMiddleware();
    const next = vi.fn();
    const valid = response();
    const req = request({ headers: { "x-request-id": "req_ABC-123.def" } });

    middleware(req, valid.res, next);

    expect(req.requestId).toBe("req_ABC-123.def");
    expect(valid.result.headers["X-Request-Id"]).toBe("req_ABC-123.def");
    expect(next).toHaveBeenCalledTimes(1);

    const invalid = response();
    const reqWithInvalidId = request({ headers: { "x-request-id": "Bearer secret-token" } });
    middleware(reqWithInvalidId, invalid.res, vi.fn());

    expect(reqWithInvalidId.requestId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(reqWithInvalidId.requestId).not.toBe("Bearer secret-token");
    expect(invalid.result.headers["X-Request-Id"]).toBe(reqWithInvalidId.requestId);
  });

  it("emite logs estruturados com request id sem expor segredos", () => {
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    const middleware = createRequestLoggingMiddleware({
      logger: { info, warn, error },
      now: () => 1_000,
    });
    const req = request({
      method: "POST",
      originalUrl: "/api/trpc/igr.calculate?token=secret-token",
      requestId: "req-safe",
      headers: { authorization: "Bearer secret-token" },
    });
    const { res } = response();
    const next = vi.fn();

    middleware(req, res, next);
    res.emit("finish");

    expect(next).toHaveBeenCalledTimes(1);
    const payload = info.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      event: "request.completed",
      requestId: "req-safe",
      method: "POST",
      statusCode: 200,
    });
    expect(payload.route).toBe("/api/trpc/igr.calculate");
    expect(JSON.stringify(payload)).not.toContain("secret-token");
    expect(JSON.stringify(payload)).not.toContain("authorization");
  });

  it("não emite logs ruidosos para assets estáticos ou healthcheck", () => {
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    const middleware = createRequestLoggingMiddleware({
      logger: { info, warn, error },
      now: () => 1_000,
    });

    const staticAsset = response();
    middleware(
      request({ method: "GET", originalUrl: "/assets/index-Bw5qYCYg.js" }),
      staticAsset.res,
      vi.fn()
    );
    staticAsset.res.emit("finish");

    const health = response();
    middleware(
      request({ method: "GET", originalUrl: "/api/trpc/system.health" }),
      health.res,
      vi.fn()
    );
    health.res.emit("finish");

    const calculation = response();
    middleware(
      request({ method: "POST", originalUrl: "/api/trpc/igr.calculate" }),
      calculation.res,
      vi.fn()
    );
    calculation.res.emit("finish");

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.[0]).toMatchObject({
      event: "request.completed",
      surface: "calculation",
      route: "/api/trpc/igr.calculate",
    });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("log de erro de request preserva superfície sem stack e sem segredo", () => {
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    const middleware = createRequestLoggingMiddleware({
      logger: { info, warn, error },
      now: () => 1_000,
    });
    const req = request({
      method: "POST",
      originalUrl: "/api/trpc/igr.calculate",
      requestId: "req-error",
    });
    const { res } = response();
    const next = vi.fn();

    middleware(req, res, next);
    res.emit("error", new Error("boom Bearer secret-token"));

    expect(next).toHaveBeenCalledTimes(1);
    const payload = error.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      event: "request.error",
      requestId: "req-error",
      route: "/api/trpc/igr.calculate",
    });
    expect(JSON.stringify(payload)).toContain("[REDACTED]");
    expect(JSON.stringify(payload)).not.toContain("secret-token");
    expect(JSON.stringify(payload)).not.toContain("stack");
  });


  it("limita requisições por IP com resposta 429 e Retry-After", () => {
    let now = 1_000;
    const middleware = createRateLimitMiddleware({
      maxRequests: 2,
      windowMs: 10_000,
      now: () => now,
    });
    const first = response();
    const second = response();
    const third = response();
    const next = vi.fn();

    middleware(request(), first.res, next);
    middleware(request(), second.res, next);
    middleware(request(), third.res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(third.result.statusCode).toBe(429);
    expect(third.result.headers["Retry-After"]).toBe("10");
    expect(third.result.body).toEqual({ error: "rate_limit_exceeded" });

    now += 10_001;
    const afterWindow = response();
    middleware(request(), afterWindow.res, next);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it("mantém rate limiter com limite real de buckets e despejo LRU", () => {
    const middleware = createRateLimitMiddleware({
      maxRequests: 1,
      windowMs: 10_000,
      maxBuckets: 2,
      now: () => 1_000,
    });
    const next = vi.fn();

    middleware(request({ ip: "203.0.113.1" }), response().res, next);
    middleware(request({ ip: "203.0.113.2" }), response().res, next);

    const refreshFirst = response();
    middleware(request({ ip: "203.0.113.1" }), refreshFirst.res, next);
    expect(refreshFirst.result.statusCode).toBe(429);

    middleware(request({ ip: "203.0.113.3" }), response().res, next);

    const evictedSecond = response();
    middleware(request({ ip: "203.0.113.2" }), evictedSecond.res, next);

    expect(evictedSecond.result.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(4);
  });

  it("usa cookie OAuth __Host seguro em HTTPS e cookie local compatível em HTTP", () => {
    expect(getOAuthStateCookieName(request({ protocol: "https" }))).toBe(
      OAUTH_STATE_COOKIE
    );
    expect(getOAuthStateCookieOptions(request({ protocol: "https" }))).toEqual({
      path: "/",
      sameSite: "none",
      secure: true,
    });

    expect(getOAuthStateCookieName(request({ protocol: "http" }))).toBe(
      DEV_OAUTH_STATE_COOKIE
    );
    expect(getOAuthStateCookieOptions(request({ protocol: "http" }))).toEqual({
      path: "/",
      sameSite: "lax",
      secure: false,
    });
    expect(getSessionCookieOptions(request({ protocol: "http" }))).toEqual(
      expect.objectContaining({ sameSite: "lax", secure: false })
    );
  });

  it("redige erros sem expor tokens, headers, body ou config", () => {
    const error = {
      isAxiosError: true,
      name: "AxiosError",
      message: "Request failed with Bearer secret-token and code=abc123",
      code: "ERR_BAD_REQUEST",
      response: {
        status: 400,
        data: { accessToken: "secret", nested: { token: "jwt" } },
        headers: { authorization: "Bearer secret-token" },
      },
      config: {
        headers: { Authorization: "Bearer secret-token" },
        data: '{"jwtToken":"jwt-secret"}',
      },
    };

    const redacted = JSON.stringify(redactErrorForLog(error));

    expect(redacted).toContain("ERR_BAD_REQUEST");
    expect(redacted).toContain("[REDACTED]");
    expect(redacted).not.toContain("secret-token");
    expect(redacted).not.toContain("abc123");
    expect(redacted).not.toContain("jwt-secret");
    expect(redacted).not.toContain("headers");
    expect(redacted).not.toContain("config");
    expect(redacted).not.toContain("data");
  });

  it("exige sessão e restringe downloads de storage ao prefixo do tenant", async () => {
    ENV.forgeApiUrl = "https://forge.example";
    ENV.forgeApiKey = "forge-key";
    let handler:
      | ((req: Request, res: Response) => Promise<void>)
      | undefined;
    const app = {
      get(_path: string, next: typeof handler) {
        handler = next;
      },
    };
    registerStorageProxy(app as never);
    expect(handler).toBeDefined();

    const authenticate = vi
      .spyOn(sdk, "authenticateRequest")
      .mockResolvedValue({
        id: 7,
        openId: "user-7",
        name: "User 7",
        email: null,
        loginMethod: null,
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => ({ url: "https://signed.example/export.pdf" }),
      } as Response);

    const allowed = response();
    await handler!(
      request({
        params: { key: ["igr", "7", "exports", "snapshot.pdf"] },
      } as unknown as Request),
      allowed.res
    );

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(allowed.result.statusCode).toBe(307);
    expect(allowed.result.redirectedTo).toBe("https://signed.example/export.pdf");

    const denied = response();
    await handler!(
      request({
        params: { key: ["igr", "8", "exports", "snapshot.pdf"] },
      } as unknown as Request),
      denied.res
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(denied.result.statusCode).toBe(403);
    expect(denied.result.body).toBe("Storage key not authorized");

    authenticate.mockRestore();
    fetchMock.mockRestore();
  });

  it("serve export do volume de staging somente depois de autenticar o tenant", async () => {
    ENV.storageDriver = "filesystem";
    const storageRoot = path.resolve("tmp", "tgr-staging-exports");
    ENV.storageLocalDir = storageRoot;
    let handler:
      | ((req: Request, res: Response) => Promise<void>)
      | undefined;
    const app = {
      get(_path: string, next: typeof handler) { handler = next; },
    };
    registerStorageProxy(app as never);
    const authenticate = vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({
      id: 7,
      openId: "staging:lucas",
      name: "Lucas",
      email: null,
      loginMethod: "staging_password",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    const result = response();

    await handler!(request({
      params: { key: ["igr", "7", "exports", "snapshot.pdf"] },
    } as unknown as Request), result.res);

    expect(result.result.statusCode).toBe(200);
    expect(result.result.sentFile.replace(/\\/g, "/")).toBe(
      path.join(storageRoot, "igr", "7", "exports", "snapshot.pdf").replace(/\\/g, "/"),
    );
    expect(result.result.headers["Cache-Control"]).toBe("no-store");
    authenticate.mockRestore();
    ENV.storageDriver = "forge";
    ENV.storageLocalDir = "";
  });
});
