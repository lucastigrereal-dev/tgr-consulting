import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import harmonyRules from "../../docs/tgr/golden/COTAS_NATAL_HARMONY_GOLDEN_V1_RULES.json";
import harmonyReference from "../../golden/natal-harmony-master-v1.reference.json";
import { calculateFinancialProjection } from "./engine";
import { calculateHarmonyCompatProjection } from "./harmonyCompat";
import {
  assertHarmonyRegressionReconciled,
  buildHarmonyTgrRegression,
  expandHarmonyRegressionConflicts,
} from "./harmonyRegression";
import {
  createHarmonyNatalInputs,
  HARMONY_NATAL_HORIZON_MONTHS,
  HARMONY_NATAL_MAX_CONTRACTS,
} from "./harmonyNatal";

function rounded(value: string | null, decimals = 0) {
  if (value === null) throw new Error("KPI Harmony esperado não pode ser nulo.");
  return new Decimal(value).toDecimalPlaces(decimals).toNumber();
}

describe("COTAS_NATAL_HARMONY_GOLDEN_V1", () => {
  it.each(Object.entries(harmonyRules.scenarios))(
    "reconcilia %s por 144 meses com zero delta publicável",
    (_scenarioId, scenario) => {
      const calculation = calculateHarmonyCompatProjection(
        createHarmonyNatalInputs("100", String(scenario.price)),
        harmonyRules.horizonMonths,
        { maxContracts: HARMONY_NATAL_MAX_CONTRACTS },
      );

      expect(HARMONY_NATAL_HORIZON_MONTHS).toBe(144);
      expect(calculation.status).toBe("valid");
      expect(calculation.projections).toHaveLength(144);
      expect(rounded(calculation.kpis.capitalRequired)).toBe(
        scenario.expected.capitalRequired,
      );
      expect(rounded(calculation.kpis.npv)).toBe(scenario.expected.npv18);
      expect(rounded(calculation.kpis.irrAnnual, 3)).toBe(
        scenario.expected.irrAnnual,
      );
      expect(rounded(calculation.kpis.paybackMonths)).toBe(
        scenario.expected.paybackMonths,
      );
      expect(rounded(calculation.kpis.grossReceivablesGenerated)).toBe(
        scenario.expected.vgv,
      );
    },
  );

  it("preserva o cronograma 4.457 e isola SC-001 na linha indicadora 4.458", () => {
    const calculation = calculateHarmonyCompatProjection(
      createHarmonyNatalInputs(),
      HARMONY_NATAL_HORIZON_MONTHS,
      { maxContracts: HARMONY_NATAL_MAX_CONTRACTS },
    );

    expect(calculation.kpis.totalGrossContracts).toBe("4457.00000000");
    expect(calculation.kpis.totalNetContracts).toBe("3120.00000000");
    expect(calculation.projections[44]).toMatchObject({
      grossContracts: "57.00000000",
      netContracts: "40.00000000",
      activeContracts: "3120.00000000",
    });
    expect(calculation.compatibilityEvidence).toMatchObject({
      authorityStatus: "CANONICAL_FROM_HARMONY_MASTER_V1",
      adoptedGrossContracts: "4457.00000000",
      sourceConflicts: [
        {
          id: "SC-001",
          status: "SOURCE_CONFLICT",
        },
      ],
    });
  });

  it("aplica integralmente a curva anual de custo fixo e o timing de t0", () => {
    const calculation = calculateHarmonyCompatProjection(
      createHarmonyNatalInputs(),
      HARMONY_NATAL_HORIZON_MONTHS,
      { maxContracts: HARMONY_NATAL_MAX_CONTRACTS },
    );

    expect(calculation.projections[0]!.fixedCosts).toBe("117203.40000000");
    expect(calculation.projections[12]!.fixedCosts).toBe("195339.00000000");
    expect(calculation.projections[48]!.fixedCosts).toBe("156271.20000000");
    expect(calculation.projections[132]!.fixedCosts).toBe("19533.90000000");
    expect(calculation.projections[0]!.preOperationalInvestment).toBe(
      "985500.00000000",
    );
  });

  it.each(Object.entries(harmonyReference.scenarios))(
    "entrega a matriz HARMONY × TGR classificada para %s sem DELTA órfão",
    (_scenarioId, scenario) => {
      const inputs = createHarmonyNatalInputs("100", scenario.price);
      const harmony = calculateHarmonyCompatProjection(inputs, 120, {
        maxContracts: HARMONY_NATAL_MAX_CONTRACTS,
      });
      const tgr = calculateFinancialProjection(inputs, 120, {
        maxContracts: HARMONY_NATAL_MAX_CONTRACTS,
      });
      const conflicts = expandHarmonyRegressionConflicts(
        harmony,
        tgr,
        "0.01",
        harmonyReference.regressionConflictCauses,
      );
      const matrix = buildHarmonyTgrRegression(harmony, tgr, {
        tolerance: "0.01",
        conflicts,
      });

      expect(() => assertHarmonyRegressionReconciled(matrix)).not.toThrow();
      expect(matrix.rows.filter(row => row.status === "MATCH")).toHaveLength(
        2_583,
      );
      expect(
        matrix.rows.filter(row => row.status === "MODEL_DELTA"),
      ).toHaveLength(2_465);
      expect(
        matrix.rows.filter(row => row.status === "SOURCE_CONFLICT"),
      ).toHaveLength(0);
      expect(matrix.rows.filter(row => row.status === "DELTA")).toHaveLength(0);
    },
  );
});
