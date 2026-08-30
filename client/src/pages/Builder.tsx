import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CotiaProjectMatrix } from "@/components/CotiaProjectMatrix";
import { AuthoritativeCommercialBuilder } from "@/components/AuthoritativeCommercialBuilder";
import { CapturePointsBuilder } from "@/components/CapturePointsBuilder";
import { CommercialOperationsBuilder } from "@/components/CommercialOperationsBuilder";
import { ReceivablesPolicyBuilder } from "@/components/ReceivablesPolicyBuilder";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { buildCotiaFinancialMappings } from "@shared/financial/cotiaFinancialAdapter";
import { getStudyImpacts } from "@shared/financial/impactMap";
import {
  FINANCIAL_INPUT_KEYS,
  type FinancialInputKey,
  type FinancialInputSnapshot,
} from "@shared/financial/types";
import { CircleAlert, FileCog } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type InputKind = "currency" | "percent" | "count";
const labels: Record<
  FinancialInputKey,
  { label: string; detail: string; group: string; kind: InputKind }
> = {
  qualifiedCouplesMonth1: {
    label: "Casais qualificados — mês 1",
    detail: "Volume de entrada validado",
    group: "Captação e capacidade",
    kind: "count",
  },
  qualifiedCouplesGrowthRate: {
    label: "Crescimento mensal de captação",
    detail: "0.02 = 2%",
    group: "Captação e capacidade",
    kind: "percent",
  },
  conversionRate: {
    label: "Conversão de vendas",
    detail: "0.10 = 10%",
    group: "Comercial",
    kind: "percent",
  },
  averageTicket: {
    label: "Ticket médio",
    detail: "Valor em R$",
    group: "Comercial",
    kind: "currency",
  },
  collectionRate: {
    label: "Taxa de recebimento",
    detail: "0.80 = 80%",
    group: "Carteira e perdas",
    kind: "percent",
  },
  cancellationRate: {
    label: "Taxa de cancelamento",
    detail: "0.05 = 5%",
    group: "Carteira e perdas",
    kind: "percent",
  },
  variableCostRate: {
    label: "Custo variável sobre receita",
    detail: "0.20 = 20%",
    group: "Custos",
    kind: "percent",
  },
  partnerShareRate: {
    label: "Repasse a parceiros",
    detail: "0.05 = 5%",
    group: "Custos",
    kind: "percent",
  },
  fixedCostMonthly: {
    label: "Custo fixo mensal",
    detail: "OPEX mensal em R$",
    group: "Custos",
    kind: "currency",
  },
  payrollMonthly: {
    label: "Folha mensal",
    detail: "Equipe, ramp-up e encargos em R$",
    group: "Workforce",
    kind: "currency",
  },
  capexInitial: {
    label: "CAPEX inicial",
    detail: "Implantação e estrutura em R$",
    group: "Investimento",
    kind: "currency",
  },
  capexAcquisitionShareRate: { label: "Participação CAPEX · captação", detail: "Fração do pré-investimento", group: "Cronograma", kind: "percent" },
  capexAcquisitionMonth: { label: "Mês CAPEX · captação", detail: "Mês relativo à pré-operação", group: "Cronograma", kind: "count" },
  capexSalesRoomShareRate: { label: "Participação CAPEX · sala", detail: "Fração do pré-investimento", group: "Cronograma", kind: "percent" },
  capexSalesRoomMonth: { label: "Mês CAPEX · sala", detail: "Mês relativo à pré-operação", group: "Cronograma", kind: "count" },
  capexSalesKitShareRate: { label: "Participação CAPEX · sales kit", detail: "Fração do pré-investimento", group: "Cronograma", kind: "percent" },
  capexSalesKitMonth: { label: "Mês CAPEX · sales kit", detail: "Mês relativo à pré-operação", group: "Cronograma", kind: "count" },
  preOperationMonths: { label: "Meses de pré-operação", detail: "Distribui a implantação antes da abertura", group: "Investimento", kind: "count" },
  entryValuePerContract: { label: "Entrada por contrato", detail: "Entrada gerada a cada cota vendida", group: "Recebimento", kind: "currency" },
  paymentCardViewMixRate: { label: "Mix cartão à vista", detail: "0.20 = 20%", group: "Recebimento", kind: "percent" },
  paymentCardViewMdrRate: { label: "MDR cartão à vista", detail: "0.02 = 2%", group: "Recebimento", kind: "percent" },
  paymentCardViewSettlementDays: { label: "Prazo cartão à vista", detail: "Dias", group: "Recebimento", kind: "count" },
  paymentCardInstallmentMixRate: { label: "Mix cartão parcelado", detail: "0.20 = 20%", group: "Recebimento", kind: "percent" },
  paymentCardInstallmentMdrRate: { label: "MDR cartão parcelado", detail: "0.08 = 8%", group: "Recebimento", kind: "percent" },
  paymentCardInstallmentSettlementDays: { label: "Prazo cartão parcelado", detail: "Dias", group: "Recebimento", kind: "count" },
  paymentDebitMixRate: { label: "Mix débito", detail: "0.20 = 20%", group: "Recebimento", kind: "percent" },
  paymentDebitMdrRate: { label: "MDR débito", detail: "0.01 = 1%", group: "Recebimento", kind: "percent" },
  paymentDebitSettlementDays: { label: "Prazo débito", detail: "Dias", group: "Recebimento", kind: "count" },
  paymentRecurringChequeMixRate: { label: "Mix recorrente / cheque", detail: "0.20 = 20%", group: "Recebimento", kind: "percent" },
  paymentRecurringChequeMdrRate: { label: "MDR recorrente / cheque", detail: "0.00 = 0%", group: "Recebimento", kind: "percent" },
  paymentRecurringChequeSettlementDays: { label: "Prazo recorrente / cheque", detail: "Dias", group: "Recebimento", kind: "count" },
  paymentBoletoMixRate: { label: "Mix boleto", detail: "0.20 = 20%", group: "Recebimento", kind: "percent" },
  paymentBoletoMdrRate: { label: "MDR boleto", detail: "0.00 = 0%", group: "Recebimento", kind: "percent" },
  paymentBoletoSettlementDays: { label: "Prazo boleto", detail: "Dias", group: "Recebimento", kind: "count" },
  discountRateAnnual: {
    label: "Taxa anual de desconto",
    detail: "0.12 = 12%",
    group: "Investimento",
    kind: "percent",
  },
};
type DomainType =
  | "project_assembly"
  | "product_stock"
  | "pricing_payments"
  | "acquisition_capacity"
  | "costs_workforce"
  | "commissions_partners"
  | "receivables_losses"
  | "capex_opex";
