import Decimal from "decimal.js";
import { IGR_CORE_FORMULA_SET_V1 } from "./formulas";
import { getPendingInputKeys } from "./inputSchema";
import type {
  CalculationMemory,
  DecimalText,
  FinancialCalculation,
  FinancialInputKey,
  FinancialInputSnapshot,
  MonthlyProjection,
} from "./types";

export const FinanceDecimal = Decimal.clone({
  precision: 32,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 30,
});

const ZERO = new FinanceDecimal("0");
const ONE = new FinanceDecimal("1");
const MONTHS_PER_YEAR = new FinanceDecimal("12");

const PAYMENT_METHODS = [
  { mix: "paymentCardViewMixRate", mdr: "paymentCardViewMdrRate", settlementDays: "paymentCardViewSettlementDays" },
  { mix: "paymentCardInstallmentMixRate", mdr: "paymentCardInstallmentMdrRate", settlementDays: "paymentCardInstallmentSettlementDays" },
  { mix: "paymentDebitMixRate", mdr: "paymentDebitMdrRate", settlementDays: "paymentDebitSettlementDays" },
  { mix: "paymentRecurringChequeMixRate", mdr: "paymentRecurringChequeMdrRate", settlementDays: "paymentRecurringChequeSettlementDays" },
  { mix: "paymentBoletoMixRate", mdr: "paymentBoletoMdrRate", settlementDays: "paymentBoletoSettlementDays" },
] satisfies { mix: FinancialInputKey; mdr: FinancialInputKey; settlementDays: FinancialInputKey }[];

function decimalText(value: Decimal): DecimalText {
  return value.toFixed(8);
}

function readInput(inputs: FinancialInputSnapshot, key: FinancialInputKey): Decimal {
  const input = inputs[key];
  if (input.status !== "provided" || input.value === undefined) {
    throw new Error(`Input obrigatório pendente: ${key}`);
  }
  return new FinanceDecimal(input.value);
}

function readOptionalInput(inputs: FinancialInputSnapshot, key: FinancialInputKey): Decimal | null {
  const input = inputs[key];
  if (!input || input.status !== "provided" || input.value === undefined) return null;
  return new FinanceDecimal(input.value);
}

function assertUnitRate(key: string, value: Decimal): void {
  if (value.lt(ZERO) || value.gt(ONE)) {
    throw new Error(`${key} deve estar entre 0 e 1.`);
  }
}

function assertNonNegative(key: string, value: Decimal): void {
  if (value.isNegative()) throw new Error(`${key} não pode ser negativo.`);
}

function calculateIrrMonthly(cashFlows: Decimal[]): Decimal | null {
  if (cashFlows.length === 0) return null;
  const hasPositive = cashFlows.some((value) => value.gt(ZERO));
  const hasNegative = cashFlows.some((value) => value.lt(ZERO));
  if (!hasPositive || !hasNegative) return null;

  const npvAt = (rate: Decimal) =>
    cashFlows.reduce(
      (total, cashFlow, index) => total.plus(cashFlow.div(ONE.plus(rate).pow(index + 1))),
      ZERO,
    );

  let low = new FinanceDecimal("-0.999999");
  let high = new FinanceDecimal("10");
  let lowNpv = npvAt(low);
  let highNpv = npvAt(high);

  if (lowNpv.times(highNpv).gt(ZERO)) return null;

  for (let iteration = 0; iteration < 160; iteration += 1) {
    const mid = low.plus(high).div(2);
    const midNpv = npvAt(mid);
    if (midNpv.abs().lte(new FinanceDecimal("0.00000001"))) return mid;
    if (lowNpv.times(midNpv).lte(ZERO)) {
      high = mid;
      highNpv = midNpv;
    } else {
      low = mid;
      lowNpv = midNpv;
    }
  }

  return low.plus(high).div(2);
}

function calculatePaybackMonths(projections: MonthlyProjection[]): Decimal | null {
  let previous = ZERO;
  for (const projection of projections) {
    const current = new FinanceDecimal(projection.cumulativeCashFlow);
    if (current.gte(ZERO)) {
      if (projection.month === 1) return ONE;
      const monthlyCashFlow = new FinanceDecimal(projection.operatingCashFlow);
      if (monthlyCashFlow.eq(ZERO)) return new FinanceDecimal(projection.month);
      return new FinanceDecimal(projection.month - 1).plus(previous.abs().div(monthlyCashFlow));
    }
    previous = current;
  }
  return null;
}

