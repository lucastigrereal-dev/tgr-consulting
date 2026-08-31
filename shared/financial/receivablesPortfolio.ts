import Decimal from "decimal.js";
import type { PaymentCalendarComponent } from "./paymentCalendar";

const PortfolioDecimal = Decimal.clone({
  precision: 32,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 30,
});

type PortfolioDecimalInstance = InstanceType<typeof PortfolioDecimal>;

const ZERO = new PortfolioDecimal(0);
const ONE = new PortfolioDecimal(1);

export type ReceivablesCancellationMilestone =
  | "d7"
  | "d30"
  | "d60"
  | "d90"
  | "d180"
  | "lifetime";

export type ReceivablesCureBucket = "1_30" | "31_60" | "61_90" | "90_plus";

export type ReceivablesAgingStatus =
  | "not_due"
  | "collected_current"
  | "collected_cured"
  | "delinquent_1_30"
  | "delinquent_31_60"
  | "delinquent_61_90"
  | "delinquent_90_plus"
  | "written_off";

export type ReceivablesPolicy = {
  cancellationCurve: Record<ReceivablesCancellationMilestone, string>;
  delinquencyRate: string;
  cureRates: {
    days1To30: string;
    days31To60: string;
    days61To90: string;
    days90Plus: string;
  };
  writeOffAfterDays: number;
  policyVersion: string;
  sourceRef: string;
};

export type ReceivablesSalesCohort = {
  cohortId: string;
  saleMonth: number;
  contracts: string;
  paymentSchedulePerContract: Array<{
    component: PaymentCalendarComponent;
    dueMonthOffset: number;
    grossAmount: string;
  }>;
};

export type ReceivableLedgerLine = {
  receivableId: string;
  cohortId: string;
  component: PaymentCalendarComponent;
  dueMonthOffset: number;
  dueMonth: number;
  gross: string;
  canceledBeforeDue: string;
  expectedAfterCancellation: string;
  currentCollected: string;
  curedCollections: Array<{
    bucket: ReceivablesCureBucket;
    collectionMonth: number;
    amount: string;
  }>;
  writtenOff: string;
  writtenOffMonth: number | null;
  openDelinquent: string;
  agingStatus: ReceivablesAgingStatus;
};

export type ReceivablesMonthlySummary = {
  month: number;
  grossDue: string;
  canceledBeforeDue: string;
  expectedAfterCancellation: string;
  currentCollected: string;
  curedCollections: string;
  writtenOff: string;
  openDelinquent: string;
};

export type ReceivablesCohortSummary = {
  cohortId: string;
  saleMonth: number;
  contracts: string;
  grossReceivables: string;
  expectedAfterCancellation: string;
  activeD90: string;
  healthyD90: string;
};

export type ReceivablesPortfolio = {
  policyVersion: string;
  sourceRef: string;
  asOfMonth: number;
  ledger: ReceivableLedgerLine[];
  monthlySummaries: ReceivablesMonthlySummary[];
  cohortSummaries: ReceivablesCohortSummary[];
  canceledContractsByMilestone: Array<{
    cohortId: string;
    milestone: ReceivablesCancellationMilestone;
    month: number;
    contracts: string;
  }>;
};

const CANCELLATION_MILESTONES: ReadonlyArray<{
  key: ReceivablesCancellationMilestone;
  day: number;
}> = [
  { key: "d7", day: 7 },
  { key: "d30", day: 30 },
  { key: "d60", day: 60 },
  { key: "d90", day: 90 },
  { key: "d180", day: 180 },
  // Lifetime starts after D180; month 7 is the first monthly observation after it.
  { key: "lifetime", day: 181 },
];

const CURE_BUCKETS: ReadonlyArray<{
  bucket: ReceivablesCureBucket;
  policyKey: keyof ReceivablesPolicy["cureRates"];
  collectionDay: number;
  monthOffset: number;
}> = [
  { bucket: "1_30", policyKey: "days1To30", collectionDay: 30, monthOffset: 1 },
  { bucket: "31_60", policyKey: "days31To60", collectionDay: 60, monthOffset: 2 },
  { bucket: "61_90", policyKey: "days61To90", collectionDay: 90, monthOffset: 3 },
  { bucket: "90_plus", policyKey: "days90Plus", collectionDay: 120, monthOffset: 4 },
];

function decimalText(value: PortfolioDecimalInstance): string {
  return value.eq(ZERO) ? "0.00000000" : value.toFixed(8);
}

