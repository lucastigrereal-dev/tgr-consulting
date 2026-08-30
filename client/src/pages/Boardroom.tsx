import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { ChapterFormulaTrace } from "@/components/ChapterFormulaTrace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatKpi } from "@/lib/financialPresentation";
import { getChapterFormulaTrace } from "@/lib/chapterFormulaTrace";
import { LIVE_DOCUMENT_CHAPTERS } from "@/lib/liveDocumentStructure";
import { trpc } from "@/lib/trpc";
import { getStudyImpacts } from "@shared/financial/impactMap";
import {
  FINANCIAL_INPUT_KEYS,
  type FinancialCalculation,
  type FinancialInputKey,
  type FinancialInputSnapshot,
} from "@shared/financial/types";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Download,
  ExternalLink,
  FileCheck2,
  FileOutput,
  LockKeyhole,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

function MetricCard({
  label,
  detail,
  value,
  status,
}: {
  label: string;
  detail: string;
  value: string;
  status: string;
}) {
  return (
    <Card className="border-white/10 bg-card/80 shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <LockKeyhole className="h-4 w-4 text-amber-300/80" />
        </div>
        <p className="mt-4 font-serif text-3xl text-foreground">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
        <p className="mt-4 text-[11px] font-medium text-amber-200/80">
          {status}
        </p>
      </CardContent>
    </Card>
  );
}

const comparisonKpis = [
  { key: "npv" as const, label: "VPL" },
  { key: "irrAnnual" as const, label: "TIR" },
  { key: "paybackMonths" as const, label: "Payback" },
  { key: "totalOperatingCashFlow" as const, label: "Caixa" },
];

function formatSignedKpi(key: Parameters<typeof formatKpi>[0], value: string | null | undefined) {
  const numeric = Number(value ?? "0");
  if (!Number.isFinite(value === null ? NaN : numeric)) return "PENDENTE";
  return `${numeric >= 0 ? "+" : "−"}${formatKpi(key, String(Math.abs(numeric)))}`;
}

