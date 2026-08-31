import { and, desc, eq, sql } from "drizzle-orm";
import type { MySqlTransaction } from "drizzle-orm/mysql-core";
import {
  drizzle,
  type MySql2PreparedQueryHKT,
  type MySql2QueryResultHKT,
} from "drizzle-orm/mysql2";
import { inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import {
  approvalDecisions,
  auditEvents,
  calculationSnapshots,
  commercialConditions,
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
  productPricePhases,
  productSkus,
  projectVersions,
  receivablesPolicies,
  scenarioBranches,
  type InsertUser,
  users,
  workflowEvents,
} from "../drizzle/schema";
import { IGR_CORE_FORMULA_SET_V1 } from "../shared/financial/formulas";
import { calculateAuthoritativeSnapshot } from "./financial/snapshot";
import {
  calculateCapitalEnvelope,
  GOAL_SEEK_LEVER_KEYS,
  GOAL_SEEK_LEVERS,
  GOAL_SEEK_TARGET_KEYS,
  GOAL_SEEK_TARGETS,
  runGoalSeekV1,
  type GoalSeekTargetKey,
  type GoalSeekVariableKey,
} from "../shared/financial/goalseek";
import {
  calculateFinancialProjection,
  FinanceDecimal,
  type FinancialProjectionOptions,
} from "../shared/financial/engine";
import { simulateCaptadorChange } from "../shared/financial/meetingSimulator";
import {
  calculateCommercialCapacity,
  calculateWorkforceEconomics,
} from "../shared/financial/operationsEconomics";
import { deriveCostCatalogCashflowAdjustments, summarizeCostCatalog, type CostCashflowTreatment } from "../shared/financial/costCatalog";
import {
  evaluateProductInventory,
  type ProductSkuInput,
} from "../shared/financial/productInventory";
import {
  reconcileCommercialCondition,
  type CommercialConditionInput,
} from "../shared/financial/commercialCondition";
import { resolveAuthoritativeCommercialModel } from "../shared/financial/authoritativeCommercialModel";
import {
  calculatePointEconomics,
  type PointEconomicsInput,
  type PointEconomicsPortfolio,
} from "../shared/financial/pointEconomics";
import {
  calculateCommercialOperations,
  type CommercialOperationsDefinition,
  type CommercialOperationsResult,
} from "../shared/financial/commercialOperations";
import {
  assertReceivablesPolicy,
  type ReceivablesPolicy,
} from "../shared/financial/receivablesPortfolio";
import { assertExportEligibility } from "./financial/exportEligibility";
import {
  buildBoardroomPdf,
  buildBoardroomPptx,
  buildBoardroomXlsx,
  createExportableSnapshot,
  createScenarioComparisonPayload,
  type ExportPackScenarioComparisonEntry,
} from "./financial/export";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";
import {
  FINANCIAL_INPUT_KEYS,
  type FinancialCalculation,
  type FinancialInputKey,
  type FinancialInputSnapshot,
} from "../shared/financial/types";
import { buildCotiaFinancialMappings } from "../shared/financial/cotiaFinancialAdapter";
import { buildCotiaAuthoritativePayload } from "../shared/financial/cotiaAuthoritativeAdapter";

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

type TgrTransaction = MySqlTransaction<
  MySql2QueryResultHKT,
  MySql2PreparedQueryHKT,
  Record<string, unknown>
>;

async function bumpFinancialRevision(
  transaction: TgrTransaction,
  versionId: string,
  conflictMessage: string
) {
  const result = await transaction
    .update(projectVersions)
    .set({
      financialRevision: sql`${projectVersions.financialRevision} + 1`,
    })
    .where(
      and(
        eq(projectVersions.id, versionId),
        eq(projectVersions.state, "draft"),
        eq(projectVersions.isImmutable, false)
      )
    );
  if (result[0].affectedRows !== 1) throw new Error(conflictMessage);
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
  await db.transaction(async transaction => {
    await transaction
      .insert(formulaSetVersions)
      .values({
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
      })
      .onDuplicateKeyUpdate({
        set: { id: IGR_CORE_FORMULA_SET_V1.id },
      });
    await transaction
      .insert(formulaDefinitionProvenance)
      .values(
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
      )
      .onDuplicateKeyUpdate({
        set: { formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id },
      });
  });
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
  const snapshotOrder =
    versionIds.length === 0
      ? []
      : await db
          .select({ id: calculationSnapshots.id })
          .from(calculationSnapshots)
          .where(inArray(calculationSnapshots.projectVersionId, versionIds))
          .orderBy(desc(calculationSnapshots.createdOrdinal))
          .limit(8);
  const snapshotRows = snapshotOrder.length
    ? await db
        .select()
        .from(calculationSnapshots)
        .where(inArray(calculationSnapshots.id, snapshotOrder.map(row => row.id)))
    : [];
  const snapshotsById = new Map(snapshotRows.map(snapshot => [snapshot.id, snapshot]));
  const snapshots = snapshotOrder.flatMap(row => {
    const snapshot = snapshotsById.get(row.id);
    return snapshot ? [snapshot] : [];
  });
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
        domainBlockers?: string[];
        domainInvalidities?: string[];
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
      domainBlockers: payload.domainBlockers ?? [],
      domainInvalidities: payload.domainInvalidities ?? [],
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
  const snapshotMetadata =
    versionIds.length === 0
      ? []
      : await db
          .select({
            id: calculationSnapshots.id,
            projectVersionId: calculationSnapshots.projectVersionId,
            createdOrdinal: calculationSnapshots.createdOrdinal,
          })
          .from(calculationSnapshots)
          .where(
            and(
              inArray(calculationSnapshots.projectVersionId, versionIds),
              eq(calculationSnapshots.calculationStatus, "valid")
            )
          )
          .orderBy(desc(calculationSnapshots.createdOrdinal));
  const latestSnapshotIdByVersion = new Map<string, string>();
  for (const snapshot of snapshotMetadata) {
    if (!latestSnapshotIdByVersion.has(snapshot.projectVersionId))
      latestSnapshotIdByVersion.set(snapshot.projectVersionId, snapshot.id);
  }
  const latestSnapshotIds = Array.from(latestSnapshotIdByVersion.values());
  const snapshots = latestSnapshotIds.length
    ? await db
        .select()
        .from(calculationSnapshots)
        .where(inArray(calculationSnapshots.id, latestSnapshotIds))
    : [];
  const latestSnapshotByVersion = new Map(
    snapshots.map(snapshot => [snapshot.projectVersionId, snapshot])
  );
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

export type PersistedProductSkuInput = ProductSkuInput & {
  status: "provided" | "pending";
  sourceType: ProvenanceSourceType;
  sourceRef?: string;
};

export type PersistedCommercialConditionInput = {
  productSkuCode?: string;
  status: "provided" | "pending";
  sourceType: ProvenanceSourceType;
  sourceRef?: string;
  condition: CommercialConditionInput;
};

const COTIA_SKU_CODE = "produto-principal";
const COTIA_CONDITION_CODE = "condicao-base-cotia";

type CotiaAssemblyRegistration = {
  tenantId: number;
  actorId: number;
  versionId: string;
  name: string;
  payload: Record<string, string>;
  sourceRef?: string;
};

function prepareCotiaAssembly(params: CotiaAssemblyRegistration) {
  const sourceRef = params.sourceRef?.trim() ?? "";
  const authoritative = buildCotiaAuthoritativePayload(params.payload, sourceRef);
  const mappings = sourceRef.length >= 2
    ? buildCotiaFinancialMappings(params.payload)
    : [];
  const incomingSku = authoritative.commercialModel?.skus.find(
    sku => sku.id === COTIA_SKU_CODE
  );
  const incomingCondition = authoritative.commercialModel?.conditions.find(
    item => item.condition.id === COTIA_CONDITION_CODE
  );
  if (authoritative.commercialModel && (!incomingSku || !incomingCondition)) {
    throw new Error("A Página 1 não produziu o produto e a condição Cotia esperados.");
  }
  if (incomingSku) {
    const evaluation = evaluateProductInventory({
      asOfMonth: authoritative.commercialModel!.asOfMonth,
      skus: [incomingSku],
    });
    if (evaluation.status === "invalid") {
      throw new Error(
        `Catálogo Cotia inválido: ${evaluation.violations.map(item => item.code).join(", ")}.`
      );
    }
  }
  let commercialConditionStatus: "provided" | "pending" = "provided";
  const warnings: string[] = [];
  if (incomingCondition) {
    const reconciliation = reconcileCommercialCondition(incomingCondition.condition);
    const indexedSchedulePending = reconciliation.violations.some(
      item => item.code === "INDEXED_PAYMENT_SCHEDULE_REQUIRED"
    );
    const blockingAssemblyViolations = reconciliation.violations.filter(
      item => item.code !== "INDEXED_PAYMENT_SCHEDULE_REQUIRED"
    );
    if (blockingAssemblyViolations.length) {
      throw new Error(
        `Condição comercial Cotia inválida: ${blockingAssemblyViolations.map(item => item.code).join(", ")}.`
      );
    }
    if (indexedSchedulePending) {
      commercialConditionStatus = "pending";
      warnings.push(
        "Correção ou juros informados exigem calendário financeiro indexado; condição mantida PENDENTE até configuração."
      );
    }
  }
  if (authoritative.receivablesPolicy) {
    assertReceivablesPolicy(authoritative.receivablesPolicy.policy);
  }
  return {
    sourceRef,
    authoritative,
    mappings,
    incomingSku,
    incomingCondition,
    commercialConditionStatus,
    warnings,
  };
}

export async function registerCotiaAssemblyForTenant(params: CotiaAssemblyRegistration) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  const prepared = prepareCotiaAssembly(params);

  return db.transaction(async transaction => {
    await transaction.execute(
      sql`SELECT ${projectVersions.id} FROM ${projectVersions} WHERE ${projectVersions.id} = ${version.id} FOR UPDATE`
    );
    const lockedVersions = await transaction
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.id, version.id))
      .limit(1);
    const lockedVersion = lockedVersions[0];
    if (!lockedVersion || lockedVersion.isImmutable || lockedVersion.state !== "draft") {
      throw new Error("A Página 1 só aceita edição na versão de trabalho.");
    }
    return persistCotiaAssemblyInTransaction({
      transaction,
      params,
      version: lockedVersion,
      prepared,
    });
  });
}

