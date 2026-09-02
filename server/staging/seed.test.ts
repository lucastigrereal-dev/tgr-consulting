import { describe, expect, it } from "vitest";
import {
  assertHarmonySeedKpis,
  assertStagingSeedAllowed,
  findCanonicalBaselineEntry,
  STAGING_NATAL_PROJECT_NAME,
} from "./seed";

describe("staging Natal seed guard", () => {
  it("só permite o seed explicitamente habilitado no staging", () => {
    expect(() => assertStagingSeedAllowed({
      NODE_ENV: "production",
      APP_ENV: "staging",
      STAGING_SEED_NATAL: "true",
    })).not.toThrow();
    expect(STAGING_NATAL_PROJECT_NAME).toBe("Projeto Único Ponta Negra");
  });

  it("recusa produção, desenvolvimento e opt-in ausente", () => {
    expect(() => assertStagingSeedAllowed({
      NODE_ENV: "production",
      APP_ENV: "production",
      STAGING_SEED_NATAL: "true",
    })).toThrow("exclusivo de staging");
    expect(() => assertStagingSeedAllowed({
      NODE_ENV: "production",
      APP_ENV: "staging",
    })).toThrow("STAGING_SEED_NATAL=true");
  });

  it("bloqueia o startup quando o banco diverge do Golden Harmony", () => {
    const expected = {
      capitalRequired: "1791989.83333333",
      npv: "21612035.93196289",
      irrAnnual: "1.30835396",
      paybackMonths: "25.00000000",
      grossReceivablesGenerated: "87360000.00000000",
    };
    expect(() => assertHarmonySeedKpis("C1_28K", expected)).not.toThrow();
    expect(() => assertHarmonySeedKpis("C1_28K", {
      ...expected,
      npv: "21612035.00",
    })).toThrow("C1_28K.npv divergiu do Golden Harmony");
  });

  it("mantém a baseline canônica de 100 mesmo após outro cenário ser congelado", () => {
    const canonical = { versionId: "base-100", label: "Baseline", snapshotId: "snap-100" };
    const frozenScenario = { versionId: "scenario-120", label: "Natal 120 vendas", snapshotId: "snap-120" };

    expect(findCanonicalBaselineEntry([frozenScenario, canonical])).toBe(canonical);
  });
});
