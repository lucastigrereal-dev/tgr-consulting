import { describe, expect, it } from "vitest";
import { calculateFinancialProjection } from "./engine";
import { calculateHarmonyCompatProjection } from "./harmonyCompat";
import {
  assertHarmonyRegressionReconciled,
  buildHarmonyKpiTargetRegression,
  buildHarmonyTgrRegression,
  expandHarmonyRegressionConflicts,
} from "./harmonyRegression";
import { createHarmonyNatalInputs, HARMONY_NATAL_MAX_CONTRACTS } from "./harmonyNatal";
import harmonyReference from "../../golden/natal-harmony-master-v1.reference.json";

describe("reconciliação Harmony x TGR", () => {
  it("produz linhas mensais e KPIs com delta e conflito de fonte explícitos", () => {
    const inputs = createHarmonyNatalInputs();
    const harmony = calculateHarmonyCompatProjection(inputs, 120, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });
    const tgr = calculateFinancialProjection(inputs, 120, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });
    const report = buildHarmonyTgrRegression(harmony, tgr, {
      tolerance: "0.01",
      conflicts: [
        {
          id: "variable-costs-m1",
          classification: "MODEL_DELTA",
          sourceRef: harmonyReference.authority.reviewUrl,
          reason: "Harmony usa rubricas unitárias provisórias que não pertencem ao modo canônico.",
          adoptedRule: "Preservar o custo por contrato apenas no modo Harmony.",
          metric: "variableCosts",
          month: 1,
        },
        {
          id: "fixed-m49",
          classification: "SOURCE_CONFLICT",
          sourceRef: harmonyReference.authority.reviewUrl,
          reason: "A curva posterior a M48 não está na fonte disponível.",
          adoptedRule: "Zero após M48 até a planilha completa ser localizada.",
          metric: "fixedCosts",
          month: 49,
        },
        {
          id: "capital-kpi",
          classification: "SOURCE_CONFLICT",
          sourceRef: harmonyReference.authority.reviewUrl,
          reason: "Timing de custos e curva posterior a M48 estão ausentes.",
          adoptedRule: "Usar somente timings explicitamente documentados.",
          metric: "capitalRequired",
          month: null,
        },
      ],
    });

    expect(report.tolerance).toBe("0.01");
    expect(report.monthly.some(row => row.metric === "grossContracts" && row.month === 1)).toBe(true);
    expect(report.monthly.some(row => row.metric === "cumulativeCashFlow" && row.month === 120)).toBe(true);
    expect(report.kpis.some(row => row.metric === "sellOutMonth")).toBe(true);
    expect(report.rows.every(row => ["MATCH", "DELTA", "MODEL_DELTA", "SOURCE_CONFLICT"].includes(row.status))).toBe(true);
    expect(report.rows.find(row => row.metric === "variableCosts" && row.month === 1)).toMatchObject({
      status: "MODEL_DELTA",
      conflictId: "variable-costs-m1",
      justification: { sourceRef: harmonyReference.authority.reviewUrl },
    });
    expect(report.rows.find(row => row.metric === "capitalRequired")).toMatchObject({
      status: "SOURCE_CONFLICT",
      conflictId: "capital-kpi",
    });
    expect(report.rows.find(row => row.metric === "fixedCosts" && row.month === 49)).toMatchObject({
      status: "SOURCE_CONFLICT",
      conflictId: "fixed-m49",
    });
    expect(() => assertHarmonyRegressionReconciled(report)).toThrow("DELTA");
  });

  it("expande causas do fixture em células exatas e reconcilia o relatório real sem DELTA", () => {
    const inputs = createHarmonyNatalInputs();
    const harmony = calculateHarmonyCompatProjection(inputs, 120, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });
    const tgr = calculateFinancialProjection(inputs, 120, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });
    const conflicts = expandHarmonyRegressionConflicts(
      harmony,
      tgr,
      "0.01",
      harmonyReference.regressionConflictCauses
    );
    const report = buildHarmonyTgrRegression(harmony, tgr, { tolerance: "0.01", conflicts });
    expect(conflicts.every(conflict => conflict.month !== undefined)).toBe(true);
    expect(report.monthly).toHaveLength(5_040);
    expect(report.kpis).toHaveLength(8);
    expect(report.rows).toHaveLength(5_048);
    expect(report.rows.filter(row => row.status === "DELTA")).toHaveLength(0);
    expect(report.rows.filter(row => row.status === "MATCH")).toHaveLength(2_633);
    expect(report.rows.filter(row => row.status === "MODEL_DELTA")).toHaveLength(2_415);
    expect(report.rows.filter(row => row.status === "MODEL_DELTA")
      .every(row => Boolean(row.justification?.causalId))).toBe(true);
    expect(report.rows.filter(row => row.status === "SOURCE_CONFLICT")).toHaveLength(0);
    expect(report.kpis.find(row => row.metric === "delinquentBalance")).toMatchObject({
      status: "MODEL_DELTA",
      justification: {
        classification: "MODEL_DELTA",
        causalId: "cross-mode-kpis",
      },
    });
    expect(() => assertHarmonyRegressionReconciled(report)).not.toThrow();
  });

  it("rejeita conflito genérico, duplicado ou que não corresponde a uma célula", () => {
    const calculation = calculateHarmonyCompatProjection(createHarmonyNatalInputs(), 120, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });
    const canonical = calculateFinancialProjection(createHarmonyNatalInputs(), 120, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });
    const base = {
      id: "invalid",
      classification: "SOURCE_CONFLICT" as const,
      sourceRef: harmonyReference.authority.reviewUrl,
      reason: "Motivo auditável.",
      adoptedRule: "Regra auditável.",
      metric: "fixedCosts",
      month: null,
    };
    expect(() => buildHarmonyTgrRegression(calculation, canonical, {
      tolerance: "0.01",
      conflicts: [base],
    })).toThrow("célula mensal");
    expect(() => buildHarmonyTgrRegression(calculation, canonical, {
      tolerance: "0.01",
      conflicts: [{ ...base, month: 49 }, { ...base, month: 49 }],
    })).toThrow("duplicado");
    expect(() => buildHarmonyTgrRegression(calculation, canonical, {
      tolerance: "0.01",
      conflicts: [{ ...base, metric: "not-a-metric", month: 1 }],
    })).toThrow("inexistente");
    expect(() => buildHarmonyTgrRegression(calculation, canonical, {
      tolerance: "0.01",
      conflicts: [{ ...base, month: 1 }],
    })).toThrow("MATCH");
    expect(() => buildHarmonyTgrRegression(calculation, canonical, {
      tolerance: "0.01",
      conflicts: [{ ...base, classification: "INVALID" as never, month: 49 }],
    })).toThrow("classificação inválida");
    expect(() => buildHarmonyTgrRegression(calculation, canonical, {
      tolerance: "NaN",
    })).toThrow("finita");
    expect(() => buildHarmonyTgrRegression(calculation, canonical, {
      tolerance: "Infinity",
    })).toThrow("finita");
    expect(() => buildHarmonyTgrRegression(calculation, calculation, {
      tolerance: "0.01",
    })).toThrow("primeiro cálculo");
    expect(() => buildHarmonyTgrRegression(canonical, calculation, {
      tolerance: "0.01",
    })).toThrow("primeiro cálculo");
  });

  it("consome todos os KPI targets do fixture e justifica todo delta fora da tolerância", () => {
    const harmony = calculateHarmonyCompatProjection(createHarmonyNatalInputs(), 120, { maxContracts: HARMONY_NATAL_MAX_CONTRACTS });
    const result = buildHarmonyKpiTargetRegression(
      harmony,
      harmonyReference.reviewKpiTargets,
      harmonyReference.kpiConflicts
    );

    expect(Object.keys(harmonyReference.reviewKpiTargets).sort()).toEqual(
      result.map(row => row.metric).sort()
    );
    for (const row of result) {
      const recorded = harmonyReference.reviewKpiTargets[
        row.metric as keyof typeof harmonyReference.reviewKpiTargets
      ].observedAtImplementation;
      expect(row).toMatchObject(recorded);
    }
    const causalIds = new Set(harmonyReference.sourceConflicts.map(conflict => conflict.id));
    for (const conflict of harmonyReference.kpiConflicts)
      expect(conflict.causalConflictIds.every(id => causalIds.has(id))).toBe(true);
    expect(result.find(row => row.metric === "sellOutMonth")).toMatchObject({
      target: "45",
      obtained: "45.00000000",
      absoluteDelta: "0.00000000",
      relativeDelta: "0.00000000",
      status: "MATCH",
    });
    for (const metric of ["capitalRequired", "npv", "irrAnnual", "paybackMonths"] as const) {
      expect(result.find(row => row.metric === metric)).toMatchObject({
        status: "SOURCE_CONFLICT",
        sourceRef: harmonyReference.authority.reviewUrl,
      });
      expect(result.find(row => row.metric === metric)?.causalConflictIds.length).toBeGreaterThan(0);
    }

    expect(() => buildHarmonyKpiTargetRegression(
      harmony,
      harmonyReference.reviewKpiTargets,
      []
    )).toThrow("DELTA fora da tolerância sem justificativa");

    const withoutCapital = structuredClone(harmony);
    withoutCapital.kpis.capitalRequired = null;
    expect(() => buildHarmonyKpiTargetRegression(
      withoutCapital,
      harmonyReference.reviewKpiTargets,
      harmonyReference.kpiConflicts
    )).toThrow("capitalRequired não possui resultado");
  });
});