function formatMarginalMonths(value: string | null) {
  if (value === null) return "Não atinge com esta hipótese";
  return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses`;
}

const inputLabels: Partial<Record<FinancialInputKey, string>> = {
  qualifiedCouplesMonth1: "Casais qualificados",
  qualifiedCouplesGrowthRate: "Crescimento da captação",
  conversionRate: "Conversão comercial",
  averageTicket: "Ticket médio",
  collectionRate: "Taxa de recebimento",
  cancellationRate: "Taxa de cancelamento",
  variableCostRate: "Custo variável",
  partnerShareRate: "Repasse a parceiros",
  fixedCostMonthly: "Custo fixo mensal",
  payrollMonthly: "Folha mensal",
  capexInitial: "CAPEX inicial",
  preOperationMonths: "Meses de pré-operação",
  entryValuePerContract: "Entrada por contrato",
  paymentCardViewMixRate: "Mix cartão à vista",
  paymentCardViewMdrRate: "MDR cartão à vista",
  paymentCardViewSettlementDays: "Prazo cartão à vista",
  paymentCardInstallmentMixRate: "Mix cartão parcelado",
  paymentCardInstallmentMdrRate: "MDR cartão parcelado",
  paymentCardInstallmentSettlementDays: "Prazo cartão parcelado",
  paymentDebitMixRate: "Mix débito",
  paymentDebitMdrRate: "MDR débito",
  paymentDebitSettlementDays: "Prazo débito",
  paymentRecurringChequeMixRate: "Mix recorrente / cheque",
  paymentRecurringChequeMdrRate: "MDR recorrente / cheque",
  paymentRecurringChequeSettlementDays: "Prazo recorrente / cheque",
  paymentBoletoMixRate: "Mix boleto",
  paymentBoletoMdrRate: "MDR boleto",
  paymentBoletoSettlementDays: "Prazo boleto",
  discountRateAnnual: "Taxa de desconto",
};


function LiveDocumentNavigator() {
  return (
    <nav className="sticky top-3 z-20 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/85 p-2 shadow-xl backdrop-blur-xl">
      <div className="flex min-w-max gap-1">
        {LIVE_DOCUMENT_CHAPTERS.map(page =>
          "external" in page && page.external ? (
            <Link key={page.number} href={page.href} className="group flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.07] hover:text-white">
              <span className="font-mono text-[10px] text-amber-200/75">{page.number}</span>
              <span className="font-medium">{page.title}</span>
            </Link>
          ) : (
            <a key={page.number} href={page.href} className="group flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.07] hover:text-white">
              <span className="font-mono text-[10px] text-amber-200/75">{page.number}</span>
              <span className="font-medium">{page.title}</span>
            </a>
          )
        )}
      </div>
    </nav>
  );
}

function formatDelta(
  key: (typeof comparisonKpis)[number]["key"],
  current: string | null | undefined,
  previous: string | null | undefined
) {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined
  )
    return "Sem versão anterior comparável";
  const delta = Number(current) - Number(previous);
  if (!Number.isFinite(delta)) return "Sem variação comparável";
  const signal = delta > 0 ? "+" : delta < 0 ? "−" : "=";
  return `${signal} ${formatKpi(key, Math.abs(delta).toString())}`;
}

export default function Boardroom() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const projectsQuery = trpc.igr.projects.useQuery(undefined, { retry: false });
  const [activeProjectId, setActiveProjectId] = useState("");
  const [approvalRationale, setApprovalRationale] = useState("");
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [captadorDelta, setCaptadorDelta] = useState("-2");
  const [qualifiedCouplesPerCaptadorMonth, setQualifiedCouplesPerCaptadorMonth] = useState("12");
  const [loadedCostPerCaptadorMonth, setLoadedCostPerCaptadorMonth] = useState("3500");
  const [averageTicketDelta, setAverageTicketDelta] = useState("0");
  const [fixedCostMonthlyDelta, setFixedCostMonthlyDelta] = useState("0");
  const [payrollMonthlyDelta, setPayrollMonthlyDelta] = useState("0");
  const [variableCostMonthlyDelta, setVariableCostMonthlyDelta] = useState("0");
  const [capexInitialDelta, setCapexInitialDelta] = useState("0");
  useEffect(() => {
    if (!activeProjectId && projectsQuery.data?.[0])
      setActiveProjectId(projectsQuery.data[0].id);
  }, [activeProjectId, projectsQuery.data]);

  const contextQuery = trpc.igr.projectContext.useQuery(
    { projectId: activeProjectId },
    { enabled: Boolean(activeProjectId), retry: false }
  );
  const snapshot = contextQuery.data?.latestSnapshot;
  const calculation = snapshot?.payload as unknown as
    | (FinancialCalculation & {
        snapshotHash: string;
        authoritativeDomains?: { asOfMonth?: number };
      })
    | undefined;
  const approval = contextQuery.data?.latestApproval;
  const activeVersionId = contextQuery.data?.workingVersion?.id ?? "";
  const versionInputsQuery = trpc.igr.versionInputs.useQuery(
    { versionId: activeVersionId },
    { enabled: Boolean(activeVersionId), retry: false },
  );
  const assemblyQuery = trpc.igr.builderComponents.useQuery(
    { versionId: activeVersionId },
    { enabled: Boolean(activeVersionId), retry: false },
  );
  const eligibilityQuery = trpc.igr.exportEligibility.useQuery(
    { snapshotId: snapshot?.id ?? "" },
    { enabled: Boolean(snapshot?.id), retry: false }
  );
  const activeProject = projectsQuery.data?.find(
    project => project.id === activeProjectId
  );
  const loading =
    projectsQuery.isLoading ||
    (Boolean(activeProjectId) && contextQuery.isLoading);
  const hasError = projectsQuery.isError || contextQuery.isError;

  const approve = trpc.igr.approveSnapshot.useMutation({
    onSuccess: async () => {
      await contextQuery.refetch();
      await eligibilityQuery.refetch();
      setApprovalRationale("");
      toast.success("Estudo aprovado com racional registrado.");
    },
    onError: error =>
      toast.error("Aprovação recusada.", { description: error.message }),
  });
  const freeze = trpc.igr.freezeBaseline.useMutation({
    onSuccess: async () => {
      await contextQuery.refetch();
      await utils.igr.projects.invalidate();
      toast.success("Baseline do estudo congelada.");
    },
    onError: error =>
      toast.error("Não foi possível congelar.", { description: error.message }),
  });
  const requestExport = trpc.igr.requestExport.useMutation({
    onSuccess: result => {
      setExportUrl(result.url);
      toast.success("Estudo exportado.", {
        description: `Snapshot ${result.snapshotHash.slice(0, 12).toUpperCase()}`,
      });
    },
    onError: error =>
      toast.error("Exportação bloqueada.", { description: error.message }),
  });
  const simulateCaptadores = trpc.igr.simulateCaptadores.useMutation({
    onError: error =>
      toast.error("A simulação não pôde rodar.", { description: error.message }),
  });

  const kpis = calculation?.kpis;
  const versionInputs = versionInputsQuery.data as FinancialInputSnapshot | undefined;
  const assemblyPayload = (assemblyQuery.data?.find(record => record.componentType === "project_assembly")?.payload ?? {}) as Record<string, unknown>;
  const assemblyValue = (key: string) => {
    const value = assemblyPayload[key];
    return typeof value === "string" && value.trim() ? value : "PENDENTE";
  };
  const implementationCalendar = [
    { label: "Ativação de captação", shareKey: "capexAcquisitionShareRate" as const, monthKey: "capexAcquisitionMonth" as const },
    { label: "Sala de vendas", shareKey: "capexSalesRoomShareRate" as const, monthKey: "capexSalesRoomMonth" as const },
    { label: "Sales kit", shareKey: "capexSalesKitShareRate" as const, monthKey: "capexSalesKitMonth" as const },
  ].map(item => ({
    ...item,
    share: versionInputs?.[item.shareKey]?.value,
    month: versionInputs?.[item.monthKey]?.value,
  })).filter(item => item.share !== undefined && item.month !== undefined);
  const previousSnapshot = contextQuery.data?.snapshotHistory.find(
    item => item.id !== snapshot?.id && item.calculationStatus === "valid"
  );
  const previousKpis = previousSnapshot?.kpis as
    | FinancialCalculation["kpis"]
    | undefined;
  const missingInputKeys =
    contextQuery.data?.snapshotHistory[0]?.missingInputKeys ?? [];
  const domainIssues = [
    ...(contextQuery.data?.snapshotHistory[0]?.domainBlockers ?? []),
    ...(contextQuery.data?.snapshotHistory[0]?.domainInvalidities ?? []),
  ];
  const changedInputKeys = (
    contextQuery.data?.latestImpact.changedInputKeys ?? []
  ).filter((key): key is FinancialInputKey =>
    FINANCIAL_INPUT_KEYS.includes(key as FinancialInputKey)
  );
  const impactedChapters = getStudyImpacts(changedInputKeys);
  const studyConclusion = !snapshot
    ? "Preencha as premissas essenciais para o TGR montar a primeira leitura de viabilidade."
    : !snapshot.isAuthoritative
      ? `${missingInputKeys.length + domainIssues.length || "Algumas"} premissa(s) ou domínio(s) ainda bloqueiam a conclusão autoritativa deste estudo.`
      : Number(kpis?.npv ?? 0) >= 0
        ? "O estudo está calculado e pronto para revisão executiva. Revise cenários, risco de caixa e racional antes de aprovar."
        : "O estudo está calculado, mas o retorno projetado exige revisão de premissas, capital ou estrutura operacional antes de aprovação.";
  const metrics = [
    {
      label: "VPL",
      detail: "Valor presente líquido",
      value: formatKpi("npv", kpis?.npv),
    },
    {
      label: "TIR",
      detail: "Retorno anual estimado",
      value: formatKpi("irrAnnual", kpis?.irrAnnual),
    },
    {
      label: "Payback",
      detail: "Recuperação do investimento",
      value: formatKpi("paybackMonths", kpis?.paybackMonths),
    },
    {
      label: "Caixa",
      detail: "Resultado operacional acumulado",
      value: formatKpi("totalOperatingCashFlow", kpis?.totalOperatingCashFlow),
    },
  ];
  const documentTotals = calculation?.projections.reduce((total, row) => ({
    qualifiedCouples: total.qualifiedCouples + Number(row.qualifiedCouples),
    contracts: total.contracts + Number(row.contracts),
    grossSales: total.grossSales + Number(row.grossSales),
    grossEntryGenerated: total.grossEntryGenerated + Number(row.grossEntryGenerated ?? "0"),
    grossEntrySettled: total.grossEntrySettled + Number(row.grossEntrySettled ?? "0"),
    grossReceivablesGenerated: total.grossReceivablesGenerated + Number(row.grossReceivablesGenerated ?? row.grossEntryGenerated ?? "0"),
    grossReceivablesSettled: total.grossReceivablesSettled + Number(row.grossReceivablesSettled ?? row.grossEntrySettled ?? "0"),
    installmentCollections: total.installmentCollections + Number(row.installmentCollections ?? "0"),
    canceledReceivables: total.canceledReceivables + Number(row.canceledReceivables ?? "0"),
    curedCollections: total.curedCollections + Number(row.curedCollections ?? "0"),
    writtenOffBalance: total.writtenOffBalance + Number(row.writtenOffBalance ?? "0"),
    healthyD90: total.healthyD90 + Number(row.healthyD90 ?? "0"),
    paymentFees: total.paymentFees + Number(row.paymentFees ?? "0"),
    netCollections: total.netCollections + Number(row.netCollections ?? row.recognizedRevenue),
    variableCosts: total.variableCosts + Number(row.variableCosts),
    fixedCosts: total.fixedCosts + Number(row.fixedCosts),
    payroll: total.payroll + Number(row.payroll),
    preOperationalInvestment: total.preOperationalInvestment + Number(row.preOperationalInvestment ?? row.capex),
  }), { qualifiedCouples: 0, contracts: 0, grossSales: 0, grossEntryGenerated: 0, grossEntrySettled: 0, grossReceivablesGenerated: 0, grossReceivablesSettled: 0, installmentCollections: 0, canceledReceivables: 0, curedCollections: 0, writtenOffBalance: 0, healthyD90: 0, paymentFees: 0, netCollections: 0, variableCosts: 0, fixedCosts: 0, payroll: 0, preOperationalInvestment: 0 });
  const formatCount = (value: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
  const chapterFormulaMemory = (href: (typeof LIVE_DOCUMENT_CHAPTERS)[number]["href"]) => getChapterFormulaTrace(href, calculation?.memory ?? []).formulas;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_85%_15%,rgba(181,145,75,0.16),transparent_30%),linear-gradient(135deg,rgba(18,29,49,0.96),rgba(8,14,27,0.98))] px-6 py-7 shadow-2xl sm:px-8">
        <div className="absolute right-6 top-5 hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80 sm:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,.9)]" />
          Estudo determinístico
        </div>
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">
            TGR — estudo de viabilidade vivo
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            O estudo inteiro. Vivo. Ajustável.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            Mude uma premissa e veja o impacto no produto, na operação, no caixa
            e na decisão. Não é planilha bonita; é o estudo de viabilidade que
            se mexe junto com você.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              asChild
              className="bg-amber-400 text-slate-950 hover:bg-amber-300"
            >
              <Link href="/builder">
                Montar estudo <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.03] px-2 py-1">
              <Label htmlFor="tgr-project" className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.11em] text-amber-200/80">
                Abrir estudo
              </Label>
              <select
                id="tgr-project"
                className="h-8 min-w-40 rounded-md border-0 bg-transparent px-2 text-sm text-slate-200 outline-none"
                value={activeProjectId}
                onChange={event => {
                  setActiveProjectId(event.target.value);
                  setExportUrl(null);
                }}
                disabled={projectsQuery.isLoading}
              >
                <option value="">
                  {projectsQuery.isLoading
                    ? "Carregando…"
                    : "Selecionar estudo"}
                </option>
                {projectsQuery.data?.map(project => (
                  <option value={project.id} key={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            {snapshot ? (
              <Badge
                variant="outline"
                className="border-white/15 bg-white/5 px-3 py-1.5 text-slate-200"
              >
                Versão {snapshot.snapshotHash.slice(0, 12).toUpperCase()}
              </Badge>
            ) : null}
          </div>
        </div>
      </section>

      <LiveDocumentNavigator />

      {hasError ? (
        <Card className="border-red-400/20 bg-red-400/[0.04]">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-300" />O TGR não
              conseguiu carregar o estudo selecionado.
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void projectsQuery.refetch();
                void contextQuery.refetch();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section id="study-summary" className="scroll-mt-24">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">Página 07 · Indicadores</p>
            <p className="mt-1 text-sm text-muted-foreground">A síntese executiva que as páginas anteriores calculam.</p>
            <ChapterFormulaTrace source="snapshot" memory={chapterFormulaMemory("#study-impact")} />
          </div>
          {snapshot ? <Badge variant="outline" className="border-white/15 bg-white/[0.03] text-slate-200">Snapshot vivo</Badge> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <Card
                key={index}
                className="h-40 animate-pulse border-white/10 bg-card/60"
              />
            ))
          : metrics.map(kpi => (
              <MetricCard
                key={kpi.label}
                {...kpi}
                status={
                  snapshot
                    ? snapshot.isAuthoritative
                      ? "Estudo autoritativo"
                      : "Estudo bloqueado por pendência"
                    : "Aguardando cálculo"
                }
              />
            ))}
        </div>
      </section>

      {snapshot && versionInputs ? (
        <section id="study-assumptions" className="scroll-mt-24 space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">Página 01 · Premissas</p><p className="mt-1 text-sm text-muted-foreground">O que a ficha-mãe decidiu e o que ainda está pendente antes de a operação começar.</p><ChapterFormulaTrace source="ficha_mae" memory={[]} /></div>
          <Card className="border-white/10 bg-card/80 shadow-none"><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Premissa</th><th className="px-5 py-3 font-medium">Valor</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Origem</th></tr></thead><tbody>{(["averageTicket", "entryValuePerContract", "collectionRate", "cancellationRate", "preOperationMonths", "fixedCostMonthly", "payrollMonthly", "capexInitial"] as const).map(key => { const input = versionInputs[key]; return <tr className="border-b border-white/[0.06] text-slate-200 last:border-0" key={key}><td className="px-5 py-3 font-medium">{inputLabels[key]}</td><td className="px-5 py-3">{input?.value ? formatKpi(key, input.value) : "PENDENTE"}</td><td className="px-5 py-3"><Badge variant="outline" className={input?.status === "provided" ? "border-emerald-300/25 text-emerald-200" : "border-amber-200/25 text-amber-200"}>{input?.status === "provided" ? "INFORMADO" : "PENDENTE"}</Badge></td><td className="px-5 py-3 text-xs text-muted-foreground">{input?.sourceRef ?? "Sem fonte"}</td></tr>; })}</tbody></table></CardContent></Card>
        </section>
      ) : null}

      {snapshot && calculation && documentTotals ? (
        <section id="study-product" className="scroll-mt-24 space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">Página 03 · Produto</p><p className="mt-1 text-sm text-muted-foreground">O produto definido na ficha-mãe antes de qualquer promessa de venda.</p><ChapterFormulaTrace source="ficha_mae" memory={[]} /></div>
          <Card className="border-white/10 bg-card/80 shadow-none"><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[840px] text-left text-sm"><thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Projeto</th><th className="px-5 py-3 font-medium">Praça</th><th className="px-5 py-3 font-medium">Início</th><th className="px-5 py-3 font-medium">Apartamentos</th><th className="px-5 py-3 font-medium">Cotas / apartamento</th></tr></thead><tbody><tr className="text-slate-100"><td className="px-5 py-4 font-medium">{assemblyValue("nomeProjeto")}</td><td className="px-5 py-4">{assemblyValue("praca")}</td><td className="px-5 py-4">{assemblyValue("inicioOperacao")}</td><td className="px-5 py-4">{assemblyValue("totalApartamentos")}</td><td className="px-5 py-4">{assemblyValue("cotasPorApartamento")}</td></tr></tbody></table></CardContent></Card>
        </section>
      ) : null}

      {snapshot && calculation && documentTotals ? (
        <section id="study-sales" className="scroll-mt-24 space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">Página 04 · Vendas</p><p className="mt-1 text-sm text-muted-foreground">A capacidade comercial que a matriz e os canais precisam transformar em contrato.</p><ChapterFormulaTrace source="snapshot" memory={chapterFormulaMemory("#study-sales")} /></div>
          <Card className="border-white/10 bg-card/80 shadow-none"><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Qualificados</th><th className="px-5 py-3 font-medium">Contratos</th><th className="px-5 py-3 font-medium">Conversão realizada</th><th className="px-5 py-3 font-medium">Venda bruta</th><th className="px-5 py-3 font-medium">Ticket médio</th></tr></thead><tbody><tr className="text-slate-100"><td className="px-5 py-5 font-mono">{formatCount(documentTotals.qualifiedCouples)}</td><td className="px-5 py-5 font-mono">{formatCount(documentTotals.contracts)}</td><td className="px-5 py-5">{documentTotals.qualifiedCouples ? `${(documentTotals.contracts / documentTotals.qualifiedCouples * 100).toFixed(2)}%` : "PENDENTE"}</td><td className="px-5 py-5 text-amber-200">{formatKpi("grossSales", String(documentTotals.grossSales))}</td><td className="px-5 py-5">{documentTotals.contracts ? formatKpi("grossSales", String(documentTotals.grossSales / documentTotals.contracts)) : "PENDENTE"}</td></tr></tbody></table></CardContent></Card>
        </section>
      ) : null}

      {snapshot && calculation && documentTotals ? (
        <section id="study-revenue" className="scroll-mt-24 space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">Página 05 · Receita</p><p className="mt-1 text-sm text-muted-foreground">Da entrada contratada ao saldo parcelado e ao dinheiro líquido, respeitando calendário, prazo e MDR.</p><ChapterFormulaTrace source="snapshot" memory={chapterFormulaMemory("#study-revenue")} /></div>
          <Card className="border-white/10 bg-card/80 shadow-none"><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Entrada gerada</th><th className="px-5 py-3 font-medium">Recebíveis gerados</th><th className="px-5 py-3 font-medium">Recebíveis liquidados</th><th className="px-5 py-3 font-medium">Parcelas líquidas</th><th className="px-5 py-3 font-medium">Taxas / MDR</th><th className="px-5 py-3 font-medium">Recebimentos líquidos</th><th className="px-5 py-3 font-medium">Liquidação líquida</th></tr></thead><tbody><tr className="text-slate-100"><td className="px-5 py-5">{formatKpi("grossEntryGenerated", String(documentTotals.grossEntryGenerated))}</td><td className="px-5 py-5">{formatKpi("grossReceivablesGenerated", String(documentTotals.grossReceivablesGenerated))}</td><td className="px-5 py-5">{formatKpi("grossReceivablesSettled", String(documentTotals.grossReceivablesSettled))}</td><td className="px-5 py-5">{formatKpi("installmentCollections", String(documentTotals.installmentCollections))}</td><td className="px-5 py-5 text-rose-200">{formatKpi("paymentFees", String(documentTotals.paymentFees))}</td><td className="px-5 py-5 text-emerald-200">{formatKpi("netCollections", String(documentTotals.netCollections))}</td><td className="px-5 py-5">{documentTotals.grossReceivablesSettled ? `${((documentTotals.netCollections / documentTotals.grossReceivablesSettled) * 100).toFixed(2)}%` : "PENDENTE"}</td></tr></tbody></table></CardContent></Card>
          <Card className="border-white/10 bg-card/80 shadow-none"><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Cancelados antes do vencimento</th><th className="px-5 py-3 font-medium">Saldo inadimplente</th><th className="px-5 py-3 font-medium">Curas</th><th className="px-5 py-3 font-medium">Write-off</th><th className="px-5 py-3 font-medium">Healthy D90</th></tr></thead><tbody><tr className="text-slate-100"><td className="px-5 py-5 text-rose-200">{formatKpi("canceledReceivables", calculation.kpis.canceledReceivables)}</td><td className="px-5 py-5 text-amber-200">{formatKpi("delinquentBalance", calculation.kpis.delinquentBalance)}</td><td className="px-5 py-5 text-emerald-200">{formatKpi("curedCollections", calculation.kpis.curedCollections)}</td><td className="px-5 py-5 text-rose-200">{formatKpi("writtenOffBalance", calculation.kpis.writtenOffBalance)}</td><td className="px-5 py-5 font-mono">{formatCount(Number(calculation.kpis.healthyD90 ?? "0"))}</td></tr></tbody></table></CardContent></Card>
        </section>
      ) : null}

      {snapshot && calculation && documentTotals ? (
        <section id="study-costs" className="scroll-mt-24 space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">Página 06 · Custos</p><p className="mt-1 text-sm text-muted-foreground">A estrutura recorrente que consome caixa enquanto a operação vende.</p><ChapterFormulaTrace source="snapshot" memory={chapterFormulaMemory("#study-costs")} /></div>
          <Card className="border-white/10 bg-card/80 shadow-none"><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Custo variável</th><th className="px-5 py-3 font-medium">Custo fixo</th><th className="px-5 py-3 font-medium">Folha</th><th className="px-5 py-3 font-medium">Custo operacional</th></tr></thead><tbody><tr className="text-slate-100"><td className="px-5 py-5">{formatKpi("totalOperatingCashFlow", String(documentTotals.variableCosts))}</td><td className="px-5 py-5">{formatKpi("totalOperatingCashFlow", String(documentTotals.fixedCosts))}</td><td className="px-5 py-5">{formatKpi("totalOperatingCashFlow", String(documentTotals.payroll))}</td><td className="px-5 py-5">{formatKpi("totalOperatingCashFlow", String(documentTotals.variableCosts + documentTotals.fixedCosts + documentTotals.payroll))}</td></tr></tbody></table></CardContent></Card>
        </section>
      ) : null}

      {snapshot && calculation && documentTotals ? (
        <section id="study-operation" className="scroll-mt-24 space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">Página 07 · Operação</p><p className="mt-1 text-sm text-muted-foreground">A transição da implantação para a operação: capital inicial, entrada de clientes e caixa em funcionamento.</p><ChapterFormulaTrace source="snapshot" memory={chapterFormulaMemory("#study-operation")} /></div>
          <Card className="border-white/10 bg-card/80 shadow-none"><CardContent className="grid gap-3 p-5 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Pré-investimento</p><p className="mt-2 font-medium text-amber-200">{formatKpi("preOperationalInvestment", String(documentTotals.preOperationalInvestment))}</p></div><div><p className="text-xs text-muted-foreground">Meses de pré-operação</p><p className="mt-2 font-medium">{versionInputs?.preOperationMonths.value ?? "PENDENTE"}</p></div><div><p className="text-xs text-muted-foreground">Caixa operacional acumulado</p><p className="mt-2 font-medium">{formatKpi("totalOperatingCashFlow", kpis?.totalOperatingCashFlow)}</p></div></CardContent></Card>
        </section>
      ) : null}

      {snapshot ? (
        <section id="study-impact" className="scroll-mt-24 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <Card className="border-white/10 bg-card/80 shadow-none">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">
                  Impacto entre versões
                </p>
                <CardTitle className="mt-2 text-xl">
                  O que mudou no estudo
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="border-white/15 bg-white/[0.03] text-slate-200"
              >
                {previousSnapshot
                  ? `vs ${previousSnapshot.snapshotHash.slice(0, 8).toUpperCase()}`
                  : "Primeiro snapshot"}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {comparisonKpis.map(metric => (
                <div
                  key={metric.key}
                  className="rounded-xl border border-white/8 bg-white/[0.025] p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-3 font-medium text-slate-100">
                    {formatDelta(
                      metric.key,
                      kpis?.[metric.key],
                      previousKpis?.[metric.key]
                    )}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {previousSnapshot
                      ? "variação contra snapshot anterior"
                      : "será comparado após o próximo cálculo"}
                  </p>
                </div>
              ))}
            </CardContent>
            {changedInputKeys.length ? (
              <CardContent className="border-t border-white/8 pt-4">
                <div className="grid gap-3 lg:grid-cols-[.9fr_1.1fr]">
                  <div className="rounded-xl border border-amber-200/15 bg-amber-100/[0.025] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-200/80">
                      Premissas alteradas
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      {changedInputKeys
                        .map(key => inputLabels[key] ?? key)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-200/80">
                      Capítulos recalculados
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      {impactedChapters
                        .map(
                          impact =>
                            `${impact.chapter}: ${impact.outputs.join(", ")}`
                        )
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              </CardContent>
            ) : null}
          </Card>
          <Card className="border-amber-200/20 bg-amber-100/[0.025] shadow-none">
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">
                Conclusão executiva
              </p>
              <CardTitle className="mt-2 text-xl">
                O que a versão atual diz
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-6 text-slate-200">
                {studyConclusion}
              </p>
              {missingInputKeys.length || domainIssues.length ? (
                <div className="rounded-xl border border-amber-200/15 bg-black/10 p-3 text-xs text-amber-100">
                  <p className="font-medium">Pendências críticas</p>
                  <p className="mt-1 leading-5">
                    {[...missingInputKeys, ...domainIssues].join(" · ")}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-3 text-xs text-emerald-100">
                  Premissas obrigatórias validadas neste snapshot.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {snapshot?.isAuthoritative ? (
        <Card id="study-scenarios" className="scroll-mt-24 border-sky-300/20 bg-sky-300/[0.025] shadow-none">
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200/90">
              Simulação de reunião
            </p>
            <CardTitle className="mt-2 text-xl">
              “E se mexer na máquina inteira?”
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Esta cópia recalcula captação, folha, comissão/incentivo e CAPEX sem gravar, aprovar ou alterar a versão oficial. É uma mesa de decisão, não uma canetada escondida.
            </p>
            <ChapterFormulaTrace source="snapshot" memory={chapterFormulaMemory("#study-scenarios")} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <Label htmlFor="captador-delta">Variação de captadores</Label>
                <Input id="captador-delta" inputMode="decimal" value={captadorDelta} onChange={event => setCaptadorDelta(event.target.value)} className="mt-1.5 bg-white/[0.03]" />
              </div>
              <div>
                <Label htmlFor="casais-por-captador">Casais por captador/mês</Label>
                <Input id="casais-por-captador" inputMode="decimal" value={qualifiedCouplesPerCaptadorMonth} onChange={event => setQualifiedCouplesPerCaptadorMonth(event.target.value)} className="mt-1.5 bg-white/[0.03]" />
              </div>
              <div>
                <Label htmlFor="custo-captador">Custo carregado por captador/mês</Label>
                <Input id="custo-captador" inputMode="decimal" value={loadedCostPerCaptadorMonth} onChange={event => setLoadedCostPerCaptadorMonth(event.target.value)} className="mt-1.5 bg-white/[0.03]" />
              </div>
              <div>
                <Label htmlFor="delta-ticket">Variação de ticket (R$)</Label>
                <Input id="delta-ticket" inputMode="decimal" value={averageTicketDelta} onChange={event => setAverageTicketDelta(event.target.value)} className="mt-1.5 bg-white/[0.03]" />
              </div>
              <div>
                <Label htmlFor="delta-fixo">Variação de custo fixo/mês (R$)</Label>
                <Input id="delta-fixo" inputMode="decimal" value={fixedCostMonthlyDelta} onChange={event => setFixedCostMonthlyDelta(event.target.value)} className="mt-1.5 bg-white/[0.03]" />
              </div>
              <div>
                <Label htmlFor="delta-folha">Ajuste de folha/mês (R$)</Label>
                <Input id="delta-folha" inputMode="decimal" value={payrollMonthlyDelta} onChange={event => setPayrollMonthlyDelta(event.target.value)} className="mt-1.5 bg-white/[0.03]" />
              </div>
              <div>
                <Label htmlFor="delta-comissao">Comissão / incentivo mês (R$)</Label>
                <Input id="delta-comissao" inputMode="decimal" value={variableCostMonthlyDelta} onChange={event => setVariableCostMonthlyDelta(event.target.value)} className="mt-1.5 bg-white/[0.03]" />
              </div>
              <div>
                <Label htmlFor="delta-capex">CAPEX de implantação (R$)</Label>
                <Input id="delta-capex" inputMode="decimal" value={capexInitialDelta} onChange={event => setCapexInitialDelta(event.target.value)} className="mt-1.5 bg-white/[0.03]" />
              </div>
            </div>
            <Button
              variant="outline"
              className="border-sky-300/30 bg-sky-300/[0.08] text-sky-100 hover:bg-sky-300/[0.15]"
              disabled={simulateCaptadores.isPending}
              onClick={() =>
                simulateCaptadores.mutate({
                  versionId: snapshot.projectVersionId,
                  horizonMonths: snapshot.horizonMonths,
                  asOfMonth: calculation?.authoritativeDomains?.asOfMonth ?? 0,
                  captadorDelta,
                  qualifiedCouplesPerCaptadorMonth,
                  loadedCostPerCaptadorMonth,
                  averageTicketDelta,
                  fixedCostMonthlyDelta,
                  payrollMonthlyDelta,
                  variableCostMonthlyDelta,
                  capexInitialDelta,
                })
              }
            >
              {simulateCaptadores.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Simular impacto sem gravar
            </Button>
            {simulateCaptadores.data ? (
              <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">Qualificados — mês 1</p><p className="mt-2 font-medium">{simulateCaptadores.data.before.qualifiedCouplesMonth1} → {simulateCaptadores.data.after.qualifiedCouplesMonth1}</p></div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">Folha mensal</p><p className="mt-2 font-medium">{formatKpi("totalOperatingCashFlow", simulateCaptadores.data.before.payrollMonthly)} → {formatKpi("totalOperatingCashFlow", simulateCaptadores.data.after.payrollMonthly)}</p></div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">Ticket médio</p><p className="mt-2 font-medium">{formatKpi("grossSales", simulateCaptadores.data.before.averageTicket)} → {formatKpi("grossSales", simulateCaptadores.data.after.averageTicket)}</p></div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">Custo fixo mensal</p><p className="mt-2 font-medium">{formatKpi("totalOperatingCashFlow", simulateCaptadores.data.before.fixedCostMonthly)} → {formatKpi("totalOperatingCashFlow", simulateCaptadores.data.after.fixedCostMonthly)}</p></div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">Comissão / incentivo mês</p><p className="mt-2 font-medium">{formatKpi("totalOperatingCashFlow", simulateCaptadores.data.before.variableCostMonthly)} → {formatKpi("totalOperatingCashFlow", simulateCaptadores.data.after.variableCostMonthly)}</p></div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">CAPEX de implantação</p><p className="mt-2 font-medium">{formatKpi("preOperationalInvestment", simulateCaptadores.data.before.capexInitial)} → {formatKpi("preOperationalInvestment", simulateCaptadores.data.after.capexInitial)}</p></div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">VPL simulado</p><p className="mt-2 font-medium">{formatKpi("npv", simulateCaptadores.data.after.kpis.npv)}</p></div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">Caixa simulado</p><p className="mt-2 font-medium">{formatKpi("totalOperatingCashFlow", simulateCaptadores.data.after.kpis.totalOperatingCashFlow)}</p></div>
              </div>
              <div className="rounded-xl border border-sky-300/20 bg-sky-300/[0.035] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-sky-200/90">Leitura marginal da decisão</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{simulateCaptadores.data.marginal.method}</p></div><Badge variant="outline" className="border-sky-300/25 text-sky-100">NÃO PERSISTENTE</Badge></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-white/8 bg-black/10 p-3"><p className="text-xs text-muted-foreground">Ganho marginal de venda</p><p className="mt-1 font-medium text-emerald-200">{formatSignedKpi("grossSales", simulateCaptadores.data.marginal.grossSales)}</p></div>
                  <div className="rounded-lg border border-white/8 bg-black/10 p-3"><p className="text-xs text-muted-foreground">Custo marginal</p><p className="mt-1 font-medium text-rose-200">{formatSignedKpi("totalOperatingCashFlow", simulateCaptadores.data.marginal.cost)}</p></div>
                  <div className="rounded-lg border border-white/8 bg-black/10 p-3"><p className="text-xs text-muted-foreground">Caixa marginal</p><p className="mt-1 font-medium">{formatSignedKpi("totalOperatingCashFlow", simulateCaptadores.data.marginal.operatingCash)}</p></div>
                  <div className="rounded-lg border border-white/8 bg-black/10 p-3"><p className="text-xs text-muted-foreground">Investimento adicional</p><p className="mt-1 font-medium text-amber-200">{formatSignedKpi("preOperationalInvestment", simulateCaptadores.data.marginal.investment)}</p></div>
                  <div className="rounded-lg border border-white/8 bg-black/10 p-3"><p className="text-xs text-muted-foreground">Δ VPL</p><p className="mt-1 font-medium">{formatSignedKpi("npv", simulateCaptadores.data.marginal.npv)}</p></div>
                  <div className="rounded-lg border border-white/8 bg-black/10 p-3"><p className="text-xs text-muted-foreground">Δ TIR</p><p className="mt-1 font-medium">{formatSignedKpi("irrAnnual", simulateCaptadores.data.marginal.irrAnnual)}</p></div>
                  <div className="rounded-lg border border-white/8 bg-black/10 p-3"><p className="text-xs text-muted-foreground">Δ Payback</p><p className="mt-1 font-medium">{formatSignedKpi("paybackMonths", simulateCaptadores.data.marginal.paybackMonths)}</p></div>
                  <div className="rounded-lg border border-white/8 bg-black/10 p-3"><p className="text-xs text-muted-foreground">Ponto de equilíbrio da decisão</p><p className="mt-1 font-medium">{formatMarginalMonths(simulateCaptadores.data.marginal.recoveryMonths)}</p></div>
                </div>
                {simulateCaptadores.data.marginal.byLever.length ? (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-white/8">
                    <table className="w-full min-w-[1000px] text-left text-xs"><thead className="border-b border-white/10 bg-black/10 uppercase tracking-[0.1em] text-muted-foreground"><tr><th className="px-3 py-3 font-medium">Alavanca isolada</th><th className="px-3 py-3 font-medium">Ganho de venda</th><th className="px-3 py-3 font-medium">Custo</th><th className="px-3 py-3 font-medium">Caixa</th><th className="px-3 py-3 font-medium">Δ VPL</th><th className="px-3 py-3 font-medium">Δ TIR</th><th className="px-3 py-3 font-medium">Δ Payback</th><th className="px-3 py-3 font-medium">Equilíbrio</th></tr></thead><tbody>{simulateCaptadores.data.marginal.byLever.map(item => <tr className="border-b border-white/[0.06] text-slate-200 last:border-0" key={item.key}><td className="px-3 py-3 font-medium text-sky-100">{item.label}</td><td className="px-3 py-3 text-emerald-200">{formatSignedKpi("grossSales", item.marginal.grossSales)}</td><td className="px-3 py-3 text-rose-200">{formatSignedKpi("totalOperatingCashFlow", item.marginal.cost)}</td><td className="px-3 py-3">{formatSignedKpi("totalOperatingCashFlow", item.marginal.operatingCash)}</td><td className="px-3 py-3">{formatSignedKpi("npv", item.marginal.npv)}</td><td className="px-3 py-3">{formatSignedKpi("irrAnnual", item.marginal.irrAnnual)}</td><td className="px-3 py-3">{formatSignedKpi("paybackMonths", item.marginal.paybackMonths)}</td><td className="px-3 py-3">{formatMarginalMonths(item.marginal.recoveryMonths)}</td></tr>)}</tbody></table>
                  </div>
                ) : null}
              </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {snapshot && calculation ? (
        implementationCalendar.length === 3 ? (
          <Card className="border-white/10 bg-card/80 shadow-none">
            <CardHeader className="pb-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">Calendário de implantação</p>
              <CardTitle className="mt-2 text-xl">Captação, sala e sales kit no caixa</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-3 py-3 font-medium">Frente</th><th className="px-3 py-3 font-medium">Participação</th><th className="px-3 py-3 font-medium">Mês de implantação</th><th className="px-3 py-3 font-medium">Investimento</th></tr></thead><tbody>{implementationCalendar.map(item => <tr className="border-b border-white/[0.06] text-slate-200 last:border-0" key={item.label}><td className="px-3 py-3 font-medium">{item.label}</td><td className="px-3 py-3">{formatKpi(item.shareKey, item.share)}</td><td className="px-3 py-3">{item.month}</td><td className="px-3 py-3 text-amber-200">{formatKpi("preOperationalInvestment", String(Number(kpis?.preOperationalInvestment ?? 0) * Number(item.share)))}</td></tr>)}</tbody></table>
            </CardContent>
          </Card>
        ) : null
      ) : null}

      {snapshot && calculation ? (
        <Card id="study-cashflow" className="scroll-mt-24 border-white/10 bg-card/80 shadow-none">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">
                Demonstrativo vivo
              </p>
              <CardTitle className="mt-2 text-xl">
                Implantação, entrada líquida e caixa — primeiros 12 meses
              </CardTitle>
              <ChapterFormulaTrace source="snapshot" memory={chapterFormulaMemory("#study-cashflow")} />
            </div>
            <Badge variant="outline" className="border-white/15 bg-white/[0.03] text-slate-200">
              Snapshot {snapshot.snapshotHash.slice(0, 8).toUpperCase()}
            </Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <p className="mb-4 text-xs leading-5 text-muted-foreground">A venda gera entrada; cada forma de pagamento liquida no mês do seu prazo e já vem descontada do MDR. A implantação aparece antes da abertura operacional, sem ser maquiada como OPEX.</p>
            <table className="w-full min-w-[1660px] text-left text-xs">
              <thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Mês</th>
                  <th className="px-3 py-3 font-medium">Qualificados</th>
                  <th className="px-3 py-3 font-medium">Contratos</th>
                  <th className="px-3 py-3 font-medium">Venda bruta</th>
                  <th className="px-3 py-3 font-medium">Entrada gerada</th>
                  <th className="px-3 py-3 font-medium">Recebíveis liquidados</th>
                  <th className="px-3 py-3 font-medium">Parcelas líquidas</th>
                  <th className="px-3 py-3 font-medium">Taxas / MDR</th>
                  <th className="px-3 py-3 font-medium">Entrada líquida</th>
                  <th className="px-3 py-3 font-medium">Pré-invest.</th>
                  <th className="px-3 py-3 font-medium">Folha</th>
                  <th className="px-3 py-3 font-medium">Caixa do mês</th>
                  <th className="px-3 py-3 font-medium">Caixa acumulado</th>
                </tr>
              </thead>
              <tbody>
                {calculation.projections.slice(0, 12).map(row => (
                  <tr key={row.month} className="border-b border-white/[0.06] text-slate-200 last:border-0">
                    <td className="px-3 py-3 font-medium">{row.month}</td>
                    <td className="px-3 py-3 font-mono">{row.qualifiedCouples}</td>
                    <td className="px-3 py-3 font-mono">{row.contracts}</td>
                    <td className="px-3 py-3">{formatKpi("grossSales", row.grossSales)}</td>
                    <td className="px-3 py-3">{formatKpi("grossEntryGenerated", row.grossEntryGenerated ?? "0")}</td>
                    <td className="px-3 py-3">{formatKpi("grossReceivablesSettled", row.grossReceivablesSettled ?? row.grossEntrySettled ?? row.recognizedRevenue)}</td>
                    <td className="px-3 py-3">{formatKpi("installmentCollections", row.installmentCollections ?? "0")}</td>
                    <td className="px-3 py-3 text-rose-200">{formatKpi("paymentFees", row.paymentFees ?? "0")}</td>
                    <td className="px-3 py-3 text-emerald-200">{formatKpi("netCollections", row.netCollections ?? row.recognizedRevenue)}</td>
                    <td className="px-3 py-3 text-amber-200">{formatKpi("preOperationalInvestment", row.preOperationalInvestment ?? row.capex)}</td>
                    <td className="px-3 py-3">{formatKpi("totalOperatingCashFlow", row.payroll)}</td>
                    <td className="px-3 py-3">{formatKpi("totalOperatingCashFlow", row.operatingCashFlow)}</td>
                    <td className="px-3 py-3 font-medium">{formatKpi("totalOperatingCashFlow", row.cumulativeCashFlow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {snapshot && calculation ? (
        <section id="study-conclusion" className="scroll-mt-24 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <Card className="border-white/10 bg-card/80 shadow-none">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">
                  Como o estudo chegou aqui
                </p>
                <CardTitle className="mt-2 text-xl">
                  {activeProject?.name ?? "Estudo"}
                </CardTitle>
                <ChapterFormulaTrace source="snapshot" memory={chapterFormulaMemory("#study-conclusion")} />
              </div>
              <Badge
                className={
                  snapshot.isAuthoritative
                    ? "bg-emerald-300/10 text-emerald-200 hover:bg-emerald-300/10"
                    : "bg-amber-200/10 text-amber-200 hover:bg-amber-200/10"
                }
              >
                {snapshot.isAuthoritative ? "AUTORITATIVO" : "PENDENTE"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {calculation.memory.map(memory => (
                <div
                  key={memory.kpiKey}
                  className="rounded-xl border border-white/8 bg-white/[0.025] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{memory.label}</p>
                      <p className="mt-1 text-xs text-amber-200/90">
                        {memory.formulaId} · v{memory.formulaVersion}
                      </p>
                    </div>
                    <p className="font-mono text-sm text-slate-100">
                      {formatKpi(memory.kpiKey, memory.value)}
                    </p>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {memory.explanation}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(19,33,56,.86),rgba(12,20,35,.9))] shadow-none">
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">
                Fechar a decisão
              </p>
              <CardTitle className="mt-2 text-xl">Aprovar e exportar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4 text-sm">
                <p className="font-medium">Situação do estudo</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {contextQuery.data?.project.status === "baseline"
                    ? "Baseline congelada e protegida."
                    : approval
                      ? "Estudo aprovado; pronto para baseline ou entrega."
                      : snapshot.isAuthoritative
                        ? "Cálculo pronto para revisão do comitê."
                        : "Complete as pendências antes de defender a conclusão."}
                </p>
              </div>
              {user?.role === "admin" &&
              !approval &&
              snapshot.isAuthoritative ? (
                <div className="space-y-2">
                  <Label htmlFor="approval-rationale">
                    Por que o estudo foi aprovado?
                  </Label>
                  <Textarea
                    id="approval-rationale"
                    value={approvalRationale}
                    onChange={event => setApprovalRationale(event.target.value)}
                    placeholder="Decisão, trade-off e racional do comitê."
                    className="min-h-20 bg-white/[0.03]"
                  />
                  <Button
                    className="w-full bg-amber-400 text-slate-950 hover:bg-amber-300"
                    disabled={
                      approve.isPending || approvalRationale.trim().length < 3
                    }
                    onClick={() =>
                      approve.mutate({
                        snapshotId: snapshot.id,
                        rationale: approvalRationale.trim(),
                      })
                    }
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Aprovar estudo
                  </Button>
                </div>
              ) : null}
              {user?.role === "admin" &&
              approval &&
              contextQuery.data?.project.status !== "baseline" ? (
                <Button
                  variant="outline"
                  className="w-full border-white/15 bg-white/5"
                  disabled={freeze.isPending}
                  onClick={() => freeze.mutate({ snapshotId: snapshot.id })}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Congelar baseline
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="w-full border-white/15 bg-white/5"
                disabled={
                  !eligibilityQuery.data?.eligible || requestExport.isPending
                }
                onClick={() =>
                  requestExport.mutate({
                    snapshotId: snapshot.id,
                    format: "pdf",
                  })
                }
              >
                <FileOutput className="mr-2 h-4 w-4" />
                Exportar estudo em PDF
              </Button>
              <Button
                variant="outline"
                className="w-full border-white/15 bg-white/5"
                disabled={
                  !eligibilityQuery.data?.eligible || requestExport.isPending
                }
                onClick={() =>
                  requestExport.mutate({
                    snapshotId: snapshot.id,
                    format: "pptx",
                  })
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar apresentação
              </Button>
              <Button
                variant="outline"
                className="w-full border-white/15 bg-white/5"
                disabled={
                  !eligibilityQuery.data?.eligible || requestExport.isPending
                }
                onClick={() =>
                  requestExport.mutate({
                    snapshotId: snapshot.id,
                    format: "xlsx",
                  })
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar memória em XLSX
              </Button>
              {exportUrl ? (
                <a
                  href={exportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm font-medium text-emerald-100"
                >
                  Abrir artefato <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
              {!eligibilityQuery.data?.eligible ? (
                <p className="pt-1 text-xs leading-5 text-amber-200/80">
                  {eligibilityQuery.data?.reason ??
                    "Exportação exige estudo válido, aprovado e congelado."}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : !loading ? (
        <Card className="border-white/10 bg-card/80 shadow-none">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <p className="font-medium">
                  {projectsQuery.data?.length
                    ? "Selecione um estudo e calcule a versão de trabalho."
                    : "Nenhum estudo foi iniciado ainda."}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Comece pelas premissas essenciais. O TGR monta o estudo
                  inteiro conforme você ajusta a operação.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              asChild
              className="border-white/15 bg-white/5 hover:bg-white/10"
            >
              <Link href="/builder">Criar estudo</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-card/80">
          <CardContent className="p-5">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
            <p className="mt-5 font-medium">Cálculo decimal</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Dinheiro e taxa não passeiam em ponto flutuante.
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-card/80">
          <CardContent className="p-5">
            <FileCheck2 className="h-5 w-5 text-amber-300" />
            <p className="mt-5 font-medium">Estudo rastreável</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              KPI, fórmula, dependência, fonte e versão viajam juntos.
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-card/80">
          <CardContent className="p-5">
            <Sparkles className="h-5 w-5 text-amber-300" />
            <p className="mt-5 font-medium">Entrega congelada</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              PDF e apresentação saem da versão aprovada, não de improviso.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
