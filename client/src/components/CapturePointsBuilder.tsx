import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { normalizeDecimalInput } from "@/lib/financialPresentation";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CircleHelp, MapPinned, Plus, Save, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

type Status = "provided" | "pending";
type SourceType =
  | "current_decision"
  | "current_document"
  | "historical_primary"
  | "derived_analysis"
  | "external_benchmark"
  | "assumption";
type CashflowTreatment = "incremental" | "included_in_project_totals";

export type CapturePointDefinitionDraft = {
  pointId: string;
  name: string;
  channel: string;
  activationCost: string;
  monthlyFixedCost: string;
  costPerSale: string;
  approaches: string;
  researchRate: string;
  qualificationRate: string;
  invitationRate: string;
  appointmentRate: string;
  showRate: string;
  tourRate: string;
  saleRate: string;
  cannibalizationRate: string;
  cashflowTreatment: CashflowTreatment;
};

export type CapturePointDraft = {
  status: Status;
  sourceType: SourceType;
  sourceRef: string;
  definition: CapturePointDefinitionDraft;
};

type SavedCapturePoint = {
  record: {
    status: Status;
    sourceType: SourceType;
    sourceRef?: string | null;
  };
  definition: CapturePointDefinitionDraft;
};

const sourceTypeLabels: Record<SourceType, string> = {
  current_decision: "Decisão atual",
  current_document: "Documento atual",
  historical_primary: "Histórico primário",
  derived_analysis: "Análise derivada",
  external_benchmark: "Benchmark externo",
  assumption: "Premissa",
};

const nonNegativeFields: Array<{
  key: keyof CapturePointDefinitionDraft;
  label: string;
  hint: string;
}> = [
  { key: "activationCost", label: "Custo de ativação", hint: "R$" },
  { key: "monthlyFixedCost", label: "Custo fixo mensal", hint: "R$/mês" },
  { key: "costPerSale", label: "Custo por venda", hint: "R$/venda" },
  { key: "approaches", label: "Abordagens", hint: "por mês" },
];

const rateFields: Array<{
  key: keyof CapturePointDefinitionDraft;
  label: string;
}> = [
  { key: "researchRate", label: "Pesquisa" },
  { key: "qualificationRate", label: "Qualificação" },
  { key: "invitationRate", label: "Convite" },
  { key: "appointmentRate", label: "Agendamento" },
  { key: "showRate", label: "Show" },
  { key: "tourRate", label: "Tour" },
  { key: "saleRate", label: "Conversão em venda" },
  { key: "cannibalizationRate", label: "Canibalização" },
];

export function emptyCapturePointDraft(): CapturePointDraft {
  return {
    status: "pending",
    sourceType: "current_decision",
    sourceRef: "",
    definition: {
      pointId: "",
      name: "",
      channel: "",
      activationCost: "0",
      monthlyFixedCost: "0",
      costPerSale: "0",
      approaches: "0",
      researchRate: "0",
      qualificationRate: "0",
      invitationRate: "0",
      appointmentRate: "0",
      showRate: "0",
      tourRate: "0",
      saleRate: "0",
      cannibalizationRate: "0",
      cashflowTreatment: "incremental",
    },
  };
}

function readDraft(saved: SavedCapturePoint): CapturePointDraft {
  return {
    status: saved.record.status,
    sourceType: saved.record.sourceType,
    sourceRef: saved.record.sourceRef ?? "",
    definition: { ...saved.definition },
  };
}

function validateNonNegativeDecimal(value: string, label: string) {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < 0)
    throw new Error(`${label} deve ser um decimal não negativo.`);
}

function validateRate(value: string, label: string) {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < 0 || parsed > 1)
    throw new Error(`${label} deve estar entre 0 e 1.`);
}

export function toCapturePointsMutationInput(
  versionId: string,
  drafts: CapturePointDraft[]
): {
  versionId: string;
  points: Array<{
    status: Status;
    sourceType: SourceType;
    sourceRef?: string;
    definition: CapturePointDefinitionDraft;
  }>;
} {
  if (!versionId) throw new Error("Selecione uma versão de trabalho.");
  if (!drafts.length) throw new Error("Adicione ao menos um ponto de captação.");

  const ids = new Set<string>();
  const points = drafts.map((draft, index) => {
    const number = index + 1;
    const pointId = draft.definition.pointId.trim();
    const name = draft.definition.name.trim();
    const channel = draft.definition.channel.trim();
    const sourceRef = draft.sourceRef.trim();
    if (!pointId) throw new Error(`Ponto ${number}: informe o ID.`);
    if (ids.has(pointId)) throw new Error("IDs de ponto não podem se repetir.");
    ids.add(pointId);
    if (!name) throw new Error(`${pointId}: informe o nome do ponto.`);
    if (!channel) throw new Error(`${pointId}: informe o canal.`);
    if (draft.status === "provided" && !sourceRef)
      throw new Error(`${pointId}: Ponto informado exige fonte ou responsável.`);

    for (const field of nonNegativeFields) {
      validateNonNegativeDecimal(
        draft.definition[field.key],
        `${pointId}: ${field.label}`
      );
    }
    for (const field of rateFields) {
      validateRate(draft.definition[field.key], field.label);
    }

    return {
      status: draft.status,
      sourceType: draft.sourceType,
      ...(sourceRef ? { sourceRef } : {}),
      definition: {
        ...draft.definition,
        pointId,
        name,
        channel,
      },
    };
  });

  return { versionId, points };
}

