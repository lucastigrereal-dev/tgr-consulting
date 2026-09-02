import { isStagingPasswordHash } from "./stagingAuth";

export const ENV = {
  appEnv: process.env.APP_ENV ?? "development",
  appUrl: process.env.APP_URL ?? "",
  appVersion: process.env.APP_VERSION ?? "dev",
  gitSha: process.env.GIT_SHA ?? "local",
  authMode: process.env.AUTH_MODE ?? "oauth",
  viteAuthMode: process.env.VITE_AUTH_MODE ?? "oauth",
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  stagingAuthUsername: process.env.STAGING_AUTH_USERNAME ?? "",
  stagingAuthPasswordHash: process.env.STAGING_AUTH_PASSWORD_HASH ?? "",
  storageDriver: process.env.STORAGE_DRIVER ?? "forge",
  storageLocalDir: process.env.STORAGE_LOCAL_DIR ?? "",
};

const REQUIRED_RUNTIME_ENV = [
  "APP_ENV",
  "APP_URL",
  "APP_VERSION",
  "AUTH_MODE",
  "DATABASE_URL",
  "GIT_SHA",
  "JWT_SECRET",
  "STORAGE_DRIVER",
  "VITE_APP_ID",
  "VITE_AUTH_MODE",
] as const;

export function assertProductionConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (environment.NODE_ENV !== "production") return;
  const missing: string[] = [...REQUIRED_RUNTIME_ENV].filter(
    key => !environment[key]?.trim(),
  );
  if (missing.length) {
    throw new Error(
      `Configuração de produção incompleta: ${Array.from(new Set(missing)).sort().join(", ")}.`,
    );
  }
  let appUrl: URL;
  try {
    appUrl = new URL(environment.APP_URL!);
  } catch {
    throw new Error("Configuração de produção inválida: APP_URL deve ser uma URL HTTPS válida.");
  }
  if (appUrl.protocol !== "https:" || appUrl.username || appUrl.password)
    throw new Error("Configuração de produção inválida: APP_URL deve usar HTTPS e não conter credenciais.");

  const authMode = environment.AUTH_MODE?.trim();
  const viteAuthMode = environment.VITE_AUTH_MODE?.trim();
  const appEnv = environment.APP_ENV?.trim();
  if (viteAuthMode !== authMode) {
    throw new Error(
      "Configuração de produção inválida: VITE_AUTH_MODE deve ser igual a AUTH_MODE.",
    );
  }
  if (authMode === "staging_password") {
    if (appEnv !== "staging")
      throw new Error(
        "Configuração de produção inválida: AUTH_MODE=staging_password só pode ser usado com APP_ENV=staging.",
      );
    missing.push(
      ...["STAGING_AUTH_PASSWORD_HASH", "STAGING_AUTH_USERNAME"].filter(
        key => !environment[key]?.trim(),
      ),
    );
  } else if (authMode === "oauth") {
    missing.push(
      ...[
        "OAUTH_SERVER_URL",
        "OWNER_OPEN_ID",
      ].filter(key => !environment[key]?.trim()),
    );
  } else {
    throw new Error(`Configuração de produção inválida: AUTH_MODE não suportado: ${authMode}.`);
  }

  const storageDriver = environment.STORAGE_DRIVER?.trim();
  if (storageDriver === "filesystem") {
    if (appEnv !== "staging")
      throw new Error(
        "Configuração de produção inválida: STORAGE_DRIVER=filesystem só pode ser usado com APP_ENV=staging.",
      );
    if (!environment.STORAGE_LOCAL_DIR?.trim()) missing.push("STORAGE_LOCAL_DIR");
  } else if (storageDriver === "forge") {
    missing.push(
      ...["BUILT_IN_FORGE_API_KEY", "BUILT_IN_FORGE_API_URL"].filter(
        key => !environment[key]?.trim(),
      ),
    );
  } else {
    throw new Error(
      `Configuração de produção inválida: STORAGE_DRIVER não suportado: ${storageDriver}.`,
    );
  }

  const jwtSecret = environment.JWT_SECRET?.trim() ?? "";
  if (missing.length) {
    throw new Error(
      `Configuração de produção incompleta: ${Array.from(new Set(missing)).sort().join(", ")}.`,
    );
  }
  if (
    authMode === "staging_password" &&
    !isStagingPasswordHash(environment.STAGING_AUTH_PASSWORD_HASH?.trim() ?? "")
  ) throw new Error(
    "Configuração de produção inválida: STAGING_AUTH_PASSWORD_HASH deve usar o formato scrypt suportado.",
  );
  if (jwtSecret.length < 32) {
    throw new Error("Configuração de produção inválida: JWT_SECRET deve ter ao menos 32 caracteres.");
  }
}
