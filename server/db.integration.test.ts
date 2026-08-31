import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  approvalDecisions,
  auditEvents,
  calculationSnapshots,
  costCatalogItems,
  exportArtifacts,
  historicalBenchmarks,
  kpiMemoryRecords,
  workflowEvents,
} from "../drizzle/schema";
import { FinanceDecimal } from "../shared/financial/engine";
import type { CommercialOperationsDefinition } from "../shared/financial/commercialOperations";
import type { FinancialInputSnapshot } from "../shared/financial/types";
import {
  approveSnapshotForTenant,
  createCalculationSnapshot,
  createCostCatalogItemForTenant,
  createProjectForTenant,
  createScenarioForTenant,
  freezeBaselineForTenant,
  generateAuthorizedExportForTenant,
  getDb,
  getExportEligibilityForTenant,
  getInputsForVersion,
  getProductCatalogForTenant,
  getProjectContextForTenant,
  getScenarioComparisonForTenant,
  getProjectForTenant,
  listCommercialConditionsForTenant,
  listCostCatalogForTenant,
  listHistoricalBenchmarksForTenant,
  replaceProductCatalogForTenant,
  replaceCapturePointsForTenant,
  upsertCommercialOperationsForTenant,
  saveCommercialModelForTenant,
  upsertCommercialConditionForTenant,
  upsertReceivablesPolicyForTenant,
  updateInputsForTenant,
} from "./db";

const tenantId = 1;
const actorId = 1;
const ids = {
  projectId: "",
  versionId: "",
  snapshotId: "",
  snapshotHash: "",
  scenarioVersionId: "",
  scenarioSnapshotId: "",
  rollbackProjectId: "",
  rollbackVersionId: "",
  rollbackSnapshotId: "",
  snapshotRollbackProjectId: "",
  snapshotRollbackVersionId: "",
  baselineRollbackProjectId: "",
  baselineRollbackVersionId: "",
  baselineRollbackSnapshotId: "",
  baselineRollbackSnapshotHash: "",
  exportRollbackProjectId: "",
  exportRollbackVersionId: "",
  exportRollbackSnapshotId: "",
  scenarioRollbackProjectId: "",
  scenarioRollbackVersionId: "",
  productProjectId: "",
  productVersionId: "",
  domainBlockedProjectId: "",
  domainBlockedVersionId: "",
  domainBlockedSnapshotId: "",
  missingDomainProjectId: "",
  missingDomainVersionId: "",
  missingDomainSnapshotId: "",
  missingDomainChangedSnapshotId: "",
  ordinalProjectId: "",
  ordinalBaseVersionId: "",
  ordinalScenarioVersionId: "",
  inputRaceProjectId: "",
  inputRaceVersionId: "",
};
const provided = (value: string) => ({
  status: "provided" as const,
  value,
  sourceType: "assumption" as const,
  sourceRef: "db.integration.test",
});
const inputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("100"),
  qualifiedCouplesGrowthRate: provided("0"),
  conversionRate: provided("0.1"),
  averageTicket: provided("1000"),
  collectionRate: provided("0.8"),
  cancellationRate: provided("0.1"),
  variableCostRate: provided("0.2"),
  partnerShareRate: provided("0.05"),
  fixedCostMonthly: provided("1000"),
  payrollMonthly: provided("1000"),
  capexInitial: provided("5000"),
  preOperationMonths: provided("0"),
  entryValuePerContract: provided("100"),
  paymentCardViewMixRate: provided("1"),
  paymentCardViewMdrRate: provided("0"),
  paymentCardViewSettlementDays: provided("0"),
  paymentCardInstallmentMixRate: provided("0"),
  paymentCardInstallmentMdrRate: provided("0"),
  paymentCardInstallmentSettlementDays: provided("0"),
  paymentDebitMixRate: provided("0"),
  paymentDebitMdrRate: provided("0"),
  paymentDebitSettlementDays: provided("0"),
  paymentRecurringChequeMixRate: provided("0"),
  paymentRecurringChequeMdrRate: provided("0"),
  paymentRecurringChequeSettlementDays: provided("0"),
  paymentBoletoMixRate: provided("0"),
  paymentBoletoMdrRate: provided("0"),
  paymentBoletoSettlementDays: provided("0"),
  discountRateAnnual: provided("0.12"),
};

const commercialOperationsDefinition: CommercialOperationsDefinition = {
  room: {
    rooms: [{ roomId: "main", tables: "4", overflowTables: "1" }],
    operatingDaysPerMonth: "20",
    operatingHoursPerDay: "8",
    shifts: "2",
    averageTourDurationMinutes: "60",
    toursPerTable: "1",
    receptionists: "2",
    receptionCapacityPerPerson: "200",
    consultants: "2",
    consultantCapacityPerPerson: "100",
    closers: "2",
    closerSalesCapacityPerPerson: "20",
    peakFlowFactor: "1.5",
    maxWaitMinutes: "15",
  },
  workforce: {
    cashflowTreatment: "included_in_project_totals",
    cohorts: [
      {
        cohortId: "tours-team", role: "consultant", capacityUnit: "tours",
        headcount: "2", hireMonth: 0, trainingMonths: 0,
        certificationRate: "1", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }],
        matureProductivity: "100", absenteeismRate: "0", monthlyTurnoverRate: "0",
        fixedCompensation: "1000", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0",
      },
      {
        cohortId: "sales-team", role: "closer", capacityUnit: "sales",
        headcount: "2", hireMonth: 0, trainingMonths: 0,
        certificationRate: "1", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }],
        matureProductivity: "20", absenteeismRate: "0", monthlyTurnoverRate: "0",
        fixedCompensation: "1500", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0",
      },
    ],
  },
  training: {
    cashflowTreatment: "included_in_project_totals",
    plans: [{
      trainingId: "academy", role: "closer", startMonth: 0,
      candidates: "2", classes: "1", durationMonths: 1, trainers: "1",
      trainerMonthlyCost: "100", candidateMonthlySalary: "50",
      monthlySupportCost: "0", approvalRate: "1", certificationRate: "1",
      timeToProductiveMonths: 0, targetProductivePeople: "2",
    }],
  },
  commissions: { cashflowTreatment: "included_in_project_totals", policies: [] },
};

