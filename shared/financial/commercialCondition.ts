import type Decimal from "decimal.js";
import { FinanceDecimal } from "./engine";

export type CommercialConditionInput = {
  id: string;
  name: string;
  listPrice: string;
  discount: string;
  entry: {
    total: string;
    installments: number;
    firstDueMonth: number;
  };
  balance: {
    principal: string;
    installments: number;
    graceMonths: number;
    firstDueMonth: number;
  };
  explicitCharges: string;
  correctionRate?: string;
  interestRate?: string;
  materialityTolerance: string;
  campaign?: string;
};

export type CommercialConditionViolation = {
  code: string;
  path: string;
  message: string;
};

const ZERO = new FinanceDecimal(0);
const ONE = new FinanceDecimal(1);
const decimalText = (value: Decimal) => value.toFixed(8);

export function reconcileCommercialCondition(input: CommercialConditionInput) {
  const violations: CommercialConditionViolation[] = [];
  const listPrice = new FinanceDecimal(input.listPrice);
  const discount = new FinanceDecimal(input.discount);
  const entryTotal = new FinanceDecimal(input.entry.total);
  const balancePrincipal = new FinanceDecimal(input.balance.principal);
  const explicitCharges = new FinanceDecimal(input.explicitCharges);
  const tolerance = new FinanceDecimal(input.materialityTolerance);
  const monetaryValues = [
    ["listPrice", listPrice],
    ["discount", discount],
    ["entry.total", entryTotal],
    ["balance.principal", balancePrincipal],
    ["explicitCharges", explicitCharges],
    ["materialityTolerance", tolerance],
  ] as const;
  for (const [path, value] of monetaryValues) {
    if (value.lt(ZERO)) {
      violations.push({
        code: "NEGATIVE_COMMERCIAL_VALUE",
        path,
        message: "Valores da condição comercial não podem ser negativos.",
      });
    }
  }
  for (const [path, rate] of [
    ["correctionRate", input.correctionRate],
    ["interestRate", input.interestRate],
  ] as const) {
    if (rate === undefined) continue;
    const value = new FinanceDecimal(rate);
    if (value.lt(ZERO) || value.gt(ONE)) {
      violations.push({
        code: "INVALID_COMMERCIAL_RATE",
        path,
        message: "Taxas da condição comercial devem estar entre 0 e 1.",
      });
    } else if (value.gt(ZERO)) {
      violations.push({
        code: "INDEXED_PAYMENT_SCHEDULE_REQUIRED",
        path,
        message:
          "Correção ou juros exigem calendário financeiro indexado antes do snapshot oficial.",
      });
    }
  }
  if (
    !Number.isInteger(input.entry.installments) ||
    input.entry.installments < 1
  ) {
    violations.push({
      code: "INVALID_ENTRY_INSTALLMENTS",
      path: "entry.installments",
      message: "A entrada precisa ter ao menos uma parcela.",
    });
  }
  if (
    !Number.isInteger(input.balance.installments) ||
    input.balance.installments < 1
  ) {
    violations.push({
      code: "INVALID_BALANCE_INSTALLMENTS",
      path: "balance.installments",
      message: "O saldo precisa ter ao menos uma parcela.",
    });
  }

  const expectedPrice = listPrice.minus(discount);
  const financialComponents = entryTotal
    .plus(balancePrincipal)
    .plus(explicitCharges);
  const difference = expectedPrice.minus(financialComponents);
  if (difference.abs().gt(tolerance)) {
    violations.push({
      code: "COMMERCIAL_CONDITION_MISMATCH",
      path: "difference",
      message: "O preço líquido não reconcilia com os componentes financeiros.",
    });
  }

  return {
    status: violations.length === 0 ? ("valid" as const) : ("invalid" as const),
    expectedPrice: decimalText(expectedPrice),
    financialComponents: decimalText(financialComponents),
    difference: decimalText(difference),
    entryInstallmentValue: decimalText(
      input.entry.installments > 0
        ? entryTotal.div(input.entry.installments)
        : ZERO
    ),
    balanceInstallmentValue: decimalText(
      input.balance.installments > 0
        ? balancePrincipal.div(input.balance.installments)
        : ZERO
    ),
    blocksOfficialSnapshot: violations.length > 0,
    violations,
  };
}
