import {
  calculateFinancialProjection,
  FinanceDecimal,
  type FinancialProjectionOptions,
} from "./engine";
import type { FinancialCalculation, FinancialInputSnapshot } from "./types";

export type CaptadorSimulationInput = {
  inputs: FinancialInputSnapshot;
  horizonMonths: number;
  captadorDelta: string;
  qualifiedCouplesPerCaptadorMonth: string;
  loadedCostPerCaptadorMonth: string;
  averageTicketDelta?: string;
  fixedCostMonthlyDelta?: string;
  payrollMonthlyDelta?: string;
  variableCostMonthlyDelta?: string;
  capexInitialDelta?: string;
  maxContracts?: string;
  calculationOptions?: FinancialProjectionOptions;
  simulatedCalculationOptions?: FinancialProjectionOptions;
  targetGrossSalesMonth1?: string;
  includeLeverBreakdown?: boolean;
};

export type MarginalAnalysis = {
  grossSales: string;
  cost: string;
  operatingCash: string;
  monthlyOperatingCash: string;
  investment: string;
  npv: string;
  irrAnnual: string;
  paybackMonths: string;
  recoveryMonths: string | null;
  method: string;
  byLever: Array<{ key: string; label: string; marginal: Omit<MarginalAnalysis, "byLever"> }>;
};

type SimulationState = {
  grossSalesMonth1: string;
  qualifiedCouplesMonth1: string;
  payrollMonthly: string;
  averageTicket: string;
  fixedCostMonthly: string;
  variableCostRate: string;
  variableCostMonthly: string;
  capexInitial: string;
  kpis: FinancialCalculation["kpis"];
};

export type MeetingSimulationResult = {
  mode: "non_persistent";
  assumptions: Record<string, string>;
  before: SimulationState;
  after: SimulationState;
  marginal: MarginalAnalysis;
};

function decimalText(value: InstanceType<typeof FinanceDecimal>) {
  return value.toFixed(8);
}

function decimalOrZero(value: string | null) {
  return new FinanceDecimal(value ?? "0");
}

function operatingCostTotal(calculation: FinancialCalculation) {
  return calculation.projections.reduce(
    (total, row) => total
      .plus(row.variableCosts)
      .plus(row.partnerShare)
      .plus(row.fixedCosts)
      .plus(row.payroll)
      .plus(row.preOperationalInvestment ?? row.capex),
    new FinanceDecimal(0),
  );
}

function readProvided(inputs: FinancialInputSnapshot, key: "qualifiedCouplesMonth1" | "payrollMonthly" | "averageTicket" | "fixedCostMonthly" | "variableCostRate" | "capexInitial" | "conversionRate") {
  const input = inputs[key];
  if (input.status !== "provided" || !input.value) throw new Error(`A simulação exige a premissa ${key} informada.`);
  return new FinanceDecimal(input.value);
}

