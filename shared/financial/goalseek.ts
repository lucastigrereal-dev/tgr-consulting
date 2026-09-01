import type Decimal from "decimal.js";
import { FinanceDecimal } from "./engine";
import type {
  CapitalEnvelopeResult,
  DecimalText,
  FinancialCalculation,
  GoalSeekResult,
  MonthlyProjection,
} from "./types";

const ZERO = new FinanceDecimal("0");

export const GOAL_SEEK_LEVERS = {
  qualifiedCouplesMonth1: {
    label: "Casais qualificados - mês 1",
    lowerBound: "0.00000000",
    upperBound: "100000.00000000",
    monotonicity: "increasing",
  },
  qualifiedCouplesGrowthRate: {
    label: "Crescimento de qualificados",
    lowerBound: "0.00000000",
    upperBound: "5.00000000",
    monotonicity: "increasing",
  },
  conversionRate: {
    label: "Conversão",
    lowerBound: "0.00000000",
    upperBound: "1.00000000",
    monotonicity: "increasing",
  },
  averageTicket: {
    label: "Ticket médio",
    lowerBound: "0.00000000",
    upperBound: "1000000000.00000000",
    monotonicity: "increasing",
  },
  entryValuePerContract: {
    label: "Entrada por contrato",
    lowerBound: "0.00000000",
    upperBound: "1000000000.00000000",
    monotonicity: "increasing",
  },
  fixedCostMonthly: {
    label: "Custo fixo mensal",
    lowerBound: "0.00000000",
    upperBound: "1000000000.00000000",
    monotonicity: "decreasing",
  },
  payrollMonthly: {
    label: "Folha mensal",
    lowerBound: "0.00000000",
    upperBound: "1000000000.00000000",
    monotonicity: "decreasing",
  },
  variableCostRate: {
    label: "Custo variavel",
    lowerBound: "0.00000000",
    upperBound: "1.00000000",
    monotonicity: "decreasing",
  },
  partnerShareRate: {
    label: "Repasse parceiro",
    lowerBound: "0.00000000",
    upperBound: "1.00000000",
    monotonicity: "decreasing",
  },
  capexInitial: {
    label: "CAPEX inicial",
    lowerBound: "0.00000000",
    upperBound: "1000000000.00000000",
    monotonicity: "decreasing",
  },
} as const satisfies Record<string, {
  label: string;
  lowerBound: DecimalText;
  upperBound: DecimalText;
  monotonicity: "increasing" | "decreasing";
}>;

export type GoalSeekVariableKey = keyof typeof GOAL_SEEK_LEVERS;
type GoalSeekMonotonicity = "increasing" | "decreasing" | "dynamic";

