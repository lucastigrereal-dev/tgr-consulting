export const LIVE_DOCUMENT_CHAPTERS = [
  { number: "01", title: "Montagem", href: "/builder", external: true, formulaIds: [] },
  { number: "02", title: "Premissas", href: "#study-assumptions", formulaIds: [] },
  { number: "03", title: "Produto", href: "#study-product", formulaIds: [] },
  { number: "04", title: "Vendas", href: "#study-sales", formulaIds: ["gross-sales"] },
  { number: "05", title: "Receita", href: "#study-revenue", formulaIds: ["gross-entry-generated", "net-entry-collections", "payment-terms-net-settlement"] },
  { number: "06", title: "Custos", href: "#study-costs", formulaIds: ["commercial-team-monthly-cost", "operating-cash-flow"] },
  { number: "07", title: "Operação", href: "#study-operation", formulaIds: ["pre-operational-investment", "commercial-team-monthly-cost", "operating-cash-flow"] },
  { number: "08", title: "Caixa", href: "#study-cashflow", formulaIds: ["net-entry-collections", "payment-terms-net-settlement", "pre-operational-investment", "commercial-team-monthly-cost", "operating-cash-flow"] },
  { number: "09", title: "Cenários", href: "#study-scenarios", formulaIds: ["operating-cash-flow", "npv", "irr", "payback"] },
  { number: "10", title: "Indicadores", href: "#study-impact", formulaIds: ["npv", "irr", "payback"] },
  { number: "11", title: "Conclusão", href: "#study-conclusion", formulaIds: ["operating-cash-flow", "npv", "irr", "payback"] },
] as const;

export function formulaIdsForChapter(href: (typeof LIVE_DOCUMENT_CHAPTERS)[number]["href"]): readonly string[] {
  return LIVE_DOCUMENT_CHAPTERS.find(chapter => chapter.href === href)?.formulaIds ?? [];
}
