import type { FinancialInputKey } from "./types";

export type StudyImpact = {
  chapter: string;
  outputs: string[];
};

const IMPACTS: Record<FinancialInputKey, StudyImpact[]> = {
  qualifiedCouplesMonth1: [{ chapter: "Meta e Funil", outputs: ["tours", "vendas" ] }, { chapter: "Captação e Pessoas", outputs: ["capacidade", "headcount" ] }, { chapter: "Financeiro", outputs: ["receita", "caixa", "capital" ] }],
  qualifiedCouplesGrowthRate: [{ chapter: "Meta e Funil", outputs: ["tours futuros", "vendas" ] }, { chapter: "Financeiro", outputs: ["fluxo de caixa", "VPL", "TIR" ] }],
  conversionRate: [{ chapter: "Meta e Funil", outputs: ["tours necessários", "vendas" ] }, { chapter: "Captação e Pessoas", outputs: ["canais", "equipe", "sala" ] }, { chapter: "Financeiro", outputs: ["receita", "caixa", "capital" ] }],
  averageTicket: [{ chapter: "Produto e Condição", outputs: ["VGV", "entrada", "saldo" ] }, { chapter: "Carteira e Financeiro", outputs: ["recebíveis", "caixa", "VPL", "TIR" ] }],
  collectionRate: [{ chapter: "Carteira", outputs: ["recebimento esperado", "contratos ativos" ] }, { chapter: "Financeiro", outputs: ["caixa", "capital necessário", "payback" ] }],
  cancellationRate: [{ chapter: "Carteira", outputs: ["vendas saudáveis", "estoque retornado" ] }, { chapter: "Financeiro", outputs: ["receita", "caixa", "VPL" ] }],
  variableCostRate: [{ chapter: "Custos Variáveis", outputs: ["margem de contribuição", "custo por venda" ] }, { chapter: "Financeiro", outputs: ["caixa", "VPL", "payback" ] }],
  partnerShareRate: [{ chapter: "Repasses", outputs: ["repasse elegível", "margem" ] }, { chapter: "Financeiro", outputs: ["caixa", "capital", "TIR" ] }],
  fixedCostMonthly: [{ chapter: "Custos Fixos", outputs: ["OPEX mensal", "break-even" ] }, { chapter: "Financeiro", outputs: ["caixa", "capital necessário", "payback" ] }],
  payrollMonthly: [{ chapter: "Pessoas", outputs: ["folha", "custo de operação" ] }, { chapter: "Financeiro", outputs: ["OPEX", "caixa", "capital" ] }],
  capexInitial: [{ chapter: "Investimento", outputs: ["implantação", "capital inicial" ] }, { chapter: "Financeiro", outputs: ["caixa", "VPL", "payback" ] }],
  capexAcquisitionShareRate: [{ chapter: "Investimento", outputs: ["captação", "alocação de capital" ] }, { chapter: "Financeiro", outputs: ["caixa", "capital necessário" ] }],
  capexAcquisitionMonth: [{ chapter: "Investimento", outputs: ["cronograma de captação", "abertura" ] }, { chapter: "Financeiro", outputs: ["caixa", "payback" ] }],
  capexSalesRoomShareRate: [{ chapter: "Investimento", outputs: ["sala de vendas", "alocação de capital" ] }, { chapter: "Financeiro", outputs: ["caixa", "capital necessário" ] }],
  capexSalesRoomMonth: [{ chapter: "Investimento", outputs: ["cronograma da sala", "abertura" ] }, { chapter: "Financeiro", outputs: ["caixa", "payback" ] }],
  capexSalesKitShareRate: [{ chapter: "Investimento", outputs: ["sales kit", "alocação de capital" ] }, { chapter: "Financeiro", outputs: ["caixa", "capital necessário" ] }],
  capexSalesKitMonth: [{ chapter: "Investimento", outputs: ["cronograma do sales kit", "abertura" ] }, { chapter: "Financeiro", outputs: ["caixa", "payback" ] }],
  preOperationMonths: [{ chapter: "Investimento", outputs: ["cronograma de implantação", "abertura operacional" ] }, { chapter: "Financeiro", outputs: ["caixa", "capital necessário", "payback" ] }],
  entryValuePerContract: [{ chapter: "Produto e Condição", outputs: ["entrada", "condição comercial" ] }, { chapter: "Financeiro", outputs: ["recebimento líquido", "caixa", "VPL" ] }],
  paymentCardViewMixRate: [{ chapter: "Recebimento", outputs: ["mix", "MDR ponderado", "caixa" ] }],
  paymentCardViewMdrRate: [{ chapter: "Recebimento", outputs: ["taxas", "entrada líquida", "caixa" ] }],
  paymentCardViewSettlementDays: [{ chapter: "Recebimento", outputs: ["prazo", "cronograma de caixa", "capital" ] }],
  paymentCardInstallmentMixRate: [{ chapter: "Recebimento", outputs: ["mix", "MDR ponderado", "caixa" ] }],
  paymentCardInstallmentMdrRate: [{ chapter: "Recebimento", outputs: ["taxas", "entrada líquida", "caixa" ] }],
  paymentCardInstallmentSettlementDays: [{ chapter: "Recebimento", outputs: ["prazo", "cronograma de caixa", "capital" ] }],
  paymentDebitMixRate: [{ chapter: "Recebimento", outputs: ["mix", "MDR ponderado", "caixa" ] }],
  paymentDebitMdrRate: [{ chapter: "Recebimento", outputs: ["taxas", "entrada líquida", "caixa" ] }],
  paymentDebitSettlementDays: [{ chapter: "Recebimento", outputs: ["prazo", "cronograma de caixa", "capital" ] }],
  paymentRecurringChequeMixRate: [{ chapter: "Recebimento", outputs: ["mix", "MDR ponderado", "caixa" ] }],
  paymentRecurringChequeMdrRate: [{ chapter: "Recebimento", outputs: ["taxas", "entrada líquida", "caixa" ] }],
  paymentRecurringChequeSettlementDays: [{ chapter: "Recebimento", outputs: ["prazo", "cronograma de caixa", "capital" ] }],
  paymentBoletoMixRate: [{ chapter: "Recebimento", outputs: ["mix", "MDR ponderado", "caixa" ] }],
  paymentBoletoMdrRate: [{ chapter: "Recebimento", outputs: ["taxas", "entrada líquida", "caixa" ] }],
  paymentBoletoSettlementDays: [{ chapter: "Recebimento", outputs: ["prazo", "cronograma de caixa", "capital" ] }],
  discountRateAnnual: [{ chapter: "Indicadores", outputs: ["VPL", "comparação de cenário" ] }],
};

export function getStudyImpacts(keys: Iterable<FinancialInputKey>): StudyImpact[] {
  const merged = new Map<string, Set<string>>();
  Array.from(keys).forEach((key) => {
    IMPACTS[key].forEach((impact) => {
      const outputs = merged.get(impact.chapter) ?? new Set<string>();
      impact.outputs.forEach((output) => outputs.add(output));
      merged.set(impact.chapter, outputs);
    });
  });
  return Array.from(merged.entries()).map(([chapter, outputs]) => ({ chapter, outputs: Array.from(outputs) }));
}
