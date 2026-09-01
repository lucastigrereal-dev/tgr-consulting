import { createHash } from "node:crypto";
import {
  calculateFinancialProjection,
  type FinancialProjectionOptions,
} from "../../shared/financial/engine";
import { calculateHarmonyCompatProjection } from "../../shared/financial/harmonyCompat";
import {
  DEFAULT_FINANCIAL_MODEL_MODE,
  getFinancialModelModeDefinition,
} from "../../shared/financial/modelMode";
import type {
  FinancialCalculation,
  FinancialInputSnapshot,
  FinancialModelMode,
} from "../../shared/financial/types";

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")} ]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableSerialize(object[key])}`)
    .join(",")}}`;
}

type SnapshotBaseParams = {
  /** Escopo persistente que impede colisão global entre versões equivalentes. */
  projectVersionId: string;
  inputs: FinancialInputSnapshot;
  horizonMonths: number;
  /** Data-base analítica persistida; zero mantém compatibilidade com chamadas legadas. */
  asOfMonth?: number;
  formulaSetVersionId: string;
  authoritativeDomains?: unknown;
  domainBlockers?: string[];
  domainInvalidities?: string[];
  calculationInputs?: FinancialInputSnapshot;
};

export type HarmonySnapshotCalculationOptions = FinancialProjectionOptions & {
  maxContracts: string;
};

export type CanonicalSnapshotParams = SnapshotBaseParams & {
  financialModelMode?: "TGR_CANONICAL_V2";
  calculationOptions?: FinancialProjectionOptions;
};

export type HarmonyExecutableSnapshotParams = SnapshotBaseParams & {
  financialModelMode: "HARMONY_COMPAT_V1";
  calculationOptions: HarmonySnapshotCalculationOptions;
  domainBlockers?: [];
  domainInvalidities?: [];
};

export type HarmonyBlockedSnapshotParams = Omit<
  SnapshotBaseParams,
  "domainBlockers"
> & {
  financialModelMode: "HARMONY_COMPAT_V1";
  calculationOptions?: HarmonySnapshotCalculationOptions;
  domainBlockers: [string, ...string[]];
};

export type HarmonyInvalidSnapshotParams = Omit<
  SnapshotBaseParams,
  "domainInvalidities"
> & {
  financialModelMode: "HARMONY_COMPAT_V1";
  calculationOptions?: HarmonySnapshotCalculationOptions;
  domainInvalidities: [string, ...string[]];
};

export type RuntimeSnapshotParams = SnapshotBaseParams & {
  financialModelMode?: FinancialModelMode;
  calculationOptions?: FinancialProjectionOptions;
};

type SnapshotAuthoritativeExtension = {
  authoritativeDomains?: unknown;
  domainBlockers?: string[];
  domainInvalidities?: string[];
  effectiveInputs?: FinancialInputSnapshot;
  calculationOptions?: FinancialProjectionOptions | null;
};

export type AuthoritativeSnapshot = FinancialCalculation &
  SnapshotAuthoritativeExtension & {
    financialModelMode: FinancialModelMode;
    snapshotHash: string;
  };

function emptyKpis(): FinancialCalculation["kpis"] {
  return {
    grossSales: null,
    grossEntryGenerated: null,
    grossReceivablesGenerated: null,
    grossReceivablesSettled: null,
    installmentCollections: null,
    canceledReceivables: null,
    delinquentBalance: null,
    curedCollections: null,
    writtenOffBalance: null,
    healthyD90: null,
    recognizedRevenue: null,
    paymentFees: null,
    preOperationalInvestment: null,
    totalOperatingCashFlow: null,
    totalGrossContracts: null,
    totalNetContracts: null,
    sellOutMonth: null,
    contributionMargin: null,
    operatingMarginRate: null,
    capitalRequired: null,
    worstCashMonth: null,
    breakEvenMonth: null,
    npv: null,
    irrAnnual: null,
    paybackMonths: null,
  };
}

export function calculateAuthoritativeSnapshot(
  params: CanonicalSnapshotParams
): AuthoritativeSnapshot;
export function calculateAuthoritativeSnapshot(
  params: HarmonyExecutableSnapshotParams
): AuthoritativeSnapshot;
export function calculateAuthoritativeSnapshot(
  params: HarmonyBlockedSnapshotParams
): AuthoritativeSnapshot;
export function calculateAuthoritativeSnapshot(
  params: HarmonyInvalidSnapshotParams
): AuthoritativeSnapshot;
export function calculateAuthoritativeSnapshot(
  params: RuntimeSnapshotParams
): AuthoritativeSnapshot;
export function calculateAuthoritativeSnapshot(
  params: RuntimeSnapshotParams
): AuthoritativeSnapshot {
  const financialModelMode =
    params.financialModelMode ?? DEFAULT_FINANCIAL_MODEL_MODE;
  const modelDefinition = getFinancialModelModeDefinition(financialModelMode);
  if (params.formulaSetVersionId !== modelDefinition.formulaSetVersion.id)
    throw new Error(
      `Snapshot no modo ${financialModelMode} exige o conjunto de fórmulas ${modelDefinition.formulaSetVersion.id}.`
    );

  const domainBlockers = params.domainBlockers ?? [];
  const domainInvalidities = params.domainInvalidities ?? [];
  const domainStatus = domainInvalidities.length > 0
    ? ("invalid" as const)
    : domainBlockers.length > 0
      ? ("blocked_by_pending_inputs" as const)
      : null;

  let baseCalculation: FinancialCalculation;
  if (domainStatus !== null) {
    baseCalculation = {
      financialModelMode,
      status: domainStatus,
      horizonMonths: params.horizonMonths,
      missingInputKeys: [],
      formulaSetVersion: modelDefinition.formulaSetVersion.semanticVersion,
      engineVersion: modelDefinition.formulaSetVersion.engineVersion,
      projections: [],
      kpis: emptyKpis(),
      memory: [],
    };
  } else if (financialModelMode === "HARMONY_COMPAT_V1") {
    const harmonyOptions = params.calculationOptions;
    if (!harmonyOptions?.maxContracts)
      throw new Error(
        "Snapshot Harmony válido exige calculationOptions.maxContracts."
      );
    baseCalculation = calculateHarmonyCompatProjection(
      params.calculationInputs ?? params.inputs,
      params.horizonMonths,
      { ...harmonyOptions, maxContracts: harmonyOptions.maxContracts }
    );
  } else {
    baseCalculation = calculateFinancialProjection(
      params.calculationInputs ?? params.inputs,
      params.horizonMonths,
      params.calculationOptions
    );
  }

  const calculation = domainStatus === null && baseCalculation.status !== "valid"
    ? {
        ...baseCalculation,
        projections: [],
        memory: [],
        kpis: emptyKpis(),
      }
    : baseCalculation;
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
    snapshotIdentityScope: {
      projectVersionId: params.projectVersionId,
      horizonMonths: params.horizonMonths,
      asOfMonth: params.asOfMonth ?? 0,
    },
    financialModelMode,
    formulaSetVersionId: params.formulaSetVersionId,
    formulaSetVersion: calculation.formulaSetVersion,
    engineVersion: calculation.engineVersion,
    inputs: params.inputs,
    calculation,
    ...authoritativeExtension,
  });
  const snapshotHash = createHash("sha256").update(canonical).digest("hex");
  return {
    ...calculation,
    ...authoritativeExtension,
    financialModelMode,
    snapshotHash,
  };
}
