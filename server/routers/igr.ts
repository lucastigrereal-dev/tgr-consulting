import { z } from "zod";
import { FormulaRegistry } from "../../shared/financial/formulaRegistry";
import { IGR_CORE_FORMULA_SET_V1 } from "../../shared/financial/formulas";
import { FinancialInputSnapshotSchema } from "../../shared/financial/inputSchema";
import {
  approveSnapshotForTenant,
  applyGoalSeekToScenarioForTenant,
  calculateCapitalEnvelopeForTenant,
  runProjectGoalSeekForTenant,
  simulateCaptadorChangeForTenant,
  createCalculationSnapshot,
  createCostCatalogItemForTenant,
  createDecisionRecordForTenant,
  createHistoricalBenchmarkForTenant,
  createProjectFromCotiaAssemblyForTenant,
  createProjectForTenant,
  createScenarioForTenant,
  promoteMeetingSimulationToScenarioForTenant,
  getExportEligibilityForTenant,
  getCapturePointsForTenant,
  getCommercialOperationsForTenant,
  getProductCatalogForTenant,
  getReceivablesPolicyForTenant,
  getProjectContextForTenant,
  getProjectForTenant,
  getScenarioComparisonForTenant,
  getInputsForVersion,
  PROJECT_GOAL_SEEK_KPIS,
  PROJECT_GOAL_SEEK_VARIABLES,
  listBuilderComponentsForTenant,
  listCostCatalogForTenant,
  listCommercialConditionsForTenant,
  listDecisionRecordsForTenant,
  listHistoricalBenchmarksForTenant,
  getVersionForTenant,
  listProjectsForTenant,
  generateAuthorizedExportForTenant,
  freezeBaselineForTenant,
  replaceProductCatalogForTenant,
  replaceCapturePointsForTenant,
  registerCotiaAssemblyForTenant,
  upsertCommercialOperationsForTenant,
  saveCommercialModelForTenant,
  updateInputsForTenant,
  upsertBuilderComponentForTenant,
  upsertCommercialConditionForTenant,
  upsertReceivablesPolicyForTenant,
  type ProjectGoalSeekKpi,
  type ProjectGoalSeekVariable,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const tenantIdFromUser = (userId: number) => userId;
const provenanceSourceSchema = z.enum(["current_decision", "current_document", "historical_primary", "derived_analysis", "external_benchmark", "assumption"]);
const builderComponentSchema = z.enum(["project_assembly", "product_stock", "pricing_payments", "acquisition_capacity", "costs_workforce", "commissions_partners", "receivables_losses", "capex_opex"]);
const costCategorySchema = z.enum(["payroll", "occupancy", "technology", "marketing", "partner", "legal", "operations", "other"]);
const goalSeekTargetSchema = z.enum(PROJECT_GOAL_SEEK_KPIS as [ProjectGoalSeekKpi, ...ProjectGoalSeekKpi[]]);
const goalSeekVariableSchema = z.enum(PROJECT_GOAL_SEEK_VARIABLES as [ProjectGoalSeekVariable, ...ProjectGoalSeekVariable[]]);
const financialModelModeSchema = z.enum([
  "HARMONY_COMPAT_V1",
  "TGR_CANONICAL_V2",
]);

const nonNegativeDecimalSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const unitRateSchema = nonNegativeDecimalSchema.refine(value => Number(value) <= 1, {
  message: "Taxa deve estar entre 0 e 1.",
});
const positiveDecimalSchema = nonNegativeDecimalSchema.refine(
  value => Number(value) > 0,
  { message: "Valor deve ser maior que zero." }
);
const signedDecimalSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const meetingSimulationSchema = z.object({
  versionId: z.string().min(1),
  horizonMonths: z.number().int().min(1).max(120),
  asOfMonth: z.number().int().min(0).max(1200).default(0),
  captadorDelta: signedDecimalSchema,
  qualifiedCouplesPerCaptadorMonth: nonNegativeDecimalSchema,
  loadedCostPerCaptadorMonth: nonNegativeDecimalSchema,
  targetGrossSalesMonth1: nonNegativeDecimalSchema.optional(),
  averageTicketDelta: signedDecimalSchema.optional(),
  fixedCostMonthlyDelta: signedDecimalSchema.optional(),
  payrollMonthlyDelta: signedDecimalSchema.optional(),
  variableCostMonthlyDelta: signedDecimalSchema.optional(),
  capexInitialDelta: signedDecimalSchema.optional(),
});
const nonNegativeIntegerTextSchema = z.string().regex(/^(?:0|[1-9]\d*)$/);
const productSkuSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(2).max(255),
    unitType: z.string().trim().min(1).max(255),
    unitQuantity: z.number().int().min(0),
    sharesPerUnit: z.number().int().min(1),
    grossSoldShares: z.number().int().min(0),
    returnedShares: z.number().int().min(0),
    blockedShares: z.number().int().min(0),
    status: z.enum(["provided", "pending"]),
    sourceType: provenanceSourceSchema,
    sourceRef: z.string().trim().max(500).optional(),
    pricePhases: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(120),
          startsAtMonth: z.number().int().min(0),
          price: nonNegativeDecimalSchema,
        })
      )
      .min(1),
  })
  .refine(data => data.status === "pending" || Boolean(data.sourceRef?.trim()), {
    message: "SKU informado exige fonte ou responsável.",
    path: ["sourceRef"],
  });
const commercialConditionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2).max(255),
  listPrice: nonNegativeDecimalSchema,
  discount: nonNegativeDecimalSchema,
  entry: z.object({
    total: nonNegativeDecimalSchema,
    installments: z.number().int().min(1),
    firstDueMonth: z.number().int().min(0),
  }),
  balance: z.object({
    principal: nonNegativeDecimalSchema,
    installments: z.number().int().min(1),
    graceMonths: z.number().int().min(0),
    firstDueMonth: z.number().int().min(0),
  }),
  explicitCharges: nonNegativeDecimalSchema,
  explicitChargesDueMonth: z.number().int().min(0).optional(),
  correctionRate: nonNegativeDecimalSchema.optional(),
  interestRate: nonNegativeDecimalSchema.optional(),
  materialityTolerance: nonNegativeDecimalSchema,
  campaign: z.string().trim().max(255).optional(),
});
const persistedCommercialConditionSchema = z
  .object({
    productSkuCode: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["provided", "pending"]),
    sourceType: provenanceSourceSchema,
    sourceRef: z.string().trim().max(500).optional(),
    condition: commercialConditionSchema,
  })
  .refine(data => data.status === "pending" || Boolean(data.sourceRef?.trim()), {
    message: "Condição comercial informada exige fonte ou responsável.",
    path: ["sourceRef"],
  });
const receivablesPolicySchema = z.object({
  cancellationCurve: z.object({
    d7: nonNegativeDecimalSchema,
    d30: nonNegativeDecimalSchema,
    d60: nonNegativeDecimalSchema,
    d90: nonNegativeDecimalSchema,
    d180: nonNegativeDecimalSchema,
    lifetime: nonNegativeDecimalSchema,
  }),
  delinquencyRate: nonNegativeDecimalSchema,
  cureRates: z.object({
    days1To30: nonNegativeDecimalSchema,
    days31To60: nonNegativeDecimalSchema,
    days61To90: nonNegativeDecimalSchema,
    days90Plus: nonNegativeDecimalSchema,
  }),
  writeOffAfterDays: z.number().int().min(90),
  policyVersion: z.string().trim().min(1).max(120),
  sourceRef: z.string().trim().max(500),
});
const capturePointDefinitionSchema = z.object({
  pointId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2).max(255),
  channel: z.string().trim().min(1).max(120),
  activationCost: nonNegativeDecimalSchema,
  monthlyFixedCost: nonNegativeDecimalSchema,
  costPerSale: nonNegativeDecimalSchema,
  approaches: nonNegativeDecimalSchema,
  researchRate: unitRateSchema,
  qualificationRate: unitRateSchema,
  invitationRate: unitRateSchema,
  appointmentRate: unitRateSchema,
  showRate: unitRateSchema,
  tourRate: unitRateSchema,
  saleRate: unitRateSchema,
  cannibalizationRate: unitRateSchema,
  cashflowTreatment: z.enum(["incremental", "included_in_project_totals"]),
});
const persistedCapturePointSchema = z
  .object({
    status: z.enum(["provided", "pending"]),
    sourceType: provenanceSourceSchema,
    sourceRef: z.string().trim().max(500).optional(),
    definition: capturePointDefinitionSchema,
  })
  .refine(data => data.status === "pending" || Boolean(data.sourceRef?.trim()), {
    message: "Ponto informado exige fonte ou responsável.",
    path: ["sourceRef"],
  });
