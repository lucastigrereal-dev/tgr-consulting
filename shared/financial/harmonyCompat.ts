import Decimal from "decimal.js";
import { HARMONY_COMPAT_FORMULA_SET_V1 } from "./formulas";
import { getPendingInputKeys } from "./inputSchema";
import type { FinancialProjectionOptions } from "./engine";
import type {
  CalculationMemory,
  FinancialCalculation,
  FinancialInputKey,
  FinancialInputSnapshot,
  MonthlyProjection,
} from "./types";

const HarmonyDecimal = Decimal.clone({
  precision: 32,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 30,
});
type HarmonyDecimalValue = InstanceType<typeof HarmonyDecimal>;

const ZERO = new HarmonyDecimal(0);
const ONE = new HarmonyDecimal(1);
const MONTHS_PER_YEAR = new HarmonyDecimal(12);
const ENTRY_INSTALLMENTS = 8;
const BALANCE_INSTALLMENTS = 84;
const BALANCE_FIRST_DUE_OFFSET = 4;
const DELINQUENCY_INFORMATIONAL_RATE = new HarmonyDecimal("0.25");
const COMMISSION_PER_CONTRACT = new HarmonyDecimal("1500");
const POST_SALE_RATE_OF_CONTRACT = new HarmonyDecimal("0.005497");
const CONSUMABLES_PER_CONTRACT = new HarmonyDecimal("25");
const GIFT_PER_CONTRACT = new HarmonyDecimal("400");
const CARD_STRESS_PER_CONTRACT = new HarmonyDecimal("512");
const PROVISIONAL_TAX_RATE = new HarmonyDecimal("0.07");
const FIXED_COST_RATES_BY_YEAR = [
  "0.60", "1.00", "1.00", "1.00", "0.80", "0.60",
  "0.50", "0.40", "0.30", "0.20", "0.10", "0.10",
].map(rate => new HarmonyDecimal(rate));

function decimalText(value: HarmonyDecimalValue): string {
  return value.toFixed(8);
}

function readInput(inputs: FinancialInputSnapshot, key: FinancialInputKey) {
  const input = inputs[key];
  if (!input || input.status !== "provided" || input.value === undefined)
    throw new Error(`Input obrigatório pendente: ${key}`);
  const value = new HarmonyDecimal(input.value);
  if (!value.isFinite()) throw new Error(`${key} deve ser finito.`);
  return value;
}

function emptyKpis(): FinancialCalculation["kpis"] {
  return {
    grossSales: null,
    grossEntryGenerated: null,
    grossReceivablesGenerated: null,
    grossReceivablesSettled: null,
    installmentCollections: null,
    canceledReceivables: null,
    delinquentBalance: null,
    curedCollections: null,
    writtenOffBalance: null,
    healthyD90: null,
    recognizedRevenue: null,
    paymentFees: null,
    preOperationalInvestment: null,
    totalOperatingCashFlow: null,
    totalGrossContracts: null,
    totalNetContracts: null,
    sellOutMonth: null,
    contributionMargin: null,
    operatingMarginRate: null,
    capitalRequired: null,
    worstCashMonth: null,
    breakEvenMonth: null,
    npv: null,
    irrAnnual: null,
    paybackMonths: null,
  };
}

function formula(formulaId: string) {
  const definition = HARMONY_COMPAT_FORMULA_SET_V1.definitions.find(
    candidate => candidate.id === formulaId
  );
  if (!definition) throw new Error(`Fórmula Harmony ausente: ${formulaId}`);
  return definition;
}

function memory(
  kpiKey: string,
  value: HarmonyDecimalValue | null,
  formulaId: string,
  explanation: string
): CalculationMemory {
  const definition = formula(formulaId);
  return {
    kpiKey,
    label: definition.name,
    value: value === null ? null : decimalText(value),
    formulaId: definition.id,
    formulaVersion: definition.version,
    expression: definition.expression,
    dependencies: definition.dependencies,
    explanation,
  };
}

