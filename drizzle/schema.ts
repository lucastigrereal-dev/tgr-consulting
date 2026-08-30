import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const projects = mysqlTable(
  "projects",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    tenantId: int("tenantId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    vertical: varchar("vertical", { length: 120 }).default("multipropriedade").notNull(),
    status: mysqlEnum("status", ["draft", "in_review", "approved", "baseline"]).default("draft").notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("projects_tenant_idx").on(table.tenantId), index("projects_creator_idx").on(table.createdBy)],
);

export const formulaSetVersions = mysqlTable(
  "formula_set_versions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    semanticVersion: varchar("semanticVersion", { length: 32 }).notNull(),
    engineVersion: varchar("engineVersion", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["draft", "published", "retired"]).default("draft").notNull(),
    definitions: json("definitions").notNull(),
    publishedBy: int("publishedBy"),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("formula_set_versions_semantic_unique").on(table.semanticVersion)],
);

export const formulaDefinitionProvenance = mysqlTable(
  "formula_definition_provenance",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    formulaSetVersionId: varchar("formulaSetVersionId", { length: 64 }).notNull(),
    formulaId: varchar("formulaId", { length: 160 }).notNull(),
    formulaVersion: varchar("formulaVersion", { length: 32 }).notNull(),
    expression: varchar("expression", { length: 4000 }).notNull(),
    dependencyKeys: json("dependencyKeys").notNull(),
    description: varchar("description", { length: 2000 }).notNull(),
    sourceRef: varchar("sourceRef", { length: 500 }).notNull(),
    publishedBy: int("publishedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("formula_definition_provenance_unique").on(table.formulaSetVersionId, table.formulaId),
    index("formula_definition_provenance_set_idx").on(table.formulaSetVersionId),
  ],
);

export const projectVersions = mysqlTable(
  "project_versions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    projectId: varchar("projectId", { length: 64 }).notNull(),
    parentVersionId: varchar("parentVersionId", { length: 64 }),
    formulaSetVersionId: varchar("formulaSetVersionId", { length: 64 }).notNull(),
    kind: mysqlEnum("kind", ["working", "scenario", "approval", "baseline"]).default("working").notNull(),
    state: mysqlEnum("state", ["draft", "in_review", "approved", "baseline"]).default("draft").notNull(),
    isImmutable: boolean("isImmutable").default(false).notNull(),
    inputHash: varchar("inputHash", { length: 64 }).notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("project_versions_project_idx").on(table.projectId),
    index("project_versions_parent_idx").on(table.parentVersionId),
    index("project_versions_formula_idx").on(table.formulaSetVersionId),
  ],
);

export const inputValues = mysqlTable(
  "input_values",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    versionId: varchar("versionId", { length: 64 }).notNull(),
    key: varchar("key", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["provided", "pending"]).notNull(),
    valueText: varchar("valueText", { length: 255 }),
    sourceType: mysqlEnum("sourceType", [
      "current_decision",
      "current_document",
      "historical_primary",
      "derived_analysis",
      "external_benchmark",
      "assumption",
    ]).notNull(),
    sourceRef: varchar("sourceRef", { length: 500 }),
    updatedBy: int("updatedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("input_values_version_key_unique").on(table.versionId, table.key),
    index("input_values_version_idx").on(table.versionId),
  ],
);

export const projectComponentRecords = mysqlTable(
  "project_component_records",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    versionId: varchar("versionId", { length: 64 }).notNull(),
    componentType: mysqlEnum("componentType", [
      "project_assembly", "product_stock", "pricing_payments", "acquisition_capacity", "costs_workforce",
      "commissions_partners", "receivables_losses", "capex_opex",
    ]).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["provided", "pending"]).notNull(),
    payload: json("payload").notNull(),
    sourceType: mysqlEnum("sourceType", [
      "current_decision", "current_document", "historical_primary", "derived_analysis", "external_benchmark", "assumption",
    ]).notNull(),
    sourceRef: varchar("sourceRef", { length: 500 }),
    updatedBy: int("updatedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("project_component_records_version_idx").on(table.versionId, table.componentType)],
);

