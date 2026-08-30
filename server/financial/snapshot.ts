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
  authoritativeDomains?: unknown;
  domainBlockers?: string[];
}) {
  const baseCalculation = calculateFinancialProjection(
    params.inputs,
    params.horizonMonths
  );
  const domainBlockers = params.domainBlockers ?? [];
  const calculation =
    baseCalculation.status === "valid" && domainBlockers.length
      ? { ...baseCalculation, status: "blocked_by_pending_inputs" as const }
      : baseCalculation;
  const authoritativeExtension =
    params.authoritativeDomains === undefined && domainBlockers.length === 0
      ? {}
      : {
          authoritativeDomains: params.authoritativeDomains ?? null,
          domainBlockers,
        };
  const canonical = stableSerialize({
    formulaSetVersionId: params.formulaSetVersionId,
    formulaSetVersion: calculation.formulaSetVersion,
    engineVersion: calculation.engineVersion,
    inputs: params.inputs,
    calculation,
    ...authoritativeExtension,
  });
  const snapshotHash = createHash("sha256").update(canonical).digest("hex");
  return { ...calculation, ...authoritativeExtension, snapshotHash };
}
