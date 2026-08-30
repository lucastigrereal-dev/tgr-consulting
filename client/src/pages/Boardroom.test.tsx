import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { calculateFinancialProjection } from "@shared/financial/engine";
import { calculatePointEconomics } from "@shared/financial/pointEconomics";
import type { FinancialCalculation, FinancialInputSnapshot } from "@shared/financial/types";

const state = vi.hoisted(() => ({ calculation: null as FinancialCalculation | null }));

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
            workingVersion: { id: "version-1" },
            latestImpact: { changedInputKeys: [] },
            snapshotHistory: [{ id: "snapshot-1", calculationStatus: "valid", missingInputKeys: [] }],
          },
          isLoading: false,
          isError: false,
          refetch: async () => undefined,
        }),
      },
      versionInputs: {
        useQuery: () => ({
          data: { preOperationMonths: { status: "provided", value: "0" } },
        }),
      },
      builderComponents: {
        useQuery: () => ({
          data: [{ componentType: "project_assembly", payload: { nomeProjeto: "Estudo de Teste", praca: "Cotia", inicioOperacao: "01/2027", totalApartamentos: "40", cotasPorApartamento: "13" } }],
        }),
      },
      exportEligibility: { useQuery: () => ({ data: { eligible: false }, refetch: async () => undefined }) },
      approveSnapshot: { useMutation: () => ({ isPending: false, mutate: () => undefined }) },
      freezeBaseline: { useMutation: () => ({ isPending: false, mutate: () => undefined }) },
      requestExport: { useMutation: () => ({ isPending: false, mutate: () => undefined }) },
      simulateCaptadores: { useMutation: () => ({ isPending: false, mutate: () => undefined }) },
    },
  },
}));

import Boardroom from "./Boardroom";

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

describe("Boardroom · trilha editorial", () => {
  it("renderiza um snapshot calculado com origem ficha-mãe e fórmulas versionadas nos capítulos do estudo", () => {
    const calculation = calculateFinancialProjection(inputs, 24);
    expect(calculation.status).toBe("valid");
    if (calculation.status !== "valid") return;
    state.calculation = calculation;

    const html = renderToStaticMarkup(<Boardroom />);
    expect(html).toContain("Página 01 · Premissas");
    expect(html).toContain("Origem: ficha-mãe e premissas autoritativas");
    expect(html).toContain("Página 04 · Vendas");
    expect(html).toContain("gross-sales · v1.1.0");
    expect(html).toContain("Página 05 · Receita");
    expect(html).toContain("gross-receivables-generated · v1.0.0");
    expect(html).toContain("installment-collections · v1.1.0");
    expect(html).toContain("healthy-d90 · v1.0.0");
    expect(html).toContain("Saldo inadimplente");
    expect(html).toContain("net-entry-collections · v1.3.0");
    expect(html).toContain("Página 06 · Custos");
    expect(html).toContain("Página 07 · Operação");
    expect(html).toContain("Demonstrativo vivo");
    expect(html).toContain("Simulação de reunião");
    expect(html).toContain("Página 07 · Indicadores");
    expect(html).toContain("Como o estudo chegou aqui");
    expect(html).toContain("operating-cash-flow · v1.1.0");
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
  });
});
