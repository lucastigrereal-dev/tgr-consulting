import Decimal from "decimal.js";
import {
  HARMONY_COMPAT_FORMULA_SET_V1,
  IGR_CORE_FORMULA_SET_V1,
} from "./formulas";
import type { FinancialCalculation, MonthlyProjection } from "./types";

export type HarmonyRegressionDifferenceStatus = "MODEL_DELTA" | "SOURCE_CONFLICT";
export type HarmonyRegressionStatus = "MATCH" | "DELTA" | HarmonyRegressionDifferenceStatus;

export type HarmonyRegressionConflict = {
  id: string;
  /**
   * MODEL_DELTA identifica divergência esperada entre metodologias completas;
   * SOURCE_CONFLICT fica reservado à ausência ou contradição da fonte.
   */
  classification: HarmonyRegressionDifferenceStatus;
  sourceRef: string;
  reason: string;
  adoptedRule: string;
  metric: string;
  /** Null somente para KPI; métricas mensais exigem uma célula explícita. */
  month: number | null;
  /** Causa estável quando esta célula foi expandida de uma regra do fixture. */
  causalId?: string;
};

export type HarmonyRegressionRow = {
  scope: "monthly" | "kpi";
  month: number | null;
  metric: string;
  harmony: string | null;
  tgr: string | null;
  delta: string | null;
  status: HarmonyRegressionStatus;
  conflictId?: string;
  justification?: Pick<
    HarmonyRegressionConflict,
    "classification" | "sourceRef" | "reason" | "adoptedRule"
  > & { causalId?: string };
};

export type HarmonyRegressionReport = {
  tolerance: string;
  monthly: HarmonyRegressionRow[];
  kpis: HarmonyRegressionRow[];
  rows: HarmonyRegressionRow[];
};

const MONTHLY_METRICS = [
  "qualifiedCouples", "contracts", "grossContracts", "canceledContracts",
  "netContracts", "cumulativeGrossContracts", "activeContracts",
  "returnedToInventory", "availableInventory", "sellOutRate", "grossSales",
  "recognizedRevenue", "variableCosts", "partnerShare", "taxes", "fixedCosts",
  "commercialOperationsCosts", "commissionPayments", "payroll", "capex",
  "preOperationalInvestment", "grossEntryGenerated", "grossEntrySettled",
  "grossReceivablesGenerated", "grossReceivablesSettled",
  "installmentCollections", "canceledReceivables", "delinquentBalance",
  "curedCollections", "writtenOffBalance", "healthyD90", "paymentFees",
  "netCollections", "cashOpening", "cashInflows", "cashOutflows",
  "contributionMargin", "operatingResult", "cashClosing",
  "operatingCashFlow", "cumulativeCashFlow", "discountedCashFlow",
] as const satisfies readonly (keyof MonthlyProjection)[];

const KPI_METRICS = [
  "capitalRequired", "npv", "irrAnnual", "paybackMonths", "sellOutMonth",
  "totalGrossContracts", "totalNetContracts", "delinquentBalance",
] as const satisfies readonly (keyof FinancialCalculation["kpis"])[];

function nonEmpty(value: string, field: string, conflictId: string) {
  if (!value.trim())
    throw new Error(`Conflito ${conflictId || "sem id"}: ${field} não pode ser vazio.`);
}

