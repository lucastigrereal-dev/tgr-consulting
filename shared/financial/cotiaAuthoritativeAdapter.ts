import { normalizeBrazilianDecimal, parseBrazilianDecimal } from "./cotiaMatrix";

export type CotiaAssemblyStatus = "provided" | "pending";

export type CotiaAssemblyDraft = {
  name: string;
  sourceRef: string;
  status: CotiaAssemblyStatus;
  values: Record<string, string>;
};

type CotiaAssemblyRecord = {
  versionId: string;
  componentType: string;
  name: string;
  status: CotiaAssemblyStatus;
  sourceRef?: string | null;
  payload: unknown;
};

const REQUIRED_ASSEMBLY_FIELDS = [
  "nomeProjeto",
  "nomeProduto",
  "praca",
  "dataBase",
  "inicioOperacao",
  "horizonteMeses",
  "valorCota",
  "valorEntrada",
  "parcelasEntrada",
  "primeiroVencimentoEntradaMes",
  "parcelasSaldo",
  "carenciaSaldoMeses",
  "primeiroVencimentoSaldoMes",
  "cotasPorApartamento",
  "totalApartamentos",
  "cotasBloqueadas",
  "cotasVendidasAcumuladas",
  "cotasRetornadas",
  "cotasVendidasMes",
  "eficiencia",
  "taxaCancelamento",
  "percentualAdimplente",
  "descontoComercial",
  "encargosExplicitos",
  "toleranciaMaterialidade",
] as const;

const POLICY_FIELDS = [
  "politicaCarteiraVersao",
  "cancelamentoD7",
  "cancelamentoD30",
  "cancelamentoD60",
  "cancelamentoD90",
  "cancelamentoD180",
  "cancelamentoLifetime",
  "inadimplencia",
  "curaD1a30",
  "curaD31a60",
  "curaD61a90",
  "curaD90Mais",
  "writeOffAposDias",
] as const;

function present(values: Record<string, string>, key: string) {
  const value = values[key]?.trim();
  return Boolean(value && value !== "PENDENTE");
}

export function evaluateCotiaAssemblyCompleteness(values: Record<string, string>) {
  const missingRequiredFields = REQUIRED_ASSEMBLY_FIELDS.filter(key => !present(values, key));
  const missingPolicyFields = POLICY_FIELDS.filter(key => !present(values, key));
  return {
    status: missingRequiredFields.length ? "pending" as const : "provided" as const,
    missingRequiredFields: [...missingRequiredFields],
    policyStatus: missingPolicyFields.length ? "pending" as const : "provided" as const,
    missingPolicyFields: [...missingPolicyFields],
  };
}

function decimalText(value: string, label: string) {
  const normalized = normalizeBrazilianDecimal(value);
  const number = normalized === null ? Number.NaN : Number(normalized);
  if (!value.trim() || !Number.isFinite(number) || number < 0)
    throw new Error(`${label} deve ser um numero nao negativo.`);
  return String(number);
}

function integer(value: string, label: string, minimum = 0) {
  const normalized = normalizeBrazilianDecimal(value);
  const number = normalized === null ? Number.NaN : Number(normalized);
  if (!value.trim() || !Number.isInteger(number) || number < minimum)
    throw new Error(`${label} deve ser um inteiro maior ou igual a ${minimum}.`);
  return number;
}

export function normalizeCotiaPercentInput(value: string, label = "Percentual") {
  const normalized = normalizeBrazilianDecimal(value);
  const raw = normalized === null ? Number.NaN : Number(normalized);
  const rate = raw / 100;
  if (!value.trim() || !Number.isFinite(rate) || rate < 0 || rate > 1)
    throw new Error(`${label} deve estar entre 0% e 100%.`);
  return String(rate);
}

export type CotiaCommercialModelPayload = {
  asOfMonth: number;
  skus: Array<{
    id: string;
    name: string;
    unitType: string;
    unitQuantity: number;
    sharesPerUnit: number;
    grossSoldShares: number;
    returnedShares: number;
    blockedShares: number;
    status: CotiaAssemblyStatus;
    sourceType: "current_decision";
    sourceRef?: string;
    pricePhases: Array<{ id: string; startsAtMonth: number; price: string }>;
  }>;
  conditions: Array<{
    productSkuCode: string;
    status: CotiaAssemblyStatus;
    sourceType: "current_decision";
    sourceRef?: string;
    condition: {
      id: string;
      name: string;
      listPrice: string;
      discount: string;
      entry: { total: string; installments: number; firstDueMonth: number };
      balance: { principal: string; installments: number; graceMonths: number; firstDueMonth: number };
      explicitCharges: string;
      materialityTolerance: string;
      correctionRate?: string;
      interestRate?: string;
    };
  }>;
};

