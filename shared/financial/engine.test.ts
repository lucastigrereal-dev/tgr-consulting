import { describe, expect, it } from "vitest";
import { calculateFinancialProjection } from "./engine";
import { calculatePointEconomics } from "./pointEconomics";
import { calculateCommercialOperations } from "./commercialOperations";
import { IGR_CORE_FORMULA_SET_V1 } from "./formulas";
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

const NEW_KPI_FORMULA_IDS = {
  totalGrossContracts: "total-gross-contracts",
  totalNetContracts: "total-net-contracts",
  sellOutMonth: "sell-out-month",
  contributionMargin: "contribution-margin",
  operatingMarginRate: "operating-margin-rate",
  capitalRequired: "capital-required",
  worstCashMonth: "worst-cash-month",
  breakEvenMonth: "break-even-month",
} as const;

describe("motor financeiro determinístico", () => {
  it("reproduz a mesma projeção para o mesmo input e fórmula", () => {
    const first = calculateFinancialProjection(completeInputs, 120);
    const second = calculateFinancialProjection(completeInputs, 120);
    expect(first).toEqual(second);
    expect(first.status).toBe("valid");
    expect(first.projections).toHaveLength(120);
    expect(first.kpis.grossSales).toBe("1200000.00000000");
    expect(first.memory).toHaveLength(26);
    expect(first.memory.map((memory) => memory.kpiKey)).toEqual([
      "grossSales", "grossEntryGenerated", "grossReceivablesGenerated", "grossReceivablesSettled", "installmentCollections", "canceledReceivables", "delinquentBalance", "curedCollections", "writtenOffBalance", "healthyD90", "recognizedRevenue", "paymentTermsNetSettlement", "commercialTeamMonthlyCost", "preOperationalInvestment", "operatingCashFlow", "totalGrossContracts", "totalNetContracts", "sellOutMonth", "contributionMargin", "operatingMarginRate", "capitalRequired", "worstCashMonth", "breakEvenMonth", "npv", "irrAnnual", "paybackMonths",
    ]);
  });

  it("publica definição e memória versionada para cada KPI novo", () => {
    const result = calculateFinancialProjection(completeInputs, 3, {
      maxContracts: "15",
    });

    expect(IGR_CORE_FORMULA_SET_V1.status).toBe("published");
    for (const [kpiKey, formulaId] of Object.entries(NEW_KPI_FORMULA_IDS) as Array<
      [keyof typeof NEW_KPI_FORMULA_IDS, string]
    >) {
      const definition = IGR_CORE_FORMULA_SET_V1.definitions.find(
        candidate => candidate.id === formulaId,
      );
      expect(definition).toMatchObject({ id: formulaId, version: "1.0.0" });
      expect(result.memory.find(record => record.kpiKey === kpiKey)).toMatchObject({
        kpiKey,
        value: result.kpis[kpiKey],
        formulaId,
        formulaVersion: "1.0.0",
      });
    }
  });

  it("limita contratos ao estoque comercial disponível", () => {
    const result = calculateFinancialProjection(completeInputs, 3, {
      maxContracts: "15",
    });

    expect(result.projections.map(row => row.contracts)).toEqual([
      "10.00000000",
      "5.00000000",
      "0.00000000",
    ]);
    expect(result.kpis.grossSales).toBe("15000.00000000");
    expect(result.kpis.grossEntryGenerated).toBe("1500.00000000");
  });

  it("devolve cancelamentos ao estoque no mês do evento e permite revenda sem dupla contagem física", () => {
    const result = calculateFinancialProjection({
      ...completeInputs,
      collectionRate: { status: "pending", sourceType: "current_decision" },
      cancellationRate: { status: "pending", sourceType: "current_decision" },
    }, 3, {
      maxContracts: "15",
      receivablesPolicy: {
        cancellationCurve: {
          d7: "0.5", d30: "0.5", d60: "0.5",
          d90: "0.5", d180: "0.5", lifetime: "0.5",
        },
        delinquencyRate: "0",
        cureRates: {
          days1To30: "0", days31To60: "0",
          days61To90: "0", days90Plus: "0",
        },
        writeOffAfterDays: 90,
        policyVersion: "inventory-return-test-v1",
        sourceRef: "engine-test",
      },
    });

    expect(result.projections.map(row => row.contracts)).toEqual([
      "10.00000000", "10.00000000", "5.00000000",
    ]);
    expect(result.projections.map(row => ({
      grossContracts: row.grossContracts,
      canceledContracts: row.canceledContracts,
      netContracts: row.netContracts,
      cumulativeGrossContracts: row.cumulativeGrossContracts,
      activeContracts: row.activeContracts,
      returnedToInventory: row.returnedToInventory,
      availableInventory: row.availableInventory,
      sellOutRate: row.sellOutRate,
    }))).toEqual([
      {
        grossContracts: "10.00000000", canceledContracts: "0.00000000",
        netContracts: "10.00000000", cumulativeGrossContracts: "10.00000000",
        activeContracts: "10.00000000", returnedToInventory: "0.00000000",
        availableInventory: "5.00000000", sellOutRate: "0.66666667",
      },
      {
        grossContracts: "10.00000000", canceledContracts: "5.00000000",
        netContracts: "5.00000000", cumulativeGrossContracts: "20.00000000",
        activeContracts: "15.00000000", returnedToInventory: "5.00000000",
        availableInventory: "0.00000000", sellOutRate: "1.00000000",
      },
      {
        grossContracts: "5.00000000", canceledContracts: "5.00000000",
        netContracts: "0.00000000", cumulativeGrossContracts: "25.00000000",
        activeContracts: "15.00000000", returnedToInventory: "5.00000000",
        availableInventory: "0.00000000", sellOutRate: "1.00000000",
      },
    ]);
    expect(result.kpis).toMatchObject({
      totalGrossContracts: "25.00000000",
      totalNetContracts: "15.00000000",
      sellOutMonth: "2.00000000",
    });
  });

  it("reconcilia DRE e caixa mensal e deriva os novos KPIs do próprio fluxo", () => {
    const result = calculateFinancialProjection({
      ...completeInputs,
      qualifiedCouplesMonth1: provided("10"), conversionRate: provided("0.1"),
      averageTicket: provided("1000"), entryValuePerContract: provided("1000"),
      collectionRate: provided("1"), cancellationRate: provided("0"),
      variableCostRate: provided("0.2"), partnerShareRate: provided("0.1"),
      fixedCostMonthly: provided("100"), payrollMonthly: provided("50"),
      capexInitial: provided("1000"), discountRateAnnual: provided("0"),
    }, 3);

    expect(result.projections[0]).toMatchObject({
      taxes: "0.00000000",
      cashOpening: "0.00000000",
      cashInflows: "1000.00000000",
      cashOutflows: "1450.00000000",
      contributionMargin: "700.00000000",
      operatingResult: "550.00000000",
      cashClosing: "-450.00000000",
    });
    expect(result.projections[1]).toMatchObject({
      cashOpening: "-450.00000000",
      cashClosing: "100.00000000",
    });
    expect(result.kpis).toMatchObject({
      contributionMargin: "2100.00000000",
      operatingMarginRate: "0.55000000",
      capitalRequired: "450.00000000",
      worstCashMonth: "1.00000000",
      breakEvenMonth: "2.00000000",
    });
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

  it("liquida calendário comercial autoritativo por coorte de venda", () => {
    const result = calculateFinancialProjection({
      ...completeInputs,
      qualifiedCouplesMonth1: provided("10"), conversionRate: provided("0.1"),
      fixedCostMonthly: provided("0"), payrollMonthly: provided("0"), variableCostRate: provided("0"), partnerShareRate: provided("0"),
      averageTicket: provided("1000"), entryValuePerContract: provided("100"),
      collectionRate: provided("1"), cancellationRate: provided("0"),
      capexInitial: provided("0"), discountRateAnnual: provided("0"),
      paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"),
    }, 5, {
      paymentSchedulePerContract: [
        { component: "entry", dueMonthOffset: 0, grossAmount: "100" },
        { component: "balance", dueMonthOffset: 1, grossAmount: "450" },
        { component: "balance", dueMonthOffset: 2, grossAmount: "450" },
      ],
    });

    expect(result.status).toBe("valid");
    expect(result.projections.map(row => row.grossEntryGenerated)).toEqual([
      "100.00000000",
      "100.00000000",
      "100.00000000",
      "100.00000000",
      "100.00000000",
    ]);
    expect(result.projections.map(row => row.installmentCollections)).toEqual([
      "0.00000000",
      "450.00000000",
      "900.00000000",
      "900.00000000",
      "900.00000000",
    ]);
    expect(result.projections.map(row => row.netCollections)).toEqual([
      "100.00000000",
      "550.00000000",
      "1000.00000000",
      "1000.00000000",
      "1000.00000000",
    ]);
    expect(result.kpis.recognizedRevenue).toBe("3650.00000000");
  });

  it("substitui taxas agregadas por política de carteira com cura, perda e Healthy D90", () => {
    const result = calculateFinancialProjection({
      ...completeInputs,
      qualifiedCouplesMonth1: provided("10"),
      conversionRate: provided("0.1"),
      collectionRate: { status: "pending", sourceType: "current_decision" },
      cancellationRate: { status: "pending", sourceType: "current_decision" },
      fixedCostMonthly: provided("0"), payrollMonthly: provided("0"),
      variableCostRate: provided("0"), partnerShareRate: provided("0"),
      capexInitial: provided("0"), discountRateAnnual: provided("0"),
    }, 4, {
      paymentSchedulePerContract: [
        { component: "entry", dueMonthOffset: 0, grossAmount: "100" },
      ],
      receivablesPolicy: {
        cancellationCurve: { d7: "0", d30: "0", d60: "0", d90: "0", d180: "0", lifetime: "0" },
        delinquencyRate: "1",
        cureRates: { days1To30: "0.5", days31To60: "0", days61To90: "0", days90Plus: "0" },
        writeOffAfterDays: 90,
        policyVersion: "portfolio-test-v1",
        sourceRef: "engine-test",
      },
    });

    expect(result.receivablesPortfolio?.ledger).toHaveLength(4);
    expect(result.projections.map(row => row.curedCollections)).toEqual([
      "0.00000000", "50.00000000", "50.00000000", "50.00000000",
    ]);
    expect(result.projections[3]).toMatchObject({
      writtenOffBalance: "50.00000000",
      healthyD90: "0.50000000",
    });
    expect(result.kpis).toMatchObject({
      curedCollections: "150.00000000",
      writtenOffBalance: "50.00000000",
      healthyD90: "0.50000000",
    });
  });

  it("usa Point Economics como capacidade autoritativa e inclui apenas custos incrementais no caixa", () => {
    const pointEconomics = calculatePointEconomics({
      points: [{
        pointId: "totem-cotia",
        name: "Totem Cotia",
        channel: "Mall",
        activationCost: "200",
        monthlyFixedCost: "100",
        costPerSale: "10",
        approaches: "100",
        researchRate: "1",
        qualificationRate: "1",
        invitationRate: "1",
        appointmentRate: "1",
        showRate: "1",
        tourRate: "1",
        saleRate: "0.1",
        averageTicket: "1000",
        averageEntry: "100",
        contributionMarginRate: "0.75",
        healthyD90Rate: "0.8",
        cannibalizationRate: "0",
        cashflowTreatment: "incremental",
      }],
    });
    const result = calculateFinancialProjection({
      ...completeInputs,
      qualifiedCouplesMonth1: { status: "pending", sourceType: "current_decision" },
      qualifiedCouplesGrowthRate: { status: "pending", sourceType: "current_decision" },
      conversionRate: { status: "pending", sourceType: "current_decision" },
    }, 2, { pointEconomics });

    expect(result.status).toBe("valid");
    expect(result.projections.map(row => row.qualifiedCouples)).toEqual([
      "100.00000000", "100.00000000",
    ]);
    expect(result.projections.map(row => row.contracts)).toEqual([
      "10.00000000", "10.00000000",
    ]);
    expect(result.projections[0]).toMatchObject({
      grossSales: "10000.00000000",
      preOperationalInvestment: "5200.00000000",
      fixedCosts: "1200.00000000",
    });
    expect(result.projections[1]?.fixedCosts).toBe("1200.00000000");
    expect(result.pointEconomics).toEqual(pointEconomics);
    expect(result.memory.at(-1)).toMatchObject({
      kpiKey: "pointEconomicsIncrementalNetContribution",
      value: "7300.00000000",
      formulaId: "point-economics",
    });
  });

  it("limita vendas pela operação e reconhece workforce, treinamento e comissão sem dupla contagem", () => {
    const pointEconomics = calculatePointEconomics({ points: [{
      pointId: "mall", name: "Mall", channel: "Shopping", activationCost: "0",
      monthlyFixedCost: "0", costPerSale: "0", approaches: "100",
      researchRate: "1", qualificationRate: "1", invitationRate: "1",
      appointmentRate: "1", showRate: "1", tourRate: "1", saleRate: "0.1",
      averageTicket: "1000", averageEntry: "100", contributionMarginRate: "1",
      healthyD90Rate: "1", cannibalizationRate: "0",
      cashflowTreatment: "included_in_project_totals",
    }] });
    const commercialOperations = calculateCommercialOperations({
      horizonMonths: 2,
      pointDemand: { toursMonthly: "100", salesMonthly: "10" },
      definition: {
        room: {
          rooms: [{ roomId: "main", tables: "2", overflowTables: "0" }],
          operatingDaysPerMonth: "20", operatingHoursPerDay: "8", shifts: "2",
          averageTourDurationMinutes: "60", toursPerTable: "1",
          receptionists: "1", receptionCapacityPerPerson: "200",
          consultants: "1", consultantCapacityPerPerson: "150",
          closers: "1", closerSalesCapacityPerPerson: "20",
          peakFlowFactor: "1", maxWaitMinutes: "15",
        },
        workforce: { cashflowTreatment: "incremental", cohorts: [
          { cohortId: "consultants", role: "consultant", capacityUnit: "tours", headcount: "1", hireMonth: 0, trainingMonths: 0, certificationRate: "1", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }], matureProductivity: "80", absenteeismRate: "0", monthlyTurnoverRate: "0", fixedCompensation: "100", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0" },
          { cohortId: "closers", role: "closer", capacityUnit: "sales", headcount: "1", hireMonth: 0, trainingMonths: 0, certificationRate: "1", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }], matureProductivity: "8", absenteeismRate: "0", monthlyTurnoverRate: "0", fixedCompensation: "200", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0" },
        ] },
        training: { cashflowTreatment: "incremental", plans: [{ trainingId: "academy", role: "closer", startMonth: 0, candidates: "2", classes: "1", durationMonths: 1, trainers: "1", trainerMonthlyCost: "50", candidateMonthlySalary: "25", monthlySupportCost: "0", approvalRate: "1", certificationRate: "1", timeToProductiveMonths: 0, targetProductivePeople: "2" }] },
        commissions: { cashflowTreatment: "incremental", policies: [
          { policyId: "closer-fixed", role: "closer", eligibleBase: "fixed", mode: "fixed", fixedAmount: "10", percentageRate: "0", tiers: [], guarantee: "0", cutoffDay: 15, paymentLagMonths: 0, qualityMultiplier: "1", holdbackRate: "0", reversalEnabled: false },
          { policyId: "closer-d30", role: "closer", eligibleBase: "d30", mode: "percentage", fixedAmount: "0", percentageRate: "1", tiers: [], guarantee: "0", cutoffDay: 15, paymentLagMonths: 0, qualityMultiplier: "1", holdbackRate: "0", reversalEnabled: false },
        ] },
      },
    });
    const result = calculateFinancialProjection({
      ...completeInputs,
      fixedCostMonthly: provided("0"), payrollMonthly: provided("0"),
      variableCostRate: provided("0"), partnerShareRate: provided("0"),
      capexInitial: provided("0"), collectionRate: provided("1"),
      cancellationRate: provided("0"), discountRateAnnual: provided("0"),
    }, 2, {
      pointEconomics,
      commercialOperations,
      receivablesPolicy: {
        cancellationCurve: { d7: "0", d30: "0.25", d60: "0.25", d90: "0.25", d180: "0.25", lifetime: "0.25" },
        delinquencyRate: "0.2",
        cureRates: { days1To30: "0.5", days31To60: "0", days61To90: "0", days90Plus: "0" },
        writeOffAfterDays: 90,
        policyVersion: "commission-d30-test-v1",
        sourceRef: "engine-test",
      },
    });

    expect(result.projections[0]).toMatchObject({
      contracts: "8.00000000",
      commercialOperationsCosts: "400.00000000",
      commissionPayments: "10.00000000",
      operatingCashFlow: "230.00000000",
    });
    expect(result.projections[1]).toMatchObject({
      contracts: "8.00000000",
      commercialOperationsCosts: "300.00000000",
      commissionPayments: "15.40000000",
      operatingCashFlow: "404.60000000",
    });
    expect(result.commissionLedger?.totals.payable).toBe("30.80000000");
    expect(result.commissionLedger?.accruals.find(record => record.policyId === "closer-d30")).toMatchObject({
      accrualMonth: 2,
      paymentMonth: 2,
      eligibleAmount: "5.40000000",
      payableCommission: "5.40000000",
    });
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
