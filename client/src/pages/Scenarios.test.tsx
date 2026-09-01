import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  formulaSetVersionId: "igr-core-formulas-v1-9",
  goalResult: null as null | {
    status:
      | "converged"
      | "unreachable"
      | "iteration_limit"
      | "unsupported"
      | "infeasible";
    targetKpi: string;
    variableKey: string;
    target: string;
    result: string | null;
    objectiveValue: string | null;
    residual: string | null;
    lowerBound: string;
    upperBound: string;
    iterations: number;
    reason?: string;
  },
}));

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    igr: {
      projects: {
        useQuery: () => ({
          data: [{ id: "project-1", name: "Projeto" }],
          isLoading: false,
          isError: false,
        }),
      },
      projectContext: {
        useQuery: () => ({
          data: {
            project: { id: "project-1" },
            workingVersion: null,
            versions: [
              {
                id: "review-1",
                state: "in_review",
                kind: "standard",
                isImmutable: false,
                formulaSetVersionId: state.formulaSetVersionId,
              },
            ],
          },
          isError: false,
          refetch: vi.fn(),
        }),
      },
      scenarioComparison: {
        useQuery: () => ({
          data: [],
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        }),
      },
      createScenario: {
        useMutation: () => ({
          isPending: false,
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
        }),
      },
      goalSeek: {
        useMutation: () => ({
          data: state.goalResult,
          isPending: false,
          mutate: vi.fn(),
        }),
      },
      applyGoalSeek: {
        useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
      },
      capitalEnvelope: {
        useQuery: () => ({ data: null, isFetching: false, refetch: vi.fn() }),
      },
    },
  },
}));

import Scenarios, {
  coerceAsOfMonthInput,
  createScenarioGoalSeekApplyPayload,
  selectGoalSeekDraftBranch,
  selectScenarioBaseVersion,
  type ScenarioVersionCandidate,
} from "./Scenarios";

