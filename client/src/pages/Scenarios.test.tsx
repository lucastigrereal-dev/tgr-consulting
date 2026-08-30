import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  goalResult: null as null | {
    status: "converged" | "unreachable";
    variableKey: string;
    target: string;
    result: string | null;
    objectiveValue: string | null;
    residual: string | null;
    lowerBound: string;
    upperBound: string;
    iterations: number;
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
  selectGoalSeekDraftBranch,
  selectScenarioBaseVersion,
  type ScenarioVersionCandidate,
} from "./Scenarios";

describe("Scenarios", () => {
  beforeEach(() => {
    state.goalResult = null;
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
      variableKey: "qualifiedCouplesMonth1",
      target: "0.00000000",
      result: null,
      objectiveValue: null,
      residual: null,
      lowerBound: "0.00000000",
      upperBound: "100.00000000",
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
});
