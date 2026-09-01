import { describe, expect, it } from "vitest";
import { HARMONY_COMPAT_FORMULA_SET_V1, IGR_CORE_FORMULA_SET_V1 } from "./formulas";
import {
  FINANCIAL_MODEL_MODE_REGISTRY,
  getFinancialModelModeDefinition,
  resolveFinancialModelModeByFormulaSetId,
  resolveLegacyFinancialModelMode,
  TGR_CANONICAL_LEGACY_VERSION_PAIRS,
} from "./modelMode";

describe("modos explícitos de metodologia financeira", () => {
  it("publica identidades estáveis para Harmony compatível e TGR canônico", () => {
    expect(Object.keys(FINANCIAL_MODEL_MODE_REGISTRY).sort()).toEqual([
      "HARMONY_COMPAT_V1",
      "TGR_CANONICAL_V2",
    ]);

    expect(getFinancialModelModeDefinition("TGR_CANONICAL_V2")).toMatchObject({
      id: "TGR_CANONICAL_V2",
      label: "TGR Canônico V2",
      formulaSetVersion: IGR_CORE_FORMULA_SET_V1,
    });
    expect(getFinancialModelModeDefinition("HARMONY_COMPAT_V1")).toMatchObject({
      id: "HARMONY_COMPAT_V1",
      label: "Harmony Compatível V1",
      formulaSetVersion: HARMONY_COMPAT_FORMULA_SET_V1,
    });
  });

  it("mantém ambos os conjuntos publicados e com descrição operacional", () => {
    for (const definition of Object.values(FINANCIAL_MODEL_MODE_REGISTRY)) {
      expect(definition.description.length).toBeGreaterThan(20);
      expect(definition.formulaSetVersion.status).toBe("published");
    }
  });

  it("rejeita modo desconhecido com erro de domínio em runtime", () => {
    expect(() => getFinancialModelModeDefinition("LEGACY_UNKNOWN")).toThrow(
      "Modo financeiro inválido: LEGACY_UNKNOWN."
    );
    expect(() => getFinancialModelModeDefinition(undefined)).toThrow(
      "Modo financeiro inválido: undefined."
    );
  });

  it("resolve o modo somente pela identidade exata do conjunto persistido e falha fechado", () => {
    expect(resolveFinancialModelModeByFormulaSetId(IGR_CORE_FORMULA_SET_V1.id)).toBe(
      "TGR_CANONICAL_V2"
    );
    expect(
      resolveFinancialModelModeByFormulaSetId(HARMONY_COMPAT_FORMULA_SET_V1.id)
    ).toBe("HARMONY_COMPAT_V1");
    expect(() => resolveFinancialModelModeByFormulaSetId("formula-set-desconhecido"))
      .toThrow("Conjunto de fórmulas sem modo financeiro registrado");
  });

  it("mantém allowlist histórica auditável de versões canônicas", () => {
    expect(TGR_CANONICAL_LEGACY_VERSION_PAIRS).toHaveLength(7);
    for (const pair of TGR_CANONICAL_LEGACY_VERSION_PAIRS) {
      expect(pair.sourceRef).toMatch(/^git:[0-9a-f]{7}$/);
      expect(
        resolveLegacyFinancialModelMode(
          pair.formulaSetVersion,
          pair.engineVersion
        )
      ).toBe("TGR_CANONICAL_V2");
    }
    expect(
      resolveLegacyFinancialModelMode("1.3.0", "igr-engine-1.4.0")
    ).toBeNull();
    expect(
      resolveLegacyFinancialModelMode("9.9.9", "igr-engine-9.9.9")
    ).toBeNull();
  });
});