async function persistCotiaAssemblyInTransaction({
  transaction,
  params,
  version,
  prepared,
}: {
  transaction: TgrTransaction;
  params: CotiaAssemblyRegistration;
  version: {
    id: string;
    projectId: string;
    inputHash: string;
  };
  prepared: ReturnType<typeof prepareCotiaAssembly>;
}) {
    const {
      sourceRef,
      authoritative,
      mappings,
      incomingSku,
      incomingCondition,
      commercialConditionStatus,
      warnings,
    } = prepared;
    const beforeInputsRows = await transaction
      .select()
      .from(inputValues)
      .where(eq(inputValues.versionId, version.id));
    const beforeInputsByKey = new Map(beforeInputsRows.map(row => [row.key, row]));
    const nextInputs = Object.fromEntries(
      FINANCIAL_INPUT_KEYS.map(key => {
        const row = beforeInputsByKey.get(key);
        return [key, row
          ? {
              status: row.status,
              value: row.valueText ?? undefined,
              sourceType: row.sourceType,
              sourceRef: row.sourceRef ?? undefined,
            }
          : { status: "pending" as const, sourceType: "current_decision" as const }];
      })
    ) as FinancialInputSnapshot;
    const changedInputKeys: FinancialInputKey[] = [];
    for (const mapping of mappings) {
      const nextValue = {
        status: "provided" as const,
        value: mapping.value,
        sourceType: "current_decision" as const,
        sourceRef: `montagem: ${sourceRef}`,
      };
      if (stableSerialize(nextInputs[mapping.inputKey]) !== stableSerialize(nextValue)) {
        changedInputKeys.push(mapping.inputKey);
      }
      nextInputs[mapping.inputKey] = nextValue;
    }
    for (const key of FINANCIAL_INPUT_KEYS) {
      const input = nextInputs[key];
      await transaction
        .insert(inputValues)
        .values({
          id: beforeInputsByKey.get(key)?.id ?? nanoid(),
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

    const beforeComponents = await transaction
      .select()
      .from(projectComponentRecords)
      .where(
        and(
          eq(projectComponentRecords.versionId, version.id),
          eq(projectComponentRecords.componentType, "project_assembly")
        )
      )
      .limit(1);
    const assemblyRecord = {
      id: beforeComponents[0]?.id ?? nanoid(),
      versionId: version.id,
      componentType: "project_assembly" as const,
      name: params.name.trim(),
      status: authoritative.completion.status,
      payload: {
        ...Object.fromEntries(
          Object.entries(params.payload).map(([key, value]) => [
            key,
            value.trim() || "PENDENTE",
          ])
        ),
        derivedEconomics: null,
      },
      sourceType: "current_decision" as const,
      sourceRef: sourceRef || null,
      updatedBy: params.actorId,
    };
    await transaction
      .insert(projectComponentRecords)
      .values(assemblyRecord)
      .onDuplicateKeyUpdate({
        set: {
          name: assemblyRecord.name,
          status: assemblyRecord.status,
          payload: assemblyRecord.payload,
          sourceType: assemblyRecord.sourceType,
          sourceRef: assemblyRecord.sourceRef,
          updatedBy: assemblyRecord.updatedBy,
        },
      });

    const beforeSkus = await transaction
      .select()
      .from(productSkus)
      .where(eq(productSkus.versionId, version.id));
    const beforeConditions = await transaction
      .select()
      .from(commercialConditions)
      .where(eq(commercialConditions.versionId, version.id));
    let commercialModelUpdated = false;
    if (incomingSku && incomingCondition) {
      commercialModelUpdated = true;
      const beforeSku = beforeSkus.find(row => row.skuCode === COTIA_SKU_CODE);
      const skuId = beforeSku?.id ?? nanoid();
      const skuRecord = {
        id: skuId,
        versionId: version.id,
        skuCode: incomingSku.id,
        name: incomingSku.name,
        unitType: incomingSku.unitType,
        unitQuantity: incomingSku.unitQuantity,
        sharesPerUnit: incomingSku.sharesPerUnit,
        grossSoldShares: incomingSku.grossSoldShares,
        returnedShares: incomingSku.returnedShares,
        blockedShares: incomingSku.blockedShares,
        status: incomingSku.status,
        sourceType: incomingSku.sourceType,
        sourceRef: incomingSku.sourceRef ?? null,
        updatedBy: params.actorId,
      };
      await transaction
        .insert(productSkus)
        .values(skuRecord)
        .onDuplicateKeyUpdate({
          set: {
            name: skuRecord.name,
            unitType: skuRecord.unitType,
            unitQuantity: skuRecord.unitQuantity,
            sharesPerUnit: skuRecord.sharesPerUnit,
            grossSoldShares: skuRecord.grossSoldShares,
            returnedShares: skuRecord.returnedShares,
            blockedShares: skuRecord.blockedShares,
            status: skuRecord.status,
            sourceType: skuRecord.sourceType,
            sourceRef: skuRecord.sourceRef,
            updatedBy: skuRecord.updatedBy,
          },
        });
      const beforePhases = beforeSku
        ? await transaction
            .select()
            .from(productPricePhases)
            .where(eq(productPricePhases.productSkuId, beforeSku.id))
        : [];
      const incomingBasePhase = incomingSku.pricePhases.find(phase => phase.startsAtMonth === 0)!;
      const beforeBasePhase = beforePhases.find(phase => phase.startsAtMonth === 0);
      const basePhaseRecord = {
        id: beforeBasePhase?.id ?? nanoid(),
        productSkuId: skuId,
        phaseCode: beforeBasePhase?.phaseCode ?? incomingBasePhase.id,
        name: beforeBasePhase?.name ?? incomingBasePhase.id,
        startsAtMonth: 0,
        priceText: incomingBasePhase.price,
        promotionalPriceText: beforeBasePhase?.promotionalPriceText ?? null,
      };
      await transaction
        .insert(productPricePhases)
        .values(basePhaseRecord)
        .onDuplicateKeyUpdate({
          set: {
            priceText: basePhaseRecord.priceText,
            promotionalPriceText: basePhaseRecord.promotionalPriceText,
          },
        });

      const condition = incomingCondition.condition;
      const beforeCondition = beforeConditions.find(
        row => row.conditionCode === COTIA_CONDITION_CODE
      );
      const conditionRecord = {
        id: beforeCondition?.id ?? nanoid(),
        versionId: version.id,
        productSkuId: skuId,
        conditionCode: condition.id,
        name: condition.name,
        listPriceText: condition.listPrice,
        discountText: condition.discount,
        entryTotalText: condition.entry.total,
        entryInstallments: condition.entry.installments,
        entryFirstDueMonth: condition.entry.firstDueMonth,
        balancePrincipalText: condition.balance.principal,
        balanceInstallments: condition.balance.installments,
        graceMonths: condition.balance.graceMonths,
        balanceFirstDueMonth: condition.balance.firstDueMonth,
        explicitChargesText: condition.explicitCharges,
        explicitChargesDueMonth: null,
        correctionRateText: condition.correctionRate ?? null,
        interestRateText: condition.interestRate ?? null,
        materialityToleranceText: condition.materialityTolerance,
        campaign: null,
        status: commercialConditionStatus,
        sourceType: incomingCondition.sourceType,
        sourceRef: incomingCondition.sourceRef ?? null,
        updatedBy: params.actorId,
      };
      await transaction
        .insert(commercialConditions)
        .values(conditionRecord)
        .onDuplicateKeyUpdate({
          set: {
            productSkuId: conditionRecord.productSkuId,
            name: conditionRecord.name,
            listPriceText: conditionRecord.listPriceText,
            discountText: conditionRecord.discountText,
            entryTotalText: conditionRecord.entryTotalText,
            entryInstallments: conditionRecord.entryInstallments,
            entryFirstDueMonth: conditionRecord.entryFirstDueMonth,
            balancePrincipalText: conditionRecord.balancePrincipalText,
            balanceInstallments: conditionRecord.balanceInstallments,
            graceMonths: conditionRecord.graceMonths,
            balanceFirstDueMonth: conditionRecord.balanceFirstDueMonth,
            explicitChargesText: conditionRecord.explicitChargesText,
            explicitChargesDueMonth: conditionRecord.explicitChargesDueMonth,
            correctionRateText: conditionRecord.correctionRateText,
            interestRateText: conditionRecord.interestRateText,
            materialityToleranceText: conditionRecord.materialityToleranceText,
            campaign: conditionRecord.campaign,
            status: conditionRecord.status,
            sourceType: conditionRecord.sourceType,
            sourceRef: conditionRecord.sourceRef,
            updatedBy: conditionRecord.updatedBy,
          },
        });
    }

    const beforePolicies = await transaction
      .select()
      .from(receivablesPolicies)
      .where(eq(receivablesPolicies.versionId, version.id))
      .limit(1);
    const policyPayload = authoritative.receivablesPolicy;
    if (policyPayload) {
      const policy = policyPayload.policy;
      const policyRecord = {
        id: beforePolicies[0]?.id ?? nanoid(),
        versionId: version.id,
        cancellationD7Text: policy.cancellationCurve.d7,
        cancellationD30Text: policy.cancellationCurve.d30,
        cancellationD60Text: policy.cancellationCurve.d60,
        cancellationD90Text: policy.cancellationCurve.d90,
        cancellationD180Text: policy.cancellationCurve.d180,
        cancellationLifetimeText: policy.cancellationCurve.lifetime,
        delinquencyRateText: policy.delinquencyRate,
        cureDays1To30Text: policy.cureRates.days1To30,
        cureDays31To60Text: policy.cureRates.days31To60,
        cureDays61To90Text: policy.cureRates.days61To90,
        cureDays90PlusText: policy.cureRates.days90Plus,
        writeOffAfterDays: policy.writeOffAfterDays,
        policyVersion: policy.policyVersion,
        status: policyPayload.status,
        sourceType: policyPayload.sourceType,
        sourceRef: sourceRef,
        updatedBy: params.actorId,
      };
      await transaction
        .insert(receivablesPolicies)
        .values(policyRecord)
        .onDuplicateKeyUpdate({
          set: {
            cancellationD7Text: policyRecord.cancellationD7Text,
            cancellationD30Text: policyRecord.cancellationD30Text,
            cancellationD60Text: policyRecord.cancellationD60Text,
            cancellationD90Text: policyRecord.cancellationD90Text,
            cancellationD180Text: policyRecord.cancellationD180Text,
            cancellationLifetimeText: policyRecord.cancellationLifetimeText,
            delinquencyRateText: policyRecord.delinquencyRateText,
            cureDays1To30Text: policyRecord.cureDays1To30Text,
            cureDays31To60Text: policyRecord.cureDays31To60Text,
            cureDays61To90Text: policyRecord.cureDays61To90Text,
            cureDays90PlusText: policyRecord.cureDays90PlusText,
            writeOffAfterDays: policyRecord.writeOffAfterDays,
            policyVersion: policyRecord.policyVersion,
            status: policyRecord.status,
            sourceType: policyRecord.sourceType,
            sourceRef: policyRecord.sourceRef,
            updatedBy: policyRecord.updatedBy,
          },
        });
    }

    const inputHash = sha256(nextInputs);
    const versionUpdate = await transaction
      .update(projectVersions)
      .set({
        inputHash,
        financialRevision: sql`${projectVersions.financialRevision} + 1`,
      })
      .where(
        and(
          eq(projectVersions.id, version.id),
          eq(projectVersions.state, "draft"),
          eq(projectVersions.isImmutable, false)
        )
      );
    if (versionUpdate[0].affectedRows !== 1) {
      throw new Error("A versão mudou durante a reconciliação da Página 1.");
    }
    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "project_version",
      entityId: version.id,
      action: "cotia_assembly.registered",
      actorId: params.actorId,
      beforeHash: sha256({
        inputHash: version.inputHash,
        assembly: beforeComponents[0] ?? null,
        sku: beforeSkus.find(row => row.skuCode === COTIA_SKU_CODE) ?? null,
        condition: beforeConditions.find(row => row.conditionCode === COTIA_CONDITION_CODE) ?? null,
        policy: beforePolicies[0] ?? null,
      }),
      afterHash: sha256({
        inputHash,
        assembly: assemblyRecord,
        commercialModel: authoritative.commercialModel ?? null,
        policy: policyPayload ?? null,
      }),
      metadata: {
        versionId: version.id,
        status: authoritative.completion.status,
        changedInputKeys,
        commercialModelUpdated,
        policyUpdated: Boolean(policyPayload),
        commercialConditionStatus,
        warnings,
      },
    });
    return {
      versionId: version.id,
      status: authoritative.completion.status,
      inputHash,
      changedInputKeys,
      commercialModelUpdated,
      policyUpdated: Boolean(policyPayload),
      commercialConditionStatus,
      warnings,
    };
}

export async function createProjectFromCotiaAssemblyForTenant(params: {
  tenantId: number;
  actorId: number;
  name: string;
  assemblyName: string;
  payload: Record<string, string>;
  sourceRef?: string;
}) {
  const db = await requireDb();
  const projectId = nanoid();
  const versionId = nanoid();
  const registrationParams: CotiaAssemblyRegistration = {
    tenantId: params.tenantId,
    actorId: params.actorId,
    versionId,
    name: params.assemblyName,
    payload: params.payload,
    sourceRef: params.sourceRef,
  };
  const prepared = prepareCotiaAssembly(registrationParams);
  const formulaSetVersionId = await ensureCoreFormulaSet(params.actorId);
  const pendingInputs = Object.fromEntries(
    FINANCIAL_INPUT_KEYS.map(key => [
      key,
      { status: "pending" as const, sourceType: "current_decision" as const },
    ])
  ) as FinancialInputSnapshot;
  const initialInputHash = sha256(pendingInputs);

  const registration = await db.transaction(async transaction => {
    await transaction.insert(projects).values({
      id: projectId,
      tenantId: params.tenantId,
      name: params.name.trim(),
      createdBy: params.actorId,
    });
    await transaction.insert(projectVersions).values({
      id: versionId,
      projectId,
      formulaSetVersionId,
      kind: "working",
      state: "draft",
      isImmutable: false,
      inputHash: initialInputHash,
      createdBy: params.actorId,
    });
    const persisted = await persistCotiaAssemblyInTransaction({
      transaction,
      params: registrationParams,
      version: { id: versionId, projectId, inputHash: initialInputHash },
      prepared,
    });
    await transaction.insert(workflowEvents).values({
      id: nanoid(),
      projectId,
      versionId,
      fromState: null,
      toState: "draft",
      action: "version.created",
      rationale: "Projeto criado atomicamente a partir da Página 1 Cotia.",
      actorId: params.actorId,
    });
    return persisted;
  });
  return {
    projectId,
    formulaSetVersionId,
    ...registration,
  };
}

export type CapturePointDefinition = Omit<
  PointEconomicsInput,
  | "averageTicket"
  | "averageEntry"
  | "contributionMarginRate"
  | "healthyD90Rate"
>;

export type PersistedCapturePoint = {
  status: "provided" | "pending";
  sourceType: ProvenanceSourceType;
  sourceRef?: string;
  definition: CapturePointDefinition;
};

export type PersistedCommercialOperations = {
  status: "provided" | "pending";
  sourceType: ProvenanceSourceType;
  sourceRef?: string;
  definition: CommercialOperationsDefinition;
};

const COMMERCIAL_OPERATIONS_COMPONENT_TYPE = "commercial_operations" as const;
const COMMERCIAL_OPERATIONS_COMPONENT_NAME = "commercial-operations";

export async function getCommercialOperationsForTenant(
  versionId: string,
  tenantId: number
) {
  await getVersionForTenant(versionId, tenantId);
  const db = await requireDb();
  const rows = await db
    .select()
    .from(projectComponentRecords)
    .where(
      and(
        eq(projectComponentRecords.versionId, versionId),
        eq(
          projectComponentRecords.componentType,
          COMMERCIAL_OPERATIONS_COMPONENT_TYPE
        ),
        eq(
          projectComponentRecords.name,
          COMMERCIAL_OPERATIONS_COMPONENT_NAME
        )
      )
    )
    .limit(1);
  if (!rows[0]) return null;
  return {
    record: rows[0],
    definition: rows[0].payload as CommercialOperationsDefinition,
  };
}

export async function upsertCommercialOperationsForTenant(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  status: "provided" | "pending";
  sourceType: ProvenanceSourceType;
  sourceRef?: string;
  definition: CommercialOperationsDefinition;
}) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  if (version.isImmutable || version.state !== "draft") {
    throw new Error(
      "Operações comerciais só aceitam edição na versão de trabalho."
    );
  }
  if (params.status === "provided" && !params.sourceRef?.trim()) {
    throw new Error(
      "Operações comerciais informadas exigem fonte ou responsável."
    );
  }
  const before = await db
    .select()
    .from(projectComponentRecords)
    .where(
      and(
        eq(projectComponentRecords.versionId, version.id),
        eq(
          projectComponentRecords.componentType,
          COMMERCIAL_OPERATIONS_COMPONENT_TYPE
        ),
        eq(
          projectComponentRecords.name,
          COMMERCIAL_OPERATIONS_COMPONENT_NAME
        )
      )
    )
    .limit(1);
  const record = {
    id: before[0]?.id ?? nanoid(),
    versionId: version.id,
    componentType: COMMERCIAL_OPERATIONS_COMPONENT_TYPE,
    name: COMMERCIAL_OPERATIONS_COMPONENT_NAME,
    status: params.status,
    payload: params.definition,
    sourceType: params.sourceType,
    sourceRef: params.sourceRef?.trim() || null,
    updatedBy: params.actorId,
  };
  await db.transaction(async transaction => {
    await transaction
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
    await bumpFinancialRevision(
      transaction,
      version.id,
      "A versão mudou durante a gravação das operações comerciais."
    );
    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "project_component",
      entityId: record.id,
      action: "commercial_operations.upserted",
      actorId: params.actorId,
      beforeHash: before[0] ? sha256(before[0]) : null,
      afterHash: sha256(record),
      metadata: {
        versionId: version.id,
        status: params.status,
      },
    });
  });
  return getCommercialOperationsForTenant(version.id, params.tenantId);
}

function capturePointFromRow(
  row: typeof projectComponentRecords.$inferSelect
): PersistedCapturePoint {
  return {
    status: row.status,
    sourceType: row.sourceType,
    sourceRef: row.sourceRef ?? undefined,
    definition: row.payload as CapturePointDefinition,
  };
}

export async function getCapturePointsForTenant(
  versionId: string,
  tenantId: number
) {
  await getVersionForTenant(versionId, tenantId);
  const db = await requireDb();
  const rows = await db
    .select()
    .from(projectComponentRecords)
    .where(
      and(
        eq(projectComponentRecords.versionId, versionId),
        eq(projectComponentRecords.componentType, "acquisition_capacity")
      )
    )
    .orderBy(projectComponentRecords.name);
  return rows.map(row => ({ record: row, ...capturePointFromRow(row) }));
}

