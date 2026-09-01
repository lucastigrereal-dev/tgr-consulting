import { describe, expect, it } from "vitest";
import {
  HARMONY_COMPAT_FORMULA_SET_V1,
  IGR_CORE_FORMULA_SET_V1,
} from "../../shared/financial/formulas";
import { calculateAuthoritativeSnapshot } from "./snapshot";
import type { FinancialInputSnapshot } from "../../shared/financial/types";

const provided = (value: string) => ({ status: "provided" as const, value, sourceType: "assumption" as const });
const inputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("5"), qualifiedCouplesGrowthRate: provided("0"), conversionRate: provided("0.1"),
  averageTicket: provided("1000"), collectionRate: provided("1"), cancellationRate: provided("0"),
  variableCostRate: provided("0"), partnerShareRate: provided("0"), fixedCostMonthly: provided("0"),
  payrollMonthly: provided("0"), capexInitial: provided("0"), preOperationMonths: provided("0"), entryValuePerContract: provided("100"),
  paymentCardViewMixRate: provided("0"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"),
  paymentCardInstallmentMixRate: provided("0"), paymentCardInstallmentMdrRate: provided("0"), paymentCardInstallmentSettlementDays: provided("0"),
  paymentDebitMixRate: provided("0"), paymentDebitMdrRate: provided("0"), paymentDebitSettlementDays: provided("0"),
  paymentRecurringChequeMixRate: provided("0"), paymentRecurringChequeMdrRate: provided("0"), paymentRecurringChequeSettlementDays: provided("0"),
  paymentBoletoMixRate: provided("1"), paymentBoletoMdrRate: provided("0"), paymentBoletoSettlementDays: provided("0"), discountRateAnnual: provided("0"),
};

