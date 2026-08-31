import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateFinancialProjection } from "@shared/financial/engine";
import { calculateCommercialOperations } from "@shared/financial/commercialOperations";
import { calculatePointEconomics } from "@shared/financial/pointEconomics";
import type { FinancialCalculation, FinancialInputSnapshot } from "@shared/financial/types";
import { LIVE_DOCUMENT_CHAPTERS } from "@/lib/liveDocumentStructure";

const state = vi.hoisted(() => ({
  calculation: null as FinancialCalculation | null,
  workingVersion: { id: "version-1" } as { id: string } | null,
  goalSeekResult: null as {
    status: string;
    targetKpi: string;
    variableKey: string;
    target: string;
    lowerBound: string;
    upperBound: string;
    result: string | null;
    objectiveValue: string | null;
    residual: string | null;
    iterations: number;
    reason?: string | null;
  } | null,
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "lucas" } }) }));
vi.mock("wouter", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ igr: { projects: { invalidate: async () => undefined } } }),
    igr: {
      projects: { useQuery: () => ({ data: [{ id: "project-1", name: "Estudo de Teste" }], isLoading: false, isError: false }) },
      projectContext: {
        useQuery: () => ({
          data: {
            latestSnapshot: { id: "snapshot-1", projectVersionId: "version-1", snapshotHash: "abc12345", isAuthoritative: true, payload: state.calculation },
            latestApproval: null,
            project: { status: "draft" },
            workingVersion: state.workingVersion,
            latestImpact: { changedInputKeys: [] },
            snapshotHistory: [{ id: "snapshot-1", calculationStatus: "valid", missingInputKeys: [] }],
          },
          isLoading: false,
          isError: false,
          refetch: async () => undefined,
        }),
      },
      versionInputs: {
        useQuery: ({ versionId }: { versionId: string }) => ({
          data: versionId ? { preOperationMonths: { status: "provided", value: "0" } } : undefined,
        }),
      },
      builderComponents: {
        useQuery: ({ versionId }: { versionId: string }) => ({
          data: versionId ? [{ componentType: "project_assembly", payload: { nomeProjeto: "Estudo de Teste", praca: "Cotia", inicioOperacao: "01/2027", totalApartamentos: "40", cotasPorApartamento: "13" } }] : undefined,
        }),
      },
      exportEligibility: { useQuery: () => ({ data: { eligible: false }, refetch: async () => undefined }) },
      approveSnapshot: { useMutation: () => ({ isPending: false, mutate: () => undefined }) },
      freezeBaseline: { useMutation: () => ({ isPending: false, mutate: () => undefined }) },
      requestExport: { useMutation: () => ({ isPending: false, mutate: () => undefined }) },
      simulateCaptadores: { useMutation: () => ({ isPending: false, mutate: () => undefined }) },
      goalSeek: { useMutation: () => ({ isPending: false, mutate: () => undefined, data: state.goalSeekResult }) },
      createScenario: { useMutation: () => ({ isPending: false, mutateAsync: async () => ({ versionId: "goal-branch-1" }) }) },
      applyGoalSeek: { useMutation: () => ({ isPending: false, mutateAsync: async () => ({ versionId: "goal-branch-1" }) }) },
    },
  },
}));

import Boardroom, {
  canApplyBoardroomGoalSeekResult,
  createBoardroomGoalSeekApplyPayload,
  type BoardroomGoalSeekResult,
  type BoardroomGoalSeekSelection,
} from "./Boardroom";

