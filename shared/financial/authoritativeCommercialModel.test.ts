import { describe, expect, it } from "vitest";
import { resolveAuthoritativeCommercialModel } from "./authoritativeCommercialModel";

describe("resolveAuthoritativeCommercialModel", () => {
  it("deriva ticket, entrada e limite de contratos por SKU e estoque disponível", () => {
    const result = resolveAuthoritativeCommercialModel({
      asOfMonth: 0,
      skus: [
        {
          id: "studio",
          name: "Studio",
          unitType: "Studio",
          unitQuantity: 1,
          sharesPerUnit: 4,
          grossSoldShares: 2,
          returnedShares: 0,
          blockedShares: 0,
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "100" }],
        },
        {
          id: "suite",
          name: "Suíte",
          unitType: "Suíte",
          unitQuantity: 1,
          sharesPerUnit: 2,
          grossSoldShares: 1,
          returnedShares: 0,
          blockedShares: 0,
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "200" }],
        },
      ],
      conditions: [
        {
          productSkuCode: "studio",
          condition: {
            id: "studio-standard",
            name: "Studio padrão",
            listPrice: "100",
            discount: "10",
            entry: { total: "20", installments: 2, firstDueMonth: 0 },
            balance: { principal: "70", installments: 7, graceMonths: 0, firstDueMonth: 1 },
            explicitCharges: "0",
            materialityTolerance: "0.01",
          },
        },
        {
          productSkuCode: "suite",
          condition: {
            id: "suite-standard",
            name: "Suíte padrão",
            listPrice: "200",
            discount: "20",
            entry: { total: "40", installments: 2, firstDueMonth: 0 },
            balance: { principal: "140", installments: 14, graceMonths: 0, firstDueMonth: 1 },
            explicitCharges: "0",
            materialityTolerance: "0.01",
          },
        },
      ],
    });

    expect(result).toMatchObject({
      status: "valid",
      violations: [],
      derived: {
        averageTicket: "120.00000000",
        entryValuePerContract: "26.66666667",
        maxContracts: "3.00000000",
      },
    });
  });

  it("bloqueia SKU sem condição ou com preço de tabela divergente", () => {
    const result = resolveAuthoritativeCommercialModel({
      asOfMonth: 0,
      skus: [
        {
          id: "studio",
          name: "Studio",
          unitType: "Studio",
          unitQuantity: 1,
          sharesPerUnit: 4,
          grossSoldShares: 0,
          returnedShares: 0,
          blockedShares: 0,
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "100" }],
        },
        {
          id: "suite",
          name: "Suíte",
          unitType: "Suíte",
          unitQuantity: 1,
          sharesPerUnit: 2,
          grossSoldShares: 0,
          returnedShares: 0,
          blockedShares: 0,
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "200" }],
        },
      ],
      conditions: [{
        productSkuCode: "studio",
        condition: {
          id: "studio-broken",
          name: "Studio divergente",
          listPrice: "110",
          discount: "10",
          entry: { total: "20", installments: 2, firstDueMonth: 0 },
          balance: { principal: "80", installments: 8, graceMonths: 0, firstDueMonth: 1 },
          explicitCharges: "0",
          materialityTolerance: "0.01",
        },
      }],
    });

    expect(result.status).toBe("invalid");
    expect(result.violations.map(violation => violation.code)).toEqual(
      expect.arrayContaining([
        "PRODUCT_CONDITION_PRICE_MISMATCH",
        "MISSING_COMMERCIAL_CONDITION",
      ])
    );
  });
});
