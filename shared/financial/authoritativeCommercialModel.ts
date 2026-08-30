import type Decimal from "decimal.js";
import { reconcileCommercialCondition, type CommercialConditionInput } from "./commercialCondition";
import { FinanceDecimal } from "./engine";
import { evaluateProductInventory, type ProductSkuInput } from "./productInventory";

export type LinkedCommercialConditionInput = {
  productSkuCode?: string | null;
  condition: CommercialConditionInput;
};

export type AuthoritativeCommercialModelViolation = {
  code: string;
  path: string;
  message: string;
};

const ZERO = new FinanceDecimal(0);
const decimalText = (value: Decimal) => value.toFixed(8);

export function resolveAuthoritativeCommercialModel(input: {
  asOfMonth: number;
  skus: ProductSkuInput[];
  conditions: LinkedCommercialConditionInput[];
}) {
  const inventory = evaluateProductInventory({
    asOfMonth: input.asOfMonth,
    skus: input.skus,
  });
  const violations: AuthoritativeCommercialModelViolation[] = inventory.violations.map(
    violation => ({ ...violation })
  );
  const skuCodes = new Set(input.skus.map(sku => sku.id));
  for (const linked of input.conditions) {
    if (linked.productSkuCode && !skuCodes.has(linked.productSkuCode)) {
      violations.push({
        code: "ORPHAN_COMMERCIAL_CONDITION",
        path: `conditions.${linked.condition.id}.productSkuCode`,
        message: "A condição comercial referencia um SKU inexistente.",
      });
    }
  }

  let weightedTicket = ZERO;
  let weightedEntry = ZERO;
  let availableContracts = ZERO;
  const assignments: Array<{
    productSkuCode: string;
    conditionId: string;
    availableShares: number;
    netTicket: string;
    entryValue: string;
  }> = [];
  const globalConditions = input.conditions.filter(
    linked => !linked.productSkuCode
  );

  for (const sku of inventory.skus) {
    const specificConditions = input.conditions.filter(
      linked => linked.productSkuCode === sku.id
    );
    const candidates = specificConditions.length
      ? specificConditions
      : globalConditions;
    if (candidates.length === 0) {
      violations.push({
        code: "MISSING_COMMERCIAL_CONDITION",
        path: `skus.${sku.id}.commercialCondition`,
        message: "Todo SKU precisa de uma condição comercial aplicável.",
      });
      continue;
    }
    if (candidates.length > 1) {
      violations.push({
        code: "AMBIGUOUS_COMMERCIAL_CONDITION",
        path: `skus.${sku.id}.commercialCondition`,
        message: "O SKU possui mais de uma condição comercial aplicável.",
      });
      continue;
    }
    const linked = candidates[0]!;
    const reconciliation = reconcileCommercialCondition(linked.condition);
    if (reconciliation.status === "invalid") {
      violations.push({
        code: "INVALID_COMMERCIAL_CONDITION",
        path: `conditions.${linked.condition.id}`,
        message: `A condição comercial não reconcilia: ${reconciliation.violations
          .map(violation => violation.code)
          .join(", ")}.`,
      });
      continue;
    }
    const priceDifference = new FinanceDecimal(sku.activePrice)
      .minus(linked.condition.listPrice)
      .abs();
    if (priceDifference.gt(linked.condition.materialityTolerance)) {
      violations.push({
        code: "PRODUCT_CONDITION_PRICE_MISMATCH",
        path: `skus.${sku.id}.activePrice`,
        message: "O preço de tabela da condição diverge da fase ativa do SKU.",
      });
    }
    const weight = new FinanceDecimal(sku.availableShares);
    weightedTicket = weightedTicket.plus(
      new FinanceDecimal(reconciliation.expectedPrice).times(weight)
    );
    weightedEntry = weightedEntry.plus(
      new FinanceDecimal(linked.condition.entry.total).times(weight)
    );
    availableContracts = availableContracts.plus(weight);
    assignments.push({
      productSkuCode: sku.id,
      conditionId: linked.condition.id,
      availableShares: sku.availableShares,
      netTicket: reconciliation.expectedPrice,
      entryValue: decimalText(new FinanceDecimal(linked.condition.entry.total)),
    });
  }

  const derived = availableContracts.eq(ZERO)
    ? {
        averageTicket: "0.00000000",
        entryValuePerContract: "0.00000000",
        maxContracts: "0.00000000",
      }
    : {
        averageTicket: decimalText(weightedTicket.div(availableContracts)),
        entryValuePerContract: decimalText(
          weightedEntry.div(availableContracts)
        ),
        maxContracts: decimalText(availableContracts),
      };

  return {
    status: violations.length === 0 ? ("valid" as const) : ("invalid" as const),
    violations,
    inventory,
    assignments,
    derived,
  };
}
