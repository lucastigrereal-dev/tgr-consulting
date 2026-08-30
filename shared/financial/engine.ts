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
import type { PaymentCalendarComponent } from "./paymentCalendar";
import type { PointEconomicsPortfolio } from "./pointEconomics";
import {
  calculateCommissionLedger,
  type CommissionBaseRecord,
  type CommercialOperationsResult,
} from "./commercialOperations";
import {
  buildReceivablesPortfolio,
  type ReceivablesPolicy,
  type ReceivablesPortfolio,
  type ReceivablesSalesCohort,
} from "./receivablesPortfolio";

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

export type PaymentSchedulePerContractItem = {
  component: PaymentCalendarComponent;
  dueMonthOffset: number;
  grossAmount: DecimalText;
};

export type FinancialProjectionOptions = {
  maxContracts?: string;
  paymentSchedulePerContract?: PaymentSchedulePerContractItem[];
  receivablesPolicy?: ReceivablesPolicy;
  pointEconomics?: PointEconomicsPortfolio;
  commercialOperations?: CommercialOperationsResult;
};

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

function resolvePaymentSchedulePerContract(
  entryValuePerContract: Decimal,
  options?: FinancialProjectionOptions
) {
  const schedule = options?.paymentSchedulePerContract;
  if (!schedule || schedule.length === 0) {
    return [{
      component: "entry" as const,
      dueMonthOffset: 0,
      grossAmount: entryValuePerContract,
    }];
  }
  return schedule.map((item, index) => {
    if (!Number.isInteger(item.dueMonthOffset) || item.dueMonthOffset < 0) {
      throw new Error(
        `paymentSchedulePerContract.${index}.dueMonthOffset deve ser inteiro maior ou igual a zero.`
      );
    }
    const grossAmount = new FinanceDecimal(item.grossAmount);
    assertNonNegative(
      `paymentSchedulePerContract.${index}.grossAmount`,
      grossAmount
    );
    return {
      component: item.component,
      dueMonthOffset: item.dueMonthOffset,
      grossAmount,
    };
  });
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
  options?: FinancialProjectionOptions
): FinancialCalculation {
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 120) {
    throw new Error("O horizonte deve estar entre 1 e 120 meses.");
  }

  const missingInputKeys = getPendingInputKeys(inputs).filter(key => {
    if (
      options?.receivablesPolicy &&
      (key === "collectionRate" || key === "cancellationRate")
    ) return false;
    if (
      options?.pointEconomics &&
      (key === "qualifiedCouplesMonth1" ||
        key === "qualifiedCouplesGrowthRate" ||
        key === "conversionRate")
    ) return false;
    return true;
  });
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
        npv: null,
        irrAnnual: null,
        paybackMonths: null,
      },
      memory: [],
    };
  }

  const pointEconomics = options?.pointEconomics;
  const pointQualified = pointEconomics
    ? new FinanceDecimal(pointEconomics.totals.funnel.qualified)
    : null;
  const pointSales = pointEconomics
    ? new FinanceDecimal(pointEconomics.totals.production.totalSales)
    : null;
  const qualifiedCouplesMonth1 = pointQualified ?? readInput(inputs, "qualifiedCouplesMonth1");
  const qualifiedCouplesGrowthRate = pointEconomics
    ? ZERO
    : readInput(inputs, "qualifiedCouplesGrowthRate");
  const conversionRate = pointQualified
    ? (pointQualified.eq(ZERO) ? ZERO : pointSales!.div(pointQualified))
    : readInput(inputs, "conversionRate");
  const averageTicket = readInput(inputs, "averageTicket");
  const collectionRate = options?.receivablesPolicy
    ? ONE
    : readInput(inputs, "collectionRate");
  const cancellationRate = options?.receivablesPolicy
    ? ZERO
    : readInput(inputs, "cancellationRate");
  const variableCostRate = readInput(inputs, "variableCostRate");
  const partnerShareRate = readInput(inputs, "partnerShareRate");
  const fixedCostMonthly = readInput(inputs, "fixedCostMonthly");
  const payrollMonthly = readInput(inputs, "payrollMonthly");
  const capexInitial = readInput(inputs, "capexInitial");
  const pointIncrementalCapex = new FinanceDecimal(
    pointEconomics?.totals.cashflow.incrementalCapex ?? "0"
  );
  const pointIncrementalMonthlyOpex = new FinanceDecimal(
    pointEconomics?.totals.cashflow.incrementalMonthlyOpex ?? "0"
  );
  const preOperationMonths = readInput(inputs, "preOperationMonths");
  const entryValuePerContract = readInput(inputs, "entryValuePerContract");
  const discountRateAnnual = readInput(inputs, "discountRateAnnual");
  [
    ["qualifiedCouplesMonth1", qualifiedCouplesMonth1],
    ["averageTicket", averageTicket],
    ["fixedCostMonthly", fixedCostMonthly],
    ["payrollMonthly", payrollMonthly],
    ["capexInitial", capexInitial],
    ["pointEconomics.incrementalCapex", pointIncrementalCapex],
    ["pointEconomics.incrementalMonthlyOpex", pointIncrementalMonthlyOpex],
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
  const paymentSchedulePerContract = resolvePaymentSchedulePerContract(
    entryValuePerContract,
    options
  );
  const receivableValuePerContract = paymentSchedulePerContract.reduce(
    (total, item) => total.plus(item.grossAmount),
    ZERO
  );
  const entryScheduleValuePerContract = paymentSchedulePerContract
    .filter(item => item.component === "entry")
    .reduce((total, item) => total.plus(item.grossAmount), ZERO);
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
  let remainingContracts = options?.maxContracts === undefined
    ? null
    : new FinanceDecimal(options.maxContracts);
  if (remainingContracts && remainingContracts.isNegative()) {
    throw new Error("O limite de contratos não pode ser negativo.");
  }
  const salesPlan = Array.from({ length: horizonMonths }, (_, index) => {
    const month = index + 1;
    const operationMonth = month - preOperationMonthsNumber;
    const isOperating = operationMonth > 0;
    const qualifiedCouples = isOperating
      ? qualifiedCouplesMonth1.times(
          ONE.plus(qualifiedCouplesGrowthRate).pow(operationMonth - 1)
        )
      : ZERO;
    const demandedContracts = isOperating
      ? qualifiedCouples.times(conversionRate)
      : ZERO;
    const inventoryLimitedContracts = remainingContracts === null
      ? demandedContracts
      : demandedContracts.lte(remainingContracts)
        ? demandedContracts
        : remainingContracts;
    const operationsCapacity = options?.commercialOperations?.months[index];
    const contracts = operationsCapacity
      ? FinanceDecimal.min(
          inventoryLimitedContracts,
          new FinanceDecimal(operationsCapacity.salesCapacity),
        )
      : inventoryLimitedContracts;
    if (remainingContracts !== null)
      remainingContracts = remainingContracts.minus(contracts);
    return { month, operationMonth, isOperating, qualifiedCouples, contracts };
  });
  const receivablesPortfolio: ReceivablesPortfolio | undefined =
    options?.receivablesPolicy
      ? buildReceivablesPortfolio({
          cohorts: salesPlan
            .filter(row => row.contracts.gt(ZERO))
            .map((row): ReceivablesSalesCohort => ({
              cohortId: `sales-cohort-${row.month}`,
              saleMonth: row.month,
              contracts: decimalText(row.contracts),
              paymentSchedulePerContract: paymentSchedulePerContract.map(item => ({
                component: item.component,
                dueMonthOffset: item.dueMonthOffset,
                grossAmount: decimalText(item.grossAmount),
              })),
            })),
          policy: options.receivablesPolicy,
          asOfMonth: horizonMonths,
        })
      : undefined;
  const portfolioMonthly = new Map(
    receivablesPortfolio?.monthlySummaries.map(summary => [summary.month, summary]) ?? []
  );
  const healthyD90ByMonth = new Map<number, Decimal>();
  for (const cohort of receivablesPortfolio?.cohortSummaries ?? []) {
    const recognitionMonth = cohort.saleMonth + 3;
    if (recognitionMonth <= horizonMonths)
      healthyD90ByMonth.set(
        recognitionMonth,
        (healthyD90ByMonth.get(recognitionMonth) ?? ZERO).plus(cohort.healthyD90)
      );
  }
  let cumulativeCashFlow = ZERO;
  let grossSalesTotal = ZERO;
  let grossEntryGeneratedTotal = ZERO;
  let grossReceivablesGeneratedTotal = ZERO;
  let grossReceivablesSettledTotal = ZERO;
  let installmentCollectionsTotal = ZERO;
  let canceledReceivablesTotal = ZERO;
  let curedCollectionsTotal = ZERO;
  let writtenOffBalanceTotal = ZERO;
  let healthyD90Total = ZERO;
  let recognizedRevenueTotal = ZERO;
  let paymentFeesTotal = ZERO;
  let preOperationalInvestmentTotal = ZERO;
  let commercialOperationsCostsTotal = ZERO;
  let commissionPaymentsTotal = ZERO;
  let totalOperatingCashFlow = ZERO;
  const projections: MonthlyProjection[] = [];
  const cashFlows: Decimal[] = [];
  const settlementGrossSchedule = Array.from({ length: horizonMonths + 121 }, () => ZERO);
  const entrySettlementGrossSchedule = Array.from(
    { length: horizonMonths + 121 },
    () => ZERO
  );
  const balanceSettlementGrossSchedule = Array.from(
    { length: horizonMonths + 121 },
    () => ZERO
  );
  const balanceFeeSchedule = Array.from(
    { length: horizonMonths + 121 },
    () => ZERO
  );
  const paymentFeeSchedule = Array.from({ length: horizonMonths + 121 }, () => ZERO);
  const commissionPaymentSchedule = Array.from(
    { length: horizonMonths + 121 },
    () => ZERO,
  );
  const commissionBaseRecords: CommissionBaseRecord[] = [];

  if (receivablesPortfolio) {
    const portfolioCollectionEvents = receivablesPortfolio.ledger.flatMap(line => [
      ...(new FinanceDecimal(line.currentCollected).gt(ZERO)
        ? [{ component: line.component, collectionMonth: line.dueMonth, grossAmount: new FinanceDecimal(line.currentCollected) }]
        : []),
      ...line.curedCollections.map(collection => ({
        component: line.component,
        collectionMonth: collection.collectionMonth,
        grossAmount: new FinanceDecimal(collection.amount),
      })),
    ]);
    for (const receivable of portfolioCollectionEvents) {
      for (const method of paymentMethods) {
        const settlementMonth =
          receivable.collectionMonth +
          Math.floor(method.settlementDays.div(30).toNumber());
        if (settlementMonth <= horizonMonths) {
          const settledByMethod = receivable.grossAmount.times(method.mix);
          settlementGrossSchedule[settlementMonth] =
            settlementGrossSchedule[settlementMonth].plus(settledByMethod);
          const fee = settledByMethod.times(method.mdr);
          paymentFeeSchedule[settlementMonth] =
            paymentFeeSchedule[settlementMonth].plus(fee);
          if (receivable.component === "entry")
            entrySettlementGrossSchedule[settlementMonth] =
              entrySettlementGrossSchedule[settlementMonth].plus(settledByMethod);
          if (receivable.component === "balance") {
            balanceSettlementGrossSchedule[settlementMonth] =
              balanceSettlementGrossSchedule[settlementMonth].plus(settledByMethod);
            balanceFeeSchedule[settlementMonth] =
              balanceFeeSchedule[settlementMonth].plus(fee);
          }
        }
      }
    }
  }

  for (let month = 1; month <= horizonMonths; month += 1) {
    const { operationMonth, isOperating, qualifiedCouples, contracts } =
      salesPlan[month - 1]!;
    const grossSales = contracts.times(averageTicket);
    const grossEntryGenerated = contracts.times(entryScheduleValuePerContract);
    const grossReceivablesGenerated = contracts.times(
      receivableValuePerContract
    );
    if (!receivablesPortfolio) {
      const collectibleReceivables = paymentSchedulePerContract.map(item => ({
        component: item.component,
        dueMonth: month + item.dueMonthOffset,
        grossAmount: contracts
          .times(item.grossAmount)
          .times(collectionRate)
          .times(ONE.minus(cancellationRate)),
      }));
      for (const receivable of collectibleReceivables) {
        for (const method of paymentMethods) {
          const settlementMonth =
            receivable.dueMonth +
            Math.floor(method.settlementDays.div(30).toNumber());
          if (settlementMonth <= horizonMonths) {
            const settledByMethod = receivable.grossAmount.times(method.mix);
            settlementGrossSchedule[settlementMonth] =
              settlementGrossSchedule[settlementMonth].plus(settledByMethod);
            const fee = settledByMethod.times(method.mdr);
            paymentFeeSchedule[settlementMonth] =
              paymentFeeSchedule[settlementMonth].plus(fee);
            if (receivable.component === "entry")
              entrySettlementGrossSchedule[settlementMonth] =
                entrySettlementGrossSchedule[settlementMonth].plus(settledByMethod);
            if (receivable.component === "balance") {
              balanceSettlementGrossSchedule[settlementMonth] =
                balanceSettlementGrossSchedule[settlementMonth].plus(settledByMethod);
              balanceFeeSchedule[settlementMonth] =
                balanceFeeSchedule[settlementMonth].plus(fee);
            }
          }
        }
      }
    }
    const portfolioSummary = portfolioMonthly.get(month);
    const canceledReceivables = new FinanceDecimal(
      portfolioSummary?.canceledBeforeDue ?? "0"
    );
    const delinquentBalance = new FinanceDecimal(
      portfolioSummary?.openDelinquent ?? "0"
    );
    const curedCollections = new FinanceDecimal(
      portfolioSummary?.curedCollections ?? "0"
    );
    const writtenOffBalance = new FinanceDecimal(
      portfolioSummary?.writtenOff ?? "0"
    );
    const healthyD90 = healthyD90ByMonth.get(month) ?? ZERO;
    const grossEntrySettled = entrySettlementGrossSchedule[month];
    const grossReceivablesSettled = settlementGrossSchedule[month];
    const paymentFees = paymentFeeSchedule[month];
    const installmentCollections = balanceSettlementGrossSchedule[month].minus(
      balanceFeeSchedule[month]
    );
    const netCollections = grossReceivablesSettled.minus(paymentFees);
    const recognizedRevenue = netCollections;
    const variableCosts = grossSales.times(variableCostRate);
    const partnerShare = netCollections.times(partnerShareRate);
    const commercialOperationsCosts = new FinanceDecimal(
      options?.commercialOperations?.months[month - 1]?.incrementalOperatingCost ?? "0"
    );
    for (const policy of options?.commercialOperations?.commissions.policies ?? []) {
      const eligibleAmount = policy.eligibleBase === "gross_sales"
        ? grossSales
        : policy.eligibleBase === "contracted_entry"
          ? grossEntryGenerated
          : policy.eligibleBase === "collected_entry"
            ? grossEntrySettled
            : policy.eligibleBase === "validated_sale"
              ? contracts
              : policy.eligibleBase === "d90"
                ? healthyD90
                : policy.eligibleBase === "fixed"
                  ? ONE
                  : contracts;
      const accrualMonth = policy.eligibleBase === "d30" ? month + 1 : month;
      const record: CommissionBaseRecord = {
        recordId: `${policy.policyId}-${month}`,
        policyId: policy.policyId,
        role: policy.role,
        eligibleBase: policy.eligibleBase,
        month: accrualMonth,
        day: 1,
        amount: decimalText(eligibleAmount),
        isReversal: false,
      };
      commissionBaseRecords.push(record);
      const accrued = calculateCommissionLedger({
        policies: [policy],
        baseRecords: [record],
      }).accruals[0]!;
      if (accrued.paymentMonth < commissionPaymentSchedule.length) {
        commissionPaymentSchedule[accrued.paymentMonth] =
          commissionPaymentSchedule[accrued.paymentMonth].plus(
            accrued.payableCommission,
          );
      }
    }
    const commissionPayments =
      options?.commercialOperations?.commissions.cashflowTreatment === "incremental"
        ? commissionPaymentSchedule[month]
        : ZERO;
    const basePreOperationalInvestment = hasCompleteImplementationSchedule
      ? implementationSchedule.reduce(
        (total, item) => total.plus(item.month!.eq(month) ? capexInitial.times(item.share!) : ZERO),
        ZERO,
      )
      : preOperationMonthsNumber > 0
        ? (month <= preOperationMonthsNumber ? capexInitial.div(preOperationMonths) : ZERO)
        : (month === 1 ? capexInitial : ZERO);
    const preOperationalInvestment = basePreOperationalInvestment.plus(
      month === 1 ? pointIncrementalCapex : ZERO
    );
    const capex = preOperationalInvestment;
    const fixedCosts = isOperating
      ? fixedCostMonthly.plus(pointIncrementalMonthlyOpex)
      : ZERO;
    const payroll = isOperating ? payrollMonthly : ZERO;
    const operatingCashFlow = netCollections
      .minus(variableCosts)
      .minus(partnerShare)
      .minus(fixedCosts)
      .minus(commercialOperationsCosts)
      .minus(commissionPayments)
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
      commercialOperationsCosts: decimalText(commercialOperationsCosts),
      commissionPayments: decimalText(commissionPayments),
      payroll: decimalText(payroll),
      capex: decimalText(capex),
      preOperationalInvestment: decimalText(preOperationalInvestment),
      grossEntryGenerated: decimalText(grossEntryGenerated),
      grossEntrySettled: decimalText(grossEntrySettled),
      grossReceivablesGenerated: decimalText(grossReceivablesGenerated),
      grossReceivablesSettled: decimalText(grossReceivablesSettled),
      installmentCollections: decimalText(installmentCollections),
      canceledReceivables: decimalText(canceledReceivables),
      delinquentBalance: decimalText(delinquentBalance),
      curedCollections: decimalText(curedCollections),
      writtenOffBalance: decimalText(writtenOffBalance),
      healthyD90: decimalText(healthyD90),
      paymentFees: decimalText(paymentFees),
      netCollections: decimalText(netCollections),
      operatingCashFlow: decimalText(operatingCashFlow),
      cumulativeCashFlow: decimalText(cumulativeCashFlow),
      discountedCashFlow: decimalText(discountedCashFlow),
    });

    grossSalesTotal = grossSalesTotal.plus(grossSales);
    grossEntryGeneratedTotal = grossEntryGeneratedTotal.plus(grossEntryGenerated);
    grossReceivablesGeneratedTotal = grossReceivablesGeneratedTotal.plus(
      grossReceivablesGenerated
    );
    grossReceivablesSettledTotal = grossReceivablesSettledTotal.plus(
      grossReceivablesSettled
    );
    installmentCollectionsTotal = installmentCollectionsTotal.plus(
      installmentCollections
    );
    canceledReceivablesTotal = canceledReceivablesTotal.plus(
      canceledReceivables
    );
    curedCollectionsTotal = curedCollectionsTotal.plus(curedCollections);
    writtenOffBalanceTotal = writtenOffBalanceTotal.plus(writtenOffBalance);
    healthyD90Total = healthyD90Total.plus(healthyD90);
    recognizedRevenueTotal = recognizedRevenueTotal.plus(recognizedRevenue);
    paymentFeesTotal = paymentFeesTotal.plus(paymentFees);
    preOperationalInvestmentTotal = preOperationalInvestmentTotal.plus(preOperationalInvestment);
    commercialOperationsCostsTotal = commercialOperationsCostsTotal.plus(
      commercialOperationsCosts,
    );
    commissionPaymentsTotal = commissionPaymentsTotal.plus(commissionPayments);
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
  const delinquentBalanceClosing = projections.length
    ? new FinanceDecimal(projections[projections.length - 1]!.delinquentBalance)
    : ZERO;

  const commissionLedger = options?.commercialOperations
    ? calculateCommissionLedger({
        policies: options.commercialOperations.commissions.policies,
        baseRecords: commissionBaseRecords,
      })
    : undefined;

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
      grossReceivablesGenerated: decimalText(grossReceivablesGeneratedTotal),
      grossReceivablesSettled: decimalText(grossReceivablesSettledTotal),
      installmentCollections: decimalText(installmentCollectionsTotal),
      canceledReceivables: decimalText(canceledReceivablesTotal),
      delinquentBalance: decimalText(delinquentBalanceClosing),
      curedCollections: decimalText(curedCollectionsTotal),
      writtenOffBalance: decimalText(writtenOffBalanceTotal),
      healthyD90: decimalText(healthyD90Total),
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
      createMemory("grossReceivablesGenerated", grossReceivablesGeneratedTotal, "gross-receivables-generated", "Recebíveis contratuais gerados pela entrada, encargos e saldo parcelado das coortes."),
      createMemory("grossReceivablesSettled", grossReceivablesSettledTotal, "gross-receivables-settled", receivablesPortfolio ? "Recebimentos correntes e curados liquidados antes do MDR segundo a política temporal da carteira." : "Recebíveis esperados liquidados antes do MDR no modo legado agregado."),
      createMemory("installmentCollections", installmentCollectionsTotal, "installment-collections", receivablesPortfolio ? "Parcelas correntes e curadas liquidadas depois de cancelamento, inadimplência, MDR e prazo." : "Parcelas de saldo liquidadas depois de perda agregada, MDR e prazo."),
      createMemory("canceledReceivables", canceledReceivablesTotal, "canceled-receivables", receivablesPortfolio ? "Recebíveis revertidos por curva temporal de cancelamento da coorte antes do vencimento." : "Modo legado agregado: política de carteira estruturada não fornecida."),
      createMemory("delinquentBalance", delinquentBalanceClosing, "delinquent-balance", receivablesPortfolio ? "Saldo vencido aberto no fechamento após arrecadação corrente, curas e write-off." : "Modo legado agregado: aging de carteira indisponível."),
      createMemory("curedCollections", curedCollectionsTotal, "cured-collections", receivablesPortfolio ? "Recebimentos recuperados por curvas condicionais de cura e bucket de aging." : "Modo legado agregado: curas não são separadas."),
      createMemory("writtenOffBalance", writtenOffBalanceTotal, "written-off-balance", receivablesPortfolio ? "Saldo remanescente baixado após a janela configurada de cobrança." : "Modo legado agregado: write-off não é separado."),
      createMemory("healthyD90", healthyD90Total, "healthy-d90", receivablesPortfolio ? "Contratos esperados ativos e sem inadimplência não curada aos 90 dias." : "Modo legado agregado: Healthy D90 indisponível."),
      createMemory("recognizedRevenue", recognizedRevenueTotal, "net-entry-collections", "Recebimentos líquidos de entrada, encargos e parcelas depois de perda, MDR e prazo."),
      createMemory("paymentTermsNetSettlement", recognizedRevenueTotal, "payment-terms-net-settlement", "Calendário comercial aplicado ao recebimento líquido: mix, MDR e prazo de liquidação."),
      createMemory("commercialTeamMonthlyCost", payrollMonthly, "commercial-team-monthly-cost", "Folha mensal agregada da estrutura comercial informada na Página 1."),
      createMemory("preOperationalInvestment", preOperationalInvestmentTotal, "pre-operational-investment", hasCompleteImplementationSchedule ? "Pré-investimento alocado por frente e mês de implantação informado." : "Pré-investimento distribuído antes da abertura operacional enquanto o cronograma por rubrica permanece incompleto."),
      createMemory("operatingCashFlow", totalOperatingCashFlow, "operating-cash-flow", "Fluxo acumulado depois de entrada líquida, custos, repasses, folha e implantação."),
      createMemory("npv", npv, "npv", "Valor presente dos fluxos mensais usando a taxa anual convertida para taxa mensal equivalente."),
      createMemory("irrAnnual", irrAnnual, "irr", "Taxa anual equivalente ao retorno interno dos fluxos mensais; fica indisponível quando não há mudança de sinal nos fluxos."),
      createMemory("paybackMonths", paybackMonths, "payback", "Mês de recuperação do caixa acumulado, com interpolação quando o ponto de equilíbrio ocorre entre dois meses."),
      ...(pointEconomics
        ? [createMemory(
            "pointEconomicsIncrementalNetContribution",
            new FinanceDecimal(pointEconomics.totals.value.incrementalNetContribution),
            "point-economics",
            "Contribuição incremental líquida mensal reconciliada dos pontos de captação; CAPEX e OPEX entram no caixa apenas quando marcados como incrementais.",
          )]
        : []),
      ...(options?.commercialOperations
        ? [
            createMemory(
              "commercialOperationsCosts",
              commercialOperationsCostsTotal,
              "commercial-operations",
              "Capacidade limitada por sala e workforce; custos de workforce e treinamento entram apenas quando marcados como incrementais.",
            ),
            createMemory(
              "commissionPayments",
              commissionPaymentsTotal,
              "commission-policy",
              "Comissões liquidadas no horizonte segundo base, tier, qualidade, holdback, cutoff, lag e tratamento contra dupla contagem.",
            ),
          ]
        : []),
    ],
    ...(receivablesPortfolio ? { receivablesPortfolio } : {}),
    ...(pointEconomics ? { pointEconomics } : {}),
    ...(options?.commercialOperations
      ? { commercialOperations: options.commercialOperations }
      : {}),
    ...(commissionLedger ? { commissionLedger } : {}),
  };
}
