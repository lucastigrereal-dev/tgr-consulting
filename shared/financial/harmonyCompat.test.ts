import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { calculateHarmonyCompatProjection } from "./harmonyCompat";
import {
  createHarmonyNatalInputs,
  HARMONY_NATAL_HORIZON_MONTHS,
  HARMONY_NATAL_MAX_CONTRACTS,
} from "./harmonyNatal";

describe("HARMONY_COMPAT_V1", () => {
  it("aplica cancelamento imediato e coortes de entrada/saldo sem somar inadimplência", () => {
    const result = calculateHarmonyCompatProjection(createHarmonyNatalInputs(), HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });

    expect(result.status).toBe("valid");
    expect(result.financialModelMode).toBe("HARMONY_COMPAT_V1");
    expect(result.formulaSetVersion).toBe("1.0.0");
    expect(result.engineVersion).toBe("harmony-compat-engine-v1");

    const m1 = result.projections[0]!;
    expect(m1.grossContracts).toBe("100.00000000");
    expect(m1.canceledContracts).toBe("30.00000000");
    expect(m1.netContracts).toBe("70.00000000");
    expect(m1.grossEntrySettled).toBe("28000.00000000");
    expect(m1.installmentCollections).toBe("0.00000000");
    expect(m1.delinquentBalance).toBe("7000.00000000");
    expect(m1.cashInflows).toBe("28000.00000000");

    expect(result.projections[3]!.installmentCollections).toBe("0.00000000");
    expect(Number(result.projections[4]!.installmentCollections)).toBeCloseTo(
      70 * (24800 / 84),
      6
    );
    expect(result.kpis.sellOutMonth).toBe("45.00000000");
    expect(result.projections[44]!.activeContracts).toBe("3120.00000000");
    expect(result.projections[44]!.availableInventory).toBe("0.00000000");
    expect(result.kpis.totalGrossContracts).toBe("4457.00000000");
    expect(result.kpis.totalNetContracts).toBe("3120.00000000");
    expect(result.compatibilityEvidence).toMatchObject({
      authorityStatus: "CANONICAL_FROM_HARMONY_MASTER_V1",
      adoptedGrossContracts: "4457.00000000",
    });
    expect(result.memory.every(item => item.formulaVersion === "1.0.0")).toBe(true);
    expect(result.projections[12]!.fixedCosts).toBe("195339.00000000");
    expect(result.projections[48]!.fixedCosts).toBe("156271.20000000");
    expect(result.kpis.delinquentBalance).toBe(
      result.projections.at(-1)!.delinquentBalance
    );
    expect(result.memory.map(item => item.formulaId)).toEqual(
      expect.arrayContaining([
        "harmony-gross-entry-generated",
        "harmony-balance-settled-m5",
        "harmony-total-receivables-settled",
        "harmony-line-costs",
        "harmony-pre-operational-investment",
      ])
    );
    for (const item of result.memory) {
      const kpiValue = result.kpis[item.kpiKey as keyof typeof result.kpis];
      expect(item.value).toBe(kpiValue);
    }
  });

  it("não muta o baseline e muda todos os KPIs de decisão no cenário 100 -> 120", () => {
    const baselineInputs = createHarmonyNatalInputs();
    const before = structuredClone(baselineInputs);
    const scenarioInputs = createHarmonyNatalInputs("120");
    const baseline = calculateHarmonyCompatProjection(baselineInputs, HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });
    const scenario = calculateHarmonyCompatProjection(scenarioInputs, HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });

    expect(baselineInputs).toEqual(before);
    expect(scenario.kpis.sellOutMonth).not.toBe(baseline.kpis.sellOutMonth);
    for (const key of ["capitalRequired", "npv", "irrAnnual", "paybackMonths"] as const) {
      expect(scenario.kpis[key]).not.toBeNull();
      expect(scenario.kpis[key]).not.toBe(baseline.kpis[key]);
    }
  });

  it("bloqueia quando falta input obrigatório e valida horizonte/estoque", () => {
    const pending = createHarmonyNatalInputs();
    pending.averageTicket = { status: "pending", sourceType: "current_decision" };
    expect(calculateHarmonyCompatProjection(pending, HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: "3120" }).status)
      .toBe("blocked_by_pending_inputs");
    expect(() => calculateHarmonyCompatProjection(createHarmonyNatalInputs(), 145, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS })).toThrow("1 e 144");
    expect(() => calculateHarmonyCompatProjection(createHarmonyNatalInputs(), HARMONY_NATAL_HORIZON_MONTHS, undefined as never)).toThrow("maxContracts");
    expect(() => calculateHarmonyCompatProjection(createHarmonyNatalInputs(), HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: "3.5" })).toThrow("inteiro");
    expect(() => calculateHarmonyCompatProjection(createHarmonyNatalInputs(), HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: "Infinity" })).toThrow("finito");
    expect(() => calculateHarmonyCompatProjection(createHarmonyNatalInputs(), HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: "-1" }))
      .toThrow("estoque");
  });

  it("consome fixed/payroll e rejeita premissas sem semântica Harmony", () => {
    const baseline = calculateHarmonyCompatProjection(createHarmonyNatalInputs(), HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });
    const changed = createHarmonyNatalInputs();
    changed.fixedCostMonthly.value = "120000";
    changed.payrollMonthly.value = "25000";
    const result = calculateHarmonyCompatProjection(changed, HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: "3120" });
    expect(result.projections[0]!.fixedCosts).toBe("72000.00000000");
    expect(result.projections[0]!.payroll).toBe("25000.00000000");
    expect(result.kpis.capitalRequired).not.toBe(baseline.kpis.capitalRequired);
    expect(result.kpis.npv).not.toBe(baseline.kpis.npv);

    const unsupportedMix = createHarmonyNatalInputs();
    unsupportedMix.paymentBoletoMixRate.value = "0.5";
    unsupportedMix.paymentCardViewMixRate.value = "0.5";
    expect(() => calculateHarmonyCompatProjection(unsupportedMix, HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: "3120" }))
      .toThrow("payment mix Harmony");
    expect(() => calculateHarmonyCompatProjection(createHarmonyNatalInputs(), HARMONY_NATAL_HORIZON_MONTHS, {
      maxContracts: "3120",
      paymentSchedulePerContract: [],
    })).toThrow("paymentSchedulePerContract não é suportada");
  });

  it("rejeita números não finitos e preserva invariantes mensais em Decimal", () => {
    for (const [key, value, message] of [
      ["qualifiedCouplesGrowthRate", "Infinity", "finito"],
      ["qualifiedCouplesGrowthRate", "-1.01", "maior ou igual a -1"],
      ["discountRateAnnual", "NaN", "finito"],
      ["averageTicket", "Infinity", "finito"],
    ] as const) {
      const invalid = createHarmonyNatalInputs();
      invalid[key].value = value;
      expect(() => calculateHarmonyCompatProjection(invalid, HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: "3120" }))
        .toThrow(message);
    }

    const result = calculateHarmonyCompatProjection(createHarmonyNatalInputs(), HARMONY_NATAL_HORIZON_MONTHS, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });
    let cumulative = new Decimal(0);
    let previousClosing = new Decimal(0);
    for (const row of result.projections) {
      const opening = new Decimal(row.cashOpening);
      const inflows = new Decimal(row.cashInflows);
      const outflows = new Decimal(row.cashOutflows);
      const closing = new Decimal(row.cashClosing);
      cumulative = cumulative.plus(row.operatingCashFlow);
      expect(opening.eq(previousClosing)).toBe(true);
      expect(closing.minus(opening.plus(inflows).minus(outflows)).abs().lte("0.00000002")).toBe(true);
      expect(new Decimal(row.cumulativeCashFlow).minus(cumulative).abs().lte("0.000001")).toBe(true);
      expect(new Decimal(row.activeContracts).plus(row.availableInventory! as string).eq("3120")).toBe(true);
      for (const value of Object.values(row)) {
        if (typeof value === "string") expect(new Decimal(value).isFinite()).toBe(true);
      }
      previousClosing = closing;
    }
  });
});