function validateConflicts(
  conflicts: readonly HarmonyRegressionConflict[],
  horizonMonths: number
) {
  const ids = new Set<string>();
  const cells = new Set<string>();
  const monthlyMetrics = new Set<string>(MONTHLY_METRICS);
  const kpiMetrics = new Set<string>(KPI_METRICS);
  const byCell = new Map<string, HarmonyRegressionConflict>();
  for (const conflict of conflicts) {
    nonEmpty(conflict.id, "id", conflict.id);
    nonEmpty(conflict.sourceRef, "sourceRef", conflict.id);
    nonEmpty(conflict.reason, "reason", conflict.id);
    nonEmpty(conflict.adoptedRule, "adoptedRule", conflict.id);
    nonEmpty(conflict.metric, "metric", conflict.id);
    if (conflict.classification !== "MODEL_DELTA" && conflict.classification !== "SOURCE_CONFLICT")
      throw new Error(`Conflito ${conflict.id} possui classificação inválida.`);
    if (ids.has(conflict.id)) throw new Error(`Conflito duplicado: ${conflict.id}.`);
    ids.add(conflict.id);
    if (conflict.month === null && kpiMetrics.has(conflict.metric)) {
      // KPI explícito, inclusive quando o mesmo nome também existe na série mensal.
    } else if (monthlyMetrics.has(conflict.metric)) {
      if (conflict.month === null)
        throw new Error(`Conflito ${conflict.id}: métrica mensal exige célula mensal explícita.`);
      if (!Number.isInteger(conflict.month) || conflict.month < 1 || conflict.month > horizonMonths)
        throw new Error(`Conflito ${conflict.id}: célula mensal inexistente.`);
    } else if (kpiMetrics.has(conflict.metric)) {
      if (conflict.month !== null)
        throw new Error(`Conflito ${conflict.id}: KPI deve usar month null.`);
    } else {
      throw new Error(`Conflito ${conflict.id}: métrica inexistente ${conflict.metric}.`);
    }
    const cell = `${conflict.metric}:${conflict.month === null ? "kpi" : conflict.month}`;
    if (cells.has(cell)) throw new Error(`Conflito duplicado para a célula ${cell}.`);
    cells.add(cell);
    byCell.set(cell, conflict);
  }
  return byCell;
}

function validateRegressionOrder(
  harmony: FinancialCalculation,
  tgr: FinancialCalculation
) {
  const firstIsHarmony =
    harmony.financialModelMode === "HARMONY_COMPAT_V1" &&
    harmony.formulaSetVersion === HARMONY_COMPAT_FORMULA_SET_V1.semanticVersion &&
    harmony.engineVersion === HARMONY_COMPAT_FORMULA_SET_V1.engineVersion;
  const secondIsCanonical =
    (tgr.financialModelMode === "TGR_CANONICAL_V2" || tgr.financialModelMode === undefined) &&
    tgr.formulaSetVersion === IGR_CORE_FORMULA_SET_V1.semanticVersion &&
    tgr.engineVersion === IGR_CORE_FORMULA_SET_V1.engineVersion;
  if (!firstIsHarmony || !secondIsCanonical)
    throw new Error(
      "A ordem exige primeiro cálculo Harmony e segundo cálculo canônico; modos iguais ou invertidos são inválidos."
    );
}

export function buildHarmonyTgrRegression(
  harmony: FinancialCalculation,
  tgr: FinancialCalculation,
  options: { tolerance: string; conflicts?: readonly HarmonyRegressionConflict[] }
): HarmonyRegressionReport {
  if (harmony.status !== "valid" || tgr.status !== "valid")
    throw new Error("A reconciliação exige dois cálculos válidos.");
  validateRegressionOrder(harmony, tgr);
  if (harmony.horizonMonths !== tgr.horizonMonths)
    throw new Error("A reconciliação exige horizontes iguais.");
  const tolerance = new Decimal(options.tolerance);
  if (!tolerance.isFinite()) throw new Error("A tolerância deve ser finita.");
  if (tolerance.isNegative()) throw new Error("A tolerância não pode ser negativa.");
  const conflicts = validateConflicts(options.conflicts ?? [], harmony.horizonMonths);
  const createRow = (
    scope: HarmonyRegressionRow["scope"], month: number | null, metric: string,
    harmonyValue: string | null, tgrValue: string | null
  ): HarmonyRegressionRow => {
    const delta = harmonyValue === null || tgrValue === null
      ? null
      : new Decimal(harmonyValue).minus(tgrValue).toFixed(8);
    const matches = delta !== null && new Decimal(delta).abs().lte(tolerance);
    const conflict = conflicts.get(`${metric}:${month === null ? "kpi" : month}`);
    if (conflict && matches)
      throw new Error(
        `Conflito ${conflict.id} aponta para MATCH dentro da tolerância.`
      );
    return {
      scope, month, metric, harmony: harmonyValue, tgr: tgrValue, delta,
      status: conflict ? conflict.classification : matches ? "MATCH" : "DELTA",
      ...(conflict ? {
        conflictId: conflict.id,
        justification: {
          sourceRef: conflict.sourceRef,
          reason: conflict.reason,
          adoptedRule: conflict.adoptedRule,
          classification: conflict.classification,
          ...(conflict.causalId ? { causalId: conflict.causalId } : {}),
        },
      } : {}),
    };
  };
  const monthly = harmony.projections.flatMap((harmonyMonth, index) => {
    const tgrMonth = tgr.projections[index];
    return MONTHLY_METRICS.map(metric => createRow(
      "monthly", harmonyMonth.month, metric,
      harmonyMonth[metric] as string | null,
      tgrMonth ? tgrMonth[metric] as string | null : null
    ));
  });
  const kpis = KPI_METRICS.map(metric =>
    createRow("kpi", null, metric, harmony.kpis[metric], tgr.kpis[metric])
  );
  return { tolerance: options.tolerance, monthly, kpis, rows: [...monthly, ...kpis] };
}

