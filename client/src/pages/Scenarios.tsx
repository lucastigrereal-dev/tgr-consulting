import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatCurrency,
  formatKpi,
  isDecimal,
  normalizeDecimalInput,
} from "@/lib/financialPresentation";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  GitBranch,
  Loader2,
  LockKeyhole,
  Target,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const goalVariables = {
  qualifiedCouplesMonth1: "Casais qualificados — mês 1",
  conversionRate: "Conversão",
} as const;
const goalKpis = {
  npv: "VPL",
  totalOperatingCashFlow: "Caixa operacional",
  healthyD90: "Healthy D90",
} as const;

export type ScenarioVersionCandidate = {
  id: string;
  state: "draft" | "in_review" | "approved" | "baseline";
  kind: string;
  isImmutable: boolean;
};

export function selectScenarioBaseVersion(
  versions: readonly ScenarioVersionCandidate[]
) {
  const preference: ScenarioVersionCandidate["state"][] = [
    "baseline",
    "approved",
    "in_review",
    "draft",
  ];
  for (const state of preference) {
    const version = versions.find(
      candidate =>
        candidate.state === state &&
        (state !== "draft" || !candidate.isImmutable)
    );
    if (version) return version;
  }
  return null;
}

export function selectGoalSeekDraftBranch(
  versions: readonly ScenarioVersionCandidate[]
) {
  return (
    versions.find(
      version =>
        version.kind === "scenario" &&
        version.state === "draft" &&
        !version.isImmutable
    ) ?? null
  );
}

export function coerceAsOfMonthInput(value: string | number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1200, Math.max(0, Math.trunc(numeric)));
}

export type GoalSeekSelection = {
  variableKey: keyof typeof goalVariables;
  target: string;
  lowerBound: string;
  upperBound: string;
};

export type GoalSeekResultSelection = {
  variableKey: string;
  target: string;
  lowerBound: string;
  upperBound: string;
};

function decimalTextEquals(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  return (
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    leftNumber === rightNumber
  );
}

export function goalSeekResultMatchesSelection(
  result: GoalSeekResultSelection | null | undefined,
  selection: GoalSeekSelection
) {
  return (
    Boolean(result) &&
    result?.variableKey === selection.variableKey &&
    decimalTextEquals(result.target, selection.target) &&
    decimalTextEquals(result.lowerBound, selection.lowerBound) &&
    decimalTextEquals(result.upperBound, selection.upperBound)
  );
}