export const GOAL_SEEK_TARGETS = {
  grossSales: {
    label: "Vendas brutas",
    supported: true,
    formulaId: "gross-sales",
    monotonicity: "increasing",
    allowedVariables: ["qualifiedCouplesMonth1", "conversionRate", "averageTicket"],
  },
  npv: {
    label: "VPL",
    supported: true,
    formulaId: "npv",
    monotonicity: "dynamic",
    allowedVariables: [
      "qualifiedCouplesMonth1",
      "qualifiedCouplesGrowthRate",
      "conversionRate",
      "averageTicket",
      "entryValuePerContract",
      "fixedCostMonthly",
      "payrollMonthly",
      "variableCostRate",
      "partnerShareRate",
      "capexInitial",
    ],
  },
  totalOperatingCashFlow: {
    label: "Caixa operacional",
    supported: true,
    formulaId: "operating-cash-flow",
    monotonicity: "dynamic",
    allowedVariables: [
      "qualifiedCouplesMonth1",
      "qualifiedCouplesGrowthRate",
      "conversionRate",
      "averageTicket",
      "entryValuePerContract",
      "fixedCostMonthly",
      "payrollMonthly",
      "variableCostRate",
      "partnerShareRate",
      "capexInitial",
    ],
  },
  capitalNeed: {
    label: "Capital necessário",
    supported: true,
    formulaId: "maximum-capital-requirement",
    monotonicity: "dynamic",
    allowedVariables: [
      "qualifiedCouplesMonth1",
      "qualifiedCouplesGrowthRate",
      "conversionRate",
      "averageTicket",
      "entryValuePerContract",
      "fixedCostMonthly",
      "payrollMonthly",
      "variableCostRate",
      "partnerShareRate",
      "capexInitial",
    ],
  },
  paybackMonths: {
    label: "Payback",
    supported: true,
    formulaId: "payback",
    monotonicity: "decreasing",
    allowedVariables: [
      "qualifiedCouplesMonth1",
      "qualifiedCouplesGrowthRate",
      "conversionRate",
      "averageTicket",
      "entryValuePerContract",
    ],
  },
  healthyD90: {
    label: "Healthy D90",
    supported: true,
    formulaId: "healthy-d90",
    monotonicity: "increasing",
    allowedVariables: ["qualifiedCouplesMonth1", "conversionRate"],
  },
  costPerHealthyD90: {
    label: "Custo por Healthy D90",
    supported: false,
    reason: "costPerHealthyD90 não possui fórmula autoritativa no engine.",
    monotonicity: "dynamic",
    allowedVariables: [],
  },
  grossEntryGenerated: {
    label: "Entrada bruta",
    supported: true,
    formulaId: "gross-entry-generated",
    monotonicity: "increasing",
    allowedVariables: ["qualifiedCouplesMonth1", "conversionRate", "entryValuePerContract"],
  },
  pointBreakEven: {
    label: "Break-even por ponto",
    supported: false,
    reason: "pointBreakEven não possui fórmula autoritativa agregada no engine.",
    monotonicity: "dynamic",
    allowedVariables: [],
  },
} as const satisfies Record<string, {
  label: string;
  supported: boolean;
  formulaId?: string;
  reason?: string;
  monotonicity: GoalSeekMonotonicity;
  allowedVariables: readonly GoalSeekVariableKey[];
}>;

export type GoalSeekTargetKey = keyof typeof GOAL_SEEK_TARGETS;

export const GOAL_SEEK_TARGET_KEYS = Object.keys(
  GOAL_SEEK_TARGETS
) as GoalSeekTargetKey[];
export const GOAL_SEEK_LEVER_KEYS = Object.keys(
  GOAL_SEEK_LEVERS
) as GoalSeekVariableKey[];

function normalizeBounds(params: {
  variableKey: GoalSeekVariableKey;
  lowerBound: DecimalText;
  upperBound: DecimalText;
}) {
  const lower = new FinanceDecimal(params.lowerBound);
  const upper = new FinanceDecimal(params.upperBound);
  if (!lower.isFinite() || !upper.isFinite()) {
    throw new Error("Os limites do Goal Seek devem ser decimais finitos.");
  }
  if (lower.gt(upper)) {
    throw new Error("O limite inferior não pode ser maior que o limite superior.");
  }
  const lever = GOAL_SEEK_LEVERS[params.variableKey];
  const min = new FinanceDecimal(lever.lowerBound);
  const max = new FinanceDecimal(lever.upperBound);
  if (lower.lt(min) || upper.gt(max)) {
    throw new Error(
      `Os limites de ${params.variableKey} devem ficar entre ${min.toString()} e ${max.toString()}.`
    );
  }
  return { lower, upper };
}

function stoppedResult(params: {
  status: "unsupported" | "infeasible";
  targetKpi: GoalSeekTargetKey;
  variableKey: GoalSeekVariableKey;
  target: DecimalText;
  lowerBound: DecimalText;
  upperBound: DecimalText;
  reason: string;
}): GoalSeekResult {
  const target = new FinanceDecimal(params.target);
  return {
    status: params.status,
    targetKpi: params.targetKpi,
    variableKey: params.variableKey,
    target: target.toFixed(8),
    result: null,
    objectiveValue: null,
    residual: null,
    lowerBound: new FinanceDecimal(params.lowerBound).toFixed(8),
    upperBound: new FinanceDecimal(params.upperBound).toFixed(8),
    iterations: 0,
    reason: params.reason,
  };
}