export type HarmonyRegressionConflictCause = {
  id: string;
  classification: HarmonyRegressionDifferenceStatus;
  sourceRef: string;
  reason: string;
  adoptedRule: string;
  metrics: string[];
  monthFrom: number | null;
  monthTo: number | null;
};

/** Expande causas conhecidas somente sobre células realmente divergentes. */
export function expandHarmonyRegressionConflicts(
  harmony: FinancialCalculation,
  tgr: FinancialCalculation,
  tolerance: string,
  causes: readonly HarmonyRegressionConflictCause[]
): HarmonyRegressionConflict[] {
  const bare = buildHarmonyTgrRegression(harmony, tgr, { tolerance });
  const ids = new Set<string>();
  for (const cause of causes) {
    for (const field of ["id", "sourceRef", "reason", "adoptedRule"] as const)
      nonEmpty(cause[field], field, cause.id);
    if (ids.has(cause.id)) throw new Error(`Causa duplicada: ${cause.id}.`);
    ids.add(cause.id);
    if (cause.classification !== "MODEL_DELTA" && cause.classification !== "SOURCE_CONFLICT")
      throw new Error(`Causa ${cause.id} possui classificação inválida.`);
    if (cause.metrics.length === 0) throw new Error(`Causa ${cause.id} não possui métricas.`);
    const isKpi = cause.monthFrom === null && cause.monthTo === null;
    const isMonthly = Number.isInteger(cause.monthFrom) && Number.isInteger(cause.monthTo) &&
      cause.monthFrom! >= 1 && cause.monthTo! >= cause.monthFrom! && cause.monthTo! <= harmony.horizonMonths;
    if (!isKpi && !isMonthly) throw new Error(`Causa ${cause.id} possui intervalo inválido.`);
  }
  return bare.rows
    .filter(row => row.status === "DELTA")
    .flatMap(row => {
      const matching = causes.filter(cause => {
        if (!cause.metrics.includes(row.metric)) return false;
        if (row.month === null)
          return cause.monthFrom === null && cause.monthTo === null;
        return cause.monthFrom !== null && cause.monthTo !== null &&
          row.month >= cause.monthFrom && row.month <= cause.monthTo;
      });
      if (matching.length === 0) return [];
      if (matching.length > 1)
        throw new Error(`Célula ${row.metric}@${row.month ?? "KPI"} tem causas ambíguas.`);
      const cause = matching[0]!;
      return [{
        id: `${cause.id}:${row.metric}:${row.month ?? "kpi"}`,
        classification: cause.classification,
        causalId: cause.id,
        sourceRef: cause.sourceRef,
        reason: cause.reason,
        adoptedRule: cause.adoptedRule,
        metric: row.metric,
        month: row.month,
      }];
    });
}

export function assertHarmonyRegressionReconciled(report: HarmonyRegressionReport): void {
  const unjustified = report.rows.filter(row => row.status === "DELTA");
  if (unjustified.length > 0) {
    const cells = unjustified.slice(0, 8)
      .map(row => `${row.metric}@${row.month ?? "KPI"}`).join(", ");
    throw new Error(
      `Reconciliação contém ${unjustified.length} DELTA sem justificativa: ${cells}.`
    );
  }
}

export type HarmonyKpiTarget = {
  target: string;
  absoluteTolerance: string;
  relativeTolerance: string;
  classification: string;
};

export type HarmonyKpiTargetConflict = {
  id: string;
  metric: string;
  sourceRef: string;
  reason: string;
  adoptedRule: string;
  causalConflictIds: string[];
};

export type HarmonyKpiTargetRow = {
  metric: string;
  target: string;
  obtained: string;
  absoluteDelta: string;
  relativeDelta: string;
  absoluteTolerance: string;
  relativeTolerance: string;
  status: "MATCH" | "SOURCE_CONFLICT";
  sourceRef?: string;
  reason?: string;
  adoptedRule?: string;
  causalConflictIds: string[];
};

