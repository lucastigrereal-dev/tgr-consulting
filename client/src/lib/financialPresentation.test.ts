import { describe, expect, it } from "vitest";
import { formatCurrency, formatKpi, formatPercent, isDecimal, normalizeDecimalInput } from "./financialPresentation";

describe("financialPresentation", () => {
  it("normaliza entrada brasileira sem fabricar precisão", () => {
    expect(normalizeDecimalInput("12.000,50")).toBe("12.00050");
    expect(normalizeDecimalInput("12000,50")).toBe("12000.50");
    expect(normalizeDecimalInput("0,18")).toBe("0.18");
    expect(isDecimal("12000.50")).toBe(true);
    expect(isDecimal("12mil")).toBe(false);
  });

  it("apresenta moeda, percentual e KPIs no padrão executivo brasileiro", () => {
    expect(formatCurrency("12000.5")).toContain("R$");
    expect(formatPercent("0.18")).toContain("18");
    expect(formatKpi("paybackMonths", "12.7")).toBe("13 meses");
    expect(formatKpi("npv", "1000")).toContain("R$");
    expect(formatKpi("grossSales", "240000")).toContain("R$");
    expect(formatKpi("averageTicket", "1000")).toContain("R$");
    expect(formatKpi("netCollections", "1000")).toContain("R$");
    expect(formatKpi("paymentFees", "25")).toContain("R$");
  });
});