async function seedAuthoritativeCommercialDomains(
  versionId: string,
  listPrice: string
) {
  await replaceProductCatalogForTenant({
    tenantId,
    actorId,
    versionId,
    asOfMonth: 0,
    skus: [{
      id: "default-sku",
      name: "Produto de integração",
      unitType: "Cota",
      unitQuantity: 100,
      sharesPerUnit: 100,
      grossSoldShares: 0,
      returnedShares: 0,
      blockedShares: 0,
      status: "provided",
      sourceType: "current_document",
      sourceRef: "db.integration.test:authoritative-product",
      pricePhases: [{ id: "launch", startsAtMonth: 0, price: listPrice }],
    }],
  });
  await upsertCommercialConditionForTenant({
    tenantId,
    actorId,
    versionId,
    productSkuCode: "default-sku",
    status: "provided",
    sourceType: "current_document",
    sourceRef: "db.integration.test:authoritative-condition",
    condition: {
      id: "default-condition",
      name: "Condição de integração",
      listPrice,
      discount: "0",
      entry: { total: "100", installments: 1, firstDueMonth: 0 },
      balance: {
        principal: new FinanceDecimal(listPrice).minus(100).toFixed(8),
        installments: 1,
        graceMonths: 0,
        firstDueMonth: 1,
      },
      explicitCharges: "0",
      correctionRate: "0",
      interestRate: "0",
      materialityTolerance: "0.01",
    },
  });
  await upsertReceivablesPolicyForTenant({
    tenantId,
    actorId,
    versionId,
    status: "provided",
    sourceType: "current_document",
    sourceRef: "db.integration.test:receivables-policy",
    policy: {
      cancellationCurve: {
        d7: "0.01",
        d30: "0.02",
        d60: "0.03",
        d90: "0.04",
        d180: "0.05",
        lifetime: "0.06",
      },
      delinquencyRate: "0.08",
      cureRates: {
        days1To30: "0.40",
        days31To60: "0.30",
        days61To90: "0.20",
        days90Plus: "0.10",
      },
      writeOffAfterDays: 180,
      policyVersion: "db-integration-v1",
      sourceRef: "db.integration.test:receivables-policy",
    },
  });
  await replaceCapturePointsForTenant({
    tenantId,
    actorId,
    versionId,
    points: [{
      status: "provided",
      sourceType: "current_document",
      sourceRef: "db.integration.test:capture-point",
      definition: {
        pointId: "default-point",
        name: "Ponto de integração",
        channel: "PDV",
        activationCost: "1000",
        monthlyFixedCost: "500",
        costPerSale: "10",
        approaches: "100",
        researchRate: "1",
        qualificationRate: "1",
        invitationRate: "1",
        appointmentRate: "1",
        showRate: "1",
        tourRate: "1",
        saleRate: "0.1",
        cannibalizationRate: "0",
        cashflowTreatment: "included_in_project_totals",
      },
    }],
  });
  await upsertCommercialOperationsForTenant({
    tenantId,
    actorId,
    versionId,
    status: "provided",
    sourceType: "current_document",
    sourceRef: "db.integration.test:commercial-operations",
    definition: commercialOperationsDefinition,
  });
}