function createMemory(
  kpiKey: string,
  value: Decimal | null,
  formulaId: string,
  explanation: string,
): CalculationMemory {
  const formula = IGR_CORE_FORMULA_SET_V1.definitions.find((candidate) => candidate.id === formulaId);
  if (!formula) throw new Error(`Fórmula ausente no registry: ${formulaId}`);
  return {
    kpiKey,
    label: formula.name,
    value: value ? decimalText(value) : null,
    formulaId: formula.id,
    formulaVersion: formula.version,
    expression: formula.expression,
    dependencies: formula.dependencies,
    explanation,
  };
}

export function calculateFinancialProjection(
  inputs: FinancialInputSnapshot,
  horizonMonths: number,
): FinancialCalculation {
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 120) {
    throw new Error("O horizonte deve estar entre 1 e 120 meses.");
  }

  const missingInputKeys = getPendingInputKeys(inputs);
  if (missingInputKeys.length > 0) {
    return {
      status: "blocked_by_pending_inputs",
      horizonMonths,
      missingInputKeys,
      formulaSetVersion: IGR_CORE_FORMULA_SET_V1.semanticVersion,
      engineVersion: IGR_CORE_FORMULA_SET_V1.engineVersion,
      projections: [],
      kpis: {
        grossSales: null,
        grossEntryGenerated: null,
        recognizedRevenue: null,
        paymentFees: null,
        preOperationalInvestment: null,
        totalOperatingCashFlow: null,
        npv: null,
        irrAnnual: null,
        paybackMonths: null,
      },
      memory: [],
    };
  }

  const qualifiedCouplesMonth1 = readInput(inputs, "qualifiedCouplesMonth1");
  const qualifiedCouplesGrowthRate = readInput(inputs, "qualifiedCouplesGrowthRate");
  const conversionRate = readInput(inputs, "conversionRate");
  const averageTicket = readInput(inputs, "averageTicket");
  const collectionRate = readInput(inputs, "collectionRate");
  const cancellationRate = readInput(inputs, "cancellationRate");
  const variableCostRate = readInput(inputs, "variableCostRate");
  const partnerShareRate = readInput(inputs, "partnerShareRate");
  const fixedCostMonthly = readInput(inputs, "fixedCostMonthly");
  const payrollMonthly = readInput(inputs, "payrollMonthly");
  const capexInitial = readInput(inputs, "capexInitial");
  const preOperationMonths = readInput(inputs, "preOperationMonths");
  const entryValuePerContract = readInput(inputs, "entryValuePerContract");
  const discountRateAnnual = readInput(inputs, "discountRateAnnual");
  [
    ["qualifiedCouplesMonth1", qualifiedCouplesMonth1],
    ["averageTicket", averageTicket],
    ["fixedCostMonthly", fixedCostMonthly],
    ["payrollMonthly", payrollMonthly],
    ["capexInitial", capexInitial],
    ["entryValuePerContract", entryValuePerContract],
  ].forEach(([key, value]) => assertNonNegative(String(key), value as Decimal));
  [
    ["conversionRate", conversionRate],
    ["collectionRate", collectionRate],
    ["cancellationRate", cancellationRate],
    ["variableCostRate", variableCostRate],
    ["partnerShareRate", partnerShareRate],
  ].forEach(([key, value]) => assertUnitRate(String(key), value as Decimal));
  if (!preOperationMonths.isInteger() || preOperationMonths.isNegative()) {
    throw new Error("Meses de pré-operação deve ser um número inteiro maior ou igual a zero.");
  }
  const paymentMethods = PAYMENT_METHODS.map(method => ({
    key: method,
    mix: readInput(inputs, method.mix),
    mdr: readInput(inputs, method.mdr),
    settlementDays: readInput(inputs, method.settlementDays),
  }));
  for (const method of paymentMethods) {
    assertUnitRate(method.key.mix, method.mix);
    assertUnitRate(method.key.mdr, method.mdr);
    assertNonNegative(method.key.settlementDays, method.settlementDays);
  }
  const paymentMix = paymentMethods.reduce((total, method) => total.plus(method.mix), ZERO);
  if (!paymentMix.eq(ONE)) {
    throw new Error("O mix de recebimento deve fechar exatamente em 100%.");
  }
  const preOperationMonthsNumber = preOperationMonths.toNumber();
  const implementationSchedule = [
    { share: readOptionalInput(inputs, "capexAcquisitionShareRate"), month: readOptionalInput(inputs, "capexAcquisitionMonth"), label: "captação" },
    { share: readOptionalInput(inputs, "capexSalesRoomShareRate"), month: readOptionalInput(inputs, "capexSalesRoomMonth"), label: "sala de vendas" },
    { share: readOptionalInput(inputs, "capexSalesKitShareRate"), month: readOptionalInput(inputs, "capexSalesKitMonth"), label: "sales kit" },
  ];
  const hasAnyImplementationScheduleInput = implementationSchedule.some(item => item.share !== null || item.month !== null);
  const hasCompleteImplementationSchedule = implementationSchedule.every(item => item.share !== null && item.month !== null);
  if (hasAnyImplementationScheduleInput && !hasCompleteImplementationSchedule) {
    throw new Error("O cronograma de implantação deve informar participação e mês para captação, sala de vendas e sales kit.");
  }
  if (hasCompleteImplementationSchedule) {
    const scheduledShare = implementationSchedule.reduce((total, item) => total.plus(item.share!), ZERO);
    if (!scheduledShare.eq(ONE)) throw new Error("As participações do cronograma de implantação devem fechar exatamente em 100%.");
    for (const item of implementationSchedule) {
      if (!item.month!.isInteger() || item.month!.lt(ONE) || item.month!.gt(preOperationMonths)) {
        throw new Error(`Mês de implantação inválido para ${item.label}.`);
      }
    }
  }

  const monthlyDiscountRate = ONE.plus(discountRateAnnual).pow(ONE.div(MONTHS_PER_YEAR)).minus(ONE);
  let cumulativeCashFlow = ZERO;
  let grossSalesTotal = ZERO;
  let grossEntryGeneratedTotal = ZERO;
  let recognizedRevenueTotal = ZERO;
  let paymentFeesTotal = ZERO;
  let preOperationalInvestmentTotal = ZERO;
  let totalOperatingCashFlow = ZERO;
  const projections: MonthlyProjection[] = [];
  const cashFlows: Decimal[] = [];
  const settlementGrossSchedule = Array.from({ length: horizonMonths + 121 }, () => ZERO);
  const paymentFeeSchedule = Array.from({ length: horizonMonths + 121 }, () => ZERO);

  for (let month = 1; month <= horizonMonths; month += 1) {
    const operationMonth = month - preOperationMonthsNumber;
    const isOperating = operationMonth > 0;
    const qualifiedCouples = isOperating
      ? qualifiedCouplesMonth1.times(ONE.plus(qualifiedCouplesGrowthRate).pow(operationMonth - 1))
      : ZERO;
    const contracts = isOperating ? qualifiedCouples.times(conversionRate) : ZERO;
    const grossSales = contracts.times(averageTicket);
    const grossEntryGenerated = contracts.times(entryValuePerContract);
    const collectibleEntry = grossEntryGenerated.times(collectionRate).times(ONE.minus(cancellationRate));
    for (const method of paymentMethods) {
      const settlementMonth = month + Math.floor(method.settlementDays.div(30).toNumber());
      if (settlementMonth <= horizonMonths) {
        const settledByMethod = collectibleEntry.times(method.mix);
        settlementGrossSchedule[settlementMonth] = settlementGrossSchedule[settlementMonth].plus(settledByMethod);
        paymentFeeSchedule[settlementMonth] = paymentFeeSchedule[settlementMonth].plus(settledByMethod.times(method.mdr));
      }
    }
    const grossEntrySettled = settlementGrossSchedule[month];
    const paymentFees = paymentFeeSchedule[month];
    const netCollections = grossEntrySettled.minus(paymentFees);
    const recognizedRevenue = netCollections;
    const variableCosts = grossSales.times(variableCostRate);
    const partnerShare = netCollections.times(partnerShareRate);
    const preOperationalInvestment = hasCompleteImplementationSchedule
      ? implementationSchedule.reduce(
        (total, item) => total.plus(item.month!.eq(month) ? capexInitial.times(item.share!) : ZERO),
        ZERO,
      )
      : preOperationMonthsNumber > 0
        ? (month <= preOperationMonthsNumber ? capexInitial.div(preOperationMonths) : ZERO)
        : (month === 1 ? capexInitial : ZERO);
    const capex = preOperationalInvestment;
    const fixedCosts = isOperating ? fixedCostMonthly : ZERO;
    const payroll = isOperating ? payrollMonthly : ZERO;
    const operatingCashFlow = netCollections
      .minus(variableCosts)
      .minus(partnerShare)
      .minus(fixedCosts)
      .minus(payroll)
      .minus(preOperationalInvestment);
    cumulativeCashFlow = cumulativeCashFlow.plus(operatingCashFlow);
    const discountedCashFlow = operatingCashFlow.div(ONE.plus(monthlyDiscountRate).pow(month));

    projections.push({
      month,
      qualifiedCouples: decimalText(qualifiedCouples),
      contracts: decimalText(contracts),
      grossSales: decimalText(grossSales),
      recognizedRevenue: decimalText(recognizedRevenue),
      variableCosts: decimalText(variableCosts),
      partnerShare: decimalText(partnerShare),
      fixedCosts: decimalText(fixedCosts),
      payroll: decimalText(payroll),
      capex: decimalText(capex),
      preOperationalInvestment: decimalText(preOperationalInvestment),
      grossEntryGenerated: decimalText(grossEntryGenerated),
      grossEntrySettled: decimalText(grossEntrySettled),
      paymentFees: decimalText(paymentFees),
      netCollections: decimalText(netCollections),
      operatingCashFlow: decimalText(operatingCashFlow),
      cumulativeCashFlow: decimalText(cumulativeCashFlow),
      discountedCashFlow: decimalText(discountedCashFlow),
    });

    grossSalesTotal = grossSalesTotal.plus(grossSales);
    grossEntryGeneratedTotal = grossEntryGeneratedTotal.plus(grossEntryGenerated);
    recognizedRevenueTotal = recognizedRevenueTotal.plus(recognizedRevenue);
    paymentFeesTotal = paymentFeesTotal.plus(paymentFees);
    preOperationalInvestmentTotal = preOperationalInvestmentTotal.plus(preOperationalInvestment);
    totalOperatingCashFlow = totalOperatingCashFlow.plus(operatingCashFlow);
    cashFlows.push(operatingCashFlow);
  }

  const npv = projections.reduce(
    (total, projection) => total.plus(new FinanceDecimal(projection.discountedCashFlow)),
    ZERO,
  );
  const irrMonthly = calculateIrrMonthly(cashFlows);
  const irrAnnual = irrMonthly ? ONE.plus(irrMonthly).pow(MONTHS_PER_YEAR).minus(ONE) : null;
  const paybackMonths = calculatePaybackMonths(projections);

  return {
    status: "valid",
    horizonMonths,
    missingInputKeys: [],
    formulaSetVersion: IGR_CORE_FORMULA_SET_V1.semanticVersion,
    engineVersion: IGR_CORE_FORMULA_SET_V1.engineVersion,
    projections,
    kpis: {
      grossSales: decimalText(grossSalesTotal),
      grossEntryGenerated: decimalText(grossEntryGeneratedTotal),
      recognizedRevenue: decimalText(recognizedRevenueTotal),
      paymentFees: decimalText(paymentFeesTotal),
      preOperationalInvestment: decimalText(preOperationalInvestmentTotal),
      totalOperatingCashFlow: decimalText(totalOperatingCashFlow),
      npv: decimalText(npv),
      irrAnnual: irrAnnual ? decimalText(irrAnnual) : null,
      paybackMonths: paybackMonths ? decimalText(paybackMonths) : null,
    },
    memory: [
      createMemory("grossSales", grossSalesTotal, "gross-sales", "Venda assinada acumulada no horizonte selecionado."),
      createMemory("grossEntryGenerated", grossEntryGeneratedTotal, "gross-entry-generated", "Entrada contratada antes de perdas, taxas e prazo de liquidação."),
      createMemory("recognizedRevenue", recognizedRevenueTotal, "net-entry-collections", "Entrada líquida recebida depois de perda, MDR e prazo por método de pagamento."),
      createMemory("paymentTermsNetSettlement", recognizedRevenueTotal, "payment-terms-net-settlement", "Condição de pagamento aplicada ao recebimento: mix, MDR e prazo de liquidação."),
      createMemory("commercialTeamMonthlyCost", payrollMonthly, "commercial-team-monthly-cost", "Folha mensal agregada da estrutura comercial informada na Página 1."),
      createMemory("preOperationalInvestment", preOperationalInvestmentTotal, "pre-operational-investment", hasCompleteImplementationSchedule ? "Pré-investimento alocado por frente e mês de implantação informado." : "Pré-investimento distribuído antes da abertura operacional enquanto o cronograma por rubrica permanece incompleto."),
      createMemory("operatingCashFlow", totalOperatingCashFlow, "operating-cash-flow", "Fluxo acumulado depois de entrada líquida, custos, repasses, folha e implantação."),
      createMemory("npv", npv, "npv", "Valor presente dos fluxos mensais usando a taxa anual convertida para taxa mensal equivalente."),
      createMemory("irrAnnual", irrAnnual, "irr", "Taxa anual equivalente ao retorno interno dos fluxos mensais; fica indisponível quando não há mudança de sinal nos fluxos."),
      createMemory("paybackMonths", paybackMonths, "payback", "Mês de recuperação do caixa acumulado, com interpolação quando o ponto de equilíbrio ocorre entre dois meses."),
    ],
  };
}
