import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  loading: false,
  catalog: undefined as unknown,
  conditions: undefined as unknown,
}));

vi.mock("@/components/ui/spinner", () => ({ Spinner: () => "loading" }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      igr: {
        productCatalog: { invalidate: vi.fn() },
        commercialConditions: { invalidate: vi.fn() },
        projectContext: { invalidate: vi.fn() },
        scenarioComparison: { invalidate: vi.fn() },
      },
    }),
    igr: {
      productCatalog: {
        useQuery: () => ({
          data: state.catalog,
          isLoading: state.loading,
          isError: false,
          error: null,
        }),
      },
      commercialConditions: {
        useQuery: () => ({
          data: state.conditions,
          isLoading: state.loading,
          isError: false,
          error: null,
        }),
      },
      replaceProductCatalog: {
        useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
      },
      upsertCommercialCondition: {
        useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
      },
      calculate: {
        useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
      },
    },
  },
}));

import { AuthoritativeCommercialBuilder } from "./AuthoritativeCommercialBuilder";

describe("AuthoritativeCommercialBuilder", () => {
  beforeEach(() => {
    state.loading = false;
    state.catalog = undefined;
    state.conditions = undefined;
  });

  it("expõe um estado de carregamento acessível", () => {
    state.loading = true;
    const html = renderToStaticMarkup(
      <AuthoritativeCommercialBuilder versionId="version-1" />
    );

    expect(html).toContain("Carregando produto e condições comerciais");
    expect(html).toContain('role="status"');
  });

  it("renderiza SKU, condição, fases e bloqueios autoritativos", () => {
    state.catalog = {
      records: [
        {
          skuCode: "studio",
          name: "Studio",
          unitType: "apartamento",
          unitQuantity: 10,
          sharesPerUnit: 26,
          grossSoldShares: 12,
          returnedShares: 1,
          blockedShares: 2,
          status: "provided",
          sourceType: "current_document",
          sourceRef: "Estudo Cotia, p. 12",
          pricePhases: [
            {
              phaseCode: "lancamento",
              startsAtMonth: 0,
              priceText: "110000.50",
              promotionalPriceText: null,
            },
          ],
        },
      ],
      evaluation: {
        status: "invalid",
        violations: [
          {
            code: "INVENTORY_EXCEEDED",
            path: "skus.studio",
            message: "Vendas e bloqueios excedem o estoque.",
          },
        ],
        totals: { availableShares: 247, availableVgv: "27170123.50" },
      },
    };
    state.conditions = [
      {
        productSkuCode: "studio",
        record: {
          status: "provided",
          sourceType: "current_document",
          sourceRef: "Tabela comercial aprovada",
        },
        condition: {
          id: "standard-studio",
          name: "Condição padrão",
          listPrice: "110000.50",
          discount: "500.25",
          entry: { total: "20000.25", installments: 2, firstDueMonth: 0 },
          balance: {
            principal: "89500.00",
            installments: 36,
            graceMonths: 1,
            firstDueMonth: 2,
          },
          explicitCharges: "0",
          correctionRate: "0",
          interestRate: "0",
          materialityTolerance: "0.01",
          campaign: "Lançamento",
        },
        reconciliation: {
          status: "invalid",
          violations: [
            {
              code: "COMMERCIAL_CONDITION_MISMATCH",
              message: "Preço líquido não reconciliado.",
            },
          ],
        },
      },
    ];

    const html = renderToStaticMarkup(
      <AuthoritativeCommercialBuilder versionId="version-1" />
    );

    expect(html).toContain("Produto e condição comercial autoritativos");
    expect(html).toContain("Studio");
    expect(html).toContain("110000.50");
    expect(html).toContain("Condição padrão");
    expect(html).toContain("Fases de preço");
    expect(html).toContain("Vendas e bloqueios excedem o estoque.");
    expect(html).toContain("Preço líquido não reconciliado.");
    expect(html).toContain("Salvar e calcular");
  });

  it("não anuncia reconciliação nem libera cálculo enquanto houver pendência", () => {
    state.catalog = {
      records: [{
        skuCode: "pending-sku", name: "Produto pendente", unitType: "unidade",
        unitQuantity: 0, sharesPerUnit: 1, grossSoldShares: 0, returnedShares: 0,
        blockedShares: 0, status: "pending", sourceType: "current_decision",
        sourceRef: null, pricePhases: [{ phaseCode: "base", startsAtMonth: 0, priceText: "0", promotionalPriceText: null }],
      }],
      evaluation: { status: "valid", violations: [], totals: { availableShares: 0, availableVgv: "0" } },
    };
    state.conditions = [];

    const html = renderToStaticMarkup(
      <AuthoritativeCommercialBuilder versionId="version-1" />
    );

    expect(html).toContain("item(ns) pendente(s)");
    expect(html).not.toContain(">Reconciliado<");
    expect(html).toMatch(
      /<button(?=[^>]*disabled="")[^>]*>[\s\S]*?Salvar e calcular<\/button>/
    );
  });
});