function calculateIrrMonthly(cashFlows: HarmonyDecimalValue[]) {
  if (
    cashFlows.length === 0 ||
    !cashFlows.some(value => value.gt(ZERO)) ||
    !cashFlows.some(value => value.lt(ZERO))
  ) return null;
  const npvAt = (rate: HarmonyDecimalValue) =>
    cashFlows.reduce(
      (total, cashFlow, index) =>
        total.plus(cashFlow.div(ONE.plus(rate).pow(index))),
      ZERO
    );
  let low = ZERO;
  let high = new HarmonyDecimal("0.1");
  let lowNpv = npvAt(low);
  let highNpv = npvAt(high);
  while (lowNpv.times(highNpv).gt(ZERO) && high.lt("10")) {
    high = high.times(2);
    highNpv = npvAt(high);
  }
  if (lowNpv.times(highNpv).gt(ZERO)) {
    high = ZERO;
    highNpv = lowNpv;
    low = new HarmonyDecimal("-0.1");
    lowNpv = npvAt(low);
    while (lowNpv.times(highNpv).gt(ZERO) && low.gt("-0.999")) {
      low = ONE.plus(low).div(2).minus(ONE);
      lowNpv = npvAt(low);
    }
  }
  if (lowNpv.times(highNpv).gt(ZERO)) return null;
  for (let iteration = 0; iteration < 180; iteration += 1) {
    const mid = low.plus(high).div(2);
    const midNpv = npvAt(mid);
    if (midNpv.abs().lte("0.00000001")) return mid;
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

function calculatePaybackMonths(projections: MonthlyProjection[]) {
  for (const projection of projections) {
    const current = new HarmonyDecimal(projection.cumulativeCashFlow);
    if (current.gte(ZERO)) return new HarmonyDecimal(projection.month);
  }
  return null;
}

/**
 * Adapter determinístico para o Golden reconstruído e certificado do Harmony
 * Master V1. SC-001 é a única divergência interna preservada: o cronograma usa
 * 4.457 vendas brutas e a página de indicadores publicada informa 4.458.
 */
export function calculateHarmonyCompatProjection(
  inputs: FinancialInputSnapshot,
  horizonMonths: number,
  options: FinancialProjectionOptions & { maxContracts: string }
): FinancialCalculation {
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 144)
    throw new Error("O horizonte Harmony deve estar entre 1 e 144 meses.");
  if (!options?.maxContracts)
    throw new Error("maxContracts é obrigatório no modo Harmony.");
  const maxContracts = new HarmonyDecimal(options.maxContracts);
  if (!maxContracts.isFinite()) throw new Error("maxContracts deve ser finito.");
  if (!maxContracts.isInteger()) throw new Error("maxContracts deve ser inteiro.");
  if (maxContracts.lte(ZERO))
    throw new Error("O estoque máximo deve ser maior que zero.");
  for (const [key, value] of [
    ["paymentSchedulePerContract", options.paymentSchedulePerContract],
    ["receivablesPolicy", options.receivablesPolicy],
    ["pointEconomics", options.pointEconomics],
    ["commercialOperations", options.commercialOperations],
  ] as const) {
    if (value !== undefined)
      throw new Error(`A opção ${key} não é suportada no modo Harmony.`);
  }

  const missingInputKeys = getPendingInputKeys(inputs);
  if (missingInputKeys.length > 0) {
    return {
      financialModelMode: "HARMONY_COMPAT_V1",
      status: "blocked_by_pending_inputs",
      horizonMonths,
      missingInputKeys,
      formulaSetVersion: HARMONY_COMPAT_FORMULA_SET_V1.semanticVersion,
      engineVersion: HARMONY_COMPAT_FORMULA_SET_V1.engineVersion,
      projections: [],
      kpis: emptyKpis(),
      memory: [],
    };
  }

  const qualifiedMonth1 = readInput(inputs, "qualifiedCouplesMonth1");
  const qualifiedGrowth = readInput(inputs, "qualifiedCouplesGrowthRate");
  const conversionRate = readInput(inputs, "conversionRate");
  const averageTicket = readInput(inputs, "averageTicket");
  const cancellationRate = readInput(inputs, "cancellationRate");
  const entryPerContract = readInput(inputs, "entryValuePerContract");
  const preOperationalInvestment = readInput(inputs, "capexInitial");
  const nominalAnnualDiscountRate = readInput(inputs, "discountRateAnnual");
  const fixedCostFullMonthly = readInput(inputs, "fixedCostMonthly");
  const payrollMonthly = readInput(inputs, "payrollMonthly");
  const rates = [
    ["conversionRate", conversionRate],
    ["cancellationRate", cancellationRate],
    ["discountRateAnnual", nominalAnnualDiscountRate],
  ] as const;
  for (const [key, value] of rates) {
    if (value.lt(ZERO) || (key !== "discountRateAnnual" && value.gt(ONE)))
      throw new Error(`${key} deve estar entre 0 e 1.`);
  }
  if (qualifiedGrowth.lt(new HarmonyDecimal(-1)))
    throw new Error("qualifiedCouplesGrowthRate deve ser maior ou igual a -1.");
  for (const [key, value] of [
    ["qualifiedCouplesMonth1", qualifiedMonth1],
    ["averageTicket", averageTicket],
    ["entryValuePerContract", entryPerContract],
    ["capexInitial", preOperationalInvestment],
    ["fixedCostMonthly", fixedCostFullMonthly],
    ["payrollMonthly", payrollMonthly],
  ] as const) {
    if (value.lt(ZERO)) throw new Error(`${key} não pode ser negativo.`);
  }
  if (entryPerContract.gt(averageTicket))
    throw new Error("A entrada não pode ser maior que o preço.");
  if (cancellationRate.eq(ONE))
    throw new Error("cancellationRate deve ser menor que 1 no modo Harmony.");

  const harmonyFixedInputs: Array<[FinancialInputKey, string]> = [
    ["collectionRate", "1"],
    ["variableCostRate", "0"],
    ["partnerShareRate", "0"],
    ["preOperationMonths", "0"],
    ["paymentCardViewMixRate", "0"],
    ["paymentCardViewMdrRate", "0"],
    ["paymentCardViewSettlementDays", "0"],
    ["paymentCardInstallmentMixRate", "0"],
    ["paymentCardInstallmentMdrRate", "0"],
    ["paymentCardInstallmentSettlementDays", "0"],
    ["paymentDebitMixRate", "0"],
    ["paymentDebitMdrRate", "0"],
    ["paymentDebitSettlementDays", "0"],
    ["paymentRecurringChequeMixRate", "0"],
    ["paymentRecurringChequeMdrRate", "0"],
    ["paymentRecurringChequeSettlementDays", "0"],
    ["paymentBoletoMixRate", "1"],
    ["paymentBoletoMdrRate", "0"],
    ["paymentBoletoSettlementDays", "0"],
  ];
  for (const [key, expected] of harmonyFixedInputs) {
    const actual = readInput(inputs, key);
    if (!actual.eq(expected)) {
      const paymentInput = key.startsWith("payment");
      throw new Error(
        paymentInput
          ? `payment mix Harmony não suporta ${key}=${actual.toString()}.`
          : `${key} deve ser ${expected} no modo Harmony.`
      );
    }
  }
  for (const key of [
    "capexAcquisitionShareRate", "capexAcquisitionMonth",
    "capexSalesRoomShareRate", "capexSalesRoomMonth",
    "capexSalesKitShareRate", "capexSalesKitMonth",
  ] as const) {
    if (inputs[key]?.status === "provided")
      throw new Error(`${key} não é suportado no modo Harmony; mantenha PENDING.`);
  }

  const balancePerContract = averageTicket.minus(entryPerContract);
  const entryInstallment = entryPerContract.div(ENTRY_INSTALLMENTS);
  const balanceInstallment = balancePerContract.div(BALANCE_INSTALLMENTS);
  const commissionInstallment = COMMISSION_PER_CONTRACT.div(ENTRY_INSTALLMENTS);
  const postSaleVariablePerContract = averageTicket.times(
    POST_SALE_RATE_OF_CONTRACT
  );
  const entrySchedule = Array.from(
    { length: horizonMonths + ENTRY_INSTALLMENTS + 1 },
    () => ZERO
  );
  const balanceSchedule = Array.from(
    { length: horizonMonths + BALANCE_INSTALLMENTS + BALANCE_FIRST_DUE_OFFSET + 1 },
    () => ZERO
  );
  const commissionSchedule = Array.from(
    { length: horizonMonths + ENTRY_INSTALLMENTS + 1 },
    () => ZERO
  );
  const postSaleSchedule = Array.from(
    { length: horizonMonths + BALANCE_INSTALLMENTS + BALANCE_FIRST_DUE_OFFSET + 1 },
    () => ZERO
  );
  const healthyD90Schedule = Array.from(
    { length: horizonMonths + 4 },
    () => ZERO
  );

  let activeContracts = ZERO;
  let cumulativeGrossContracts = ZERO;
  let cumulativeCashFlow = ZERO;
  let grossSalesTotal = ZERO;
  let grossEntryGeneratedTotal = ZERO;
  let grossReceivablesGeneratedTotal = ZERO;
  let grossReceivablesSettledTotal = ZERO;
  let installmentCollectionsTotal = ZERO;
  let canceledReceivablesTotal = ZERO;
  let healthyD90Total = ZERO;
  let recognizedRevenueTotal = ZERO;
  let paymentFeesTotal = ZERO;
  let preOperationalInvestmentTotal = ZERO;
  let totalOperatingCashFlow = ZERO;
  let totalGrossContracts = ZERO;
  let totalNetContracts = ZERO;
  let contributionMarginTotal = ZERO;
  let operatingResultTotal = ZERO;
  let minimumCash: HarmonyDecimalValue | null = null;
  let worstCashMonth: number | null = null;
  let breakEvenMonth: number | null = null;
  let sellOutMonth: number | null = null;
  const valuationCashFlows: HarmonyDecimalValue[] = [
    preOperationalInvestment.negated(),
  ];
  const projections: MonthlyProjection[] = [];
  const equivalentMonthlyDiscountRate = ONE
    .plus(nominalAnnualDiscountRate)
    .pow(ONE.div(MONTHS_PER_YEAR))
    .minus(ONE);

  for (let month = 1; month <= horizonMonths; month += 1) {
    const qualifiedCouples = qualifiedMonth1.times(
      ONE.plus(qualifiedGrowth).pow(month - 1)
    );
    const demandedGross = qualifiedCouples.times(conversionRate);
    const remainingInventory = HarmonyDecimal.max(
      ZERO,
      maxContracts.minus(activeContracts)
    );
    let grossContracts = ZERO;
    let canceledContracts = ZERO;
    let netContracts = ZERO;
    if (remainingInventory.gt(ZERO) && demandedGross.gt(ZERO)) {
      const normalNet = demandedGross.times(ONE.minus(cancellationRate));
      if (normalNet.lte(remainingInventory)) {
        grossContracts = demandedGross;
        canceledContracts = demandedGross.times(cancellationRate);
        netContracts = normalNet;
      } else {
        // SC-001: o cronograma publicado preserva 57 brutas / 40 líquidas em M45.
        grossContracts = remainingInventory
          .div(ONE.minus(cancellationRate))
          .floor();
        if (grossContracts.eq(ZERO)) grossContracts = ONE;
        netContracts = remainingInventory;
        canceledContracts = grossContracts.minus(netContracts);
      }
    }

    activeContracts = activeContracts.plus(netContracts);
    cumulativeGrossContracts = cumulativeGrossContracts.plus(grossContracts);
    if (sellOutMonth === null && activeContracts.eq(maxContracts)) sellOutMonth = month;

    for (let offset = 0; offset < ENTRY_INSTALLMENTS; offset += 1) {
      const collectionMonth = month + offset;
      if (collectionMonth < entrySchedule.length) {
        entrySchedule[collectionMonth] = entrySchedule[collectionMonth].plus(
          netContracts.times(entryInstallment)
        );
        commissionSchedule[collectionMonth] = commissionSchedule[collectionMonth].plus(
          netContracts.times(commissionInstallment)
        );
      }
    }
    for (let offset = 0; offset < BALANCE_INSTALLMENTS; offset += 1) {
      const collectionMonth = month + BALANCE_FIRST_DUE_OFFSET + offset;
      if (collectionMonth < balanceSchedule.length)
        balanceSchedule[collectionMonth] = balanceSchedule[collectionMonth].plus(
          netContracts.times(balanceInstallment)
        );
      if (collectionMonth < postSaleSchedule.length)
        postSaleSchedule[collectionMonth] = postSaleSchedule[collectionMonth].plus(
          netContracts.times(postSaleVariablePerContract.div(BALANCE_INSTALLMENTS))
        );
    }
    const healthyMonth = month + 3;
    if (healthyMonth < healthyD90Schedule.length)
      healthyD90Schedule[healthyMonth] = healthyD90Schedule[healthyMonth].plus(
        netContracts.times(ONE.minus(DELINQUENCY_INFORMATIONAL_RATE))
      );

    const grossEntrySettled = entrySchedule[month];
    const installmentCollections = balanceSchedule[month];
    const grossReceivablesSettled = grossEntrySettled.plus(installmentCollections);
    const delinquentBalance = grossReceivablesSettled.times(
      DELINQUENCY_INFORMATIONAL_RATE
    );
    const paymentFees = netContracts.times(CARD_STRESS_PER_CONTRACT);
    const netCollections = grossReceivablesSettled;
    const recognizedRevenue = grossReceivablesSettled;
    const variableCosts = postSaleSchedule[month].plus(
      netContracts.times(CONSUMABLES_PER_CONTRACT.plus(GIFT_PER_CONTRACT))
    );
    const taxes = grossReceivablesSettled.times(PROVISIONAL_TAX_RATE);
    const commissionPayments = commissionSchedule[month];
    const fixedCosts = fixedCostFullMonthly.times(
      FIXED_COST_RATES_BY_YEAR[Math.floor((month - 1) / 12)] ?? ZERO
    );
    const payroll = payrollMonthly;
    const capex = month === 1 ? preOperationalInvestment : ZERO;
    const preOperation = capex;
    const cashInflows = grossReceivablesSettled;
    const cashOutflows = variableCosts
      .plus(taxes)
      .plus(paymentFees)
      .plus(commissionPayments)
      .plus(fixedCosts)
      .plus(payroll)
      .plus(preOperation);
    const contributionMargin = recognizedRevenue
      .minus(variableCosts)
      .minus(taxes)
      .minus(paymentFees)
      .minus(commissionPayments);
    const operatingResult = contributionMargin.minus(fixedCosts).minus(payroll);
    const operatingCashFlow = cashInflows.minus(cashOutflows);
    const valuationOperatingCashFlow = operatingCashFlow.plus(preOperation);
    const cashOpening = cumulativeCashFlow;
    cumulativeCashFlow = cumulativeCashFlow.plus(operatingCashFlow);
    const cashClosing = cumulativeCashFlow;
    const discountedCashFlow = valuationOperatingCashFlow.div(
      ONE.plus(equivalentMonthlyDiscountRate).pow(month)
    );
    if (minimumCash === null || cashClosing.lt(minimumCash)) {
      minimumCash = cashClosing;
      worstCashMonth = month;
    }
    if (breakEvenMonth === null && cashClosing.gte(ZERO)) breakEvenMonth = month;

    const grossSales = grossContracts.times(averageTicket);
    const grossEntryGenerated = netContracts.times(entryPerContract);
    const grossReceivablesGenerated = netContracts.times(averageTicket);
    const canceledReceivables = canceledContracts.times(averageTicket);
    const healthyD90 = healthyD90Schedule[month];
    projections.push({
      month,
      qualifiedCouples: decimalText(qualifiedCouples),
      contracts: decimalText(grossContracts),
      grossContracts: decimalText(grossContracts),
      canceledContracts: decimalText(canceledContracts),
      netContracts: decimalText(netContracts),
      cumulativeGrossContracts: decimalText(cumulativeGrossContracts),
      activeContracts: decimalText(activeContracts),
      returnedToInventory: decimalText(canceledContracts),
      availableInventory: decimalText(HarmonyDecimal.max(ZERO, maxContracts.minus(activeContracts))),
      sellOutRate: maxContracts.eq(ZERO) ? decimalText(ZERO) : decimalText(activeContracts.div(maxContracts)),
      grossSales: decimalText(grossSales),
      recognizedRevenue: decimalText(recognizedRevenue),
      variableCosts: decimalText(variableCosts),
      partnerShare: decimalText(ZERO),
      taxes: decimalText(taxes),
      fixedCosts: decimalText(fixedCosts),
      commercialOperationsCosts: decimalText(ZERO),
      commissionPayments: decimalText(commissionPayments),
      payroll: decimalText(payroll),
      capex: decimalText(capex),
      preOperationalInvestment: decimalText(preOperation),
      grossEntryGenerated: decimalText(grossEntryGenerated),
      grossEntrySettled: decimalText(grossEntrySettled),
      grossReceivablesGenerated: decimalText(grossReceivablesGenerated),
      grossReceivablesSettled: decimalText(grossReceivablesSettled),
      installmentCollections: decimalText(installmentCollections),
      canceledReceivables: decimalText(canceledReceivables),
      delinquentBalance: decimalText(delinquentBalance),
      curedCollections: decimalText(ZERO),
      writtenOffBalance: decimalText(ZERO),
      healthyD90: decimalText(healthyD90),
      paymentFees: decimalText(paymentFees),
      netCollections: decimalText(netCollections),
      cashOpening: decimalText(cashOpening),
      cashInflows: decimalText(cashInflows),
      cashOutflows: decimalText(cashOutflows),
      contributionMargin: decimalText(contributionMargin),
      operatingResult: decimalText(operatingResult),
      cashClosing: decimalText(cashClosing),
      operatingCashFlow: decimalText(operatingCashFlow),
      cumulativeCashFlow: decimalText(cumulativeCashFlow),
      discountedCashFlow: decimalText(discountedCashFlow),
    });
    valuationCashFlows.push(valuationOperatingCashFlow);
    grossSalesTotal = grossSalesTotal.plus(grossSales);
    grossEntryGeneratedTotal = grossEntryGeneratedTotal.plus(grossEntryGenerated);
    grossReceivablesGeneratedTotal = grossReceivablesGeneratedTotal.plus(grossReceivablesGenerated);
    grossReceivablesSettledTotal = grossReceivablesSettledTotal.plus(grossReceivablesSettled);
    installmentCollectionsTotal = installmentCollectionsTotal.plus(installmentCollections);
    canceledReceivablesTotal = canceledReceivablesTotal.plus(canceledReceivables);
    healthyD90Total = healthyD90Total.plus(healthyD90);
    recognizedRevenueTotal = recognizedRevenueTotal.plus(recognizedRevenue);
    paymentFeesTotal = paymentFeesTotal.plus(paymentFees);
    preOperationalInvestmentTotal = preOperationalInvestmentTotal.plus(preOperation);
    totalOperatingCashFlow = totalOperatingCashFlow.plus(operatingCashFlow);
    totalGrossContracts = totalGrossContracts.plus(grossContracts);
    totalNetContracts = totalNetContracts.plus(netContracts);
    contributionMarginTotal = contributionMarginTotal.plus(contributionMargin);
    operatingResultTotal = operatingResultTotal.plus(operatingResult);
  }

  const monthlyIrr = calculateIrrMonthly(valuationCashFlows);
  const annualIrr = monthlyIrr === null
    ? null
    : ONE.plus(monthlyIrr).pow(12).minus(ONE);
  const paybackMonths = calculatePaybackMonths(projections);
  const closingDelinquentBalance = projections.length === 0
    ? ZERO
    : new HarmonyDecimal(projections[projections.length - 1]!.delinquentBalance);
  const npv = projections.reduce(
    (total, projection) => total.plus(projection.discountedCashFlow),
    preOperationalInvestment.negated()
  );
  const capitalRequired = HarmonyDecimal.max(ZERO, (minimumCash ?? ZERO).negated());
  const operatingMarginRate = recognizedRevenueTotal.eq(ZERO)
    ? null
    : operatingResultTotal.div(recognizedRevenueTotal);
  const kpis: FinancialCalculation["kpis"] = {
    grossSales: decimalText(grossSalesTotal),
    grossEntryGenerated: decimalText(grossEntryGeneratedTotal),
    grossReceivablesGenerated: decimalText(grossReceivablesGeneratedTotal),
    grossReceivablesSettled: decimalText(grossReceivablesSettledTotal),
    installmentCollections: decimalText(installmentCollectionsTotal),
    canceledReceivables: decimalText(canceledReceivablesTotal),
    delinquentBalance: decimalText(closingDelinquentBalance),
    curedCollections: decimalText(ZERO),
    writtenOffBalance: decimalText(ZERO),
    healthyD90: decimalText(healthyD90Total),
    recognizedRevenue: decimalText(recognizedRevenueTotal),
    paymentFees: decimalText(paymentFeesTotal),
    preOperationalInvestment: decimalText(preOperationalInvestmentTotal),
    totalOperatingCashFlow: decimalText(totalOperatingCashFlow),
    totalGrossContracts: decimalText(totalGrossContracts),
    totalNetContracts: decimalText(totalNetContracts),
    sellOutMonth: sellOutMonth === null ? null : decimalText(new HarmonyDecimal(sellOutMonth)),
    contributionMargin: decimalText(contributionMarginTotal),
    operatingMarginRate: operatingMarginRate === null ? null : decimalText(operatingMarginRate),
    capitalRequired: decimalText(capitalRequired),
    worstCashMonth: worstCashMonth === null ? null : decimalText(new HarmonyDecimal(worstCashMonth)),
    breakEvenMonth: breakEvenMonth === null ? null : decimalText(new HarmonyDecimal(breakEvenMonth)),
    npv: decimalText(npv),
    irrAnnual: annualIrr === null ? null : decimalText(annualIrr),
    paybackMonths: paybackMonths === null ? null : decimalText(paybackMonths),
  };
  return {
    financialModelMode: "HARMONY_COMPAT_V1",
    status: "valid",
    horizonMonths,
    missingInputKeys: [],
    formulaSetVersion: HARMONY_COMPAT_FORMULA_SET_V1.semanticVersion,
    engineVersion: HARMONY_COMPAT_FORMULA_SET_V1.engineVersion,
    projections,
    kpis,
    memory: [
      memory("totalNetContracts", totalNetContracts, "harmony-cancellation-immediate", "Contratos líquidos após cancelamento imediato, limitados ao estoque físico."),
      memory("grossEntryGenerated", grossEntryGeneratedTotal, "harmony-gross-entry-generated", "Entrada contratada pelas coortes líquidas."),
      memory("installmentCollections", installmentCollectionsTotal, "harmony-balance-settled-m5", "Saldo recebido a partir de M5 por coorte."),
      memory("grossReceivablesSettled", grossReceivablesSettledTotal, "harmony-total-receivables-settled", "Soma da entrada e do saldo efetivamente programados no horizonte."),
      memory("delinquentBalance", closingDelinquentBalance, "harmony-delinquency-informational", "Exposição informativa do mês de fechamento; não é soma de fluxos e não reduz o caixa."),
      memory("paymentFees", paymentFeesTotal, "harmony-line-costs", "Stress provisório de cartão de R$ 512 por contrato líquido."),
      memory("preOperationalInvestment", preOperationalInvestmentTotal, "harmony-pre-operational-investment", "Investimento pré-operacional agregado reconhecido em M1."),
      memory("capitalRequired", capitalRequired, "harmony-kpis", "Maior necessidade acumulada de caixa nas regras compatíveis disponíveis."),
      memory("npv", npv, "harmony-kpis", "VPL com taxa nominal anual dividida por doze."),
      memory("irrAnnual", annualIrr, "harmony-kpis", "TIR mensal anualizada por composição."),
      memory("paybackMonths", paybackMonths, "harmony-kpis", "Payback simples interpolado sobre o caixa acumulado."),
    ],
    compatibilityEvidence: {
      authorityStatus: "CANONICAL_FROM_HARMONY_MASTER_V1",
      availableSource: "docs/tgr/golden/COTAS_NATAL_HARMONY_GOLDEN_V1_RULES.json",
      adoptedGrossContracts: decimalText(totalGrossContracts),
      sourceConflicts: [
        {
          id: "SC-001",
          status: "SOURCE_CONFLICT",
          adoptedRule: "Preservar 4.457 no cronograma mensal (44×100 + 57) e registrar 4.458 somente na linha indicadora publicada.",
        },
      ],
    },
  };
}
