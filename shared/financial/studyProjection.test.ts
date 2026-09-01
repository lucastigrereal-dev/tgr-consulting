import { describe, expect, it } from "vitest";
import { GOLDEN_NATAL_PONTA_NEGRA_2026 } from "./natalGolden";
import { calculateStudyProjection } from "./studyProjection";

describe("dispatcher canônico de cálculo por modo", () => {
  it("roteia Harmony sem reinterpretar opções do motor canônico", () => {
    const inputs = structuredClone(GOLDEN_NATAL_PONTA_NEGRA_2026.inputs);
    Object.assign(inputs, {
      collectionRate: { ...inputs.collectionRate, value: "1" },
      variableCostRate: { ...inputs.variableCostRate, value: "0" },
      fixedCostMonthly: { ...inputs.fixedCostMonthly, value: "117203" },
      payrollMonthly: { ...inputs.payrollMonthly, value: "0" },
      capexInitial: { ...inputs.capexInitial, value: "985500" },
      discountRateAnnual: { ...inputs.discountRateAnnual, value: "0.18" },
    });

    const result = calculateStudyProjection(
      "HARMONY_COMPAT_V1",
      inputs,
      120,
      { maxContracts: "3120" }
    );

    expect(result.financialModelMode).toBe("HARMONY_COMPAT_V1");
    expect(result.engineVersion).toBe("harmony-compat-engine-v1");
    expect(result.kpis.sellOutMonth).toBe("45.00000000");
  });

  it("preserva o motor canônico como default explícito", () => {
    const result = calculateStudyProjection(
      "TGR_CANONICAL_V2",
      GOLDEN_NATAL_PONTA_NEGRA_2026.inputs,
      120,
      GOLDEN_NATAL_PONTA_NEGRA_2026.options
    );
    expect(result.engineVersion).toBeTruthy();
    expect(result.financialModelMode).not.toBe("HARMONY_COMPAT_V1");
  });

  it("recusa opções canônicas incompatíveis no modo Harmony", () => {
    expect(() => calculateStudyProjection(
      "HARMONY_COMPAT_V1",
      GOLDEN_NATAL_PONTA_NEGRA_2026.inputs,
      120,
      GOLDEN_NATAL_PONTA_NEGRA_2026.options
    )).toThrow("não é suportada no modo Harmony");
  });
});
