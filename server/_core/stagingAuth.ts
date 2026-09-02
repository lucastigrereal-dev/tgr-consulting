import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { COOKIE_NAME } from "@shared/const";
import type { InsertUser, User } from "../../drizzle/schema";
import { getSessionCookieOptions } from "./cookies";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;

function parseHash(encoded: string) {
  const [algorithm, n, r, p, saltHex, hashHex, extra] = encoded.split("$");
  if (
    extra !== undefined ||
    algorithm !== "scrypt" ||
    Number(n) !== SCRYPT_N ||
    Number(r) !== SCRYPT_R ||
    Number(p) !== SCRYPT_P ||
    !/^[a-f0-9]{32,}$/i.test(saltHex ?? "") ||
    !/^[a-f0-9]{64}$/i.test(hashHex ?? "")
  ) return null;
  return { salt: Buffer.from(saltHex, "hex"), hash: Buffer.from(hashHex, "hex") };
}

export function hashStagingPassword(password: string, salt = randomBytes(16)) {
  if (password.length < 16)
    throw new Error("A senha de staging deve ter ao menos 16 caracteres.");
  const hash = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function isStagingPasswordHash(encoded: string) {
  return parseHash(encoded) !== null;
}

export function verifyStagingPassword(password: string, encoded: string) {
  const parsed = parseHash(encoded);
  if (!parsed) return false;
  const candidate = scryptSync(password, parsed.salt, parsed.hash.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return timingSafeEqual(candidate, parsed.hash);
}

type StagingLoginDependencies = {
  environment?: NodeJS.ProcessEnv;
  upsertUser: (user: InsertUser) => Promise<void>;
  getUserByOpenId: (openId: string) => Promise<Pick<User, "id" | "openId"> | undefined>;
  createSessionToken: (
    openId: string,
    options: { name: string; expiresInMs: number },
  ) => Promise<string>;
};

const STAGING_SESSION_MS = 12 * 60 * 60 * 1000;

export function createStagingLoginHandler(dependencies: StagingLoginDependencies) {
  const environment = dependencies.environment ?? process.env;
  return async (req: Request, res: Response) => {
    if (
      environment.APP_ENV !== "staging" ||
      environment.AUTH_MODE !== "staging_password"
    ) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const expectedOrigin = environment.APP_URL?.replace(/\/$/, "");
    const origin = typeof req.headers.origin === "string"
      ? req.headers.origin.replace(/\/$/, "")
      : "";
    if (!expectedOrigin || origin !== expectedOrigin) {
      res.status(403).json({ error: "invalid_origin" });
      return;
    }
    const username = typeof req.body?.username === "string"
      ? req.body.username.trim()
      : "";
    const password = typeof req.body?.password === "string"
      ? req.body.password
      : "";
    const expectedUsername = environment.STAGING_AUTH_USERNAME?.trim() ?? "";
    const passwordHash = environment.STAGING_AUTH_PASSWORD_HASH?.trim() ?? "";
    const authenticated =
      username.length > 0 &&
      username === expectedUsername &&
      verifyStagingPassword(password, passwordHash);
    if (!authenticated) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const openId = `staging:${username}`;
    const displayName = environment.STAGING_AUTH_DISPLAY_NAME?.trim() || "TGR Staging Admin";
    await dependencies.upsertUser({
      openId,
      name: displayName,
      email: null,
      loginMethod: "staging_password",
      role: "admin",
      lastSignedIn: new Date(),
    });
    const user = await dependencies.getUserByOpenId(openId);
    if (!user) {
      res.status(503).json({ error: "session_unavailable" });
      return;
    }
    const token = await dependencies.createSessionToken(openId, {
      name: displayName,
      expiresInMs: STAGING_SESSION_MS,
    });
    res.cookie(COOKIE_NAME, token, {
      ...getSessionCookieOptions(req),
      maxAge: STAGING_SESSION_MS,
    });
    res.status(200).json({ success: true });
  };
}
