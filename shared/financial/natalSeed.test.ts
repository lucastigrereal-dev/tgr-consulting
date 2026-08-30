import { describe, expect, it } from "vitest";
import { FINANCIAL_INPUT_KEYS } from "./types";
import { NATAL_PENDING_SEED } from "./natalSeed";

describe("NATAL_PENDING_SEED", () => {
  it("preserva todas as premissas como pendentes e rastreáveis até a fonte canônica chegar", () => {
    expect(Object.keys(NATAL_PENDING_SEED).sort()).toEqual([...FINANCIAL_INPUT_KEYS].sort());
    for (const key of FINANCIAL_INPUT_KEYS) {
      expect(NATAL_PENDING_SEED[key]).toMatchObject({ status: "pending", sourceType: "current_document", sourceRef: "HANDOFF_MESTRE_COTAS_NATAL" });
    }
  });
});