function capitalNeedFromProjections(projections: MonthlyProjection[]) {
  let minimum = ZERO;
  for (const projection of projections) {
    const cumulative = new FinanceDecimal(projection.cumulativeCashFlow);
    if (cumulative.lt(minimum)) minimum = cumulative;
  }
  return minimum.abs();
}

function readTargetValue(
  calculation: FinancialCalculation,
  targetKpi: GoalSeekTargetKey
): InstanceType<typeof FinanceDecimal> | null {
  if (calculation.status !== "valid") return null;
  switch (targetKpi) {
    case "capitalNeed":
      return capitalNeedFromProjections(calculation.projections);
    case "costPerHealthyD90":
    case "pointBreakEven":
      return null;
    default: {
      const value = calculation.kpis[targetKpi];
      return value === null || value === undefined
        ? null
        : new FinanceDecimal(value);
    }
  }
}

function observedMonotonicity(values: readonly InstanceType<typeof FinanceDecimal>[]) {
  const [lower, middle, upper] = values;
  if (!lower || !middle || !upper) return "none";
  if (lower.lte(middle) && middle.lte(upper)) return "increasing";
  if (lower.gte(middle) && middle.gte(upper)) return "decreasing";
  return "none";
}

export function runGoalSeekV1(params: {
  targetKpi: GoalSeekTargetKey;
  variableKey: GoalSeekVariableKey;
  target: DecimalText;
  lowerBound: DecimalText;
  upperBound: DecimalText;
  tolerance?: DecimalText;
  maxIterations?: number;
  evaluate: (candidate: Decimal) => FinancialCalculation;
}): GoalSeekResult {
  const targetDefinition = GOAL_SEEK_TARGETS[params.targetKpi];
  const { lower, upper } = normalizeBounds(params);
  if (!targetDefinition.supported) {
    return stoppedResult({
      status: "unsupported",
      targetKpi: params.targetKpi,
      variableKey: params.variableKey,
      target: params.target,
      lowerBound: lower.toFixed(8),
      upperBound: upper.toFixed(8),
      reason:
        targetDefinition.reason ??
        `${params.targetKpi} não possui fórmula autoritativa no engine.`,
    });
  }
  if (
    !(targetDefinition.allowedVariables as readonly GoalSeekVariableKey[]).includes(
      params.variableKey
    )
  ) {
    return stoppedResult({
      status: "infeasible",
      targetKpi: params.targetKpi,
      variableKey: params.variableKey,
      target: params.target,
      lowerBound: lower.toFixed(8),
      upperBound: upper.toFixed(8),
      reason: `${params.variableKey} não é autorizada para o target ${params.targetKpi}.`,
    });
  }

  const midpoint = lower.plus(upper).div(2);
  const probeValues = [lower, midpoint, upper].map(candidate =>
    readTargetValue(params.evaluate(candidate), params.targetKpi)
  );
  if (probeValues.some(value => value === null)) {
    return stoppedResult({
      status: "unsupported",
      targetKpi: params.targetKpi,
      variableKey: params.variableKey,
      target: params.target,
      lowerBound: lower.toFixed(8),
      upperBound: upper.toFixed(8),
      reason: `${params.targetKpi} não é calculável para esta versão.`,
    });
  }
  const direction = observedMonotonicity(
    probeValues as InstanceType<typeof FinanceDecimal>[]
  );
  if (
    direction === "none" ||
    (targetDefinition.monotonicity !== "dynamic" &&
      direction !== targetDefinition.monotonicity)
  ) {
    return stoppedResult({
      status: "infeasible",
      targetKpi: params.targetKpi,
      variableKey: params.variableKey,
      target: params.target,
      lowerBound: lower.toFixed(8),
      upperBound: upper.toFixed(8),
      reason: `Não foi possível provar monotonicidade adequada para ${params.targetKpi} variando ${params.variableKey}.`,
    });
  }

  const result = runGoalSeek({
    variableKey: params.variableKey,
    target: params.target,
    lowerBound: lower.toFixed(8),
    upperBound: upper.toFixed(8),
    tolerance: params.tolerance,
    maxIterations: params.maxIterations,
    evaluate: candidate => {
      const value = readTargetValue(params.evaluate(candidate), params.targetKpi);
      if (value === null) {
        throw new Error(`${params.targetKpi} não é calculável para esta versão.`);
      }
      return value;
    },
  });
  return { ...result, targetKpi: params.targetKpi };
}