export async function replaceCapturePointsForTenant(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  points: PersistedCapturePoint[];
}) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  if (version.isImmutable || version.state !== "draft") {
    throw new Error(
      "Pontos de captação só aceitam edição na versão de trabalho."
    );
  }
  const pointIds = new Set<string>();
  for (const item of params.points) {
    const pointId = item.definition.pointId.trim();
    if (!pointId) throw new Error("pointId é obrigatório.");
    if (pointIds.has(pointId)) throw new Error(`pointId duplicado: ${pointId}.`);
    pointIds.add(pointId);
    if (item.status === "provided" && !item.sourceRef?.trim()) {
      throw new Error(
        `Ponto informado exige fonte ou responsável: ${pointId}.`
      );
    }
  }

  const records = params.points.map(item => ({
    id: nanoid(),
    versionId: version.id,
    componentType: "acquisition_capacity" as const,
    name: item.definition.pointId.trim(),
    status: item.status,
    payload: { ...item.definition, pointId: item.definition.pointId.trim() },
    sourceType: item.sourceType,
    sourceRef: item.sourceRef?.trim() || null,
    updatedBy: params.actorId,
  }));
  await db.transaction(async transaction => {
    const before = await transaction
      .select()
      .from(projectComponentRecords)
      .where(
        and(
          eq(projectComponentRecords.versionId, version.id),
          eq(projectComponentRecords.componentType, "acquisition_capacity")
        )
      );
    await transaction
      .delete(projectComponentRecords)
      .where(
        and(
          eq(projectComponentRecords.versionId, version.id),
          eq(projectComponentRecords.componentType, "acquisition_capacity")
        )
      );
    if (records.length)
      await transaction.insert(projectComponentRecords).values(records);
    await bumpFinancialRevision(
      transaction,
      version.id,
      "A versão mudou durante a gravação dos pontos de captação."
    );
    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "project_component_collection",
      entityId: version.id,
      action: "capture_points.replaced",
      actorId: params.actorId,
      beforeHash: sha256(before),
      afterHash: sha256(records),
      metadata: {
        versionId: version.id,
        pointIds: records.map(record => record.name),
        count: records.length,
      },
    });
  });
  return getCapturePointsForTenant(version.id, params.tenantId);
}

export async function getProductCatalogForTenant(
  versionId: string,
  tenantId: number,
  asOfMonth: number
) {
  await getVersionForTenant(versionId, tenantId);
  const db = await requireDb();
  const skuRows = await db
    .select()
    .from(productSkus)
    .where(eq(productSkus.versionId, versionId))
    .orderBy(productSkus.skuCode);
  const phaseRows = skuRows.length
    ? await db
        .select()
        .from(productPricePhases)
        .where(
          inArray(
            productPricePhases.productSkuId,
            skuRows.map(row => row.id)
          )
        )
        .orderBy(productPricePhases.startsAtMonth)
    : [];
  const phasesBySku = new Map<string, typeof phaseRows>();
  for (const phase of phaseRows) {
    const phases = phasesBySku.get(phase.productSkuId) ?? [];
    phases.push(phase);
    phasesBySku.set(phase.productSkuId, phases);
  }
  const skus = skuRows.map(row => ({
    id: row.skuCode,
    name: row.name,
    unitType: row.unitType,
    unitQuantity: row.unitQuantity,
    sharesPerUnit: row.sharesPerUnit,
    grossSoldShares: row.grossSoldShares,
    returnedShares: row.returnedShares,
    blockedShares: row.blockedShares,
    pricePhases: (phasesBySku.get(row.id) ?? []).map(phase => ({
      id: phase.phaseCode,
      startsAtMonth: phase.startsAtMonth,
      price: phase.promotionalPriceText ?? phase.priceText,
    })),
  }));
  return {
    records: skuRows.map(row => ({
      ...row,
      pricePhases: phasesBySku.get(row.id) ?? [],
    })),
    evaluation: evaluateProductInventory({ asOfMonth, skus }),
  };
}

export async function replaceProductCatalogForTenant(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  asOfMonth: number;
  skus: PersistedProductSkuInput[];
}) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  if (version.isImmutable || version.state !== "draft")
    throw new Error(
      "Catálogo de produto só aceita edição na versão de trabalho."
    );
  for (const sku of params.skus) {
    if (sku.status === "provided" && !sku.sourceRef?.trim())
      throw new Error(`SKU informado exige fonte ou responsável: ${sku.id}.`);
  }
  const evaluation = evaluateProductInventory({
    asOfMonth: params.asOfMonth,
    skus: params.skus,
  });
  if (evaluation.status === "invalid")
    throw new Error(
      `Catálogo de produto inválido: ${evaluation.violations
        .map(violation => violation.code)
        .join(", ")}.`
    );

  await db.transaction(async transaction => {
    const beforeSkus = await transaction
      .select()
      .from(productSkus)
      .where(eq(productSkus.versionId, version.id));
    const beforeSkuCodeById = new Map(
      beforeSkus.map(row => [row.id, row.skuCode])
    );
    const linkedConditions = beforeSkus.length
      ? await transaction
          .select({
            id: commercialConditions.id,
            productSkuId: commercialConditions.productSkuId,
          })
          .from(commercialConditions)
          .where(
            and(
              eq(commercialConditions.versionId, version.id),
              inArray(
                commercialConditions.productSkuId,
                beforeSkus.map(row => row.id)
              )
            )
          )
      : [];
    const incomingSkuCodes = new Set(params.skus.map(sku => sku.id));
    const removedLinkedSkuCodes = linkedConditions.flatMap(condition => {
      const skuCode = condition.productSkuId
        ? beforeSkuCodeById.get(condition.productSkuId)
        : undefined;
      return skuCode && !incomingSkuCodes.has(skuCode) ? [skuCode] : [];
    });
    if (removedLinkedSkuCodes.length) {
      throw new Error(
        `SKU vinculado a condição comercial não pode ser removido: ${[
          ...Array.from(new Set(removedLinkedSkuCodes)),
        ].join(", ")}.`
      );
    }
    if (beforeSkus.length) {
      await transaction.delete(productPricePhases).where(
        inArray(
          productPricePhases.productSkuId,
          beforeSkus.map(row => row.id)
        )
      );
      await transaction
        .delete(productSkus)
        .where(eq(productSkus.versionId, version.id));
    }

    const insertedSkus = params.skus.map(sku => ({
      id: nanoid(),
      versionId: version.id,
      skuCode: sku.id,
      name: sku.name,
      unitType: sku.unitType,
      unitQuantity: sku.unitQuantity,
      sharesPerUnit: sku.sharesPerUnit,
      grossSoldShares: sku.grossSoldShares,
      returnedShares: sku.returnedShares,
      blockedShares: sku.blockedShares,
      status: sku.status,
      sourceType: sku.sourceType,
      sourceRef: sku.sourceRef ?? null,
      updatedBy: params.actorId,
    }));
    if (insertedSkus.length) {
      await transaction.insert(productSkus).values(insertedSkus);
      const phases = params.skus.flatMap((sku, skuIndex) =>
        sku.pricePhases.map(phase => ({
          id: nanoid(),
          productSkuId: insertedSkus[skuIndex]!.id,
          phaseCode: phase.id,
          name: phase.id,
          startsAtMonth: phase.startsAtMonth,
          priceText: phase.price,
          promotionalPriceText: null,
        }))
      );
      if (phases.length)
        await transaction.insert(productPricePhases).values(phases);
    }

    const insertedSkuIdByCode = new Map(
      insertedSkus.map(row => [row.skuCode, row.id])
    );
    for (const condition of linkedConditions) {
      const oldCode = condition.productSkuId
        ? beforeSkuCodeById.get(condition.productSkuId)
        : undefined;
      const replacementId = oldCode
        ? insertedSkuIdByCode.get(oldCode)
        : undefined;
      if (replacementId)
        await transaction
          .update(commercialConditions)
          .set({ productSkuId: replacementId })
          .where(eq(commercialConditions.id, condition.id));
    }
    await bumpFinancialRevision(
      transaction,
      version.id,
      "A versão mudou durante a gravação do catálogo de produto."
    );
    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "product_catalog",
      entityId: version.id,
      action: "product_catalog.replaced",
      actorId: params.actorId,
      beforeHash: beforeSkus.length ? sha256(beforeSkus) : null,
      afterHash: sha256(params.skus),
      metadata: {
        versionId: version.id,
        skuCount: insertedSkus.length,
        asOfMonth: params.asOfMonth,
      },
    });
  });
  return getProductCatalogForTenant(
    version.id,
    params.tenantId,
    params.asOfMonth
  );
}

function commercialConditionFromRow(
  row: typeof commercialConditions.$inferSelect
) {
  return {
    id: row.conditionCode,
    name: row.name,
    listPrice: row.listPriceText,
    discount: row.discountText,
    entry: {
      total: row.entryTotalText,
      installments: row.entryInstallments,
      firstDueMonth: row.entryFirstDueMonth,
    },
    balance: {
      principal: row.balancePrincipalText,
      installments: row.balanceInstallments,
      graceMonths: row.graceMonths,
      firstDueMonth: row.balanceFirstDueMonth,
    },
    explicitCharges: row.explicitChargesText,
    explicitChargesDueMonth: row.explicitChargesDueMonth ?? undefined,
    correctionRate: row.correctionRateText ?? undefined,
    interestRate: row.interestRateText ?? undefined,
    materialityTolerance: row.materialityToleranceText,
    campaign: row.campaign ?? undefined,
  } satisfies CommercialConditionInput;
}

export async function listCommercialConditionsForTenant(
  versionId: string,
  tenantId: number
) {
  await getVersionForTenant(versionId, tenantId);
  const db = await requireDb();
  const rows = await db
    .select()
    .from(commercialConditions)
    .where(eq(commercialConditions.versionId, versionId))
    .orderBy(commercialConditions.conditionCode);
  const skuRows = await db
    .select({ id: productSkus.id, skuCode: productSkus.skuCode })
    .from(productSkus)
    .where(eq(productSkus.versionId, versionId));
  const skuCodeById = new Map(skuRows.map(row => [row.id, row.skuCode]));
  return rows.map(row => {
    const condition = commercialConditionFromRow(row);
    return {
      record: row,
      condition,
      productSkuCode: row.productSkuId
        ? (skuCodeById.get(row.productSkuId) ?? null)
        : null,
      reconciliation: reconcileCommercialCondition(condition),
    };
  });
}

function receivablesPolicyFromRow(
  row: typeof receivablesPolicies.$inferSelect
): ReceivablesPolicy {
  return {
    cancellationCurve: {
      d7: row.cancellationD7Text,
      d30: row.cancellationD30Text,
      d60: row.cancellationD60Text,
      d90: row.cancellationD90Text,
      d180: row.cancellationD180Text,
      lifetime: row.cancellationLifetimeText,
    },
    delinquencyRate: row.delinquencyRateText,
    cureRates: {
      days1To30: row.cureDays1To30Text,
      days31To60: row.cureDays31To60Text,
      days61To90: row.cureDays61To90Text,
      days90Plus: row.cureDays90PlusText,
    },
    writeOffAfterDays: row.writeOffAfterDays,
    policyVersion: row.policyVersion,
    sourceRef: row.sourceRef ?? "",
  };
}

export async function getReceivablesPolicyForTenant(
  versionId: string,
  tenantId: number
) {
  await getVersionForTenant(versionId, tenantId);
  const db = await requireDb();
  const rows = await db
    .select()
    .from(receivablesPolicies)
    .where(eq(receivablesPolicies.versionId, versionId))
    .limit(1);
  if (!rows[0]) return null;
  return { record: rows[0], policy: receivablesPolicyFromRow(rows[0]) };
}

export async function upsertReceivablesPolicyForTenant(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  status: "provided" | "pending";
  sourceType: ProvenanceSourceType;
  sourceRef?: string;
  policy: ReceivablesPolicy;
}) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  if (version.isImmutable || version.state !== "draft") {
    throw new Error(
      "A política de carteira só aceita edição na versão de trabalho."
    );
  }
  if (params.status === "provided" && !params.sourceRef?.trim()) {
    throw new Error("Política de carteira informada exige fonte ou responsável.");
  }
  assertReceivablesPolicy({
    ...params.policy,
    sourceRef: params.sourceRef?.trim() || params.policy.sourceRef.trim() || "pending",
  });

  const before = await db
    .select()
    .from(receivablesPolicies)
    .where(eq(receivablesPolicies.versionId, version.id))
    .limit(1);
  const record = {
    id: before[0]?.id ?? nanoid(),
    versionId: version.id,
    cancellationD7Text: params.policy.cancellationCurve.d7,
    cancellationD30Text: params.policy.cancellationCurve.d30,
    cancellationD60Text: params.policy.cancellationCurve.d60,
    cancellationD90Text: params.policy.cancellationCurve.d90,
    cancellationD180Text: params.policy.cancellationCurve.d180,
    cancellationLifetimeText: params.policy.cancellationCurve.lifetime,
    delinquencyRateText: params.policy.delinquencyRate,
    cureDays1To30Text: params.policy.cureRates.days1To30,
    cureDays31To60Text: params.policy.cureRates.days31To60,
    cureDays61To90Text: params.policy.cureRates.days61To90,
    cureDays90PlusText: params.policy.cureRates.days90Plus,
    writeOffAfterDays: params.policy.writeOffAfterDays,
    policyVersion: params.policy.policyVersion,
    status: params.status,
    sourceType: params.sourceType,
    sourceRef: params.sourceRef?.trim() || null,
    updatedBy: params.actorId,
  };
  await db.transaction(async transaction => {
    await transaction
      .insert(receivablesPolicies)
      .values(record)
      .onDuplicateKeyUpdate({
        set: {
          cancellationD7Text: record.cancellationD7Text,
          cancellationD30Text: record.cancellationD30Text,
          cancellationD60Text: record.cancellationD60Text,
          cancellationD90Text: record.cancellationD90Text,
          cancellationD180Text: record.cancellationD180Text,
          cancellationLifetimeText: record.cancellationLifetimeText,
          delinquencyRateText: record.delinquencyRateText,
          cureDays1To30Text: record.cureDays1To30Text,
          cureDays31To60Text: record.cureDays31To60Text,
          cureDays61To90Text: record.cureDays61To90Text,
          cureDays90PlusText: record.cureDays90PlusText,
          writeOffAfterDays: record.writeOffAfterDays,
          policyVersion: record.policyVersion,
          status: record.status,
          sourceType: record.sourceType,
          sourceRef: record.sourceRef,
          updatedBy: record.updatedBy,
        },
      });
    await bumpFinancialRevision(
      transaction,
      version.id,
      "A versão mudou durante a gravação da política de carteira."
    );
    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "receivables_policy",
      entityId: record.id,
      action: "receivables_policy.upserted",
      actorId: params.actorId,
      beforeHash: before[0] ? sha256(before[0]) : null,
      afterHash: sha256(record),
      metadata: {
        versionId: version.id,
        status: record.status,
        policyVersion: record.policyVersion,
      },
    });
  });
  return getReceivablesPolicyForTenant(version.id, params.tenantId);
}