const provided = (value: string) => ({ status: "provided" as const, value, sourceType: "assumption" as const, sourceRef: "boardroom-ui-test" });
const pending = () => ({ status: "pending" as const, sourceType: "assumption" as const, sourceRef: "boardroom-ui-test" });
const inputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("100"), qualifiedCouplesGrowthRate: provided("0"), conversionRate: provided("0.1"), averageTicket: provided("1000"), collectionRate: provided("0.8"), cancellationRate: provided("0.1"), variableCostRate: provided("0.2"), partnerShareRate: provided("0.05"), fixedCostMonthly: provided("1000"), payrollMonthly: provided("1000"), capexInitial: provided("5000"), preOperationMonths: provided("0"), entryValuePerContract: provided("100"), paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"), paymentCardInstallmentMixRate: provided("0"), paymentCardInstallmentMdrRate: provided("0"), paymentCardInstallmentSettlementDays: provided("0"), paymentDebitMixRate: provided("0"), paymentDebitMdrRate: provided("0"), paymentDebitSettlementDays: provided("0"), paymentRecurringChequeMixRate: provided("0"), paymentRecurringChequeMdrRate: provided("0"), paymentRecurringChequeSettlementDays: provided("0"), paymentBoletoMixRate: provided("0"), paymentBoletoMdrRate: provided("0"), paymentBoletoSettlementDays: provided("0"), discountRateAnnual: provided("0.12"), capexAcquisitionShareRate: pending(), capexAcquisitionMonth: pending(), capexSalesRoomShareRate: pending(), capexSalesRoomMonth: pending(), capexSalesKitShareRate: pending(), capexSalesKitMonth: pending(),
};

const pointEconomics = calculatePointEconomics({
  points: [
    {
      pointId: "cotia-mall",
      name: "Quiosque Cotia Mall",
      channel: "Shopping",
      activationCost: "12000",
      monthlyFixedCost: "4000",
      costPerSale: "250",
      approaches: "1000",
      researchRate: "0.5",
      qualificationRate: "0.4",
      invitationRate: "0.8",
      appointmentRate: "0.75",
      showRate: "0.8",
      tourRate: "0.5",
      saleRate: "0.2",
      averageTicket: "1000",
      averageEntry: "100",
      contributionMarginRate: "0.75",
      healthyD90Rate: "0.8",
      cannibalizationRate: "0.1",
      cashflowTreatment: "incremental",
    },
  ],
});

const commercialOperations = calculateCommercialOperations({
  horizonMonths: 2,
  pointDemand: { toursMonthly: "100", salesMonthly: "10" },
  definition: {
    room: {
      rooms: [{ roomId: "sala-cotia", tables: "2", overflowTables: "0" }],
      operatingDaysPerMonth: "20",
      operatingHoursPerDay: "8",
      shifts: "2",
      averageTourDurationMinutes: "60",
      toursPerTable: "1",
      receptionists: "1",
      receptionCapacityPerPerson: "200",
      consultants: "1",
      consultantCapacityPerPerson: "50",
      closers: "1",
      closerSalesCapacityPerPerson: "20",
      peakFlowFactor: "1",
      maxWaitMinutes: "15",
    },
    workforce: {
      cashflowTreatment: "incremental",
      cohorts: [
        { cohortId: "consultants", role: "consultant", capacityUnit: "tours", headcount: "1", hireMonth: 0, trainingMonths: 0, certificationRate: "1", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }], matureProductivity: "80", absenteeismRate: "0", monthlyTurnoverRate: "0", fixedCompensation: "100", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0" },
        { cohortId: "closers", role: "closer", capacityUnit: "sales", headcount: "1", hireMonth: 0, trainingMonths: 0, certificationRate: "1", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }], matureProductivity: "8", absenteeismRate: "0", monthlyTurnoverRate: "0", fixedCompensation: "200", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0" },
      ],
    },
    training: {
      cashflowTreatment: "incremental",
      plans: [{ trainingId: "academy", role: "closer", startMonth: 0, candidates: "2", classes: "1", durationMonths: 1, trainers: "1", trainerMonthlyCost: "50", candidateMonthlySalary: "25", monthlySupportCost: "0", approvalRate: "1", certificationRate: "1", timeToProductiveMonths: 0, targetProductivePeople: "2" }],
    },
    commissions: {
      cashflowTreatment: "incremental",
      policies: [
        { policyId: "closer-fixed", role: "closer", eligibleBase: "fixed", mode: "fixed", fixedAmount: "10", percentageRate: "0", tiers: [], guarantee: "0", cutoffDay: 15, paymentLagMonths: 0, qualityMultiplier: "1", holdbackRate: "0", reversalEnabled: false },
      ],
    },
  },
});

