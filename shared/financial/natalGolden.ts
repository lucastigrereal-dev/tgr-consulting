import {
  calculateFinancialProjection,
  type FinancialProjectionOptions,
  type PaymentSchedulePerContractItem,
} from "./engine";
import type {
  FinancialInput,
  FinancialInputSnapshot,
  SourceType,
} from "./types";

const USER_SOURCE_REF = "user-provided:Natal-Ponta-Negra-2026";
const TEST_DATA_SOURCE_REF = "TEST_DATA:Natal-Ponta-Negra-2026-v1";
const BALANCE_INSTALLMENT = "295.238095238095238095238095238095";

function provided(
  value: string,
  sourceType: SourceType,
  sourceRef: string
): FinancialInput {
  return { status: "provided", value, sourceType, sourceRef };
}

function pending(sourceRef: string): FinancialInput {
  return { status: "pending", sourceType: "assumption", sourceRef };
}

/**
 * Calendário parametrizável do Golden Natal. O fixture oficial usa offset 3
 * (90 dias); outro offset precisa ser informado explicitamente pelo chamador.
 */
export function createNatalPontaNegraPaymentSchedule(
  firstBalanceDueOffsetMonths: number
): PaymentSchedulePerContractItem[] {
  if (
    !Number.isInteger(firstBalanceDueOffsetMonths) ||
    firstBalanceDueOffsetMonths < 0
  ) {
    throw new Error(
      "firstBalanceDueOffsetMonths deve ser inteiro não negativo."
    );
  }

  return [
    ...Array.from({ length: 8 }, (_, dueMonthOffset) => ({
      component: "entry" as const,
      dueMonthOffset,
      grossAmount: "400",
    })),
    ...Array.from({ length: 84 }, (_, installmentIndex) => ({
      component: "balance" as const,
      dueMonthOffset: firstBalanceDueOffsetMonths + installmentIndex,
      grossAmount: BALANCE_INSTALLMENT,
    })),
  ];
}

const inputs = {
  qualifiedCouplesMonth1: provided("500", "current_decision", USER_SOURCE_REF),
  qualifiedCouplesGrowthRate: provided(
    "0",
    "current_decision",
    USER_SOURCE_REF
  ),
  conversionRate: provided("0.20", "current_decision", USER_SOURCE_REF),
  averageTicket: provided("28000", "current_decision", USER_SOURCE_REF),
  collectionRate: provided("0.75", "assumption", TEST_DATA_SOURCE_REF),
  cancellationRate: provided("0.30", "current_decision", USER_SOURCE_REF),
  variableCostRate: provided("0.07", "assumption", TEST_DATA_SOURCE_REF),
  partnerShareRate: provided("0", "assumption", TEST_DATA_SOURCE_REF),
  fixedCostMonthly: provided("100000", "assumption", TEST_DATA_SOURCE_REF),
  payrollMonthly: provided("180000", "assumption", TEST_DATA_SOURCE_REF),
  capexInitial: provided("0", "assumption", TEST_DATA_SOURCE_REF),
  capexAcquisitionShareRate: pending(TEST_DATA_SOURCE_REF),
  capexAcquisitionMonth: pending(TEST_DATA_SOURCE_REF),
  capexSalesRoomShareRate: pending(TEST_DATA_SOURCE_REF),
  capexSalesRoomMonth: pending(TEST_DATA_SOURCE_REF),
  capexSalesKitShareRate: pending(TEST_DATA_SOURCE_REF),
  capexSalesKitMonth: pending(TEST_DATA_SOURCE_REF),
  preOperationMonths: provided("0", "current_decision", USER_SOURCE_REF),
  entryValuePerContract: provided("3200", "current_decision", USER_SOURCE_REF),
  paymentCardViewMixRate: provided("0", "assumption", TEST_DATA_SOURCE_REF),
  paymentCardViewMdrRate: provided("0", "assumption", TEST_DATA_SOURCE_REF),
  paymentCardViewSettlementDays: provided(
    "0",
    "assumption",
    TEST_DATA_SOURCE_REF
  ),
  paymentCardInstallmentMixRate: provided(
    "0",
    "assumption",
    TEST_DATA_SOURCE_REF
  ),
  paymentCardInstallmentMdrRate: provided(
    "0",
    "assumption",
    TEST_DATA_SOURCE_REF
  ),
  paymentCardInstallmentSettlementDays: provided(
    "0",
    "assumption",
    TEST_DATA_SOURCE_REF
  ),
  paymentDebitMixRate: provided("0", "assumption", TEST_DATA_SOURCE_REF),
  paymentDebitMdrRate: provided("0", "assumption", TEST_DATA_SOURCE_REF),
  paymentDebitSettlementDays: provided("0", "assumption", TEST_DATA_SOURCE_REF),
  paymentRecurringChequeMixRate: provided(
    "0",
    "assumption",
    TEST_DATA_SOURCE_REF
  ),
  paymentRecurringChequeMdrRate: provided(
    "0",
    "assumption",
    TEST_DATA_SOURCE_REF
  ),
  paymentRecurringChequeSettlementDays: provided(
    "0",
    "assumption",
    TEST_DATA_SOURCE_REF
  ),
  paymentBoletoMixRate: provided("1", "assumption", TEST_DATA_SOURCE_REF),
  paymentBoletoMdrRate: provided("0", "assumption", TEST_DATA_SOURCE_REF),
  paymentBoletoSettlementDays: provided(
    "0",
    "assumption",
    TEST_DATA_SOURCE_REF
  ),
  discountRateAnnual: provided("0.12", "assumption", TEST_DATA_SOURCE_REF),
} satisfies FinancialInputSnapshot;