describe("snapshot autoritativo", () => {
  it("produz hash estável para a mesma entrada", () => {
    const first = calculateAuthoritativeSnapshot({ projectVersionId: "version-a", inputs, horizonMonths: 12, formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id });
    const second = calculateAuthoritativeSnapshot({ projectVersionId: "version-a", inputs, horizonMonths: 12, formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id });
    expect(first.snapshotHash).toEqual(second.snapshotHash);
    expect(first.snapshotHash).toHaveLength(64);
    expect(first.financialModelMode).toBe("TGR_CANONICAL_V2");
  });

  it("escopa o hash pela versão sem perder determinismo dentro da mesma versão", () => {
    const firstVersion = calculateAuthoritativeSnapshot({
      projectVersionId: "version-a",
      inputs,
      horizonMonths: 12,
      formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id,
    });
    const secondVersion = calculateAuthoritativeSnapshot({
      projectVersionId: "version-b",
      inputs,
      horizonMonths: 12,
      formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id,
    });
    const repeated = calculateAuthoritativeSnapshot({
      projectVersionId: "version-a",
      inputs,
      horizonMonths: 12,
      formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id,
    });

    expect(firstVersion.snapshotHash).toBe(repeated.snapshotHash);
    expect(firstVersion.snapshotHash).not.toBe(secondVersion.snapshotHash);
  });

  it("inclui horizonte e data-base na identidade mesmo quando o snapshot está bloqueado", () => {
    const base = {
      projectVersionId: "version-blocked-identity",
      inputs,
      formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id,
      domainBlockers: ["product_catalog.missing"],
    };
    const reference = calculateAuthoritativeSnapshot({
      ...base,
      horizonMonths: 12,
      asOfMonth: 0,
    });
    const anotherAsOf = calculateAuthoritativeSnapshot({
      ...base,
      horizonMonths: 12,
      asOfMonth: 1,
    });
    const anotherHorizon = calculateAuthoritativeSnapshot({
      ...base,
      horizonMonths: 24,
      asOfMonth: 0,
    });

    expect(reference.status).toBe("blocked_by_pending_inputs");
    expect(reference.snapshotHash).not.toBe(anotherAsOf.snapshotHash);
    expect(reference.snapshotHash).not.toBe(anotherHorizon.snapshotHash);
  });

  it("despacha Harmony para o engine compatível e mantém hash determinístico isolado por modo", () => {
    const harmony = calculateAuthoritativeSnapshot({
      projectVersionId: "version-harmony",
      inputs,
      horizonMonths: 12,
      financialModelMode: "HARMONY_COMPAT_V1",
      formulaSetVersionId: HARMONY_COMPAT_FORMULA_SET_V1.id,
      calculationOptions: { maxContracts: "3120" },
    });
    const repeated = calculateAuthoritativeSnapshot({
      projectVersionId: "version-harmony",
      inputs,
      horizonMonths: 12,
      financialModelMode: "HARMONY_COMPAT_V1",
      formulaSetVersionId: HARMONY_COMPAT_FORMULA_SET_V1.id,
      calculationOptions: { maxContracts: "3120" },
    });
    const canonical = calculateAuthoritativeSnapshot({
      projectVersionId: "version-harmony",
      inputs,
      horizonMonths: 12,
      formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id,
    });

    expect(harmony.status).toBe("valid");
    expect(harmony.financialModelMode).toBe("HARMONY_COMPAT_V1");
    expect(harmony.formulaSetVersion).toBe("1.0.0");
    expect(harmony.engineVersion).toBe("harmony-compat-engine-v1");
    expect(harmony.snapshotHash).toBe(repeated.snapshotHash);
    expect(harmony.snapshotHash).not.toBe(canonical.snapshotHash);
  });

  it("recusa Formula Set incompatível com o modo declarado", () => {
    expect(() =>
      calculateAuthoritativeSnapshot({
        projectVersionId: "version-a",
        inputs,
        horizonMonths: 12,
        financialModelMode: "HARMONY_COMPAT_V1",
        formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id,
      })
    ).toThrow(HARMONY_COMPAT_FORMULA_SET_V1.id);
  });

  it("sela Harmony bloqueado ou inválido sem executar o engine nem exigir estoque", () => {
    const blocked = calculateAuthoritativeSnapshot({
      projectVersionId: "version-a",
      inputs,
      horizonMonths: 12,
      financialModelMode: "HARMONY_COMPAT_V1",
      formulaSetVersionId: HARMONY_COMPAT_FORMULA_SET_V1.id,
      domainBlockers: ["product_catalog.missing"],
    });
    const invalid = calculateAuthoritativeSnapshot({
      projectVersionId: "version-a",
      inputs,
      horizonMonths: 12,
      financialModelMode: "HARMONY_COMPAT_V1",
      formulaSetVersionId: HARMONY_COMPAT_FORMULA_SET_V1.id,
      domainInvalidities: ["product_catalog.invalid"],
    });

    expect(blocked.status).toBe("blocked_by_pending_inputs");
    expect(invalid.status).toBe("invalid");
    for (const result of [blocked, invalid]) {
      expect(result.formulaSetVersion).toBe("1.0.0");
      expect(result.engineVersion).toBe("harmony-compat-engine-v1");
      expect(result.projections).toEqual([]);
      expect(Object.values(result.kpis).every(value => value === null)).toBe(true);
      expect(result.snapshotHash).toHaveLength(64);
    }
  });

  it("falha em runtime se JavaScript contornar o contrato tipado de estoque Harmony", () => {
    const unsafeCall = calculateAuthoritativeSnapshot as unknown as (
      params: Record<string, unknown>
    ) => unknown;
    expect(() => unsafeCall({
      projectVersionId: "version-a",
      inputs,
      horizonMonths: 12,
      financialModelMode: "HARMONY_COMPAT_V1",
      formulaSetVersionId: HARMONY_COMPAT_FORMULA_SET_V1.id,
    })).toThrow("calculationOptions.maxContracts");
  });

  it("recusa combinar ID histórico com o motor financeiro ativo", () => {
    expect(() =>
      calculateAuthoritativeSnapshot({
        projectVersionId: "version-a",
        inputs,
        horizonMonths: 12,
        formulaSetVersionId: "igr-core-formulas-v1",
      })
    ).toThrow(IGR_CORE_FORMULA_SET_V1.id);
  });

  it("não expõe KPIs nem projeções quando um domínio autoritativo bloqueia o cálculo", () => {
    const result = calculateAuthoritativeSnapshot({
      projectVersionId: "version-a",
      inputs,
      horizonMonths: 12,
      formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id,
      domainBlockers: ["product_catalog.missing"],
    });

    expect(result.status).toBe("blocked_by_pending_inputs");
    expect(result.projections).toEqual([]);
    expect(result.memory).toEqual([]);
    expect(Object.values(result.kpis).every(value => value === null)).toBe(true);
  });

  it("prioriza invalididade autoritativa mesmo quando o motor financeiro tem pendências", () => {
    const pendingInputs: FinancialInputSnapshot = {
      ...inputs,
      averageTicket: { status: "pending", sourceType: "current_decision" },
    };
    const result = calculateAuthoritativeSnapshot({
      projectVersionId: "version-a",
      inputs: pendingInputs,
      horizonMonths: 12,
      formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id,
      domainInvalidities: ["product_catalog.invalid"],
    });

    expect(result.status).toBe("invalid");
    expect(result.projections).toEqual([]);
    expect(Object.values(result.kpis).every(value => value === null)).toBe(true);
  });
});
