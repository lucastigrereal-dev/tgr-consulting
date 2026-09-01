import { describe, expect, it } from "vitest";
import { calculateCotiaMatrix, parseBrazilianDecimal } from "./cotiaMatrix";

describe("calculateCotiaMatrix", () => {
  it("normaliza os formatos brasileiros usados nas linhas da matriz", () => {
    expect(parseBrazilianDecimal("1.234,56")).toBe(1234.56);
    expect(parseBrazilianDecimal("1,5")).toBe(1.5);
    expect(parseBrazilianDecimal("0.01")).toBe(0.01);
    expect(parseBrazilianDecimal("28000.00")).toBe(28000);
    expect(parseBrazilianDecimal("1.234")).toBe(1234);
    expect(parseBrazilianDecimal(undefined)).toBe(0);
  });

  it("calcula produto, comissão, operação e mix sem inventar valor para campos ausentes", () => {
    const result = calculateCotiaMatrix({
      valorCota: "35000",
      valorEntrada: "4500",
      parcelasEntrada: "96",
      cotasPorApartamento: "52",
      totalApartamentos: "40",
      cotasVendidasMes: "52",
      comissaoCorretorValor: "600",
      comissaoCorretorQuantidade: "1",
      admContratosQuantidade: "12",
      admContratosSalario: "1750",
      passagemDia: "12",
      refeicaoDia: "16",
      diasOperacaoMes: "26",
      encargosSala: "40",
      utilidadesMensal: "60000",
      cartaoVistaPercentual: "15",
      cartaoParceladoPercentual: "38",
      debitoPercentual: "17",
      recorrenteChequePercentual: "23",
      boletoPercentual: "7",
    });

    expect(result.entryInstallmentValue).toBeCloseTo(46.875);
    expect(result.totalShares).toBe(2080);
    expect(result.grossValue).toBe(72_800_000);
    expect(result.entrancePotential).toBe(9_360_000);
    expect(result.monthsOfOperation).toBe(40);
    expect(result.commissionPerShare).toBe(600);
    expect(result.opexMonthly).toBe(60_000);
    expect(result.paymentMix).toBe(100);
  });

  it("separa estoque fisico, bloqueado e vendavel sem permitir estoque negativo", () => {
    const result = calculateCotiaMatrix({
      valorCota: "28.000,00",
      cotasPorApartamento: "52",
      totalApartamentos: "60",
      cotasBloqueadas: "120",
      cotasVendidasMes: "100",
    });

    expect(result.physicalShares).toBe(3120);
    expect(result.blockedShares).toBe(120);
    expect(result.totalShares).toBe(3000);
    expect(result.grossValue).toBe(84_000_000);
    expect(result.monthsOfOperation).toBe(30);
    expect(result.inventoryViolation).toBeNull();

    const invalid = calculateCotiaMatrix({
      cotasPorApartamento: "52", totalApartamentos: "1", cotasBloqueadas: "53",
    });
    expect(invalid.totalShares).toBe(0);
    expect(invalid.inventoryViolation).toContain("exceder o estoque fisico");

    const existing = calculateCotiaMatrix({
      cotasPorApartamento: "52", totalApartamentos: "60", cotasBloqueadas: "20",
      cotasVendidasAcumuladas: "100", cotasRetornadas: "10", cotasVendidasMes: "100",
    });
    expect(existing.activeSoldShares).toBe(90);
    expect(existing.availableInventory).toBe(3010);
    expect(existing.monthsOfOperation).toBeCloseTo(30.1);
  });

  it("calcula a capacidade e o investimento de captação em separado da folha da sala", () => {
    const result = calculateCotiaMatrix({
      captadoresQuantidade: "6",
      captadorAbordagensMes: "100",
      captadorTaxaQualificacao: "50",
      captadorTaxaComparecimento: "60",
      captadorFixoMensal: "2.000,00",
      captadorIncentivoPorCasal: "20,00",
      canalMidiaMensal: "3.000,00",
      canalAtivacaoInicial: "15.000,00",
    });

    expect(result.abordagensPotenciais).toBe(600);
    expect(result.casaisQualificados).toBe(300);
    expect(result.ntProjetadas).toBe(180);
    expect(result.captacaoFixaMensal).toBe(12_000);
    expect(result.captacaoVariavelMensal).toBe(6_000);
    expect(result.captacaoMensal).toBe(21_000);
    expect(result.captacaoAtivacaoInicial).toBe(15_000);
    expect(result.custoPorCasalQualificado).toBe(70);
  });

  it("separa canais, comissão e custo por venda sem misturar volume com qualidade", () => {
    const result = calculateCotiaMatrix({
      valorCota: "35.000,00",
      ruaAtivacaoInicial: "5.000,00",
      ruaRecorrenteMensal: "2.000,00",
      ruaAbordagensMes: "1.000",
      ruaPesquisaRate: "50",
      ruaQualificacaoRate: "20",
      ruaConviteRate: "80",
      ruaAgendamentoRate: "75",
      ruaShowRate: "60",
      ruaTourRate: "100",
      ruaConversao: "10",
      ruaComissaoPorVenda: "500,00",
      ruaAtivoD90: "80",
      eventosAtivacaoInicial: "2.000,00",
      eventosRecorrenteMensal: "1.000,00",
      eventosAbordagensMes: "500",
      eventosPesquisaRate: "50",
      eventosQualificacaoRate: "20",
      eventosConviteRate: "80",
      eventosAgendamentoRate: "62,5",
      eventosShowRate: "50",
      eventosTourRate: "100",
      eventosConversao: "20",
      eventosComissaoPorVenda: "300,00",
      eventosAtivoD90: "90",
    });
    const rua = result.channelMetrics.find(channel => channel.key === "rua");
    const eventos = result.channelMetrics.find(channel => channel.key === "eventos");

    expect(rua).toMatchObject({ approaches: 1000, research: 500, qualified: 100, invites: 80, appointments: 60, attendance: 36, shows: 36, tours: 36, sales: 3.6, commissionMonthly: 1800, monthlyCost: 3800, vpg: 126000 });
    expect(rua?.activeD90).toBeCloseTo(2.88, 8);
    expect(rua?.costPerTour).toBeCloseTo(3800 / 36, 8);
    expect(rua?.costPerSale).toBeCloseTo(3800 / 3.6, 8);
    expect(eventos).toMatchObject({ approaches: 500, research: 250, qualified: 50, invites: 40, appointments: 25, attendance: 12.5, tours: 12.5, sales: 2.5, commissionMonthly: 750, monthlyCost: 1750, vpg: 87500 });
    expect(eventos?.activeD90).toBeCloseTo(2.25, 8);
    expect(eventos?.costPerAppointment).toBeCloseTo(70, 8);
    expect(eventos?.costPerSale).toBeCloseTo(700, 8);
    expect(result.channelActivation).toBe(7000);
    expect(result.channelRecurring).toBe(5550);
  });

  it("calcula capacidade, comissão e custo por venda da estrutura comercial", () => {
    const result = calculateCotiaMatrix({
      cotasVendidasMes: "10",
      linerQuantidade: "2", linerFixoMensal: "2000", linerComissaoPorVenda: "100", linerProdutividadeMes: "8",
      closerQuantidade: "1", closerFixoMensal: "5000", closerComissaoPorVenda: "300", closerProdutividadeMes: "12",
    });
    const liner = result.commercialTeamMetrics.find(role => role.key === "liner");
    const closer = result.commercialTeamMetrics.find(role => role.key === "closer");
    expect(result.commercialSalesBasis).toBe(10);
    expect(result.commercialTeamCapacity).toBe(28);
    expect(result.commercialTeamFixed).toBe(9000);
    expect(result.commercialTeamCommissionMonthly).toBe(4000);
    expect(liner).toMatchObject({ capacityMonthly: 16, fixedCost: 4000, commissionMonthly: 1000, costPerSale: 500 });
    expect(closer).toMatchObject({ capacityMonthly: 12, fixedCost: 5000, commissionMonthly: 3000, costPerSale: 800 });
  });
});
