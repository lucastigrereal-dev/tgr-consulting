import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ data: null as unknown, loading: false }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    igr: {
      commercialOperations: {
        useQuery: () => ({
          data: state.data,
          isLoading: state.loading,
          isError: false,
          refetch: vi.fn(),
        }),
      },
      upsertCommercialOperations: {
        useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
      },
    },
  },
}));

vi.mock("@/components/ui/spinner", () => ({ Spinner: () => "loading" }));

import {
  CommercialOperationsBuilder,
  emptyCommercialOperationsDraft,
  emptyWorkforceCohort,
  toCommercialOperationsMutationInput,
} from "./CommercialOperationsBuilder";

describe("CommercialOperationsBuilder", () => {
  beforeEach(() => {
    state.data = null;
    state.loading = false;
  });

  it("apresenta os quatro blocos progressivos e não vende a operação pendente como pronta", () => {
    const html = renderToStaticMarkup(
      <CommercialOperationsBuilder versionId="version-1" />
    );

    expect(html).toContain("Operação comercial autoritativa");
    expect(html).toContain("1. Sala e capacidade");
    expect(html).toContain("2. Workforce por coortes");
    expect(html).toContain("3. Treinamento");
    expect(html).toContain("4. Políticas de comissão");
    expect(html).toContain("PENDENTE");
    expect(html).not.toContain("OPERAÇÃO INFORMADA");
    expect(html).toContain("Incremental adiciona o custo ao caixa");
    expect(html).toContain("Já incluído evita dupla contagem");
  });

  it("hidrata salas, workforce, treinamento, comissão e proveniência", () => {
    const draft = emptyCommercialOperationsDraft();
    draft.status = "provided";
    draft.sourceType = "current_document";
    draft.sourceRef = "Plano operacional 2026";
    draft.definition.room.rooms = [
      { roomId: "cotia-a", tables: "8", overflowTables: "2" },
      { roomId: "cotia-b", tables: "6", overflowTables: "1" },
    ];
    draft.definition.workforce.cohorts.push({
      cohortId: "closers-q1",
      role: "Closer",
      capacityUnit: "sales",
      headcount: "4",
      hireMonth: 1,
      trainingMonths: 1,
      certificationRate: "0.8",
      rampCurve: [
        { productiveAgeMonth: 0, productivityRate: "0.5" },
        { productiveAgeMonth: 1, productivityRate: "1" },
      ],
      matureProductivity: "12",
      absenteeismRate: "0.05",
      monthlyTurnoverRate: "0.03",
      fixedCompensation: "3500",
      burden: "2100",
      guarantee: "800",
      allowance: "500",
      replacementCost: "1200",
    });
    draft.definition.training.plans.push({
      trainingId: "closers-academy",
      role: "Closer",
      startMonth: 0,
      candidates: "10",
      classes: "1",
      durationMonths: 1,
      trainers: "1",
      trainerMonthlyCost: "5000",
      candidateMonthlySalary: "2000",
      monthlySupportCost: "1000",
      approvalRate: "0.8",
      certificationRate: "0.75",
      timeToProductiveMonths: 1,
      targetProductivePeople: "6",
    });
    draft.definition.commissions.policies.push({
      policyId: "closer-d90",
      role: "Closer",
      eligibleBase: "d90",
      mode: "percentage",
      fixedAmount: "0",
      percentageRate: "0.02",
      tiers: [{ fromAmount: "100000", rate: "0.03", accelerator: "1.1" }],
      guarantee: "500",
      cutoffDay: 20,
      paymentLagMonths: 1,
      qualityMultiplier: "0.9",
      holdbackRate: "0.1",
      reversalEnabled: true,
    });
    state.data = {
      record: {
        status: draft.status,
        sourceType: draft.sourceType,
        sourceRef: draft.sourceRef,
      },
      definition: draft.definition,
    };

    const html = renderToStaticMarkup(
      <CommercialOperationsBuilder versionId="version-1" />
    );

    expect(html).toContain('value="Plano operacional 2026"');
    expect(html).toContain('value="cotia-b"');
    expect(html).toContain('value="closers-q1"');
    expect(html).toContain('value="closers-academy"');
    expect(html).toContain('value="closer-d90"');
    expect(html).toContain("OPERAÇÃO INFORMADA");
  });

  it("produz um único payload sem converter decimais em float", () => {
    const draft = emptyCommercialOperationsDraft();
    draft.status = "provided";
    draft.sourceType = "current_decision";
    draft.sourceRef = "Comitê comercial 42";
    draft.definition.room.rooms[0] = {
      roomId: " room-a ",
      tables: "8",
      overflowTables: "1",
    };
    draft.definition.room.operatingHoursPerDay = "8.5";

    const result = toCommercialOperationsMutationInput("version-1", draft);

    expect(result.versionId).toBe("version-1");
    expect(result.status).toBe("provided");
    expect(result.sourceRef).toBe("Comitê comercial 42");
    expect(result.definition.room.rooms[0]).toEqual({
      roomId: "room-a",
      tables: "8",
      overflowTables: "1",
    });
    expect(result.definition.room.operatingHoursPerDay).toBe("8.5");
    expect(result.definition.room).not.toHaveProperty("plannedToursMonthly");
    expect(result.definition.room).not.toHaveProperty("plannedSalesMonthly");
    expect(result.definition.room).not.toHaveProperty("saleRate");
  });

  it("valida proveniência, IDs únicos, taxas e ramp mínimo M0/M1", () => {
    const draft = emptyCommercialOperationsDraft();
    draft.status = "provided";
    expect(() =>
      toCommercialOperationsMutationInput("version-1", draft)
    ).toThrow("Operação informada exige fonte ou responsável");

    draft.sourceRef = "Ata 42";
    draft.definition.room.peakFlowFactor = "-1";
    expect(() =>
      toCommercialOperationsMutationInput("version-1", draft)
    ).toThrow("Pico deve ser um decimal não negativo");

    draft.definition.room.peakFlowFactor = "1.5";
    draft.definition.workforce.cohorts.push({
      ...emptyWorkforceCohort(),
      cohortId: "vendas-q1",
      role: "Closer",
      rampCurve: [{ productiveAgeMonth: 0, productivityRate: "0.5" }],
    });
    expect(() =>
      toCommercialOperationsMutationInput("version-1", draft)
    ).toThrow("ramp deve conter ao menos M0 e M1");
  });

  it("desabilita edição e salvamento sem versão ativa", () => {
    const html = renderToStaticMarkup(
      <CommercialOperationsBuilder versionId="" />
    );
    expect(html).toContain("Selecione ou crie um projeto");
    expect(html).toMatch(
      /<button(?=[^>]*disabled="")[^>]*>[\s\S]*?Salvar operação<\/button>/
    );
  });
});
