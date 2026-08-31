import { describe, expect, it } from "vitest";
import {
  calculateCapitalEnvelope,
  GOAL_SEEK_LEVERS,
  GOAL_SEEK_TARGETS,
  runGoalSeek,
  runGoalSeekV1,
} from "./goalseek";
import { FinanceDecimal } from "./engine";
import type { FinancialCalculation } from "./types";

const calculationWith = (
  kpis: Partial<FinancialCalculation["kpis"]>,
  projections: Array<Partial<FinancialCalculation["projections"][number]>> = []
) =>
  ({
    status: "valid",
    kpis,
    projections,
  }) as FinancialCalculation;

describe("Goal Seek e Capital Envelope", () => {
  it("encontra uma variável dentro dos bounds e informa resíduo", () => {
    const result = runGoalSeek({
      variableKey: "averageTicket",
      target: "100",
      lowerBound: "0",
      upperBound: "100",
      evaluate: candidate => candidate.times(new FinanceDecimal("2")),
    });
    expect(result.status).toBe("converged");
    expect(result.result).toBe("50.00000000");
    expect(result.residual).toBe("0.00000000");
    expect(result.lowerBound).toBe("0.00000000");
    expect(result.upperBound).toBe("100.00000000");
  });

  it("declara objetivo inalcançável em vez de inventar solução", () => {
    const result = runGoalSeek({
      variableKey: "conversionRate",
      target: "500",
      lowerBound: "0",
      upperBound: "100",
      evaluate: candidate => candidate.times(new FinanceDecimal("2")),
    });
    expect(result.status).toBe("unreachable");
    expect(result.result).toBeNull();
  });

  it("rejeita bounds invertidos antes de avaliar candidatos", () => {
    let evaluations = 0;
    expect(() =>
      runGoalSeek({
        variableKey: "conversionRate",
        target: "1",
        lowerBound: "2",
        upperBound: "1",
        evaluate: candidate => {
          evaluations += 1;
          return candidate;
        },
      })
    ).toThrow("limite inferior");
    expect(evaluations).toBe(0);
  });

  it("calcula capital necessário pela pior posição acumulada", () => {
    const result = calculateCapitalEnvelope("500", [
      { month: 1, cumulativeCashFlow: "-100.00000000" },
      { month: 2, cumulativeCashFlow: "-350.00000000" },
      { month: 3, cumulativeCashFlow: "25.00000000" },
    ] as never);
    expect(result.requiredCapital).toBe("350.00000000");
    expect(result.headroom).toBe("150.00000000");
    expect(result.limitingMonth).toBe(2);
  });

  it("publica registry V1 explícito de targets, levers, bounds e monotonicidade", () => {
    expect(Object.keys(GOAL_SEEK_TARGETS).sort()).toEqual([
      "capitalNeed",
      "costPerHealthyD90",
      "grossEntryGenerated",
      "grossSales",
      "healthyD90",
      "npv",
      "paybackMonths",
      "pointBreakEven",
      "totalOperatingCashFlow",
    ]);
    expect(GOAL_SEEK_TARGETS.paybackMonths).toMatchObject({
      supported: true,
      monotonicity: "decreasing",
    });
    expect(GOAL_SEEK_TARGETS.costPerHealthyD90).toMatchObject({
      supported: false,
    });
    expect(GOAL_SEEK_TARGETS.pointBreakEven).toMatchObject({
      supported: false,
    });
    expect(GOAL_SEEK_LEVERS.averageTicket).toMatchObject({
      lowerBound: "0.00000000",
      monotonicity: "increasing",
    });
    expect(GOAL_SEEK_LEVERS.conversionRate.upperBound).toBe("1.00000000");
    expect(GOAL_SEEK_TARGETS.grossSales.allowedVariables).toContain(
      "averageTicket"
    );
  });

  it("converge em target V1 descendente depois de provar monotonicidade", () => {
    const result = runGoalSeekV1({
      targetKpi: "paybackMonths",
      variableKey: "qualifiedCouplesMonth1",
      target: "4",
      lowerBound: "0",
      upperBound: "12",
      evaluate: candidate =>
        calculationWith({
          paybackMonths: new FinanceDecimal(10).minus(candidate).toFixed(8),
        }),
    });

    expect(result).toMatchObject({
      status: "converged",
      targetKpi: "paybackMonths",
      variableKey: "qualifiedCouplesMonth1",
      result: "6.00000000",
      objectiveValue: "4.00000000",
      residual: "0.00000000",
    });
  });

  it("retorna unsupported para target conhecido sem fórmula autoritativa", () => {
    const result = runGoalSeekV1({
      targetKpi: "pointBreakEven",
      variableKey: "qualifiedCouplesMonth1",
      target: "1",
      lowerBound: "0",
      upperBound: "10",
      evaluate: () => calculationWith({}),
    });

    expect(result).toMatchObject({
      status: "unsupported",
      result: null,
      objectiveValue: null,
      residual: null,
    });
    expect(result.reason).toContain("não possui fórmula autoritativa");
  });

  it("retorna infeasible quando o par target/lever não é permitido ou não é monotônico", () => {
    const disallowed = runGoalSeekV1({
      targetKpi: "grossEntryGenerated",
      variableKey: "fixedCostMonthly",
      target: "100",
      lowerBound: "0",
      upperBound: "1000",
      evaluate: () =>
        calculationWith({
          grossEntryGenerated: "100.00000000",
        }),
    });
    expect(disallowed).toMatchObject({
      status: "infeasible",
      result: null,
    });
    expect(disallowed.reason).toContain("não é autorizada");

    const nonMonotonic = runGoalSeekV1({
      targetKpi: "grossSales",
      variableKey: "averageTicket",
      target: "0",
      lowerBound: "0",
      upperBound: "10",
      evaluate: candidate =>
        calculationWith({
          grossSales: candidate.minus(5).pow(2).toFixed(8),
        }),
    });
    expect(nonMonotonic).toMatchObject({
      status: "infeasible",
      result: null,
    });
    expect(nonMonotonic.reason).toContain("monotonicidade");
  });
});