/** Compara diretamente o cálculo com todos os targets executáveis do fixture. */
export function buildHarmonyKpiTargetRegression(
  calculation: FinancialCalculation,
  targets: Record<string, HarmonyKpiTarget>,
  declaredConflicts: readonly HarmonyKpiTargetConflict[]
): HarmonyKpiTargetRow[] {
  if (calculation.status !== "valid") throw new Error("Targets Harmony exigem cálculo válido.");
  if (calculation.financialModelMode !== "HARMONY_COMPAT_V1")
    throw new Error("Targets Harmony exigem cálculo no modo HARMONY_COMPAT_V1.");
  const conflictsByMetric = new Map<string, HarmonyKpiTargetConflict>();
  const conflictIds = new Set<string>();
  for (const conflict of declaredConflicts) {
    for (const field of ["id", "metric", "sourceRef", "reason", "adoptedRule"] as const)
      nonEmpty(conflict[field], field, conflict.id);
    if (conflictIds.has(conflict.id))
      throw new Error(`Conflito de target duplicado: ${conflict.id}.`);
    if (conflictsByMetric.has(conflict.metric))
      throw new Error(`Conflito de target duplicado para ${conflict.metric}.`);
    if (conflict.causalConflictIds.length === 0 || conflict.causalConflictIds.some(id => !id.trim()))
      throw new Error(`Conflito ${conflict.id} exige causalConflictIds.`);
    conflictIds.add(conflict.id);
    conflictsByMetric.set(conflict.metric, conflict);
  }
  const rows = Object.entries(targets).map(([metric, definition]) => {
    if (!KPI_METRICS.includes(metric as (typeof KPI_METRICS)[number]))
      throw new Error(`Target KPI inexistente: ${metric}.`);
    const obtainedText = calculation.kpis[metric as keyof FinancialCalculation["kpis"]];
    if (obtainedText === null) throw new Error(`Target ${metric} não possui resultado obtido.`);
    const target = new Decimal(definition.target);
    const obtained = new Decimal(obtainedText);
    const absoluteTolerance = new Decimal(definition.absoluteTolerance);
    const relativeTolerance = new Decimal(definition.relativeTolerance);
    if (!target.isFinite() || !obtained.isFinite() || !absoluteTolerance.isFinite() || !relativeTolerance.isFinite())
      throw new Error(`Target ${metric} exige números e tolerâncias finitas.`);
    if (absoluteTolerance.isNegative() || relativeTolerance.isNegative())
      throw new Error(`Target ${metric} possui tolerância negativa.`);
    const absoluteDelta = obtained.minus(target).abs();
    const relativeDelta = target.eq(0)
      ? absoluteDelta.eq(0) ? new Decimal(0) : new Decimal(Infinity)
      : absoluteDelta.div(target.abs());
    const matches = absoluteDelta.lte(absoluteTolerance) || relativeDelta.lte(relativeTolerance);
    const conflict = conflictsByMetric.get(metric);
    if (!matches && !conflict)
      throw new Error(`Target ${metric} tem DELTA fora da tolerância sem justificativa.`);
    if (matches && conflict)
      throw new Error(`Conflito ${conflict.id} não corresponde a DELTA fora da tolerância.`);
    return {
      metric, target: definition.target, obtained: obtainedText,
      absoluteDelta: absoluteDelta.toFixed(8),
      relativeDelta: relativeDelta.isFinite() ? relativeDelta.toFixed(8) : "Infinity",
      absoluteTolerance: definition.absoluteTolerance,
      relativeTolerance: definition.relativeTolerance,
      status: matches ? "MATCH" as const : "SOURCE_CONFLICT" as const,
      ...(conflict ? {
        sourceRef: conflict.sourceRef,
        reason: conflict.reason,
        adoptedRule: conflict.adoptedRule,
        causalConflictIds: conflict.causalConflictIds,
      } : { causalConflictIds: [] }),
    };
  });
  for (const metric of Array.from(conflictsByMetric.keys())) {
    if (!Object.prototype.hasOwnProperty.call(targets, metric))
      throw new Error(`Conflito declarado para target inexistente: ${metric}.`);
  }
  return rows;
}
