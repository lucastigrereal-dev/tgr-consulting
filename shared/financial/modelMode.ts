import {
  HARMONY_COMPAT_FORMULA_SET_V1,
  IGR_CORE_FORMULA_SET_V1,
} from "./formulas";
import type { FinancialModelMode, FormulaSetVersion } from "./types";

export type FinancialModelModeDefinition = {
  id: FinancialModelMode;
  label: string;
  description: string;
  formulaSetVersion: FormulaSetVersion;
};

export const FINANCIAL_MODEL_MODE_REGISTRY = {
  HARMONY_COMPAT_V1: {
    id: "HARMONY_COMPAT_V1",
    label: "Harmony Compatível V1",
    description:
      "Reproduz de forma auditável as convenções do estudo Harmony legado para comparação e reconciliação.",
    formulaSetVersion: HARMONY_COMPAT_FORMULA_SET_V1,
  },
  TGR_CANONICAL_V2: {
    id: "TGR_CANONICAL_V2",
    label: "TGR Canônico V2",
    description:
      "Aplica a metodologia financeira canônica do TGR, com coortes, carteira, operação e caixa reconciliados.",
    formulaSetVersion: IGR_CORE_FORMULA_SET_V1,
  },
} as const satisfies Record<FinancialModelMode, FinancialModelModeDefinition>;

export const DEFAULT_FINANCIAL_MODEL_MODE: FinancialModelMode =
  "TGR_CANONICAL_V2";

export const TGR_CANONICAL_LEGACY_VERSION_PAIRS = [
  {
    formulaSetVersion: "1.3.0",
    engineVersion: "igr-engine-1.3.0",
    sourceRef: "git:5c2a284",
  },
  {
    formulaSetVersion: "1.4.0",
    engineVersion: "igr-engine-1.4.0",
    sourceRef: "git:85430c0",
  },
  {
    formulaSetVersion: "1.5.0",
    engineVersion: "igr-engine-1.5.0",
    sourceRef: "git:3d39f92",
  },
  {
    formulaSetVersion: "1.6.0",
    engineVersion: "igr-engine-1.6.0",
    sourceRef: "git:82d11e5",
  },
  {
    formulaSetVersion: "1.7.0",
    engineVersion: "igr-engine-1.7.0",
    sourceRef: "git:266531c",
  },
  {
    formulaSetVersion: "1.8.0",
    engineVersion: "igr-engine-1.8.0",
    sourceRef: "git:d6c3f3c",
  },
  {
    formulaSetVersion: "1.9.0",
    engineVersion: "igr-engine-1.9.0",
    sourceRef: "git:7f7eddf",
  },
] as const;

export function resolveLegacyFinancialModelMode(
  formulaSetVersion: string,
  engineVersion: string
): FinancialModelMode | null {
  const knownPair = TGR_CANONICAL_LEGACY_VERSION_PAIRS.some(
    pair =>
      pair.formulaSetVersion === formulaSetVersion &&
      pair.engineVersion === engineVersion
  );
  return knownPair ? "TGR_CANONICAL_V2" : null;
}

export function isFinancialModelMode(
  mode: unknown
): mode is FinancialModelMode {
  return (
    typeof mode === "string" &&
    Object.prototype.hasOwnProperty.call(FINANCIAL_MODEL_MODE_REGISTRY, mode)
  );
}

export function getFinancialModelModeDefinition(
  mode: unknown
): FinancialModelModeDefinition {
  if (!isFinancialModelMode(mode))
    throw new Error(`Modo financeiro inválido: ${String(mode)}.`);
  return FINANCIAL_MODEL_MODE_REGISTRY[mode];
}

export function resolveFinancialModelModeByFormulaSetId(
  formulaSetVersionId: string
): FinancialModelMode {
  const definition = Object.values(FINANCIAL_MODEL_MODE_REGISTRY).find(
    candidate => candidate.formulaSetVersion.id === formulaSetVersionId
  );
  if (!definition)
    throw new Error(
      `Conjunto de fórmulas sem modo financeiro registrado: ${formulaSetVersionId}.`
    );
  return definition.id;
}
