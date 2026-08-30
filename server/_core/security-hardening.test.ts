import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { OAUTH_STATE_COOKIE } from "@shared/const";
import {
  createRateLimitMiddleware,
  getDefaultBodyLimit,
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
  };
  const res = {
    status(code: number) {
      result.statusCode = code;
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
  } as unknown as Response;
  return { res, result };
}

describe("security hardening", () => {
  it("usa limite global de body pequeno por padrão", () => {
    expect(getDefaultBodyLimit()).toBe("1mb");
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
});
