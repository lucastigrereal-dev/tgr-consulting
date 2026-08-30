import { describe, expect, it } from "vitest";
import { calculateCapitalEnvelope, runGoalSeek } from "./goalseek";
import { FinanceDecimal } from "./engine";

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
});