export type CotiaReceivablesPolicyPayload = {
  status: "provided";
  sourceType: "current_decision";
  sourceRef: string;
  policy: {
    cancellationCurve: { d7: string; d30: string; d60: string; d90: string; d180: string; lifetime: string };
    delinquencyRate: string;
    cureRates: { days1To30: string; days31To60: string; days61To90: string; days90Plus: string };
    writeOffAfterDays: number;
    policyVersion: string;
    sourceRef: string;
  };
};

export function buildCotiaAuthoritativePayload(
  values: Record<string, string>,
  sourceRefInput: string,
): {
  commercialModel?: CotiaCommercialModelPayload;
  receivablesPolicy?: CotiaReceivablesPolicyPayload;
  completion: ReturnType<typeof evaluateCotiaAssemblyCompleteness>;
} {
  const completion = evaluateCotiaAssemblyCompleteness(values);
  const sourceRef = sourceRefInput.trim();
  let commercialModel: CotiaCommercialModelPayload | undefined;

  if (completion.status === "provided") {
    if (!sourceRef) throw new Error("Pagina 1 informada exige fonte ou responsavel.");
    const listPrice = parseBrazilianDecimal(values.valorCota);
    const entry = parseBrazilianDecimal(values.valorEntrada);
    const discount = parseBrazilianDecimal(values.descontoComercial);
    const explicitCharges = parseBrazilianDecimal(values.encargosExplicitos);
    const horizonMonths = integer(values.horizonteMeses, "Horizonte", 1);
    if (horizonMonths > 120) throw new Error("Horizonte deve estar entre 1 e 120 meses.");
    normalizeCotiaPercentInput(values.eficiencia, "Eficiencia comercial");
    normalizeCotiaPercentInput(values.taxaCancelamento, "Taxa de cancelamento");
    normalizeCotiaPercentInput(values.percentualAdimplente, "Percentual adimplente");
    integer(values.cotasVendidasMes, "Cotas vendidas por mes");
    const unitQuantity = integer(values.totalApartamentos, "Total de UH", 1);
    const sharesPerUnit = integer(values.cotasPorApartamento, "Cotas por UH", 1);
    const blockedShares = integer(values.cotasBloqueadas, "Cotas bloqueadas");
    const grossSoldShares = integer(values.cotasVendidasAcumuladas, "Cotas vendidas acumuladas");
    const returnedShares = integer(values.cotasRetornadas, "Cotas retornadas");
    if (blockedShares > unitQuantity * sharesPerUnit)
      throw new Error("Cotas bloqueadas nao podem exceder o estoque fisico.");
    if (returnedShares > grossSoldShares)
      throw new Error("Cotas retornadas nao podem exceder as vendas acumuladas.");
    if (grossSoldShares - returnedShares + blockedShares > unitQuantity * sharesPerUnit)
      throw new Error("Vendas ativas e bloqueios nao podem exceder o estoque fisico.");
    const principal = listPrice - discount - entry - explicitCharges;
    if (principal < 0) throw new Error("Entrada, desconto e encargos nao podem exceder o valor da cota.");

    const condition = {
      id: "condicao-base-cotia",
      name: "Condição base Cotia",
      listPrice: decimalText(values.valorCota, "Valor da cota"),
      discount: decimalText(values.descontoComercial, "Desconto comercial"),
      entry: {
        total: decimalText(values.valorEntrada, "Valor da entrada"),
        installments: integer(values.parcelasEntrada, "Parcelas da entrada", 1),
        firstDueMonth: integer(values.primeiroVencimentoEntradaMes, "Primeiro vencimento da entrada"),
      },
      balance: {
        principal: String(principal),
        installments: integer(values.parcelasSaldo, "Parcelas do saldo", 1),
        graceMonths: integer(values.carenciaSaldoMeses, "Carencia do saldo"),
        firstDueMonth: integer(values.primeiroVencimentoSaldoMes, "Primeiro vencimento do saldo"),
      },
      explicitCharges: decimalText(values.encargosExplicitos, "Encargos explicitos"),
      materialityTolerance: decimalText(values.toleranciaMaterialidade, "Tolerancia de materialidade"),
      ...(present(values, "taxaCorrecao")
        ? { correctionRate: normalizeCotiaPercentInput(values.taxaCorrecao, "Taxa de correcao") }
        : {}),
      ...(present(values, "taxaJuros")
        ? { interestRate: normalizeCotiaPercentInput(values.taxaJuros, "Taxa de juros") }
        : {}),
    };
    commercialModel = {
      asOfMonth: 0,
      skus: [{
        id: "produto-principal",
        name: values.nomeProduto.trim(),
        unitType: "UH",
        unitQuantity,
        sharesPerUnit,
        grossSoldShares,
        returnedShares,
        blockedShares,
        status: "provided",
        sourceType: "current_decision",
        sourceRef,
        pricePhases: [{ id: "base", startsAtMonth: 0, price: condition.listPrice }],
      }],
      conditions: [{
        productSkuCode: "produto-principal",
        status: "provided",
        sourceType: "current_decision",
        sourceRef,
        condition,
      }],
    };
  }

  let receivablesPolicy: CotiaReceivablesPolicyPayload | undefined;
  if (completion.policyStatus === "provided") {
    if (!sourceRef) throw new Error("Politica de carteira informada exige fonte ou responsavel.");
    const curve = [
      normalizeCotiaPercentInput(values.cancelamentoD7, "Cancelamento D7"),
      normalizeCotiaPercentInput(values.cancelamentoD30, "Cancelamento D30"),
      normalizeCotiaPercentInput(values.cancelamentoD60, "Cancelamento D60"),
      normalizeCotiaPercentInput(values.cancelamentoD90, "Cancelamento D90"),
      normalizeCotiaPercentInput(values.cancelamentoD180, "Cancelamento D180"),
      normalizeCotiaPercentInput(values.cancelamentoLifetime, "Cancelamento lifetime"),
    ];
    if (curve.some((value, index) => index > 0 && Number(value) < Number(curve[index - 1])))
      throw new Error("A curva de cancelamento cumulativa deve ser crescente.");
    receivablesPolicy = {
      status: "provided",
      sourceType: "current_decision",
      sourceRef,
      policy: {
        cancellationCurve: {
          d7: curve[0], d30: curve[1], d60: curve[2], d90: curve[3],
          d180: curve[4], lifetime: curve[5],
        },
        delinquencyRate: normalizeCotiaPercentInput(values.inadimplencia, "Inadimplencia"),
        cureRates: {
          days1To30: normalizeCotiaPercentInput(values.curaD1a30, "Cura D1-D30"),
          days31To60: normalizeCotiaPercentInput(values.curaD31a60, "Cura D31-D60"),
          days61To90: normalizeCotiaPercentInput(values.curaD61a90, "Cura D61-D90"),
          days90Plus: normalizeCotiaPercentInput(values.curaD90Mais, "Cura D90+"),
        },
        writeOffAfterDays: integer(values.writeOffAposDias, "Write-off", 90),
        policyVersion: values.politicaCarteiraVersao.trim(),
        sourceRef,
      },
    };
  }
  return { commercialModel, receivablesPolicy, completion };
}

