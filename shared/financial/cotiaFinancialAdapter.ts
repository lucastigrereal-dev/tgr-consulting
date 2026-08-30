import { calculateCotiaMatrix, parseBrazilianDecimal } from "./cotiaMatrix";
import type { FinancialInputKey } from "./types";

export type CotiaFinancialMapping = {
  inputKey: FinancialInputKey;
  label: string;
  value: string;
};

const decimalText = (value: string) => String(parseBrazilianDecimal(value));
const decimalRate = (value: string) => {
  const numeric = parseBrazilianDecimal(value);
  return String(numeric > 1 ? numeric / 100 : numeric);
};

export function buildCotiaFinancialMappings(values: Record<string, string>): CotiaFinancialMapping[] {
  const calculations = calculateCotiaMatrix(values);
  const has = (...keys: string[]) => keys.every(key => Boolean(values[key]?.trim()));
  const channelQualified = calculations.channelMetrics.reduce((total, channel) => total + channel.qualified, 0);
  const channelSales = calculations.channelMetrics.reduce((total, channel) => total + channel.sales, 0);
  const qualified = channelQualified || calculations.casaisQualificados;
  const conversion = qualified ? channelSales / qualified : 0;
  const payroll = calculations.roomMonthly + calculations.postSalesMonthly + calculations.captacaoFixaMensal + calculations.commercialTeamFixed;
  const channelRecurringBase = calculations.channelMetrics.reduce(
    (total, channel) => total + parseBrazilianDecimal(values[`${channel.key}RecorrenteMensal`]),
    0,
  );
  const channelCommission = calculations.channelMetrics.reduce((total, channel) => total + channel.commissionMonthly, 0);
  const fixedCost = calculations.opexMonthly + parseBrazilianDecimal(values.canalMidiaMensal) + channelRecurringBase;
  const monthlyGross = qualified * conversion * parseBrazilianDecimal(values.valorCota);
  const variableCost = calculations.commissionPerShare * parseBrazilianDecimal(values.cotasVendidasMes)
    + calculations.captacaoVariavelMensal
    + channelCommission
    + calculations.commercialTeamCommissionMonthly;
  const mappings: CotiaFinancialMapping[] = [];

  if (has("valorCota")) mappings.push({ inputKey: "averageTicket", label: "Valor da cota", value: decimalText(values.valorCota) });
  if (has("taxaCancelamento")) mappings.push({ inputKey: "cancellationRate", label: "Taxa de cancelamento", value: decimalRate(values.taxaCancelamento) });
  if (has("percentualAdimplente")) mappings.push({ inputKey: "collectionRate", label: "Percentual adimplente", value: decimalRate(values.percentualAdimplente) });
  if (qualified > 0) mappings.push({ inputKey: "qualifiedCouplesMonth1", label: "Casais qualificados calculados", value: String(qualified) });
  if (qualified > 0 && channelSales > 0) mappings.push({ inputKey: "conversionRate", label: "Conversão calculada por canal", value: String(conversion) });
  if (payroll > 0) mappings.push({ inputKey: "payrollMonthly", label: "Folha calculada da operação", value: String(payroll) });
  if (fixedCost > 0) mappings.push({ inputKey: "fixedCostMonthly", label: "Custo recorrente não-folha", value: String(fixedCost) });
  if (calculations.preOperationalInvestment > 0) mappings.push({ inputKey: "capexInitial", label: "Pré-investimento calculado", value: String(calculations.preOperationalInvestment) });
  if (has("mesesPreOperacao")) mappings.push({ inputKey: "preOperationMonths", label: "Meses de pré-operação", value: decimalText(values.mesesPreOperacao) });
  const implementationSchedules: { amount: number; monthKey: string; shareKey: FinancialInputKey; targetMonth: FinancialInputKey; label: string }[] = [
    { amount: calculations.acquisitionImplementationInvestment, monthKey: "implantacaoCaptacaoMes", shareKey: "capexAcquisitionShareRate", targetMonth: "capexAcquisitionMonth", label: "Ativação de captação" },
    { amount: calculations.salesRoomImplementationInvestment, monthKey: "implantacaoSalaMes", shareKey: "capexSalesRoomShareRate", targetMonth: "capexSalesRoomMonth", label: "Sala de vendas" },
    { amount: calculations.salesKitImplementationInvestment, monthKey: "implantacaoSalesKitMes", shareKey: "capexSalesKitShareRate", targetMonth: "capexSalesKitMonth", label: "Sales kit" },
  ];
  for (const schedule of implementationSchedules) {
    if (schedule.amount > 0 && has(schedule.monthKey) && calculations.preOperationalInvestment > 0) {
      mappings.push({ inputKey: schedule.shareKey, label: `Participação · ${schedule.label}`, value: String(schedule.amount / calculations.preOperationalInvestment) });
      mappings.push({ inputKey: schedule.targetMonth, label: `Mês de implantação · ${schedule.label}`, value: decimalText(values[schedule.monthKey]) });
    }
  }
  if (has("valorEntrada")) mappings.push({ inputKey: "entryValuePerContract", label: "Entrada por contrato", value: decimalText(values.valorEntrada) });
  const paymentMappings: { source: string; inputKey: FinancialInputKey; rate?: boolean; label: string }[] = [
    { source: "cartaoVistaPercentual", inputKey: "paymentCardViewMixRate", rate: true, label: "Mix cartão à vista" }, { source: "cartaoVistaTaxa", inputKey: "paymentCardViewMdrRate", rate: true, label: "MDR cartão à vista" }, { source: "cartaoVistaPrazo", inputKey: "paymentCardViewSettlementDays", label: "Prazo cartão à vista" },
    { source: "cartaoParceladoPercentual", inputKey: "paymentCardInstallmentMixRate", rate: true, label: "Mix cartão parcelado" }, { source: "cartaoParceladoTaxa", inputKey: "paymentCardInstallmentMdrRate", rate: true, label: "MDR cartão parcelado" }, { source: "cartaoParceladoPrazo", inputKey: "paymentCardInstallmentSettlementDays", label: "Prazo cartão parcelado" },
    { source: "debitoPercentual", inputKey: "paymentDebitMixRate", rate: true, label: "Mix débito" }, { source: "debitoTaxa", inputKey: "paymentDebitMdrRate", rate: true, label: "MDR débito" }, { source: "debitoPrazo", inputKey: "paymentDebitSettlementDays", label: "Prazo débito" },
    { source: "recorrenteChequePercentual", inputKey: "paymentRecurringChequeMixRate", rate: true, label: "Mix recorrente / cheque" }, { source: "recorrenteChequeTaxa", inputKey: "paymentRecurringChequeMdrRate", rate: true, label: "MDR recorrente / cheque" }, { source: "recorrenteChequePrazo", inputKey: "paymentRecurringChequeSettlementDays", label: "Prazo recorrente / cheque" },
    { source: "boletoPercentual", inputKey: "paymentBoletoMixRate", rate: true, label: "Mix boleto" }, { source: "boletoTaxa", inputKey: "paymentBoletoMdrRate", rate: true, label: "MDR boleto" }, { source: "boletoPrazo", inputKey: "paymentBoletoSettlementDays", label: "Prazo boleto" },
  ];
  for (const payment of paymentMappings) if (has(payment.source)) mappings.push({ inputKey: payment.inputKey, label: payment.label, value: payment.rate ? decimalRate(values[payment.source]) : decimalText(values[payment.source]) });
  if (monthlyGross > 0 && variableCost > 0) mappings.push({ inputKey: "variableCostRate", label: "Custo variável calculado", value: String(variableCost / monthlyGross) });
  return mappings;
}
