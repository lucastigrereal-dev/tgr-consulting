import type Decimal from "decimal.js";
import type { CommercialConditionInput } from "./commercialCondition";
import { reconcileCommercialCondition } from "./commercialCondition";
import { FinanceDecimal } from "./engine";

export type PaymentCalendarComponent =
  | "entry"
  | "balance"
  | "explicit_charge";

export type PaymentCalendarLine = {
  component: PaymentCalendarComponent;
  installment: number;
  dueMonthOffset: number;
  grossAmount: string;
};

const ZERO = new FinanceDecimal(0);
const decimalText = (value: Decimal) => value.toFixed(8);

function allocateInstallments(total: Decimal, installments: number) {
  const regular = total
    .div(installments)
    .toDecimalPlaces(8, FinanceDecimal.ROUND_HALF_UP);
  return Array.from({ length: installments }, (_, index) =>
    index === installments - 1
      ? total.minus(regular.times(installments - 1))
      : regular
  );
}

export function buildPaymentCalendar(
  condition: CommercialConditionInput
): {
  lines: PaymentCalendarLine[];
  totals: {
    entry: string;
    balance: string;
    explicitCharges: string;
    grossReceivables: string;
  };
} {
  const reconciliation = reconcileCommercialCondition(condition);
  if (reconciliation.status === "invalid")
    throw new Error(
      `Condição comercial não pode gerar calendário: ${reconciliation.violations
        .map(violation => violation.message)
        .join(", ")}.`
    );

  const entry = new FinanceDecimal(condition.entry.total);
  const balance = new FinanceDecimal(condition.balance.principal);
  const explicitCharges = new FinanceDecimal(condition.explicitCharges);
  const lines: PaymentCalendarLine[] = [];

  allocateInstallments(entry, condition.entry.installments).forEach(
    (grossAmount, index) => {
      if (grossAmount.eq(ZERO)) return;
      lines.push({
        component: "entry",
        installment: index + 1,
        dueMonthOffset: condition.entry.firstDueMonth + index,
        grossAmount: decimalText(grossAmount),
      });
    }
  );
  if (explicitCharges.gt(ZERO))
    lines.push({
      component: "explicit_charge",
      installment: 1,
      dueMonthOffset: condition.explicitChargesDueMonth!,
      grossAmount: decimalText(explicitCharges),
    });
  allocateInstallments(balance, condition.balance.installments).forEach(
    (grossAmount, index) => {
      if (grossAmount.eq(ZERO)) return;
      lines.push({
        component: "balance",
        installment: index + 1,
        dueMonthOffset: condition.balance.firstDueMonth + index,
        grossAmount: decimalText(grossAmount),
      });
    }
  );

  lines.sort(
    (left, right) =>
      left.dueMonthOffset - right.dueMonthOffset ||
      (left.component === right.component
        ? left.installment - right.installment
        : left.component.localeCompare(right.component))
  );
  return {
    lines,
    totals: {
      entry: decimalText(entry),
      balance: decimalText(balance),
      explicitCharges: decimalText(explicitCharges),
      grossReceivables: decimalText(
        entry.plus(balance).plus(explicitCharges)
      ),
    },
  };
}
