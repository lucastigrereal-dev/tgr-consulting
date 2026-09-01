import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatCurrency,
  isDecimal,
  normalizeDecimalInput,
} from "@/lib/financialPresentation";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Calculator,
  Loader2,
  Plus,
  ReceiptText,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const categories = [
  "payroll",
  "occupancy",
  "technology",
  "marketing",
  "partner",
  "legal",
  "operations",
  "other",
] as const;
const categoryLabels: Record<(typeof categories)[number], string> = {
  payroll: "Folha e encargos",
  occupancy: "Ocupação",
  technology: "Tecnologia",
  marketing: "Marketing",
  partner: "Parceiros",
  legal: "Jurídico",
  operations: "Operações",
  other: "Outros",
};
const frequencyLabels = {
  monthly: "Mensal",
  annual: "Anual",
  one_time: "Pontual",
} as const;

export default function CostCatalog() {
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
  const versionId = contextQuery.data?.workingVersion?.id ?? "";
  const catalogQuery = trpc.igr.costCatalog.useQuery(
    { versionId },
    { enabled: Boolean(versionId), retry: false }
  );
  const [draft, setDraft] = useState({
    name: "",
    amountText: "",
    sourceRef: "",
    category: "operations" as (typeof categories)[number],
    frequency: "monthly" as "monthly" | "annual" | "one_time",
    cashflowTreatment: "included_in_project_totals" as
      | "incremental"
      | "included_in_project_totals",
    status: "pending" as "provided" | "pending",
  });
  const createItem = trpc.igr.createCostCatalogItem.useMutation({
    onSuccess: async () => {
      await catalogQuery.refetch();
      setDraft(current => ({
        ...current,
        name: "",
        amountText: "",
        sourceRef: "",
        status: "pending",
      }));
      toast.success("Linha de custo registrada com proveniência.");
    },
    onError: error =>
      toast.error("Custo não registrado.", { description: error.message }),
  });
  const save = () => {
    if (!versionId)
      return toast.error("Crie ou selecione um projeto em versão de trabalho.");
    if (draft.name.trim().length < 2)
      return toast.error("Nomeie a linha de custo.");
    if (draft.status === "provided" && !isDecimal(draft.amountText))
      return toast.error(
        "Informe um valor decimal válido. Vírgula ou ponto funcionam."
      );
    if (draft.status === "provided" && draft.sourceRef.trim().length < 2)
      return toast.error("Custo informado precisa de fonte ou responsável.");
    createItem.mutate({
      versionId,
      name: draft.name.trim(),
      category: draft.category,
      frequency: draft.frequency,
      cashflowTreatment: draft.cashflowTreatment,
      status: draft.status,
      amountText: draft.status === "provided" ? draft.amountText : undefined,
      sourceType: "current_decision",
      sourceRef: draft.sourceRef.trim() || undefined,
    });
  };
  const summary = catalogQuery.data?.summary;
  const disabled = !versionId || createItem.isPending;
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="rounded-2xl border border-white/10 bg-card/80 px-6 py-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200/80">
          Catálogo de custos
        </p>
        <h1 className="mt-2 font-serif text-3xl">
          Custo sem taxonomia é surpresa de caixa.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Cada linha carrega categoria, recorrência, fonte, status e tratamento
          no caixa. Marque como incremental apenas o que ainda não está nos
          totais do projeto.
        </p>
        <Label className="mt-5 block" htmlFor="cost-project">
          Projeto ativo
        </Label>
        <select
          id="cost-project"
          className="mt-1.5 h-10 min-w-56 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-slate-200"
          value={projectId}
          onChange={event => setProjectId(event.target.value)}
          disabled={projectsQuery.isLoading}
        >
          <option value="">
            {projectsQuery.isLoading
              ? "Carregando projetos…"
              : "Selecionar projeto"}
          </option>
          {projectsQuery.data?.map(project => (
            <option value={project.id} key={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </header>
      {projectsQuery.isError || contextQuery.isError || catalogQuery.isError ? (
        <Card className="border-red-400/20 bg-red-400/[0.04]">
          <CardContent className="flex items-center gap-3 p-5 text-sm">
            <AlertTriangle className="h-5 w-5 text-red-300" />
            Não foi possível carregar todo o catálogo. Atualize a página ou
            tente novamente.
          </CardContent>
        </Card>
      ) : null}
      {summary?.status === "valid" ? (
        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Run-rate mensal", summary.monthlyRunRate],
            ["Run-rate anual", summary.annualRunRate],
            ["Pontual", summary.oneTimeCosts],
          ].map(([label, value]) => (
            <Card className="border-white/10 bg-card/80" key={String(label)}>
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-3 font-mono text-2xl text-amber-200">
                  {formatCurrency(String(value))}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="border-amber-200/15 bg-amber-100/[0.025]">
          <CardContent className="flex gap-3 p-5">
            <Calculator className="h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-sm text-muted-foreground">
              {summary
                ? `${summary.pendingCount} linha(s) pendente(s) bloqueiam o resumo autoritativo.`
                : projectsQuery.isLoading
                  ? "Carregando contexto do projeto…"
                  : "Crie um projeto e uma versão de trabalho para compor o catálogo."}
            </p>
          </CardContent>
        </Card>
      )}
      <Card className="border-white/10 bg-card/80">
        <CardHeader>
          <CardTitle className="text-xl">Nova linha de custo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="cost-name">Nome</Label>
            <Input
              id="cost-name"
              className="mt-1.5 bg-white/[0.03]"
              value={draft.name}
              onChange={event =>
                setDraft(current => ({ ...current, name: event.target.value }))
              }
              placeholder="Ex.: Encargos da equipe comercial"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="cost-amount">Valor mensal/anual</Label>
            <Input
              id="cost-amount"
              className="mt-1.5 bg-white/[0.03] font-mono"
              inputMode="decimal"
              value={draft.amountText}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  amountText: normalizeDecimalInput(event.target.value),
                }))
              }
              placeholder="Ex.: 12000,50"
              disabled={disabled || draft.status === "pending"}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Aceita vírgula ou ponto; será salvo em decimal.
            </p>
          </div>
          <div>
            <Label htmlFor="cost-category">Categoria</Label>
            <select
              id="cost-category"
              className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm"
              value={draft.category}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  category: event.target.value as (typeof categories)[number],
                }))
              }
              disabled={disabled}
            >
              {categories.map(category => (
                <option value={category} key={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cost-frequency">Recorrência</Label>
            <select
              id="cost-frequency"
              className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm"
              value={draft.frequency}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  frequency: event.target.value as
                    | "monthly"
                    | "annual"
                    | "one_time",
                }))
              }
              disabled={disabled}
            >
              <option value="monthly">Mensal</option>
              <option value="annual">Anual</option>
              <option value="one_time">Pontual</option>
            </select>
          </div>
          <div>
            <Label htmlFor="cost-treatment">Tratamento no caixa</Label>
            <select
              id="cost-treatment"
              className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm"
              value={draft.cashflowTreatment}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  cashflowTreatment: event.target.value as
                    | "incremental"
                    | "included_in_project_totals",
                }))
              }
              disabled={disabled}
            >
              <option value="included_in_project_totals">
                Já incluído nos totais do projeto
              </option>
              <option value="incremental">Incremental — somar ao caixa</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Evita dupla contagem do mesmo custo.
            </p>
          </div>
          <div>
            <Label htmlFor="cost-source">Fonte ou responsável</Label>
            <Input
              id="cost-source"
              className="mt-1.5 bg-white/[0.03]"
              value={draft.sourceRef}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  sourceRef: event.target.value,
                }))
              }
              placeholder="Documento, ata ou responsável"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="cost-status">Status</Label>
            <select
              id="cost-status"
              className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm"
              value={draft.status}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  status: event.target.value as "provided" | "pending",
                }))
              }
              disabled={disabled}
            >
              <option value="pending">PENDENTE</option>
              <option value="provided">INFORMADO</option>
            </select>
          </div>
          <Button
            className="md:col-span-2 bg-amber-400 text-slate-950 hover:bg-amber-300"
            disabled={disabled}
            onClick={save}
          >
            {createItem.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Adicionar ao catálogo
          </Button>
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ReceiptText className="h-5 w-5 text-amber-300" />
            Linhas da versão
          </CardTitle>
        </CardHeader>
        <CardContent>
          {catalogQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Carregando linhas do catálogo…
            </p>
          ) : catalogQuery.data?.items.length ? (
            <div className="space-y-2">
              {catalogQuery.data.items.map(item => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3"
                  key={item.id}
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {
                        categoryLabels[
                          item.category as (typeof categories)[number]
                        ]
                      }{" "}
                      ·{" "}
                      {
                        frequencyLabels[
                          item.frequency as keyof typeof frequencyLabels
                        ]
                      }{" "}
                      · {item.cashflowTreatment === "incremental"
                        ? "incremental no caixa"
                        : "incluído nos totais"} · {item.sourceRef ?? "sem fonte"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">
                      {item.amountText ? formatCurrency(item.amountText) : "—"}
                    </span>
                    <Badge
                      className={
                        item.status === "provided"
                          ? "bg-emerald-300/10 text-emerald-200 hover:bg-emerald-300/10"
                          : "bg-amber-200/10 text-amber-200 hover:bg-amber-200/10"
                      }
                    >
                      {item.status === "provided" ? "INFORMADO" : "PENDENTE"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma linha registrada nesta versão.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