type DomainDefinition = {
  type: DomainType;
  title: string;
  detail: string;
  fields: { key: string; label: string; placeholder: string }[];
};
type PendingAssembly = {
  name: string;
  status: "provided" | "pending";
  payload: Record<string, string>;
  sourceRef?: string;
};
const assemblyDomain: DomainDefinition = {
  type: "project_assembly",
  title: "Montagem do Projeto",
  detail: "A ficha de abertura que alimenta o estudo: identidade, início, produto, estrutura e investimento.",
  fields: [
    { key: "praca", label: "Praça / destino", placeholder: "Pipa, RN" },
    { key: "dataBase", label: "Data-base do estudo", placeholder: "2026-08" },
    { key: "inicioOperacao", label: "Início da operação", placeholder: "2027-03" },
    { key: "horizonteMeses", label: "Horizonte (meses)", placeholder: "120" },
    { key: "modeloProduto", label: "Produto / modelo", placeholder: "Multipropriedade" },
    { key: "unidades", label: "Unidades físicas", placeholder: "120" },
    { key: "fracoes", label: "Frações por unidade", placeholder: "26" },
    { key: "investimentoPreOperacional", label: "Pré-operacional (R$)", placeholder: "500000" },
    { key: "capitalGiroInicial", label: "Capital de giro inicial (R$)", placeholder: "350000" },
  ],
};
const builderDomains: DomainDefinition[] = [
  {
    type: "product_stock",
    title: "Produto e estoque",
    detail: "Configuração física e disponibilidade comercial.",
    fields: [
      { key: "unidadesTotais", label: "Unidades totais", placeholder: "120" },
      {
        key: "fracoesPorUnidade",
        label: "Frações por unidade",
        placeholder: "26",
      },
      {
        key: "estoqueDisponivel",
        label: "Estoque disponível",
        placeholder: "84",
      },
      { key: "mesLiberacao", label: "Mês de liberação", placeholder: "1" },
    ],
  },
  {
    type: "pricing_payments",
    title: "Preço e pagamentos",
    detail: "Tabela, entrada e calendário de recebimento.",
    fields: [
      { key: "precoBase", label: "Preço base", placeholder: "18000" },
      {
        key: "entradaPercentual",
        label: "Entrada (decimal)",
        placeholder: "0.15",
      },
      { key: "parcelas", label: "Número de parcelas", placeholder: "24" },
      {
        key: "descontoPercentual",
        label: "Desconto máximo (decimal)",
        placeholder: "0.05",
      },
    ],
  },
  {
    type: "acquisition_capacity",
    title: "Captação e capacidade comercial",
    detail: "Canais, sala, recepção, consultores, closers e sazonalidade.",
    fields: [
      {
        key: "canais",
        label: "Canais prioritários",
        placeholder: "tráfego, parceiros",
      },
      {
        key: "casaisQualificados",
        label: "Casais qualificados/mês",
        placeholder: "100",
      },
      {
        key: "casaisCanalDireto",
        label: "Casais via canal direto",
        placeholder: "70",
      },
      {
        key: "casaisCanalParceiro",
        label: "Casais via parceiros",
        placeholder: "50",
      },
      { key: "capacidadeSala", label: "Capacidade da sala", placeholder: "18" },
      { key: "diasVendaMes", label: "Dias de venda/mês", placeholder: "20" },
      { key: "sessoesPorDia", label: "Sessões por dia", placeholder: "3" },
      { key: "recepcionistas", label: "Recepção (FTE)", placeholder: "2" },
      {
        key: "casaisPorRecepcionista",
        label: "Casais por recepcionista",
        placeholder: "80",
      },
      { key: "consultores", label: "Consultores (FTE)", placeholder: "8" },
      {
        key: "casaisPorConsultor",
        label: "Casais por consultor",
        placeholder: "15",
      },
      { key: "closers", label: "Closers (FTE)", placeholder: "3" },
      {
        key: "conversaoEsperada",
        label: "Conversão esperada",
        placeholder: "0.1",
      },
      { key: "fatorSazonal", label: "Fator sazonal", placeholder: "0.85" },
      {
        key: "sazonalidade",
        label: "Sazonalidade",
        placeholder: "alta em jul/dez",
      },
    ],
  },
  {
    type: "costs_workforce",
    title: "Custos e workforce",
    detail: "Catálogo, ramp-up, turnover, produtividade e movimentação.",
    fields: [
      {
        key: "custoFixoMensal",
        label: "Custo fixo mensal",
        placeholder: "150000",
      },
      {
        key: "headcountPlanejado",
        label: "Headcount planejado",
        placeholder: "18",
      },
      {
        key: "custoFteMensal",
        label: "Custo mensal por FTE",
        placeholder: "5000",
      },
      { key: "rampUpMeses", label: "Ramp-up (meses)", placeholder: "4" },
      { key: "turnoverAnual", label: "Turnover anual", placeholder: "0.22" },
      {
        key: "produtividadePorFte",
        label: "Produtividade por FTE",
        placeholder: "12",
      },
      {
        key: "custoMovimentacao",
        label: "Custo por movimentação",
        placeholder: "3000",
      },
      {
        key: "encargosPercentual",
        label: "Encargos (decimal)",
        placeholder: "0.7",
      },
    ],
  },
  {
    type: "commissions_partners",
    title: "Comissões e parceiros",
    detail: "Regras de incentivo, repasse e gatilhos de pagamento.",
    fields: [
      {
        key: "comissaoConsultor",
        label: "Comissão consultor",
        placeholder: "0.03",
      },
      { key: "comissaoCloser", label: "Comissão closer", placeholder: "0.02" },
      {
        key: "repasseParceiro",
        label: "Repasse parceiro",
        placeholder: "0.05",
      },
      {
        key: "gatilhoPagamento",
        label: "Gatilho de pagamento",
        placeholder: "contrato pago",
      },
    ],
  },
  {
    type: "receivables_losses",
    title: "Carteira e perdas",
    detail: "Recebimento, aging, inadimplência, cancelamento e recuperação.",
    fields: [
      { key: "recebimento", label: "Taxa de recebimento", placeholder: "0.8" },
      { key: "inadimplencia", label: "Inadimplência", placeholder: "0.06" },
      { key: "cancelamento", label: "Cancelamento", placeholder: "0.05" },
      { key: "recuperacao", label: "Recuperação", placeholder: "0.25" },
    ],
  },
  {
    type: "capex_opex",
    title: "CAPEX e OPEX",
    detail: "Implantação, recorrência, centro de custo e reserva operacional.",
    fields: [
      { key: "capexInicial", label: "CAPEX inicial", placeholder: "500000" },
      { key: "opexMensal", label: "OPEX mensal", placeholder: "120000" },
      {
        key: "mesesImplantacao",
        label: "Meses de implantação",
        placeholder: "6",
      },
      {
        key: "reservaOperacional",
        label: "Reserva operacional",
        placeholder: "350000",
      },
    ],
  },
];
function createPendingInputs(): FinancialInputSnapshot {
  return Object.fromEntries(
    FINANCIAL_INPUT_KEYS.map(key => [
      key,
      { status: "pending", sourceType: "current_decision" },
    ])
  ) as FinancialInputSnapshot;
}
function emptyValues(domain: DomainDefinition) {
  return Object.fromEntries(domain.fields.map(field => [field.key, ""]));
}
function signature(value: unknown) {
  return JSON.stringify(value);
}