const options = {
  maxContracts: "3120",
  paymentSchedulePerContract: createNatalPontaNegraPaymentSchedule(3),
  receivablesPolicy: {
    cancellationCurve: {
      d7: "0.02",
      d30: "0.05",
      d60: "0.08",
      d90: "0.12",
      d180: "0.20",
      lifetime: "0.30",
    },
    delinquencyRate: "0.25",
    cureRates: {
      days1To30: "0.20",
      days31To60: "0.15",
      days61To90: "0.10",
      days90Plus: "0.05",
    },
    writeOffAfterDays: 180,
    policyVersion: "natal-ponta-negra-TEST-DATA-v1",
    sourceRef: TEST_DATA_SOURCE_REF,
  },
} satisfies FinancialProjectionOptions;

export const GOLDEN_NATAL_PONTA_NEGRA_2026 = {
  metadata: {
    scenarioId: "golden-natal-ponta-negra-2026",
    project: "Projeto Único Ponta Negra",
    location: "Natal/RN",
    units: 60,
    sharesPerUnit: 52,
    physicalContracts: 3120,
    pricePerContract: "28000",
    entryTotal: "3200",
    entryInstallments: 8,
    entryInstallmentAmount: "400",
    balanceTotal: "24800",
    balanceInstallments: 84,
    balanceInstallmentAmount: BALANCE_INSTALLMENT,
    firstBalanceDueDays: 90,
    firstBalanceDueOffsetMonths: 3,
    firstBalanceDuePolicy: {
      classification: "TEST DATA",
      days: 90,
      offsetMonths: 3,
    },
    grossSalesPerMonth: 100,
    qualifiedToursPerMonth: 500,
    conversionRate: "0.20",
    lifetimeCancellationRate: "0.30",
    delinquencyRate: "0.25",
    consultants: 15,
    closers: 6,
    taxPolicy: {
      status: "not_configured",
      rate: "0",
    },
    provisionalPolicy: {
      classification: "TEST DATA",
      sourceRef: TEST_DATA_SOURCE_REF,
      commissionRateIncludedInVariableCosts: "0.05",
      otherVariableCostRate: "0.02",
      aggregateVariableCostRate: "0.07",
      fixedCostMonthly: "100000",
      payrollMonthly: "180000",
      discountRateAnnual: "0.12",
      cancellationCurve: options.receivablesPolicy.cancellationCurve,
      cureRates: options.receivablesPolicy.cureRates,
    },
  },
  horizonMonths: 120,
  inputs,
  options,
} as const;

export function calculateGoldenNatalPontaNegra2026() {
  return calculateFinancialProjection(
    GOLDEN_NATAL_PONTA_NEGRA_2026.inputs,
    GOLDEN_NATAL_PONTA_NEGRA_2026.horizonMonths,
    GOLDEN_NATAL_PONTA_NEGRA_2026.options
  );
}
