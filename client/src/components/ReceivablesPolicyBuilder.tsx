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
import type { ReceivablesPolicy } from "@shared/financial/receivablesPortfolio";
import { AlertTriangle, CircleHelp, Save, ShieldCheck } from "lucide-react";
import React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Status = "provided" | "pending";
type SourceType =
  | "current_decision"
  | "current_document"
  | "historical_primary"
  | "derived_analysis"
  | "external_benchmark"
  | "assumption";

export type ReceivablesPolicyDraft = {
  status: Status;
  sourceType: SourceType;
  sourceRef: string;
  policyVersion: string;
  cancellationD7: string;
  cancellationD30: string;
  cancellationD60: string;
  cancellationD90: string;
  cancellationD180: string;
  cancellationLifetime: string;
  delinquencyRate: string;
  cureDays1To30: string;
  cureDays31To60: string;
  cureDays61To90: string;
  cureDays90Plus: string;
  writeOffAfterDays: string;
};

type SavedPolicy = {
  record: {
    status: Status;
    sourceType: SourceType;
    sourceRef?: string | null;
  };
  policy: ReceivablesPolicy;
};

const sourceTypeLabels: Record<SourceType, string> = {
  current_decision: "Decisão atual",
  current_document: "Documento atual",
  historical_primary: "Histórico primário",
  derived_analysis: "Análise derivada",
  external_benchmark: "Benchmark externo",
  assumption: "Premissa",
};

const percentFields: Array<{
  key: keyof ReceivablesPolicyDraft;
  label: string;
}> = [
  { key: "cancellationD7", label: "Até D7" },
  { key: "cancellationD30", label: "Até D30" },
  { key: "cancellationD60", label: "Até D60" },
  { key: "cancellationD90", label: "Até D90" },
  { key: "cancellationD180", label: "Até D180" },
  { key: "cancellationLifetime", label: "Vida inteira" },
];

const cureFields: Array<{
  key: keyof ReceivablesPolicyDraft;
  label: string;
}> = [
  { key: "cureDays1To30", label: "1–30 dias" },
  { key: "cureDays31To60", label: "31–60 dias" },
  { key: "cureDays61To90", label: "61–90 dias" },
  { key: "cureDays90Plus", label: "90+ dias" },
];

function emptyDraft(): ReceivablesPolicyDraft {
  return {
    status: "pending",
    sourceType: "current_decision",
    sourceRef: "",
    policyVersion: "",
    cancellationD7: "0",
    cancellationD30: "0",
    cancellationD60: "0",
    cancellationD90: "0",
    cancellationD180: "0",
    cancellationLifetime: "0",
    delinquencyRate: "0",
    cureDays1To30: "0",
    cureDays31To60: "0",
    cureDays61To90: "0",
    cureDays90Plus: "0",
    writeOffAfterDays: "180",
  };
}

function readDraft(saved: SavedPolicy | undefined): ReceivablesPolicyDraft {
  if (!saved?.policy) return emptyDraft();
  const { policy } = saved;
  return {
    status: saved.record.status,
    sourceType: saved.record.sourceType,
    sourceRef: saved.record.sourceRef ?? policy.sourceRef ?? "",
    policyVersion: policy.policyVersion,
    cancellationD7: policy.cancellationCurve.d7,
    cancellationD30: policy.cancellationCurve.d30,
    cancellationD60: policy.cancellationCurve.d60,
    cancellationD90: policy.cancellationCurve.d90,
    cancellationD180: policy.cancellationCurve.d180,
    cancellationLifetime: policy.cancellationCurve.lifetime,
    delinquencyRate: policy.delinquencyRate,
    cureDays1To30: policy.cureRates.days1To30,
    cureDays31To60: policy.cureRates.days31To60,
    cureDays61To90: policy.cureRates.days61To90,
    cureDays90Plus: policy.cureRates.days90Plus,
    writeOffAfterDays: String(policy.writeOffAfterDays),
  };
}

function validateRate(value: string, label: string) {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < 0 || parsed > 1)
    throw new Error(`${label} deve estar entre 0 e 1.`);
}

