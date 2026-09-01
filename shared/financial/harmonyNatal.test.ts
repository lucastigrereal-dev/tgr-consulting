import { describe, expect, it } from "vitest";
import { FINANCIAL_INPUT_KEYS } from "./types";
import {
  createHarmonyNatalInputs,
  HARMONY_NATAL_HORIZON_MONTHS,
  HARMONY_NATAL_MAX_CONTRACTS,
} from "./harmonyNatal";

describe("fixture Harmony Natal", () => {
  it("declara todos os inputs sem herdar provenance TEST_DATA", () => {
    const inputs = createHarmonyNatalInputs();

    expect(Object.keys(inputs).sort()).toEqual([...FINANCIAL_INPUT_KEYS].sort());
    expect(HARMONY_NATAL_HORIZON_MONTHS).toBe(144);
    expect(HARMONY_NATAL_MAX_CONTRACTS).toBe("3120");
    for (const [key, input] of Object.entries(inputs)) {
      expect(input.sourceRef, key).toBeTruthy();
      expect(input.sourceRef, key).not.toContain("TEST_DATA");
    }
  });

  it("deriva casais qualificados da meta comercial sem mutar outro fixture", () => {
    expect(createHarmonyNatalInputs().qualifiedCouplesMonth1.value).toBe("500");
    expect(createHarmonyNatalInputs("120").qualifiedCouplesMonth1.value).toBe("600");
    expect(createHarmonyNatalInputs("100", "35000").averageTicket.value).toBe("35000");
    expect(() => createHarmonyNatalInputs("Infinity")).toThrow("finito");
    expect(() => createHarmonyNatalInputs("-1")).toThrow("não negativo");
    expect(() => createHarmonyNatalInputs("100", "0")).toThrow("maior que zero");
  });
});
