import type { GoalSeekVariableKey } from "@shared/financial/goalseek";
import { resolveFinancialModelModeByFormulaSetId } from "@shared/financial/modelMode";
import type { FinancialModelMode } from "@shared/financial/types";

const HARMONY_APPLYABLE_GOAL_SEEK_LEVERS = new Set<GoalSeekVariableKey>([
  "capexInitial",
  "fixedCostMonthly",
  "payrollMonthly",
]);

// O backend deriva estas premissas de domínios estruturados. Aplicá-las apenas
// em input_values seria descartado no snapshot autoritativo seguinte.
const AUTHORITATIVE_DOMAIN_OWNED_GOAL_SEEK_LEVERS = new Set<GoalSeekVariableKey>([
  "averageTicket",
  "entryValuePerContract",
  "qualifiedCouplesMonth1",
  "qualifiedCouplesGrowthRate",
  "conversionRate",
]);

export function normalizeMeetingVariableCostDelta(
  mode: FinancialModelMode | null | undefined,
  value: string
) {
  return mode === "TGR_CANONICAL_V2" ? value : "0";
}

export function isGoalSeekLeverApplyable(
  mode: FinancialModelMode | null | undefined,
  variableKey: GoalSeekVariableKey
) {
  if (mode === "TGR_CANONICAL_V2") {
    return !AUTHORITATIVE_DOMAIN_OWNED_GOAL_SEEK_LEVERS.has(variableKey);
  }
  if (mode === "HARMONY_COMPAT_V1") {
    return HARMONY_APPLYABLE_GOAL_SEEK_LEVERS.has(variableKey);
  }
  return false;
}

export function resolveFinancialModelModeFromFormulaSet(
  formulaSetVersionId: string | null | undefined
): FinancialModelMode | null {
  if (!formulaSetVersionId) return null;
  try {
    return resolveFinancialModelModeByFormulaSetId(formulaSetVersionId);
  } catch {
    return null;
  }
}
