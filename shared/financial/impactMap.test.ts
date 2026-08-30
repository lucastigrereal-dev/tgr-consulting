import { describe, expect, it } from "vitest";
import { getStudyImpacts } from "./impactMap";

describe("getStudyImpacts", () => {
  it("expõe a cascata de uma alteração de conversão sem duplicar capítulos", () => {
    const impacts = getStudyImpacts(["conversionRate", "qualifiedCouplesMonth1"]);
    expect(impacts.map((impact) => impact.chapter)).toContain("Meta e Funil");
    expect(impacts.find((impact) => impact.chapter === "Financeiro")?.outputs).toContain("caixa");
    expect(impacts.filter((impact) => impact.chapter === "Captação e Pessoas")).toHaveLength(1);
  });
});
