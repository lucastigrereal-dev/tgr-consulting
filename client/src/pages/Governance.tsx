import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatKpi,
  isDecimal,
  normalizeDecimalInput,
} from "@/lib/financialPresentation";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileOutput,
  Fingerprint,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const controls = [
  [
    Fingerprint,
    "Snapshot com hash",
    "Cada cálculo autoritativo recebe hash, fórmula e input snapshot identificáveis.",
  ],
  [
    ShieldCheck,
    "Baseline blindado",
    "Versão aprovada só pode virar baseline; baseline não aceita alteração direta.",
  ],
  [
    FileOutput,
    "Exportação bloqueada",
    "PDF/PPTX exige snapshot autoritativo, validado e aprovado.",
  ],
  [
    CheckCircle2,
    "Audit trail",
    "Criação, cenário, cálculo, aprovação e exportação registram evento com ator e contexto.",
  ],
] as const;
const eventLabels: Record<string, string> = {
  "version.created": "Versão de trabalho criada",
  "scenario.created": "Cenário aberto",
  "snapshot.submitted_for_review": "Snapshot enviado para análise",
  "snapshot.approved": "Snapshot aprovado",
  "baseline.frozen": "Baseline congelado",
};
const benchmarkKeys = [
  "npv",
  "irrAnnual",
  "paybackMonths",
  "totalOperatingCashFlow",
] as const;
type BenchmarkKey = (typeof benchmarkKeys)[number];
const benchmarkLabels: Record<BenchmarkKey, string> = {
  npv: "VPL",
  irrAnnual: "TIR anual",
  paybackMonths: "Payback (meses)",
  totalOperatingCashFlow: "Caixa operacional",
};