export function toReceivablesPolicyMutationInput(
  versionId: string,
  draft: ReceivablesPolicyDraft
): {
  versionId: string;
  status: Status;
  sourceType: SourceType;
  sourceRef?: string;
  policy: ReceivablesPolicy;
} {
  if (!versionId) throw new Error("Selecione uma versão de trabalho.");
  const sourceRef = draft.sourceRef.trim();
  if (draft.status === "provided" && !sourceRef)
    throw new Error("Política informada exige fonte ou responsável.");
  if (!draft.policyVersion.trim())
    throw new Error("Informe a versão da política de carteira.");

  const rateEntries: Array<[string, string]> = [
    [draft.cancellationD7, "Cancelamento D7"],
    [draft.cancellationD30, "Cancelamento D30"],
    [draft.cancellationD60, "Cancelamento D60"],
    [draft.cancellationD90, "Cancelamento D90"],
    [draft.cancellationD180, "Cancelamento D180"],
    [draft.cancellationLifetime, "Cancelamento lifetime"],
    [draft.delinquencyRate, "Inadimplência"],
    [draft.cureDays1To30, "Cura 1–30"],
    [draft.cureDays31To60, "Cura 31–60"],
    [draft.cureDays61To90, "Cura 61–90"],
    [draft.cureDays90Plus, "Cura 90+"],
  ];
  rateEntries.forEach(([value, label]) => validateRate(value, label));

  const cancellationCurve = [
    draft.cancellationD7,
    draft.cancellationD30,
    draft.cancellationD60,
    draft.cancellationD90,
    draft.cancellationD180,
    draft.cancellationLifetime,
  ].map(Number);
  if (
    cancellationCurve.some(
      (value, index) => index > 0 && value < cancellationCurve[index - 1]
    )
  )
    throw new Error("A curva de cancelamento deve ser cumulativa e não decrescente.");

  if (!/^\d+$/.test(draft.writeOffAfterDays) || Number(draft.writeOffAfterDays) < 90)
    throw new Error("Baixa definitiva deve ocorrer após pelo menos 90 dias.");

  return {
    versionId,
    status: draft.status,
    sourceType: draft.sourceType,
    ...(sourceRef ? { sourceRef } : {}),
    policy: {
      cancellationCurve: {
        d7: draft.cancellationD7,
        d30: draft.cancellationD30,
        d60: draft.cancellationD60,
        d90: draft.cancellationD90,
        d180: draft.cancellationD180,
        lifetime: draft.cancellationLifetime,
      },
      delinquencyRate: draft.delinquencyRate,
      cureRates: {
        days1To30: draft.cureDays1To30,
        days31To60: draft.cureDays31To60,
        days61To90: draft.cureDays61To90,
        days90Plus: draft.cureDays90Plus,
      },
      writeOffAfterDays: Number(draft.writeOffAfterDays),
      policyVersion: draft.policyVersion.trim(),
      sourceRef,
    },
  };
}

function RateField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        inputMode="decimal"
        pattern="(?:0(?:\.\d+)?|1(?:\.0+)?)"
        className="h-9 bg-background font-mono"
        disabled={disabled}
        onChange={event => onChange(normalizeDecimalInput(event.target.value))}
      />
    </div>
  );
}

