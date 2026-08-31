export type LiveDocumentChapter = {
  number: string;
  title: string;
  href: string;
  formulaIds: readonly string[];
};

export const LIVE_DOCUMENT_CHAPTERS: readonly LiveDocumentChapter[] = [
  { number: "01", title: "Executive Summary", href: "#study-executive-summary", formulaIds: ["npv", "irr", "payback", "operating-cash-flow"] },
  { number: "02", title: "Product & Inventory", href: "#study-product-inventory", formulaIds: [] },
  { number: "03", title: "Commercial Condition", href: "#study-commercial-condition", formulaIds: ["gross-entry-generated", "payment-terms-net-settlement"] },
  { number: "04", title: "Market / ICP", href: "#study-market-icp", formulaIds: [] },
  { number: "05", title: "Captation", href: "#study-captation", formulaIds: ["gross-sales"] },
  { number: "06", title: "Point Economics", href: "#study-point-economics", formulaIds: ["gross-sales", "healthy-d90"] },
  { number: "07", title: "Sales Room", href: "#study-sales-room", formulaIds: ["gross-sales"] },
  { number: "08", title: "Workforce", href: "#study-workforce", formulaIds: ["commercial-team-monthly-cost"] },
  { number: "09", title: "Costs", href: "#study-costs", formulaIds: ["commercial-team-monthly-cost", "operating-cash-flow"] },
  { number: "10", title: "Payment Mix", href: "#study-payment-mix", formulaIds: ["net-entry-collections", "payment-terms-net-settlement"] },
  { number: "11", title: "Portfolio / D90", href: "#study-portfolio-d90", formulaIds: ["gross-receivables-generated", "canceled-receivables", "delinquent-balance", "cured-collections", "written-off-balance", "healthy-d90"] },
  { number: "12", title: "Cash", href: "#study-cash", formulaIds: ["net-entry-collections", "pre-operational-investment", "commercial-team-monthly-cost", "operating-cash-flow"] },
  { number: "13", title: "Capital", href: "#study-capital", formulaIds: ["pre-operational-investment", "operating-cash-flow", "npv"] },
  { number: "14", title: "Scenarios", href: "#study-scenarios", formulaIds: ["operating-cash-flow", "npv", "irr", "payback"] },
  { number: "15", title: "Risks", href: "#study-risks", formulaIds: ["operating-cash-flow", "npv"] },
  { number: "16", title: "Decisions", href: "#study-decisions", formulaIds: ["operating-cash-flow", "npv", "irr", "payback"] },
] as const;

export function formulaIdsForChapter(href: (typeof LIVE_DOCUMENT_CHAPTERS)[number]["href"]): readonly string[] {
  return LIVE_DOCUMENT_CHAPTERS.find(chapter => chapter.href === href)?.formulaIds ?? [];
}
