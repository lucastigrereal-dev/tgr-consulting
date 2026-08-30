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
import type {
  CommercialOperationsCashflowTreatment,
  CommercialOperationsDefinition,
  CommissionEligibleBase,
  CommissionPolicy,
  TrainingEconomicsInput,
  WorkforceCohortInput,
} from "@shared/financial/commercialOperations";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CircleHelp,
  GraduationCap,
  Plus,
  Save,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
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
type TrainingPlan = Omit<TrainingEconomicsInput, "horizonMonths">;

export type CommercialOperationsDraft = {
  status: Status;
  sourceType: SourceType;
  sourceRef: string;
  definition: CommercialOperationsDefinition;
};

type SavedCommercialOperations = {
  record: {
    status: Status;
    sourceType: SourceType;
    sourceRef?: string | null;
  };
  definition: CommercialOperationsDefinition;
};

const sourceTypeLabels: Record<SourceType, string> = {
  current_decision: "Decisão atual",
  current_document: "Documento atual",
  historical_primary: "Histórico primário",
  derived_analysis: "Análise derivada",
  external_benchmark: "Benchmark externo",
  assumption: "Premissa",
};

const eligibleBaseLabels: Record<CommissionEligibleBase, string> = {
  gross_sales: "Vendas brutas",
  contracted_entry: "Entrada contratada",
  collected_entry: "Entrada recebida",
  validated_sale: "Venda validada",
  d30: "Venda saudável D30",
  d90: "Venda saudável D90",
  fixed: "Base fixa",
};

export function emptyWorkforceCohort(): WorkforceCohortInput {
  return {
    cohortId: "",
    role: "",
    capacityUnit: "tours",
    headcount: "0",
    hireMonth: 0,
    trainingMonths: 0,
    certificationRate: "1",
    rampCurve: [
      { productiveAgeMonth: 0, productivityRate: "0.5" },
      { productiveAgeMonth: 1, productivityRate: "1" },
    ],
    matureProductivity: "0",
    absenteeismRate: "0",
    monthlyTurnoverRate: "0",
    fixedCompensation: "0",
    burden: "0",
    guarantee: "0",
    allowance: "0",
    replacementCost: "0",
  };
}

export function emptyTrainingPlan(): TrainingPlan {
  return {
    trainingId: "",
    role: "",
    startMonth: 0,
    candidates: "0",
    classes: "1",
    durationMonths: 1,
    trainers: "0",
    trainerMonthlyCost: "0",
    candidateMonthlySalary: "0",
    monthlySupportCost: "0",
    approvalRate: "1",
    certificationRate: "1",
    timeToProductiveMonths: 0,
    targetProductivePeople: "0",
  };
}

export function emptyCommissionPolicy(): CommissionPolicy {
  return {
    policyId: "",
    role: "",
    eligibleBase: "d90",
    mode: "percentage",
    fixedAmount: "0",
    percentageRate: "0",
    tiers: [{ fromAmount: "1", rate: "0", accelerator: "1" }],
    guarantee: "0",
    cutoffDay: 20,
    paymentLagMonths: 1,
    qualityMultiplier: "1",
    holdbackRate: "0",
    reversalEnabled: false,
  };
}

export function emptyCommercialOperationsDraft(): CommercialOperationsDraft {
  return {
    status: "pending",
    sourceType: "current_decision",
    sourceRef: "",
    definition: {
      room: {
        rooms: [{ roomId: "sala-1", tables: "1", overflowTables: "0" }],
        operatingDaysPerMonth: "26",
        operatingHoursPerDay: "8",
        shifts: "1",
        averageTourDurationMinutes: "90",
        toursPerTable: "1",
        receptionists: "1",
        receptionCapacityPerPerson: "100",
        consultants: "1",
        consultantCapacityPerPerson: "100",
        closers: "1",
        closerSalesCapacityPerPerson: "10",
        peakFlowFactor: "1.5",
        maxWaitMinutes: "20",
      },
      workforce: { cashflowTreatment: "incremental", cohorts: [] },
      training: { cashflowTreatment: "incremental", plans: [] },
      commissions: { cashflowTreatment: "incremental", policies: [] },
    },
  };
}

function cloneDefinition(
  definition: CommercialOperationsDefinition
): CommercialOperationsDefinition {
  return {
    room: {
      ...definition.room,
      rooms: definition.room.rooms.map(room => ({ ...room })),
    },
    workforce: {
      ...definition.workforce,
      cohorts: definition.workforce.cohorts.map(cohort => ({
        ...cohort,
        rampCurve: cohort.rampCurve.map(entry => ({ ...entry })),
      })),
    },
    training: {
      ...definition.training,
      plans: definition.training.plans.map(plan => ({ ...plan })),
    },
    commissions: {
      ...definition.commissions,
      policies: definition.commissions.policies.map(policy => ({
        ...policy,
        tiers: policy.tiers.map(tier => ({ ...tier })),
      })),
    },
  };
}

