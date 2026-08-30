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
      receivablesPolicy: {
        useQuery: () => ({
          data: state.data,
          isLoading: state.loading,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }),
      },
      upsertReceivablesPolicy: {
        useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
      },
    },
  },
}));

vi.mock("@/components/ui/spinner", () => ({ Spinner: () => "loading" }));

import {
  ReceivablesPolicyBuilder,
  toReceivablesPolicyMutationInput,
} from "./ReceivablesPolicyBuilder";

describe("ReceivablesPolicyBuilder", () => {
  beforeEach(() => {
    state.data = undefined;
    state.loading = false;
  });

  it("explica a semântica das curvas e mantém a ficha pendente sem anunciá-la como pronta", () => {
    const html = renderToStaticMarkup(
      <ReceivablesPolicyBuilder versionId="version-1" />
    );

    expect(html).toContain("Política autoritativa de carteira");
    expect(html).toContain("cancelamento são cumulativas");
    expect(html).toContain("cura são condicionais");
    expect(html).toContain("PENDENTE");
    expect(html).not.toContain("POLÍTICA INFORMADA");
  });

  it("hidrata política persistida, proveniência e versão no roundtrip", () => {
    state.data = {
      record: {
        status: "provided",
        sourceType: "current_document",
        sourceRef: "Estudo de carteira, p. 18",
      },
      policy: {
        cancellationCurve: {
          d7: "0.01",
          d30: "0.03",
          d60: "0.05",
          d90: "0.07",
          d180: "0.09",
          lifetime: "0.12",
        },
        delinquencyRate: "0.08",
        cureRates: {
          days1To30: "0.45",
          days31To60: "0.30",
          days61To90: "0.15",
          days90Plus: "0.05",
        },
        writeOffAfterDays: 180,
        policyVersion: "carteira-2026.08",
        sourceRef: "Estudo de carteira, p. 18",
      },
    };

    const html = renderToStaticMarkup(
      <ReceivablesPolicyBuilder versionId="version-1" />
    );

    expect(html).toContain('value="carteira-2026.08"');
    expect(html).toContain('value="0.12"');
    expect(html).toContain('value="0.45"');
    expect(html).toContain('value="180"');
    expect(html).toContain('value="Estudo de carteira, p. 18"');
    expect(html).toContain("POLÍTICA INFORMADA");
    expect(html).toContain("Documento atual");
  });

  it("desabilita a edição e o salvamento sem uma versão ativa", () => {
    const html = renderToStaticMarkup(
      <ReceivablesPolicyBuilder versionId="" />
    );

    expect(html).toContain("Selecione ou crie um projeto");
    expect(html).toMatch(/<input[^>]*disabled=""/);
    expect(html).toMatch(
      /<button(?=[^>]*disabled="")[^>]*>[\s\S]*?Salvar política<\/button>/
    );
  });

  it("monta o payload autoritativo sem converter decimais em float", () => {
    expect(
      toReceivablesPolicyMutationInput("version-1", {
        status: "provided",
        sourceType: "current_document",
        sourceRef: "Ata financeira 42",
        policyVersion: "v2",
        cancellationD7: "0.01",
        cancellationD30: "0.02",
        cancellationD60: "0.03",
        cancellationD90: "0.04",
        cancellationD180: "0.05",
        cancellationLifetime: "0.06",
        delinquencyRate: "0.075",
        cureDays1To30: "0.5",
        cureDays31To60: "0.3",
        cureDays61To90: "0.2",
        cureDays90Plus: "0.1",
        writeOffAfterDays: "180",
      })
    ).toEqual({
      versionId: "version-1",
      status: "provided",
      sourceType: "current_document",
      sourceRef: "Ata financeira 42",
      policy: {
        cancellationCurve: {
          d7: "0.01",
          d30: "0.02",
          d60: "0.03",
          d90: "0.04",
          d180: "0.05",
          lifetime: "0.06",
        },
        delinquencyRate: "0.075",
        cureRates: {
          days1To30: "0.5",
          days31To60: "0.3",
          days61To90: "0.2",
          days90Plus: "0.1",
        },
        writeOffAfterDays: 180,
        policyVersion: "v2",
        sourceRef: "Ata financeira 42",
      },
    });
  });

  it("recusa política informada sem proveniência", () => {
    expect(() =>
      toReceivablesPolicyMutationInput("version-1", {
        status: "provided",
        sourceType: "current_decision",
        sourceRef: "",
        policyVersion: "v1",
        cancellationD7: "0",
        cancellationD30: "0",
        cancellationD60: "0",
        cancellationD90: "0",
        cancellationD180: "0",
        cancellationLifetime: "0",
        delinquencyRate: "0",
        cureDays1To30: "0",
        cureDays31To60: "0",
        cureDays61To90: "0",
        cureDays90Plus: "0",
        writeOffAfterDays: "180",
      })
    ).toThrow("Política informada exige fonte ou responsável");
  });
});