export default function Builder() {
  const utils = trpc.useUtils();
  const projectsQuery = trpc.igr.projects.useQuery(undefined, { retry: false });
  const [activeProjectId, setActiveProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [inputs, setInputs] =
    useState<FinancialInputSnapshot>(createPendingInputs);
  const [persistedSignature, setPersistedSignature] = useState(
    signature(createPendingInputs())
  );
  const [domainDrafts, setDomainDrafts] = useState<
    Record<
      string,
      {
        name: string;
        sourceRef: string;
        status: "provided" | "pending";
        values: Record<string, string>;
      }
    >
  >({});
  const pendingAssemblyRef = useRef<PendingAssembly | null>(null);
  const contextQuery = trpc.igr.projectContext.useQuery(
    { projectId: activeProjectId },
    { enabled: Boolean(activeProjectId), retry: false }
  );
  const activeVersionId = contextQuery.data?.workingVersion?.id ?? "";
  const savedInputsQuery = trpc.igr.versionInputs.useQuery(
    { versionId: activeVersionId },
    { enabled: Boolean(activeVersionId), retry: false }
  );
  const componentsQuery = trpc.igr.builderComponents.useQuery(
    { versionId: activeVersionId },
    { enabled: Boolean(activeVersionId), retry: false }
  );
  useEffect(() => {
    if (!activeProjectId && projectsQuery.data?.[0])
      setActiveProjectId(projectsQuery.data[0].id);
  }, [activeProjectId, projectsQuery.data]);
  useEffect(() => {
    if (savedInputsQuery.data) {
      setInputs(savedInputsQuery.data);
      setPersistedSignature(signature(savedInputsQuery.data));
    }
  }, [savedInputsQuery.data]);
  const isDirty =
    Boolean(activeVersionId) && signature(inputs) !== persistedSignature;
  useEffect(() => {
    const blockExit = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", blockExit);
    return () => window.removeEventListener("beforeunload", blockExit);
  }, [isDirty]);
  const createProject = trpc.igr.createProject.useMutation({
    onSuccess: async (result, variables) => {
      await utils.igr.projects.invalidate();
      setActiveProjectId(result.projectId);
      setInputs(variables.inputs as FinancialInputSnapshot);
      setPersistedSignature(signature(variables.inputs as FinancialInputSnapshot));
      const pendingAssembly = pendingAssemblyRef.current;
      if (pendingAssembly) {
        upsertComponent.mutate({
          versionId: result.versionId,
          componentType: "project_assembly",
          ...pendingAssembly,
          sourceType: "current_decision",
        });
        pendingAssemblyRef.current = null;
      }
      toast.success("Projeto criado com trilha de auditoria.", {
        description: `Versão ${result.versionId} aberta em rascunho.`,
      });
    },
    onError: error =>
      toast.error("Não foi possível criar o projeto.", {
        description: error.message,
      }),
  });
  const updateInputs = trpc.igr.updateInputs.useMutation({
    onSuccess: async (_, variables) => {
      setInputs(variables.inputs as FinancialInputSnapshot);
      setPersistedSignature(signature(variables.inputs as FinancialInputSnapshot));
      await contextQuery.refetch();
      toast.success("Premissas salvas.", {
        description: "Hash de input e audit trail foram renovados.",
      });
    },
    onError: error =>
      toast.error("Não foi possível alterar esta versão.", {
        description: error.message,
      }),
  });
  const upsertComponent = trpc.igr.upsertBuilderComponent.useMutation({
    onSuccess: async () => {
      await componentsQuery.refetch();
      toast.success("Bloco detalhado salvo.", {
        description: "Campos, pendência e fonte foram registrados.",
      });
    },
    onError: error =>
      toast.error("Não foi possível registrar o bloco.", {
        description: error.message,
      }),
  });
  const pendingCount = FINANCIAL_INPUT_KEYS.filter(
    key => inputs[key].status === "pending"
  ).length;
  const activeProject = projectsQuery.data?.find(
    project => project.id === activeProjectId
  );
  const getDraft = (domain: DomainDefinition) =>
    domainDrafts[domain.type] ?? {
      name: domain.title,
      sourceRef: "",
      status: "pending" as const,
      values: emptyValues(domain),
    };
  const patchDraft = (
    domain: DomainDefinition,
    patch: Partial<{
      name: string;
      sourceRef: string;
      status: "provided" | "pending";
      values: Record<string, string>;
    }>
  ) =>
    setDomainDrafts(current => ({
      ...current,
      [domain.type]: { ...getDraft(domain), ...patch },
    }));
  const saveDomain = (domain: DomainDefinition) => {
    if (!activeVersionId)
      return toast.error(
        "Crie ou selecione um projeto antes de registrar o bloco."
      );
    const draft = getDraft(domain);
    if (draft.status === "provided" && draft.sourceRef.trim().length < 2)
      return toast.error("Bloco informado precisa de fonte ou responsável.");
    const payload = Object.fromEntries(
      domain.fields.map(field => [
        field.key,
        draft.values[field.key]?.trim() || "PENDENTE",
      ])
    );
    upsertComponent.mutate({
      versionId: activeVersionId,
      componentType: domain.type,
      name: draft.name.trim() || domain.title,
      status: draft.status,
      payload,
      sourceType: "current_decision",
      sourceRef: draft.sourceRef.trim() || undefined,
    });
  };
  const registerAssembly = () => {
    const draft = getDraft(assemblyDomain);
    const filledMappings = buildCotiaFinancialMappings(draft.values);
    const assemblyStatus = filledMappings.length ? "provided" : draft.status;
    if (assemblyStatus === "provided" && draft.sourceRef.trim().length < 2)
      return toast.error("Alavanca financeira informada exige fonte, ata ou responsável.");
    const nextInputs = { ...inputs };
    for (const mapping of filledMappings) {
      nextInputs[mapping.inputKey] = {
        status: "provided",
        value: mapping.value,
        sourceType: "current_decision",
        sourceRef: `montagem: ${draft.sourceRef.trim()}`,
      };
    }
    if (activeVersionId && filledMappings.length) {
      setInputs(nextInputs);
      updateInputs.mutate({ versionId: activeVersionId, inputs: nextInputs });
    }
    const payload = Object.fromEntries(
      Object.entries(draft.values).map(([key, value]) => [
        key,
        value.trim() || "PENDENTE",
      ])
    );
    const assemblyRecord: PendingAssembly = {
      name: draft.name.trim() || assemblyDomain.title,
      status: assemblyStatus,
      payload,
      sourceRef: draft.sourceRef.trim() || undefined,
    };
    if (activeVersionId) {
      upsertComponent.mutate({
        versionId: activeVersionId,
        componentType: assemblyDomain.type,
        ...assemblyRecord,
        sourceType: "current_decision",
      });
      return;
    }
    const assemblyProjectName = draft.values.nomeProjeto?.trim() || projectName.trim();
    if (assemblyProjectName.length < 3)
      return toast.error("Dê um nome ao estudo antes de registrar a Montagem.");
    pendingAssemblyRef.current = assemblyRecord;
    createProject.mutate({ name: assemblyProjectName, inputs: nextInputs });
  };
  const assemblyDraft = getDraft(assemblyDomain);
  const assemblyRecords =
    componentsQuery.data?.filter(
      record => record.componentType === "project_assembly"
    ) ?? [];
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <CotiaProjectMatrix
        values={assemblyDraft.values}
        sourceRef={assemblyDraft.sourceRef}
        status={assemblyDraft.status}
        disabled={upsertComponent.isPending}
        saving={upsertComponent.isPending || createProject.isPending}
        onChange={(key, value) =>
          patchDraft(assemblyDomain, {
            values: { ...assemblyDraft.values, [key]: value },
          })
        }
        onSourceChange={value => patchDraft(assemblyDomain, { sourceRef: value })}
        onStatusChange={value => patchDraft(assemblyDomain, { status: value })}
        onSave={registerAssembly}
      />
      <AuthoritativeCommercialBuilder versionId={activeVersionId} />
      <CapturePointsBuilder versionId={activeVersionId} />
      <CommercialOperationsBuilder versionId={activeVersionId} />
      <ReceivablesPolicyBuilder versionId={activeVersionId} />
    </div>
  );
}
