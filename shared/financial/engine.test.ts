import { describe, expect, it } from "vitest";
import { calculateFinancialProjection } from "./engine";
import type { FinancialInputSnapshot } from "./types";

const provided = (value: string) => ({ status: "provided" as const, value, sourceType: "assumption" as const });

const completeInputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("100"),
  qualifiedCouplesGrowthRate: provided("0"),
  conversionRate: provided("0.1"),
  averageTicket: provided("1000"),
  collectionRate: provided("0.8"),
  cancellationRate: provided("0.1"),
  variableCostRate: provided("0.2"),
  partnerShareRate: provided("0.05"),
  fixedCostMonthly: provided("1000"),
  payrollMonthly: provided("1000"),
  capexInitial: provided("5000"),
  preOperationMonths: provided("0"),
  entryValuePerContract: provided("100"),
  paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"),
  paymentCardInstallmentMixRate: provided("0"), paymentCardInstallmentMdrRate: provided("0"), paymentCardInstallmentSettlementDays: provided("0"),
  paymentDebitMixRate: provided("0"), paymentDebitMdrRate: provided("0"), paymentDebitSettlementDays: provided("0"),
  paymentRecurringChequeMixRate: provided("0"), paymentRecurringChequeMdrRate: provided("0"), paymentRecurringChequeSettlementDays: provided("0"),
  paymentBoletoMixRate: provided("0"), paymentBoletoMdrRate: provided("0"), paymentBoletoSettlementDays: provided("0"),
  discountRateAnnual: provided("0.12"),
};

describe("motor financeiro determinístico", () => {
  it("reproduz a mesma projeção para o mesmo input e fórmula", () => {
    const first = calculateFinancialProjection(completeInputs, 120);
    const second = calculateFinancialProjection(completeInputs, 120);
    expect(first).toEqual(second);
    expect(first.status).toBe("valid");
    expect(first.projections).toHaveLength(120);
    expect(first.kpis.grossSales).toBe("1200000.00000000");
    expect(first.memory).toHaveLength(10);
    expect(first.memory.map((memory) => memory.kpiKey)).toEqual([
      "grossSales", "grossEntryGenerated", "recognizedRevenue", "paymentTermsNetSettlement", "commercialTeamMonthlyCost", "preOperationalInvestment", "operatingCashFlow", "npv", "irrAnnual", "paybackMonths",
    ]);
  });

  it("distribui a implantação antes da abertura e liquida a entrada pelo prazo e MDR de cada método", () => {
    const result = calculateFinancialProjection({
      ...completeInputs,
      fixedCostMonthly: provided("0"), payrollMonthly: provided("0"), variableCostRate: provided("0"), partnerShareRate: provided("0"),
      capexInitial: provided("600"), preOperationMonths: provided("2"), collectionRate: provided("1"), cancellationRate: provided("0"),
      paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0.1"), paymentCardViewSettlementDays: provided("60"),
    }, 6);
    expect(result.status).toBe("valid");
    expect(result.projections[0]).toMatchObject({ qualifiedCouples: "0.00000000", preOperationalInvestment: "300.00000000", operatingCashFlow: "-300.00000000" });
    expect(result.projections[2]).toMatchObject({ grossEntryGenerated: "1000.00000000", netCollections: "0.00000000" });
    expect(result.projections[4]).toMatchObject({ grossEntrySettled: "1000.00000000", paymentFees: "100.00000000", netCollections: "900.00000000", operatingCashFlow: "900.00000000" });
    expect(result.kpis).toMatchObject({ preOperationalInvestment: "600.00000000", paymentFees: "200.00000000", recognizedRevenue: "1800.00000000" });
  });

  it("aloca captação, sala e sales kit nos meses específicos quando o cronograma está completo", () => {
    const result = calculateFinancialProjection({
      ...completeInputs,
      capexInitial: provided("1000"), preOperationMonths: provided("3"),
      capexAcquisitionShareRate: provided("0.2"), capexAcquisitionMonth: provided("1"),
      capexSalesRoomShareRate: provided("0.5"), capexSalesRoomMonth: provided("2"),
      capexSalesKitShareRate: provided("0.3"), capexSalesKitMonth: provided("3"),
    }, 4);
    expect(result.status).toBe("valid");
    expect(result.projections.map(row => row.preOperationalInvestment)).toEqual(["200.00000000", "500.00000000", "300.00000000", "0.00000000"]);
  });

  it("rejeita cronograma de implantação parcialmente informado em vez de usar fallback silencioso", () => {
    expect(() => calculateFinancialProjection({
      ...completeInputs,
      capexInitial: provided("1000"),
      preOperationMonths: provided("3"),
      capexAcquisitionShareRate: provided("0.2"),
      capexAcquisitionMonth: provided("1"),
    }, 4)).toThrow("cronograma de implantação");
  });

  it("rejeita taxas financeiras fora do intervalo de 0% a 100%", () => {
    expect(() => calculateFinancialProjection({
      ...completeInputs,
      conversionRate: provided("1.01"),
    }, 12)).toThrow("conversionRate");

    expect(() => calculateFinancialProjection({
      ...completeInputs,
      cancellationRate: provided("-0.01"),
    }, 12)).toThrow("cancellationRate");
  });

  it("rejeita volumes e valores econômicos negativos", () => {
    expect(() => calculateFinancialProjection({
      ...completeInputs,
      averageTicket: provided("-1000"),
    }, 12)).toThrow("averageTicket");

    expect(() => calculateFinancialProjection({
      ...completeInputs,
      capexInitial: provided("-1"),
    }, 12)).toThrow("capexInitial");

    expect(() => calculateFinancialProjection({
      ...completeInputs,
      paymentCardViewSettlementDays: provided("-1"),
    }, 12)).toThrow("paymentCardViewSettlementDays");
  });

  it("não calcula quando uma premissa permanece pendente", () => {
    const pendingInputs: FinancialInputSnapshot = {
      ...completeInputs,
      averageTicket: { status: "pending", sourceType: "current_decision" },
    };
    const result = calculateFinancialProjection(pendingInputs, 24);
    expect(result.status).toBe("blocked_by_pending_inputs");
    expect(result.missingInputKeys).toEqual(["averageTicket"]);
    expect(result.projections).toHaveLength(0);
  });

  it("rejeita horizonte fora da faixa de 1 a 120 meses", () => {
    expect(() => calculateFinancialProjection(completeInputs, 0)).toThrow("1 e 120 meses");
    expect(() => calculateFinancialProjection(completeInputs, 121)).toThrow("1 e 120 meses");
  });
});
