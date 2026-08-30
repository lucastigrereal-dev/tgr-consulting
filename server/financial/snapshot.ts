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
  domainInvalidities?: string[];
  calculationInputs?: FinancialInputSnapshot;
  calculationOptions?: { maxContracts?: string };
}) {
  const baseCalculation = calculateFinancialProjection(
    params.calculationInputs ?? params.inputs,
    params.horizonMonths,
    params.calculationOptions
  );
  const domainBlockers = params.domainBlockers ?? [];
  const domainInvalidities = params.domainInvalidities ?? [];
  const authoritativeStatus = domainInvalidities.length
    ? ("invalid" as const)
    : domainBlockers.length
      ? ("blocked_by_pending_inputs" as const)
      : baseCalculation.status;
  const calculation = authoritativeStatus === "valid"
    ? baseCalculation
    : {
        ...baseCalculation,
        status: authoritativeStatus,
        projections: [],
        memory: [],
        kpis: Object.fromEntries(
          Object.keys(baseCalculation.kpis).map(key => [key, null])
        ) as typeof baseCalculation.kpis,
      };
  const authoritativeExtension =
    params.authoritativeDomains === undefined &&
    domainBlockers.length === 0 &&
    domainInvalidities.length === 0 &&
    params.calculationInputs === undefined &&
    params.calculationOptions === undefined
      ? {}
      : {
          authoritativeDomains: params.authoritativeDomains ?? null,
          domainBlockers,
          domainInvalidities,
          effectiveInputs: params.calculationInputs ?? params.inputs,
          calculationOptions: params.calculationOptions ?? null,
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
