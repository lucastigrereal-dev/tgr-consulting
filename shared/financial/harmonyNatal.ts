import Decimal from "decimal.js";
import type {
  FinancialInput,
  FinancialInputSnapshot,
  SourceType,
} from "./types";

export const HARMONY_NATAL_HORIZON_MONTHS = 144;
export const HARMONY_NATAL_MAX_CONTRACTS = "3120";

const CANONICAL_SOURCE_REF =
  "CANONICAL_FROM_HARMONY_MASTER_V1:docs/tgr/golden/COTAS_NATAL_HARMONY_GOLDEN_V1_RULES.json";
const DERIVED_SOURCE_REF =
  "DERIVED_FROM_CANONICAL_HARMONY_RULES:COTAS_NATAL_HARMONY_GOLDEN_V1";

function provided(
  value: string,
  sourceType: SourceType,
  sourceRef: string
): FinancialInput {
  return { status: "provided", value, sourceType, sourceRef };
}

function canonicalValue(value: string): FinancialInput {
  return provided(value, "historical_primary", CANONICAL_SOURCE_REF);
}

function derivedCompatibility(value: string): FinancialInput {
  return provided(value, "derived_analysis", DERIVED_SOURCE_REF);
}

function notApplicableCanonicalValue(): FinancialInput {
  return {
    status: "pending",
    sourceType: "historical_primary",
    sourceRef: `${CANONICAL_SOURCE_REF}:not_applicable_to_harmony_compat_v1`,
  };
}
/**
 * Fixture executável do Natal no modo Harmony.
 *
 * A fonte é o Golden certificado reconstruído do Harmony Master V1. Os seis
 * campos opcionais de abertura do CAPEX permanecem PENDING porque o modelo
 * Harmony consome o pré-operacional agregado de R$ 985.500 em t0/M1.
 */
export function createHarmonyNatalInputs(
  grossSalesPerMonth = "100",
  pricePerContract = "28000",
): FinancialInputSnapshot {
  const grossSales = new Decimal(grossSalesPerMonth);
  if (!grossSales.isFinite() || grossSales.isNegative()) {
    throw new Error("grossSalesPerMonth Harmony deve ser finito e não negativo.");
  }
  const price = new Decimal(pricePerContract);
  if (!price.isFinite() || price.lte(0)) {
    throw new Error("pricePerContract Harmony deve ser finito e maior que zero.");
  }
  const qualifiedCouples = grossSales.div("0.2").toString();

  return {
    qualifiedCouplesMonth1: canonicalValue(qualifiedCouples),
    qualifiedCouplesGrowthRate: derivedCompatibility("0"),
    conversionRate: canonicalValue("0.2"),
    averageTicket: canonicalValue(price.toString()),
    collectionRate: derivedCompatibility("1"),
    cancellationRate: canonicalValue("0.30"),
    variableCostRate: derivedCompatibility("0"),
    partnerShareRate: derivedCompatibility("0"),
    fixedCostMonthly: canonicalValue("195339"),
    payrollMonthly: canonicalValue("0"),
    capexInitial: canonicalValue("985500"),
    capexAcquisitionShareRate: notApplicableCanonicalValue(),
    capexAcquisitionMonth: notApplicableCanonicalValue(),
    capexSalesRoomShareRate: notApplicableCanonicalValue(),
    capexSalesRoomMonth: notApplicableCanonicalValue(),
    capexSalesKitShareRate: notApplicableCanonicalValue(),
    capexSalesKitMonth: notApplicableCanonicalValue(),
    preOperationMonths: derivedCompatibility("0"),
    entryValuePerContract: canonicalValue("3200"),
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
    discountRateAnnual: canonicalValue("0.18"),
  };
}
