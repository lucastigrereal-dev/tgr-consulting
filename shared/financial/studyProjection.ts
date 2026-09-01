import {
  calculateFinancialProjection,
  type FinancialProjectionOptions,
} from "./engine";
import { calculateHarmonyCompatProjection } from "./harmonyCompat";
import type {
  FinancialCalculation,
  FinancialInputSnapshot,
  FinancialModelMode,
} from "./types";

export function calculateStudyProjection(
  financialModelMode: FinancialModelMode,
  inputs: FinancialInputSnapshot,
  horizonMonths: number,
  options?: FinancialProjectionOptions
): FinancialCalculation {
  if (financialModelMode === "HARMONY_COMPAT_V1") {
    if (!options?.maxContracts)
      throw new Error("O modo Harmony exige maxContracts explícito.");
    return calculateHarmonyCompatProjection(inputs, horizonMonths, {
      ...options,
      maxContracts: options.maxContracts,
    });
  }
  return calculateFinancialProjection(inputs, horizonMonths, options);
}
