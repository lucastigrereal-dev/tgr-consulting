import Decimal from "decimal.js";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import expected from "../../golden/natal-ponta-negra-2026.expected.json";
import {
  GOLDEN_NATAL_PONTA_NEGRA_2026,
  calculateGoldenNatalPontaNegra2026,
  createNatalPontaNegraPaymentSchedule,
} from "./natalGolden";

const D = Decimal.clone({ precision: 32, rounding: Decimal.ROUND_HALF_UP });
const ZERO = new D(0);

describe("GOLDEN_NATAL_PONTA_NEGRA_2026", () => {
  it("materializa as premissas fornecidas e identifica toda política provisória como TEST DATA", () => {
    const golden = GOLDEN_NATAL_PONTA_NEGRA_2026;

    expect(golden.metadata).toMatchObject({
      project: "Projeto Único Ponta Negra",
      location: "Natal/RN",
      units: 60,
      sharesPerUnit: 52,
      physicalContracts: 3120,
      consultants: 15,
      closers: 6,
      grossSalesPerMonth: 100,
      qualifiedToursPerMonth: 500,
      conversionRate: "0.20",
      firstBalanceDueOffsetMonths: 3,
    });
    expect(golden.metadata.provisionalPolicy.classification).toBe("TEST DATA");
    expect(golden.metadata.firstBalanceDuePolicy).toEqual({
      classification: "TEST DATA",
      days: 90,
      offsetMonths: 3,
    });
    expect(golden.options.receivablesPolicy.sourceRef).toContain("TEST_DATA");
    expect(golden.horizonMonths).toBe(120);
  });

  it("preserva 8 parcelas de entrada e inicia as 84 parcelas de saldo no offset 3", () => {
    const schedule =
      GOLDEN_NATAL_PONTA_NEGRA_2026.options.paymentSchedulePerContract;
    const entries = schedule.filter(item => item.component === "entry");
    const balance = schedule.filter(item => item.component === "balance");

    expect(entries).toHaveLength(8);
    expect(entries.map(item => item.dueMonthOffset)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(entries.every(item => item.grossAmount === "400.00000000")).toBe(true);
    expect(balance).toHaveLength(84);
    expect(balance[0]?.dueMonthOffset).toBe(3);
    expect(balance.at(-1)?.dueMonthOffset).toBe(86);

    const scheduled = schedule.reduce(
      (total, item) => total.plus(item.grossAmount),
      ZERO
    );
    const amountScale = Math.max(
      ...balance.map(item => item.grossAmount.split(".")[1]?.length ?? 0)
    );
    const fixtureRoundingTolerance = new D(balance.length)
      .pow(2)
      .div(new D(10).pow(amountScale));
    expect(
      scheduled
        .minus(GOLDEN_NATAL_PONTA_NEGRA_2026.metadata.pricePerContract)
        .abs()
        .lte(fixtureRoundingTolerance)
    ).toBe(true);

    const offsetFour = createNatalPontaNegraPaymentSchedule(4);
    expect(
      offsetFour.find(item => item.component === "balance")?.dueMonthOffset
    ).toBe(4);
  });

  it("executa 120 meses, revende estoque devolvido e reconcilia contratos, DRE, caixa e KPIs", () => {
    const startedAt = performance.now();
    const first = calculateGoldenNatalPontaNegra2026();
    const projectionElapsedMs = performance.now() - startedAt;
    expect(projectionElapsedMs).toBeLessThanOrEqual(expected.performanceBudgetMs);
    const second = calculateGoldenNatalPontaNegra2026();
    const maxContracts = new D(
      GOLDEN_NATAL_PONTA_NEGRA_2026.options.maxContracts
    );
    const outputTolerance = new D(1).div(new D(10).pow(8));
    const reconciliationTolerance = outputTolerance.times(4);
    const aggregateTolerance = outputTolerance.times(first.projections.length);

    expect(first).toEqual(second);
    expect(first.status).toBe("valid");
    expect(first.projections).toHaveLength(120);
    expect(first.projections[0]?.grossContracts).toBe("100.00000000");

    let previousActive = ZERO;
    let previousCumulativeGross = ZERO;
    let previousCash = ZERO;
    for (const row of first.projections) {
      const gross = new D(row.grossContracts);
      const canceled = new D(row.canceledContracts);
      const active = new D(row.activeContracts);
      const available = new D(row.availableInventory!);
      const cumulativeGross = new D(row.cumulativeGrossContracts);
      const opening = new D(row.cashOpening);
      const inflows = new D(row.cashInflows);
      const outflows = new D(row.cashOutflows);
      const closing = new D(row.cashClosing);
      const contribution = new D(row.recognizedRevenue)
        .minus(row.variableCosts)
        .minus(row.partnerShare)
        .minus(row.taxes);
      const operating = contribution
        .minus(row.fixedCosts)
        .minus(row.commercialOperationsCosts)
        .minus(row.commissionPayments)
        .minus(row.payroll);

      expect(active.gte(ZERO) && active.lte(maxContracts)).toBe(true);
      expect(available.gte(ZERO) && available.lte(maxContracts)).toBe(true);
      expect(
        active
          .plus(available)
          .minus(maxContracts)
          .abs()
          .lte(reconciliationTolerance)
      ).toBe(true);
      expect(
        active
          .minus(previousActive.plus(gross).minus(canceled))
          .abs()
          .lte(reconciliationTolerance)
      ).toBe(true);
      expect(
        cumulativeGross
          .minus(previousCumulativeGross.plus(gross))
          .abs()
          .lte(reconciliationTolerance)
      ).toBe(true);
      expect(
        new D(row.returnedToInventory)
          .minus(canceled)
          .abs()
          .lte(reconciliationTolerance)
      ).toBe(true);
      expect(
        opening.minus(previousCash).abs().lte(reconciliationTolerance)
      ).toBe(true);
      expect(
        closing
          .minus(opening.plus(inflows).minus(outflows))
          .abs()
          .lte(reconciliationTolerance)
      ).toBe(true);
      expect(
        new D(row.contributionMargin)
          .minus(contribution)
          .abs()
          .lte(reconciliationTolerance)
      ).toBe(true);
      expect(
        new D(row.operatingResult)
          .minus(operating)
          .abs()
          .lte(reconciliationTolerance)
      ).toBe(true);
      expect(
        new D(row.operatingCashFlow)
          .minus(closing.minus(opening))
          .abs()
          .lte(reconciliationTolerance)
      ).toBe(true);

      previousActive = active;
      previousCumulativeGross = cumulativeGross;
      previousCash = closing;
    }

    expect(
      first.projections.some(
        row =>
          new D(row.returnedToInventory).gt(ZERO) &&
          new D(row.grossContracts).gt(ZERO) &&
          new D(row.cumulativeGrossContracts).gt(maxContracts)
      )
    ).toBe(true);

    const totalGross = first.projections.reduce(
      (sum, row) => sum.plus(row.grossContracts),
      ZERO
    );
    const totalNet = first.projections.reduce(
      (sum, row) => sum.plus(row.netContracts),
      ZERO
    );
    const totalContribution = first.projections.reduce(
      (sum, row) => sum.plus(row.contributionMargin),
      ZERO
    );
    const totalOperatingResult = first.projections.reduce(
      (sum, row) => sum.plus(row.operatingResult),
      ZERO
    );
    const totalRevenue = first.projections.reduce(
      (sum, row) => sum.plus(row.recognizedRevenue),
      ZERO
    );
    const worst = first.projections.reduce((candidate, row) =>
      new D(row.cashClosing).lt(candidate.cashClosing) ? row : candidate
    );
    const expectedCapital = D.max(ZERO, new D(worst.cashClosing).negated());
    const expectedSellOut = first.projections.find(row =>
      new D(row.sellOutRate!).eq(1)
    );
    const expectedBreakEven = first.projections.find(row =>
      new D(row.cashClosing).gte(ZERO)
    );

    expect(
      new D(first.kpis.totalGrossContracts!)
        .minus(totalGross)
        .abs()
        .lte(aggregateTolerance)
    ).toBe(true);
    expect(
      new D(first.kpis.totalNetContracts!)
        .minus(totalNet)
        .abs()
        .lte(aggregateTolerance)
    ).toBe(true);
    expect(
      new D(first.kpis.totalNetContracts!)
        .minus(previousActive)
        .abs()
        .lte(aggregateTolerance)
    ).toBe(true);
    expect(
      new D(first.kpis.contributionMargin!)
        .minus(totalContribution)
        .abs()
        .lte(aggregateTolerance)
    ).toBe(true);
    expect(
      new D(first.kpis.operatingMarginRate!)
        .minus(totalOperatingResult.div(totalRevenue))
        .abs()
        .lte(aggregateTolerance)
    ).toBe(true);
    expect(
      new D(first.kpis.capitalRequired!)
        .minus(expectedCapital)
        .abs()
        .lte(aggregateTolerance)
    ).toBe(true);
    expect(first.kpis.worstCashMonth).toBe(new D(worst.month).toFixed(8));
    expect(first.kpis.sellOutMonth).toBe(
      expectedSellOut ? new D(expectedSellOut.month).toFixed(8) : null
    );
    expect(first.kpis.breakEvenMonth).toBe(
      expectedBreakEven ? new D(expectedBreakEven.month).toFixed(8) : null
    );
  }, 15_000);

  it("reproduz o vetor externo congelado com o calendário canônico", () => {
    const result = calculateGoldenNatalPontaNegra2026();
    const tolerance = new D(expected.tolerance);
    const expectDecimal = (actual: string | null, baseline: string | null) => {
      if (baseline === null) {
        expect(actual).toBeNull();
        return;
      }
      expect(actual).not.toBeNull();
      expect(new D(actual!).minus(baseline).abs().lte(tolerance)).toBe(true);
    };

    expect(expected.sourceBaselineRef).toBe("canonical-payment-calendar-v1");
    expect(result.formulaSetVersion).toBe(expected.formulaSet.semanticVersion);
    expect(result.engineVersion).toBe(expected.formulaSet.engineVersion);
    for (const [kpi, baseline] of Object.entries(expected.kpis)) {
      expectDecimal(result.kpis[kpi as keyof typeof result.kpis], baseline);
    }
    for (const sentinel of expected.months) {
      const actual = result.projections[sentinel.month - 1]!;
      for (const [field, baseline] of Object.entries(sentinel.values)) {
        expectDecimal(
          actual[field as keyof typeof sentinel.values] as string | null,
          baseline
        );
      }
    }
  }, 10_000);
});