describe("Boardroom · trilha editorial", () => {
  beforeEach(() => {
    state.calculation = null;
    state.workingVersion = { id: "version-1" };
    state.goalSeekResult = null;
  });

  it("renderiza um snapshot calculado com origem ficha-mãe e fórmulas versionadas nos capítulos do estudo", () => {
    const calculation = calculateFinancialProjection(inputs, 24);
    expect(calculation.status).toBe("valid");
    if (calculation.status !== "valid") return;
    state.calculation = calculation;

    const html = renderToStaticMarkup(<Boardroom />);
    expect(html).toContain('data-boardroom-shell="premium"');
    for (const chapter of LIVE_DOCUMENT_CHAPTERS) {
      expect(html).toContain(chapter.href.slice(1));
      expect(html).toContain(chapter.title.replaceAll("&", "&amp;"));
    }
    expect(html).toContain("Página 01 · Executive Summary");
    expect(html).toContain("Origem: ficha-mãe e premissas autoritativas");
    expect(html).toContain("Página 05 · Captation");
    expect(html).toContain("gross-sales · v1.2.0");
    expect(html).toContain("Página 10 · Payment Mix");
    expect(html).toContain("gross-receivables-generated · v1.0.0");
    expect(html).toContain("installment-collections · v1.1.0");
    expect(html).toContain("healthy-d90 · v1.0.0");
    expect(html).toContain("Saldo inadimplente");
    expect(html).toContain("net-entry-collections · v1.3.0");
    expect(html).toContain("Página 09 · Costs");
    expect(html).toContain("Página 13 · Capital");
    expect(html).toContain("Demonstrativo vivo");
    expect(html).toContain("Simulação de reunião");
    expect(html).toContain("Goal Seek de reunião");
    expect(html).toContain("Executar Goal Seek");
    expect(html).toContain("Decision panel");
    expect(html).toContain("operating-cash-flow · v1.2.0");
  });

  it("só libera aplicação auditável de Goal Seek quando o resultado convergiu e bate com a seleção", () => {
    const selection: BoardroomGoalSeekSelection = {
      targetKpi: "npv",
      variableKey: "qualifiedCouplesMonth1",
      target: "100000.00000000",
      lowerBound: "0.00000000",
      upperBound: "100000.00000000",
    };
    const converged: BoardroomGoalSeekResult = {
      ...selection,
      status: "converged",
      result: "120.00000000",
      objectiveValue: "100000.00000001",
      residual: "0.00000001",
      iterations: 14,
    };

    expect(canApplyBoardroomGoalSeekResult(converged, selection)).toBe(true);
    expect(canApplyBoardroomGoalSeekResult({ ...converged, status: "infeasible", reason: "Meta fora do intervalo." }, selection)).toBe(false);
    expect(canApplyBoardroomGoalSeekResult({ ...converged, target: "200000.00000000" }, selection)).toBe(false);
  });

  it("mostra status, reason e aplicação em branch auditável para Goal Seek convergido", () => {
    const calculation = calculateFinancialProjection(inputs, 24);
    expect(calculation.status).toBe("valid");
    if (calculation.status !== "valid") return;
    state.calculation = calculation;
    state.goalSeekResult = {
      status: "converged",
      targetKpi: "npv",
      variableKey: "qualifiedCouplesMonth1",
      target: "0.00000000",
      lowerBound: "0.00000000",
      upperBound: "100000.00000000",
      result: "120.00000000",
      objectiveValue: "1.00000000",
      residual: "0.00000000",
      iterations: 9,
      reason: "Convergência encontrada.",
    };

    const html = renderToStaticMarkup(<Boardroom />);

    expect(html).toContain("Goal Seek de reunião");
    expect(html).toContain("CONVERGIU");
    expect(html).toContain("Convergência encontrada.");
    expect(html).toContain("Casais qualificados - mês 1");
    expect(html).toContain("120.00000000");
    expect(html).toContain("Aplicar em branch auditável");
  });

  it("preserva horizonte do snapshot, mês autoritativo e bounds exatos no payload de aplicação", () => {
    const payload = createBoardroomGoalSeekApplyPayload({
      targetVersionId: "boardroom-branch-3",
      sourceVersionId: "snapshot-version-2",
      horizonMonths: 37,
      asOfMonth: 4,
      selection: {
        targetKpi: "totalOperatingCashFlow",
        variableKey: "averageTicket",
        target: "500000.00000000",
        lowerBound: "900.00000000",
        upperBound: "2800.00000000",
      },
      result: {
        status: "converged",
        targetKpi: "totalOperatingCashFlow",
        variableKey: "averageTicket",
        target: "500000.00000000",
        lowerBound: "900.00000000",
        upperBound: "2800.00000000",
        result: "1850.00000000",
        objectiveValue: "500000.00000002",
        residual: "0.00000002",
        iterations: 17,
      },
    });

    expect(payload).toEqual({
      targetVersionId: "boardroom-branch-3",
      sourceVersionId: "snapshot-version-2",
      variableKey: "averageTicket",
      value: "1850.00000000",
      targetKpi: "totalOperatingCashFlow",
      target: "500000.00000000",
      objectiveValue: "500000.00000002",
      residual: "0.00000002",
      iterations: 17,
      horizonMonths: 37,
      asOfMonth: 4,
      lowerBound: "900.00000000",
      upperBound: "2800.00000000",
    });
  });

  it("mostra estados vazios honestos para capítulos sem domínio autoritativo", () => {
    const calculation = calculateFinancialProjection(inputs, 24);
    expect(calculation.status).toBe("valid");
    if (calculation.status !== "valid") return;
    state.calculation = calculation;

    const html = renderToStaticMarkup(<Boardroom />);

    expect(html).toContain("Market / ICP sem componente autoritativo");
    expect(html).toContain("Point Economics ainda não informado");
    expect(html).toContain("Sales Room ainda não informado");
    expect(html).toContain("Workforce ainda não informado");
    expect(html).toContain("Risk panel");
    expect(html).toContain("Decision panel");
  });

  it("usa a versão do snapshot quando não há working version ativa", () => {
    const calculation = calculateFinancialProjection(inputs, 24);
    expect(calculation.status).toBe("valid");
    if (calculation.status !== "valid") return;
    state.calculation = calculation;
    state.workingVersion = null;

    const html = renderToStaticMarkup(<Boardroom />);

    expect(html).toContain("Página 01 · Executive Summary");
    expect(html).toContain("Página 02 · Product &amp; Inventory");
    expect(html).toContain("Estudo de Teste");
  });

  it("apresenta Point Economics por ponto sem perder os agregados autoritativos", () => {
    const calculation = calculateFinancialProjection(inputs, 24, { pointEconomics });
    expect(calculation.status).toBe("valid");
    if (calculation.status !== "valid") return;
    state.calculation = calculation;

    const html = renderToStaticMarkup(<Boardroom />);

    expect(html).toContain("Point Economics");
    expect(html).toContain("Quiosque Cotia Mall");
    expect(html).toContain("Shopping");
    expect(html).toContain("Healthy D90");
    expect(html).toContain("Contribuição incremental líquida");
    expect(html).toContain(pointEconomics.points[0].classification);
    expect(html).toContain(pointEconomics.points[0].drivers[0].message);
    expect(html).toContain(pointEconomics.totals.value.incrementalNetContribution);
    expect(html).not.toContain("Commercial Operations");
  });

  it("apresenta capacidade, workforce, treinamento e ledger de Commercial Operations", () => {
    const calculation = calculateFinancialProjection(inputs, 2, {
      pointEconomics,
      commercialOperations,
    });
    expect(calculation.status).toBe("valid");
    if (calculation.status !== "valid") return;
    state.calculation = calculation;

    const html = renderToStaticMarkup(<Boardroom />);

    expect(html).toContain("Commercial Operations");
    expect(html).toContain("Capacidade da sala");
    expect(html).toContain("consultants");
    expect(html).toContain("Tours planejados excedem a capacidade limitada.");
    expect(html).toContain("Workforce mensal");
    expect(html).toContain("Treinamento");
    expect(html).toContain("academy");
    expect(html).toContain("Ledger de comissões");
    expect(html).toContain("closer-fixed");
    expect(html).toContain(calculation.commissionLedger!.totals.payable);
    expect(html).toContain(calculation.projections[0].commercialOperationsCosts);
    expect(html).toContain(calculation.projections[0].commissionPayments);
  });
});
