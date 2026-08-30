import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import {
  approvalDecisions,
  auditEvents,
  calculationSnapshots,
  costCatalogItems,
  decisionRecords,
  exportArtifacts,
  formulaDefinitionProvenance,
  formulaSetVersions,
  historicalBenchmarks,
  inputValues,
  kpiMemoryRecords,
  projects,
  projectComponentRecords,
  projectVersions,
  scenarioBranches,
  type InsertUser,
  users,
  workflowEvents,
} from "../drizzle/schema";
import { IGR_CORE_FORMULA_SET_V1 } from "../shared/financial/formulas";
import { calculateAuthoritativeSnapshot } from "./financial/snapshot";
import {
  calculateCapitalEnvelope,
  runGoalSeek,
} from "../shared/financial/goalseek";
import {
  calculateFinancialProjection,
  FinanceDecimal,
} from "../shared/financial/engine";
import { simulateCaptadorChange } from "../shared/financial/meetingSimulator";
import {
  calculateCommercialCapacity,
  calculateWorkforceEconomics,
} from "../shared/financial/operationsEconomics";
import { summarizeCostCatalog } from "../shared/financial/costCatalog";
import { assertExportEligibility } from "./financial/exportEligibility";
import {
  buildBoardroomPdf,
  buildBoardroomPptx,
  buildBoardroomXlsx,
  createExportableSnapshot,
} from "./financial/export";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";
import {
  FINANCIAL_INPUT_KEYS,
  type FinancialInputKey,
  type FinancialInputSnapshot,
} from "../shared/financial/types";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  values.role =
    user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

async function ensureCoreFormulaSet(actorId: number): Promise<string> {
  const db = await requireDb();
  const existing = await db
    .select({ id: formulaSetVersions.id })
    .from(formulaSetVersions)
    .where(eq(formulaSetVersions.id, IGR_CORE_FORMULA_SET_V1.id))
    .limit(1);
  if (existing[0]) return IGR_CORE_FORMULA_SET_V1.id;
  await db.insert(formulaSetVersions).values({
    id: IGR_CORE_FORMULA_SET_V1.id,
    semanticVersion: IGR_CORE_FORMULA_SET_V1.semanticVersion,
    engineVersion: IGR_CORE_FORMULA_SET_V1.engineVersion,
    status: "published",
    definitions: IGR_CORE_FORMULA_SET_V1.definitions as unknown as Record<
      string,
      unknown
    >,
    publishedBy: actorId,
    publishedAt: new Date(),
  });
  await db.insert(formulaDefinitionProvenance).values(
    IGR_CORE_FORMULA_SET_V1.definitions.map(definition => ({
      id: nanoid(),
      formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id,
      formulaId: definition.id,
      formulaVersion: definition.version,
      expression: definition.expression,
      dependencyKeys: definition.dependencies,
      description: definition.description,
      sourceRef: "IGR_CORE_FORMULA_SET_V1",
      publishedBy: actorId,
    }))
  );
  return IGR_CORE_FORMULA_SET_V1.id;
}

async function recordWorkflowEvent(params: {
  projectId: string;
  versionId: string;
  fromState?: "draft" | "in_review" | "approved" | "baseline" | null;
  toState: "draft" | "in_review" | "approved" | "baseline";
  action: string;
  rationale?: string | null;
  actorId: number;
}) {
  const db = await requireDb();
  await db.insert(workflowEvents).values({
    id: nanoid(),
    projectId: params.projectId,
    versionId: params.versionId,
    fromState: params.fromState ?? null,
    toState: params.toState,
    action: params.action,
    rationale: params.rationale ?? null,
    actorId: params.actorId,
  });
}

async function recordAuditEvent(params: {
  tenantId: number;
  entityType: string;
  entityId: string;
  action: string;
  actorId: number;
  beforeHash?: string | null;
  afterHash?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = await requireDb();
  await db.insert(auditEvents).values({
    id: nanoid(),
    tenantId: params.tenantId,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    actorId: params.actorId,
    beforeHash: params.beforeHash ?? null,
    afterHash: params.afterHash ?? null,
    metadata: params.metadata ?? null,
  });
}

export async function createProjectForTenant(params: {
  tenantId: number;
  actorId: number;
  name: string;
  inputs: FinancialInputSnapshot;
}) {
  const db = await requireDb();
  const formulaSetVersionId = await ensureCoreFormulaSet(params.actorId);
  const projectId = nanoid();
  const versionId = nanoid();
  const inputHash = sha256(params.inputs);
  await db.transaction(async transaction => {
    await transaction.insert(projects).values({
      id: projectId,
      tenantId: params.tenantId,
      name: params.name,
      createdBy: params.actorId,
    });
    await transaction.insert(projectVersions).values({
      id: versionId,
      projectId,
      formulaSetVersionId,
      kind: "working",
      state: "draft",
      isImmutable: false,
      inputHash,
      createdBy: params.actorId,
    });
    await transaction.insert(inputValues).values(
      Object.entries(params.inputs).map(([key, input]) => ({
        id: nanoid(),
        versionId,
        key,
        status: input.status,
        valueText: input.value ?? null,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef ?? null,
        updatedBy: params.actorId,
      }))
    );
    await transaction.insert(workflowEvents).values({
      id: nanoid(),
      projectId,
      versionId,
      fromState: null,
      toState: "draft",
      action: "version.created",
      rationale: null,
      actorId: params.actorId,
    });
    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "project",
      entityId: projectId,
      action: "project.created",
      actorId: params.actorId,
      beforeHash: null,
      afterHash: inputHash,
      metadata: { versionId, formulaSetVersionId },
    });
  });
  return { projectId, versionId, formulaSetVersionId, inputHash };
}