describe("Scenarios", () => {
  beforeEach(() => {
    state.goalResult = null;
    state.formulaSetVersionId = "igr-core-formulas-v1-9";
  });

  it("prefere baseline, depois approved, in_review e por último draft como versão-base", () => {
    const versions: ScenarioVersionCandidate[] = [
      { id: "draft", state: "draft", kind: "scenario", isImmutable: false },
      {
        id: "review",
        state: "in_review",
        kind: "standard",
        isImmutable: false,
      },
      {
        id: "approved",
        state: "approved",
        kind: "standard",
        isImmutable: false,
      },
      {
        id: "baseline",
        state: "baseline",
        kind: "baseline",
        isImmutable: true,
      },
    ];
    expect(selectScenarioBaseVersion(versions)?.id).toBe("baseline");
    expect(selectScenarioBaseVersion(versions.slice(0, 3))?.id).toBe(
      "approved"
    );
    expect(selectScenarioBaseVersion(versions.slice(0, 2))?.id).toBe("review");
    expect(selectScenarioBaseVersion(versions.slice(0, 1))?.id).toBe("draft");
    expect(selectGoalSeekDraftBranch(versions)?.id).toBe("draft");
  });

  it("mantém criação de branch disponível quando o snapshot já moveu a versão para in_review", () => {
    const html = renderToStaticMarkup(<Scenarios />);
    expect(html).toContain("Criar branch auditável");
    expect(html).toContain("review-1");
    expect(html).not.toContain("Selecione um projeto com versão de trabalho");
  });

  it("oferece aplicação explícita somente para resultado convergido", () => {
    state.goalResult = {
      status: "unreachable",
      targetKpi: "npv",
      variableKey: "capexInitial",
      target: "0.00000000",
      result: null,
      objectiveValue: null,
      residual: null,
      lowerBound: "0.00000000",
      upperBound: "1000000000.00000000",
      iterations: 0,
    };
    expect(renderToStaticMarkup(<Scenarios />)).not.toContain(
      "Aplicar em branch"
    );

    state.goalResult = {
      ...state.goalResult,
      status: "converged",
      result: "42.00000000",
      objectiveValue: "0.00000000",
      residual: "0.00000000",
      iterations: 7,
    };
    expect(renderToStaticMarkup(<Scenarios />)).toContain("Aplicar em branch");
  });

  it("permite aplicar CAPEX no modo Harmony antes de criar branch", () => {
    state.formulaSetVersionId = "harmony-compat-formulas-v1";
    state.goalResult = {
      status: "converged",
      targetKpi: "npv",
      variableKey: "capexInitial",
      target: "0.00000000",
      result: "42.00000000",
      objectiveValue: "0.00000000",
      residual: "0.00000000",
      lowerBound: "0.00000000",
      upperBound: "1000000000.00000000",
      iterations: 7,
    };

    const html = renderToStaticMarkup(<Scenarios />);
    expect(html).toContain("HARMONY COMPAT V1");
    expect(html).toContain("Aplicar em branch");
  });

  it("bloqueia aplicação quando o resultado convergido não pertence à seleção atual", () => {
    state.goalResult = {
      status: "converged",
      targetKpi: "npv",
      variableKey: "conversionRate",
      target: "0.00000000",
      result: "0.42000000",
      objectiveValue: "0.00000000",
      residual: "0.00000000",
      lowerBound: "0.00000000",
      upperBound: "1.00000000",
      iterations: 7,
    };

    expect(renderToStaticMarkup(<Scenarios />)).not.toContain(
      "Aplicar em branch"
    );
  });

  it("normaliza o mês de referência para inteiro dentro do contrato", () => {
    expect(coerceAsOfMonthInput("1.9")).toBe(1);
    expect(coerceAsOfMonthInput("-3")).toBe(0);
    expect(coerceAsOfMonthInput("1201")).toBe(1200);
    expect(coerceAsOfMonthInput("")).toBe(0);
  });

  it("expõe targets e levers V1 no contrato visual", () => {
    const html = renderToStaticMarkup(<Scenarios />);
    expect(html).toContain("Vendas brutas");
    expect(html).toContain("Capital necessário");
    expect(html).toContain("Payback");
    expect(html).toContain("Entrada bruta");
    expect(html).toContain("Custo por Healthy D90");
    expect(html).toContain("Break-even por ponto");
    expect(html).toContain("Ticket médio");
    expect(html).toContain("Entrada por contrato");
  });

  it("mostra unsupported auditável sem liberar aplicação", () => {
    state.goalResult = {
      status: "unsupported",
      targetKpi: "pointBreakEven",
      variableKey: "averageTicket",
      target: "1.00000000",
      result: null,
      objectiveValue: null,
      residual: null,
      lowerBound: "0.00000000",
      upperBound: "100.00000000",
      iterations: 0,
      reason: "pointBreakEven não possui fórmula autoritativa no engine.",
    };

    const html = renderToStaticMarkup(<Scenarios />);
    expect(html).toContain("NÃO SUPORTADO");
    expect(html).toContain("não possui fórmula autoritativa");
    expect(html).not.toContain("Aplicar em branch");
  });

  it("preserva mês, horizonte e bounds exatos no payload de aplicação do Goal Seek", () => {
    const payload = createScenarioGoalSeekApplyPayload({
      targetVersionId: "draft-scenario-9",
      sourceVersionId: "base-version-8",
      horizonMonths: 120,
      asOfMonth: 11,
      selection: {
        targetKpi: "npv",
        variableKey: "conversionRate",
        target: "250000.00000000",
        lowerBound: "0.12000000",
        upperBound: "0.66000000",
      },
      result: {
        status: "converged",
        targetKpi: "npv",
        variableKey: "conversionRate",
        target: "250000.00000000",
        result: "0.42000000",
        objectiveValue: "250000.00000001",
        residual: "0.00000001",
        lowerBound: "0.12000000",
        upperBound: "0.66000000",
        iterations: 13,
      },
    });

    expect(payload).toEqual({
      targetVersionId: "draft-scenario-9",
      sourceVersionId: "base-version-8",
      variableKey: "conversionRate",
      value: "0.42000000",
      targetKpi: "npv",
      target: "250000.00000000",
      objectiveValue: "250000.00000001",
      residual: "0.00000001",
      iterations: 13,
      horizonMonths: 120,
      asOfMonth: 11,
      lowerBound: "0.12000000",
      upperBound: "0.66000000",
    });
  });
});
