import { describe, expect, it } from "vitest";
import { LIVE_DOCUMENT_CHAPTERS } from "./liveDocumentStructure";

describe("estrutura editorial do estudo vivo", () => {
  it("mantém capítulos sequenciais e individuais da ficha-mãe até a conclusão", () => {
    expect(LIVE_DOCUMENT_CHAPTERS.map(chapter => chapter.title)).toEqual([
      "Montagem", "Premissas", "Produto", "Vendas", "Receita", "Custos", "Operação", "Caixa", "Cenários", "Indicadores", "Conclusão",
    ]);
    expect(new Set(LIVE_DOCUMENT_CHAPTERS.map(chapter => chapter.href)).size).toBe(LIVE_DOCUMENT_CHAPTERS.length);
    expect(LIVE_DOCUMENT_CHAPTERS.find(chapter => chapter.title === "Vendas")?.formulaIds).toEqual(["gross-sales"]);
    expect(LIVE_DOCUMENT_CHAPTERS.find(chapter => chapter.title === "Caixa")?.formulaIds).toContain("operating-cash-flow");
    expect(LIVE_DOCUMENT_CHAPTERS.find(chapter => chapter.title === "Premissas")?.formulaIds).toEqual([]);
  });
});