export async function listProjectsForTenant(tenantId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(projects)
    .where(eq(projects.tenantId, tenantId))
    .orderBy(desc(projects.updatedAt));
}

export async function getProjectForTenant(projectId: string, tenantId: number) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
    .limit(1);
  if (!result[0]) throw new Error("Projeto não encontrado ou não autorizado.");
  return result[0];
}

export async function getProjectContextForTenant(
  projectId: string,
  tenantId: number
) {
  const db = await requireDb();
  const project = await getProjectForTenant(projectId, tenantId);
  const versions = await db
    .select()
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(desc(projectVersions.createdAt));
  const versionIds = versions.map(version => version.id);
  const snapshots =
    versionIds.length === 0
      ? []
      : await db
          .select()
          .from(calculationSnapshots)
          .where(inArray(calculationSnapshots.projectVersionId, versionIds))
          .orderBy(desc(calculationSnapshots.createdAt));
  const latestSnapshot = snapshots[0] ?? null;
  const latestApproval = latestSnapshot
    ? ((
        await db
          .select()
          .from(approvalDecisions)
          .where(eq(approvalDecisions.snapshotId, latestSnapshot.id))
          .orderBy(desc(approvalDecisions.decidedAt))
          .limit(1)
      )[0] ?? null)
    : null;
  const latestInputUpdate = latestSnapshot
    ? ((
        await db
          .select()
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.tenantId, tenantId),
              eq(auditEvents.entityType, "project_version"),
              eq(auditEvents.entityId, latestSnapshot.projectVersionId),
              eq(auditEvents.action, "inputs.updated")
            )
          )
          .orderBy(desc(auditEvents.createdAt))
          .limit(1)
      )[0] ?? null)
    : null;
  const snapshotHistory = snapshots.slice(0, 8).map(snapshot => {
    const payload =
      snapshot.payload as unknown as import("../shared/financial/types").FinancialCalculation & {
        missingInputKeys?: string[];
      };
    return {
      id: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
      createdAt: snapshot.createdAt,
      calculationStatus: snapshot.calculationStatus,
      validationStatus: snapshot.validationStatus,
      isAuthoritative: snapshot.isAuthoritative,
      kpis: payload.kpis ?? null,
      missingInputKeys: payload.missingInputKeys ?? [],
    };
  });
  const workflowHistory = await db
    .select()
    .from(workflowEvents)
    .where(eq(workflowEvents.projectId, projectId))
    .orderBy(desc(workflowEvents.createdAt));
  const workingVersion =
    versions.find(
      version => version.state === "draft" && !version.isImmutable
    ) ?? null;
  const latestImpact = {
    changedInputKeys: Array.isArray(
      (latestInputUpdate?.metadata as { changedInputKeys?: unknown } | null)
        ?.changedInputKeys
    )
      ? (latestInputUpdate?.metadata as { changedInputKeys: string[] })
          .changedInputKeys
      : [],
    updatedAt: latestInputUpdate?.createdAt ?? null,
  };
  return {
    project,
    versions,
    workingVersion,
    latestSnapshot,
    latestApproval,
    snapshotHistory,
    latestImpact,
    workflowHistory,
  };
}

export async function getScenarioComparisonForTenant(
  projectId: string,
  tenantId: number
) {
  const db = await requireDb();
  const context = await getProjectContextForTenant(projectId, tenantId);
  const versionIds = context.versions.map(version => version.id);
  const branches = await db
    .select()
    .from(scenarioBranches)
    .where(eq(scenarioBranches.projectId, projectId));
  const snapshots =
    versionIds.length === 0
      ? []
      : await db
          .select()
          .from(calculationSnapshots)
          .where(
            and(
              inArray(calculationSnapshots.projectVersionId, versionIds),
              eq(calculationSnapshots.calculationStatus, "valid")
            )
          )
          .orderBy(desc(calculationSnapshots.createdAt));
  const latestSnapshotByVersion = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    if (!latestSnapshotByVersion.has(snapshot.projectVersionId))
      latestSnapshotByVersion.set(snapshot.projectVersionId, snapshot);
  }
  return context.versions.map(version => {
    const snapshot = latestSnapshotByVersion.get(version.id);
    const branch = branches.find(
      candidate => candidate.branchVersionId === version.id
    );
    const payload = snapshot?.payload as unknown as
      | import("../shared/financial/types").FinancialCalculation
      | undefined;
    return {
      versionId: version.id,
      kind: version.kind,
      state: version.state,
      isImmutable: version.isImmutable,
      label:
        branch?.name ??
        (version.kind === "baseline" ? "Baseline" : "Versão de trabalho"),
      reason: branch?.reason ?? null,
      snapshotId: snapshot?.id ?? null,
      snapshotHash: snapshot?.snapshotHash ?? null,
      kpis: payload?.kpis ?? null,
    };
  });
}

