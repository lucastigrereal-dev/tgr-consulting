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

export function evaluateProductInventory(input: ProductInventoryInput) {
  const violations: ProductInventoryViolation[] = [];
  const skus = input.skus.map(sku => {
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
    const activePhase = [...sku.pricePhases]
      .filter(phase => phase.startsAtMonth <= input.asOfMonth)
      .sort((left, right) => right.startsAtMonth - left.startsAtMonth)[0];
    const activePrice = activePhase
      ? new FinanceDecimal(activePhase.price)
      : ZERO;

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