export function runGoalSeek(params: {
  variableKey: string;
  target: DecimalText;
  lowerBound: DecimalText;
  upperBound: DecimalText;
  tolerance?: DecimalText;
  maxIterations?: number;
  evaluate: (candidate: Decimal) => Decimal;
}): GoalSeekResult {
  const target = new FinanceDecimal(params.target);
  let lower = new FinanceDecimal(params.lowerBound);
  let upper = new FinanceDecimal(params.upperBound);
  const requestedLowerBound = lower.toFixed(8);
  const requestedUpperBound = upper.toFixed(8);
  const tolerance = new FinanceDecimal(params.tolerance ?? "0.0001");
  const maxIterations = params.maxIterations ?? 100;
  if (lower.gt(upper))
    throw new Error(
      "O limite inferior não pode ser maior que o limite superior."
    );
  let lowerResidual = params.evaluate(lower).minus(target);
  let upperResidual = params.evaluate(upper).minus(target);
  if (lowerResidual.times(upperResidual).gt(ZERO)) {
    return {
      status: "unreachable",
      variableKey: params.variableKey,
      target: target.toFixed(8),
      result: null,
      objectiveValue: null,
      residual: null,
      lowerBound: requestedLowerBound,
      upperBound: requestedUpperBound,
      iterations: 0,
    };
  }

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const candidate = lower.plus(upper).div(2);
    const objectiveValue = params.evaluate(candidate);
    const residual = objectiveValue.minus(target);
    if (residual.abs().lte(tolerance)) {
      return {
        status: "converged",
        variableKey: params.variableKey,
        target: target.toFixed(8),
        result: candidate.toFixed(8),
        objectiveValue: objectiveValue.toFixed(8),
        residual: residual.toFixed(8),
        lowerBound: requestedLowerBound,
        upperBound: requestedUpperBound,
        iterations: iteration,
      };
    }
    if (lowerResidual.times(residual).lte(ZERO)) {
      upper = candidate;
      upperResidual = residual;
    } else {
      lower = candidate;
      lowerResidual = residual;
    }
  }

  const result = lower.plus(upper).div(2);
  const objectiveValue = params.evaluate(result);
  const residual = objectiveValue.minus(target);
  return {
    status: "iteration_limit",
    variableKey: params.variableKey,
    target: target.toFixed(8),
    result: result.toFixed(8),
    objectiveValue: objectiveValue.toFixed(8),
    residual: residual.toFixed(8),
    lowerBound: requestedLowerBound,
    upperBound: requestedUpperBound,
    iterations: maxIterations,
  };
}

export function calculateCapitalEnvelope(
  availableCapital: DecimalText,
  projections: MonthlyProjection[]
): CapitalEnvelopeResult {
  let minimum = ZERO;
  let limitingMonth: number | null = null;
  for (const projection of projections) {
    const cumulative = new FinanceDecimal(projection.cumulativeCashFlow);
    if (cumulative.lt(minimum)) {
      minimum = cumulative;
      limitingMonth = projection.month;
    }
  }
  const requiredCapital = minimum.abs();
  const available = new FinanceDecimal(availableCapital);
  return {
    availableCapital: available.toFixed(8),
    requiredCapital: requiredCapital.toFixed(8),
    headroom: available.minus(requiredCapital).toFixed(8),
    minimumCumulativeCashFlow: minimum.toFixed(8),
    limitingMonth,
  };
}