export async function getVersionForTenant(versionId: string, tenantId: number) {
  const db = await requireDb();
  const version = await db
    .select()
    .from(projectVersions)
    .where(eq(projectVersions.id, versionId))
    .limit(1);
  if (!version[0]) throw new Error("Versão de projeto não encontrada.");
  await getProjectForTenant(version[0].projectId, tenantId);
  return version[0];
}

export async function getInputsForVersion(
  versionId: string
): Promise<FinancialInputSnapshot> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(inputValues)
    .where(eq(inputValues.versionId, versionId));
  const saved = Object.fromEntries(
    rows.map(row => [
      row.key,
      {
        status: row.status,
        value: row.valueText ?? undefined,
        sourceType: row.sourceType,
        sourceRef: row.sourceRef ?? undefined,
        updatedBy: String(row.updatedBy),
      },
    ])
  );
  return Object.fromEntries(
    FINANCIAL_INPUT_KEYS.map(key => [
      key,
      saved[key] ?? { status: "pending", sourceType: "current_decision" },
    ])
  ) as FinancialInputSnapshot;
}

export type BuilderComponentType =
  | "project_assembly"
  | "product_stock"
  | "pricing_payments"
  | "acquisition_capacity"
  | "costs_workforce"
  | "commissions_partners"
  | "receivables_losses"
  | "capex_opex";
export type ProvenanceSourceType =
  | "current_decision"
  | "current_document"
  | "historical_primary"
  | "derived_analysis"
  | "external_benchmark"
  | "assumption";
export type CostCategory =
  | "payroll"
  | "occupancy"
  | "technology"
  | "marketing"
  | "partner"
  | "legal"
  | "operations"
  | "other";

export async function listDecisionRecordsForTenant(
  versionId: string,
  tenantId: number
) {
  await getVersionForTenant(versionId, tenantId);
  const db = await requireDb();
  return db
    .select()
    .from(decisionRecords)
    .where(eq(decisionRecords.versionId, versionId))
    .orderBy(desc(decisionRecords.createdAt));
}

export async function createDecisionRecordForTenant(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  inputKey?: string;
  title: string;
  decisionValue: string;
  rationale: string;
  responsible: string;
  sourceRef?: string;
}) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  if (version.isImmutable || version.state !== "draft")
    throw new Error(
      "Decisões só podem alterar a versão de trabalho. Para mudar decisão aprovada, crie um cenário."
    );
  if (!params.sourceRef?.trim())
    throw new Error(
      "Decisão aceita exige fonte, ata ou responsável identificável."
    );
  const inputKey = params.inputKey as FinancialInputKey | undefined;
  if (inputKey && !FINANCIAL_INPUT_KEYS.includes(inputKey))
    throw new Error("Input financeiro de decisão não reconhecido.");
  if (inputKey && !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(params.decisionValue))
    throw new Error(
      "Decisão vinculada a input financeiro exige valor decimal válido."
    );
  const id = nanoid();
  const record = {
    id,
    projectId: version.projectId,
    versionId: version.id,
    inputKey: inputKey ?? null,
    title: params.title,
    decisionValue: params.decisionValue,
    rationale: params.rationale,
    responsible: params.responsible,
    sourceRef: params.sourceRef ?? null,
    status: "accepted" as const,
    createdBy: params.actorId,
  };
  await db.transaction(async transaction => {
    await transaction.insert(decisionRecords).values(record);
    if (inputKey) {
      const inputs = await getInputsForVersion(version.id);
      const nextInputs = {
        ...inputs,
        [inputKey]: {
          status: "provided" as const,
          value: params.decisionValue,
          sourceType: "current_decision" as const,
          sourceRef: `decision:${id}`,
          updatedBy: String(params.actorId),
        },
      };
      await transaction
        .insert(inputValues)
        .values({
          id: nanoid(),
          versionId: version.id,
          key: inputKey,
          status: "provided",
          valueText: params.decisionValue,
          sourceType: "current_decision",
          sourceRef: `decision:${id}`,
          updatedBy: params.actorId,
        })
        .onDuplicateKeyUpdate({
          set: {
            status: "provided",
            valueText: params.decisionValue,
            sourceType: "current_decision",
            sourceRef: `decision:${id}`,
            updatedBy: params.actorId,
          },
        });
      await transaction
        .update(projectVersions)
        .set({ inputHash: sha256(nextInputs) })
        .where(eq(projectVersions.id, version.id));
    }
  });
  await recordAuditEvent({
    tenantId: params.tenantId,
    entityType: "decision_record",
    entityId: id,
    action: inputKey ? "decision.accepted_and_applied" : "decision.accepted",
    actorId: params.actorId,
    afterHash: sha256(record),
    metadata: {
      projectId: version.projectId,
      versionId: version.id,
      inputKey: inputKey ?? null,
    },
  });
  if (inputKey) {
    await recordAuditEvent({
      tenantId: params.tenantId,
      entityType: "project_version",
      entityId: version.id,
      action: "inputs.updated",
      actorId: params.actorId,
      metadata: { changedInputKeys: [inputKey], source: "decision" },
    });
  }
  return record;
}

