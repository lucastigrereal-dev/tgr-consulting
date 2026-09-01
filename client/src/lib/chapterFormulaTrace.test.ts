import { describe, expect, it } from "vitest";
import { calculateFinancialProjection } from "@shared/financial/engine";
import type { FinancialInputSnapshot } from "@shared/financial/types";
import { getChapterFormulaTrace } from "./chapterFormulaTrace";
import { LIVE_DOCUMENT_CHAPTERS } from "./liveDocumentStructure";

const provided = (value: string) => ({ status: "provided" as const, value, sourceType: "assumption" as const, sourceRef: "chapter-formula-trace-test" });
const inputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("100"), qualifiedCouplesGrowthRate: provided("0"), conversionRate: provided("0.1"), averageTicket: provided("1000"), collectionRate: provided("0.8"), cancellationRate: provided("0.1"), variableCostRate: provided("0.2"), partnerShareRate: provided("0.05"), fixedCostMonthly: provided("1000"), payrollMonthly: provided("1000"), capexInitial: provided("5000"), preOperationMonths: provided("0"), entryValuePerContract: provided("100"), paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"), paymentCardInstallmentMixRate: provided("0"), paymentCardInstallmentMdrRate: provided("0"), paymentCardInstallmentSettlementDays: provided("0"), paymentDebitMixRate: provided("0"), paymentDebitMdrRate: provided("0"), paymentDebitSettlementDays: provided("0"), paymentRecurringChequeMixRate: provided("0"), paymentRecurringChequeMdrRate: provided("0"), paymentRecurringChequeSettlementDays: provided("0"), paymentBoletoMixRate: provided("0"), paymentBoletoMdrRate: provided("0"), paymentBoletoSettlementDays: provided("0"), discountRateAnnual: provided("0.12"),
};

describe("trilha editorial de fórmulas", () => {
  it("liga fórmulas de um snapshot calculado aos capítulos financeiros e mantém ficha-mãe sem fórmula inventada", () => {
    const calculation = calculateFinancialProjection(inputs, 24);
    expect(calculation.status).toBe("valid");
    if (calculation.status !== "valid") return;

    for (const chapter of LIVE_DOCUMENT_CHAPTERS.filter(item => item.formulaIds.length)) {
      const trace = getChapterFormulaTrace(chapter.href, calculation.memory);
      expect(trace.source).toBe("snapshot");
      expect(trace.formulas.map(item => item.formulaId)).toEqual(chapter.formulaIds);
      expect(trace.formulas.every(item => item.formulaVersion.length > 0)).toBe(true);
    }

    expect(getChapterFormulaTrace("#study-assumptions", calculation.memory)).toEqual({ source: "ficha_mae", formulas: [] });
    expect(getChapterFormulaTrace("#study-product", calculation.memory)).toEqual({ source: "ficha_mae", formulas: [] });
  });
});
