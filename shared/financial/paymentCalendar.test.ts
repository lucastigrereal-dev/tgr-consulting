import { describe, expect, it } from "vitest";
import { FinanceDecimal } from "./engine";
import { buildPaymentCalendar } from "./paymentCalendar";

const sum = (values: string[]) =>
  values.reduce(
    (total, value) => total.plus(value),
    new FinanceDecimal(0)
  );

describe("buildPaymentCalendar", () => {
  it("separa entrada, saldo e encargos por vencimento sem perder o total", () => {
    const result = buildPaymentCalendar({
      id: "standard",
      name: "Condição padrão",
      listPrice: "100",
      discount: "0",
      entry: { total: "20", installments: 2, firstDueMonth: 0 },
      balance: {
        principal: "75",
        installments: 3,
        graceMonths: 1,
        firstDueMonth: 2,
      },
      explicitCharges: "5",
      explicitChargesDueMonth: 0,
      correctionRate: "0",
      interestRate: "0",
      materialityTolerance: "0.01",
    });

    expect(result.lines).toEqual([
      { component: "entry", installment: 1, dueMonthOffset: 0, grossAmount: "10.00000000" },
      { component: "explicit_charge", installment: 1, dueMonthOffset: 0, grossAmount: "5.00000000" },
      { component: "entry", installment: 2, dueMonthOffset: 1, grossAmount: "10.00000000" },
      { component: "balance", installment: 1, dueMonthOffset: 2, grossAmount: "25.00000000" },
      { component: "balance", installment: 2, dueMonthOffset: 3, grossAmount: "25.00000000" },
      { component: "balance", installment: 3, dueMonthOffset: 4, grossAmount: "25.00000000" },
    ]);
    expect(result.totals).toEqual({
      entry: "20.00000000",
      balance: "75.00000000",
      explicitCharges: "5.00000000",
      grossReceivables: "100.00000000",
    });
  });

  it("absorve o arredondamento na última parcela", () => {
    const result = buildPaymentCalendar({
      id: "rounding",
      name: "Condição com dízima",
      listPrice: "100",
      discount: "0",
      entry: { total: "10", installments: 3, firstDueMonth: 0 },
      balance: {
        principal: "90",
        installments: 7,
        graceMonths: 0,
        firstDueMonth: 3,
      },
      explicitCharges: "0",
      materialityTolerance: "0.01",
    });

    expect(sum(result.lines.map(line => line.grossAmount)).toFixed(8)).toBe(
      "100.00000000"
    );
    expect(result.lines[2]?.grossAmount).toBe("3.33333334");
  });

  it("rejeita primeiro vencimento anterior à carência", () => {
    expect(() =>
      buildPaymentCalendar({
        id: "invalid-grace",
        name: "Condição inválida",
        listPrice: "100",
        discount: "0",
        entry: { total: "20", installments: 1, firstDueMonth: 0 },
        balance: {
          principal: "80",
          installments: 1,
          graceMonths: 3,
          firstDueMonth: 2,
        },
        explicitCharges: "0",
        materialityTolerance: "0.01",
      })
    ).toThrow("carência");
  });

  it("não inventa vencimento para encargos explícitos", () => {
    expect(() =>
      buildPaymentCalendar({
        id: "missing-charge-date",
        name: "Condição sem data do encargo",
        listPrice: "100",
        discount: "0",
        entry: { total: "20", installments: 1, firstDueMonth: 0 },
        balance: {
          principal: "75",
          installments: 1,
          graceMonths: 0,
          firstDueMonth: 1,
        },
        explicitCharges: "5",
        materialityTolerance: "0.01",
      })
    ).toThrow("mês de vencimento");
  });
});