export async function listBuilderComponentsForTenant(
  versionId: string,
  tenantId: number
) {
  await getVersionForTenant(versionId, tenantId);
  const db = await requireDb();
  return db
    .select()
    .from(projectComponentRecords)
    .where(eq(projectComponentRecords.versionId, versionId))
    .orderBy(desc(projectComponentRecords.updatedAt));
}

export async function upsertBuilderComponentForTenant(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  componentType: BuilderComponentType;
  name: string;
  status: "provided" | "pending";
  payload: Record<string, unknown>;
  sourceType: ProvenanceSourceType;
  sourceRef?: string;
}) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  if (version.isImmutable || version.state !== "draft")
    throw new Error(
      "Componentes só podem ser editados na versão de trabalho. Crie um cenário para preservar o baseline."
    );
  if (params.status === "provided" && !params.sourceRef?.trim())
    throw new Error("Bloco informado exige fonte ou responsável.");
  const before = await db
    .select()
    .from(projectComponentRecords)
    .where(
      and(
        eq(projectComponentRecords.versionId, version.id),
        eq(projectComponentRecords.componentType, params.componentType),
        eq(projectComponentRecords.name, params.name)
      )
    )
    .limit(1);
  const derivedEconomics =
    params.componentType === "costs_workforce"
      ? calculateWorkforceEconomics(params.payload)
      : params.componentType === "acquisition_capacity"
        ? calculateCommercialCapacity(params.payload)
        : null;
  const record = {
    id: before[0]?.id ?? nanoid(),
    versionId: version.id,
    componentType: params.componentType,
    name: params.name,
    status: params.status,
    payload: { ...params.payload, derivedEconomics },
    sourceType: params.sourceType,
    sourceRef: params.sourceRef ?? null,
    updatedBy: params.actorId,
  };
  await db
    .insert(projectComponentRecords)
    .values(record)
    .onDuplicateKeyUpdate({
      set: {
        status: record.status,
        payload: record.payload,
        sourceType: record.sourceType,
        sourceRef: record.sourceRef,
        updatedBy: record.updatedBy,
      },
    });
  await recordAuditEvent({
    tenantId: params.tenantId,
    entityType: "project_component",
    entityId: record.id,
    action: "builder_component.upserted",
    actorId: params.actorId,
    beforeHash: before[0] ? sha256(before[0]) : null,
    afterHash: sha256(record),
    metadata: {
      versionId: version.id,
      componentType: params.componentType,
      status: params.status,
    },
  });
  return record;
}

export async function listCostCatalogForTenant(
  versionId: string,
  tenantId: number
) {
  await getVersionForTenant(versionId, tenantId);
  const db = await requireDb();
  const items = await db
    .select()
    .from(costCatalogItems)
    .where(eq(costCatalogItems.versionId, versionId))
    .orderBy(desc(costCatalogItems.updatedAt));
  return { items, summary: summarizeCostCatalog(items) };
}

export async function createCostCatalogItemForTenant(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  category: CostCategory;
  name: string;
  frequency: "monthly" | "annual" | "one_time";
  amountText?: string;
  status: "provided" | "pending";
  sourceType: ProvenanceSourceType;
  sourceRef?: string;
}) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  if (version.isImmutable || version.state !== "draft")
    throw new Error("Catálogo só aceita edição na versão de trabalho.");
  if (params.status === "provided" && !params.sourceRef?.trim())
    throw new Error("Custo informado exige fonte ou responsável.");
  const record = {
    id: nanoid(),
    versionId: version.id,
    category: params.category,
    name: params.name,
    frequency: params.frequency,
    amountText: params.amountText ?? null,
    status: params.status,
    sourceType: params.sourceType,
    sourceRef: params.sourceRef ?? null,
    updatedBy: params.actorId,
  };
  await db.insert(costCatalogItems).values(record);
  await recordAuditEvent({
    tenantId: params.tenantId,
    entityType: "cost_catalog_item",
    entityId: record.id,
    action: "cost_catalog_item.created",
    actorId: params.actorId,
    afterHash: sha256(record),
    metadata: {
      versionId: version.id,
      category: record.category,
      frequency: record.frequency,
      status: record.status,
    },
  });
  return record;
}

