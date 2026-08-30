import { createHash } from "node:crypto";
import { calculateFinancialProjection } from "../../shared/financial/engine";
import type { FinancialInputSnapshot } from "../../shared/financial/types";

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")} ]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableSerialize(object[key])}`)
    .join(",")}}`;
}

export function calculateAuthoritativeSnapshot(params: {
  inputs: FinancialInputSnapshot;
  horizonMonths: number;
  formulaSetVersionId: string;
}) {
  const calculation = calculateFinancialProjection(
    params.inputs,
    params.horizonMonths
  );
  const canonical = stableSerialize({
    formulaSetVersionId: params.formulaSetVersionId,
    formulaSetVersion: calculation.formulaSetVersion,
    engineVersion: calculation.engineVersion,
    inputs: params.inputs,
    calculation,
  });
  const snapshotHash = createHash("sha256").update(canonical).digest("hex");
  return { ...calculation, snapshotHash };
}