export async function upsertCommercialConditionForTenant(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  productSkuCode?: string;
  status: "provided" | "pending";
  sourceType: ProvenanceSourceType;
  sourceRef?: string;
  condition: CommercialConditionInput;
}) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  if (version.isImmutable || version.state !== "draft")
    throw new Error(
      "Condição comercial só aceita edição na versão de trabalho."
    );
  if (params.status === "provided" && !params.sourceRef?.trim())
    throw new Error("Condição comercial informada exige fonte ou responsável.");
  const reconciliation = reconcileCommercialCondition(params.condition);
  if (params.status === "provided" && reconciliation.status === "invalid")
    throw new Error(
      `Condição comercial inválida: ${reconciliation.violations
        .map(violation => violation.code)
        .join(", ")}.`
    );
  const productSku = params.productSkuCode
    ? await db
        .select({ id: productSkus.id })
        .from(productSkus)
        .where(
          and(
            eq(productSkus.versionId, version.id),
            eq(productSkus.skuCode, params.productSkuCode)
          )
        )
        .limit(1)
    : [];
  if (params.productSkuCode && !productSku[0])
    throw new Error("SKU da condição comercial não encontrado nesta versão.");
  const before = await db
    .select()
    .from(commercialConditions)
    .where(
      and(
        eq(commercialConditions.versionId, version.id),
        eq(commercialConditions.conditionCode, params.condition.id)
      )
    )
    .limit(1);
  const record = {
    id: before[0]?.id ?? nanoid(),
    versionId: version.id,
    productSkuId: productSku[0]?.id ?? null,
    conditionCode: params.condition.id,
    name: params.condition.name,
    listPriceText: params.condition.listPrice,
    discountText: params.condition.discount,
    entryTotalText: params.condition.entry.total,
    entryInstallments: params.condition.entry.installments,
    entryFirstDueMonth: params.condition.entry.firstDueMonth,
    balancePrincipalText: params.condition.balance.principal,
    balanceInstallments: params.condition.balance.installments,
    graceMonths: params.condition.balance.graceMonths,
    balanceFirstDueMonth: params.condition.balance.firstDueMonth,
    explicitChargesText: params.condition.explicitCharges,
    explicitChargesDueMonth: params.condition.explicitChargesDueMonth ?? null,
    correctionRateText: params.condition.correctionRate ?? null,
    interestRateText: params.condition.interestRate ?? null,
    materialityToleranceText: params.condition.materialityTolerance,
    campaign: params.condition.campaign ?? null,
    status: params.status,
    sourceType: params.sourceType,
    sourceRef: params.sourceRef ?? null,
    updatedBy: params.actorId,
  };
  await db.transaction(async transaction => {
    await transaction
      .insert(commercialConditions)
      .values(record)
      .onDuplicateKeyUpdate({
        set: {
          productSkuId: record.productSkuId,
          name: record.name,
          listPriceText: record.listPriceText,
          discountText: record.discountText,
          entryTotalText: record.entryTotalText,
          entryInstallments: record.entryInstallments,
          entryFirstDueMonth: record.entryFirstDueMonth,
          balancePrincipalText: record.balancePrincipalText,
          balanceInstallments: record.balanceInstallments,
          graceMonths: record.graceMonths,
          balanceFirstDueMonth: record.balanceFirstDueMonth,
          explicitChargesText: record.explicitChargesText,
          explicitChargesDueMonth: record.explicitChargesDueMonth,
          correctionRateText: record.correctionRateText,
          interestRateText: record.interestRateText,
          materialityToleranceText: record.materialityToleranceText,
          campaign: record.campaign,
          status: record.status,
          sourceType: record.sourceType,
          sourceRef: record.sourceRef,
          updatedBy: record.updatedBy,
        },
      });
    await bumpFinancialRevision(
      transaction,
      version.id,
      "A versão mudou durante a gravação da condição comercial."
    );
    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "commercial_condition",
      entityId: record.id,
      action: "commercial_condition.upserted",
      actorId: params.actorId,
      beforeHash: before[0] ? sha256(before[0]) : null,
      afterHash: sha256(record),
      metadata: {
        versionId: version.id,
        conditionCode: record.conditionCode,
        productSkuCode: params.productSkuCode ?? null,
        reconciliationStatus: reconciliation.status,
      },
    });
  });
  return {
    record,
    condition: params.condition,
    productSkuCode: params.productSkuCode ?? null,
    reconciliation,
  };
}

