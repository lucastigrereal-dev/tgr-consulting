import { formulaIdsForChapter, LIVE_DOCUMENT_CHAPTERS } from "./liveDocumentStructure";
import type { FinancialCalculation } from "@shared/financial/types";

type ChapterHref = (typeof LIVE_DOCUMENT_CHAPTERS)[number]["href"];

export function getChapterFormulaTrace(
  href: ChapterHref,
  memory: FinancialCalculation["memory"],
) {
  const formulaIds = formulaIdsForChapter(href);
  if (!formulaIds.length) {
    return { source: "ficha_mae" as const, formulas: [] };
  }
  return {
    source: "snapshot" as const,
    formulas: formulaIds.flatMap(formulaId => memory.filter(item => item.formulaId === formulaId)),
  };
}
