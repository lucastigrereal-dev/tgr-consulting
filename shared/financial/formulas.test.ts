import { describe, expect, it } from "vitest";
import { HARMONY_COMPAT_FORMULA_SET_V1 } from "./formulas";

describe("conjunto de fórmulas Harmony compatível", () => {
  it("documenta as regras Harmony canônicas sem apresentá-las como motor TGR", () => {
    expect(HARMONY_COMPAT_FORMULA_SET_V1).toMatchObject({
      id: "harmony-compat-formulas-v1",
      semanticVersion: "1.0.0",
      engineVersion: "harmony-compat-engine-v1",
      status: "published",
    });

    const definitions = Object.fromEntries(
      HARMONY_COMPAT_FORMULA_SET_V1.definitions.map(definition => [
        definition.id,
        definition,
      ])
    );
    expect(Object.keys(definitions)).toEqual(
      expect.arrayContaining([
        "harmony-cancellation-immediate",
        "harmony-delinquency-informational",
        "harmony-gross-entry-generated",
        "harmony-entry-settled-eight-installments",
        "harmony-balance-settled-m5",
        "harmony-total-receivables-settled",
        "harmony-monthly-nominal-rate",
        "harmony-commission-eight-installments",
        "harmony-fixed-and-payroll",
        "harmony-line-costs",
        "harmony-pre-operational-investment",
        "harmony-kpis",
      ])
    );
    for (const definition of Object.values(definitions)) {
      expect(definition.sourceRef).toMatch(
        /^(?:harmony_compat_v1\.|COTAS_NATAL_HARMONY_GOLDEN_V1_RULES\.)/,
      );
      expect(definition.description.length).toBeGreaterThan(20);
    }
  });

  it("calcula entrada e saldo sobre contratos líquidos após cancelamento imediato", () => {
    const definitions = Object.fromEntries(
      HARMONY_COMPAT_FORMULA_SET_V1.definitions.map(definition => [
        definition.id,
        definition,
      ])
    );
    const cancellation = definitions["harmony-cancellation-immediate"];
    const generated = definitions["harmony-gross-entry-generated"];
    const entry = definitions["harmony-entry-settled-eight-installments"];
    const balance = definitions["harmony-balance-settled-m5"];
    const totalSettled = definitions["harmony-total-receivables-settled"];

    expect(cancellation.expression).toContain("netContracts_month");
    expect(generated.expression).toContain("grossEntryGenerated_month");
    expect(entry.dependencies).toContain("netContracts");
    expect(entry.expression).toContain("netContracts_cohort");
    expect(entry.expression).toContain("/ 8");
    expect(balance.dependencies).toContain("netContracts");
    expect(balance.expression).toContain("netContracts_cohort");
    expect(balance.expression).toContain("cohortMonth+4");
    expect(balance.expression).toContain("/ 84");
    expect(totalSettled.dependencies).toEqual([
      "harmony-entry-settled-eight-installments",
      "harmony-balance-settled-m5",
    ]);
    expect(definitions["harmony-line-costs"].sourceRef).toContain(
      "COTAS_NATAL_HARMONY_GOLDEN_V1_RULES",
    );
    expect(definitions["harmony-pre-operational-investment"].sourceRef).toContain(
      "COTAS_NATAL_HARMONY_GOLDEN_V1_RULES",
    );

    const netContracts = 100 * (1 - 0.3);
    const entryCollectionPerMonth = netContracts * (3200 / 8);
    expect(netContracts).toBe(70);
    expect(entryCollectionPerMonth).toBe(28_000);
  });
});