function DecimalField({
  id,
  label,
  value,
  hint,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  hint?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          inputMode="decimal"
          className="h-9 bg-background pr-16 font-mono"
          disabled={disabled}
          onChange={event => onChange(normalizeDecimalInput(event.target.value))}
        />
        {hint ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CapturePointsBuilder({ versionId }: { versionId: string }) {
  const pointsQuery = trpc.igr.capturePoints.useQuery(
    { versionId: versionId || "placeholder" },
    { enabled: Boolean(versionId), retry: false }
  );
  const saved = (pointsQuery.data ?? undefined) as SavedCapturePoint[] | undefined;
  const [drafts, setDrafts] = useState<CapturePointDraft[]>(() =>
    saved?.map(readDraft) ?? []
  );

  useEffect(() => setDrafts([]), [versionId]);
  useEffect(() => {
    if (saved) setDrafts(saved.map(readDraft));
  }, [saved]);

  const mutation = trpc.igr.replaceCapturePoints.useMutation({
    onSuccess: async () => {
      await pointsQuery.refetch();
      toast.success("Pontos de captação salvos.", {
        description: "O lote completo e sua proveniência foram substituídos atomicamente.",
      });
    },
    onError: error =>
      toast.error("Não foi possível salvar os pontos de captação.", {
        description: error.message,
      }),
  });

  const disabled = !versionId || mutation.isPending;
  const providedCount = drafts.filter(draft => draft.status === "provided").length;
  const pendingCount = drafts.length - providedCount;
  const summary = drafts.length
    ? `${drafts.length} ${drafts.length === 1 ? "ponto" : "pontos"} · ${providedCount} informado · ${pendingCount} pendente`
    : "NENHUM PONTO · PENDENTE";

  const patchRecord = (index: number, values: Partial<Omit<CapturePointDraft, "definition">>) =>
    setDrafts(current =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...values } : draft
      )
    );
  const patchDefinition = (
    index: number,
    values: Partial<CapturePointDefinitionDraft>
  ) =>
    setDrafts(current =>
      current.map((draft, draftIndex) =>
        draftIndex === index
          ? { ...draft, definition: { ...draft.definition, ...values } }
          : draft
      )
    );

  const save = async () => {
    let input: ReturnType<typeof toCapturePointsMutationInput>;
    try {
      input = toCapturePointsMutationInput(versionId, drafts);
    } catch (error) {
      toast.error("Revise os pontos de captação.", {
        description: error instanceof Error ? error.message : "Dados inválidos.",
      });
      return;
    }
    try {
      await mutation.mutateAsync(input);
    } catch {
      // The mutation callback already reports server failures.
    }
  };

  return (
    <section aria-labelledby="capture-points-title" className="space-y-4">
      <Card className="border-white/10 bg-card/80">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="capture-points-title" className="flex items-center gap-2 text-xl">
                <MapPinned className="h-5 w-5 text-sky-300" />
                Pontos de captação
              </CardTitle>
              <CardDescription className="mt-2 max-w-3xl leading-6">
                Registre cada origem física ou comercial do funil com custo,
                conversões, canibalização e proveniência própria.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                drafts.length > 0 && pendingCount === 0
                  ? "border-emerald-300/25 text-emerald-200"
                  : "border-amber-200/25 text-amber-200"
              }
            >
              {summary}
            </Badge>
          </div>
          {!versionId ? (
            <div className="flex gap-2 rounded-lg border border-amber-200/20 bg-amber-200/[0.04] p-3 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Selecione ou crie um projeto com versão de trabalho para editar.
            </div>
          ) : null}
          <div className="grid gap-2 rounded-lg border border-sky-300/15 bg-sky-300/[0.04] p-3 text-xs leading-5 text-muted-foreground md:grid-cols-2">
            <p className="flex gap-2">
              <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
              Incremental adiciona CAPEX e OPEX do ponto ao caixa do projeto.
            </p>
            <p>
              Já incluído nos totais evita dupla contagem: o ponto continua na
              análise operacional, mas seus custos não são somados novamente.
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {pointsQuery.isLoading ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Carregando pontos de captação…
            </p>
          ) : null}
          {pointsQuery.isError ? (
            <p role="alert" className="text-sm text-red-300">
              Não foi possível carregar os pontos desta versão.
            </p>
          ) : null}

          {!drafts.length && !pointsQuery.isLoading ? (
            <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
              <p className="font-medium">Nenhum ponto cadastrado.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A carteira permanece pendente até que ao menos um ponto seja registrado.
              </p>
            </div>
          ) : null}

          {drafts.map((draft, index) => (
            <fieldset key={index} className="space-y-5 rounded-xl border border-white/10 p-4">
              <legend className="px-2 text-sm font-semibold">
                Ponto {index + 1}{draft.definition.name ? ` · ${draft.definition.name}` : ""}
              </legend>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`capture-point-id-${index}`}>ID estável</Label>
                  <Input
                    id={`capture-point-id-${index}`}
                    value={draft.definition.pointId}
                    disabled={disabled}
                    placeholder="Ex.: aeroporto"
                    onChange={event => patchDefinition(index, { pointId: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`capture-point-name-${index}`}>Nome</Label>
                  <Input
                    id={`capture-point-name-${index}`}
                    value={draft.definition.name}
                    disabled={disabled}
                    placeholder="Ex.: Aeroporto"
                    onChange={event => patchDefinition(index, { name: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`capture-point-channel-${index}`}>Canal</Label>
                  <Input
                    id={`capture-point-channel-${index}`}
                    value={draft.definition.channel}
                    disabled={disabled}
                    placeholder="Ex.: OPC, parceria, indicação"
                    onChange={event => patchDefinition(index, { channel: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`capture-point-status-${index}`}>Estado</Label>
                  <select
                    id={`capture-point-status-${index}`}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={draft.status}
                    disabled={disabled}
                    onChange={event => patchRecord(index, { status: event.target.value as Status })}
                  >
                    <option value="pending">Pendente</option>
                    <option value="provided">Informado</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`capture-point-source-type-${index}`}>Tipo de fonte</Label>
                  <select
                    id={`capture-point-source-type-${index}`}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={draft.sourceType}
                    disabled={disabled}
                    onChange={event => patchRecord(index, { sourceType: event.target.value as SourceType })}
                  >
                    {(Object.keys(sourceTypeLabels) as SourceType[]).map(value => (
                      <option key={value} value={value}>{sourceTypeLabels[value]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`capture-point-source-${index}`}>
                    Fonte ou responsável {draft.status === "provided" ? "*" : ""}
                  </Label>
                  <Input
                    id={`capture-point-source-${index}`}
                    value={draft.sourceRef}
                    disabled={disabled}
                    placeholder="Documento, ata ou responsável"
                    onChange={event => patchRecord(index, { sourceRef: event.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {nonNegativeFields.map(field => (
                  <DecimalField
                    key={field.key}
                    id={`capture-${field.key}-${index}`}
                    label={field.label}
                    hint={field.hint}
                    value={draft.definition[field.key]}
                    disabled={disabled}
                    onChange={value => patchDefinition(index, { [field.key]: value })}
                  />
                ))}
              </div>

              <fieldset className="space-y-3 rounded-lg border border-white/10 p-3">
                <legend className="px-2 text-xs font-semibold">Funil sequencial e qualidade</legend>
                <p className="text-xs text-muted-foreground">
                  Informe 0,25 para 25%. Cada conversão incide sobre a etapa anterior.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {rateFields.map(field => (
                    <DecimalField
                      key={field.key}
                      id={`capture-${field.key}-${index}`}
                      label={field.label}
                      value={draft.definition[field.key]}
                      disabled={disabled}
                      onChange={value => patchDefinition(index, { [field.key]: value })}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div className="w-full max-w-md space-y-1.5">
                  <Label htmlFor={`capture-cashflow-${index}`}>Tratamento no caixa</Label>
                  <select
                    id={`capture-cashflow-${index}`}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={draft.definition.cashflowTreatment}
                    disabled={disabled}
                    onChange={event => patchDefinition(index, {
                      cashflowTreatment: event.target.value as CashflowTreatment,
                    })}
                  >
                    <option value="incremental">Incremental — somar custos ao projeto</option>
                    <option value="included_in_project_totals">Já incluído nos totais do projeto</option>
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => setDrafts(current => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 className="h-4 w-4" /> Remover ponto
                </Button>
              </div>
            </fieldset>
          ))}

          <div className="flex flex-col justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setDrafts(current => [...current, emptyCapturePointDraft()])}
            >
              <Plus className="h-4 w-4" /> Adicionar ponto
            </Button>
            <Button
              type="button"
              disabled={disabled || drafts.length === 0}
              onClick={() => void save()}
            >
              {mutation.isPending ? <Spinner /> : <Save className="h-4 w-4" />}
              Salvar pontos
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default CapturePointsBuilder;
