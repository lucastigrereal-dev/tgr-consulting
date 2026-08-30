import { describe, expect, it } from "vitest";
import { SALES_KIT_INVESTMENTS, SALES_ROOM_INVESTMENTS } from "./cotiaInvestmentCatalog";

describe("catálogo de implantação Cotia", () => {
  it("mantém cada item da sala com nível e base de quantidade operacional", () => {
    expect(SALES_ROOM_INVESTMENTS.length).toBeGreaterThan(0);
    SALES_ROOM_INVESTMENTS.forEach(item => {
      expect(item.priority).toMatch(/Essencial|Importante|Premium/);
      expect(item.capacityBasis.length).toBeGreaterThan(2);
    });
  });

  it("mantém cada peça do sales kit com uso, processo e formato definidos", () => {
    expect(SALES_KIT_INVESTMENTS.length).toBeGreaterThan(0);
    SALES_KIT_INVESTMENTS.forEach(item => {
      expect(item.objective.length).toBeGreaterThan(2);
      expect(item.priority).toMatch(/Essencial|Importante|Premium/);
      expect(item.user.length).toBeGreaterThan(2);
      expect(item.moment.length).toBeGreaterThan(2);
      expect(item.format.length).toBeGreaterThan(2);
      expect(item.delivery.length).toBeGreaterThan(2);
      expect(item.leadTimeUnit).toBe("Dias");
    });
  });
});