function money(value: PortfolioDecimalInstance): PortfolioDecimalInstance {
  return value.toDecimalPlaces(8, PortfolioDecimal.ROUND_HALF_UP);
}

function readNonNegativeDecimal(value: string, field: string): PortfolioDecimalInstance {
  let parsed: PortfolioDecimalInstance;
  try {
    parsed = new PortfolioDecimal(value);
  } catch {
    throw new Error(`${field} deve ser decimal válido.`);
  }
  if (!parsed.isFinite() || parsed.lt(ZERO)) {
    throw new Error(`${field} deve ser decimal não negativo.`);
  }
  return parsed;
}

function readRate(value: string, field: string): PortfolioDecimalInstance {
  const parsed = readNonNegativeDecimal(value, field);
  if (parsed.gt(ONE)) throw new Error(`${field} deve estar entre 0 e 1.`);
  return parsed;
}

function assertIntegerMonth(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} deve ser mês inteiro maior ou igual a zero.`);
  }
}

function validatePolicy(policy: ReceivablesPolicy) {
  if (!policy.policyVersion.trim()) throw new Error("policyVersion é obrigatório.");
  if (!policy.sourceRef.trim()) throw new Error("sourceRef é obrigatório.");
  if (!Number.isInteger(policy.writeOffAfterDays) || policy.writeOffAfterDays < 90) {
    throw new Error("writeOffAfterDays deve ser inteiro maior ou igual a 90.");
  }

  const cancellationRates = CANCELLATION_MILESTONES.map(({ key }) => ({
    key,
    value: readRate(policy.cancellationCurve[key], `cancellationCurve.${key}`),
  }));
  cancellationRates.forEach((rate, index) => {
    if (index > 0 && rate.value.lt(cancellationRates[index - 1]!.value)) {
      throw new Error("A curva cumulativa de cancelamento deve ser monotônica.");
    }
  });

  return {
    cancellationRates,
    delinquencyRate: readRate(policy.delinquencyRate, "delinquencyRate"),
    cureRates: Object.fromEntries(
      CURE_BUCKETS.map(({ policyKey }) => [
        policyKey,
        readRate(policy.cureRates[policyKey], `cureRates.${policyKey}`),
      ]),
    ) as Record<keyof ReceivablesPolicy["cureRates"], PortfolioDecimalInstance>,
  };
}

export function assertReceivablesPolicy(policy: ReceivablesPolicy): void {
  validatePolicy(policy);
}

function cancellationRateAtDue(
  dueMonthOffset: number,
  rates: ReturnType<typeof validatePolicy>["cancellationRates"],
): PortfolioDecimalInstance {
  const ageInDays = dueMonthOffset * 30;
  let applicable = ZERO;
  CANCELLATION_MILESTONES.forEach((milestone, index) => {
    if (milestone.day <= ageInDays) applicable = rates[index]!.value;
  });
  return applicable;
}

function agingStatus(params: {
  asOfMonth: number;
  dueMonth: number;
  currentCollected: PortfolioDecimalInstance;
  curedCollected: PortfolioDecimalInstance;
  writtenOff: PortfolioDecimalInstance;
  open: PortfolioDecimalInstance;
}): ReceivablesAgingStatus {
  if (params.asOfMonth < params.dueMonth) return "not_due";
  if (params.open.eq(ZERO)) {
    if (params.writtenOff.gt(ZERO)) return "written_off";
    if (params.curedCollected.gt(ZERO)) return "collected_cured";
    return "collected_current";
  }

  const daysPastDue = (params.asOfMonth - params.dueMonth) * 30;
  if (daysPastDue <= 30) return "delinquent_1_30";
  if (daysPastDue <= 60) return "delinquent_31_60";
  if (daysPastDue <= 90) return "delinquent_61_90";
  return "delinquent_90_plus";
}

function sum(
  values: readonly PortfolioDecimalInstance[],
): PortfolioDecimalInstance {
  return values.reduce(
    (total, value) => total.plus(value),
    new PortfolioDecimal(0),
  );
}

export function buildReceivablesPortfolio(input: {
  cohorts: ReceivablesSalesCohort[];
  policy: ReceivablesPolicy;
  asOfMonth: number;
}): ReceivablesPortfolio {
  assertIntegerMonth(input.asOfMonth, "asOfMonth");
  const validatedPolicy = validatePolicy(input.policy);
  const seenCohorts = new Set<string>();

  const ledger: ReceivableLedgerLine[] = [];
  const cohortSummaries: ReceivablesCohortSummary[] = [];
  const canceledContractsByMilestone: ReceivablesPortfolio["canceledContractsByMilestone"] = [];

  for (const cohort of input.cohorts) {
    if (!cohort.cohortId.trim()) throw new Error("cohortId é obrigatório.");
    if (seenCohorts.has(cohort.cohortId)) {
      throw new Error(`cohortId duplicado: ${cohort.cohortId}.`);
    }
    seenCohorts.add(cohort.cohortId);
    assertIntegerMonth(cohort.saleMonth, `${cohort.cohortId}.saleMonth`);
    const contracts = readNonNegativeDecimal(cohort.contracts, `${cohort.cohortId}.contracts`);

    let previousCancellation = new PortfolioDecimal(0);
    CANCELLATION_MILESTONES.forEach((milestone, index) => {
      const cumulative = validatedPolicy.cancellationRates[index]!.value;
      canceledContractsByMilestone.push({
        cohortId: cohort.cohortId,
        milestone: milestone.key,
        month: cohort.saleMonth + Math.ceil(milestone.day / 30),
        contracts: decimalText(contracts.times(cumulative.minus(previousCancellation))),
      });
      previousCancellation = cumulative;
    });

    const cohortLedger: ReceivableLedgerLine[] = [];
    cohort.paymentSchedulePerContract.forEach((receivable, index) => {
      assertIntegerMonth(
        receivable.dueMonthOffset,
        `${cohort.cohortId}.paymentSchedulePerContract.${index}.dueMonthOffset`,
      );
      const amountPerContract = readNonNegativeDecimal(
        receivable.grossAmount,
        `${cohort.cohortId}.paymentSchedulePerContract.${index}.grossAmount`,
      );
      const gross = money(amountPerContract.times(contracts));
      const dueMonth = cohort.saleMonth + receivable.dueMonthOffset;
      const cancellationRate = cancellationRateAtDue(
        receivable.dueMonthOffset,
        validatedPolicy.cancellationRates,
      );
      const canceledBeforeDue = money(gross.times(cancellationRate));
      const expectedAfterCancellation = gross.minus(canceledBeforeDue);

      const isDue = input.asOfMonth >= dueMonth;
      const currentCollected = isDue
        ? money(expectedAfterCancellation.times(ONE.minus(validatedPolicy.delinquencyRate)))
        : ZERO;
      let remaining = isDue
        ? expectedAfterCancellation.minus(currentCollected)
        : expectedAfterCancellation;
      const curedCollections: ReceivableLedgerLine["curedCollections"] = [];

      if (isDue) {
        CURE_BUCKETS.forEach(bucket => {
          const collectionMonth = dueMonth + bucket.monthOffset;
          if (
            bucket.collectionDay > input.policy.writeOffAfterDays ||
            collectionMonth > input.asOfMonth
          ) return;
          const cured = money(remaining.times(validatedPolicy.cureRates[bucket.policyKey]));
          if (cured.gt(ZERO)) {
            curedCollections.push({
              bucket: bucket.bucket,
              collectionMonth,
              amount: decimalText(cured),
            });
          }
          remaining = remaining.minus(cured);
        });
      }

      const writeOffMonth = dueMonth + Math.ceil(input.policy.writeOffAfterDays / 30);
      const writtenOff = isDue && input.asOfMonth >= writeOffMonth ? remaining : ZERO;
      if (writtenOff.gt(ZERO)) remaining = ZERO;
      const curedTotal = sum(curedCollections.map(collection => new PortfolioDecimal(collection.amount)));

      const line: ReceivableLedgerLine = {
        receivableId: `${cohort.cohortId}:${index + 1}`,
        cohortId: cohort.cohortId,
        component: receivable.component,
        dueMonthOffset: receivable.dueMonthOffset,
        dueMonth,
        gross: decimalText(gross),
        canceledBeforeDue: decimalText(canceledBeforeDue),
        expectedAfterCancellation: decimalText(expectedAfterCancellation),
        currentCollected: decimalText(currentCollected),
        curedCollections,
        writtenOff: decimalText(writtenOff),
        writtenOffMonth: writtenOff.gt(ZERO) ? writeOffMonth : null,
        openDelinquent: decimalText(remaining),
        agingStatus: agingStatus({
          asOfMonth: input.asOfMonth,
          dueMonth,
          currentCollected,
          curedCollected: curedTotal,
          writtenOff,
          open: remaining,
        }),
      };
      cohortLedger.push(line);
      ledger.push(line);
    });

    const d90Rate = validatedPolicy.cancellationRates.find(rate => rate.key === "d90")!.value;
    const activeD90 = contracts.times(ONE.minus(d90Rate));
    const residualAt90 = CURE_BUCKETS.slice(0, 3).reduce(
      (residual, bucket) => residual.times(ONE.minus(validatedPolicy.cureRates[bucket.policyKey])),
      validatedPolicy.delinquencyRate,
    );
    // Aggregate policy expresses the expected share of active contracts without
    // unresolved 90-day delinquency. It is applied once per contract, regardless
    // of how many receivable components share the same due month.
    const healthyProbability = ONE.minus(residualAt90);

    cohortSummaries.push({
      cohortId: cohort.cohortId,
      saleMonth: cohort.saleMonth,
      contracts: decimalText(contracts),
      grossReceivables: decimalText(sum(cohortLedger.map(line => new PortfolioDecimal(line.gross)))),
      expectedAfterCancellation: decimalText(
        sum(cohortLedger.map(line => new PortfolioDecimal(line.expectedAfterCancellation))),
      ),
      activeD90: decimalText(activeD90),
      healthyD90: decimalText(activeD90.times(healthyProbability)),
    });
  }

  const firstMonth = input.cohorts.length === 0
    ? input.asOfMonth
    : Math.min(...input.cohorts.map(cohort => cohort.saleMonth));
  const grossDueByMonth = new Map<number, PortfolioDecimalInstance>();
  const canceledByMonth = new Map<number, PortfolioDecimalInstance>();
  const expectedByMonth = new Map<number, PortfolioDecimalInstance>();
  const currentByMonth = new Map<number, PortfolioDecimalInstance>();
  const curedByMonth = new Map<number, PortfolioDecimalInstance>();
  const writtenOffByMonth = new Map<number, PortfolioDecimalInstance>();
  const openDeltaByMonth = new Map<number, PortfolioDecimalInstance>();
  const addMonthlyAmount = (
    target: Map<number, PortfolioDecimalInstance>,
    month: number,
    value: PortfolioDecimalInstance | string,
  ) => {
    target.set(
      month,
      (target.get(month) ?? ZERO).plus(value),
    );
  };

  for (const line of ledger) {
    addMonthlyAmount(grossDueByMonth, line.dueMonth, line.gross);
    addMonthlyAmount(canceledByMonth, line.dueMonth, line.canceledBeforeDue);
    addMonthlyAmount(
      expectedByMonth,
      line.dueMonth,
      line.expectedAfterCancellation,
    );
    addMonthlyAmount(currentByMonth, line.dueMonth, line.currentCollected);
    addMonthlyAmount(
      openDeltaByMonth,
      line.dueMonth,
      new PortfolioDecimal(line.expectedAfterCancellation)
        .minus(line.currentCollected),
    );
    for (const collection of line.curedCollections) {
      addMonthlyAmount(curedByMonth, collection.collectionMonth, collection.amount);
      addMonthlyAmount(
        openDeltaByMonth,
        collection.collectionMonth,
        new PortfolioDecimal(collection.amount).negated(),
      );
    }
    if (line.writtenOffMonth !== null) {
      addMonthlyAmount(writtenOffByMonth, line.writtenOffMonth, line.writtenOff);
      addMonthlyAmount(
        openDeltaByMonth,
        line.writtenOffMonth,
        new PortfolioDecimal(line.writtenOff).negated(),
      );
    }
  }

  let openDelinquent = ZERO;
  const monthlySummaries = Array.from(
    { length: Math.max(0, input.asOfMonth - firstMonth + 1) },
    (_, index): ReceivablesMonthlySummary => {
      const month = firstMonth + index;
      openDelinquent = openDelinquent.plus(openDeltaByMonth.get(month) ?? ZERO);

      return {
        month,
        grossDue: decimalText(grossDueByMonth.get(month) ?? ZERO),
        canceledBeforeDue: decimalText(canceledByMonth.get(month) ?? ZERO),
        expectedAfterCancellation: decimalText(expectedByMonth.get(month) ?? ZERO),
        currentCollected: decimalText(currentByMonth.get(month) ?? ZERO),
        curedCollections: decimalText(curedByMonth.get(month) ?? ZERO),
        writtenOff: decimalText(writtenOffByMonth.get(month) ?? ZERO),
        openDelinquent: decimalText(openDelinquent),
      };
    },
  );

  return {
    policyVersion: input.policy.policyVersion,
    sourceRef: input.policy.sourceRef,
    asOfMonth: input.asOfMonth,
    ledger,
    monthlySummaries,
    cohortSummaries,
    canceledContractsByMilestone,
  };
}
