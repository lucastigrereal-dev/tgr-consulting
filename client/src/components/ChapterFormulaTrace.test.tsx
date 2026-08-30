import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { calculateFinancialProjection } from "@shared/financial/engine";
import type { FinancialInputSnapshot } from "@shared/financial/types";
import { getChapterFormulaTrace } from "@/lib/chapterFormulaTrace";
import { ChapterFormulaTrace } from "./ChapterFormulaTrace";

const provided = (value: string) => ({ status: "provided" as const, value, sourceType: "assumption" as const, sourceRef: "chapter-formula-ui-test" });
const pending = () => ({ status: "pending" as const, sourceType: "assumption" as const, sourceRef: "chapter-formula-ui-test" });
const inputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("100"), qualifiedCouplesGrowthRate: provided("0"), conversionRate: provided("0.1"), averageTicket: provided("1000"), collectionRate: provided("0.8"), cancellationRate: provided("0.1"), variableCostRate: provided("0.2"), partnerShareRate: provided("0.05"), fixedCostMonthly: provided("1000"), payrollMonthly: provided("1000"), capexInitial: provided("5000"), preOperationMonths: provided("0"), entryValuePerContract: provided("100"), paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"), paymentCardInstallmentMixRate: provided("0"), paymentCardInstallmentMdrRate: provided("0"), paymentCardInstallmentSettlementDays: provided("0"), paymentDebitMixRate: provided("0"), paymentDebitMdrRate: provided("0"), paymentDebitSettlementDays: provided("0"), paymentRecurringChequeMixRate: provided("0"), paymentRecurringChequeMdrRate: provided("0"), paymentRecurringChequeSettlementDays: provided("0"), paymentBoletoMixRate: provided("0"), paymentBoletoMdrRate: provided("0"), paymentBoletoSettlementDays: provided("0"), discountRateAnnual: provided("0.12"), capexAcquisitionShareRate: pending(), capexAcquisitionMonth: pending(), capexSalesRoomShareRate: pending(), capexSalesRoomMonth: pending(), capexSalesKitShareRate: pending(), capexSalesKitMonth: pending(),
};

describe("ChapterFormulaTrace", () => {
  it("renderiza fórmula e versão vindas do snapshot, ou declara ficha-mãe quando não há fórmula financeira", () => {
    const calculation = calculateFinancialProjection(inputs, 24);
    expect(calculation.status).toBe("valid");
    if (calculation.status !== "valid") return;
    const sales = getChapterFormulaTrace("#study-sales", calculation.memory);
    const salesHtml = renderToStaticMarkup(<ChapterFormulaTrace source={sales.source} memory={sales.formulas} />);
    expect(salesHtml).toContain('data-testid="chapter-formula-trace"');
    expect(salesHtml).toContain("gross-sales");
    expect(salesHtml).toContain("v1.2.0");

    const assumptions = getChapterFormulaTrace("#study-assumptions", calculation.memory);
    const assumptionsHtml = renderToStaticMarkup(<ChapterFormulaTrace source={assumptions.source} memory={assumptions.formulas} />);
    expect(assumptionsHtml).toContain("ficha-mãe");
  });
});
