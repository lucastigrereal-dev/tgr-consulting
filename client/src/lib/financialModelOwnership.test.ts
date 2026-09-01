import { describe, expect, it } from "vitest";
import {
  isGoalSeekLeverApplyable,
  normalizeMeetingVariableCostDelta,
  resolveFinancialModelModeFromFormulaSet,
} from "./financialModelOwnership";

describe("financial model ownership guards", () => {
  it("fixa o delta de custo variável Harmony em zero sem alterar o modo canônico", () => {
    expect(normalizeMeetingVariableCostDelta("HARMONY_COMPAT_V1", "1250")).toBe("0");
    expect(normalizeMeetingVariableCostDelta("TGR_CANONICAL_V2", "1250")).toBe("1250");
    expect(normalizeMeetingVariableCostDelta(null, "1250")).toBe("0");
  });

  it("só aplica no Harmony as alavancas input-owned aceitas pelo backend", () => {
    for (const key of [
      "qualifiedCouplesMonth1",
      "qualifiedCouplesGrowthRate",
      "conversionRate",
      "averageTicket",
      "entryValuePerContract",
      "variableCostRate",
      "partnerShareRate",
    ] as const) {
      expect(isGoalSeekLeverApplyable("HARMONY_COMPAT_V1", key)).toBe(false);
    }
    for (const key of ["capexInitial", "fixedCostMonthly", "payrollMonthly"] as const) {
      expect(isGoalSeekLeverApplyable("HARMONY_COMPAT_V1", key)).toBe(true);
    }
    for (const key of [
      "averageTicket",
      "entryValuePerContract",
      "qualifiedCouplesMonth1",
      "qualifiedCouplesGrowthRate",
      "conversionRate",
    ] as const) {
      expect(isGoalSeekLeverApplyable("TGR_CANONICAL_V2", key)).toBe(false);
    }
    expect(isGoalSeekLeverApplyable("TGR_CANONICAL_V2", "capexInitial")).toBe(true);
    expect(isGoalSeekLeverApplyable(null, "capexInitial")).toBe(false);
  });

  it("resolve o modo pelo formula set e falha fechado para identidade desconhecida", () => {
    expect(resolveFinancialModelModeFromFormulaSet("harmony-compat-formulas-v1")).toBe("HARMONY_COMPAT_V1");
    expect(resolveFinancialModelModeFromFormulaSet("igr-core-formulas-v1-9")).toBe("TGR_CANONICAL_V2");
    expect(resolveFinancialModelModeFromFormulaSet(undefined)).toBeNull();
    expect(resolveFinancialModelModeFromFormulaSet("desconhecido")).toBeNull();
  });
});
