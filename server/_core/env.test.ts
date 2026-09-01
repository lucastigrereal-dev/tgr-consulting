import { describe, expect, it } from "vitest";
import { assertProductionConfiguration } from "./env";

const completeProductionEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "mysql://local-test/tgr",
  VITE_APP_ID: "tgr-test",
  OAUTH_SERVER_URL: "https://oauth.invalid",
  OWNER_OPEN_ID: "tgr-owner",
  BUILT_IN_FORGE_API_URL: "https://storage.invalid",
  BUILT_IN_FORGE_API_KEY: "local-test-key",
  JWT_SECRET: "0123456789abcdef0123456789abcdef",
} satisfies NodeJS.ProcessEnv;

describe("configuração de produção", () => {
  it("não impõe credenciais de produção no desenvolvimento e nos testes", () => {
    expect(() => assertProductionConfiguration({ NODE_ENV: "test" })).not.toThrow();
  });

  it("falha fechado e lista somente os nomes das variáveis ausentes", () => {
    expect(() => assertProductionConfiguration({ NODE_ENV: "production" })).toThrow(
      "BUILT_IN_FORGE_API_KEY, BUILT_IN_FORGE_API_URL, DATABASE_URL, JWT_SECRET, OAUTH_SERVER_URL, OWNER_OPEN_ID, VITE_APP_ID",
    );
  });

  it("rejeita segredo JWT fraco sem expor o conteúdo", () => {
    expect(() => assertProductionConfiguration({
      ...completeProductionEnvironment,
      JWT_SECRET: "curto",
    })).toThrow("JWT_SECRET deve ter ao menos 32 caracteres");
  });

  it("aceita uma configuração de produção completa", () => {
    expect(() => assertProductionConfiguration(completeProductionEnvironment)).not.toThrow();
  });
});