export async function listHistoricalBenchmarksForTenant(tenantId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(historicalBenchmarks)
    .where(eq(historicalBenchmarks.tenantId, tenantId))
    .orderBy(desc(historicalBenchmarks.createdAt));
}

export async function createHistoricalBenchmarkForTenant(params: {
  tenantId: number;
  actorId: number;
  name: string;
  vertical: string;
  periodLabel: string;
  status: "provided" | "pending";
  metrics: Record<string, unknown>;
  sourceType: ProvenanceSourceType;
  sourceRef?: string;
}) {
  const db = await requireDb();
  if (params.status === "provided" && !params.sourceRef?.trim())
    throw new Error("Benchmark informado exige fonte primária.");
  const record = {
    id: nanoid(),
    tenantId: params.tenantId,
    name: params.name,
    vertical: params.vertical,
    periodLabel: params.periodLabel,
    status: params.status,
    metrics: params.metrics,
    sourceType: params.sourceType,
    sourceRef: params.sourceRef ?? null,
    createdBy: params.actorId,
  };
  await db.insert(historicalBenchmarks).values(record);
  await recordAuditEvent({
    tenantId: params.tenantId,
    entityType: "historical_benchmark",
    entityId: record.id,
    action: "historical_benchmark.created",
    actorId: params.actorId,
    afterHash: sha256(record),
    metadata: { status: record.status, vertical: record.vertical },
  });
  return record;
}

export async function updateInputsForTenant(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  inputs: FinancialInputSnapshot;
}) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  if (version.isImmutable || version.state !== "draft") {
    throw new Error(
      "Apenas versão de trabalho pode receber alteração direta. Crie um cenário para preservar o histórico."
    );
  }
  const previousInputs = await getInputsForVersion(version.id);
  const changedInputKeys = FINANCIAL_INPUT_KEYS.filter(
    key =>
      stableSerialize(previousInputs[key]) !==
      stableSerialize(params.inputs[key])
  );
  const beforeHash = version.inputHash;
  const inputHash = sha256(params.inputs);
  await db.transaction(async transaction => {
    for (const [key, input] of Object.entries(params.inputs)) {
      await transaction
        .insert(inputValues)
        .values({
          id: nanoid(),
          versionId: version.id,
          key,
          status: input.status,
          valueText: input.value ?? null,
          sourceType: input.sourceType,
          sourceRef: input.sourceRef ?? null,
          updatedBy: params.actorId,
        })
        .onDuplicateKeyUpdate({
          set: {
            status: input.status,
            valueText: input.value ?? null,
            sourceType: input.sourceType,
            sourceRef: input.sourceRef ?? null,
            updatedBy: params.actorId,
          },
        });
    }
    await transaction
      .update(projectVersions)
      .set({ inputHash })
      .where(eq(projectVersions.id, version.id));
  });
  await recordAuditEvent({
    tenantId: params.tenantId,
    entityType: "project_version",
    entityId: version.id,
    action: "inputs.updated",
    actorId: params.actorId,
    beforeHash,
    afterHash: inputHash,
    metadata: { changedInputKeys },
  });
  return { versionId: version.id, inputHash, changedInputKeys };
}

export async function createCalculationSnapshot(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  horizonMonths: number;
}) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  const inputs = await getInputsForVersion(version.id);
  const calculation = calculateAuthoritativeSnapshot({
    inputs,
    horizonMonths: params.horizonMonths,
    formulaSetVersionId: version.formulaSetVersionId,
  });
  const id = nanoid();
  const isAuthoritative = calculation.status === "valid";
  await db.insert(calculationSnapshots).values({
    id,
    projectVersionId: version.id,
    formulaSetVersionId: version.formulaSetVersionId,
    horizonMonths: params.horizonMonths,
    inputHash: version.inputHash,
    snapshotHash: calculation.snapshotHash,
    calculationStatus: calculation.status,
    validationStatus: calculation.status === "valid" ? "valid" : "failed",
    isAuthoritative,
    payload: calculation as unknown as Record<string, unknown>,
    createdBy: params.actorId,
  });
  if (calculation.status === "valid") {
    await db.insert(kpiMemoryRecords).values(
      calculation.memory.map(memory => ({
        id: nanoid(),
        snapshotId: id,
        kpiKey: memory.kpiKey,
        valueText: memory.value,
        formulaId: memory.formulaId,
        formulaVersion: memory.formulaVersion,
        dependencyKeys: memory.dependencies,
        explanation: memory.explanation,
      }))
    );
  }
  if (calculation.status === "valid" && version.state === "draft") {
    await db
      .update(projectVersions)
      .set({ state: "in_review" })
      .where(eq(projectVersions.id, version.id));
    await db
      .update(projects)
      .set({ status: "in_review" })
      .where(eq(projects.id, version.projectId));
    await recordWorkflowEvent({
      projectId: version.projectId,
      versionId: version.id,
      fromState: "draft",
      toState: "in_review",
      action: "snapshot.submitted_for_review",
      actorId: params.actorId,
    });
  }
  await recordAuditEvent({
    tenantId: params.tenantId,
    entityType: "calculation_snapshot",
    entityId: id,
    action: "snapshot.created",
    actorId: params.actorId,
    afterHash: calculation.snapshotHash,
    metadata: {
      versionId: version.id,
      status: calculation.status,
      horizonMonths: params.horizonMonths,
    },
  });
  return { id, ...calculation };
}

