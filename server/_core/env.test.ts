import { describe, expect, it } from "vitest";
import { assertProductionConfiguration } from "./env";

const completeProductionEnvironment = {
  NODE_ENV: "production",
  APP_ENV: "production",
  APP_URL: "https://tgr.example",
  APP_VERSION: "1.0.0",
  GIT_SHA: "0123456789abcdef0123456789abcdef01234567",
  AUTH_MODE: "oauth",
  VITE_AUTH_MODE: "oauth",
  STORAGE_DRIVER: "forge",
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
      "APP_ENV, APP_URL, APP_VERSION, AUTH_MODE, DATABASE_URL, GIT_SHA, JWT_SECRET, STORAGE_DRIVER, VITE_APP_ID, VITE_AUTH_MODE",
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

  it("aceita autenticação e storage locais somente no ambiente staging", () => {
    const stagingEnvironment = {
      NODE_ENV: "production",
      APP_ENV: "staging",
      APP_URL: "https://tgr-staging.example",
      APP_VERSION: "1.0.0-staging",
      GIT_SHA: "0123456789abcdef0123456789abcdef01234567",
      AUTH_MODE: "staging_password",
      VITE_AUTH_MODE: "staging_password",
      DATABASE_URL: "mysql://local-test/tgr_staging",
      VITE_APP_ID: "tgr-staging",
      JWT_SECRET: "0123456789abcdef0123456789abcdef",
      STAGING_AUTH_USERNAME: "demo",
      STAGING_AUTH_PASSWORD_HASH: "scrypt$16384$8$1$00112233445566778899aabbccddeeff$00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      STORAGE_DRIVER: "filesystem",
      STORAGE_LOCAL_DIR: "/data/exports",
    } satisfies NodeJS.ProcessEnv;

    expect(() => assertProductionConfiguration(stagingEnvironment)).not.toThrow();
    expect(() => assertProductionConfiguration({
      ...stagingEnvironment,
      APP_ENV: "production",
    })).toThrow("AUTH_MODE=staging_password só pode ser usado com APP_ENV=staging");
  });

  it("falha fechado quando o staging seguro está incompleto", () => {
    expect(() => assertProductionConfiguration({
      NODE_ENV: "production",
      APP_ENV: "staging",
      APP_URL: "https://tgr-staging.example",
      APP_VERSION: "1.0.0-staging",
      GIT_SHA: "0123456789abcdef0123456789abcdef01234567",
      AUTH_MODE: "staging_password",
      VITE_AUTH_MODE: "staging_password",
      DATABASE_URL: "mysql://local-test/tgr_staging",
      VITE_APP_ID: "tgr-staging",
      JWT_SECRET: "0123456789abcdef0123456789abcdef",
      STORAGE_DRIVER: "filesystem",
    })).toThrow("STAGING_AUTH_PASSWORD_HASH, STAGING_AUTH_USERNAME, STORAGE_LOCAL_DIR");
  });

  it("recusa hash de senha de staging malformado", () => {
    expect(() => assertProductionConfiguration({
      NODE_ENV: "production",
      APP_ENV: "staging",
      APP_URL: "https://tgr-staging.example",
      APP_VERSION: "1.0.0-staging",
      GIT_SHA: "0123456789abcdef0123456789abcdef01234567",
      AUTH_MODE: "staging_password",
      VITE_AUTH_MODE: "staging_password",
      DATABASE_URL: "mysql://local-test/tgr_staging",
      VITE_APP_ID: "tgr-staging",
      JWT_SECRET: "0123456789abcdef0123456789abcdef",
      STAGING_AUTH_USERNAME: "demo",
      STAGING_AUTH_PASSWORD_HASH: "plaintext",
      STORAGE_DRIVER: "filesystem",
      STORAGE_LOCAL_DIR: "/data/exports",
    })).toThrow("STAGING_AUTH_PASSWORD_HASH deve usar o formato scrypt");
  });

  it("exige APP_URL HTTPS no runtime publicado", () => {
    expect(() => assertProductionConfiguration({
      ...completeProductionEnvironment,
      APP_URL: "http://tgr.example",
    })).toThrow("APP_URL deve usar HTTPS");
  });

  it("recusa drift entre o modo de autenticação do backend e do bundle", () => {
    expect(() => assertProductionConfiguration({
      ...completeProductionEnvironment,
      VITE_AUTH_MODE: "staging_password",
    })).toThrow("VITE_AUTH_MODE deve ser igual a AUTH_MODE");
  });
});
