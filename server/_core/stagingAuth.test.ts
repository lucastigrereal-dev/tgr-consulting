import { describe, expect, it } from "vitest";
import {
  createStagingLoginHandler,
  hashStagingPassword,
  isStagingPasswordHash,
  verifyStagingPassword,
} from "./stagingAuth";

describe("staging password auth", () => {
  it("valida a senha correta e rejeita senha incorreta sem plaintext persistido", () => {
    const encoded = hashStagingPassword(
      "uma-senha-de-staging-longa",
      Buffer.from("00112233445566778899aabbccddeeff", "hex"),
    );

    expect(encoded).not.toContain("uma-senha-de-staging-longa");
    expect(isStagingPasswordHash(encoded)).toBe(true);
    expect(verifyStagingPassword("uma-senha-de-staging-longa", encoded)).toBe(true);
    expect(verifyStagingPassword("senha-incorreta", encoded)).toBe(false);
  });

  it("rejeita hashes malformados sem lançar erro ou aceitar bypass", () => {
    expect(isStagingPasswordHash("plaintext")).toBe(false);
    expect(verifyStagingPassword("qualquer", "plaintext")).toBe(false);
    expect(verifyStagingPassword("qualquer", "scrypt$1$1$1$00$00")).toBe(false);
  });
});

describe("staging login handler", () => {
  function response() {
    const result = { status: 200, body: undefined as unknown, cookie: undefined as unknown };
    const res = {
      status(code: number) { result.status = code; return res; },
      json(body: unknown) { result.body = body; return res; },
      cookie(name: string, value: string, options: unknown) {
        result.cookie = { name, value, options };
        return res;
      },
    };
    return { res, result };
  }

  it("cria sessão segura somente para credencial válida e usuário admin do staging", async () => {
    const passwordHash = hashStagingPassword(
      "uma-senha-de-staging-longa",
      Buffer.from("00112233445566778899aabbccddeeff", "hex"),
    );
    const savedUsers: unknown[] = [];
    const handler = createStagingLoginHandler({
      environment: {
        APP_ENV: "staging",
        APP_URL: "https://staging.example",
        AUTH_MODE: "staging_password",
        STAGING_AUTH_USERNAME: "lucas",
        STAGING_AUTH_PASSWORD_HASH: passwordHash,
      },
      upsertUser: async user => { savedUsers.push(user); },
      getUserByOpenId: async () => ({ id: 7, openId: "staging:lucas" }),
      createSessionToken: async () => "signed-session",
    });
    const { res, result } = response();

    await handler({
      body: { username: "lucas", password: "uma-senha-de-staging-longa" },
      protocol: "https",
      headers: { origin: "https://staging.example" },
    } as never, res as never);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true });
    expect(savedUsers).toEqual([expect.objectContaining({
      openId: "staging:lucas",
      role: "admin",
      loginMethod: "staging_password",
    })]);
    expect(result.cookie).toEqual(expect.objectContaining({
      name: "app_session_id",
      value: "signed-session",
      options: expect.objectContaining({ httpOnly: true, secure: true }),
    }));
  });

  it("rejeita origem cruzada e senha incorreta sem criar usuário", async () => {
    const calls: unknown[] = [];
    const passwordHash = hashStagingPassword(
      "uma-senha-de-staging-longa",
      Buffer.from("00112233445566778899aabbccddeeff", "hex"),
    );
    const handler = createStagingLoginHandler({
      environment: {
        APP_ENV: "staging",
        APP_URL: "https://staging.example",
        AUTH_MODE: "staging_password",
        STAGING_AUTH_USERNAME: "lucas",
        STAGING_AUTH_PASSWORD_HASH: passwordHash,
      },
      upsertUser: async user => { calls.push(user); },
      getUserByOpenId: async () => undefined,
      createSessionToken: async () => "should-not-run",
    });

    const crossOrigin = response();
    await handler({
      body: { username: "lucas", password: "uma-senha-de-staging-longa" },
      protocol: "https",
      headers: { origin: "https://attacker.example" },
    } as never, crossOrigin.res as never);
    expect(crossOrigin.result.status).toBe(403);

    const wrongPassword = response();
    await handler({
      body: { username: "lucas", password: "errada" },
      protocol: "https",
      headers: { origin: "https://staging.example" },
    } as never, wrongPassword.res as never);
    expect(wrongPassword.result.status).toBe(401);
    expect(calls).toEqual([]);
  });
});
