import type Decimal from "decimal.js";
import { FinanceDecimal } from "./engine";

export type ProductPricePhase = {
  id: string;
  startsAtMonth: number;
  price: string;
};

export type ProductSkuInput = {
  id: string;
  name: string;
  unitType: string;
  unitQuantity: number;
  sharesPerUnit: number;
  grossSoldShares: number;
  returnedShares: number;
  blockedShares: number;
  pricePhases: ProductPricePhase[];
};

export type ProductInventoryInput = {
  asOfMonth: number;
  skus: ProductSkuInput[];
};

export type ProductInventoryViolation = {
  code: string;
  path: string;
  message: string;
};

const ZERO = new FinanceDecimal(0);
const decimalText = (value: Decimal) => value.toFixed(8);
const nonNegativeDecimal = (value: string) => {
  try {
    const decimal = new FinanceDecimal(value);
    return decimal.isFinite() && decimal.gte(ZERO) ? decimal : null;
  } catch {
    return null;
  }
};

export function evaluateProductInventory(input: ProductInventoryInput) {
  const violations: ProductInventoryViolation[] = [];
  if (!Number.isInteger(input.asOfMonth) || input.asOfMonth < 0) {
    violations.push({
      code: "INVALID_AS_OF_MONTH",
      path: "asOfMonth",
      message: "O mês de referência do estoque deve ser um inteiro não negativo.",
    });
  }
  const skus = input.skus.map(sku => {
    for (const [field, value, minimum] of [
      ["unitQuantity", sku.unitQuantity, 0],
      ["sharesPerUnit", sku.sharesPerUnit, 1],
      ["grossSoldShares", sku.grossSoldShares, 0],
      ["returnedShares", sku.returnedShares, 0],
      ["blockedShares", sku.blockedShares, 0],
    ] as const) {
      if (!Number.isInteger(value) || value < minimum) {
        violations.push({
          code: "INVALID_PRODUCT_COUNT",
          path: `skus.${sku.id}.${field}`,
          message: "Contagens de produto devem ser inteiras e respeitar o mínimo permitido.",
        });
      }
    }
    if (sku.pricePhases.length === 0) {
      violations.push({
        code: "MISSING_PRICE_PHASE",
        path: `skus.${sku.id}.pricePhases`,
        message: "Todo SKU precisa de ao menos uma fase de preço.",
      });
    }
    const validPhases = sku.pricePhases.flatMap(phase => {
      if (!Number.isInteger(phase.startsAtMonth) || phase.startsAtMonth < 0) {
        violations.push({
          code: "INVALID_PRICE_PHASE_MONTH",
          path: `skus.${sku.id}.pricePhases.${phase.id}.startsAtMonth`,
          message: "O início da fase de preço deve ser um mês inteiro não negativo.",
        });
      }
      const price = nonNegativeDecimal(phase.price);
      if (!price) {
        violations.push({
          code: "INVALID_PRODUCT_PRICE",
          path: `skus.${sku.id}.pricePhases.${phase.id}.price`,
          message: "O preço da fase deve ser um decimal não negativo.",
        });
      }
      return price && Number.isInteger(phase.startsAtMonth) && phase.startsAtMonth >= 0
        ? [{ phase, price }]
        : [];
    });
    const initialShares = sku.unitQuantity * sku.sharesPerUnit;
    const netSoldShares = sku.grossSoldShares - sku.returnedShares;
    const availableShares = initialShares - netSoldShares - sku.blockedShares;
    if (sku.returnedShares > sku.grossSoldShares) {
      violations.push({
        code: "RETURN_EXCEEDS_SALES",
        path: `skus.${sku.id}.returnedShares`,
        message: "Retornos não podem exceder as vendas brutas registradas.",
      });
    }
    if (availableShares < 0) {
      violations.push({
        code: "INVENTORY_EXCEEDED",
        path: `skus.${sku.id}`,
        message: "Vendas líquidas e bloqueios excedem o estoque inicial.",
      });
    }
    const activePhase = [...validPhases]
      .filter(candidate => candidate.phase.startsAtMonth <= input.asOfMonth)
      .sort(
        (left, right) =>
          right.phase.startsAtMonth - left.phase.startsAtMonth
      )[0];
    if (!activePhase && sku.pricePhases.length > 0) {
      violations.push({
        code: "MISSING_ACTIVE_PRICE_PHASE",
        path: `skus.${sku.id}.pricePhases`,
        message: "Nenhuma fase de preço válida está ativa no mês de referência.",
      });
    }
    const activePrice = activePhase?.price ?? ZERO;

    return {
      ...sku,
      initialShares,
      netSoldShares,
      availableShares,
      activePrice: decimalText(activePrice),
      potentialVgv: decimalText(activePrice.times(initialShares)),
      soldVgv: decimalText(activePrice.times(netSoldShares)),
      availableVgv: decimalText(activePrice.times(availableShares)),
    };
  });

  const initialShares = skus.reduce(
    (total, sku) => total + sku.initialShares,
    0
  );
  const grossSoldShares = skus.reduce(
    (total, sku) => total + sku.grossSoldShares,
    0
  );
  const returnedShares = skus.reduce(
    (total, sku) => total + sku.returnedShares,
    0
  );
  const netSoldShares = skus.reduce(
    (total, sku) => total + sku.netSoldShares,
    0
  );
  const blockedShares = skus.reduce(
    (total, sku) => total + sku.blockedShares,
    0
  );
  const availableShares = skus.reduce(
    (total, sku) => total + sku.availableShares,
    0
  );
  const sumMoney = (key: "potentialVgv" | "soldVgv" | "availableVgv") =>
    skus.reduce((total, sku) => total.plus(sku[key]), new FinanceDecimal(0));

  return {
    status: violations.length === 0 ? ("valid" as const) : ("invalid" as const),
    violations,
    skus,
    totals: {
      initialShares,
      grossSoldShares,
      returnedShares,
      netSoldShares,
      blockedShares,
      availableShares,
      potentialVgv: decimalText(sumMoney("potentialVgv")),
      soldVgv: decimalText(sumMoney("soldVgv")),
      availableVgv: decimalText(sumMoney("availableVgv")),
      selloutRate: decimalText(
        initialShares === 0
          ? ZERO
          : new FinanceDecimal(netSoldShares).div(initialShares)
      ),
    },
  };
}