export async function simulateCaptadorChangeForTenant(params: {
  tenantId: number;
  versionId: string;
  horizonMonths: number;
  captadorDelta: string;
  qualifiedCouplesPerCaptadorMonth: string;
  loadedCostPerCaptadorMonth: string;
  averageTicketDelta?: string;
  fixedCostMonthlyDelta?: string;
  payrollMonthlyDelta?: string;
  variableCostMonthlyDelta?: string;
  capexInitialDelta?: string;
}) {
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  const inputs = await getInputsForVersion(version.id);
  return simulateCaptadorChange({
    inputs,
    horizonMonths: params.horizonMonths,
    captadorDelta: params.captadorDelta,
    qualifiedCouplesPerCaptadorMonth:
      params.qualifiedCouplesPerCaptadorMonth,
    loadedCostPerCaptadorMonth: params.loadedCostPerCaptadorMonth,
    averageTicketDelta: params.averageTicketDelta,
    fixedCostMonthlyDelta: params.fixedCostMonthlyDelta,
    payrollMonthlyDelta: params.payrollMonthlyDelta,
    variableCostMonthlyDelta: params.variableCostMonthlyDelta,
    capexInitialDelta: params.capexInitialDelta,
  });
}

export async function createScenarioForTenant(params: {
  tenantId: number;
  actorId: number;
  baseVersionId: string;
  name: string;
  reason: string;
}) {
  const db = await requireDb();
  const baseVersion = await getVersionForTenant(
    params.baseVersionId,
    params.tenantId
  );
  const inputSnapshot = await getInputsForVersion(baseVersion.id);
  const versionId = nanoid();
  const branchId = nanoid();
  await db.insert(projectVersions).values({
    id: versionId,
    projectId: baseVersion.projectId,
    parentVersionId: baseVersion.id,
    formulaSetVersionId: baseVersion.formulaSetVersionId,
    kind: "scenario",
    state: "draft",
    isImmutable: false,
    inputHash: sha256(inputSnapshot),
    createdBy: params.actorId,
  });
  await db.insert(inputValues).values(
    Object.entries(inputSnapshot).map(([key, input]) => ({
      id: nanoid(),
      versionId,
      key,
      status: input.status,
      valueText: input.value ?? null,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef ?? null,
      updatedBy: params.actorId,
    }))
  );
  await db.insert(scenarioBranches).values({
    id: branchId,
    projectId: baseVersion.projectId,
    baseVersionId: baseVersion.id,
    branchVersionId: versionId,
    name: params.name,
    reason: params.reason,
    createdBy: params.actorId,
  });
  await recordWorkflowEvent({
    projectId: baseVersion.projectId,
    versionId,
    toState: "draft",
    action: "scenario.created",
    rationale: params.reason,
    actorId: params.actorId,
  });
  await recordAuditEvent({
    tenantId: params.tenantId,
    entityType: "scenario_branch",
    entityId: branchId,
    action: "scenario.created",
    actorId: params.actorId,
    metadata: { baseVersionId: baseVersion.id, branchVersionId: versionId },
  });
  return { branchId, versionId };
}

