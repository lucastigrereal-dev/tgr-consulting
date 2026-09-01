export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL",
  "VITE_APP_ID",
  "OAUTH_SERVER_URL",
  "OWNER_OPEN_ID",
  "JWT_SECRET",
  "BUILT_IN_FORGE_API_URL",
  "BUILT_IN_FORGE_API_KEY",
] as const;

export function assertProductionConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (environment.NODE_ENV !== "production") return;
  const missing = REQUIRED_PRODUCTION_ENV.filter(key => !environment[key]?.trim());
  const jwtSecret = environment.JWT_SECRET?.trim() ?? "";
  if (missing.length) {
    throw new Error(
      `Configuração de produção incompleta: ${Array.from(new Set(missing)).sort().join(", ")}.`,
    );
  }
  if (jwtSecret.length < 32) {
    throw new Error("Configuração de produção inválida: JWT_SECRET deve ter ao menos 32 caracteres.");
  }
}