export function simulateCaptadorChange(input: CaptadorSimulationInput): MeetingSimulationResult {
  const calculationOptions = {
    ...input.calculationOptions,
    maxContracts: input.maxContracts ?? input.calculationOptions?.maxContracts,
  };
  const baseline = calculateFinancialProjection(input.inputs, input.horizonMonths, calculationOptions);
  if (baseline.status !== "valid") throw new Error("A simulação exige um estudo calculável, sem premissas financeiras pendentes.");

  const delta = new FinanceDecimal(input.captadorDelta);
  const couplesPerCaptador = new FinanceDecimal(input.qualifiedCouplesPerCaptadorMonth);
  const loadedCost = new FinanceDecimal(input.loadedCostPerCaptadorMonth);
  const baselineCouples = readProvided(input.inputs, "qualifiedCouplesMonth1");
  const baselinePayroll = readProvided(input.inputs, "payrollMonthly");
  const baselineTicket = readProvided(input.inputs, "averageTicket");
  const baselineFixedCost = readProvided(input.inputs, "fixedCostMonthly");
  const baselineVariableCostRate = readProvided(input.inputs, "variableCostRate");
  const baselineCapex = readProvided(input.inputs, "capexInitial");
  const conversionRate = readProvided(input.inputs, "conversionRate");
  const targetGrossSalesMonth1 = input.targetGrossSalesMonth1 === undefined
    ? null
    : new FinanceDecimal(input.targetGrossSalesMonth1);
  if (targetGrossSalesMonth1?.isNegative()) {
    throw new Error("A meta de vendas brutas/mês deve ser não negativa.");
  }
  if (targetGrossSalesMonth1 !== null && conversionRate.lte(0)) {
    throw new Error("A meta de vendas exige conversão maior que zero.");
  }
  const ticketDelta = new FinanceDecimal(input.averageTicketDelta ?? "0");
  const fixedCostDelta = new FinanceDecimal(input.fixedCostMonthlyDelta ?? "0");
  const payrollDelta = new FinanceDecimal(input.payrollMonthlyDelta ?? "0");
  const variableCostMonthlyDelta = new FinanceDecimal(input.variableCostMonthlyDelta ?? "0");
  const capexDelta = new FinanceDecimal(input.capexInitialDelta ?? "0");
  const nextCouples = targetGrossSalesMonth1 === null
    ? FinanceDecimal.max(new FinanceDecimal(0), baselineCouples.plus(delta.times(couplesPerCaptador)))
    : targetGrossSalesMonth1.div(conversionRate);
  const nextPayroll = FinanceDecimal.max(new FinanceDecimal(0), baselinePayroll.plus(delta.times(loadedCost)).plus(payrollDelta));
  const nextTicket = FinanceDecimal.max(new FinanceDecimal(0), baselineTicket.plus(ticketDelta));
  const nextFixedCost = FinanceDecimal.max(new FinanceDecimal(0), baselineFixedCost.plus(fixedCostDelta));
  const baselineMonthlyGrossSales = baselineCouples.times(conversionRate).times(baselineTicket);
  const nextMonthlyGrossSales = nextCouples.times(conversionRate).times(nextTicket);
  const baselineVariableCostMonthly = baselineMonthlyGrossSales.times(baselineVariableCostRate);
  const nextVariableCostMonthly = (targetGrossSalesMonth1 === null
    ? baselineVariableCostMonthly
    : nextMonthlyGrossSales.times(baselineVariableCostRate))
    .plus(variableCostMonthlyDelta);
  const nextVariableCostRate = nextMonthlyGrossSales.eq(0)
    ? new FinanceDecimal(0)
    : FinanceDecimal.max(new FinanceDecimal(0), nextVariableCostMonthly.div(nextMonthlyGrossSales));
  const nextCapex = FinanceDecimal.max(new FinanceDecimal(0), baselineCapex.plus(capexDelta));
  const simulatedInputs: FinancialInputSnapshot = {
    ...input.inputs,
    qualifiedCouplesMonth1: { status: "provided", value: decimalText(nextCouples), sourceType: "derived_analysis", sourceRef: "meeting_simulator" },
    payrollMonthly: { status: "provided", value: decimalText(nextPayroll), sourceType: "derived_analysis", sourceRef: "meeting_simulator" },
    averageTicket: { status: "provided", value: decimalText(nextTicket), sourceType: "derived_analysis", sourceRef: "meeting_simulator" },
    fixedCostMonthly: { status: "provided", value: decimalText(nextFixedCost), sourceType: "derived_analysis", sourceRef: "meeting_simulator" },
    variableCostRate: { status: "provided", value: decimalText(nextVariableCostRate), sourceType: "derived_analysis", sourceRef: "meeting_simulator" },
    capexInitial: { status: "provided", value: decimalText(nextCapex), sourceType: "derived_analysis", sourceRef: "meeting_simulator" },
  };
  const simulated = calculateFinancialProjection(
    simulatedInputs,
    input.horizonMonths,
    input.simulatedCalculationOptions ?? calculationOptions
  );
  if (simulated.status !== "valid") throw new Error("A cópia de simulação ficou inválida.");
  const marginalGrossSales = decimalOrZero(simulated.kpis.grossSales).minus(decimalOrZero(baseline.kpis.grossSales));
  const marginalOperatingCash = decimalOrZero(simulated.kpis.totalOperatingCashFlow).minus(decimalOrZero(baseline.kpis.totalOperatingCashFlow));
  const marginalCost = operatingCostTotal(simulated).minus(operatingCostTotal(baseline));
  const marginalInvestment = decimalOrZero(simulated.kpis.preOperationalInvestment).minus(decimalOrZero(baseline.kpis.preOperationalInvestment));
  const marginalMonthlyCash = marginalOperatingCash.div(input.horizonMonths);
  const marginalPaybackMonths = marginalInvestment.gt(0) && marginalMonthlyCash.gt(0)
    ? marginalInvestment.div(marginalMonthlyCash)
    : marginalInvestment.lte(0) && marginalMonthlyCash.gt(0)
      ? new FinanceDecimal(0)
      : null;
  const simulateSingleLever = (patch: Partial<CaptadorSimulationInput>): MarginalAnalysis =>
    simulateCaptadorChange({
      ...input,
      captadorDelta: "0",
      averageTicketDelta: "0",
      fixedCostMonthlyDelta: "0",
      payrollMonthlyDelta: "0",
      variableCostMonthlyDelta: "0",
      capexInitialDelta: "0",
      includeLeverBreakdown: false,
      targetGrossSalesMonth1: undefined,
      ...patch,
    }).marginal;
  const leverageBreakdown: MarginalAnalysis["byLever"] = input.includeLeverBreakdown === false
    ? []
    : [
        { key: "vendas", label: "Meta de vendas", active: targetGrossSalesMonth1 !== null && !targetGrossSalesMonth1.eq(baselineCouples.times(conversionRate)), patch: { targetGrossSalesMonth1: input.targetGrossSalesMonth1 } },
        { key: "captadores", label: "Captadores", active: !delta.eq(0), patch: { captadorDelta: input.captadorDelta } },
        { key: "ticket", label: "Ticket médio", active: !ticketDelta.eq(0), patch: { averageTicketDelta: input.averageTicketDelta } },
        { key: "custo_fixo", label: "Custo fixo", active: !fixedCostDelta.eq(0), patch: { fixedCostMonthlyDelta: input.fixedCostMonthlyDelta } },
        { key: "folha", label: "Folha comercial", active: !payrollDelta.eq(0), patch: { payrollMonthlyDelta: input.payrollMonthlyDelta } },
        { key: "comissao", label: "Comissão / incentivo", active: !variableCostMonthlyDelta.eq(0), patch: { variableCostMonthlyDelta: input.variableCostMonthlyDelta } },
        { key: "capex", label: "CAPEX de implantação", active: !capexDelta.eq(0), patch: { capexInitialDelta: input.capexInitialDelta } },
      ].filter(item => item.active).map(item => ({ key: item.key, label: item.label, marginal: simulateSingleLever(item.patch) }));
  return {
    mode: "non_persistent" as const,
    assumptions: {
      captadorDelta: decimalText(delta),
      qualifiedCouplesPerCaptadorMonth: decimalText(couplesPerCaptador),
      loadedCostPerCaptadorMonth: decimalText(loadedCost),
      averageTicketDelta: decimalText(ticketDelta),
      fixedCostMonthlyDelta: decimalText(fixedCostDelta),
      payrollMonthlyDelta: decimalText(payrollDelta),
      variableCostMonthlyDelta: decimalText(variableCostMonthlyDelta),
      capexInitialDelta: decimalText(capexDelta),
      ...(targetGrossSalesMonth1 === null ? {} : { targetGrossSalesMonth1: decimalText(targetGrossSalesMonth1) }),
    },
    before: { grossSalesMonth1: decimalText(new FinanceDecimal(baseline.projections[0]?.grossContracts ?? baseline.projections[0]?.contracts ?? "0")), qualifiedCouplesMonth1: decimalText(baselineCouples), payrollMonthly: decimalText(baselinePayroll), averageTicket: decimalText(baselineTicket), fixedCostMonthly: decimalText(baselineFixedCost), variableCostRate: decimalText(baselineVariableCostRate), variableCostMonthly: decimalText(baselineVariableCostMonthly), capexInitial: decimalText(baselineCapex), kpis: baseline.kpis },
    after: { grossSalesMonth1: decimalText(new FinanceDecimal(simulated.projections[0]?.grossContracts ?? simulated.projections[0]?.contracts ?? "0")), qualifiedCouplesMonth1: decimalText(nextCouples), payrollMonthly: decimalText(nextPayroll), averageTicket: decimalText(nextTicket), fixedCostMonthly: decimalText(nextFixedCost), variableCostRate: decimalText(nextVariableCostRate), variableCostMonthly: decimalText(nextVariableCostMonthly), capexInitial: decimalText(nextCapex), kpis: simulated.kpis },
    marginal: {
      grossSales: decimalText(marginalGrossSales),
      cost: decimalText(marginalCost),
      operatingCash: decimalText(marginalOperatingCash),
      monthlyOperatingCash: decimalText(marginalMonthlyCash),
      investment: decimalText(marginalInvestment),
      npv: decimalText(decimalOrZero(simulated.kpis.npv).minus(decimalOrZero(baseline.kpis.npv))),
      irrAnnual: decimalText(decimalOrZero(simulated.kpis.irrAnnual).minus(decimalOrZero(baseline.kpis.irrAnnual))),
      paybackMonths: decimalText(decimalOrZero(simulated.kpis.paybackMonths).minus(decimalOrZero(baseline.kpis.paybackMonths))),
      recoveryMonths: marginalPaybackMonths ? decimalText(marginalPaybackMonths) : null,
      method: "Custo incremental e caixa incremental do horizonte; prazo de recuperação = investimento adicional ÷ ganho médio mensal de caixa." as const,
      byLever: leverageBreakdown,
    },
  };
}