export function ReceivablesPolicyBuilder({ versionId }: { versionId: string }) {
  const policyQuery = trpc.igr.receivablesPolicy.useQuery(
    { versionId: versionId || "placeholder" },
    { enabled: Boolean(versionId), retry: false }
  );
  const saved: SavedPolicy | undefined = policyQuery.data ?? undefined;
  const [draft, setDraft] = useState<ReceivablesPolicyDraft>(() =>
    readDraft(saved)
  );
  useEffect(() => {
    setDraft(emptyDraft());
  }, [versionId]);
  useEffect(() => {
    if (saved) setDraft(readDraft(saved));
  }, [saved]);

  const mutation = trpc.igr.upsertReceivablesPolicy.useMutation({
    onSuccess: async () => {
      await policyQuery.refetch();
      toast.success("Política de carteira salva.", {
        description: "Curvas, proveniência e versão foram registradas.",
      });
    },
    onError: error =>
      toast.error("Não foi possível salvar a política de carteira.", {
        description: error.message,
      }),
  });

  const disabled = !versionId || mutation.isPending;
  const patch = (values: Partial<ReceivablesPolicyDraft>) =>
    setDraft(current => ({ ...current, ...values }));
  const save = async () => {
    let input: ReturnType<typeof toReceivablesPolicyMutationInput>;
    try {
      input = toReceivablesPolicyMutationInput(versionId, draft);
    } catch (error) {
      toast.error("Revise a política de carteira.", {
        description:
          error instanceof Error ? error.message : "Dados inválidos.",
      });
      return;
    }
    try {
      await mutation.mutateAsync(input);
    } catch {
      // The mutation callback already reports the server error to the user.
    }
  };

  return (
    <section aria-labelledby="receivables-policy-title" className="space-y-4">
      <Card className="border-white/10 bg-card/80">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle
                id="receivables-policy-title"
                className="flex items-center gap-2 text-xl"
              >
                <ShieldCheck className="h-5 w-5 text-amber-300" />
                Política autoritativa de carteira
              </CardTitle>
              <CardDescription className="mt-2 max-w-3xl leading-6">
                Formaliza cancelamento, inadimplência, recuperação e baixa por
                versão. Taxas de cancelamento são cumulativas; taxas de cura são
                condicionais ao saldo que chegou a cada faixa de atraso.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                draft.status === "provided"
                  ? "border-emerald-300/25 text-emerald-200"
                  : "border-amber-200/25 text-amber-200"
              }
            >
              {draft.status === "provided" ? "POLÍTICA INFORMADA" : "PENDENTE"}
            </Badge>
          </div>
          {!versionId ? (
            <div className="flex gap-2 rounded-lg border border-amber-200/20 bg-amber-200/[0.04] p-3 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Selecione ou crie um projeto com versão de trabalho para editar.
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-6">
          {policyQuery.isLoading ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Carregando política de carteira…
            </p>
          ) : null}
          {policyQuery.isError ? (
            <p role="alert" className="text-sm text-red-300">
              Não foi possível carregar a política desta versão.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="receivables-policy-status">Estado</Label>
              <select
                id="receivables-policy-status"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.status}
                disabled={disabled}
                onChange={event =>
                  patch({ status: event.target.value as Status })
                }
              >
                <option value="pending">Pendente</option>
                <option value="provided">Informada</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receivables-policy-source-type">Tipo de fonte</Label>
              <select
                id="receivables-policy-source-type"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.sourceType}
                disabled={disabled}
                onChange={event =>
                  patch({ sourceType: event.target.value as SourceType })
                }
              >
                {(Object.keys(sourceTypeLabels) as SourceType[]).map(value => (
                  <option key={value} value={value}>
                    {sourceTypeLabels[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="receivables-policy-source">
                Fonte ou responsável {draft.status === "provided" ? "*" : ""}
              </Label>
              <Input
                id="receivables-policy-source"
                value={draft.sourceRef}
                disabled={disabled}
                placeholder="Documento, ata, estudo ou responsável"
                onChange={event => patch({ sourceRef: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="receivables-policy-version">Versão da política</Label>
              <Input
                id="receivables-policy-version"
                value={draft.policyVersion}
                disabled={disabled}
                placeholder="Ex.: carteira-2026.08"
                onChange={event => patch({ policyVersion: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="receivables-write-off">Baixa definitiva após</Label>
              <div className="relative">
                <Input
                  id="receivables-write-off"
                  value={draft.writeOffAfterDays}
                  inputMode="numeric"
                  pattern="[1-9]\\d*"
                  className="pr-14 font-mono"
                  disabled={disabled}
                  onChange={event =>
                    patch({ writeOffAfterDays: event.target.value })
                  }
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                  dias
                </span>
              </div>
            </div>
          </div>

          <fieldset className="space-y-3 rounded-xl border border-white/10 p-4">
            <legend className="px-2 text-sm font-semibold">
              Curva cumulativa de cancelamento
            </legend>
            <p className="flex gap-2 text-xs leading-5 text-muted-foreground">
              <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
              Cada marco inclui os cancelamentos anteriores. Os valores devem
              permanecer iguais ou crescer até vida inteira.
            </p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {percentFields.map(field => (
                <RateField
                  key={field.key}
                  id={`receivables-${field.key}`}
                  label={field.label}
                  value={draft[field.key]}
                  disabled={disabled}
                  onChange={value => patch({ [field.key]: value })}
                />
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 lg:grid-cols-[minmax(12rem,0.35fr)_1fr]">
            <fieldset className="space-y-3 rounded-xl border border-white/10 p-4">
              <legend className="px-2 text-sm font-semibold">
                Inadimplência de entrada
              </legend>
              <RateField
                id="receivables-delinquency"
                label="Taxa sobre o saldo elegível"
                value={draft.delinquencyRate}
                disabled={disabled}
                onChange={value => patch({ delinquencyRate: value })}
              />
            </fieldset>

            <fieldset className="space-y-3 rounded-xl border border-white/10 p-4">
              <legend className="px-2 text-sm font-semibold">
                Cura condicional por faixa
              </legend>
              <p className="text-xs leading-5 text-muted-foreground">
                A taxa de cada faixa incide somente sobre o saldo inadimplente
                que chegou àquela faixa, sem reaplicar sobre a carteira inteira.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {cureFields.map(field => (
                  <RateField
                    key={field.key}
                    id={`receivables-${field.key}`}
                    label={field.label}
                    value={draft[field.key]}
                    disabled={disabled}
                    onChange={value => patch({ [field.key]: value })}
                  />
                ))}
              </div>
            </fieldset>
          </div>

          <div className="flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              Informe taxas como decimal: 0,08 corresponde a 8%.
            </p>
            <Button onClick={() => void save()} disabled={disabled}>
              {mutation.isPending ? <Spinner /> : <Save />}
              Salvar política
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default ReceivablesPolicyBuilder;
