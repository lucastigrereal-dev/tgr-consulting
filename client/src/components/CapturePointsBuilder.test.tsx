import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  data: undefined as unknown,
  loading: false,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    igr: {
      capturePoints: {
        useQuery: () => ({
          data: state.data,
          isLoading: state.loading,
          isError: false,
          refetch: vi.fn(),
        }),
      },
      replaceCapturePoints: {
        useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
      },
    },
  },
}));

vi.mock("@/components/ui/spinner", () => ({ Spinner: () => "loading" }));

import {
  CapturePointsBuilder,
  emptyCapturePointDraft,
  toCapturePointsMutationInput,
} from "./CapturePointsBuilder";

describe("CapturePointsBuilder", () => {
  beforeEach(() => {
    state.data = undefined;
    state.loading = false;
  });

  it("mantém a carteira vazia explicitamente pendente e explica o tratamento de caixa", () => {
    const html = renderToStaticMarkup(
      <CapturePointsBuilder versionId="version-1" />
    );

    expect(html).toContain("Pontos de captação");
    expect(html).toContain("NENHUM PONTO · PENDENTE");
    expect(html).toContain("Incremental adiciona CAPEX e OPEX");
    expect(html).toContain("Já incluído nos totais evita dupla contagem");
    expect(html).toContain("Adicionar ponto");
    expect(html).not.toContain("CARTEIRA INFORMADA");
  });

  it("hidrata múltiplos pontos, proveniência e tratamento de caixa", () => {
    state.data = [
      {
        record: {
          status: "provided",
          sourceType: "current_document",
          sourceRef: "Plano comercial, p. 12",
        },
        definition: {
          ...emptyCapturePointDraft().definition,
          pointId: "airport",
          name: "Aeroporto",
          channel: "OPC",
          activationCost: "25000",
          cashflowTreatment: "incremental",
        },
      },
      {
        record: {
          status: "pending",
          sourceType: "current_decision",
          sourceRef: null,
        },
        definition: {
          ...emptyCapturePointDraft().definition,
          pointId: "hotel",
          name: "Hotel parceiro",
          channel: "Parceria",
          monthlyFixedCost: "1500",
          cashflowTreatment: "included_in_project_totals",
        },
      },
    ];

    const html = renderToStaticMarkup(
      <CapturePointsBuilder versionId="version-1" />
    );

    expect(html).toContain('value="airport"');
    expect(html).toContain('value="Aeroporto"');
    expect(html).toContain('value="Plano comercial, p. 12"');
    expect(html).toContain('value="hotel"');
    expect(html).toContain('value="Hotel parceiro"');
    expect(html).toContain("2 pontos · 1 informado · 1 pendente");
    expect(html).toContain("Já incluído nos totais do projeto");
  });

  it("normaliza um lote de múltiplos pontos sem converter decimais em float", () => {
    const airport = emptyCapturePointDraft();
    airport.status = "provided";
    airport.sourceType = "current_document";
    airport.sourceRef = "Estudo Cotia/Pipa";
    airport.definition = {
      ...airport.definition,
      pointId: " airport ",
      name: " Aeroporto ",
      channel: " OPC ",
      activationCost: "25000.50",
      monthlyFixedCost: "3000",
      costPerSale: "125.75",
      approaches: "1000",
      researchRate: "0.8",
      qualificationRate: "0.5",
      invitationRate: "0.4",
      appointmentRate: "0.3",
      showRate: "0.7",
      tourRate: "0.75",
      saleRate: "0.2",
      cannibalizationRate: "0.1",
      cashflowTreatment: "incremental",
    };
    const hotel = emptyCapturePointDraft();
    hotel.definition = {
      ...hotel.definition,
      pointId: "hotel",
      name: "Hotel",
      channel: "Parceria",
      cashflowTreatment: "included_in_project_totals",
    };

    expect(
      toCapturePointsMutationInput("version-1", [airport, hotel])
    ).toEqual({
      versionId: "version-1",
      points: [
        {
          status: "provided",
          sourceType: "current_document",
          sourceRef: "Estudo Cotia/Pipa",
          definition: {
            pointId: "airport",
            name: "Aeroporto",
            channel: "OPC",
            activationCost: "25000.50",
            monthlyFixedCost: "3000",
            costPerSale: "125.75",
            approaches: "1000",
            researchRate: "0.8",
            qualificationRate: "0.5",
            invitationRate: "0.4",
            appointmentRate: "0.3",
            showRate: "0.7",
            tourRate: "0.75",
            saleRate: "0.2",
            cannibalizationRate: "0.1",
            cashflowTreatment: "incremental",
          },
        },
        {
          status: "pending",
          sourceType: "current_decision",
          definition: {
            pointId: "hotel",
            name: "Hotel",
            channel: "Parceria",
            activationCost: "0",
            monthlyFixedCost: "0",
            costPerSale: "0",
            approaches: "0",
            researchRate: "0",
            qualificationRate: "0",
            invitationRate: "0",
            appointmentRate: "0",
            showRate: "0",
            tourRate: "0",
            saleRate: "0",
            cannibalizationRate: "0",
            cashflowTreatment: "included_in_project_totals",
          },
        },
      ],
    });
  });

  it("recusa ponto informado sem fonte, taxas inválidas e ids duplicados", () => {
    const provided = emptyCapturePointDraft();
    provided.status = "provided";
    provided.definition.pointId = "airport";
    provided.definition.name = "Aeroporto";
    provided.definition.channel = "OPC";
    expect(() =>
      toCapturePointsMutationInput("version-1", [provided])
    ).toThrow("Ponto informado exige fonte ou responsável");

    provided.sourceRef = "Ata 42";
    provided.definition.saleRate = "1.01";
    expect(() =>
      toCapturePointsMutationInput("version-1", [provided])
    ).toThrow("Conversão em venda deve estar entre 0 e 1");

    provided.definition.saleRate = "0.1";
    expect(() =>
      toCapturePointsMutationInput("version-1", [provided, provided])
    ).toThrow("IDs de ponto não podem se repetir");
  });

  it("desabilita edição e salvamento sem versão ativa", () => {
    const html = renderToStaticMarkup(<CapturePointsBuilder versionId="" />);

    expect(html).toContain("Selecione ou crie um projeto");
    expect(html).toMatch(
      /<button(?=[^>]*disabled="")[^>]*>[\s\S]*?Adicionar ponto<\/button>/
    );
    expect(html).toMatch(
      /<button(?=[^>]*disabled="")[^>]*>[\s\S]*?Salvar pontos<\/button>/
    );
  });
});