function BenchmarkLibrary({
  projectKpis,
}: {
  projectKpis: Record<string, unknown>;
}) {
  const benchmarksQuery = trpc.igr.historicalBenchmarks.useQuery(undefined, {
    retry: false,
  });
  const [benchmark, setBenchmark] = useState({
    name: "",
    vertical: "multipropriedade",
    periodLabel: "",
    metrics: {
      npv: "",
      irrAnnual: "",
      paybackMonths: "",
      totalOperatingCashFlow: "",
    } as Record<BenchmarkKey, string>,
    sourceRef: "",
    status: "pending" as "provided" | "pending",
  });
  const createBenchmark = trpc.igr.createHistoricalBenchmark.useMutation({
    onSuccess: async () => {
      await benchmarksQuery.refetch();
      setBenchmark({
        name: "",
        vertical: "multipropriedade",
        periodLabel: "",
        metrics: {
          npv: "",
          irrAnnual: "",
          paybackMonths: "",
          totalOperatingCashFlow: "",
        },
        sourceRef: "",
        status: "pending",
      });
      toast.success("Benchmark registrado fora do modelo vivo.");
    },
    onError: error =>
      toast.error("Benchmark não registrado.", { description: error.message }),
  });
  const saveBenchmark = () => {
    if (
      benchmark.name.trim().length < 2 ||
      benchmark.periodLabel.trim().length < 2
    )
      return toast.error("Nome e período são obrigatórios.");
    const entries = Object.entries(benchmark.metrics).filter(([, value]) =>
      value.trim()
    );
    if (
      benchmark.status === "provided" &&
      (!entries.length || entries.some(([, value]) => !isDecimal(value)))
    )
      return toast.error("Preencha ao menos uma métrica decimal válida.");
    if (
      benchmark.status === "provided" &&
      benchmark.sourceRef.trim().length < 2
    )
      return toast.error("Benchmark informado precisa de fonte primária.");
    createBenchmark.mutate({
      name: benchmark.name.trim(),
      vertical: benchmark.vertical.trim() || "multipropriedade",
      periodLabel: benchmark.periodLabel.trim(),
      status: benchmark.status,
      metrics: Object.fromEntries(entries),
      sourceType: "historical_primary",
      sourceRef: benchmark.sourceRef.trim() || undefined,
    });
  };
  const rows = benchmarksQuery.data ?? [];
  return (
    <Card className="border-white/10 bg-card/80 shadow-none">
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">
          Biblioteca histórica
        </p>
        <CardTitle className="mt-2 text-xl">
          Benchmark separado do modelo vivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Cadastre somente referência com fonte. Não é para despejar JSON e
          rezar, caralho.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="benchmark-name">Nome</Label>
            <Input
              id="benchmark-name"
              value={benchmark.name}
              onChange={event =>
                setBenchmark(current => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Ex.: Lançamento referência 2025"
              className="mt-1.5 bg-white/[0.03]"
            />
          </div>
          <div>
            <Label htmlFor="benchmark-period">Período</Label>
            <Input
              id="benchmark-period"
              value={benchmark.periodLabel}
              onChange={event =>
                setBenchmark(current => ({
                  ...current,
                  periodLabel: event.target.value,
                }))
              }
              placeholder="Ex.: Jan–Dez 2025"
              className="mt-1.5 bg-white/[0.03]"
            />
          </div>
          <div>
            <Label htmlFor="benchmark-vertical">Vertical</Label>
            <Input
              id="benchmark-vertical"
              value={benchmark.vertical}
              onChange={event =>
                setBenchmark(current => ({
                  ...current,
                  vertical: event.target.value,
                }))
              }
              placeholder="Multipropriedade"
              className="mt-1.5 bg-white/[0.03]"
            />
          </div>
          <div>
            <Label htmlFor="benchmark-source">Fonte primária</Label>
            <Input
              id="benchmark-source"
              value={benchmark.sourceRef}
              onChange={event =>
                setBenchmark(current => ({
                  ...current,
                  sourceRef: event.target.value,
                }))
              }
              placeholder="Documento, responsável ou referência"
              className="mt-1.5 bg-white/[0.03]"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {benchmarkKeys.map(key => (
            <div key={key}>
              <Label htmlFor={`benchmark-${key}`}>{benchmarkLabels[key]}</Label>
              <Input
                id={`benchmark-${key}`}
                inputMode="decimal"
                value={benchmark.metrics[key]}
                onChange={event =>
                  setBenchmark(current => ({
                    ...current,
                    metrics: {
                      ...current.metrics,
                      [key]: normalizeDecimalInput(event.target.value),
                    },
                  }))
                }
                placeholder={
                  key === "irrAnnual" ? "Ex.: 0,18" : "Deixe vazio se pendente"
                }
                className="mt-1.5 bg-white/[0.03] font-mono"
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="benchmark-status" className="sr-only">
            Status do benchmark
          </Label>
          <select
            id="benchmark-status"
            className="h-10 rounded-md border border-white/15 bg-white/5 px-3 text-sm"
            value={benchmark.status}
            onChange={event =>
              setBenchmark(current => ({
                ...current,
                status: event.target.value as "provided" | "pending",
              }))
            }
          >
            <option value="pending">PENDENTE</option>
            <option value="provided">INFORMADO</option>
          </select>
          <Button
            variant="outline"
            className="border-white/15 bg-white/[0.03]"
            disabled={createBenchmark.isPending}
            onClick={saveBenchmark}
          >
            {createBenchmark.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Registrar benchmark
          </Button>
        </div>
        {benchmarksQuery.isError ? (
          <p className="text-sm text-red-300">
            Não foi possível carregar a biblioteca histórica.
          </p>
        ) : rows.length ? (
          <div className="space-y-3 border-t border-white/8 pt-4">
            <p className="text-sm font-medium">
              Comparação com o snapshot selecionado
            </p>
            {rows.slice(0, 5).map(item => (
              <div
                key={item.id}
                className="rounded-xl border border-white/8 bg-white/[0.025] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {item.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {item.periodLabel}
                    </span>
                  </p>
                  <Badge
                    variant="outline"
                    className="border-white/15 text-slate-200"
                  >
                    {item.status === "provided" ? "INFORMADO" : "PENDENTE"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                  {Object.entries(item.metrics as Record<string, unknown>).map(
                    ([key, historic]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-3 rounded-lg bg-black/15 px-3 py-2"
                      >
                        <span className="text-muted-foreground">
                          {benchmarkLabels[key as BenchmarkKey] ?? key}
                        </span>
                        <span className="font-mono text-right">
                          hist. {formatKpi(key, String(historic))}
                          <br />
                          atual{" "}
                          {projectKpis[key] === undefined
                            ? "—"
                            : formatKpi(key, String(projectKpis[key]))}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum benchmark foi registrado; a biblioteca não contamina as
            premissas do projeto.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Governance() {
  const projectsQuery = trpc.igr.projects.useQuery(undefined, { retry: false });
  const [projectId, setProjectId] = useState("");
  useEffect(() => {
    if (!projectId && projectsQuery.data?.[0])
      setProjectId(projectsQuery.data[0].id);
  }, [projectId, projectsQuery.data]);
  const contextQuery = trpc.igr.projectContext.useQuery(
    { projectId },
    { enabled: Boolean(projectId), retry: false }
  );
  const history = contextQuery.data?.workflowHistory ?? [];
  const projectKpis =
    (
      contextQuery.data?.latestSnapshot?.payload as
        | { kpis?: Record<string, unknown> }
        | undefined
    )?.kpis ?? {};
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="rounded-2xl border border-white/10 bg-card/80 px-6 py-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200/80">
          Governança e auditoria
        </p>
        <h1 className="mt-2 font-serif text-3xl">
          Se não dá para reproduzir, não dá para aprovar.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          O TGR amarra número, fórmula, versão, snapshot e decisão. É a
          diferença entre comitê e roda de bar com notebook.
        </p>
        <Label htmlFor="governance-project" className="mt-5 block">
          Projeto auditado
        </Label>
        <select
          id="governance-project"
          className="mt-1.5 h-10 min-w-56 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-slate-200"
          value={projectId}
          onChange={event => setProjectId(event.target.value)}
        >
          <option value="">Selecionar projeto</option>
          {projectsQuery.data?.map(project => (
            <option value={project.id} key={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </header>
      {projectsQuery.isError || contextQuery.isError ? (
        <Card className="border-red-400/20 bg-red-400/[0.04]">
          <CardContent className="flex gap-3 p-5 text-sm">
            <AlertTriangle className="h-5 w-5 text-red-300" />
            Não foi possível carregar a trilha completa de governança.
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {controls.map(([Icon, title, detail]) => (
          <Card className="border-white/10 bg-card/80 shadow-none" key={title}>
            <CardContent className="flex gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-300/10">
                <Icon className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {detail}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-white/10 bg-card/80 shadow-none">
        <CardHeader>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">
            Workflow persistido
          </p>
          <CardTitle className="mt-2 text-xl">
            Linha do tempo de decisão
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contextQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Carregando eventos auditáveis…
            </p>
          ) : history.length ? (
            <ol className="space-y-3">
              {history.map(event => (
                <li
                  key={event.id}
                  className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-4"
                >
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {eventLabels[event.action] ?? event.action}
                      </p>
                      <Badge
                        variant="outline"
                        className="border-white/15 text-slate-200"
                      >
                        {event.fromState ?? "origem"} → {event.toState}
                      </Badge>
                    </div>
                    {event.rationale ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {event.rationale}
                      </p>
                    ) : null}
                    <p className="mt-2 font-mono text-[11px] text-slate-400">
                      Versão {event.versionId.slice(0, 10)} ·{" "}
                      {new Date(event.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              Crie um projeto para registrar versão, análise, aprovação e
              baseline nesta linha do tempo.
            </p>
          )}
        </CardContent>
      </Card>
      <BenchmarkLibrary projectKpis={projectKpis} />
      <Card className="border-amber-200/15 bg-amber-100/[0.025] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg">
            <Badge className="bg-amber-200/10 text-amber-200 hover:bg-amber-200/10">
              REGRA V1
            </Badge>
            Pendência não é defeito visual
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          Campo pendente continua pendente e bloqueia a autoridade do cálculo
          que depende dele. Isso protege a decisão do Lucas de virar castelo de
          número bonito com alicerce de miojo.
        </CardContent>
      </Card>
    </div>
  );
}