export async function saveCommercialModelForTenant(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  asOfMonth: number;
  skus: PersistedProductSkuInput[];
  conditions: PersistedCommercialConditionInput[];
}) {
  const db = await requireDb();
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  if (version.isImmutable || version.state !== "draft")
    throw new Error(
      "Produto e condição comercial só aceitam edição na versão de trabalho."
    );

  for (const sku of params.skus) {
    if (sku.status === "provided" && !sku.sourceRef?.trim())
      throw new Error(`SKU informado exige fonte ou responsável: ${sku.id}.`);
  }
  const evaluation = evaluateProductInventory({
    asOfMonth: params.asOfMonth,
    skus: params.skus,
  });
  if (evaluation.status === "invalid")
    throw new Error(
      `Catálogo de produto inválido: ${evaluation.violations
        .map(violation => violation.code)
        .join(", ")}.`
    );

  const incomingSkuCodes = new Set(params.skus.map(sku => sku.id));
  const conditionCodes = new Set<string>();
  for (const item of params.conditions) {
    if (conditionCodes.has(item.condition.id))
      throw new Error(
        `Código de condição comercial duplicado: ${item.condition.id}.`
      );
    conditionCodes.add(item.condition.id);
    if (item.productSkuCode && !incomingSkuCodes.has(item.productSkuCode))
      throw new Error(
        `SKU da condição comercial não encontrado no catálogo recebido: ${item.productSkuCode}.`
      );
    if (item.status === "provided" && !item.sourceRef?.trim())
      throw new Error(
        `Condição comercial informada exige fonte ou responsável: ${item.condition.id}.`
      );
    const reconciliation = reconcileCommercialCondition(item.condition);
    if (item.status === "provided" && reconciliation.status === "invalid")
      throw new Error(
        `Condição comercial inválida: ${reconciliation.violations
          .map(violation => violation.code)
          .join(", ")}.`
      );
  }

  await db.transaction(async transaction => {
    const beforeSkus = await transaction
      .select()
      .from(productSkus)
      .where(eq(productSkus.versionId, version.id));
    const beforeConditions = await transaction
      .select()
      .from(commercialConditions)
      .where(eq(commercialConditions.versionId, version.id));
    const beforeSkuCodeById = new Map(
      beforeSkus.map(row => [row.id, row.skuCode])
    );
    const removedLinkedSkuCodes = beforeConditions.flatMap(condition => {
      const skuCode = condition.productSkuId
        ? beforeSkuCodeById.get(condition.productSkuId)
        : undefined;
      return skuCode && !incomingSkuCodes.has(skuCode) ? [skuCode] : [];
    });
    if (removedLinkedSkuCodes.length) {
      throw new Error(
        `SKU vinculado a condição comercial não pode ser removido ou renomeado: ${[
          ...Array.from(new Set(removedLinkedSkuCodes)),
        ].join(", ")}.`
      );
    }

    if (beforeConditions.length)
      await transaction
        .delete(commercialConditions)
        .where(eq(commercialConditions.versionId, version.id));
    if (beforeSkus.length) {
      await transaction.delete(productPricePhases).where(
        inArray(
          productPricePhases.productSkuId,
          beforeSkus.map(row => row.id)
        )
      );
      await transaction
        .delete(productSkus)
        .where(eq(productSkus.versionId, version.id));
    }

    const insertedSkus = params.skus.map(sku => ({
      id: nanoid(),
      versionId: version.id,
      skuCode: sku.id,
      name: sku.name,
      unitType: sku.unitType,
      unitQuantity: sku.unitQuantity,
      sharesPerUnit: sku.sharesPerUnit,
      grossSoldShares: sku.grossSoldShares,
      returnedShares: sku.returnedShares,
      blockedShares: sku.blockedShares,
      status: sku.status,
      sourceType: sku.sourceType,
      sourceRef: sku.sourceRef ?? null,
      updatedBy: params.actorId,
    }));
    if (insertedSkus.length) {
      await transaction.insert(productSkus).values(insertedSkus);
      const phases = params.skus.flatMap((sku, skuIndex) =>
        sku.pricePhases.map(phase => ({
          id: nanoid(),
          productSkuId: insertedSkus[skuIndex]!.id,
          phaseCode: phase.id,
          name: phase.id,
          startsAtMonth: phase.startsAtMonth,
          priceText: phase.price,
          promotionalPriceText: null,
        }))
      );
      if (phases.length)
        await transaction.insert(productPricePhases).values(phases);
    }

    const insertedSkuIdByCode = new Map(
      insertedSkus.map(row => [row.skuCode, row.id])
    );
    const insertedConditions = params.conditions.map(item => ({
      id: nanoid(),
      versionId: version.id,
      productSkuId: item.productSkuCode
        ? insertedSkuIdByCode.get(item.productSkuCode)!
        : null,
      conditionCode: item.condition.id,
      name: item.condition.name,
      listPriceText: item.condition.listPrice,
      discountText: item.condition.discount,
      entryTotalText: item.condition.entry.total,
      entryInstallments: item.condition.entry.installments,
      entryFirstDueMonth: item.condition.entry.firstDueMonth,
      balancePrincipalText: item.condition.balance.principal,
      balanceInstallments: item.condition.balance.installments,
      graceMonths: item.condition.balance.graceMonths,
      balanceFirstDueMonth: item.condition.balance.firstDueMonth,
      explicitChargesText: item.condition.explicitCharges,
      explicitChargesDueMonth: item.condition.explicitChargesDueMonth ?? null,
      correctionRateText: item.condition.correctionRate ?? null,
      interestRateText: item.condition.interestRate ?? null,
      materialityToleranceText: item.condition.materialityTolerance,
      campaign: item.condition.campaign ?? null,
      status: item.status,
      sourceType: item.sourceType,
      sourceRef: item.sourceRef ?? null,
      updatedBy: params.actorId,
    }));
    if (insertedConditions.length)
      await transaction.insert(commercialConditions).values(insertedConditions);

    await bumpFinancialRevision(
      transaction,
      version.id,
      "A versão mudou durante a gravação do modelo comercial."
    );

    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "commercial_model",
      entityId: version.id,
      action: "commercial_model.replaced",
      actorId: params.actorId,
      beforeHash:
        beforeSkus.length || beforeConditions.length
          ? sha256({ skus: beforeSkus, conditions: beforeConditions })
          : null,
      afterHash: sha256({ skus: params.skus, conditions: params.conditions }),
      metadata: {
        versionId: version.id,
        skuCount: insertedSkus.length,
        conditionCount: insertedConditions.length,
        asOfMonth: params.asOfMonth,
      },
    });
  });

  return {
    catalog: await getProductCatalogForTenant(
      version.id,
      params.tenantId,
      params.asOfMonth
    ),
    conditions: await listCommercialConditionsForTenant(
      version.id,
      params.tenantId
    ),
  };
}

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
      const versionUpdate = await transaction
        .update(projectVersions)
        .set({
          inputHash: sha256(nextInputs),
          financialRevision: sql`${projectVersions.financialRevision} + 1`,
        })
        .where(
          and(
            eq(projectVersions.id, version.id),
            eq(projectVersions.state, "draft"),
            eq(projectVersions.isImmutable, false),
            eq(projectVersions.inputHash, version.inputHash)
          )
        );
      if (versionUpdate[0].affectedRows !== 1)
        throw new Error(
          "A versão mudou durante a aplicação da decisão; nenhuma alteração foi aplicada."
        );
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
  await db.transaction(async transaction => {
    await transaction
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
    await bumpFinancialRevision(
      transaction,
      version.id,
      "A versão mudou durante a gravação do componente do Builder."
    );
    await transaction.insert(auditEvents).values({
      id: nanoid(),
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
    .orderBy(desc(costCatalogItems.updatedAt), costCatalogItems.id);
  return { items, summary: summarizeCostCatalog(items) };
}

export async function createCostCatalogItemForTenant(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  category: CostCategory;
  name: string;
  frequency: "monthly" | "annual" | "one_time";
  cashflowTreatment: CostCashflowTreatment;
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
  if (params.status === "provided") {
    if (params.amountText === undefined) throw new Error("Custo informado exige valor não negativo.");
    const amount = new FinanceDecimal(params.amountText);
    if (!amount.isFinite() || amount.lt(0)) throw new Error("Custo informado exige valor não negativo.");
  }
  const record = {
    id: nanoid(),
    versionId: version.id,
    category: params.category,
    name: params.name,
    frequency: params.frequency,
    cashflowTreatment: params.cashflowTreatment,
    amountText: params.amountText ?? null,
    status: params.status,
    sourceType: params.sourceType,
    sourceRef: params.sourceRef ?? null,
    updatedBy: params.actorId,
  };
  await db.transaction(async transaction => {
    await transaction.insert(costCatalogItems).values(record);
    await bumpFinancialRevision(
      transaction,
      version.id,
      "A versão mudou durante a gravação do custo."
    );
    await transaction.insert(auditEvents).values({
      id: nanoid(),
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
        cashflowTreatment: record.cashflowTreatment,
        status: record.status,
      },
    });
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
    const versionUpdate = await transaction
      .update(projectVersions)
      .set({
        inputHash,
        financialRevision: sql`${projectVersions.financialRevision} + 1`,
      })
      .where(
        and(
          eq(projectVersions.id, version.id),
          eq(projectVersions.state, "draft"),
          eq(projectVersions.isImmutable, false),
          eq(projectVersions.inputHash, version.inputHash)
        )
      );
    if (versionUpdate[0].affectedRows !== 1)
      throw new Error(
        "A versão mudou durante a gravação dos inputs; nenhuma alteração foi aplicada."
      );
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

async function getAuthoritativeCalculationContext(params: {
  tenantId: number;
  versionId: string;
  asOfMonth: number;
  horizonMonths: number;
}) {
  const version = await getVersionForTenant(params.versionId, params.tenantId);
  if (version.formulaSetVersionId !== IGR_CORE_FORMULA_SET_V1.id)
    throw new Error(
      `A versão usa o conjunto de fórmulas ${version.formulaSetVersionId}; crie um novo cenário para calcular com ${IGR_CORE_FORMULA_SET_V1.id}.`
    );
  const inputs = await getInputsForVersion(version.id);
  const productCatalog = await getProductCatalogForTenant(
    version.id,
    params.tenantId,
    params.asOfMonth
  );
  const conditions = await listCommercialConditionsForTenant(
    version.id,
    params.tenantId
  );
  const persistedReceivablesPolicy = await getReceivablesPolicyForTenant(
    version.id,
    params.tenantId
  );
  const capturePoints = await getCapturePointsForTenant(
    version.id,
    params.tenantId
  );
  const persistedCommercialOperations =
    await getCommercialOperationsForTenant(version.id, params.tenantId);
  const costCatalog = await listCostCatalogForTenant(version.id, params.tenantId);
  const costCatalogCashflowAdjustments = deriveCostCatalogCashflowAdjustments(costCatalog.items);
  const usesStructuredCommercialDomains =
    productCatalog.records.length > 0 || conditions.length > 0;
  const providedSkuCodes = new Set(
    productCatalog.records
      .filter(record => record.status === "provided")
      .map(record => record.skuCode)
  );
  const providedProductSkus = productCatalog.evaluation.skus.filter(sku =>
    providedSkuCodes.has(sku.id)
  );
  const providedProductEvaluation = evaluateProductInventory({
    asOfMonth: params.asOfMonth,
    skus: providedProductSkus,
  });
  const providedConditions = conditions.filter(
    item => item.record.status === "provided"
  );
  const domainBlockers: string[] = [];
  const domainInvalidities: string[] = [];
  if (productCatalog.records.length === 0)
    domainBlockers.push("product_catalog.missing");
  if (conditions.length === 0)
    domainBlockers.push("commercial_conditions.missing");
  if (!persistedReceivablesPolicy)
    domainBlockers.push("receivables_policy.missing");
  else if (persistedReceivablesPolicy.record.status === "pending")
    domainBlockers.push("receivables_policy.pending");
  if (capturePoints.length === 0)
    domainBlockers.push("capture_points.missing");
  else if (capturePoints.some(item => item.status === "pending"))
    domainBlockers.push("capture_points.pending");
  if (!persistedCommercialOperations)
    domainBlockers.push("commercial_operations.missing");
  else if (persistedCommercialOperations.record.status === "pending")
    domainBlockers.push("commercial_operations.pending");
  if (costCatalogCashflowAdjustments.status === "blocked")
    domainBlockers.push("cost_catalog.incremental_pending");
  else if (costCatalogCashflowAdjustments.status === "invalid")
    domainInvalidities.push("cost_catalog.incremental_invalid");
  let authoritativeReceivablesPolicy: ReceivablesPolicy | undefined;
  if (persistedReceivablesPolicy) {
    try {
      assertReceivablesPolicy(
        persistedReceivablesPolicy.record.status === "pending" &&
          !persistedReceivablesPolicy.policy.sourceRef
          ? { ...persistedReceivablesPolicy.policy, sourceRef: "pending" }
          : persistedReceivablesPolicy.policy
      );
      if (persistedReceivablesPolicy.record.status === "provided")
        authoritativeReceivablesPolicy = persistedReceivablesPolicy.policy;
    } catch {
      domainInvalidities.push("receivables_policy.invalid");
    }
  }
  if (usesStructuredCommercialDomains) {
    if (productCatalog.records.some(record => record.status === "pending"))
      domainBlockers.push("product_catalog.pending_skus");
    if (providedProductEvaluation.status === "invalid")
      domainInvalidities.push("product_catalog.invalid");
    if (conditions.some(item => item.record.status === "pending"))
      domainBlockers.push("commercial_conditions.pending");
    if (providedConditions.some(item => item.reconciliation.status === "invalid"))
      domainInvalidities.push("commercial_conditions.invalid");
  }
  const commercialModel = usesStructuredCommercialDomains
    ? resolveAuthoritativeCommercialModel({
        asOfMonth: params.asOfMonth,
        skus: providedProductSkus,
        conditions: providedConditions.map(item => ({
          productSkuCode: item.productSkuCode,
          condition: item.condition,
        })),
      })
    : null;
  for (const violation of commercialModel?.violations ?? []) {
    const key = `commercial_model.${violation.code.toLowerCase()}`;
    if (violation.code === "MISSING_COMMERCIAL_CONDITION") {
      if (!domainBlockers.includes(key)) domainBlockers.push(key);
    } else if (!domainInvalidities.includes(key)) {
      domainInvalidities.push(key);
    }
  }
  let authoritativePointInputs: PointEconomicsInput[] | undefined;
  let pointEconomics: PointEconomicsPortfolio | undefined;
  if (
    capturePoints.length > 0 &&
    capturePoints.every(item => item.status === "provided") &&
    commercialModel?.status === "valid" &&
    authoritativeReceivablesPolicy
  ) {
    try {
      const variableCostRate = new FinanceDecimal(
        inputs.variableCostRate.value ?? ""
      );
      const partnerShareRate = new FinanceDecimal(
        inputs.partnerShareRate.value ?? ""
      );
      const contributionMarginRate = new FinanceDecimal(1)
        .minus(variableCostRate)
        .minus(partnerShareRate);
      if (!contributionMarginRate.isFinite() || contributionMarginRate.lt(0)) {
        throw new Error("A margem de contribuição dos pontos não pode ser negativa.");
      }
      const policy = authoritativeReceivablesPolicy;
      const residualDelinquencyD90 = new FinanceDecimal(policy.delinquencyRate)
        .times(new FinanceDecimal(1).minus(policy.cureRates.days1To30))
        .times(new FinanceDecimal(1).minus(policy.cureRates.days31To60))
        .times(new FinanceDecimal(1).minus(policy.cureRates.days61To90));
      const healthyD90Rate = new FinanceDecimal(1)
        .minus(policy.cancellationCurve.d90)
        .times(new FinanceDecimal(1).minus(residualDelinquencyD90));
      authoritativePointInputs = capturePoints.map(item => ({
        ...item.definition,
        averageTicket: commercialModel.derived.averageTicket,
        averageEntry: commercialModel.derived.entryValuePerContract,
        contributionMarginRate: contributionMarginRate.toFixed(8),
        healthyD90Rate: healthyD90Rate.toFixed(8),
      }));
      pointEconomics = calculatePointEconomics({ points: authoritativePointInputs });
    } catch {
      domainInvalidities.push("capture_points.invalid");
    }
  }
  let commercialOperations: CommercialOperationsResult | undefined;
  if (
    persistedCommercialOperations?.record.status === "provided" &&
    pointEconomics
  ) {
    try {
      commercialOperations = calculateCommercialOperations({
        definition: persistedCommercialOperations.definition,
        horizonMonths: params.horizonMonths,
        pointDemand: {
          toursMonthly: pointEconomics.totals.funnel.tours,
          salesMonthly: pointEconomics.totals.production.totalSales,
        },
      });
    } catch {
      domainInvalidities.push("commercial_operations.invalid");
    }
  }
  const authoritativeDomains = usesStructuredCommercialDomains || persistedReceivablesPolicy || capturePoints.length > 0 || persistedCommercialOperations || costCatalog.items.length > 0
    ? {
        asOfMonth: params.asOfMonth,
        productCatalog: {
          records: productCatalog.records.map(record => ({
            skuCode: record.skuCode,
            status: record.status,
            sourceType: record.sourceType,
            sourceRef: record.sourceRef,
          })),
          evaluation: productCatalog.evaluation,
        },
        commercialConditions: conditions.map(item => ({
          condition: item.condition,
          productSkuCode: item.productSkuCode,
          status: item.record.status,
          sourceType: item.record.sourceType,
          sourceRef: item.record.sourceRef,
          reconciliation: item.reconciliation,
        })),
        commercialModel,
        receivablesPolicy: persistedReceivablesPolicy
          ? {
              status: persistedReceivablesPolicy.record.status,
              sourceType: persistedReceivablesPolicy.record.sourceType,
              sourceRef: persistedReceivablesPolicy.record.sourceRef,
              policy: persistedReceivablesPolicy.policy,
            }
          : null,
        capturePoints: {
          definitions: capturePoints.map(item => ({
            status: item.status,
            sourceType: item.sourceType,
            sourceRef: item.sourceRef ?? null,
            definition: item.definition,
          })),
          authoritativeInputs: authoritativePointInputs ?? null,
          economics: pointEconomics ?? null,
        },
        commercialOperations: persistedCommercialOperations
          ? {
              status: persistedCommercialOperations.record.status,
              sourceType: persistedCommercialOperations.record.sourceType,
              sourceRef: persistedCommercialOperations.record.sourceRef,
              definition: persistedCommercialOperations.definition,
              results: commercialOperations ?? null,
            }
          : null,
        costCatalog: {
          items: costCatalog.items.map(item => ({ category: item.category, name: item.name, frequency: item.frequency, cashflowTreatment: item.cashflowTreatment, amountText: item.amountText, status: item.status, sourceType: item.sourceType, sourceRef: item.sourceRef })),
          summary: costCatalog.summary,
          cashflowAdjustments: costCatalogCashflowAdjustments,
        },
      }
    : undefined;
  const hasIncrementalCatalogCosts = costCatalog.items.some(item => item.cashflowTreatment === "incremental");
  const addCatalogAdjustment = (key: "fixedCostMonthly" | "payrollMonthly" | "capexInitial", adjustment: string) => {
    const input = inputs[key];
    if (input.status !== "provided" || input.value === undefined) return input;
    return { status: "provided" as const, value: new FinanceDecimal(input.value).plus(adjustment).toFixed(8), sourceType: "derived_analysis" as const, sourceRef: `base:${input.sourceRef ?? "unreferenced"}+cost-catalog:incremental` };
  };
  const calculationInputs =
    commercialModel?.status === "valid" &&
    domainBlockers.length === 0 &&
    domainInvalidities.length === 0
      ? {
          ...inputs,
          averageTicket: {
            status: "provided" as const,
            value: commercialModel.derived.averageTicket,
            sourceType: "derived_analysis" as const,
            sourceRef: "authoritative-commercial-model",
          },
          entryValuePerContract: {
            status: "provided" as const,
            value: commercialModel.derived.entryValuePerContract,
            sourceType: "derived_analysis" as const,
            sourceRef: "authoritative-commercial-model",
          },
          qualifiedCouplesMonth1: {
            status: "provided" as const,
            value: pointEconomics!.totals.funnel.qualified,
            sourceType: "derived_analysis" as const,
            sourceRef: "authoritative-point-economics",
          },
          qualifiedCouplesGrowthRate: {
            status: "provided" as const,
            value: "0",
            sourceType: "derived_analysis" as const,
            sourceRef: "authoritative-point-economics",
          },
          conversionRate: {
            status: "provided" as const,
            value: new FinanceDecimal(pointEconomics!.totals.funnel.qualified).eq(0)
              ? "0"
              : new FinanceDecimal(pointEconomics!.totals.production.totalSales)
                  .div(pointEconomics!.totals.funnel.qualified)
                  .toFixed(8),
            sourceType: "derived_analysis" as const,
            sourceRef: "authoritative-point-economics",
          },
          ...(hasIncrementalCatalogCosts && costCatalogCashflowAdjustments.status === "valid" ? {
            fixedCostMonthly: addCatalogAdjustment("fixedCostMonthly", costCatalogCashflowAdjustments.fixedCostMonthly),
            payrollMonthly: addCatalogAdjustment("payrollMonthly", costCatalogCashflowAdjustments.payrollMonthly),
            capexInitial: addCatalogAdjustment("capexInitial", costCatalogCashflowAdjustments.capexInitial),
          } : {}),
        }
      : undefined;
  const calculationOptions = calculationInputs
    ? {
        maxContracts: commercialModel!.derived.maxContracts,
        paymentSchedulePerContract:
          commercialModel!.derived.paymentSchedulePerContract,
        receivablesPolicy: authoritativeReceivablesPolicy!,
        pointEconomics: pointEconomics!,
        commercialOperations: commercialOperations!,
      }
    : undefined;
  return {
    version,
    inputs,
    authoritativeDomains,
    domainBlockers,
    domainInvalidities,
    commercialModel,
    pointEconomics,
    commercialOperations,
    calculationInputs,
    calculationOptions,
    authoritativeInputHash: authoritativeDomains
      ? sha256({ financialInputHash: version.inputHash, authoritativeDomains })
      : version.inputHash,
  };
}

export async function createCalculationSnapshot(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
  horizonMonths: number;
  asOfMonth?: number;
}) {
  const db = await requireDb();
  const context = await getAuthoritativeCalculationContext({
    tenantId: params.tenantId,
    versionId: params.versionId,
    asOfMonth: params.asOfMonth ?? 0,
    horizonMonths: params.horizonMonths,
  });
  const {
    version,
    inputs,
    authoritativeDomains,
    domainBlockers,
    domainInvalidities,
    calculationInputs,
    calculationOptions,
  } = context;
  const calculation = calculateAuthoritativeSnapshot({
    inputs,
    horizonMonths: params.horizonMonths,
    formulaSetVersionId: version.formulaSetVersionId,
    authoritativeDomains,
    domainBlockers,
    domainInvalidities,
    calculationInputs,
    calculationOptions,
  });
  const id = nanoid();
  const isAuthoritative = calculation.status === "valid";
  const persistedSnapshot = await db.transaction(async transaction => {
    const lockedVersion = (await transaction
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.id, version.id))
      .for("update")
      .limit(1))[0];
    if (!lockedVersion) throw new Error("A versão deixou de existir durante o cálculo.");
    if (
      lockedVersion.inputHash !== version.inputHash ||
      lockedVersion.financialRevision !== version.financialRevision ||
      lockedVersion.formulaSetVersionId !== version.formulaSetVersionId
    ) throw new Error("A versão mudou durante o cálculo; execute novamente sobre o estado atual.");
    const existingSnapshot = (await transaction
      .select()
      .from(calculationSnapshots)
      .where(eq(calculationSnapshots.snapshotHash, calculation.snapshotHash))
      .limit(1))[0];
    if (existingSnapshot) {
      const expectedValidationStatus = calculation.status === "valid" ? "valid" : "failed";
      if (
        existingSnapshot.projectVersionId !== version.id ||
        existingSnapshot.formulaSetVersionId !== version.formulaSetVersionId ||
        existingSnapshot.horizonMonths !== params.horizonMonths ||
        existingSnapshot.asOfMonth !== (params.asOfMonth ?? 0) ||
        existingSnapshot.inputHash !== context.authoritativeInputHash ||
        existingSnapshot.calculationStatus !== calculation.status ||
        existingSnapshot.validationStatus !== expectedValidationStatus ||
        existingSnapshot.isAuthoritative !== isAuthoritative
      ) {
        throw new Error(
          "Hash de snapshot já existe com identidade analítica incompatível; integridade recusada."
        );
      }
      return { id: existingSnapshot.id, reused: true as const };
    }
    if (
      lockedVersion.state !== version.state ||
      lockedVersion.isImmutable !== version.isImmutable
    ) throw new Error("A versão mudou durante o cálculo; execute novamente sobre o estado atual.");
    await transaction.insert(calculationSnapshots).values({
      id,
      projectVersionId: version.id,
      formulaSetVersionId: version.formulaSetVersionId,
      horizonMonths: params.horizonMonths,
      asOfMonth: params.asOfMonth ?? 0,
      inputHash: context.authoritativeInputHash,
      snapshotHash: calculation.snapshotHash,
      calculationStatus: calculation.status,
      validationStatus: calculation.status === "valid" ? "valid" : "failed",
      isAuthoritative,
      payload: calculation as unknown as Record<string, unknown>,
      createdBy: params.actorId,
    });
    if (calculation.status === "valid") {
      await transaction.insert(kpiMemoryRecords).values(
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
      const versionUpdate = await transaction
        .update(projectVersions)
        .set({ state: "in_review" })
        .where(and(
          eq(projectVersions.id, version.id),
          eq(projectVersions.state, "draft"),
          eq(projectVersions.isImmutable, version.isImmutable),
          eq(projectVersions.inputHash, version.inputHash),
          eq(projectVersions.financialRevision, version.financialRevision),
          eq(projectVersions.formulaSetVersionId, version.formulaSetVersionId)
        ));
      if (versionUpdate[0].affectedRows !== 1)
        throw new Error("A versão mudou durante o cálculo; nenhuma transição foi aplicada.");
      await transaction
        .update(projects)
        .set({ status: "in_review" })
        .where(eq(projects.id, version.projectId));
      await transaction.insert(workflowEvents).values({
        id: nanoid(),
        projectId: version.projectId,
        versionId: version.id,
        fromState: "draft",
        toState: "in_review",
        action: "snapshot.submitted_for_review",
        actorId: params.actorId,
      });
    }
    const verifiedVersion = (await transaction
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.id, version.id))
      .for("update")
      .limit(1))[0];
    const expectedState = calculation.status === "valid" && version.state === "draft"
      ? "in_review"
      : version.state;
    if (
      !verifiedVersion ||
      verifiedVersion.state !== expectedState ||
      verifiedVersion.inputHash !== version.inputHash ||
      verifiedVersion.financialRevision !== version.financialRevision ||
      verifiedVersion.formulaSetVersionId !== version.formulaSetVersionId
    ) throw new Error("A versão mudou durante o cálculo; o snapshot foi revertido.");
    await transaction.insert(auditEvents).values({
      id: nanoid(),
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
        asOfMonth: params.asOfMonth ?? 0,
      },
    });
    return { id, reused: false as const };
  });
  return { id: persistedSnapshot.id, ...calculation };
}

