export type RuntimeHealth = {
  ok: boolean;
  environment: string;
  version: string;
  gitSha: string;
  database: "up" | "down";
};

export async function buildRuntimeHealth(options: {
  environment?: NodeJS.ProcessEnv;
  checkDatabase: () => Promise<boolean>;
}): Promise<RuntimeHealth> {
  const environment = options.environment ?? process.env;
  let databaseUp = false;
  try {
    databaseUp = await options.checkDatabase();
  } catch {
    databaseUp = false;
  }
  return {
    ok: databaseUp,
    environment: environment.APP_ENV?.trim() || "development",
    version: environment.APP_VERSION?.trim() || "dev",
    gitSha: environment.GIT_SHA?.trim() || "local",
    database: databaseUp ? "up" : "down",
  };
}
