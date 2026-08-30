import type Decimal from "decimal.js";
import { FinanceDecimal } from "./engine";
import type {
  CapitalEnvelopeResult,
  DecimalText,
  GoalSeekResult,
  MonthlyProjection,
} from "./types";

const ZERO = new FinanceDecimal("0");

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
      lowerBound: lower.toFixed(8),
      upperBound: upper.toFixed(8),
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
        lowerBound: lower.toFixed(8),
        upperBound: upper.toFixed(8),
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
    lowerBound: lower.toFixed(8),
    upperBound: upper.toFixed(8),
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
