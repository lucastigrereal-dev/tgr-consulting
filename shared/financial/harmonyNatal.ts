import Decimal from "decimal.js";
import type {
  FinancialInput,
  FinancialInputSnapshot,
  SourceType,
} from "./types";

export const HARMONY_NATAL_HORIZON_MONTHS = 120;
export const HARMONY_NATAL_MAX_CONTRACTS = "3120";

const REVIEW_SOURCE_REF =
  "SOURCE_REVIEW_ASSERTION:PR#1@bd7848b3f6f8c7bbbf6142c68f4fb0cdf09f233e";
const DERIVED_SOURCE_REF =
  "DERIVED_FROM_REVIEW_RULES:HARMONY_COMPAT_V1 compatibility placeholder";
const MISSING_WORKBOOK_SOURCE_REF =
  "SOURCE_CONFLICT:missing COTAS_NATAL_ESTUDO_VIABILIDADE_HARMONY_MASTER_V1";

function provided(
  value: string,
  sourceType: SourceType,
  sourceRef: string
): FinancialInput {
  return { status: "provided", value, sourceType, sourceRef };
}

function reviewAssertion(value: string): FinancialInput {
  return provided(value, "current_document", REVIEW_SOURCE_REF);
}

function derivedCompatibility(value: string): FinancialInput {
  return provided(value, "derived_analysis", DERIVED_SOURCE_REF);
}

function pendingWorkbookValue(): FinancialInput {
  return {
    status: "pending",
    sourceType: "current_document",
    sourceRef: MISSING_WORKBOOK_SOURCE_REF,
  };
}
/**
 * Fixture executável do Natal no modo Harmony.
 *
 * Ele é deliberadamente independente do Golden canônico: nenhuma premissa de
 * teste daquele modelo pode atravessar silenciosamente a fronteira de método.
 * Zeros de meios de pagamento e de repasse são placeholders de compatibilidade
 * declarados porque o motor Harmony V1 usa as rubricas fixas do review; os seis
 * campos opcionais de abertura do CAPEX permanecem PENDING até o workbook existir.
 */
export function createHarmonyNatalInputs(
  grossSalesPerMonth = "100"
): FinancialInputSnapshot {
  const grossSales = new Decimal(grossSalesPerMonth);
  if (!grossSales.isFinite() || grossSales.isNegative()) {
    throw new Error("grossSalesPerMonth Harmony deve ser finito e não negativo.");
  }
  const qualifiedCouples = grossSales.div("0.2").toString();

  return {
    qualifiedCouplesMonth1: reviewAssertion(qualifiedCouples),
    qualifiedCouplesGrowthRate: derivedCompatibility("0"),
    conversionRate: reviewAssertion("0.2"),
    averageTicket: reviewAssertion("28000"),
    collectionRate: derivedCompatibility("1"),
    cancellationRate: reviewAssertion("0.30"),
    variableCostRate: derivedCompatibility("0"),
    partnerShareRate: derivedCompatibility("0"),
    fixedCostMonthly: reviewAssertion("117203"),
    payrollMonthly: provided("0", "current_document", MISSING_WORKBOOK_SOURCE_REF),
    capexInitial: reviewAssertion("985500"),
    capexAcquisitionShareRate: pendingWorkbookValue(),
    capexAcquisitionMonth: pendingWorkbookValue(),
    capexSalesRoomShareRate: pendingWorkbookValue(),
    capexSalesRoomMonth: pendingWorkbookValue(),
    capexSalesKitShareRate: pendingWorkbookValue(),
    capexSalesKitMonth: pendingWorkbookValue(),
    preOperationMonths: derivedCompatibility("0"),
    entryValuePerContract: reviewAssertion("3200"),
    paymentCardViewMixRate: derivedCompatibility("0"),
    paymentCardViewMdrRate: derivedCompatibility("0"),
    paymentCardViewSettlementDays: derivedCompatibility("0"),
    paymentCardInstallmentMixRate: derivedCompatibility("0"),
    paymentCardInstallmentMdrRate: derivedCompatibility("0"),
    paymentCardInstallmentSettlementDays: derivedCompatibility("0"),
    paymentDebitMixRate: derivedCompatibility("0"),
    paymentDebitMdrRate: derivedCompatibility("0"),
    paymentDebitSettlementDays: derivedCompatibility("0"),
    paymentRecurringChequeMixRate: derivedCompatibility("0"),
    paymentRecurringChequeMdrRate: derivedCompatibility("0"),
    paymentRecurringChequeSettlementDays: derivedCompatibility("0"),
    paymentBoletoMixRate: derivedCompatibility("1"),
    paymentBoletoMdrRate: derivedCompatibility("0"),
    paymentBoletoSettlementDays: derivedCompatibility("0"),
    discountRateAnnual: reviewAssertion("0.18"),
  };
}
