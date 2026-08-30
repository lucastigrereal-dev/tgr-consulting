import { z } from "zod";
import { FormulaRegistry } from "../../shared/financial/formulaRegistry";
import { IGR_CORE_FORMULA_SET_V1 } from "../../shared/financial/formulas";
import { FinancialInputSnapshotSchema } from "../../shared/financial/inputSchema";
import {
  approveSnapshotForTenant,
  calculateCapitalEnvelopeForTenant,
  runProjectGoalSeekForTenant,
  simulateCaptadorChangeForTenant,
  createCalculationSnapshot,
  createCostCatalogItemForTenant,
  createDecisionRecordForTenant,
  createHistoricalBenchmarkForTenant,
  createProjectForTenant,
  createScenarioForTenant,
  getExportEligibilityForTenant,
  getProjectContextForTenant,
  getProjectForTenant,
  getScenarioComparisonForTenant,
  getInputsForVersion,
  listBuilderComponentsForTenant,
  listCostCatalogForTenant,
  listDecisionRecordsForTenant,
  listHistoricalBenchmarksForTenant,
  getVersionForTenant,
  listProjectsForTenant,
  generateAuthorizedExportForTenant,
  freezeBaselineForTenant,
  updateInputsForTenant,
  upsertBuilderComponentForTenant,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const tenantIdFromUser = (userId: number) => userId;
const provenanceSourceSchema = z.enum(["current_decision", "current_document", "historical_primary", "derived_analysis", "external_benchmark", "assumption"]);
const builderComponentSchema = z.enum(["project_assembly", "product_stock", "pricing_payments", "acquisition_capacity", "costs_workforce", "commissions_partners", "receivables_losses", "capex_opex"]);
const costCategorySchema = z.enum(["payroll", "occupancy", "technology", "marketing", "partner", "legal", "operations", "other"]);

export const igrRouter = router({
  projects: protectedProcedure.query(({ ctx }) => listProjectsForTenant(tenantIdFromUser(ctx.user.id))),
  project: protectedProcedure.input(z.object({ projectId: z.string().min(1) })).query(({ ctx, input }) =>
    getProjectForTenant(input.projectId, tenantIdFromUser(ctx.user.id)),
  ),
  projectContext: protectedProcedure.input(z.object({ projectId: z.string().min(1) })).query(({ ctx, input }) =>
    getProjectContextForTenant(input.projectId, tenantIdFromUser(ctx.user.id)),
  ),
  scenarioComparison: protectedProcedure.input(z.object({ projectId: z.string().min(1) })).query(({ ctx, input }) =>
    getScenarioComparisonForTenant(input.projectId, tenantIdFromUser(ctx.user.id)),
  ),
  versionInputs: protectedProcedure.input(z.object({ versionId: z.string().min(1) })).query(async ({ ctx, input }) => {
    await getVersionForTenant(input.versionId, tenantIdFromUser(ctx.user.id));
    return getInputsForVersion(input.versionId);
  }),
  decisions: protectedProcedure.input(z.object({ versionId: z.string().min(1) })).query(({ ctx, input }) =>
    listDecisionRecordsForTenant(input.versionId, tenantIdFromUser(ctx.user.id)),
  ),
  createDecision: protectedProcedure.input(z.object({
    versionId: z.string().min(1), inputKey: z.string().min(1).optional(), title: z.string().trim().min(3).max(255),
    decisionValue: z.string().trim().min(1).max(1000), rationale: z.string().trim().min(3).max(2000), responsible: z.string().trim().min(2).max(255), sourceRef: z.string().trim().min(2).max(500),
  })).mutation(({ ctx, input }) => createDecisionRecordForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  builderComponents: protectedProcedure.input(z.object({ versionId: z.string().min(1) })).query(({ ctx, input }) =>
    listBuilderComponentsForTenant(input.versionId, tenantIdFromUser(ctx.user.id)),
  ),
  costCatalog: protectedProcedure.input(z.object({ versionId: z.string().min(1) })).query(({ ctx, input }) =>
    listCostCatalogForTenant(input.versionId, tenantIdFromUser(ctx.user.id)),
  ),
  createCostCatalogItem: protectedProcedure.input(z.object({
    versionId: z.string().min(1), category: costCategorySchema, name: z.string().trim().min(2).max(255), frequency: z.enum(["monthly", "annual", "one_time"]),
    amountText: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/).optional(), status: z.enum(["provided", "pending"]), sourceType: provenanceSourceSchema, sourceRef: z.string().trim().max(500).optional(),
  }).refine((data) => data.status === "pending" || Boolean(data.sourceRef?.trim()), { message: "Custo informado exige fonte ou responsável.", path: ["sourceRef"] })).mutation(({ ctx, input }) => createCostCatalogItemForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  upsertBuilderComponent: protectedProcedure.input(z.object({
    versionId: z.string().min(1), componentType: builderComponentSchema, name: z.string().trim().min(2).max(255),
    status: z.enum(["provided", "pending"]), payload: z.record(z.string(), z.unknown()), sourceType: provenanceSourceSchema, sourceRef: z.string().trim().max(500).optional(),
  }).refine((data) => data.status === "pending" || Boolean(data.sourceRef?.trim()), { message: "Bloco informado exige fonte ou responsável.", path: ["sourceRef"] })).mutation(({ ctx, input }) => upsertBuilderComponentForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  historicalBenchmarks: protectedProcedure.query(({ ctx }) => listHistoricalBenchmarksForTenant(tenantIdFromUser(ctx.user.id))),
  createHistoricalBenchmark: protectedProcedure.input(z.object({
    name: z.string().trim().min(2).max(255), vertical: z.string().trim().min(2).max(120), periodLabel: z.string().trim().min(2).max(120),
    status: z.enum(["provided", "pending"]), metrics: z.record(z.string(), z.unknown()), sourceType: provenanceSourceSchema, sourceRef: z.string().trim().max(500).optional(),
  }).refine((data) => data.status === "pending" || Boolean(data.sourceRef?.trim()), { message: "Benchmark informado exige fonte primária.", path: ["sourceRef"] })).mutation(({ ctx, input }) => createHistoricalBenchmarkForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  createProject: protectedProcedure
    .input(z.object({ name: z.string().trim().min(3).max(255), inputs: FinancialInputSnapshotSchema }))
    .mutation(({ ctx, input }) => createProjectForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  updateInputs: protectedProcedure
    .input(z.object({ versionId: z.string().min(1), inputs: FinancialInputSnapshotSchema }))
    .mutation(({ ctx, input }) => updateInputsForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  calculate: protectedProcedure
    .input(z.object({ versionId: z.string().min(1), horizonMonths: z.number().int().min(1).max(120) }))
    .mutation(({ ctx, input }) => createCalculationSnapshot({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  simulateCaptadores: protectedProcedure
    .input(z.object({ versionId: z.string().min(1), horizonMonths: z.number().int().min(1).max(120), captadorDelta: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/), qualifiedCouplesPerCaptadorMonth: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/), loadedCostPerCaptadorMonth: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/), averageTicketDelta: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/).optional(), fixedCostMonthlyDelta: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/).optional(), payrollMonthlyDelta: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/).optional(), variableCostMonthlyDelta: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/).optional(), capexInitialDelta: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/).optional() }))
    .mutation(({ ctx, input }) => simulateCaptadorChangeForTenant({ tenantId: tenantIdFromUser(ctx.user.id), ...input })),
  createScenario: protectedProcedure
    .input(z.object({ baseVersionId: z.string().min(1), name: z.string().trim().min(3).max(255), reason: z.string().trim().min(3).max(1000) }))
    .mutation(({ ctx, input }) => createScenarioForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  approveSnapshot: protectedProcedure
    .input(z.object({ snapshotId: z.string().min(1), rationale: z.string().trim().min(3).max(2000) }))
    .mutation(({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new Error("Somente administrador técnico pode aprovar snapshot.");
      return approveSnapshotForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input });
    }),
  freezeBaseline: protectedProcedure.input(z.object({ snapshotId: z.string().min(1) })).mutation(({ ctx, input }) => {
    if (ctx.user.role !== "admin") throw new Error("Somente administrador técnico pode congelar baseline.");
    return freezeBaselineForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input });
  }),
  capitalEnvelope: protectedProcedure
    .input(z.object({ versionId: z.string().min(1), horizonMonths: z.number().int().min(1).max(120), availableCapital: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/) }))
    .query(({ ctx, input }) => calculateCapitalEnvelopeForTenant({ tenantId: tenantIdFromUser(ctx.user.id), ...input })),
  exportEligibility: protectedProcedure.input(z.object({ snapshotId: z.string().min(1) })).query(({ ctx, input }) =>
    getExportEligibilityForTenant(input.snapshotId, tenantIdFromUser(ctx.user.id)),
  ),
  requestExport: protectedProcedure
    .input(z.object({ snapshotId: z.string().min(1), format: z.enum(["pdf", "pptx", "xlsx"]) }))
    .mutation(({ ctx, input }) => generateAuthorizedExportForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  goalSeek: protectedProcedure
    .input(z.object({ versionId: z.string().min(1), horizonMonths: z.number().int().min(1).max(120), targetKpi: z.enum(["npv", "totalOperatingCashFlow"]), variableKey: z.enum(["qualifiedCouplesMonth1", "conversionRate", "averageTicket"]), target: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/), lowerBound: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/), upperBound: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/) }))
    .mutation(({ ctx, input }) => runProjectGoalSeekForTenant({ tenantId: tenantIdFromUser(ctx.user.id), ...input })),
  lineage: protectedProcedure.input(z.object({ formulaId: z.string().min(1) })).query(({ input }) => {
    const registry = new FormulaRegistry([IGR_CORE_FORMULA_SET_V1], IGR_CORE_FORMULA_SET_V1.id);
    return registry.getLineage(input.formulaId);
  }),
});
