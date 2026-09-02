import { describe, expect, it } from "vitest";
import { buildRuntimeHealth } from "./runtimeHealth";

describe("runtime health", () => {
  it("expõe ambiente, versão e SHA sem devolver configuração sensível", async () => {
    const result = await buildRuntimeHealth({
      environment: {
        APP_ENV: "staging",
        APP_VERSION: "1.0.0-staging",
        GIT_SHA: "0123456789abcdef0123456789abcdef01234567",
        DATABASE_URL: "mysql://secret@db/tgr",
        JWT_SECRET: "never-return-this",
      },
      checkDatabase: async () => true,
    });

    expect(result).toEqual({
      ok: true,
      environment: "staging",
      version: "1.0.0-staging",
      gitSha: "0123456789abcdef0123456789abcdef01234567",
      database: "up",
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("marca indisponibilidade do banco sem vazar o erro", async () => {
    const result = await buildRuntimeHealth({
      environment: { APP_ENV: "staging", APP_VERSION: "dev", GIT_SHA: "local" },
      checkDatabase: async () => {
        throw new Error("mysql://secret@db/tgr");
      },
    });

    expect(result).toMatchObject({ ok: false, database: "down" });
    expect(JSON.stringify(result)).not.toContain("mysql");
  });
});