type MeetingSimulationParams = {
  tenantId: number;
  versionId: string;
  horizonMonths: number;
  asOfMonth?: number;
  captadorDelta: string;
  qualifiedCouplesPerCaptadorMonth: string;
  loadedCostPerCaptadorMonth: string;
  targetGrossSalesMonth1?: string;
  averageTicketDelta?: string;
  fixedCostMonthlyDelta?: string;
  payrollMonthlyDelta?: string;
  variableCostMonthlyDelta?: string;
  capexInitialDelta?: string;
};

async function prepareMeetingSimulation(params: MeetingSimulationParams) {
  const context = await getAuthoritativeCalculationContext({
    tenantId: params.tenantId,
    versionId: params.versionId,
    asOfMonth: params.asOfMonth ?? 0,
    horizonMonths: params.horizonMonths,
  });
  if (!context.calculationInputs || context.domainBlockers.length || context.domainInvalidities.length)
    throw new Error("A simulação exige produto, condição comercial, política de carteira, pontos de captação e operações comerciais válidos, sem itens pendentes.");
  let simulatedCalculationOptions: FinancialProjectionOptions | undefined = context.calculationOptions;
  let scaledPointInputs: PointEconomicsInput[] | undefined;
  if (params.targetGrossSalesMonth1 !== undefined) {
    const pointInputs = context.authoritativeDomains?.capturePoints.authoritativeInputs;
    const operationsDefinition = context.authoritativeDomains?.commercialOperations?.definition;
    const baselinePointSales = context.pointEconomics
      ? new FinanceDecimal(context.pointEconomics.totals.production.totalSales)
      : null;
    const targetSales = new FinanceDecimal(params.targetGrossSalesMonth1);
    if (!pointInputs?.length || !context.pointEconomics || !operationsDefinition || !baselinePointSales) {
      throw new Error("A meta de vendas exige Point Economics e operações comerciais autoritativos.");
    }
    if (baselinePointSales.eq(0) && targetSales.gt(0)) {
      throw new Error("A meta de vendas não pode ser derivada quando a produção autoritativa atual é zero.");
    }
    const demandFactor = baselinePointSales.eq(0)
      ? new FinanceDecimal(0)
      : targetSales.div(baselinePointSales);
    scaledPointInputs = pointInputs.map(point => ({
        ...point,
        approaches: new FinanceDecimal(point.approaches)
          .times(demandFactor)
          .toFixed(8),
      }));
    const simulatedPointEconomics = calculatePointEconomics({ points: scaledPointInputs });
    const simulatedCommercialOperations = calculateCommercialOperations({
      definition: operationsDefinition,
      horizonMonths: params.horizonMonths,
      pointDemand: {
        toursMonthly: simulatedPointEconomics.totals.funnel.tours,
        salesMonthly: simulatedPointEconomics.totals.production.totalSales,
      },
    });
    simulatedCalculationOptions = {
      ...context.calculationOptions,
      pointEconomics: simulatedPointEconomics,
      commercialOperations: simulatedCommercialOperations,
    };
  }
  const simulation = simulateCaptadorChange({
    inputs: context.calculationInputs,
    calculationOptions: context.calculationOptions,
    simulatedCalculationOptions,
    horizonMonths: params.horizonMonths,
    captadorDelta: params.captadorDelta,
    qualifiedCouplesPerCaptadorMonth:
      params.qualifiedCouplesPerCaptadorMonth,
    loadedCostPerCaptadorMonth: params.loadedCostPerCaptadorMonth,
    targetGrossSalesMonth1: params.targetGrossSalesMonth1,
    averageTicketDelta: params.averageTicketDelta,
    fixedCostMonthlyDelta: params.fixedCostMonthlyDelta,
    payrollMonthlyDelta: params.payrollMonthlyDelta,
    variableCostMonthlyDelta: params.variableCostMonthlyDelta,
    capexInitialDelta: params.capexInitialDelta,
    includeLeverBreakdown: false,
  });
  return { context, simulation, scaledPointInputs };
}

export async function simulateCaptadorChangeForTenant(params: MeetingSimulationParams) {
  return (await prepareMeetingSimulation(params)).simulation;
}

type ScenarioCloneContext = {
  transaction: TgrTransaction;
  versionId: string;
  branchId: string;
  baseVersion: Awaited<ReturnType<typeof getVersionForTenant>>;
  inputSnapshot: FinancialInputSnapshot;
};

async function createScenarioInTransaction(params: {
  tenantId: number;
  actorId: number;
  baseVersion: Awaited<ReturnType<typeof getVersionForTenant>>;
  formulaSetVersionId: string;
  name: string;
  reason: string;
  transaction: TgrTransaction;
  afterClone?: (context: ScenarioCloneContext) => Promise<void>;
}) {
  const versionId = nanoid();
  const branchId = nanoid();
  const { transaction } = params;
    const currentBaseRows = await transaction
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.id, params.baseVersion.id))
      .limit(1);
    const currentBase = currentBaseRows[0];
    if (!currentBase)
      throw new Error("A versão-base deixou de existir durante a criação do cenário.");
    const baseInputRows = await transaction
      .select()
      .from(inputValues)
      .where(eq(inputValues.versionId, currentBase.id));
    const savedInputs = Object.fromEntries(
      baseInputRows.map(row => [
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
    const inputSnapshot = Object.fromEntries(
      FINANCIAL_INPUT_KEYS.map(key => [
        key,
        savedInputs[key] ?? { status: "pending", sourceType: "current_decision" },
      ])
    ) as FinancialInputSnapshot;
    const baseProductSkus = await transaction
      .select()
      .from(productSkus)
      .where(eq(productSkus.versionId, currentBase.id));
    const baseProductPhases = baseProductSkus.length
      ? await transaction
          .select()
          .from(productPricePhases)
          .where(
            inArray(
              productPricePhases.productSkuId,
              baseProductSkus.map(sku => sku.id)
            )
          )
      : [];
    const baseCommercialConditions = await transaction
      .select()
      .from(commercialConditions)
      .where(eq(commercialConditions.versionId, currentBase.id));
    const baseReceivablesPolicy = await transaction
      .select()
      .from(receivablesPolicies)
      .where(eq(receivablesPolicies.versionId, currentBase.id))
      .limit(1);
    const baseProjectComponents = await transaction
      .select()
      .from(projectComponentRecords)
      .where(eq(projectComponentRecords.versionId, currentBase.id));
    const baseCostCatalogItems = await transaction
      .select()
      .from(costCatalogItems)
      .where(eq(costCatalogItems.versionId, currentBase.id));
    const scenarioSkuIds = new Map(
      baseProductSkus.map(sku => [sku.id, nanoid()])
    );
    await transaction.insert(projectVersions).values({
      id: versionId,
      projectId: currentBase.projectId,
      parentVersionId: currentBase.id,
      formulaSetVersionId: params.formulaSetVersionId,
      kind: "scenario",
      state: "draft",
      isImmutable: false,
      inputHash: sha256(inputSnapshot),
      createdBy: params.actorId,
    });
    await transaction.insert(inputValues).values(
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
    if (baseProductSkus.length) {
      await transaction.insert(productSkus).values(
        baseProductSkus.map(sku => ({
          id: scenarioSkuIds.get(sku.id)!,
          versionId,
          skuCode: sku.skuCode,
          name: sku.name,
          unitType: sku.unitType,
          unitQuantity: sku.unitQuantity,
          sharesPerUnit: sku.sharesPerUnit,
          grossSoldShares: sku.grossSoldShares,
          returnedShares: sku.returnedShares,
          blockedShares: sku.blockedShares,
          status: sku.status,
          sourceType: sku.sourceType,
          sourceRef: sku.sourceRef,
          updatedBy: params.actorId,
        }))
      );
    }
    if (baseProductPhases.length) {
      await transaction.insert(productPricePhases).values(
        baseProductPhases.map(phase => ({
          id: nanoid(),
          productSkuId: scenarioSkuIds.get(phase.productSkuId)!,
          phaseCode: phase.phaseCode,
          name: phase.name,
          startsAtMonth: phase.startsAtMonth,
          priceText: phase.priceText,
          promotionalPriceText: phase.promotionalPriceText,
        }))
      );
    }
    if (baseCommercialConditions.length) {
      await transaction.insert(commercialConditions).values(
        baseCommercialConditions.map(condition => ({
          id: nanoid(),
          versionId,
          productSkuId: condition.productSkuId
            ? (scenarioSkuIds.get(condition.productSkuId) ?? null)
            : null,
          conditionCode: condition.conditionCode,
          name: condition.name,
          listPriceText: condition.listPriceText,
          discountText: condition.discountText,
          entryTotalText: condition.entryTotalText,
          entryInstallments: condition.entryInstallments,
          entryFirstDueMonth: condition.entryFirstDueMonth,
          balancePrincipalText: condition.balancePrincipalText,
          balanceInstallments: condition.balanceInstallments,
          graceMonths: condition.graceMonths,
          balanceFirstDueMonth: condition.balanceFirstDueMonth,
          explicitChargesText: condition.explicitChargesText,
          explicitChargesDueMonth: condition.explicitChargesDueMonth,
          correctionRateText: condition.correctionRateText,
          interestRateText: condition.interestRateText,
          materialityToleranceText: condition.materialityToleranceText,
          campaign: condition.campaign,
          status: condition.status,
          sourceType: condition.sourceType,
          sourceRef: condition.sourceRef,
          updatedBy: params.actorId,
        }))
      );
    }
    if (baseReceivablesPolicy[0]) {
      const policy = baseReceivablesPolicy[0];
      await transaction.insert(receivablesPolicies).values({
        id: nanoid(),
        versionId,
        cancellationD7Text: policy.cancellationD7Text,
        cancellationD30Text: policy.cancellationD30Text,
        cancellationD60Text: policy.cancellationD60Text,
        cancellationD90Text: policy.cancellationD90Text,
        cancellationD180Text: policy.cancellationD180Text,
        cancellationLifetimeText: policy.cancellationLifetimeText,
        delinquencyRateText: policy.delinquencyRateText,
        cureDays1To30Text: policy.cureDays1To30Text,
        cureDays31To60Text: policy.cureDays31To60Text,
        cureDays61To90Text: policy.cureDays61To90Text,
        cureDays90PlusText: policy.cureDays90PlusText,
        writeOffAfterDays: policy.writeOffAfterDays,
        policyVersion: policy.policyVersion,
        status: policy.status,
        sourceType: policy.sourceType,
        sourceRef: policy.sourceRef,
        updatedBy: params.actorId,
      });
    }
    if (baseProjectComponents.length) {
      await transaction.insert(projectComponentRecords).values(
        baseProjectComponents.map(component => ({
          id: nanoid(),
          versionId,
          componentType: component.componentType,
          name: component.name,
          status: component.status,
          payload: component.payload,
          sourceType: component.sourceType,
          sourceRef: component.sourceRef,
          updatedBy: params.actorId,
        }))
      );
    }
    if (baseCostCatalogItems.length) {
      await transaction.insert(costCatalogItems).values(
        baseCostCatalogItems.map(item => ({ id: nanoid(), versionId, category: item.category, name: item.name, frequency: item.frequency, cashflowTreatment: item.cashflowTreatment, amountText: item.amountText, status: item.status, sourceType: item.sourceType, sourceRef: item.sourceRef, updatedBy: params.actorId }))
      );
    }
    await params.afterClone?.({
      transaction,
      versionId,
      branchId,
      baseVersion: params.baseVersion,
      inputSnapshot,
    });
    await transaction.insert(scenarioBranches).values({
      id: branchId,
      projectId: currentBase.projectId,
      baseVersionId: currentBase.id,
      branchVersionId: versionId,
      name: params.name,
      reason: params.reason,
      createdBy: params.actorId,
    });
    await transaction.insert(workflowEvents).values({
      id: nanoid(),
      projectId: currentBase.projectId,
      versionId,
      toState: "draft",
      action: "scenario.created",
      rationale: params.reason,
      actorId: params.actorId,
    });
    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "scenario_branch",
      entityId: branchId,
      action: "scenario.created",
      actorId: params.actorId,
      metadata: { baseVersionId: currentBase.id, branchVersionId: versionId },
    });
  return { branchId, versionId };
}

export async function createScenarioForTenant(params: {
  tenantId: number;
  actorId: number;
  baseVersionId: string;
  name: string;
  reason: string;
}) {
  const db = await requireDb();
  const baseVersion = await getVersionForTenant(params.baseVersionId, params.tenantId);
  const formulaSetVersionId = await ensureCoreFormulaSet(params.actorId);
  return db.transaction(transaction => createScenarioInTransaction({
    ...params,
    baseVersion,
    formulaSetVersionId,
    transaction,
  }));
}

export async function promoteMeetingSimulationToScenarioForTenant(params: MeetingSimulationParams & {
  actorId: number;
  baseSnapshotId: string;
  name: string;
  reason: string;
  sourceRef: string;
}) {
  const db = await requireDb();
  const prepared = await prepareMeetingSimulation(params);
  const baseVersion = prepared.context.version;
  const formulaSetVersionId = await ensureCoreFormulaSet(params.actorId);
  const sourceRef = params.sourceRef.trim();
  if (!sourceRef) throw new Error("Salvar cenário de reunião exige fonte ou ata explícita.");

  const candidateValues: Partial<Record<FinancialInputKey, string>> = {
    qualifiedCouplesMonth1: prepared.simulation.after.qualifiedCouplesMonth1,
    payrollMonthly: prepared.simulation.after.payrollMonthly,
    averageTicket: prepared.simulation.after.averageTicket,
    fixedCostMonthly: prepared.simulation.after.fixedCostMonthly,
    variableCostRate: prepared.simulation.after.variableCostRate,
    capexInitial: prepared.simulation.after.capexInitial,
  };
  const changedInputKeys = (Object.entries(candidateValues) as Array<[FinancialInputKey, string]>)
    .filter(([key, value]) => {
      const current = prepared.context.calculationInputs?.[key];
      return current?.status !== "provided" || current.value === undefined || !new FinanceDecimal(current.value).eq(value);
    })
    .map(([key]) => key);
  const pointsChanged = Boolean(
    params.targetGrossSalesMonth1 !== undefined &&
    prepared.scaledPointInputs &&
    prepared.context.pointEconomics &&
    !new FinanceDecimal(params.targetGrossSalesMonth1).eq(
      prepared.context.pointEconomics.totals.production.totalSales
    )
  );
  if (!changedInputKeys.length && !pointsChanged) {
    throw new Error("A hipótese é idêntica à baseline; nenhum cenário foi criado.");
  }

  return db.transaction(transaction => createScenarioInTransaction({
    tenantId: params.tenantId,
    actorId: params.actorId,
    baseVersion,
    formulaSetVersionId,
    name: params.name,
    reason: params.reason,
    transaction,
    afterClone: async ({ versionId, inputSnapshot }) => {
      const lockedBase = (await transaction
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.id, baseVersion.id))
        .for("update")
        .limit(1))[0];
      if (
        !lockedBase ||
        lockedBase.inputHash !== baseVersion.inputHash ||
        lockedBase.financialRevision !== baseVersion.financialRevision
      ) throw new Error("A baseline mudou durante a promoção; nenhuma branch foi criada.");
      const lockedSnapshot = (await transaction
        .select()
        .from(calculationSnapshots)
        .where(eq(calculationSnapshots.id, params.baseSnapshotId))
        .limit(1))[0];
      if (
        !lockedSnapshot ||
        lockedSnapshot.projectVersionId !== baseVersion.id ||
        !lockedSnapshot.isAuthoritative ||
        lockedSnapshot.validationStatus !== "valid"
      ) throw new Error("O snapshot-base não é autoritativo, válido ou compatível com a baseline.");

      const nextInputs = structuredClone(inputSnapshot);
      for (const key of changedInputKeys) {
        const value = candidateValues[key]!;
        nextInputs[key] = {
          status: "provided",
          value,
          sourceType: "current_decision",
          sourceRef,
        };
        await transaction
          .update(inputValues)
          .set({
            status: "provided",
            valueText: value,
            sourceType: "current_decision",
            sourceRef,
            updatedBy: params.actorId,
          })
          .where(and(eq(inputValues.versionId, versionId), eq(inputValues.key, key)));
      }

      if (prepared.scaledPointInputs && pointsChanged) {
        const approachesByPoint = new Map(
          prepared.scaledPointInputs.map(point => [point.pointId, point.approaches])
        );
        const scenarioPoints = await transaction
          .select()
          .from(projectComponentRecords)
          .where(and(
            eq(projectComponentRecords.versionId, versionId),
            eq(projectComponentRecords.componentType, "acquisition_capacity")
          ));
        for (const point of scenarioPoints) {
          const payload = point.payload as CapturePointDefinition;
          const approaches = approachesByPoint.get(payload.pointId);
          if (approaches === undefined) throw new Error(`Ponto autoritativo ausente na promoção: ${payload.pointId}.`);
          await transaction
            .update(projectComponentRecords)
            .set({
              payload: { ...payload, approaches },
              sourceType: "current_decision",
              sourceRef,
              updatedBy: params.actorId,
            })
            .where(eq(projectComponentRecords.id, point.id));
        }
      }

      await transaction
        .update(projectVersions)
        .set({ inputHash: sha256(nextInputs), financialRevision: 1 })
        .where(eq(projectVersions.id, versionId));
      await transaction.insert(auditEvents).values({
        id: nanoid(),
        tenantId: params.tenantId,
        entityType: "scenario_branch",
        entityId: versionId,
        action: "meeting_simulation.promoted",
        actorId: params.actorId,
        beforeHash: lockedSnapshot.snapshotHash,
        afterHash: sha256({ inputs: nextInputs, points: prepared.scaledPointInputs ?? null }),
        metadata: {
          baseVersionId: baseVersion.id,
          baseSnapshotId: params.baseSnapshotId,
          changedInputKeys,
          sourceRef,
          targetGrossSalesMonth1: params.targetGrossSalesMonth1 ?? null,
        },
      });
    },
  })).then(result => ({ ...result, changedInputKeys, simulation: prepared.simulation }));
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
  return db.transaction(async transaction => {
    await transaction.execute(
      sql`SELECT id FROM project_versions WHERE id = ${version.id} FOR UPDATE`
    );
    const currentVersion = (
      await transaction
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.id, version.id))
        .limit(1)
    )[0];
    if (!currentVersion)
      throw new Error("A versão do snapshot deixou de existir.");
    const existingApproval = (
      await transaction
        .select({ id: approvalDecisions.id })
        .from(approvalDecisions)
        .where(
          and(
            eq(approvalDecisions.snapshotId, snapshot[0].id),
            eq(approvalDecisions.decision, "approved")
          )
        )
        .limit(1)
    )[0];
    if (existingApproval) {
      return {
        approved: true as const,
        snapshotId: snapshot[0].id,
        idempotent: true as const,
      };
    }
    if (currentVersion.state !== "in_review") {
      throw new Error(
        "A aprovação só pode nascer de uma versão em revisão."
      );
    }
    await transaction.insert(approvalDecisions).values({
      id: nanoid(),
      snapshotId: snapshot[0].id,
      decision: "approved",
      rationale: params.rationale,
      decidedBy: params.actorId,
    });
    await transaction.insert(workflowEvents).values({
      id: nanoid(),
      projectId: version.projectId,
      versionId: version.id,
      fromState: "in_review",
      toState: "approved",
      action: "snapshot.approved",
      rationale: params.rationale,
      actorId: params.actorId,
    });
    await transaction
      .update(projectVersions)
      .set({ state: "approved" })
      .where(eq(projectVersions.id, version.id));
    await transaction
      .update(projects)
      .set({ status: "approved" })
      .where(eq(projects.id, version.projectId));
    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "calculation_snapshot",
      entityId: snapshot[0].id,
      action: "snapshot.approved",
      actorId: params.actorId,
      afterHash: snapshot[0].snapshotHash,
      metadata: { rationale: params.rationale },
    });
    return {
      approved: true as const,
      snapshotId: snapshot[0].id,
      idempotent: false as const,
    };
  });
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
  const calculation =
    snapshot.payload as unknown as import("../shared/financial/types").FinancialCalculation;
  return db.transaction(async transaction => {
    await transaction.execute(
      sql`SELECT id FROM project_versions WHERE id = ${version.id} FOR UPDATE`
    );
    const currentVersion = (
      await transaction
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.id, version.id))
        .limit(1)
    )[0];
    if (!currentVersion)
      throw new Error("A versão do snapshot deixou de existir.");
    const approval = (
      await transaction
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
    if (currentVersion.state === "baseline") {
      const existingBenchmark = (
        await transaction
          .select({ id: historicalBenchmarks.id })
          .from(historicalBenchmarks)
          .where(
            and(
              eq(historicalBenchmarks.tenantId, params.tenantId),
              eq(
                historicalBenchmarks.sourceRef,
                `snapshot:${snapshot.snapshotHash}`
              )
            )
          )
          .limit(1)
      )[0];
      if (!existingBenchmark) {
        throw new Error(
          "A versão já é baseline de outro lifecycle; congelamento recusado."
        );
      }
      return {
        versionId: currentVersion.id,
        baseline: true as const,
        idempotent: true as const,
      };
    }
    if (currentVersion.state !== "approved")
      throw new Error(
        "A versão precisa estar aprovada antes de congelar baseline."
      );
    await transaction.insert(workflowEvents).values({
      id: nanoid(),
      projectId: currentVersion.projectId,
      versionId: currentVersion.id,
      fromState: "approved",
      toState: "baseline",
      action: "baseline.frozen",
      actorId: params.actorId,
    });
    await transaction
      .update(projectVersions)
      .set({ state: "baseline", kind: "baseline", isImmutable: true })
      .where(eq(projectVersions.id, currentVersion.id));
    await transaction
      .update(projects)
      .set({ status: "baseline" })
      .where(eq(projects.id, currentVersion.projectId));
    await transaction.insert(historicalBenchmarks).values({
      id: nanoid(),
      tenantId: params.tenantId,
      name: `Baseline interno ${currentVersion.projectId.slice(0, 8)}`,
      vertical: "internal_decision",
      periodLabel: new Date().toISOString().slice(0, 10),
      status: "provided",
      metrics: calculation.kpis as unknown as Record<string, unknown>,
      sourceType: "derived_analysis",
      sourceRef: `snapshot:${snapshot.snapshotHash}`,
      createdBy: params.actorId,
    });
    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "project_version",
      entityId: currentVersion.id,
      action: "baseline.frozen",
      actorId: params.actorId,
      afterHash: snapshot.snapshotHash,
    });
    return {
      versionId: currentVersion.id,
      baseline: true as const,
      idempotent: false as const,
    };
  });
}

