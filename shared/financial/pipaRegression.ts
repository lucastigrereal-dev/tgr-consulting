import { z } from "zod";
import { calculateFinancialProjection } from "./engine";
import { FinancialInputSnapshotSchema } from "./inputSchema";

export const PipaRegressionCaseSchema = z.object({
  id: z.string().min(3),
  formulaSetVersionId: z.string().min(1),
  horizonMonths: z.number().int().min(1).max(120),
  inputs: FinancialInputSnapshotSchema,
  expected: z.object({ npv: z.string(), irrAnnual: z.string().nullable(), paybackMonths: z.string().nullable(), totalOperatingCashFlow: z.string() }),
  tolerance: z.string().regex(/^0(?:\.\d+)?$/),
});
export type PipaRegressionCase = z.infer<typeof PipaRegressionCaseSchema>;

function assertWithinTolerance(actual: string | null, expected: string | null, tolerance: string, label: string) {
  if (actual === null || expected === null) { if (actual !== expected) throw new Error(`${label}: esperado ${expected}, obtido ${actual}`); return; }
  const delta = Math.abs(Number(actual) - Number(expected));
  if (delta > Number(tolerance)) throw new Error(`${label}: delta ${delta} excede tolerância ${tolerance}`);
}

export function runPipaRegression(caseInput: PipaRegressionCase) {
  const regressionCase = PipaRegressionCaseSchema.parse(caseInput);
  const result = calculateFinancialProjection(regressionCase.inputs, regressionCase.horizonMonths);
  if (result.status !== "valid") throw new Error(`Caso ${regressionCase.id} bloqueado por pendências: ${result.missingInputKeys.join(", ")}`);
  assertWithinTolerance(result.kpis.npv, regressionCase.expected.npv, regressionCase.tolerance, "VPL");
  assertWithinTolerance(result.kpis.irrAnnual, regressionCase.expected.irrAnnual, regressionCase.tolerance, "TIR");
  assertWithinTolerance(result.kpis.paybackMonths, regressionCase.expected.paybackMonths, regressionCase.tolerance, "Payback");
  assertWithinTolerance(result.kpis.totalOperatingCashFlow, regressionCase.expected.totalOperatingCashFlow, regressionCase.tolerance, "Caixa operacional");
  return { id: regressionCase.id, formulaSetVersionId: regressionCase.formulaSetVersionId, passed: true as const };
}