export async function approveSnapshotForTenant(params: {
  tenantId: number;
  actorId: number;
  snapshotId: string;
  rationale: string;
}) {
  const db = await requireDb();
  const snapshot = await db
    .select()
    .from(calculationSnapshots)
    .where(eq(calculationSnapshots.id, params.snapshotId))
    .limit(1);
  if (!snapshot[0]) throw new Error("Snapshot não encontrado.");
  const version = await getVersionForTenant(
    snapshot[0].projectVersionId,
    params.tenantId
  );
  if (
    !snapshot[0].isAuthoritative ||
    snapshot[0].validationStatus !== "valid"
  ) {
    throw new Error(
      "Somente snapshot autoritativo e validado pode ser aprovado."
    );
  }
  await db.insert(approvalDecisions).values({
    id: nanoid(),
    snapshotId: snapshot[0].id,
    decision: "approved",
    rationale: params.rationale,
    decidedBy: params.actorId,
  });
  await recordWorkflowEvent({
    projectId: version.projectId,
    versionId: version.id,
    fromState: version.state,
    toState: "approved",
    action: "snapshot.approved",
    rationale: params.rationale,
    actorId: params.actorId,
  });
  await db
    .update(projectVersions)
    .set({ state: "approved" })
    .where(eq(projectVersions.id, version.id));
  await db
    .update(projects)
    .set({ status: "approved" })
    .where(eq(projects.id, version.projectId));
  await recordAuditEvent({
    tenantId: params.tenantId,
    entityType: "calculation_snapshot",
    entityId: snapshot[0].id,
    action: "snapshot.approved",
    actorId: params.actorId,
    afterHash: snapshot[0].snapshotHash,
    metadata: { rationale: params.rationale },
  });
  return { approved: true as const, snapshotId: snapshot[0].id };
}

export async function freezeBaselineForTenant(params: {
  tenantId: number;
  actorId: number;
  snapshotId: string;
}) {
  const db = await requireDb();
  const snapshot = (
    await db
      .select()
      .from(calculationSnapshots)
      .where(eq(calculationSnapshots.id, params.snapshotId))
      .limit(1)
  )[0];
  if (!snapshot) throw new Error("Snapshot não encontrado.");
  const version = await getVersionForTenant(
    snapshot.projectVersionId,
    params.tenantId
  );
  const approval = (
    await db
      .select()
      .from(approvalDecisions)
      .where(
        and(
          eq(approvalDecisions.snapshotId, params.snapshotId),
          eq(approvalDecisions.decision, "approved")
        )
      )
      .limit(1)
  )[0];
  assertExportEligibility({
    isAuthoritative: snapshot.isAuthoritative,
    validationStatus: snapshot.validationStatus,
    approved: Boolean(approval),
  });
  if (version.state !== "approved")
    throw new Error(
      "A versão precisa estar aprovada antes de congelar baseline."
    );
  await recordWorkflowEvent({
    projectId: version.projectId,
    versionId: version.id,
    fromState: "approved",
    toState: "baseline",
    action: "baseline.frozen",
    actorId: params.actorId,
  });
  await db
    .update(projectVersions)
    .set({ state: "baseline", kind: "baseline", isImmutable: true })
    .where(eq(projectVersions.id, version.id));
  await db
    .update(projects)
    .set({ status: "baseline" })
    .where(eq(projects.id, version.projectId));
  const calculation =
    snapshot.payload as unknown as import("../shared/financial/types").FinancialCalculation;
  await db.insert(historicalBenchmarks).values({
    id: nanoid(),
    tenantId: params.tenantId,
    name: `Baseline interno ${version.projectId.slice(0, 8)}`,
    vertical: "internal_decision",
    periodLabel: new Date().toISOString().slice(0, 10),
    status: "provided",
    metrics: calculation.kpis as unknown as Record<string, unknown>,
    sourceType: "derived_analysis",
    sourceRef: `snapshot:${snapshot.snapshotHash}`,
    createdBy: params.actorId,
  });
  await recordAuditEvent({
    tenantId: params.tenantId,
    entityType: "project_version",
    entityId: version.id,
    action: "baseline.frozen",
    actorId: params.actorId,
    afterHash: snapshot.snapshotHash,
  });
  return { versionId: version.id, baseline: true as const };
}

export async function calculateCapitalEnvelopeForTenant(params: {
  tenantId: number;
  versionId: string;
  horizonMonths: number;
  availableCapital: string;
}) {
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  const inputs = await getInputsForVersion(version.id);
  const calculation = calculateFinancialProjection(
    inputs,
    params.horizonMonths
  );
  if (calculation.status !== "valid")
    throw new Error(
      "Capital Envelope exige todas as premissas necessárias; há inputs pendentes."
    );
  return calculateCapitalEnvelope(
    params.availableCapital,
    calculation.projections
  );
}

export type ProjectGoalSeekVariable =
  | "qualifiedCouplesMonth1"
  | "conversionRate"
  | "averageTicket";
export type ProjectGoalSeekKpi = "npv" | "totalOperatingCashFlow";

