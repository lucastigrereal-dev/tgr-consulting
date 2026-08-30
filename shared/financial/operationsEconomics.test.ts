import { describe, expect, it } from "vitest";
import { calculateCommercialCapacity, calculateWorkforceEconomics } from "./operationsEconomics";

describe("operations economics", () => {
  it("bloqueia workforce se uma premissa canônica estiver pendente", () => {
    expect(calculateWorkforceEconomics({ headcountPlanejado: "8", custoFteMensal: "5000" })).toEqual(expect.objectContaining({ status: "blocked" }));
  });

  it("calcula workforce de modo decimal e reproduzível", () => {
    const result = calculateWorkforceEconomics({ headcountPlanejado: "8", custoFteMensal: "5000", rampUpMeses: "4", turnoverAnual: "0.24", produtividadePorFte: "12", custoMovimentacao: "3000", encargosPercentual: "0.7" });
    expect(result).toEqual({ status: "valid", metrics: expect.objectContaining({ monthlyAttritionFte: "0.16000000", annualProductivityCapacity: "96.00000000" }) });
  });

  it("limita capacidade comercial pelo gargalo real", () => {
    const result = calculateCommercialCapacity({ casaisQualificados: "100", casaisCanalDireto: "70", casaisCanalParceiro: "50", capacidadeSala: "18", recepcionistas: "2", casaisPorRecepcionista: "80", consultores: "8", closers: "3", diasVendaMes: "20", sessoesPorDia: "3", casaisPorConsultor: "15", conversaoEsperada: "0.1", fatorSazonal: "1" });
    expect(result).toEqual({ status: "valid", metrics: expect.objectContaining({ workableQualifiedCouples: "100.00000000", projectedMonthlySales: "10.00000000", projectedSalesPerCloser: "3.33333333" }) });
  });
});
