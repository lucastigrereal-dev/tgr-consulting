import { describe, expect, it } from "vitest";
import {
  buildCotiaAuthoritativePayload,
  evaluateCotiaAssemblyCompleteness,
  hydrateCotiaAssemblyDraft,
} from "./cotiaAuthoritativeAdapter";

const completeAssembly = {
  nomeProjeto: "Projeto Unico Ponta Negra",
  nomeProduto: "Cota Ponta Negra",
  praca: "Natal/RN",
  dataBase: "08/2026",
  inicioOperacao: "01/2027",
  horizonteMeses: "120",
  valorCota: "28.000,00",
  valorEntrada: "3.200,00",
  parcelasEntrada: "8",
  primeiroVencimentoEntradaMes: "0",
  parcelasSaldo: "84",
  carenciaSaldoMeses: "2",
  primeiroVencimentoSaldoMes: "3",
  cotasPorApartamento: "52",
  totalApartamentos: "60",
  cotasBloqueadas: "20",
  cotasVendidasAcumuladas: "0",
  cotasRetornadas: "0",
  cotasVendidasMes: "100",
  eficiencia: "20",
  taxaCancelamento: "30",
  percentualAdimplente: "75",
  descontoComercial: "0",
  encargosExplicitos: "0",
  toleranciaMaterialidade: "0,01",
};

describe("adaptador autoritativo da Pagina 1 Cotia", () => {
  it("produz SKU e condicao reconciliados sem perder cotas bloqueadas", () => {
    const result = buildCotiaAuthoritativePayload(completeAssembly, "Ata Natal 42");

    expect(result.commercialModel).toEqual({
      asOfMonth: 0,
      skus: [expect.objectContaining({
        id: "produto-principal",
        name: "Cota Ponta Negra",
        unitType: "UH",
        unitQuantity: 60,
        sharesPerUnit: 52,
        grossSoldShares: 0,
        returnedShares: 0,
        blockedShares: 20,
        status: "provided",
        sourceType: "current_decision",
        sourceRef: "Ata Natal 42",
        pricePhases: [{ id: "base", startsAtMonth: 0, price: "28000" }],
      })],
      conditions: [expect.objectContaining({
        productSkuCode: "produto-principal",
        status: "provided",
        sourceRef: "Ata Natal 42",
        condition: expect.objectContaining({
          listPrice: "28000",
          discount: "0",
          entry: { total: "3200", installments: 8, firstDueMonth: 0 },
          balance: {
            principal: "24800",
            installments: 84,
            graceMonths: 2,
            firstDueMonth: 3,
          },
          explicitCharges: "0",
          materialityTolerance: "0.01",
        }),
      })],
    });
    expect(result.completion.status).toBe("provided");
  });

  it("bloqueia persistencia quando cotas bloqueadas excedem o estoque fisico", () => {
    expect(() => buildCotiaAuthoritativePayload({
      ...completeAssembly,
      totalApartamentos: "1",
      cotasPorApartamento: "52",
      cotasBloqueadas: "53",
    }, "Ata Natal 42")).toThrow("exceder o estoque fisico");
  });

  it("nao fabrica politica de carteira quando qualquer regra explicita estiver pendente", () => {
    const result = buildCotiaAuthoritativePayload({
      ...completeAssembly,
      politicaCarteiraVersao: "natal-v1",
      cancelamentoD7: "5",
    }, "Ata Natal 42");

    expect(result.receivablesPolicy).toBeUndefined();
    expect(result.completion.policyStatus).toBe("pending");
  });

  it("emite politica somente quando curva, cura, write-off e versao estao completos", () => {
    const result = buildCotiaAuthoritativePayload({
      ...completeAssembly,
      politicaCarteiraVersao: "natal-v1",
      cancelamentoD7: "5",
      cancelamentoD30: "10",
      cancelamentoD60: "15",
      cancelamentoD90: "20",
      cancelamentoD180: "25",
      cancelamentoLifetime: "30",
      inadimplencia: "25",
      curaD1a30: "40",
      curaD31a60: "30",
      curaD61a90: "20",
      curaD90Mais: "10",
      writeOffAposDias: "180",
    }, "Ata Natal 42");

    expect(result.receivablesPolicy).toEqual({
      status: "provided",
      sourceType: "current_decision",
      sourceRef: "Ata Natal 42",
      policy: {
        cancellationCurve: {
          d7: "0.05", d30: "0.1", d60: "0.15", d90: "0.2",
          d180: "0.25", lifetime: "0.3",
        },
        delinquencyRate: "0.25",
        cureRates: {
          days1To30: "0.4", days31To60: "0.3",
          days61To90: "0.2", days90Plus: "0.1",
        },
        writeOffAfterDays: 180,
        policyVersion: "natal-v1",
        sourceRef: "Ata Natal 42",
      },
    });
  });

  it("mantem a montagem pendente enquanto qualquer campo obrigatorio estiver vazio", () => {
    const incomplete = { ...completeAssembly, valorEntrada: "" };
    expect(evaluateCotiaAssemblyCompleteness(incomplete)).toMatchObject({
      status: "pending",
      missingRequiredFields: expect.arrayContaining(["valorEntrada"]),
    });
    expect(evaluateCotiaAssemblyCompleteness(completeAssembly).status).toBe("provided");
  });

  it("reabre o registro salvo e nao sobrescreve um draft local sujo no refetch", () => {
    const saved = {
      versionId: "version-1",
      componentType: "project_assembly",
      name: "Montagem Natal",
      status: "provided" as const,
      sourceRef: "Ata 42",
      payload: { nomeProjeto: "Natal salvo", valorCota: "28000", vazio: "PENDENTE" },
    };
    const emptyDraft = { name: "Montagem do Projeto", status: "pending" as const, sourceRef: "", values: {} };

    expect(hydrateCotiaAssemblyDraft({
      activeVersionId: "version-1", hydratedVersionId: "", dirty: false,
      currentDraft: emptyDraft, records: [saved],
    })).toMatchObject({
      hydratedVersionId: "version-1",
      draft: { name: "Montagem Natal", sourceRef: "Ata 42", values: { nomeProjeto: "Natal salvo", valorCota: "28000", vazio: "" } },
    });

    const localDraft = { ...emptyDraft, values: { nomeProjeto: "Edicao local" } };
    expect(hydrateCotiaAssemblyDraft({
      activeVersionId: "version-1", hydratedVersionId: "version-1", dirty: true,
      currentDraft: localDraft, records: [saved],
    }).draft.values.nomeProjeto).toBe("Edicao local");

    expect(hydrateCotiaAssemblyDraft({
      activeVersionId: "version-2", hydratedVersionId: "version-1", dirty: false,
      currentDraft: localDraft, records: [],
    }).draft.values).toEqual({});
  });
});
