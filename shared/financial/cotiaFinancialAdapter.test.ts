import { describe, expect, it } from "vitest";
import { buildCotiaFinancialMappings } from "./cotiaFinancialAdapter";

describe("adaptador financeiro da matriz Cotia", () => {
  it("não duplica comissão de canal ou comercial entre custo fixo e variável", () => {
    const mappings = buildCotiaFinancialMappings({
      valorCota: "35000", cotasVendidasMes: "10", utilidadesMensal: "1000", canalMidiaMensal: "300",
      captadoresQuantidade: "1", captadorAbordagensMes: "100", captadorTaxaQualificacao: "50", captadorFixoMensal: "1000", captadorIncentivoPorCasal: "20",
      ruaQualificadosMes: "100", ruaConviteRate: "100", ruaAgendamentoRate: "100", ruaShowRate: "100", ruaTourRate: "100", ruaConversao: "10", ruaRecorrenteMensal: "2000", ruaComissaoPorVenda: "500",
      comissaoCorretorValor: "100", comissaoCorretorQuantidade: "1",
      linerQuantidade: "1", linerFixoMensal: "2000", linerComissaoPorVenda: "100", linerProdutividadeMes: "8",
    });
    const value = (key: string) => mappings.find(mapping => mapping.inputKey === key)?.value;
    expect(value("payrollMonthly")).toBe("3000");
    expect(value("fixedCostMonthly")).toBe("3300");
    expect(Number(value("variableCostRate"))).toBeCloseTo(8000 / 350000, 10);
  });

  it("mapeia a agenda de captação, sala e sales kit para o cronograma autoritativo", () => {
    const mappings = buildCotiaFinancialMappings({
      canalAtivacaoInicial: "100", ruaAtivacaoInicial: "100", implantacaoCaptacaoMes: "1",
      recepcaoQuantidade: "1", recepcaoCustoUnitario: "300", implantacaoSalaMes: "2",
      bookLuxoQuantidade: "1", bookLuxoCustoUnitario: "100", implantacaoSalesKitMes: "3",
      mesesPreOperacao: "3",
    });
    const value = (key: string) => mappings.find(mapping => mapping.inputKey === key)?.value;
    expect(value("capexAcquisitionShareRate")).toBe("0.3333333333333333");
    expect(value("capexSalesRoomShareRate")).toBe("0.5");
    expect(value("capexSalesKitShareRate")).toBe("0.16666666666666666");
    expect(value("capexAcquisitionMonth")).toBe("1");
    expect(value("capexSalesRoomMonth")).toBe("2");
    expect(value("capexSalesKitMonth")).toBe("3");
  });
});