export default function Scenarios() {
  const projectsQuery = trpc.igr.projects.useQuery(undefined, { retry: false });
  const [projectId, setProjectId] = useState("");
  const [branchName, setBranchName] = useState("Cenário alternativo");
  const [reason, setReason] = useState(
    "Testar impacto de premissas comerciais."
  );
  const [goal, setGoal] = useState({
    targetKpi: "npv" as keyof typeof goalKpis,
    variableKey: "qualifiedCouplesMonth1" as keyof typeof goalVariables,
    target: "0",
    lowerBound: "0",
    upperBound: "100",
  });
  const [capital, setCapital] = useState("");
  const [asOfMonth, setAsOfMonth] = useState(0);
  const [goalRunVersionId, setGoalRunVersionId] = useState("");
  const contextQuery = trpc.igr.projectContext.useQuery(
    { projectId },
    { enabled: Boolean(projectId), retry: false }
  );
  const comparisonQuery = trpc.igr.scenarioComparison.useQuery(
    { projectId },
    { enabled: Boolean(projectId), retry: false }
  );
  const versions = (contextQuery.data?.versions ??
    []) as ScenarioVersionCandidate[];
  const scenarioBaseVersion = selectScenarioBaseVersion(versions);
  const draftBranch = selectGoalSeekDraftBranch(versions);
  const scenarioBaseVersionId = scenarioBaseVersion?.id ?? "";
  const activeVersionId = draftBranch?.id ?? scenarioBaseVersionId;
  const createBranch = trpc.igr.createScenario.useMutation({
    onSuccess: async result => {
      await contextQuery.refetch();
      await comparisonQuery.refetch();
      toast.success("Branch criado.", {
        description: `Versão ${result.versionId} ligada à versão pai.`,
      });
    },
    onError: error =>
      toast.error("Não foi possível abrir o cenário.", {
        description: error.message,
      }),
  });
  const goalSeek = trpc.igr.goalSeek.useMutation({
    onError: error =>
      toast.error("Goal Seek recusado.", { description: error.message }),
  });
  const resetGoalSeekResult = () => {
    goalSeek.reset();
    setGoalRunVersionId("");
  };
  const applyGoalSeek = trpc.igr.applyGoalSeek.useMutation();
  const capitalEnvelope = trpc.igr.capitalEnvelope.useQuery(
    {
      versionId: activeVersionId || "placeholder",
      horizonMonths: 120,
      asOfMonth,
      availableCapital: capital || "0",
    },
    { enabled: false, retry: false }
  );
  useEffect(() => {
    if (!projectId && projectsQuery.data?.[0])
      setProjectId(projectsQuery.data[0].id);
  }, [projectId, projectsQuery.data]);
  const result = goalSeek.data;
  const goalResultMatchesSelection = goalSeekResultMatchesSelection(
    result,
    goal
  );
  const capitalResult = capitalEnvelope.data;
  const goalReady =
    isDecimal(goal.target) &&
    isDecimal(goal.lowerBound) &&
    isDecimal(goal.upperBound);
  const applyConvergedResult = async () => {
    if (
      !result ||
      result.status !== "converged" ||
      !result.result ||
      !result.objectiveValue ||
      result.residual === null ||
      !goalResultMatchesSelection ||
      !activeVersionId
    )
      return;
    try {
      let targetVersionId = draftBranch?.id;
      if (!targetVersionId) {
        if (!scenarioBaseVersionId)
          throw new Error("Não há versão-base elegível para criar a branch.");
        const branch = await createBranch.mutateAsync({
          baseVersionId: scenarioBaseVersionId,
          name: branchName.trim(),
          reason: reason.trim(),
        });
        targetVersionId = branch.versionId;
      }
      const applied = await applyGoalSeek.mutateAsync({
        targetVersionId,
        sourceVersionId: goalRunVersionId || activeVersionId,
        variableKey: goal.variableKey,
        value: result.result,
        targetKpi: goal.targetKpi,
        target: result.target,
        objectiveValue: result.objectiveValue,
        residual: result.residual,
        iterations: result.iterations,
      });
      await Promise.all([contextQuery.refetch(), comparisonQuery.refetch()]);
      toast.success(
        applied.idempotent
          ? "Goal Seek já estava aplicado."
          : "Goal Seek aplicado na branch.",
        {
          description: `Versão ${applied.versionId.slice(0, 12)} pronta para recalcular.`,
        }
      );
    } catch (error) {
      toast.error("Não foi possível aplicar o Goal Seek.", {
        description:
          error instanceof Error ? error.message : "Erro não identificado.",
      });
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="rounded-2xl border border-white/10 bg-card/80 px-6 py-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200/80">
          Cenários e reverse planning
        </p>
        <h1 className="mt-2 font-serif text-3xl">
          Mudar variável não é apagar história.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Todo cenário nasce de versão pai, registra motivo e deixa baseline
          quieto no canto dele — como deve ser.
        </p>
        <Label htmlFor="scenario-project" className="mt-5 block">
          Projeto comparado
        </Label>
        <select
          id="scenario-project"
          className="mt-1.5 h-10 min-w-64 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-slate-200"
          value={projectId}
          onChange={event => {
            resetGoalSeekResult();
            setProjectId(event.target.value);
          }}
          disabled={projectsQuery.isLoading}
        >
          <option value="">
            {projectsQuery.isLoading ? "Carregando…" : "Selecionar projeto"}
          </option>
          {projectsQuery.data?.map(project => (
            <option value={project.id} key={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </header>
      {projectsQuery.isError ||
      contextQuery.isError ||
      comparisonQuery.isError ? (
        <Card className="border-red-400/20 bg-red-400/[0.04]">
          <CardContent className="flex gap-3 p-5 text-sm">
            <AlertTriangle className="h-5 w-5 text-red-300" />
            Não foi possível carregar todas as versões deste projeto.
          </CardContent>
        </Card>
      ) : null}
      {!activeVersionId ? (
        <Card className="border-white/10 bg-card/80">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {projectsQuery.isLoading
                ? "Carregando projetos…"
                : projectsQuery.data?.length
                  ? "Selecione um projeto com versão elegível para abrir cenários."
                  : "Crie um projeto e calcule uma versão para abrir cenários."}
            </p>
            <Button
              asChild
              className="bg-amber-400 text-slate-950 hover:bg-amber-300"
            >
              <Link href="/builder">
                Ir para Builder <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
            <Card className="border-white/10 bg-card/80 shadow-none">
              <CardHeader>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">
                  Branch
                </p>
                <CardTitle className="mt-2 text-xl">
                  Criar cenário comparável
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="branch-name">Nome</Label>
                  <Input
                    id="branch-name"
                    className="mt-2 bg-white/[0.03]"
                    value={branchName}
                    onChange={event => setBranchName(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="branch-reason">Motivo da alteração</Label>
                  <Input
                    id="branch-reason"
                    className="mt-2 bg-white/[0.03]"
                    value={reason}
                    onChange={event => setReason(event.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.025] p-3 text-xs text-muted-foreground">
                  <span>Versão pai</span>
                  <span className="font-mono text-slate-200">
                    {scenarioBaseVersionId.slice(0, 12)}
                  </span>
                </div>
                <Button
                  className="w-full bg-amber-400 text-slate-950 hover:bg-amber-300"
                  disabled={
                    createBranch.isPending ||
                    !scenarioBaseVersionId ||
                    branchName.trim().length < 3 ||
                    reason.trim().length < 3
                  }
                  onClick={() =>
                    createBranch.mutate({
                      baseVersionId: scenarioBaseVersionId,
                      name: branchName.trim(),
                      reason: reason.trim(),
                    })
                  }
                >
                  {createBranch.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <GitBranch className="mr-2 h-4 w-4" />
                  )}
                  Criar branch auditável
                </Button>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-card/80 shadow-none">
              <CardHeader>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">
                  Capital Envelope
                </p>
                <CardTitle className="mt-2 text-xl">
                  Capital disponível → operação possível
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="scenario-as-of">Mês de referência</Label>
                  <Input
                    id="scenario-as-of"
                    className="mt-2 bg-white/[0.03]"
                    type="number"
                    min={0}
                    max={1200}
                    step={1}
                    value={asOfMonth}
                    onChange={event => {
                      resetGoalSeekResult();
                      setAsOfMonth(coerceAsOfMonthInput(event.target.value));
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="capital">Capital disponível (R$)</Label>
                  <Input
                    id="capital"
                    inputMode="decimal"
                    className="mt-2 bg-white/[0.03] font-mono"
                    value={capital}
                    onChange={event =>
                      setCapital(normalizeDecimalInput(event.target.value))
                    }
                    placeholder="Ex.: 1500000,00"
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full border-white/15 bg-white/[0.03]"
                  disabled={capitalEnvelope.isFetching || !isDecimal(capital)}
                  onClick={() => capitalEnvelope.refetch()}
                >
                  {capitalEnvelope.isFetching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="mr-2 h-4 w-4" />
                  )}
                  Calcular envelope
                </Button>
                {capitalResult ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Necessário
                      </p>
                      <p className="mt-2 font-mono text-sm">
                        {formatCurrency(capitalResult.requiredCapital)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Folga
                      </p>
                      <p className="mt-2 font-mono text-sm">
                        {formatCurrency(capitalResult.headroom)}
                      </p>
                    </div>
                    <div className="col-span-2 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-xs text-muted-foreground">
                      Pior caixa acumulado no mês{" "}
                      {capitalResult.limitingMonth ?? "—"}:{" "}
                      <span className="font-mono text-slate-100">
                        {formatCurrency(
                          capitalResult.minimumCumulativeCashFlow
                        )}
                      </span>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>
          <Card className="border-white/10 bg-card/80 shadow-none">
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">
                Goal Seek determinístico
              </p>
              <CardTitle className="mt-2 text-xl">
                Meta real → variável necessária
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                A busca usa a versão atual e recalcula o KPI escolhido. Não
                altera nada até você decidir aplicar o resultado em um cenário.
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <Label htmlFor="goal-kpi">KPI-meta</Label>
                  <select
                    id="goal-kpi"
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm"
                    value={goal.targetKpi}
                    onChange={event => {
                      resetGoalSeekResult();
                      setGoal(current => ({
                        ...current,
                        targetKpi: event.target.value as keyof typeof goalKpis,
                      }));
                    }}
                  >
                    {Object.entries(goalKpis).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="goal-variable">Variável ajustada</Label>
                  <select
                    id="goal-variable"
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm"
                    value={goal.variableKey}
                    onChange={event => {
                      resetGoalSeekResult();
                      const variableKey = event.target
                        .value as keyof typeof goalVariables;
                      setGoal(current => ({
                        ...current,
                        variableKey,
                        lowerBound: "0",
                        upperBound:
                          variableKey === "conversionRate" ? "1" : "100",
                      }));
                    }}
                  >
                    {Object.entries(goalVariables).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {(
                  [
                    ["target", "Meta"],
                    ["lowerBound", "Limite mínimo"],
                    ["upperBound", "Limite máximo"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <Label htmlFor={`goal-${key}`}>{label}</Label>
                    <Input
                      id={`goal-${key}`}
                      className="mt-2 bg-white/[0.03] font-mono"
                      value={goal[key]}
                      inputMode="decimal"
                      onChange={event => {
                        resetGoalSeekResult();
                        setGoal(current => ({
                          ...current,
                          [key]: normalizeDecimalInput(event.target.value),
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button
                  className="bg-amber-400 text-slate-950 hover:bg-amber-300"
                  disabled={goalSeek.isPending || !goalReady}
                  onClick={() => {
                    setGoalRunVersionId(activeVersionId);
                    goalSeek.mutate({
                      versionId: activeVersionId,
                      horizonMonths: 120,
                      asOfMonth,
                      ...goal,
                    });
                  }}
                >
                  {goalSeek.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Target className="mr-2 h-4 w-4" />
                  )}
                  Executar Goal Seek
                </Button>
                {result ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      className={
                        result.status === "converged"
                          ? "bg-emerald-300/10 text-emerald-200 hover:bg-emerald-300/10"
                          : "bg-amber-200/10 text-amber-200 hover:bg-amber-200/10"
                      }
                    >
                      {result.status === "converged"
                        ? "CONVERGIU"
                        : "LIMITE ATINGIDO"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-white/15 text-slate-200"
                    >
                      Resultado {result.result ?? "N/D"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-white/15 text-slate-200"
                    >
                      Resíduo {result.residual ?? "N/D"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-white/15 text-slate-200"
                    >
                      {result.iterations} iterações
                    </Badge>
                    {result.status === "converged" &&
                    result.result !== null &&
                    goalResultMatchesSelection ? (
                      <Button
                        variant="outline"
                        className="border-emerald-300/30 bg-emerald-300/5 text-emerald-100 hover:bg-emerald-300/10"
                        disabled={
                          applyGoalSeek.isPending ||
                          createBranch.isPending ||
                          (!draftBranch &&
                            (!scenarioBaseVersionId ||
                              branchName.trim().length < 3 ||
                              reason.trim().length < 3))
                        }
                        onClick={() => void applyConvergedResult()}
                      >
                        {applyGoalSeek.isPending || createBranch.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <GitBranch className="mr-2 h-4 w-4" />
                        )}
                        Aplicar em branch
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-card/80 shadow-none">
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">
                Comparação
              </p>
              <CardTitle className="mt-2 text-xl">
                Cenários no mesmo modelo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {comparisonQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Carregando versões comparáveis…
                </p>
              ) : comparisonQuery.data?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="pb-3 font-medium">Versão</th>
                        <th className="pb-3 font-medium">Estado</th>
                        <th className="pb-3 font-medium">VPL</th>
                        <th className="pb-3 font-medium">TIR</th>
                        <th className="pb-3 font-medium">Payback</th>
                        <th className="pb-3 font-medium">Evidência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonQuery.data.map(item => (
                        <tr
                          key={item.versionId}
                          className="border-b border-white/5"
                        >
                          <td className="py-4">
                            <p className="font-medium">{item.label}</p>
                            {item.reason ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.reason}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-4">
                            <Badge
                              variant="outline"
                              className="border-white/15 text-slate-200"
                            >
                              {item.state}
                            </Badge>
                          </td>
                          <td className="py-4 font-mono text-xs">
                            {formatKpi("npv", item.kpis?.npv)}
                          </td>
                          <td className="py-4 font-mono text-xs">
                            {formatKpi("irrAnnual", item.kpis?.irrAnnual)}
                          </td>
                          <td className="py-4 font-mono text-xs">
                            {formatKpi(
                              "paybackMonths",
                              item.kpis?.paybackMonths
                            )}
                          </td>
                          <td className="py-4 font-mono text-[11px] text-amber-200/90">
                            {item.snapshotHash?.slice(0, 10).toUpperCase() ??
                              "sem snapshot"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Calcule a versão de trabalho e seus branches para comparar
                  VPL, TIR, Payback e hash de evidência aqui.
                </p>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [
                GitBranch,
                "Branches comparáveis",
                "Cada hipótese preserva versão pai e motivo.",
              ],
              [
                LockKeyhole,
                "Baseline imutável",
                "Após congelar, mudança só via branch.",
              ],
              [
                Target,
                "Goal Seek explicável",
                "KPI, variável, bounds e resíduo aparecem juntos.",
              ],
            ].map(([Icon, title, detail]) => (
              <Card
                key={title as string}
                className="border-white/10 bg-card/80 shadow-none"
              >
                <CardContent className="p-5">
                  <Icon className="h-5 w-5 text-amber-300" />
                  <p className="mt-8 font-medium">{title as string}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {detail as string}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