function validateDecimal(value: string, label: string, rate = false) {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < 0)
    throw new Error(`${label} deve ser um decimal não negativo.`);
  if (rate && parsed > 1) throw new Error(`${label} deve estar entre 0 e 1.`);
}

function validateDecimalInteger(value: string, label: string) {
  validateDecimal(value, label);
  if (!Number.isInteger(Number(value))) throw new Error(`${label} deve ser inteiro.`);
}

function validateInteger(value: number, label: string, minimum = 0, maximum?: number) {
  if (!Number.isInteger(value) || value < minimum || (maximum !== undefined && value > maximum))
    throw new Error(`${label} deve ser inteiro entre ${minimum} e ${maximum ?? "∞"}.`);
}

function trimRequired(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} é obrigatório.`);
  return trimmed;
}

function uniqueId(value: string, label: string, ids: Set<string>) {
  const id = trimRequired(value, label);
  if (ids.has(id)) throw new Error(`${label} duplicado: ${id}.`);
  ids.add(id);
  return id;
}

function validateDefinition(
  source: CommercialOperationsDefinition
): CommercialOperationsDefinition {
  const definition = cloneDefinition(source);
  if (!definition.room.rooms.length) throw new Error("Adicione ao menos uma sala.");
  const roomIds = new Set<string>();
  definition.room.rooms = definition.room.rooms.map(room => ({
    roomId: uniqueId(room.roomId, "ID da sala", roomIds),
    tables: (validateDecimalInteger(room.tables, "Mesas"), room.tables),
    overflowTables: (validateDecimalInteger(room.overflowTables, "Mesas de overflow"), room.overflowTables),
  }));
  const roomFields: Array<[keyof typeof definition.room, string, boolean?]> = [
    ["operatingDaysPerMonth", "Dias de operação"],
    ["operatingHoursPerDay", "Horas por dia"],
    ["shifts", "Turnos"],
    ["averageTourDurationMinutes", "Duração do tour"],
    ["toursPerTable", "Tours por mesa"],
    ["receptionists", "Recepcionistas"],
    ["receptionCapacityPerPerson", "Capacidade da recepção"],
    ["consultants", "Consultores"],
    ["consultantCapacityPerPerson", "Capacidade dos consultores"],
    ["closers", "Closers"],
    ["closerSalesCapacityPerPerson", "Capacidade dos closers"],
    ["peakFlowFactor", "Pico"],
    ["maxWaitMinutes", "Espera máxima"],
  ];
  roomFields.forEach(([key, label]) => validateDecimal(definition.room[key] as string, label));
  for (const [key, label] of [
    ["operatingDaysPerMonth", "Dias de operação"],
    ["shifts", "Turnos"],
    ["receptionists", "Recepcionistas"],
    ["consultants", "Consultores"],
    ["closers", "Closers"],
  ] as const) validateDecimalInteger(definition.room[key], label);
  if (Number(definition.room.averageTourDurationMinutes) <= 0)
    throw new Error("Duração do tour deve ser maior que zero.");
  if (Number(definition.room.shifts) <= 0)
    throw new Error("Turnos deve ser maior que zero.");

  const cohortIds = new Set<string>();
  definition.workforce.cohorts = definition.workforce.cohorts.map(cohort => {
    const cohortId = uniqueId(cohort.cohortId, "ID da coorte", cohortIds);
    const role = trimRequired(cohort.role, `${cohortId}: função`);
    validateDecimal(cohort.headcount, `${cohortId}: headcount`);
    validateInteger(cohort.hireMonth, `${cohortId}: mês de contratação`);
    validateInteger(cohort.trainingMonths, `${cohortId}: meses de treinamento`);
    validateDecimal(cohort.certificationRate, `${cohortId}: certificação`, true);
    validateDecimal(cohort.matureProductivity, `${cohortId}: produtividade madura`);
    validateDecimal(cohort.absenteeismRate, `${cohortId}: absenteísmo`, true);
    validateDecimal(cohort.monthlyTurnoverRate, `${cohortId}: turnover`, true);
    for (const [value, label] of [
      [cohort.fixedCompensation, "compensação"],
      [cohort.burden, "encargos"],
      [cohort.guarantee, "garantia"],
      [cohort.allowance, "ajuda"],
      [cohort.replacementCost, "reposição"],
    ] as const) validateDecimal(value, `${cohortId}: ${label}`);
    const ages = new Set(cohort.rampCurve.map(entry => entry.productiveAgeMonth));
    if (ages.size !== cohort.rampCurve.length)
      throw new Error(`${cohortId}: ramp possui idade duplicada.`);
    if (!ages.has(0) || !ages.has(1))
      throw new Error(`${cohortId}: ramp deve conter ao menos M0 e M1.`);
    cohort.rampCurve.forEach(entry => {
      validateInteger(entry.productiveAgeMonth, `${cohortId}: idade do ramp`);
      validateDecimal(entry.productivityRate, `${cohortId}: produtividade do ramp`, true);
    });
    return { ...cohort, cohortId, role };
  });

  const trainingIds = new Set<string>();
  definition.training.plans = definition.training.plans.map(plan => {
    const trainingId = uniqueId(plan.trainingId, "ID do treinamento", trainingIds);
    const role = trimRequired(plan.role, `${trainingId}: função`);
    validateInteger(plan.startMonth, `${trainingId}: início`);
    validateInteger(plan.durationMonths, `${trainingId}: duração`, 1);
    validateInteger(plan.timeToProductiveMonths, `${trainingId}: tempo até produtividade`);
    for (const [value, label, isRate] of [
      [plan.candidates, "candidatos", false],
      [plan.classes, "turmas", false],
      [plan.trainers, "trainers", false],
      [plan.trainerMonthlyCost, "custo de trainers", false],
      [plan.candidateMonthlySalary, "salário dos candidatos", false],
      [plan.monthlySupportCost, "apoio mensal", false],
      [plan.approvalRate, "aprovação", true],
      [plan.certificationRate, "certificação", true],
      [plan.targetProductivePeople, "meta produtiva", false],
    ] as const) validateDecimal(value, `${trainingId}: ${label}`, isRate);
    if (Number(plan.classes) <= 0) throw new Error(`${trainingId}: turmas deve ser maior que zero.`);
    return { ...plan, trainingId, role };
  });

  const policyIds = new Set<string>();
  definition.commissions.policies = definition.commissions.policies.map(policy => {
    const policyId = uniqueId(policy.policyId, "ID da política", policyIds);
    const role = trimRequired(policy.role, `${policyId}: função`);
    validateDecimal(policy.fixedAmount, `${policyId}: valor fixo`);
    validateDecimal(policy.percentageRate, `${policyId}: percentual`, true);
    validateDecimal(policy.guarantee, `${policyId}: garantia`);
    validateDecimal(policy.qualityMultiplier, `${policyId}: qualidade`, true);
    validateDecimal(policy.holdbackRate, `${policyId}: holdback`, true);
    validateInteger(policy.cutoffDay, `${policyId}: cutoff`, 1, 31);
    validateInteger(policy.paymentLagMonths, `${policyId}: lag de pagamento`);
    const thresholds = new Set<string>();
    policy.tiers.forEach(tier => {
      validateDecimal(tier.fromAmount, `${policyId}: início do tier`);
      if (Number(tier.fromAmount) <= 0) throw new Error(`${policyId}: início do tier deve ser maior que zero.`);
      if (thresholds.has(tier.fromAmount)) throw new Error(`${policyId}: tier duplicado.`);
      thresholds.add(tier.fromAmount);
      validateDecimal(tier.rate, `${policyId}: taxa do tier`, true);
      validateDecimal(tier.accelerator, `${policyId}: acelerador`);
    });
    return { ...policy, policyId, role };
  });
  return definition;
}

export function toCommercialOperationsMutationInput(
  versionId: string,
  draft: CommercialOperationsDraft
) {
  if (!versionId) throw new Error("Selecione uma versão de trabalho.");
  const sourceRef = draft.sourceRef.trim();
  if (draft.status === "provided" && !sourceRef)
    throw new Error("Operação informada exige fonte ou responsável.");
  return {
    versionId,
    status: draft.status,
    sourceType: draft.sourceType,
    ...(sourceRef ? { sourceRef } : {}),
    definition: validateDefinition(draft.definition),
  };
}

function DecimalField({ id, label, value, disabled, onChange }: {
  id: string; label: string; value: string; disabled: boolean; onChange: (value: string) => void;
}) {
  return <div className="space-y-1.5"><Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label><Input id={id} value={value} inputMode="decimal" className="h-9 bg-background font-mono" disabled={disabled} onChange={event => onChange(normalizeDecimalInput(event.target.value))} /></div>;
}

function IntegerField({ id, label, value, disabled, onChange }: {
  id: string; label: string; value: number; disabled: boolean; onChange: (value: number) => void;
}) {
  return <div className="space-y-1.5"><Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label><Input id={id} value={String(value)} inputMode="numeric" className="h-9 bg-background font-mono" disabled={disabled} onChange={event => onChange(Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0))} /></div>;
}

function CashflowSelect({ id, value, disabled, onChange }: {
  id: string; value: CommercialOperationsCashflowTreatment; disabled: boolean; onChange: (value: CommercialOperationsCashflowTreatment) => void;
}) {
  return <div className="space-y-1.5"><Label htmlFor={id}>Tratamento no caixa</Label><select id={id} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} disabled={disabled} onChange={event => onChange(event.target.value as CommercialOperationsCashflowTreatment)}><option value="incremental">Incremental — somar ao projeto</option><option value="included_in_project_totals">Já incluído nos totais</option></select></div>;
}

const SectionHeading = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => <div className="flex items-center gap-2 text-base font-semibold">{icon}{children}</div>;

export function CommercialOperationsBuilder({ versionId }: { versionId: string }) {
  const query = trpc.igr.commercialOperations.useQuery(
    { versionId: versionId || "placeholder" },
    { enabled: Boolean(versionId), retry: false }
  );
  const saved = (query.data ?? null) as SavedCommercialOperations | null;
  const [draft, setDraft] = useState<CommercialOperationsDraft>(() => saved ? {
    status: saved.record.status,
    sourceType: saved.record.sourceType,
    sourceRef: saved.record.sourceRef ?? "",
    definition: cloneDefinition(saved.definition),
  } : emptyCommercialOperationsDraft());

  useEffect(() => setDraft(emptyCommercialOperationsDraft()), [versionId]);
  useEffect(() => {
    if (saved) setDraft({
      status: saved.record.status,
      sourceType: saved.record.sourceType,
      sourceRef: saved.record.sourceRef ?? "",
      definition: cloneDefinition(saved.definition),
    });
  }, [saved]);

  const mutation = trpc.igr.upsertCommercialOperations.useMutation({
    onSuccess: async () => {
      await query.refetch();
      toast.success("Operação comercial salva.", { description: "Sala, workforce, treinamento e comissão foram registrados em um único payload." });
    },
    onError: error => toast.error("Não foi possível salvar a operação.", { description: error.message }),
  });
  const disabled = !versionId || mutation.isPending;
  const patchDefinition = (definition: CommercialOperationsDefinition) => setDraft(current => ({ ...current, definition }));
  const patchRoom = (values: Partial<CommercialOperationsDefinition["room"]>) => patchDefinition({ ...draft.definition, room: { ...draft.definition.room, ...values } });
  const patchWorkforce = (values: Partial<CommercialOperationsDefinition["workforce"]>) => patchDefinition({ ...draft.definition, workforce: { ...draft.definition.workforce, ...values } });
  const patchTraining = (values: Partial<CommercialOperationsDefinition["training"]>) => patchDefinition({ ...draft.definition, training: { ...draft.definition.training, ...values } });
  const patchCommissions = (values: Partial<CommercialOperationsDefinition["commissions"]>) => patchDefinition({ ...draft.definition, commissions: { ...draft.definition.commissions, ...values } });

  const save = async () => {
    let input: ReturnType<typeof toCommercialOperationsMutationInput>;
    try {
      input = toCommercialOperationsMutationInput(versionId, draft);
    } catch (error) {
      toast.error("Revise a operação comercial.", {
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

  const roomScalarFields: Array<[keyof Omit<CommercialOperationsDefinition["room"], "rooms">, string]> = [
    ["operatingDaysPerMonth", "Dias de operação / mês"], ["operatingHoursPerDay", "Horas / dia"], ["shifts", "Turnos"], ["averageTourDurationMinutes", "Duração média do tour (min)"], ["toursPerTable", "Tours por mesa"], ["receptionists", "Recepcionistas"], ["receptionCapacityPerPerson", "Capacidade por recepcionista"], ["consultants", "Consultores"], ["consultantCapacityPerPerson", "Capacidade por consultor"], ["closers", "Closers"], ["closerSalesCapacityPerPerson", "Vendas por closer"], ["peakFlowFactor", "Fator de pico"], ["maxWaitMinutes", "Espera máxima (min)"],
  ];

  return <section aria-labelledby="commercial-operations-title"><Card className="border-white/10 bg-card/80"><CardHeader className="gap-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle id="commercial-operations-title" className="flex items-center gap-2 text-xl"><BriefcaseBusiness className="h-5 w-5 text-violet-300" />Operação comercial autoritativa</CardTitle><CardDescription className="mt-2 max-w-3xl leading-6">Dimensione a sala, as coortes de equipe, a formação e a remuneração variável sem misturar capacidade com demanda.</CardDescription></div><Badge variant="outline" className={draft.status === "provided" ? "border-emerald-300/25 text-emerald-200" : "border-amber-200/25 text-amber-200"}>{draft.status === "provided" ? "OPERAÇÃO INFORMADA" : "PENDENTE"}</Badge></div>{!versionId ? <div className="flex gap-2 rounded-lg border border-amber-200/20 bg-amber-200/[0.04] p-3 text-sm text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Selecione ou crie um projeto com versão de trabalho para editar.</div> : null}<div className="grid gap-2 rounded-lg border border-violet-300/15 bg-violet-300/[0.04] p-3 text-xs leading-5 text-muted-foreground md:grid-cols-2"><p className="flex gap-2"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />Incremental adiciona o custo ao caixa do projeto.</p><p>Já incluído evita dupla contagem: preserva a análise operacional sem somar o mesmo custo novamente.</p></div></CardHeader><CardContent className="space-y-5">{query.isLoading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Carregando operação…</p> : null}{query.isError ? <p role="alert" className="text-sm text-red-300">Não foi possível carregar a operação desta versão.</p> : null}

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-1.5"><Label htmlFor="operations-status">Estado</Label><select id="operations-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.status} disabled={disabled} onChange={event => setDraft(current => ({ ...current, status: event.target.value as Status }))}><option value="pending">Pendente</option><option value="provided">Informada</option></select></div><div className="space-y-1.5"><Label htmlFor="operations-source-type">Tipo de fonte</Label><select id="operations-source-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.sourceType} disabled={disabled} onChange={event => setDraft(current => ({ ...current, sourceType: event.target.value as SourceType }))}>{(Object.keys(sourceTypeLabels) as SourceType[]).map(value => <option key={value} value={value}>{sourceTypeLabels[value]}</option>)}</select></div><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="operations-source">Fonte ou responsável {draft.status === "provided" ? "*" : ""}</Label><Input id="operations-source" value={draft.sourceRef} disabled={disabled} placeholder="Documento, ata ou responsável" onChange={event => setDraft(current => ({ ...current, sourceRef: event.target.value }))} /></div></div>

    <details open className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer list-none"><SectionHeading icon={<Users className="h-4 w-4 text-violet-300" />}>1. Sala e capacidade</SectionHeading></summary><div className="mt-4 space-y-4"><p className="text-xs text-muted-foreground">Mesas fixas e overflow definem capacidade física; recepção, consultores e closers podem se tornar gargalos independentes.</p>{draft.definition.room.rooms.map((room, index) => <div key={index} className="grid gap-3 rounded-lg border border-white/10 p-3 sm:grid-cols-4"><div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`room-id-${index}`}>ID da sala</Label><Input id={`room-id-${index}`} value={room.roomId} disabled={disabled} onChange={event => patchRoom({ rooms: draft.definition.room.rooms.map((item, itemIndex) => itemIndex === index ? { ...item, roomId: event.target.value } : item) })} /></div><DecimalField id={`room-tables-${index}`} label="Mesas" value={room.tables} disabled={disabled} onChange={value => patchRoom({ rooms: draft.definition.room.rooms.map((item, itemIndex) => itemIndex === index ? { ...item, tables: value } : item) })} /><div className="flex items-end gap-2"><div className="min-w-0 flex-1"><DecimalField id={`room-overflow-${index}`} label="Overflow" value={room.overflowTables} disabled={disabled} onChange={value => patchRoom({ rooms: draft.definition.room.rooms.map((item, itemIndex) => itemIndex === index ? { ...item, overflowTables: value } : item) })} /></div><Button type="button" variant="outline" size="icon" aria-label={`Remover sala ${index + 1}`} disabled={disabled} onClick={() => patchRoom({ rooms: draft.definition.room.rooms.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></Button></div></div>)}<Button type="button" variant="outline" disabled={disabled} onClick={() => patchRoom({ rooms: [...draft.definition.room.rooms, { roomId: `sala-${draft.definition.room.rooms.length + 1}`, tables: "1", overflowTables: "0" }] })}><Plus className="h-4 w-4" />Adicionar sala</Button><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{roomScalarFields.map(([key, label]) => <DecimalField key={key} id={`room-${key}`} label={label} value={draft.definition.room[key]} disabled={disabled} onChange={value => patchRoom({ [key]: value })} />)}</div></div></details>

    <details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer list-none"><SectionHeading icon={<BriefcaseBusiness className="h-4 w-4 text-sky-300" />}>2. Workforce por coortes</SectionHeading></summary><div className="mt-4 space-y-4"><CashflowSelect id="workforce-cashflow" value={draft.definition.workforce.cashflowTreatment} disabled={disabled} onChange={cashflowTreatment => patchWorkforce({ cashflowTreatment })} />{draft.definition.workforce.cohorts.map((cohort, index) => <WorkforceEditor key={index} index={index} value={cohort} disabled={disabled} onChange={value => patchWorkforce({ cohorts: draft.definition.workforce.cohorts.map((item, itemIndex) => itemIndex === index ? value : item) })} onRemove={() => patchWorkforce({ cohorts: draft.definition.workforce.cohorts.filter((_, itemIndex) => itemIndex !== index) })} />)}<Button type="button" variant="outline" disabled={disabled} onClick={() => patchWorkforce({ cohorts: [...draft.definition.workforce.cohorts, emptyWorkforceCohort()] })}><Plus className="h-4 w-4" />Adicionar coorte</Button></div></details>

    <details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer list-none"><SectionHeading icon={<GraduationCap className="h-4 w-4 text-emerald-300" />}>3. Treinamento</SectionHeading></summary><div className="mt-4 space-y-4"><CashflowSelect id="training-cashflow" value={draft.definition.training.cashflowTreatment} disabled={disabled} onChange={cashflowTreatment => patchTraining({ cashflowTreatment })} />{draft.definition.training.plans.map((plan, index) => <TrainingEditor key={index} index={index} value={plan} disabled={disabled} onChange={value => patchTraining({ plans: draft.definition.training.plans.map((item, itemIndex) => itemIndex === index ? value : item) })} onRemove={() => patchTraining({ plans: draft.definition.training.plans.filter((_, itemIndex) => itemIndex !== index) })} />)}<Button type="button" variant="outline" disabled={disabled} onClick={() => patchTraining({ plans: [...draft.definition.training.plans, emptyTrainingPlan()] })}><Plus className="h-4 w-4" />Adicionar treinamento</Button></div></details>

    <details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer list-none"><SectionHeading icon={<WalletCards className="h-4 w-4 text-amber-300" />}>4. Políticas de comissão</SectionHeading></summary><div className="mt-4 space-y-4"><CashflowSelect id="commissions-cashflow" value={draft.definition.commissions.cashflowTreatment} disabled={disabled} onChange={cashflowTreatment => patchCommissions({ cashflowTreatment })} />{draft.definition.commissions.policies.map((policy, index) => <CommissionEditor key={index} index={index} value={policy} disabled={disabled} onChange={value => patchCommissions({ policies: draft.definition.commissions.policies.map((item, itemIndex) => itemIndex === index ? value : item) })} onRemove={() => patchCommissions({ policies: draft.definition.commissions.policies.filter((_, itemIndex) => itemIndex !== index) })} />)}<Button type="button" variant="outline" disabled={disabled} onClick={() => patchCommissions({ policies: [...draft.definition.commissions.policies, emptyCommissionPolicy()] })}><Plus className="h-4 w-4" />Adicionar política</Button></div></details>

    <div className="flex justify-end border-t border-white/10 pt-4"><Button type="button" disabled={disabled} onClick={() => void save()}>{mutation.isPending ? <Spinner /> : <Save className="h-4 w-4" />}Salvar operação</Button></div>
  </CardContent></Card></section>;
}

function WorkforceEditor({ index, value, disabled, onChange, onRemove }: { index: number; value: WorkforceCohortInput; disabled: boolean; onChange: (value: WorkforceCohortInput) => void; onRemove: () => void }) {
  const patch = (values: Partial<WorkforceCohortInput>) => onChange({ ...value, ...values });
  const decimals: Array<[keyof WorkforceCohortInput, string]> = [["headcount", "Headcount"], ["certificationRate", "Certificação"], ["matureProductivity", "Produtividade madura"], ["absenteeismRate", "Absenteísmo"], ["monthlyTurnoverRate", "Turnover mensal"], ["fixedCompensation", "Compensação fixa"], ["burden", "Encargos"], ["guarantee", "Garantia"], ["allowance", "Ajuda de custo"], ["replacementCost", "Custo de reposição"]];
  const nextRampAge = value.rampCurve.length
    ? Math.max(...value.rampCurve.map(entry => entry.productiveAgeMonth)) + 1
    : 0;
  return <fieldset className="space-y-4 rounded-lg border border-white/10 p-3"><legend className="px-2 text-sm font-semibold">Coorte {index + 1}</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-1.5"><Label htmlFor={`cohort-id-${index}`}>ID</Label><Input id={`cohort-id-${index}`} value={value.cohortId} disabled={disabled} onChange={event => patch({ cohortId: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor={`cohort-role-${index}`}>Função</Label><Input id={`cohort-role-${index}`} value={value.role} disabled={disabled} onChange={event => patch({ role: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor={`cohort-unit-${index}`}>Unidade de capacidade</Label><select id={`cohort-unit-${index}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value.capacityUnit} disabled={disabled} onChange={event => patch({ capacityUnit: event.target.value as WorkforceCohortInput["capacityUnit"] })}><option value="tours">Tours</option><option value="sales">Vendas</option><option value="support">Suporte</option></select></div><IntegerField id={`cohort-hire-${index}`} label="Mês de contratação" value={value.hireMonth} disabled={disabled} onChange={hireMonth => patch({ hireMonth })} /><IntegerField id={`cohort-training-${index}`} label="Meses de treinamento" value={value.trainingMonths} disabled={disabled} onChange={trainingMonths => patch({ trainingMonths })} />{decimals.map(([key, label]) => <DecimalField key={key} id={`cohort-${key}-${index}`} label={label} value={value[key] as string} disabled={disabled} onChange={next => patch({ [key]: next })} />)}</div><div><p className="mb-2 text-xs font-semibold">Ramp de produtividade</p><div className="grid gap-3 sm:grid-cols-2">{value.rampCurve.map((entry, rampIndex) => <div key={rampIndex} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"><IntegerField id={`cohort-ramp-age-${index}-${rampIndex}`} label={`Idade M${rampIndex}`} value={entry.productiveAgeMonth} disabled={disabled} onChange={productiveAgeMonth => patch({ rampCurve: value.rampCurve.map((item, itemIndex) => itemIndex === rampIndex ? { ...item, productiveAgeMonth } : item) })} /><DecimalField id={`cohort-ramp-rate-${index}-${rampIndex}`} label="Produtividade" value={entry.productivityRate} disabled={disabled} onChange={productivityRate => patch({ rampCurve: value.rampCurve.map((item, itemIndex) => itemIndex === rampIndex ? { ...item, productivityRate } : item) })} />{rampIndex > 1 ? <Button type="button" variant="outline" size="icon" aria-label={`Remover marco de ramp ${rampIndex + 1}`} disabled={disabled} onClick={() => patch({ rampCurve: value.rampCurve.filter((_, itemIndex) => itemIndex !== rampIndex) })}><Trash2 className="h-4 w-4" /></Button> : <span />}</div>)}</div><Button type="button" variant="outline" className="mt-3" disabled={disabled} onClick={() => patch({ rampCurve: [...value.rampCurve, { productiveAgeMonth: nextRampAge, productivityRate: "1" }] })}><Plus className="h-4 w-4" />Adicionar marco de ramp</Button></div><Button type="button" variant="outline" disabled={disabled} onClick={onRemove}><Trash2 className="h-4 w-4" />Remover coorte</Button></fieldset>;
}

function TrainingEditor({ index, value, disabled, onChange, onRemove }: { index: number; value: TrainingPlan; disabled: boolean; onChange: (value: TrainingPlan) => void; onRemove: () => void }) {
  const patch = (values: Partial<TrainingPlan>) => onChange({ ...value, ...values });
  const decimals: Array<[keyof TrainingPlan, string]> = [["candidates", "Candidatos"], ["classes", "Turmas"], ["trainers", "Trainers"], ["trainerMonthlyCost", "Custo mensal dos trainers"], ["candidateMonthlySalary", "Salário dos candidatos"], ["monthlySupportCost", "Apoio mensal"], ["approvalRate", "Aprovação"], ["certificationRate", "Certificação"], ["targetProductivePeople", "Meta produtiva"]];
  return <fieldset className="space-y-4 rounded-lg border border-white/10 p-3"><legend className="px-2 text-sm font-semibold">Treinamento {index + 1}</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-1.5"><Label htmlFor={`training-id-${index}`}>ID</Label><Input id={`training-id-${index}`} value={value.trainingId} disabled={disabled} onChange={event => patch({ trainingId: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor={`training-role-${index}`}>Função</Label><Input id={`training-role-${index}`} value={value.role} disabled={disabled} onChange={event => patch({ role: event.target.value })} /></div><IntegerField id={`training-start-${index}`} label="Mês de início" value={value.startMonth} disabled={disabled} onChange={startMonth => patch({ startMonth })} /><IntegerField id={`training-duration-${index}`} label="Duração (meses)" value={value.durationMonths} disabled={disabled} onChange={durationMonths => patch({ durationMonths })} /><IntegerField id={`training-time-${index}`} label="Meses até produtividade" value={value.timeToProductiveMonths} disabled={disabled} onChange={timeToProductiveMonths => patch({ timeToProductiveMonths })} />{decimals.map(([key, label]) => <DecimalField key={key} id={`training-${key}-${index}`} label={label} value={value[key] as string} disabled={disabled} onChange={next => patch({ [key]: next })} />)}</div><Button type="button" variant="outline" disabled={disabled} onClick={onRemove}><Trash2 className="h-4 w-4" />Remover treinamento</Button></fieldset>;
}

function CommissionEditor({ index, value, disabled, onChange, onRemove }: { index: number; value: CommissionPolicy; disabled: boolean; onChange: (value: CommissionPolicy) => void; onRemove: () => void }) {
  const patch = (values: Partial<CommissionPolicy>) => onChange({ ...value, ...values });
  return <fieldset className="space-y-4 rounded-lg border border-white/10 p-3"><legend className="px-2 text-sm font-semibold">Política {index + 1}</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-1.5"><Label htmlFor={`policy-id-${index}`}>ID</Label><Input id={`policy-id-${index}`} value={value.policyId} disabled={disabled} onChange={event => patch({ policyId: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor={`policy-role-${index}`}>Função</Label><Input id={`policy-role-${index}`} value={value.role} disabled={disabled} onChange={event => patch({ role: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor={`policy-base-${index}`}>Base elegível</Label><select id={`policy-base-${index}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value.eligibleBase} disabled={disabled} onChange={event => patch({ eligibleBase: event.target.value as CommissionEligibleBase })}>{(Object.keys(eligibleBaseLabels) as CommissionEligibleBase[]).map(base => <option key={base} value={base}>{eligibleBaseLabels[base]}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor={`policy-mode-${index}`}>Modo</Label><select id={`policy-mode-${index}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value.mode} disabled={disabled} onChange={event => patch({ mode: event.target.value as CommissionPolicy["mode"] })}><option value="percentage">Percentual</option><option value="fixed">Fixo</option></select></div><DecimalField id={`policy-fixed-${index}`} label="Valor fixo" value={value.fixedAmount} disabled={disabled} onChange={fixedAmount => patch({ fixedAmount })} /><DecimalField id={`policy-rate-${index}`} label="Percentual" value={value.percentageRate} disabled={disabled} onChange={percentageRate => patch({ percentageRate })} /><DecimalField id={`policy-guarantee-${index}`} label="Garantia" value={value.guarantee} disabled={disabled} onChange={guarantee => patch({ guarantee })} /><IntegerField id={`policy-cutoff-${index}`} label="Dia de cutoff" value={value.cutoffDay} disabled={disabled} onChange={cutoffDay => patch({ cutoffDay })} /><IntegerField id={`policy-lag-${index}`} label="Lag de pagamento (meses)" value={value.paymentLagMonths} disabled={disabled} onChange={paymentLagMonths => patch({ paymentLagMonths })} /><DecimalField id={`policy-quality-${index}`} label="Multiplicador de qualidade" value={value.qualityMultiplier} disabled={disabled} onChange={qualityMultiplier => patch({ qualityMultiplier })} /><DecimalField id={`policy-holdback-${index}`} label="Holdback" value={value.holdbackRate} disabled={disabled} onChange={holdbackRate => patch({ holdbackRate })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.reversalEnabled} disabled={disabled} onChange={event => patch({ reversalEnabled: event.target.checked })} />Permitir reversão</label></div><div className="rounded-lg border border-white/10 p-3"><p className="mb-3 text-xs font-semibold">Tier inicial</p>{value.tiers.slice(0, 1).map((tier, tierIndex) => <div key={tierIndex} className="grid gap-3 sm:grid-cols-3"><DecimalField id={`policy-tier-from-${index}`} label="A partir de" value={tier.fromAmount} disabled={disabled} onChange={fromAmount => patch({ tiers: [{ ...tier, fromAmount }, ...value.tiers.slice(1)] })} /><DecimalField id={`policy-tier-rate-${index}`} label="Taxa do tier" value={tier.rate} disabled={disabled} onChange={rate => patch({ tiers: [{ ...tier, rate }, ...value.tiers.slice(1)] })} /><DecimalField id={`policy-tier-accelerator-${index}`} label="Acelerador" value={tier.accelerator} disabled={disabled} onChange={accelerator => patch({ tiers: [{ ...tier, accelerator }, ...value.tiers.slice(1)] })} /></div>)}</div><Button type="button" variant="outline" disabled={disabled} onClick={onRemove}><Trash2 className="h-4 w-4" />Remover política</Button></fieldset>;
}

export default CommercialOperationsBuilder;