afterAll(async () => {
  const db = await getDb();
  if (!db || !ids.projectId) return;
  await db.execute(
    sql`DELETE FROM project_component_records WHERE sourceRef = ${"db.integration.test:capture-point"}`
  );
  await db.execute(
    sql`DELETE FROM project_component_records WHERE sourceRef = ${"db.integration.test:commercial-operations"}`
  );
  await db.execute(
    sql`DELETE FROM audit_events WHERE entityId IN (${ids.projectId}, ${ids.versionId}, ${ids.snapshotId}, ${ids.scenarioVersionId}, ${ids.scenarioSnapshotId}, ${ids.rollbackProjectId}, ${ids.rollbackVersionId}, ${ids.rollbackSnapshotId}, ${ids.snapshotRollbackProjectId}, ${ids.snapshotRollbackVersionId}, ${ids.baselineRollbackProjectId}, ${ids.baselineRollbackVersionId}, ${ids.baselineRollbackSnapshotId}, ${ids.exportRollbackProjectId}, ${ids.exportRollbackVersionId}, ${ids.exportRollbackSnapshotId}, ${ids.scenarioRollbackProjectId}, ${ids.scenarioRollbackVersionId}, ${ids.productProjectId}, ${ids.productVersionId}, ${ids.domainBlockedProjectId}, ${ids.domainBlockedVersionId}, ${ids.domainBlockedSnapshotId}, ${ids.missingDomainProjectId}, ${ids.missingDomainVersionId}, ${ids.missingDomainSnapshotId}, ${ids.missingDomainChangedSnapshotId}, ${ids.inputRaceProjectId}, ${ids.inputRaceVersionId})`
  );
  await db.execute(
    sql`DELETE FROM historical_benchmarks WHERE tenantId = ${tenantId} AND sourceRef = ${`snapshot:${ids.snapshotHash}`}`
  );
  await db.execute(
    sql`DELETE FROM historical_benchmarks WHERE tenantId = ${tenantId} AND sourceRef = ${`snapshot:${ids.baselineRollbackSnapshotHash}`}`
  );
  await db.execute(
    sql`DELETE FROM approval_decisions WHERE snapshotId = ${ids.snapshotId}`
  );
  await db.execute(
    sql`DELETE FROM approval_decisions WHERE snapshotId = ${ids.rollbackSnapshotId}`
  );
  await db.execute(
    sql`DELETE FROM approval_decisions WHERE snapshotId = ${ids.baselineRollbackSnapshotId}`
  );
  await db.execute(
    sql`DELETE FROM approval_decisions WHERE snapshotId = ${ids.exportRollbackSnapshotId}`
  );
  await db.execute(
    sql`DELETE FROM kpi_memory_records WHERE snapshotId = ${ids.snapshotId}`
  );
  await db.execute(
    sql`DELETE FROM kpi_memory_records WHERE snapshotId = ${ids.scenarioSnapshotId}`
  );
  await db.execute(
    sql`DELETE FROM kpi_memory_records WHERE snapshotId = ${ids.rollbackSnapshotId}`
  );
  await db.execute(
    sql`DELETE FROM kpi_memory_records WHERE snapshotId = ${ids.baselineRollbackSnapshotId}`
  );
  await db.execute(
    sql`DELETE FROM kpi_memory_records WHERE snapshotId = ${ids.exportRollbackSnapshotId}`
  );
  await db.execute(
    sql`DELETE FROM export_artifacts WHERE snapshotId = ${ids.exportRollbackSnapshotId}`
  );
  await db.execute(
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.versionId}`
  );
  await db.execute(
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.scenarioVersionId}`
  );
  await db.execute(
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.rollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.snapshotRollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.baselineRollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.exportRollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.domainBlockedVersionId}`
  );
  await db.execute(
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.missingDomainVersionId}`
  );
  await db.execute(
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.ordinalScenarioVersionId}`
  );
  await db.execute(
    sql`DELETE cc FROM cost_catalog_items cc INNER JOIN project_versions pv ON cc.versionId = pv.id WHERE pv.projectId IN (${ids.projectId}, ${ids.ordinalProjectId})`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId = ${ids.versionId}`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId = ${ids.scenarioVersionId}`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId = ${ids.rollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId = ${ids.snapshotRollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId = ${ids.baselineRollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId = ${ids.exportRollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId = ${ids.domainBlockedVersionId}`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId = ${ids.missingDomainVersionId}`
  );
  await db.execute(
    sql`DELETE iv FROM input_values iv INNER JOIN project_versions pv ON iv.versionId = pv.id WHERE pv.projectId = ${ids.scenarioRollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId IN (${ids.ordinalBaseVersionId}, ${ids.ordinalScenarioVersionId})`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId = ${ids.inputRaceVersionId}`
  );
  await db.execute(
    sql`DELETE FROM scenario_branches WHERE projectId = ${ids.projectId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.projectId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.rollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.snapshotRollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.baselineRollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.exportRollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.scenarioRollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.domainBlockedProjectId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.missingDomainProjectId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.inputRaceProjectId}`
  );
  await db.execute(
    sql`DELETE FROM scenario_branches WHERE projectId = ${ids.scenarioRollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM scenario_branches WHERE projectId = ${ids.ordinalProjectId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.versionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.rollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.snapshotRollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.baselineRollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.exportRollbackVersionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE projectId = ${ids.scenarioRollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.productVersionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.domainBlockedVersionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.missingDomainVersionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id IN (${ids.ordinalScenarioVersionId}, ${ids.ordinalBaseVersionId})`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.inputRaceVersionId}`
  );
  await db.execute(sql`DELETE FROM projects WHERE id = ${ids.projectId}`);
  await db.execute(
    sql`DELETE FROM projects WHERE id = ${ids.rollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM projects WHERE id = ${ids.snapshotRollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM projects WHERE id = ${ids.baselineRollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM projects WHERE id = ${ids.exportRollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM projects WHERE id = ${ids.scenarioRollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM projects WHERE id = ${ids.productProjectId}`
  );
  await db.execute(
    sql`DELETE FROM projects WHERE id = ${ids.domainBlockedProjectId}`
  );
  await db.execute(
    sql`DELETE FROM projects WHERE id = ${ids.missingDomainProjectId}`
  );
  await db.execute(sql`DELETE FROM projects WHERE id = ${ids.ordinalProjectId}`);
  await db.execute(sql`DELETE FROM projects WHERE id = ${ids.inputRaceProjectId}`);
});

describe("IGR database integration", () => {
  it("seleciona o snapshot realmente mais recente por ordinal monotônico mesmo no mesmo segundo", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Ordem monotônica de snapshots",
      inputs,
    });
    ids.ordinalProjectId = created.projectId;
    ids.ordinalBaseVersionId = created.versionId;
    const scenario = await createScenarioForTenant({
      tenantId,
      actorId,
      baseVersionId: created.versionId,
      name: "Cenário ordinal",
      reason: "Provar desempate monotônico no mesmo segundo.",
    });
    ids.ordinalScenarioVersionId = scenario.versionId;
    const db = await getDb();
    if (!db) throw new Error("Banco de integração indisponível.");
    const tiedCreatedAt = new Date("2026-08-30T12:00:00.000Z");
    const payload = (npv: string) => ({
      status: "valid",
      horizonMonths: 24,
      missingInputKeys: [],
      formulaSetVersion: created.formulaSetVersionId,
      engineVersion: "integration-test",
      projections: [],
      kpis: { npv, totalOperatingCashFlow: npv },
      memory: [],
    });
    await db.insert(calculationSnapshots).values([
      {
        id: "ordinal-snapshot-first",
        projectVersionId: scenario.versionId,
        formulaSetVersionId: created.formulaSetVersionId,
        horizonMonths: 24,
        asOfMonth: 0,
        inputHash: "1".repeat(64),
        snapshotHash: "2".repeat(64),
        calculationStatus: "valid",
        validationStatus: "valid",
        isAuthoritative: true,
        payload: payload("1") as Record<string, unknown>,
        createdBy: actorId,
        createdAt: tiedCreatedAt,
      },
      {
        id: "ordinal-snapshot-second",
        projectVersionId: scenario.versionId,
        formulaSetVersionId: created.formulaSetVersionId,
        horizonMonths: 24,
        asOfMonth: 0,
        inputHash: "3".repeat(64),
        snapshotHash: "4".repeat(64),
        calculationStatus: "valid",
        validationStatus: "valid",
        isAuthoritative: true,
        payload: payload("2") as Record<string, unknown>,
        createdBy: actorId,
        createdAt: tiedCreatedAt,
      },
    ]);

    const comparison = await getScenarioComparisonForTenant(
      created.projectId,
      tenantId
    );
    expect(
      comparison.find(entry => entry.versionId === scenario.versionId)
    ).toMatchObject({
      snapshotId: "ordinal-snapshot-second",
      snapshotHash: "4".repeat(64),
      kpis: { npv: "2" },
    });
  });

  it("bloqueia snapshot sem produto e condição comercial estruturados", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Domínio comercial ausente",
      inputs: { ...inputs, averageTicket: provided("1007") },
    });
    ids.missingDomainProjectId = created.projectId;
    ids.missingDomainVersionId = created.versionId;

    const snapshot = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: created.versionId,
      horizonMonths: 24,
    });
    ids.missingDomainSnapshotId = snapshot.id;
    expect(snapshot.status).toBe("blocked_by_pending_inputs");
    expect(snapshot.domainBlockers).toEqual(expect.arrayContaining([
      "product_catalog.missing",
      "commercial_conditions.missing",
      "commercial_operations.missing",
    ]));
    const context = await getProjectContextForTenant(created.projectId, tenantId);
    expect(context.project.status).toBe("draft");
    expect(context.snapshotHistory[0]?.domainBlockers).toEqual(
      expect.arrayContaining([
        "product_catalog.missing",
        "commercial_conditions.missing",
        "commercial_operations.missing",
      ])
    );

    const repeated = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: created.versionId,
      horizonMonths: 24,
    });
    expect(repeated.id).toBe(snapshot.id);
    expect(repeated.snapshotHash).toBe(snapshot.snapshotHash);

    await updateInputsForTenant({
      tenantId,
      actorId,
      versionId: created.versionId,
      inputs: { ...inputs, averageTicket: provided("1008") },
    });
    const changed = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: created.versionId,
      horizonMonths: 24,
    });
    ids.missingDomainChangedSnapshotId = changed.id;
    expect(changed.id).not.toBe(snapshot.id);
    expect(changed.snapshotHash).not.toBe(snapshot.snapshotHash);
    expect(
      (await getProjectContextForTenant(created.projectId, tenantId)).snapshotHistory
    ).toHaveLength(2);
  });

  it("bloqueia autoridade quando o domínio estruturado está pendente", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Autoridade de domínio pendente",
      inputs: { ...inputs, averageTicket: provided("1006") },
    });
    ids.domainBlockedProjectId = created.projectId;
    ids.domainBlockedVersionId = created.versionId;
    await replaceProductCatalogForTenant({
      tenantId,
      actorId,
      versionId: created.versionId,
      asOfMonth: 0,
      skus: [
        {
          id: "pending-sku",
          name: "Produto pendente",
          unitType: "1Q",
          unitQuantity: 10,
          sharesPerUnit: 4,
          grossSoldShares: 0,
          returnedShares: 0,
          blockedShares: 0,
          status: "pending",
          sourceType: "current_decision",
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "100000" }],
        },
      ],
    });

    const snapshot = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: created.versionId,
      horizonMonths: 24,
    });
    ids.domainBlockedSnapshotId = snapshot.id;
    expect(snapshot.status).toBe("blocked_by_pending_inputs");
    expect(snapshot.domainBlockers).toEqual(expect.arrayContaining(["product_catalog.pending_skus", "commercial_conditions.missing"]));
    const context = await getProjectContextForTenant(created.projectId, tenantId);
    expect(context.project.status).toBe("draft");
    expect(context.versions[0]?.state).toBe("draft");
  });

  it("persiste catálogo multi-SKU e condição comercial reconciliada", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Produto e condição comercial",
      inputs: { ...inputs, averageTicket: provided("1005") },
    });
    ids.productProjectId = created.projectId;
    ids.productVersionId = created.versionId;

    await replaceProductCatalogForTenant({
      tenantId,
      actorId,
      versionId: created.versionId,
      asOfMonth: 3,
      skus: [
        {
          id: "beach-2q",
          name: "Beach 2 Quartos",
          unitType: "2Q",
          unitQuantity: 10,
          sharesPerUnit: 4,
          grossSoldShares: 6,
          returnedShares: 1,
          blockedShares: 2,
          status: "provided",
          sourceType: "current_document",
          sourceRef: "db.integration.test:product",
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "100000" }],
        },
        {
          id: "garden-3q",
          name: "Garden 3 Quartos",
          unitType: "3Q",
          unitQuantity: 5,
          sharesPerUnit: 8,
          grossSoldShares: 4,
          returnedShares: 0,
          blockedShares: 0,
          status: "provided",
          sourceType: "current_document",
          sourceRef: "db.integration.test:product",
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "125000" }],
        },
      ],
    });

    const catalog = await getProductCatalogForTenant(created.versionId, tenantId, 3);
    expect(catalog.evaluation.status).toBe("valid");
    expect(catalog.evaluation.totals).toMatchObject({
      initialShares: 80,
      netSoldShares: 9,
      blockedShares: 2,
      availableShares: 69,
      potentialVgv: "9000000.00000000",
    });

    const commercial = await upsertCommercialConditionForTenant({
      tenantId,
      actorId,
      versionId: created.versionId,
      productSkuCode: "beach-2q",
      status: "provided",
      sourceType: "current_document",
      sourceRef: "db.integration.test:commercial",
      condition: {
        id: "standard",
        name: "Condição padrão",
        listPrice: "500000",
        discount: "20000",
        entry: { total: "100000", installments: 4, firstDueMonth: 0 },
        balance: {
          principal: "380000",
          installments: 48,
          graceMonths: 1,
          firstDueMonth: 2,
        },
        explicitCharges: "0",
        correctionRate: "0",
        interestRate: "0",
        materialityTolerance: "0.01",
        campaign: "Lançamento",
      },
    });
    expect(commercial.reconciliation.status).toBe("valid");
    const conditions = await listCommercialConditionsForTenant(created.versionId, tenantId);
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toMatchObject({
      condition: { id: "standard", name: "Condição padrão" },
      productSkuCode: "beach-2q",
      reconciliation: { status: "valid", difference: "0.00000000" },
    });

    await expect(
      replaceProductCatalogForTenant({
        tenantId,
        actorId,
        versionId: created.versionId,
        asOfMonth: 3,
        skus: [{
          id: "invalid-price",
          name: "Preço inválido",
          unitType: "1Q",
          unitQuantity: 1,
          sharesPerUnit: 4,
          grossSoldShares: 0,
          returnedShares: 0,
          blockedShares: 0,
          status: "provided",
          sourceType: "current_document",
          sourceRef: "db.integration.test:invalid-product",
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "-100" }],
        }],
      })
    ).rejects.toThrow("INVALID_PRODUCT_PRICE");

    await expect(
      replaceProductCatalogForTenant({
        tenantId,
        actorId,
        versionId: created.versionId,
        asOfMonth: 3,
        skus: [{
          id: "garden-3q",
          name: "Garden 3 Quartos",
          unitType: "3Q",
          unitQuantity: 5,
          sharesPerUnit: 8,
          grossSoldShares: 4,
          returnedShares: 0,
          blockedShares: 0,
          status: "provided",
          sourceType: "current_document",
          sourceRef: "db.integration.test:product",
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "125000" }],
        }],
      })
    ).rejects.toThrow("SKU vinculado");
    expect(
      (await getProductCatalogForTenant(created.versionId, tenantId, 3))
        .evaluation.totals.potentialVgv
    ).toBe("9000000.00000000");

    const db = await getDb();
    if (!db) throw new Error("Banco de integração indisponível.");
    await db.execute(
      sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_atomic_commercial_save")
    );
    await db.execute(
      sql.raw(
        "CREATE TRIGGER tgr_test_fail_atomic_commercial_save BEFORE INSERT ON commercial_conditions FOR EACH ROW BEGIN IF NEW.conditionCode = 'atomic-failure' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced atomic commercial failure'; END IF; END"
      )
    );
    try {
      await expect(
        saveCommercialModelForTenant({
          tenantId,
          actorId,
          versionId: created.versionId,
          asOfMonth: 3,
          skus: [{
            id: "atomic-new",
            name: "Produto que não deve persistir",
            unitType: "1Q",
            unitQuantity: 1,
            sharesPerUnit: 4,
            grossSoldShares: 0,
            returnedShares: 0,
            blockedShares: 0,
            status: "provided",
            sourceType: "current_document",
            sourceRef: "db.integration.test:atomic-product",
            pricePhases: [{ id: "launch", startsAtMonth: 0, price: "1000" }],
          }],
          conditions: [{
            productSkuCode: "atomic-new",
            status: "provided",
            sourceType: "current_document",
            sourceRef: "db.integration.test:atomic-condition",
            condition: {
              id: "atomic-failure",
              name: "Condição que força rollback",
              listPrice: "1000",
              discount: "0",
              entry: { total: "100", installments: 1, firstDueMonth: 0 },
              balance: {
                principal: "900",
                installments: 1,
                graceMonths: 0,
                firstDueMonth: 1,
              },
              explicitCharges: "0",
              correctionRate: "0",
              interestRate: "0",
              materialityTolerance: "0.01",
            },
          }],
        })
      ).rejects.toThrow();
    } finally {
      await db.execute(
        sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_atomic_commercial_save")
      );
    }
    expect(
      (await getProductCatalogForTenant(created.versionId, tenantId, 3)).records
        .map(record => record.skuCode)
    ).toEqual(["beach-2q", "garden-3q"]);
    expect(
      (await listCommercialConditionsForTenant(created.versionId, tenantId))
        .map(item => item.condition.id)
    ).toEqual(["standard"]);

    await expect(
      saveCommercialModelForTenant({
        tenantId,
        actorId,
        versionId: created.versionId,
        asOfMonth: 3,
        skus: [{
          id: "beach-2q-renamed",
          name: "Beach 2 Quartos",
          unitType: "2Q",
          unitQuantity: 10,
          sharesPerUnit: 4,
          grossSoldShares: 6,
          returnedShares: 1,
          blockedShares: 2,
          status: "provided",
          sourceType: "current_document",
          sourceRef: "db.integration.test:product",
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "100000" }],
        }],
        conditions: [{
          productSkuCode: "beach-2q-renamed",
          status: "provided",
          sourceType: "current_document",
          sourceRef: "db.integration.test:commercial",
          condition: {
            id: "standard-renamed",
            name: "Condição renomeada",
            listPrice: "100000",
            discount: "0",
            entry: { total: "10000", installments: 1, firstDueMonth: 0 },
            balance: {
              principal: "90000",
              installments: 1,
              graceMonths: 0,
              firstDueMonth: 1,
            },
            explicitCharges: "0",
            correctionRate: "0",
            interestRate: "0",
            materialityTolerance: "0.01",
          },
        }],
      })
    ).rejects.toThrow("SKU vinculado");
    expect(
      (await getProductCatalogForTenant(created.versionId, tenantId, 3)).records
        .map(record => record.skuCode)
    ).toEqual(["beach-2q", "garden-3q"]);
  });

  it("não deixa versão órfã quando a criação do cenário falha", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Rollback de cenário",
      inputs: { ...inputs, averageTicket: provided("1004") },
    });
    ids.scenarioRollbackProjectId = created.projectId;
    ids.scenarioRollbackVersionId = created.versionId;
    const db = await getDb();
    if (!db) throw new Error("Banco de integração indisponível.");

    await db.execute(
      sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_scenario_branch")
    );
    await db.execute(
      sql.raw(
        `CREATE TRIGGER tgr_test_fail_scenario_branch BEFORE INSERT ON scenario_branches FOR EACH ROW BEGIN IF NEW.projectId = '${created.projectId}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced scenario branch failure'; END IF; END`
      )
    );
    try {
      await expect(
        createScenarioForTenant({
          tenantId,
          actorId,
          baseVersionId: created.versionId,
          name: "[TEST] Cenário que falha",
          reason: "Provar rollback sem versão órfã.",
        })
      ).rejects.toThrow();
    } finally {
      await db.execute(
        sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_scenario_branch")
      );
    }

    const context = await getProjectContextForTenant(
      created.projectId,
      tenantId
    );
    expect(context.versions).toHaveLength(1);
    expect(context.versions[0]?.id).toBe(created.versionId);
  });

  it("reverte inputs se a versão deixa de ser draft durante a transação", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Corrida de estado nos inputs",
      inputs: { ...inputs, averageTicket: provided("1009") },
    });
    ids.inputRaceProjectId = created.projectId;
    ids.inputRaceVersionId = created.versionId;
    const before = await getInputsForVersion(created.versionId);
    const db = await getDb();
    if (!db) throw new Error("Banco de integração indisponível.");

    await db.execute(sql.raw("DROP TRIGGER IF EXISTS tgr_test_inputs_leave_draft"));
    await db.execute(sql.raw(
      `CREATE TRIGGER tgr_test_inputs_leave_draft BEFORE UPDATE ON input_values FOR EACH ROW BEGIN IF NEW.versionId = '${created.versionId}' THEN UPDATE project_versions SET state = 'in_review' WHERE id = '${created.versionId}'; END IF; END`
    ));
    try {
      await expect(updateInputsForTenant({
        tenantId,
        actorId,
        versionId: created.versionId,
        inputs: { ...before, averageTicket: provided("1999") },
      })).rejects.toThrow("mudou durante a gravação dos inputs");
    } finally {
      await db.execute(sql.raw("DROP TRIGGER IF EXISTS tgr_test_inputs_leave_draft"));
    }

    expect(await getInputsForVersion(created.versionId)).toEqual(before);
    expect(
      (await getProjectContextForTenant(created.projectId, tenantId)).versions[0]
    ).toMatchObject({ state: "draft", financialRevision: 0 });
  });

  it("mantém export queued quando a transição de falha não pode ser auditada", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Atomicidade de export",
      inputs: { ...inputs, averageTicket: provided("1003") },
    });
    ids.exportRollbackProjectId = created.projectId;
    ids.exportRollbackVersionId = created.versionId;
    await seedAuthoritativeCommercialDomains(created.versionId, "1003");
    const snapshot = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: created.versionId,
      horizonMonths: 24,
    });
    ids.exportRollbackSnapshotId = snapshot.id;
    await approveSnapshotForTenant({
      tenantId,
      actorId,
      snapshotId: snapshot.id,
      rationale: "Aprovação anterior ao teste de atomicidade do export.",
    });
    const db = await getDb();
    if (!db) throw new Error("Banco de integração indisponível.");

    await db.execute(
      sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_export_audit")
    );
    await db.execute(
      sql.raw(
        `CREATE TRIGGER tgr_test_fail_export_audit BEFORE INSERT ON audit_events FOR EACH ROW BEGIN IF NEW.action = 'export.failed' AND NEW.metadata LIKE '%${snapshot.id}%' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced export audit failure'; END IF; END`
      )
    );
    try {
      await expect(
        generateAuthorizedExportForTenant({
          tenantId,
          actorId,
          snapshotId: snapshot.id,
          format: "pdf",
        })
      ).rejects.toThrow();
    } finally {
      await db.execute(
        sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_export_audit")
      );
    }

    const artifacts = await db
      .select({ status: exportArtifacts.status })
      .from(exportArtifacts)
      .where(eq(exportArtifacts.snapshotId, snapshot.id));
    expect(artifacts).toEqual([{ status: "queued" }]);
  });

  it("reverte toda a baseline quando o benchmark intermediário falha", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Rollback de baseline",
      inputs: { ...inputs, averageTicket: provided("1002") },
    });
    ids.baselineRollbackProjectId = created.projectId;
    ids.baselineRollbackVersionId = created.versionId;
    await seedAuthoritativeCommercialDomains(created.versionId, "1002");
    const snapshot = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: created.versionId,
      horizonMonths: 24,
    });
    ids.baselineRollbackSnapshotId = snapshot.id;
    ids.baselineRollbackSnapshotHash = snapshot.snapshotHash;
    await approveSnapshotForTenant({
      tenantId,
      actorId,
      snapshotId: snapshot.id,
      rationale: "Aprovação anterior ao teste de rollback da baseline.",
    });
    const db = await getDb();
    if (!db) throw new Error("Banco de integração indisponível.");

    await db.execute(
      sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_baseline_benchmark")
    );
    await db.execute(
      sql.raw(
        `CREATE TRIGGER tgr_test_fail_baseline_benchmark BEFORE INSERT ON historical_benchmarks FOR EACH ROW BEGIN IF NEW.sourceRef = 'snapshot:${snapshot.snapshotHash}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced baseline benchmark failure'; END IF; END`
      )
    );
    try {
      await expect(
        freezeBaselineForTenant({
          tenantId,
          actorId,
          snapshotId: snapshot.id,
        })
      ).rejects.toThrow();
    } finally {
      await db.execute(
        sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_baseline_benchmark")
      );
    }

    const context = await getProjectContextForTenant(
      created.projectId,
      tenantId
    );
    expect(context.project.status).toBe("approved");
    expect(context.versions[0]?.state).toBe("approved");
    expect(context.versions[0]?.isImmutable).toBe(false);
    expect(
      (await listHistoricalBenchmarksForTenant(tenantId)).some(
        item => item.sourceRef === `snapshot:${snapshot.snapshotHash}`
      )
    ).toBe(false);
  });

  it("reverte snapshot e workflow quando a memória de KPI falha", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Rollback de snapshot",
      inputs: { ...inputs, averageTicket: provided("1001") },
    });
    ids.snapshotRollbackProjectId = created.projectId;
    ids.snapshotRollbackVersionId = created.versionId;
    await seedAuthoritativeCommercialDomains(created.versionId, "1001");
    const db = await getDb();
    if (!db) throw new Error("Banco de integração indisponível.");

    await db.execute(
      sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_kpi_memory")
    );
    await db.execute(
      sql.raw(
        `CREATE TRIGGER tgr_test_fail_kpi_memory BEFORE INSERT ON kpi_memory_records FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM calculation_snapshots WHERE id = NEW.snapshotId AND projectVersionId = '${created.versionId}') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced KPI memory failure'; END IF; END`
      )
    );
    try {
      await expect(
        createCalculationSnapshot({
          tenantId,
          actorId,
          versionId: created.versionId,
          horizonMonths: 24,
        })
      ).rejects.toThrow();
    } finally {
      await db.execute(
        sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_kpi_memory")
      );
    }

    const context = await getProjectContextForTenant(
      created.projectId,
      tenantId
    );
    expect(context.snapshotHistory).toHaveLength(0);
    expect(context.project.status).toBe("draft");
    expect(context.versions[0]?.state).toBe("draft");

    await db.execute(sql.raw("DROP TRIGGER IF EXISTS tgr_test_drift_snapshot_revision"));
    await db.execute(sql.raw(
      `CREATE TRIGGER tgr_test_drift_snapshot_revision BEFORE INSERT ON calculation_snapshots FOR EACH ROW BEGIN IF NEW.projectVersionId = '${created.versionId}' THEN UPDATE project_versions SET financialRevision = financialRevision + 1 WHERE id = '${created.versionId}'; END IF; END`
    ));
    try {
      await expect(createCalculationSnapshot({ tenantId, actorId, versionId: created.versionId, horizonMonths: 24 })).rejects.toThrow("mudou durante o cálculo");
    } finally {
      await db.execute(sql.raw("DROP TRIGGER IF EXISTS tgr_test_drift_snapshot_revision"));
    }
    const driftContext = await getProjectContextForTenant(created.projectId, tenantId);
    expect(driftContext.snapshotHistory).toHaveLength(0);
    expect(driftContext.project.status).toBe("draft");
    expect(driftContext.versions[0]?.state).toBe("draft");
  });

  it("reverte toda a aprovação quando uma escrita intermediária falha", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Rollback de aprovação",
      inputs,
    });
    ids.rollbackProjectId = created.projectId;
    ids.rollbackVersionId = created.versionId;
    await seedAuthoritativeCommercialDomains(created.versionId, "1000");
    const snapshot = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: created.versionId,
      horizonMonths: 24,
    });
    ids.rollbackSnapshotId = snapshot.id;
    const db = await getDb();
    if (!db) throw new Error("Banco de integração indisponível.");

    await db.execute(
      sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_approval_workflow")
    );
    await db.execute(
      sql.raw(
        `CREATE TRIGGER tgr_test_fail_approval_workflow BEFORE INSERT ON workflow_events FOR EACH ROW BEGIN IF NEW.versionId = '${created.versionId}' AND NEW.action = 'snapshot.approved' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced approval failure'; END IF; END`
      )
    );
    try {
      await expect(
        approveSnapshotForTenant({
          tenantId,
          actorId,
          snapshotId: snapshot.id,
          rationale: "A falha intermediária não pode deixar aprovação parcial.",
        })
      ).rejects.toThrow();
    } finally {
      await db.execute(
        sql.raw("DROP TRIGGER IF EXISTS tgr_test_fail_approval_workflow")
      );
    }

    const context = await getProjectContextForTenant(
      created.projectId,
      tenantId
    );
    expect(context.project.status).toBe("in_review");
    expect(context.versions[0]?.state).toBe("in_review");
    expect(
      (await getExportEligibilityForTenant(snapshot.id, tenantId)).eligible
    ).toBe(false);
  });

  it("persiste o ciclo autoridade → aprovação → baseline e protege tenant e imutabilidade", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Projeto de integração",
      inputs,
    });
    ids.projectId = created.projectId;
    ids.versionId = created.versionId;
    await expect(
      getProjectForTenant(created.projectId, tenantId + 991)
    ).rejects.toThrow("não autorizado");

    const updatedInputs: FinancialInputSnapshot = {
      ...inputs,
      averageTicket: provided("1100"),
    };
    const updated = await updateInputsForTenant({
      tenantId,
      actorId,
      versionId: created.versionId,
      inputs: updatedInputs,
    });
    expect(updated.inputHash).not.toBe(created.inputHash);
    await seedAuthoritativeCommercialDomains(created.versionId, "1100");
    const db = await getDb();
    if (!db) throw new Error("Banco de integração indisponível.");
    const tiedCostTimestamp = new Date("2030-01-01T00:00:00.000Z");
    await db.insert(costCatalogItems).values([
      { id: "z-tied-cost", versionId: created.versionId, category: "legal", name: "Z tied", frequency: "monthly", cashflowTreatment: "included_in_project_totals", amountText: "1", status: "provided", sourceType: "current_document", sourceRef: "db.integration.test:tied-cost", updatedBy: actorId, createdAt: tiedCostTimestamp, updatedAt: tiedCostTimestamp },
      { id: "a-tied-cost", versionId: created.versionId, category: "legal", name: "A tied", frequency: "monthly", cashflowTreatment: "included_in_project_totals", amountText: "1", status: "provided", sourceType: "current_document", sourceRef: "db.integration.test:tied-cost", updatedBy: actorId, createdAt: tiedCostTimestamp, updatedAt: tiedCostTimestamp },
    ]);
    expect((await listCostCatalogForTenant(created.versionId, tenantId)).items.slice(0, 2).map(item => item.id)).toEqual(["a-tied-cost", "z-tied-cost"]);
    await createCostCatalogItemForTenant({ tenantId, actorId, versionId: created.versionId, category: "operations", name: "Operação incremental", frequency: "monthly", amountText: "12000", status: "provided", cashflowTreatment: "incremental", sourceType: "current_document", sourceRef: "db.integration.test:incremental-cost" });
    const snapshot = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: created.versionId,
      horizonMonths: 24,
    });
    expect(snapshot.status).toBe("valid");
    expect(snapshot.projections[0]?.fixedCosts).toBe("13000.00000000");
    expect(snapshot.authoritativeDomains).toMatchObject({ costCatalog: { cashflowAdjustments: { status: "valid", fixedCostMonthly: "12000.00000000" } } });
    ids.snapshotId = snapshot.id;
    ids.snapshotHash = snapshot.snapshotHash;
    expect(
      (await getExportEligibilityForTenant(snapshot.id, tenantId)).eligible
    ).toBe(false);

    const initialKpiMemory = await db
      .select({ id: kpiMemoryRecords.id })
      .from(kpiMemoryRecords)
      .where(eq(kpiMemoryRecords.snapshotId, snapshot.id));
    const repeatedSnapshot = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: created.versionId,
      horizonMonths: 24,
    });
    expect(repeatedSnapshot.id).toBe(snapshot.id);
    expect(repeatedSnapshot.snapshotHash).toBe(snapshot.snapshotHash);
    expect(
      await db
        .select({ id: calculationSnapshots.id })
        .from(calculationSnapshots)
        .where(eq(calculationSnapshots.projectVersionId, created.versionId))
    ).toHaveLength(1);
    expect(
      await db
        .select({ id: kpiMemoryRecords.id })
        .from(kpiMemoryRecords)
        .where(eq(kpiMemoryRecords.snapshotId, snapshot.id))
    ).toHaveLength(initialKpiMemory.length);
    expect(
      await db
        .select({ id: workflowEvents.id })
        .from(workflowEvents)
        .where(and(
          eq(workflowEvents.versionId, created.versionId),
          eq(workflowEvents.action, "snapshot.submitted_for_review")
        ))
    ).toHaveLength(1);
    expect(
      await db
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(and(
          eq(auditEvents.entityId, snapshot.id),
          eq(auditEvents.action, "snapshot.created")
        ))
    ).toHaveLength(1);

    const approvalResults = await Promise.all([
      approveSnapshotForTenant({
        tenantId,
        actorId,
        snapshotId: snapshot.id,
        rationale: "Integração valida o ciclo de governança.",
      }),
      approveSnapshotForTenant({
        tenantId,
        actorId,
        snapshotId: snapshot.id,
        rationale: "Repetição concorrente deve ser idempotente.",
      }),
    ]);
    expect(approvalResults.map(result => result.idempotent).sort()).toEqual([
      false,
      true,
    ]);
    expect(
      await approveSnapshotForTenant({
        tenantId,
        actorId,
        snapshotId: snapshot.id,
        rationale: "Repetição sequencial deve ser idempotente.",
      })
    ).toMatchObject({ approved: true, idempotent: true });
    expect(
      await db
        .select({ id: approvalDecisions.id })
        .from(approvalDecisions)
        .where(
          and(
            eq(approvalDecisions.snapshotId, snapshot.id),
            eq(approvalDecisions.decision, "approved")
          )
        )
    ).toHaveLength(1);
    expect(
      await db
        .select({ id: workflowEvents.id })
        .from(workflowEvents)
        .where(
          and(
            eq(workflowEvents.versionId, created.versionId),
            eq(workflowEvents.action, "snapshot.approved")
          )
        )
    ).toHaveLength(1);
    expect(
      await db
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityId, snapshot.id),
            eq(auditEvents.action, "snapshot.approved")
          )
        )
    ).toHaveLength(1);

    const baselineResults = await Promise.all([
      freezeBaselineForTenant({
        tenantId,
        actorId,
        snapshotId: snapshot.id,
      }),
      freezeBaselineForTenant({
        tenantId,
        actorId,
        snapshotId: snapshot.id,
      }),
    ]);
    expect(baselineResults.map(result => result.idempotent).sort()).toEqual([
      false,
      true,
    ]);
    expect(
      await freezeBaselineForTenant({
        tenantId,
        actorId,
        snapshotId: snapshot.id,
      })
    ).toMatchObject({ baseline: true, idempotent: true });
    expect(
      await db
        .select({ id: workflowEvents.id })
        .from(workflowEvents)
        .where(
          and(
            eq(workflowEvents.versionId, created.versionId),
            eq(workflowEvents.action, "baseline.frozen")
          )
        )
    ).toHaveLength(1);
    expect(
      await db
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityId, created.versionId),
            eq(auditEvents.action, "baseline.frozen")
          )
        )
    ).toHaveLength(1);
    expect(
      await db
        .select({ id: historicalBenchmarks.id })
        .from(historicalBenchmarks)
        .where(
          and(
            eq(historicalBenchmarks.tenantId, tenantId),
            eq(
              historicalBenchmarks.sourceRef,
              `snapshot:${snapshot.snapshotHash}`
            )
          )
        )
    ).toHaveLength(1);
    const context = await getProjectContextForTenant(
      created.projectId,
      tenantId
    );
    expect(context.project.status).toBe("baseline");
    expect(context.versions[0]?.isImmutable).toBe(true);
    expect(
      (await getExportEligibilityForTenant(snapshot.id, tenantId)).eligible
    ).toBe(true);
    expect(
      (await listHistoricalBenchmarksForTenant(tenantId)).some(
        item => item.sourceRef === `snapshot:${snapshot.snapshotHash}`
      )
    ).toBe(true);
    await expect(
      updateInputsForTenant({
        tenantId,
        actorId,
        versionId: created.versionId,
        inputs: updatedInputs,
      })
    ).rejects.toThrow("Apenas versão de trabalho");

    const scenario = await createScenarioForTenant({
      tenantId,
      actorId,
      baseVersionId: created.versionId,
      name: "[TEST] Cronograma de implantação",
      reason: "Testar caixa por mês de captação, sala e sales kit.",
    });
    ids.scenarioVersionId = scenario.versionId;
    expect(
      (await getProductCatalogForTenant(scenario.versionId, tenantId, 0)).records
    ).toHaveLength(1);
    expect(
      await listCommercialConditionsForTenant(scenario.versionId, tenantId)
    ).toHaveLength(1);
    const scenarioCosts = (await listCostCatalogForTenant(scenario.versionId, tenantId)).items;
    expect(scenarioCosts).toHaveLength(3);
    expect(scenarioCosts).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Operação incremental", cashflowTreatment: "incremental" }),
    ]));
    const scenarioInputs = await getInputsForVersion(scenario.versionId);
    const scheduledInputs: FinancialInputSnapshot = {
      ...scenarioInputs,
      preOperationMonths: provided("3"),
      capexAcquisitionShareRate: provided("0.2"),
      capexAcquisitionMonth: provided("1"),
      capexSalesRoomShareRate: provided("0.5"),
      capexSalesRoomMonth: provided("2"),
      capexSalesKitShareRate: provided("0.3"),
      capexSalesKitMonth: provided("3"),
    };
    await updateInputsForTenant({
      tenantId,
      actorId,
      versionId: scenario.versionId,
      inputs: scheduledInputs,
    });
    const scenarioSnapshot = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: scenario.versionId,
      horizonMonths: 24,
    });
    ids.scenarioSnapshotId = scenarioSnapshot.id;
    expect(scenarioSnapshot.status).toBe("valid");
    expect(
      scenarioSnapshot.projections
        .slice(0, 3)
        .map(row => row.preOperationalInvestment)
    ).toEqual(["1000.00000000", "2500.00000000", "1500.00000000"]);
    const copiedSchedule = await getInputsForVersion(scenario.versionId);
    expect(copiedSchedule.capexSalesRoomMonth.value).toBe("2");
  });
});
