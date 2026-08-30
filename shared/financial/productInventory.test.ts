import { describe, expect, it } from "vitest";
import { evaluateProductInventory } from "./productInventory";

describe("evaluateProductInventory", () => {
  it("reconcilia estoque e VGV de múltiplos SKUs", () => {
    const result = evaluateProductInventory({
      asOfMonth: 1,
      skus: [
        {
          id: "studio",
          name: "Studio",
          unitType: "UH Studio",
          unitQuantity: 2,
          sharesPerUnit: 10,
          grossSoldShares: 8,
          returnedShares: 2,
          blockedShares: 3,
          pricePhases: [{ id: "launch", startsAtMonth: 1, price: "1000" }],
        },
        {
          id: "suite",
          name: "Suíte",
          unitType: "UH Suíte",
          unitQuantity: 1,
          sharesPerUnit: 5,
          grossSoldShares: 5,
          returnedShares: 0,
          blockedShares: 0,
          pricePhases: [{ id: "launch", startsAtMonth: 1, price: "2000" }],
        },
      ],
    });

    expect(result.status).toBe("valid");
    expect(result.violations).toEqual([]);
    expect(result.skus[0]).toMatchObject({
      initialShares: 20,
      netSoldShares: 6,
      availableShares: 11,
      activePrice: "1000.00000000",
      potentialVgv: "20000.00000000",
      soldVgv: "6000.00000000",
    });
    expect(result.totals).toEqual({
      initialShares: 25,
      grossSoldShares: 13,
      returnedShares: 2,
      netSoldShares: 11,
      blockedShares: 3,
      availableShares: 11,
      potentialVgv: "30000.00000000",
      soldVgv: "16000.00000000",
      availableVgv: "11000.00000000",
      selloutRate: "0.44000000",
    });
  });

  it("bloqueia vendas líquidas e reservas acima do estoque", () => {
    const result = evaluateProductInventory({
      asOfMonth: 1,
      skus: [
        {
          id: "studio",
          name: "Studio",
          unitType: "UH Studio",
          unitQuantity: 1,
          sharesPerUnit: 10,
          grossSoldShares: 12,
          returnedShares: 1,
          blockedShares: 1,
          pricePhases: [{ id: "launch", startsAtMonth: 1, price: "1000" }],
        },
      ],
    });

    expect(result.status).toBe("invalid");
    expect(result.violations).toContainEqual({
      code: "INVENTORY_EXCEEDED",
      path: "skus.studio",
      message: "Vendas líquidas e bloqueios excedem o estoque inicial.",
    });
  });

  it("bloqueia retorno maior que a venda bruta registrada", () => {
    const result = evaluateProductInventory({
      asOfMonth: 1,
      skus: [
        {
          id: "suite",
          name: "Suíte",
          unitType: "UH Suíte",
          unitQuantity: 1,
          sharesPerUnit: 10,
          grossSoldShares: 2,
          returnedShares: 3,
          blockedShares: 0,
          pricePhases: [{ id: "launch", startsAtMonth: 1, price: "2000" }],
        },
      ],
    });

    expect(result.violations).toContainEqual({
      code: "RETURN_EXCEEDS_SALES",
      path: "skus.suite.returnedShares",
      message: "Retornos não podem exceder as vendas brutas registradas.",
    });
  });

  it("bloqueia catálogo sem fase e fases com preço ou mês inválidos", () => {
    const result = evaluateProductInventory({
      asOfMonth: 1,
      skus: [
        {
          id: "missing-phase",
          name: "Sem fase",
          unitType: "UH",
          unitQuantity: 1,
          sharesPerUnit: 4,
          grossSoldShares: 0,
          returnedShares: 0,
          blockedShares: 0,
          pricePhases: [],
        },
        {
          id: "invalid-phase",
          name: "Fase inválida",
          unitType: "UH",
          unitQuantity: 1,
          sharesPerUnit: 4,
          grossSoldShares: 0,
          returnedShares: 0,
          blockedShares: 0,
          pricePhases: [{ id: "launch", startsAtMonth: -1, price: "-100" }],
        },
      ],
    });

    expect(result.status).toBe("invalid");
    expect(result.violations.map(violation => violation.code)).toEqual(
      expect.arrayContaining([
        "MISSING_PRICE_PHASE",
        "INVALID_PRICE_PHASE_MONTH",
        "INVALID_PRODUCT_PRICE",
      ])
    );
  });

  it("bloqueia mês de referência e contagens de estoque inválidos", () => {
    const result = evaluateProductInventory({
      asOfMonth: -1,
      skus: [
        {
          id: "invalid-counts",
          name: "Contagens inválidas",
          unitType: "UH",
          unitQuantity: -1,
          sharesPerUnit: 0,
          grossSoldShares: -1,
          returnedShares: -1,
          blockedShares: -1,
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "100" }],
        },
      ],
    });

    expect(result.status).toBe("invalid");
    expect(result.violations.map(violation => violation.code)).toEqual(
      expect.arrayContaining([
        "INVALID_AS_OF_MONTH",
        "INVALID_PRODUCT_COUNT",
      ])
    );
  });
});
