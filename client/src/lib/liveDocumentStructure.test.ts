import { describe, expect, it } from "vitest";
import { LIVE_DOCUMENT_CHAPTERS } from "./liveDocumentStructure";

describe("Boardroom premium chapters", () => {
  it("exposes the 16 minimum BRD chapters in order", () => {
    expect(LIVE_DOCUMENT_CHAPTERS.map(chapter => chapter.title)).toEqual([
      "Executive Summary",
      "Product & Inventory",
      "Commercial Condition",
      "Market / ICP",
      "Captation",
      "Point Economics",
      "Sales Room",
      "Workforce",
      "Costs",
      "Payment Mix",
      "Portfolio / D90",
      "Cash",
      "Capital",
      "Scenarios",
      "Risks",
      "Decisions",
    ]);
    expect(new Set(LIVE_DOCUMENT_CHAPTERS.map(chapter => chapter.href)).size).toBe(LIVE_DOCUMENT_CHAPTERS.length);
    expect(LIVE_DOCUMENT_CHAPTERS.find(chapter => chapter.title === "Sales Room")?.formulaIds).toEqual(["gross-sales"]);
    expect(LIVE_DOCUMENT_CHAPTERS.find(chapter => chapter.title === "Cash")?.formulaIds).toContain("operating-cash-flow");
    expect(LIVE_DOCUMENT_CHAPTERS.find(chapter => chapter.title === "Product & Inventory")?.formulaIds).toEqual([]);
  });
});