export async function calculateCapitalEnvelopeForTenant(params: {
  tenantId: number;
  versionId: string;
  horizonMonths: number;
  asOfMonth?: number;
  availableCapital: string;
}) {
  const context = await getAuthoritativeCalculationContext({
    tenantId: params.tenantId,
    versionId: params.versionId,
    asOfMonth: params.asOfMonth ?? 0,
    horizonMonths: params.horizonMonths,
  });
  if (!context.calculationInputs || context.domainBlockers.length || context.domainInvalidities.length)
    throw new Error("Capital Envelope exige produto, condição comercial, política de carteira, pontos de captação e operações comerciais válidos, sem itens pendentes.");
  const calculation = calculateFinancialProjection(
    context.calculationInputs,
    params.horizonMonths,
    context.calculationOptions
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

export type ProjectGoalSeekVariable = GoalSeekVariableKey;
export type ProjectGoalSeekKpi = GoalSeekTargetKey;
export const PROJECT_GOAL_SEEK_VARIABLES = GOAL_SEEK_LEVER_KEYS;
export const PROJECT_GOAL_SEEK_KPIS = GOAL_SEEK_TARGET_KEYS;

export async function applyGoalSeekToScenarioForTenant(params: {
  tenantId: number;
  actorId: number;
  targetVersionId: string;
  sourceVersionId: string;
  horizonMonths?: number;
  asOfMonth?: number;
  variableKey: ProjectGoalSeekVariable;
  value: string;
  targetKpi: ProjectGoalSeekKpi;
  target: string;
  lowerBound?: string;
  upperBound?: string;
  objectiveValue: string;
  residual: string;
  iterations: number;
}) {
  const db = await requireDb();
  const targetVersion = await getVersionForTenant(params.targetVersionId, params.tenantId);
  const sourceVersion = await getVersionForTenant(params.sourceVersionId, params.tenantId);
  if (targetVersion.projectId !== sourceVersion.projectId)
    throw new Error("Goal Seek só pode ser aplicado em branch do mesmo projeto da análise.");
  if (targetVersion.kind !== "scenario")
    throw new Error("Goal Seek só pode ser aplicado em branch de cenário.");
  if (targetVersion.isImmutable || targetVersion.state !== "draft")
    throw new Error("Goal Seek só pode alterar branch de cenário em rascunho.");
  if (!Number.isInteger(params.iterations) || params.iterations < 1)
    throw new Error("Goal Seek aplicado exige número positivo de iterações.");
  const horizonMonths = params.horizonMonths ?? 120;
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 120)
    throw new Error("Goal Seek aplicado exige horizonte entre 1 e 120 meses.");
  const asOfMonth = params.asOfMonth ?? 0;
  if (!Number.isInteger(asOfMonth) || asOfMonth < 0 || asOfMonth > 1200)
    throw new Error("Goal Seek aplicado exige mês de referência válido.");

  const value = new FinanceDecimal(params.value);
  const target = new FinanceDecimal(params.target);
  const lowerBound = new FinanceDecimal(
    params.lowerBound ?? GOAL_SEEK_LEVERS[params.variableKey].lowerBound
  );
  const upperBound = new FinanceDecimal(
    params.upperBound ?? GOAL_SEEK_LEVERS[params.variableKey].upperBound
  );
  const objective = new FinanceDecimal(params.objectiveValue);
  const residual = new FinanceDecimal(params.residual);
  if (
    ![value, target, lowerBound, upperBound, objective, residual].every(decimal =>
      decimal.isFinite()
    )
  )
    throw new Error("Goal Seek aplicado exige valores decimais finitos.");
  if (value.isNegative())
    throw new Error("O valor aplicado pelo Goal Seek deve ser decimal não negativo.");
  const lever = GOAL_SEEK_LEVERS[params.variableKey];
  if (value.lt(lever.lowerBound) || value.gt(lever.upperBound))
    throw new Error(
      `O valor aplicado pelo Goal Seek para ${params.variableKey} deve ficar entre ${lever.lowerBound} e ${lever.upperBound}.`
    );

  const normalizedValue = value.toFixed(8);
  const normalizedTarget = target.toFixed(8);
  const normalizedLowerBound = lowerBound.toFixed(8);
  const normalizedUpperBound = upperBound.toFixed(8);
  const normalizedObjective = objective.toFixed(8);
  const normalizedResidual = residual.toFixed(8);
  const operationHash = sha256({
    targetVersionId: targetVersion.id,
    sourceVersionId: sourceVersion.id,
    horizonMonths,
    asOfMonth,
    variableKey: params.variableKey,
    value: normalizedValue,
    targetKpi: params.targetKpi,
    target: normalizedTarget,
    lowerBound: normalizedLowerBound,
    upperBound: normalizedUpperBound,
    objectiveValue: normalizedObjective,
    residual: normalizedResidual,
    iterations: params.iterations,
  });
  const decisionId = `goal_${operationHash.slice(0, 48)}`;
  const sourceRef = `goal_seek:${operationHash}`;
  const existingDecision = await db
    .select({ id: decisionRecords.id })
    .from(decisionRecords)
    .where(eq(decisionRecords.id, decisionId))
    .limit(1);
  if (existingDecision[0]) {
    return {
      applied: false as const,
      idempotent: true as const,
      versionId: targetVersion.id,
      decisionId,
      inputHash: targetVersion.inputHash,
    };
  }
  const previousInputs = await getInputsForVersion(targetVersion.id);
  const sourceInputs = targetVersion.id === sourceVersion.id
    ? previousInputs
    : await getInputsForVersion(sourceVersion.id);
  const solverInputIdentity = (inputs: FinancialInputSnapshot) =>
    Object.fromEntries(
      FINANCIAL_INPUT_KEYS.map(key => [
        key,
        { status: inputs[key].status, value: inputs[key].value },
      ])
    );
  const targetIsSolverSource = targetVersion.id === sourceVersion.id;
  const targetIsUnchangedClone =
    targetVersion.parentVersionId === sourceVersion.id &&
    stableSerialize(solverInputIdentity(previousInputs)) ===
      stableSerialize(solverInputIdentity(sourceInputs));
  if (!targetIsSolverSource && !targetIsUnchangedClone)
    throw new Error(
      "A branch-alvo divergiu da fonte do Goal Seek; execute novamente sobre a própria branch."
    );
  const serverResult = await runProjectGoalSeekForTenant({
    tenantId: params.tenantId,
    versionId: targetVersion.id,
    horizonMonths,
    asOfMonth,
    targetKpi: params.targetKpi,
    variableKey: params.variableKey,
    target: normalizedTarget,
    lowerBound: normalizedLowerBound,
    upperBound: normalizedUpperBound,
  });
  if (
    serverResult.status !== "converged" ||
    !serverResult.result ||
    !serverResult.objectiveValue ||
    serverResult.residual === null
  )
    throw new Error("Goal Seek aplicado exige resultado convergido calculado no servidor.");
  const serverResultValue = new FinanceDecimal(serverResult.result).toFixed(8);
  const serverObjective = new FinanceDecimal(serverResult.objectiveValue).toFixed(8);
  const serverResidual = new FinanceDecimal(serverResult.residual).toFixed(8);
  if (
    serverResultValue !== normalizedValue ||
    serverObjective !== normalizedObjective ||
    serverResidual !== normalizedResidual ||
    serverResult.iterations !== params.iterations ||
    serverResult.target !== normalizedTarget ||
    serverResult.lowerBound !== normalizedLowerBound ||
    serverResult.upperBound !== normalizedUpperBound ||
    serverResult.variableKey !== params.variableKey ||
    serverResult.targetKpi !== params.targetKpi
  )
    throw new Error("Payload do Goal Seek diverge do resultado recalculado no servidor.");
  const nextInputs: FinancialInputSnapshot = {
    ...previousInputs,
    [params.variableKey]: {
      status: "provided",
      value: normalizedValue,
      sourceType: "derived_analysis",
      sourceRef,
      updatedBy: String(params.actorId),
    },
  };
  const inputHash = sha256(nextInputs);
  const rationale = [
    `Goal Seek ${params.targetKpi} = ${normalizedTarget}.`,
    `Objetivo calculado ${normalizedObjective}; resíduo ${normalizedResidual}.`,
    `${params.iterations} iterações.`,
  ].join(" ");
  const decision = {
    id: decisionId,
    projectId: targetVersion.projectId,
    versionId: targetVersion.id,
    inputKey: params.variableKey,
    title: `Goal Seek aplicado · ${params.variableKey}`,
    decisionValue: normalizedValue,
    rationale,
    responsible: "Goal Seek determinístico",
    sourceRef,
    status: "accepted" as const,
    createdBy: params.actorId,
  };

  await db.transaction(async transaction => {
    const lockedTargetRows = await transaction
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.id, targetVersion.id))
      .for("update")
      .limit(1);
    const lockedTarget = lockedTargetRows[0];
    if (!lockedTarget)
      throw new Error("A branch-alvo deixou de existir durante a aplicação do Goal Seek.");
    if (
      lockedTarget.kind !== "scenario" ||
      lockedTarget.state !== "draft" ||
      lockedTarget.isImmutable
    )
      throw new Error("A branch-alvo deixou de estar editável durante a aplicação do Goal Seek.");
    if (
      lockedTarget.inputHash !== targetVersion.inputHash ||
      lockedTarget.financialRevision !== targetVersion.financialRevision
    )
      throw new Error(
        "A branch-alvo mudou durante o Goal Seek; execute novamente sobre o estado atual."
      );
    const lockedInputRows = await transaction
      .select()
      .from(inputValues)
      .where(eq(inputValues.versionId, targetVersion.id))
      .for("update");
    const lockedSavedInputs = Object.fromEntries(
      lockedInputRows.map(row => [
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
    const lockedInputs = Object.fromEntries(
      FINANCIAL_INPUT_KEYS.map(key => [
        key,
        lockedSavedInputs[key] ?? {
          status: "pending",
          sourceType: "current_decision",
        },
      ])
    ) as FinancialInputSnapshot;
    if (stableSerialize(lockedInputs) !== stableSerialize(previousInputs))
      throw new Error(
        "Os inputs da branch-alvo mudaram durante o Goal Seek; execute novamente."
      );
    await transaction.insert(decisionRecords).values(decision);
    await transaction.insert(inputValues).values({
      id: nanoid(),
      versionId: targetVersion.id,
      key: params.variableKey,
      status: "provided",
      valueText: normalizedValue,
      sourceType: "derived_analysis",
      sourceRef,
      updatedBy: params.actorId,
    }).onDuplicateKeyUpdate({ set: {
      status: "provided",
      valueText: normalizedValue,
      sourceType: "derived_analysis",
      sourceRef,
      updatedBy: params.actorId,
    } });
    const updateResult = await transaction
      .update(projectVersions)
      .set({
        inputHash,
        financialRevision: sql`${projectVersions.financialRevision} + 1`,
      })
      .where(
        and(
          eq(projectVersions.id, targetVersion.id),
          eq(projectVersions.state, "draft"),
          eq(projectVersions.isImmutable, false),
          eq(projectVersions.inputHash, targetVersion.inputHash),
          eq(
            projectVersions.financialRevision,
            targetVersion.financialRevision
          )
        )
      );
    if (updateResult[0].affectedRows !== 1)
      throw new Error(
        "A branch-alvo mudou durante a gravação do Goal Seek; nenhuma alteração foi aplicada."
      );
    await transaction.insert(workflowEvents).values({
      id: `gwf_${operationHash.slice(0, 48)}`,
      projectId: targetVersion.projectId,
      versionId: targetVersion.id,
      fromState: "draft",
      toState: "draft",
      action: "goal_seek.applied",
      rationale,
      actorId: params.actorId,
    });
    await transaction.insert(auditEvents).values([
      {
        id: `gad_${operationHash.slice(0, 48)}`,
        tenantId: params.tenantId,
        entityType: "decision_record",
        entityId: decisionId,
        action: "goal_seek.applied",
        actorId: params.actorId,
        afterHash: sha256(decision),
        metadata: {
          sourceVersionId: sourceVersion.id,
          targetVersionId: targetVersion.id,
          variableKey: params.variableKey,
          targetKpi: params.targetKpi,
          financialRevisionBefore: targetVersion.financialRevision,
          financialRevisionAfter: targetVersion.financialRevision + 1,
        },
      },
      {
        id: `gai_${operationHash.slice(0, 48)}`,
        tenantId: params.tenantId,
        entityType: "project_version",
        entityId: targetVersion.id,
        action: "inputs.updated",
        actorId: params.actorId,
        beforeHash: targetVersion.inputHash,
        afterHash: inputHash,
        metadata: {
          changedInputKeys: [params.variableKey],
          source: "goal_seek",
          sourceVersionId: sourceVersion.id,
          decisionId,
          financialRevisionBefore: targetVersion.financialRevision,
          financialRevisionAfter: targetVersion.financialRevision + 1,
        },
      },
    ]);
  });

  return {
    applied: true as const,
    idempotent: false as const,
    versionId: targetVersion.id,
    decisionId,
    inputHash,
  };
}

export async function runProjectGoalSeekForTenant(params: {
  tenantId: number;
  versionId: string;
  horizonMonths: number;
  asOfMonth?: number;
  targetKpi: ProjectGoalSeekKpi;
  variableKey: ProjectGoalSeekVariable;
  target: string;
  lowerBound: string;
  upperBound: string;
}) {
  const lowerBound = new FinanceDecimal(params.lowerBound);
  const upperBound = new FinanceDecimal(params.upperBound);
  if (!lowerBound.isFinite() || !upperBound.isFinite())
    throw new Error("Os limites do Goal Seek devem ser decimais finitos.");
  await getVersionForTenant(params.versionId, params.tenantId);
  if (!GOAL_SEEK_TARGETS[params.targetKpi].supported) {
    return runGoalSeekV1({
      targetKpi: params.targetKpi,
      variableKey: params.variableKey,
      target: params.target,
      lowerBound: params.lowerBound,
      upperBound: params.upperBound,
      evaluate: () => {
        throw new Error("Target sem suporte não deve consultar a versão.");
      },
    });
  }
  const context = await getAuthoritativeCalculationContext({
    tenantId: params.tenantId,
    versionId: params.versionId,
    asOfMonth: params.asOfMonth ?? 0,
    horizonMonths: params.horizonMonths,
  });
  if (!context.calculationInputs || context.domainBlockers.length || context.domainInvalidities.length)
    throw new Error("Goal Seek exige produto, condição comercial, política de carteira, pontos de captação e operações comerciais válidos, sem itens pendentes.");
  const inputs = context.calculationInputs;
  const baseline = calculateFinancialProjection(inputs, params.horizonMonths, context.calculationOptions);
  if (baseline.status !== "valid")
    throw new Error(
      "Goal Seek exige todas as premissas obrigatórias informadas na versão selecionada."
    );
  return runGoalSeekV1({
    targetKpi: params.targetKpi,
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
        params.horizonMonths,
        context.calculationOptions
      );
      if (calculation.status !== "valid")
        throw new Error("A variável escolhida produziu cálculo bloqueado.");
      return calculation;
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

async function getExportScenarioComparisonEntries(params: {
  projectId: string;
  baseVersionId: string;
  baseVersion: {
    id: string;
    kind: "working" | "scenario" | "approval" | "baseline";
    state: "draft" | "in_review" | "approved" | "baseline";
    isImmutable: boolean;
  };
  baseSnapshot: {
    id: string;
    snapshotHash: string;
    horizonMonths: number;
    asOfMonth: number;
    payload: unknown;
  };
}): Promise<ExportPackScenarioComparisonEntry[]> {
  const db = await requireDb();
  const branches = (
    await db
      .select()
      .from(scenarioBranches)
      .where(
        and(
          eq(scenarioBranches.projectId, params.projectId),
          eq(scenarioBranches.baseVersionId, params.baseVersionId)
        )
      )
  ).sort((left, right) =>
    left.name.localeCompare(right.name) ||
    left.branchVersionId.localeCompare(right.branchVersionId)
  );
  const scenarioVersionIds = branches.map(branch => branch.branchVersionId);
  const scenarioVersions = scenarioVersionIds.length
    ? await db
        .select()
        .from(projectVersions)
        .where(inArray(projectVersions.id, scenarioVersionIds))
    : [];
  const scenarioSnapshotMetadata = scenarioVersionIds.length
    ? await db
        .select({
          id: calculationSnapshots.id,
          projectVersionId: calculationSnapshots.projectVersionId,
          createdOrdinal: calculationSnapshots.createdOrdinal,
        })
        .from(calculationSnapshots)
        .where(
          and(
            inArray(calculationSnapshots.projectVersionId, scenarioVersionIds),
            eq(calculationSnapshots.calculationStatus, "valid"),
            eq(calculationSnapshots.horizonMonths, params.baseSnapshot.horizonMonths),
            eq(calculationSnapshots.asOfMonth, params.baseSnapshot.asOfMonth)
          )
        )
        .orderBy(desc(calculationSnapshots.createdOrdinal))
    : [];
  const versionById = new Map(scenarioVersions.map(version => [version.id, version]));
  const latestSnapshotIdByVersion = new Map<string, string>();
  for (const snapshot of scenarioSnapshotMetadata) {
    if (!latestSnapshotIdByVersion.has(snapshot.projectVersionId))
      latestSnapshotIdByVersion.set(snapshot.projectVersionId, snapshot.id);
  }
  const latestSnapshotIds = Array.from(latestSnapshotIdByVersion.values());
  const scenarioSnapshots = latestSnapshotIds.length
    ? await db
        .select()
        .from(calculationSnapshots)
        .where(inArray(calculationSnapshots.id, latestSnapshotIds))
    : [];
  const latestSnapshotByVersion = new Map(
    scenarioSnapshots.map(snapshot => [snapshot.projectVersionId, snapshot])
  );
  const baseCalculation = params.baseSnapshot.payload as FinancialCalculation;
  return [
    {
      versionId: params.baseVersion.id,
      kind: params.baseVersion.kind,
      state: params.baseVersion.state,
      isImmutable: params.baseVersion.isImmutable,
      label: params.baseVersion.kind === "baseline" ? "Baseline" : "Base aprovada",
      reason: null,
      snapshotId: params.baseSnapshot.id,
      snapshotHash: params.baseSnapshot.snapshotHash,
      comparisonStatus: "comparable" as const,
      horizonMonths: params.baseSnapshot.horizonMonths,
      asOfMonth: params.baseSnapshot.asOfMonth,
      kpis: baseCalculation.kpis,
    },
    ...branches.flatMap(branch => {
      const version = versionById.get(branch.branchVersionId);
      if (!version) return [];
      const scenarioSnapshot = latestSnapshotByVersion.get(version.id);
      const calculation = scenarioSnapshot?.payload as FinancialCalculation | undefined;
      return [{
        versionId: version.id,
        kind: version.kind,
        state: version.state,
        isImmutable: version.isImmutable,
        label: branch.name,
        reason: branch.reason,
        snapshotId: scenarioSnapshot?.id ?? null,
        snapshotHash: scenarioSnapshot?.snapshotHash ?? null,
        comparisonStatus: scenarioSnapshot ? "comparable" as const : "not_comparable" as const,
        horizonMonths: scenarioSnapshot?.horizonMonths ?? null,
        asOfMonth: scenarioSnapshot?.asOfMonth ?? null,
        kpis: calculation?.kpis ?? null,
      }];
    }),
  ];
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
  const exportVersion = await getVersionForTenant(
    snapshotRows[0].projectVersionId,
    params.tenantId
  );
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
  const snapshot = createExportableSnapshot(
    snapshotRows[0].payload as unknown as FinancialCalculation,
    snapshotRows[0].snapshotHash,
    createScenarioComparisonPayload({
      baseSnapshotHash: snapshotRows[0].snapshotHash,
      entries: await getExportScenarioComparisonEntries({
        projectId: exportVersion.projectId,
        baseVersionId: exportVersion.id,
        baseVersion: exportVersion,
        baseSnapshot: snapshotRows[0],
      }),
    }),
  );
  let stored: Awaited<ReturnType<typeof storagePut>>;
  try {
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
    stored = await storagePut(
      `igr/${params.tenantId}/exports/${params.snapshotId}_${snapshot.exportPackHash.slice(0, 12)}.${extension}`,
      data,
      mimeType
    );
  } catch (error) {
    await db.transaction(async transaction => {
      await transaction
        .update(exportArtifacts)
        .set({ status: "failed" })
        .where(eq(exportArtifacts.id, artifactId));
      await transaction.insert(auditEvents).values({
        id: nanoid(),
        tenantId: params.tenantId,
        entityType: "export_artifact",
        entityId: artifactId,
        action: "export.failed",
        actorId: params.actorId,
        metadata: { snapshotId: params.snapshotId, format: params.format },
      });
    });
    throw error;
  }
  await db.transaction(async transaction => {
    await transaction
      .update(exportArtifacts)
      .set({ status: "generated", storageKey: stored.key })
      .where(eq(exportArtifacts.id, artifactId));
    await transaction.insert(auditEvents).values({
      id: nanoid(),
      tenantId: params.tenantId,
      entityType: "export_artifact",
      entityId: artifactId,
      action: "export.generated",
      actorId: params.actorId,
      metadata: {
        snapshotId: params.snapshotId,
        format: params.format,
        snapshotHash: snapshot.snapshotHash,
        exportPackHash: snapshot.exportPackHash,
        scenarioSelectionHash: snapshot.scenarioComparison?.selectionHash,
        scenarioEntryCount: snapshot.scenarioComparison?.entries.length ?? 0,
        storageKey: stored.key,
      },
    });
  });
  return {
    artifactId,
    snapshotHash: snapshot.snapshotHash,
    exportPackHash: snapshot.exportPackHash,
    url: stored.url,
  };
}