const capturePointCollectionSchema = z.array(persistedCapturePointSchema).superRefine(
  (points, ctx) => {
    const ids = new Set<string>();
    points.forEach((item, index) => {
      if (ids.has(item.definition.pointId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `pointId duplicado: ${item.definition.pointId}.`,
          path: [index, "definition", "pointId"],
        });
      }
      ids.add(item.definition.pointId);
    });
  }
);
const cashflowTreatmentSchema = z.enum([
  "incremental",
  "included_in_project_totals",
]);
const roomDefinitionSchema = z.object({
  rooms: z.array(z.object({
    roomId: z.string().trim().min(1).max(120),
    tables: nonNegativeIntegerTextSchema,
    overflowTables: nonNegativeIntegerTextSchema,
  })).min(1).superRefine((rooms, ctx) => {
    const ids = new Set<string>();
    rooms.forEach((room, index) => {
      if (ids.has(room.roomId)) ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `roomId duplicado: ${room.roomId}.`,
        path: [index, "roomId"],
      });
      ids.add(room.roomId);
    });
  }),
  operatingDaysPerMonth: nonNegativeIntegerTextSchema,
  operatingHoursPerDay: positiveDecimalSchema,
  shifts: nonNegativeIntegerTextSchema.refine(value => Number(value) > 0, {
    message: "shifts deve ser maior que zero.",
  }),
  averageTourDurationMinutes: positiveDecimalSchema,
  toursPerTable: nonNegativeDecimalSchema,
  receptionists: nonNegativeIntegerTextSchema,
  receptionCapacityPerPerson: nonNegativeDecimalSchema,
  consultants: nonNegativeIntegerTextSchema,
  consultantCapacityPerPerson: nonNegativeDecimalSchema,
  closers: nonNegativeIntegerTextSchema,
  closerSalesCapacityPerPerson: nonNegativeDecimalSchema,
  peakFlowFactor: nonNegativeDecimalSchema,
  maxWaitMinutes: nonNegativeDecimalSchema,
});
const workforceCohortSchema = z.object({
  cohortId: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  capacityUnit: z.enum(["tours", "sales", "support"]),
  headcount: nonNegativeDecimalSchema,
  hireMonth: z.number().int().min(0),
  trainingMonths: z.number().int().min(0),
  certificationRate: unitRateSchema,
  rampCurve: z.array(z.object({
    productiveAgeMonth: z.number().int().min(0),
    productivityRate: unitRateSchema,
  })).min(1),
  matureProductivity: nonNegativeDecimalSchema,
  absenteeismRate: unitRateSchema,
  monthlyTurnoverRate: unitRateSchema,
  fixedCompensation: nonNegativeDecimalSchema,
  burden: nonNegativeDecimalSchema,
  guarantee: nonNegativeDecimalSchema,
  allowance: nonNegativeDecimalSchema,
  replacementCost: nonNegativeDecimalSchema,
}).superRefine((cohort, ctx) => {
  const ages = new Set<number>();
  cohort.rampCurve.forEach((entry, index) => {
    if (ages.has(entry.productiveAgeMonth)) ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Idade produtiva duplicada.",
      path: ["rampCurve", index, "productiveAgeMonth"],
    });
    ages.add(entry.productiveAgeMonth);
  });
  if (!ages.has(0)) ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "A curva de ramp deve iniciar na idade zero.",
    path: ["rampCurve"],
  });
});
const trainingPlanSchema = z.object({
  trainingId: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  startMonth: z.number().int().min(0),
  candidates: nonNegativeDecimalSchema,
  classes: positiveDecimalSchema,
  durationMonths: z.number().int().min(1),
  trainers: nonNegativeDecimalSchema,
  trainerMonthlyCost: nonNegativeDecimalSchema,
  candidateMonthlySalary: nonNegativeDecimalSchema,
  monthlySupportCost: nonNegativeDecimalSchema,
  approvalRate: unitRateSchema,
  certificationRate: unitRateSchema,
  timeToProductiveMonths: z.number().int().min(0),
  targetProductivePeople: nonNegativeDecimalSchema,
});
const commissionPolicySchema = z.object({
  policyId: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  eligibleBase: z.enum([
    "gross_sales", "contracted_entry", "collected_entry", "validated_sale",
    "d30", "d90", "fixed",
  ]),
  mode: z.enum(["fixed", "percentage"]),
  fixedAmount: nonNegativeDecimalSchema,
  percentageRate: unitRateSchema,
  tiers: z.array(z.object({
    fromAmount: positiveDecimalSchema,
    rate: unitRateSchema,
    accelerator: nonNegativeDecimalSchema,
  })),
  guarantee: nonNegativeDecimalSchema,
  cutoffDay: z.number().int().min(1).max(31),
  paymentLagMonths: z.number().int().min(0),
  qualityMultiplier: unitRateSchema,
  holdbackRate: unitRateSchema,
  reversalEnabled: z.boolean(),
}).superRefine((policy, ctx) => {
  const thresholds = new Set<string>();
  policy.tiers.forEach((tier, index) => {
    if (thresholds.has(tier.fromAmount)) ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Threshold de tier duplicado.",
      path: ["tiers", index, "fromAmount"],
    });
    thresholds.add(tier.fromAmount);
  });
});
const commercialOperationsDefinitionSchema = z.object({
  room: roomDefinitionSchema,
  workforce: z.object({
    cashflowTreatment: cashflowTreatmentSchema,
    cohorts: z.array(workforceCohortSchema).min(1),
  }),
  training: z.object({
    cashflowTreatment: cashflowTreatmentSchema,
    plans: z.array(trainingPlanSchema),
  }),
  commissions: z.object({
    cashflowTreatment: cashflowTreatmentSchema,
    policies: z.array(commissionPolicySchema),
  }),
}).superRefine((definition, ctx) => {
  const cohortIds = new Set<string>();
  definition.workforce.cohorts.forEach((cohort, index) => {
    if (cohortIds.has(cohort.cohortId)) ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `cohortId duplicado: ${cohort.cohortId}.`,
      path: ["workforce", "cohorts", index, "cohortId"],
    });
    cohortIds.add(cohort.cohortId);
  });
  for (const capacityUnit of ["tours", "sales"] as const) {
    if (!definition.workforce.cohorts.some(cohort => cohort.capacityUnit === capacityUnit)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Workforce exige uma coorte de ${capacityUnit}.`,
        path: ["workforce", "cohorts"],
      });
    }
  }
  const trainingIds = new Set<string>();
  definition.training.plans.forEach((plan, index) => {
    if (trainingIds.has(plan.trainingId)) ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `trainingId duplicado: ${plan.trainingId}.`,
      path: ["training", "plans", index, "trainingId"],
    });
    trainingIds.add(plan.trainingId);
  });
  const policyIds = new Set<string>();
  definition.commissions.policies.forEach((policy, index) => {
    if (policyIds.has(policy.policyId)) ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `policyId duplicado: ${policy.policyId}.`,
      path: ["commissions", "policies", index, "policyId"],
    });
    policyIds.add(policy.policyId);
  });
});
const persistedCommercialOperationsSchema = z.object({
  status: z.enum(["provided", "pending"]),
  sourceType: provenanceSourceSchema,
  sourceRef: z.string().trim().max(500).optional(),
  definition: commercialOperationsDefinitionSchema,
}).refine(
  data => data.status === "pending" || Boolean(data.sourceRef?.trim()),
  {
    message: "Operações comerciais informadas exigem fonte ou responsável.",
    path: ["sourceRef"],
  }
);

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
  registerCotiaAssembly: protectedProcedure
    .input(z.object({
      versionId: z.string().min(1),
      name: z.string().trim().min(2).max(255),
      payload: z.record(z.string(), z.string()),
      sourceRef: z.string().trim().max(500).optional(),
    }))
    .mutation(({ ctx, input }) => registerCotiaAssemblyForTenant({
      tenantId: tenantIdFromUser(ctx.user.id),
      actorId: ctx.user.id,
      ...input,
    })),
  productCatalog: protectedProcedure
    .input(
      z.object({
        versionId: z.string().min(1),
        asOfMonth: z.number().int().min(0).max(1200),
      })
    )
    .query(({ ctx, input }) => getProductCatalogForTenant(input.versionId, tenantIdFromUser(ctx.user.id), input.asOfMonth)),
  replaceProductCatalog: protectedProcedure
    .input(
      z.object({
        versionId: z.string().min(1),
        asOfMonth: z.number().int().min(0).max(1200),
        skus: z.array(productSkuSchema),
      })
    )
    .mutation(({ ctx, input }) =>
      replaceProductCatalogForTenant({
        tenantId: tenantIdFromUser(ctx.user.id),
        actorId: ctx.user.id,
        ...input,
      })
    ),
  commercialConditions: protectedProcedure.input(z.object({ versionId: z.string().min(1) })).query(({ ctx, input }) => listCommercialConditionsForTenant(input.versionId, tenantIdFromUser(ctx.user.id))),
  receivablesPolicy: protectedProcedure
    .input(z.object({ versionId: z.string().min(1) }))
    .query(({ ctx, input }) =>
      getReceivablesPolicyForTenant(input.versionId, tenantIdFromUser(ctx.user.id))
    ),
  capturePoints: protectedProcedure
    .input(z.object({ versionId: z.string().min(1) }))
    .query(({ ctx, input }) =>
      getCapturePointsForTenant(input.versionId, tenantIdFromUser(ctx.user.id))
    ),
  replaceCapturePoints: protectedProcedure
    .input(
      z.object({
        versionId: z.string().min(1),
        points: capturePointCollectionSchema,
      })
    )
    .mutation(({ ctx, input }) =>
      replaceCapturePointsForTenant({
        tenantId: tenantIdFromUser(ctx.user.id),
        actorId: ctx.user.id,
        ...input,
      })
    ),
  commercialOperations: protectedProcedure
    .input(z.object({ versionId: z.string().min(1) }))
    .query(({ ctx, input }) =>
      getCommercialOperationsForTenant(
        input.versionId,
        tenantIdFromUser(ctx.user.id)
      )
    ),
  upsertCommercialOperations: protectedProcedure
    .input(
      z.object({ versionId: z.string().min(1) })
        .and(persistedCommercialOperationsSchema)
    )
    .mutation(({ ctx, input }) =>
      upsertCommercialOperationsForTenant({
        tenantId: tenantIdFromUser(ctx.user.id),
        actorId: ctx.user.id,
        ...input,
      })
    ),
  upsertReceivablesPolicy: protectedProcedure
    .input(
      z
        .object({
          versionId: z.string().min(1),
          status: z.enum(["provided", "pending"]),
          sourceType: provenanceSourceSchema,
          sourceRef: z.string().trim().max(500).optional(),
          policy: receivablesPolicySchema,
        })
        .refine(data => data.status === "pending" || Boolean(data.sourceRef?.trim()), {
          message: "Política de carteira informada exige fonte ou responsável.",
          path: ["sourceRef"],
        })
    )
    .mutation(({ ctx, input }) =>
      upsertReceivablesPolicyForTenant({
        tenantId: tenantIdFromUser(ctx.user.id),
        actorId: ctx.user.id,
        ...input,
      })
    ),
  upsertCommercialCondition: protectedProcedure
    .input(
      z
        .object({ versionId: z.string().min(1) })
        .and(persistedCommercialConditionSchema)
    )
    .mutation(({ ctx, input }) =>
      upsertCommercialConditionForTenant({
        tenantId: tenantIdFromUser(ctx.user.id),
        actorId: ctx.user.id,
        ...input,
      })
    ),
  saveCommercialModel: protectedProcedure
    .input(
      z.object({
        versionId: z.string().min(1),
        asOfMonth: z.number().int().min(0).max(1200),
        skus: z.array(productSkuSchema),
        conditions: z.array(persistedCommercialConditionSchema),
      })
    )
    .mutation(({ ctx, input }) =>
      saveCommercialModelForTenant({
        tenantId: tenantIdFromUser(ctx.user.id),
        actorId: ctx.user.id,
        ...input,
      })
    ),
  costCatalog: protectedProcedure.input(z.object({ versionId: z.string().min(1) })).query(({ ctx, input }) =>
    listCostCatalogForTenant(input.versionId, tenantIdFromUser(ctx.user.id)),
  ),
  createCostCatalogItem: protectedProcedure.input(z.object({
    versionId: z.string().min(1), category: costCategorySchema, name: z.string().trim().min(2).max(255), frequency: z.enum(["monthly", "annual", "one_time"]),
    cashflowTreatment: z.enum(["incremental", "included_in_project_totals"]), amountText: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/).optional(), status: z.enum(["provided", "pending"]), sourceType: provenanceSourceSchema, sourceRef: z.string().trim().max(500).optional(),
  }).refine((data) => data.status === "pending" || Boolean(data.amountText), { message: "Custo informado exige valor não negativo.", path: ["amountText"] }).refine((data) => data.status === "pending" || Boolean(data.sourceRef?.trim()), { message: "Custo informado exige fonte ou responsável.", path: ["sourceRef"] })).mutation(({ ctx, input }) => createCostCatalogItemForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
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
    .input(z.object({
      name: z.string().trim().min(3).max(255),
      inputs: FinancialInputSnapshotSchema,
      financialModelMode: financialModelModeSchema.default("TGR_CANONICAL_V2"),
    }))
    .mutation(({ ctx, input }) => createProjectForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  createProjectFromCotiaAssembly: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(3).max(255),
      assemblyName: z.string().trim().min(2).max(255),
      payload: z.record(z.string(), z.string()),
      sourceRef: z.string().trim().max(500).optional(),
      financialModelMode: financialModelModeSchema.default("TGR_CANONICAL_V2"),
    }))
    .mutation(({ ctx, input }) => createProjectFromCotiaAssemblyForTenant({
      tenantId: tenantIdFromUser(ctx.user.id),
      actorId: ctx.user.id,
      ...input,
    })),
  updateInputs: protectedProcedure
    .input(z.object({ versionId: z.string().min(1), inputs: FinancialInputSnapshotSchema }))
    .mutation(({ ctx, input }) => updateInputsForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  calculate: protectedProcedure
    .input(z.object({ versionId: z.string().min(1), horizonMonths: z.number().int().min(1).max(120), asOfMonth: z.number().int().min(0).max(1200).default(0) }))
    .mutation(({ ctx, input }) => createCalculationSnapshot({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  simulateCaptadores: protectedProcedure
    .input(meetingSimulationSchema)
    .mutation(({ ctx, input }) => simulateCaptadorChangeForTenant({ tenantId: tenantIdFromUser(ctx.user.id), ...input })),
  promoteMeetingSimulationToScenario: protectedProcedure
    .input(meetingSimulationSchema.extend({
      baseSnapshotId: z.string().min(1),
      name: z.string().trim().min(3).max(255),
      reason: z.string().trim().min(3).max(1000),
      sourceRef: z.string().trim().min(2).max(500),
    }))
    .mutation(({ ctx, input }) => promoteMeetingSimulationToScenarioForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
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
    .input(z.object({ versionId: z.string().min(1), horizonMonths: z.number().int().min(1).max(120), asOfMonth: z.number().int().min(0).max(1200).default(0), availableCapital: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/) }))
    .query(({ ctx, input }) => calculateCapitalEnvelopeForTenant({ tenantId: tenantIdFromUser(ctx.user.id), ...input })),
  exportEligibility: protectedProcedure.input(z.object({ snapshotId: z.string().min(1) })).query(({ ctx, input }) =>
    getExportEligibilityForTenant(input.snapshotId, tenantIdFromUser(ctx.user.id)),
  ),
  requestExport: protectedProcedure
    .input(z.object({ snapshotId: z.string().min(1), format: z.enum(["pdf", "pptx", "xlsx"]) }))
    .mutation(({ ctx, input }) => generateAuthorizedExportForTenant({ tenantId: tenantIdFromUser(ctx.user.id), actorId: ctx.user.id, ...input })),
  goalSeek: protectedProcedure
    .input(z.object({ versionId: z.string().min(1), horizonMonths: z.number().int().min(1).max(120), asOfMonth: z.number().int().min(0).max(1200).default(0), targetKpi: goalSeekTargetSchema, variableKey: goalSeekVariableSchema, target: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/), lowerBound: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/), upperBound: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/) }))
    .mutation(({ ctx, input }) => runProjectGoalSeekForTenant({ tenantId: tenantIdFromUser(ctx.user.id), ...input })),
  applyGoalSeek: protectedProcedure
    .input(z.object({
      targetVersionId: z.string().min(1),
      sourceVersionId: z.string().min(1),
      horizonMonths: z.number().int().min(1).max(120).default(120),
      asOfMonth: z.number().int().min(0).max(1200).default(0),
      variableKey: goalSeekVariableSchema,
      value: nonNegativeDecimalSchema,
      targetKpi: goalSeekTargetSchema,
      target: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/),
      lowerBound: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/).optional(),
      upperBound: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/).optional(),
      objectiveValue: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/),
      residual: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/),
      iterations: z.number().int().min(1).max(1000),
    }))
    .mutation(({ ctx, input }) => applyGoalSeekToScenarioForTenant({
      tenantId: tenantIdFromUser(ctx.user.id),
      actorId: ctx.user.id,
      ...input,
    })),
  lineage: protectedProcedure.input(z.object({ formulaId: z.string().min(1) })).query(({ input }) => {
    const registry = new FormulaRegistry([IGR_CORE_FORMULA_SET_V1], IGR_CORE_FORMULA_SET_V1.id);
    return registry.getLineage(input.formulaId);
  }),
});