function payloadValue(value: unknown) {
  if (value === null || value === undefined || value === "PENDENTE") return "";
  return String(value);
}

function recordPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
}

export function hydrateCotiaAssemblyDraft(params: {
  activeVersionId: string;
  hydratedVersionId: string;
  dirty: boolean;
  currentDraft: CotiaAssemblyDraft;
  records: CotiaAssemblyRecord[];
}) {
  if (!params.activeVersionId || (params.dirty && params.hydratedVersionId === params.activeVersionId))
    return { draft: params.currentDraft, hydratedVersionId: params.hydratedVersionId };
  const saved = params.records.find(record =>
    record.versionId === params.activeVersionId && record.componentType === "project_assembly"
  );
  if (!saved)
    return {
      draft: params.hydratedVersionId === params.activeVersionId
        ? params.currentDraft
        : { ...params.currentDraft, sourceRef: "", status: "pending" as const, values: {} },
      hydratedVersionId: params.activeVersionId,
    };
  return {
    hydratedVersionId: params.activeVersionId,
    draft: {
      name: saved.name,
      status: saved.status,
      sourceRef: saved.sourceRef ?? "",
      values: Object.fromEntries(Object.entries(recordPayload(saved.payload)).map(([key, value]) => [key, payloadValue(value)])),
    },
  };
}