export const productSkus = mysqlTable(
  "product_skus",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    versionId: varchar("versionId", { length: 64 })
      .notNull()
      .references(() => projectVersions.id, { onDelete: "cascade" }),
    skuCode: varchar("skuCode", { length: 120 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    unitType: varchar("unitType", { length: 255 }).notNull(),
    unitQuantity: int("unitQuantity").notNull(),
    sharesPerUnit: int("sharesPerUnit").notNull(),
    grossSoldShares: int("grossSoldShares").default(0).notNull(),
    returnedShares: int("returnedShares").default(0).notNull(),
    blockedShares: int("blockedShares").default(0).notNull(),
    status: mysqlEnum("status", ["provided", "pending"]).notNull(),
    sourceType: mysqlEnum("sourceType", ["current_decision", "current_document", "historical_primary", "derived_analysis", "external_benchmark", "assumption"]).notNull(),
    sourceRef: varchar("sourceRef", { length: 500 }),
    updatedBy: int("updatedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("product_skus_version_code_unique").on(table.versionId, table.skuCode), index("product_skus_version_idx").on(table.versionId)]
);

export const productPricePhases = mysqlTable(
  "product_price_phases",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    productSkuId: varchar("productSkuId", { length: 64 })
      .notNull()
      .references(() => productSkus.id, { onDelete: "cascade" }),
    phaseCode: varchar("phaseCode", { length: 120 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    startsAtMonth: int("startsAtMonth").notNull(),
    priceText: varchar("priceText", { length: 255 }).notNull(),
    promotionalPriceText: varchar("promotionalPriceText", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("product_price_phases_sku_code_unique").on(table.productSkuId, table.phaseCode), uniqueIndex("product_price_phases_sku_month_unique").on(table.productSkuId, table.startsAtMonth), index("product_price_phases_sku_idx").on(table.productSkuId)]
);

export const commercialConditions = mysqlTable(
  "commercial_conditions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    versionId: varchar("versionId", { length: 64 })
      .notNull()
      .references(() => projectVersions.id, { onDelete: "cascade" }),
    productSkuId: varchar("productSkuId", { length: 64 }).references(() => productSkus.id, { onDelete: "set null" }),
    conditionCode: varchar("conditionCode", { length: 120 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    listPriceText: varchar("listPriceText", { length: 255 }).notNull(),
    discountText: varchar("discountText", { length: 255 }).default("0").notNull(),
    entryTotalText: varchar("entryTotalText", { length: 255 }).notNull(),
    entryInstallments: int("entryInstallments").notNull(),
    entryFirstDueMonth: int("entryFirstDueMonth").notNull(),
    balancePrincipalText: varchar("balancePrincipalText", {
      length: 255,
    }).notNull(),
    balanceInstallments: int("balanceInstallments").notNull(),
    graceMonths: int("graceMonths").default(0).notNull(),
    balanceFirstDueMonth: int("balanceFirstDueMonth").notNull(),
    explicitChargesText: varchar("explicitChargesText", { length: 255 }).default("0").notNull(),
    explicitChargesDueMonth: int("explicitChargesDueMonth"),
    correctionRateText: varchar("correctionRateText", { length: 255 }),
    interestRateText: varchar("interestRateText", { length: 255 }),
    materialityToleranceText: varchar("materialityToleranceText", {
      length: 255,
    })
      .default("0.01")
      .notNull(),
    campaign: varchar("campaign", { length: 255 }),
    status: mysqlEnum("status", ["provided", "pending"]).notNull(),
    sourceType: mysqlEnum("sourceType", ["current_decision", "current_document", "historical_primary", "derived_analysis", "external_benchmark", "assumption"]).notNull(),
    sourceRef: varchar("sourceRef", { length: 500 }),
    updatedBy: int("updatedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("commercial_conditions_version_code_unique").on(table.versionId, table.conditionCode), index("commercial_conditions_version_idx").on(table.versionId), index("commercial_conditions_sku_idx").on(table.productSkuId)]
);

export const receivablesPolicies = mysqlTable(
  "receivables_policies",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    versionId: varchar("versionId", { length: 64 })
      .notNull()
      .references(() => projectVersions.id, { onDelete: "cascade" }),
    cancellationD7Text: varchar("cancellationD7Text", { length: 255 }).notNull(),
    cancellationD30Text: varchar("cancellationD30Text", { length: 255 }).notNull(),
    cancellationD60Text: varchar("cancellationD60Text", { length: 255 }).notNull(),
    cancellationD90Text: varchar("cancellationD90Text", { length: 255 }).notNull(),
    cancellationD180Text: varchar("cancellationD180Text", { length: 255 }).notNull(),
    cancellationLifetimeText: varchar("cancellationLifetimeText", { length: 255 }).notNull(),
    delinquencyRateText: varchar("delinquencyRateText", { length: 255 }).notNull(),
    cureDays1To30Text: varchar("cureDays1To30Text", { length: 255 }).notNull(),
    cureDays31To60Text: varchar("cureDays31To60Text", { length: 255 }).notNull(),
    cureDays61To90Text: varchar("cureDays61To90Text", { length: 255 }).notNull(),
    cureDays90PlusText: varchar("cureDays90PlusText", { length: 255 }).notNull(),
    writeOffAfterDays: int("writeOffAfterDays").notNull(),
    policyVersion: varchar("policyVersion", { length: 120 }).notNull(),
    status: mysqlEnum("status", ["provided", "pending"]).notNull(),
    sourceType: mysqlEnum("sourceType", ["current_decision", "current_document", "historical_primary", "derived_analysis", "external_benchmark", "assumption"]).notNull(),
    sourceRef: varchar("sourceRef", { length: 500 }),
    updatedBy: int("updatedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("receivables_policies_version_unique").on(table.versionId)]
);

export const historicalBenchmarks = mysqlTable(
  "historical_benchmarks",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    tenantId: int("tenantId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    vertical: varchar("vertical", { length: 120 }).notNull(),
    periodLabel: varchar("periodLabel", { length: 120 }).notNull(),
    status: mysqlEnum("status", ["provided", "pending"]).notNull(),
    metrics: json("metrics").notNull(),
    sourceType: mysqlEnum("sourceType", [
      "current_decision", "current_document", "historical_primary", "derived_analysis", "external_benchmark", "assumption",
    ]).notNull(),
    sourceRef: varchar("sourceRef", { length: 500 }),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("historical_benchmarks_tenant_idx").on(table.tenantId, table.vertical)],
);

export const decisionRecords = mysqlTable(
  "decision_records",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    projectId: varchar("projectId", { length: 64 }).notNull(),
    versionId: varchar("versionId", { length: 64 }).notNull(),
    inputKey: varchar("inputKey", { length: 160 }),
    title: varchar("title", { length: 255 }).notNull(),
    decisionValue: varchar("decisionValue", { length: 1000 }).notNull(),
    rationale: varchar("rationale", { length: 2000 }).notNull(),
    responsible: varchar("responsible", { length: 255 }).notNull(),
    sourceRef: varchar("sourceRef", { length: 500 }),
    status: mysqlEnum("status", ["proposed", "accepted"]).default("accepted").notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("decision_records_project_idx").on(table.projectId, table.createdAt), index("decision_records_version_idx").on(table.versionId, table.createdAt)],
);

export const costCatalogItems = mysqlTable(
  "cost_catalog_items",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    versionId: varchar("versionId", { length: 64 }).notNull(),
    category: mysqlEnum("category", ["payroll", "occupancy", "technology", "marketing", "partner", "legal", "operations", "other"]).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    frequency: mysqlEnum("frequency", ["monthly", "annual", "one_time"]).notNull(),
    amountText: varchar("amountText", { length: 255 }),
    status: mysqlEnum("status", ["provided", "pending"]).notNull(),
    sourceType: mysqlEnum("sourceType", [
      "current_decision", "current_document", "historical_primary", "derived_analysis", "external_benchmark", "assumption",
    ]).notNull(),
    sourceRef: varchar("sourceRef", { length: 500 }),
    updatedBy: int("updatedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("cost_catalog_items_version_idx").on(table.versionId, table.category)],
);

export const calculationSnapshots = mysqlTable(
  "calculation_snapshots",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    projectVersionId: varchar("projectVersionId", { length: 64 }).notNull(),
    formulaSetVersionId: varchar("formulaSetVersionId", { length: 64 }).notNull(),
    horizonMonths: int("horizonMonths").notNull(),
    inputHash: varchar("inputHash", { length: 64 }).notNull(),
    snapshotHash: varchar("snapshotHash", { length: 64 }).notNull(),
    calculationStatus: mysqlEnum("calculationStatus", ["valid", "blocked_by_pending_inputs", "invalid"]).notNull(),
    validationStatus: mysqlEnum("validationStatus", ["pending", "valid", "failed"]).default("pending").notNull(),
    isAuthoritative: boolean("isAuthoritative").default(false).notNull(),
    payload: json("payload").notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("calculation_snapshots_hash_unique").on(table.snapshotHash),
    index("calculation_snapshots_version_idx").on(table.projectVersionId),
    index("calculation_snapshots_authority_idx").on(table.isAuthoritative, table.validationStatus),
  ],
);

export const kpiMemoryRecords = mysqlTable(
  "kpi_memory_records",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    snapshotId: varchar("snapshotId", { length: 64 }).notNull(),
    kpiKey: varchar("kpiKey", { length: 160 }).notNull(),
    valueText: varchar("valueText", { length: 255 }),
    formulaId: varchar("formulaId", { length: 160 }).notNull(),
    formulaVersion: varchar("formulaVersion", { length: 32 }).notNull(),
    dependencyKeys: json("dependencyKeys").notNull(),
    explanation: varchar("explanation", { length: 2000 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("kpi_memory_snapshot_key_unique").on(table.snapshotId, table.kpiKey)],
);

export const scenarioBranches = mysqlTable(
  "scenario_branches",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    projectId: varchar("projectId", { length: 64 }).notNull(),
    baseVersionId: varchar("baseVersionId", { length: 64 }).notNull(),
    branchVersionId: varchar("branchVersionId", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    reason: varchar("reason", { length: 1000 }).notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("scenario_branches_project_idx").on(table.projectId)],
);

export const approvalDecisions = mysqlTable(
  "approval_decisions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    snapshotId: varchar("snapshotId", { length: 64 }).notNull(),
    decision: mysqlEnum("decision", ["approved", "rejected"]).notNull(),
    rationale: varchar("rationale", { length: 2000 }).notNull(),
    decidedBy: int("decidedBy").notNull(),
    decidedAt: timestamp("decidedAt").defaultNow().notNull(),
  },
  (table) => [index("approval_decisions_snapshot_idx").on(table.snapshotId)],
);

export const workflowEvents = mysqlTable(
  "workflow_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    projectId: varchar("projectId", { length: 64 }).notNull(),
    versionId: varchar("versionId", { length: 64 }).notNull(),
    fromState: mysqlEnum("fromState", ["draft", "in_review", "approved", "baseline"]),
    toState: mysqlEnum("toState", ["draft", "in_review", "approved", "baseline"]).notNull(),
    action: varchar("action", { length: 160 }).notNull(),
    rationale: varchar("rationale", { length: 2000 }),
    actorId: int("actorId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("workflow_events_project_idx").on(table.projectId, table.createdAt),
    index("workflow_events_version_idx").on(table.versionId, table.createdAt),
  ],
);

export const exportArtifacts = mysqlTable(
  "export_artifacts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    snapshotId: varchar("snapshotId", { length: 64 }).notNull(),
    format: mysqlEnum("format", ["pdf", "pptx", "xlsx"]).notNull(),
    status: mysqlEnum("status", ["queued", "generated", "failed"]).default("queued").notNull(),
    storageKey: varchar("storageKey", { length: 500 }),
    generatedBy: int("generatedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("export_artifacts_snapshot_idx").on(table.snapshotId)],
);

export const auditEvents = mysqlTable(
  "audit_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    tenantId: int("tenantId").notNull(),
    entityType: varchar("entityType", { length: 120 }).notNull(),
    entityId: varchar("entityId", { length: 64 }).notNull(),
    action: varchar("action", { length: 160 }).notNull(),
    actorId: int("actorId").notNull(),
    beforeHash: varchar("beforeHash", { length: 64 }),
    afterHash: varchar("afterHash", { length: 64 }),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("audit_events_tenant_entity_idx").on(table.tenantId, table.entityType, table.entityId)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type ProjectVersion = typeof projectVersions.$inferSelect;
export type CalculationSnapshot = typeof calculationSnapshots.$inferSelect;