export async function runProjectGoalSeekForTenant(params: {
  tenantId: number;
  versionId: string;
  horizonMonths: number;
  targetKpi: ProjectGoalSeekKpi;
  variableKey: ProjectGoalSeekVariable;
  target: string;
  lowerBound: string;
  upperBound: string;
}) {
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  const inputs = await getInputsForVersion(version.id);
  const baseline = calculateFinancialProjection(inputs, params.horizonMonths);
  if (baseline.status !== "valid")
    throw new Error(
      "Goal Seek exige todas as premissas obrigatórias informadas na versão selecionada."
    );
  return runGoalSeek({
    variableKey: params.variableKey,
    target: params.target,
    lowerBound: params.lowerBound,
    upperBound: params.upperBound,
    evaluate: candidate => {
      const nextInputs: FinancialInputSnapshot = {
        ...inputs,
        [params.variableKey]: {
          status: "provided",
          value: candidate.toString(),
          sourceType: "derived_analysis",
          sourceRef: "goal_seek",
        },
      } as FinancialInputSnapshot;
      const calculation = calculateFinancialProjection(
        nextInputs,
        params.horizonMonths
      );
      if (calculation.status !== "valid")
        throw new Error("A variável escolhida produziu cálculo bloqueado.");
      const value = calculation.kpis[params.targetKpi];
      if (value === null)
        throw new Error(
          `KPI ${params.targetKpi} não é calculável para esta versão.`
        );
      return new FinanceDecimal(value);
    },
  });
}

export async function getExportEligibilityForTenant(
  snapshotId: string,
  tenantId: number
) {
  const db = await requireDb();
  const snapshot = await db
    .select()
    .from(calculationSnapshots)
    .where(eq(calculationSnapshots.id, snapshotId))
    .limit(1);
  if (!snapshot[0]) throw new Error("Snapshot não encontrado.");
  await getVersionForTenant(snapshot[0].projectVersionId, tenantId);
  const approval = await db
    .select()
    .from(approvalDecisions)
    .where(
      and(
        eq(approvalDecisions.snapshotId, snapshotId),
        eq(approvalDecisions.decision, "approved")
      )
    )
    .orderBy(desc(approvalDecisions.decidedAt))
    .limit(1);
  const eligible =
    snapshot[0].isAuthoritative &&
    snapshot[0].validationStatus === "valid" &&
    Boolean(approval[0]);
  return {
    eligible,
    reason: eligible
      ? null
      : "A exportação exige snapshot autoritativo, validado e aprovado.",
    snapshotHash: snapshot[0].snapshotHash,
  };
}

export async function generateAuthorizedExportForTenant(params: {
  tenantId: number;
  actorId: number;
  snapshotId: string;
  format: "pdf" | "pptx" | "xlsx";
}) {
  const db = await requireDb();
  const snapshotRows = await db
    .select()
    .from(calculationSnapshots)
    .where(eq(calculationSnapshots.id, params.snapshotId))
    .limit(1);
  if (!snapshotRows[0]) throw new Error("Snapshot não encontrado.");
  await getVersionForTenant(snapshotRows[0].projectVersionId, params.tenantId);
  const approvals = await db
    .select()
    .from(approvalDecisions)
    .where(
      and(
        eq(approvalDecisions.snapshotId, params.snapshotId),
        eq(approvalDecisions.decision, "approved")
      )
    )
    .limit(1);
  assertExportEligibility({
    isAuthoritative: snapshotRows[0].isAuthoritative,
    validationStatus: snapshotRows[0].validationStatus,
    approved: Boolean(approvals[0]),
  });
  const artifactId = nanoid();
  await db.insert(exportArtifacts).values({
    id: artifactId,
    snapshotId: params.snapshotId,
    format: params.format,
    status: "queued",
    generatedBy: params.actorId,
  });
  try {
    const snapshot = createExportableSnapshot(
      snapshotRows[0].payload as unknown as import("../shared/financial/types").FinancialCalculation,
      snapshotRows[0].snapshotHash,
    );
    const data = params.format === "pdf"
      ? await buildBoardroomPdf(snapshot)
      : params.format === "pptx"
        ? await buildBoardroomPptx(snapshot)
        : await buildBoardroomXlsx(snapshot);
    const extension = params.format;
    const mimeType = params.format === "pdf"
      ? "application/pdf"
      : params.format === "pptx"
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const stored = await storagePut(
      `igr/${params.tenantId}/exports/${params.snapshotId}_${snapshot.snapshotHash.slice(0, 12)}.${extension}`,
      data,
      mimeType
    );
    await db
      .update(exportArtifacts)
      .set({ status: "generated", storageKey: stored.key })
      .where(eq(exportArtifacts.id, artifactId));
    await recordAuditEvent({
      tenantId: params.tenantId,
      entityType: "export_artifact",
      entityId: artifactId,
      action: "export.generated",
      actorId: params.actorId,
      metadata: {
        snapshotId: params.snapshotId,
        format: params.format,
        snapshotHash: snapshot.snapshotHash,
        storageKey: stored.key,
      },
    });
    return { artifactId, snapshotHash: snapshot.snapshotHash, url: stored.url };
  } catch (error) {
    await db
      .update(exportArtifacts)
      .set({ status: "failed" })
      .where(eq(exportArtifacts.id, artifactId));
    await recordAuditEvent({
      tenantId: params.tenantId,
      entityType: "export_artifact",
      entityId: artifactId,
      action: "export.failed",
      actorId: params.actorId,
      metadata: { snapshotId: params.snapshotId, format: params.format },
    });
    throw error;
  }
}
