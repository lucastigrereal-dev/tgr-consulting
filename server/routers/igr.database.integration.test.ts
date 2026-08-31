import { and, count, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { FinancialInputSnapshot } from "../../shared/financial/types";
import type { CommercialOperationsDefinition } from "../../shared/financial/commercialOperations";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { igrRouter } from "./igr";
import { auditEvents, productPricePhases, productSkus, projects, projectVersions } from "../../drizzle/schema";

const ownerId = 1;
const outsiderId = 991_001;
const ids = { projectId: "", versionId: "", pendingSnapshotId: "", snapshotId: "", snapshotHash: "", decisionId: "", costId: "", commercialConditionId: "", receivablesPolicyId: "", scenarioBranchId: "", scenarioVersionId: "", meetingScenarioBranchId: "", meetingScenarioVersionId: "", cotiaProjectId: "", cotiaVersionId: "", cotiaRollbackProjectId: "", cotiaRollbackVersionId: "", cotiaCreatedProjectId: "", cotiaCreatedVersionId: "" };
const provided = (value: string) => ({ status: "provided" as const, value, sourceType: "assumption" as const, sourceRef: "igr.database.integration.test" });
const inputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("100"), qualifiedCouplesGrowthRate: provided("0"), conversionRate: provided("0.1"), averageTicket: provided("1000"),
  collectionRate: provided("0.8"), cancellationRate: provided("0.1"), variableCostRate: provided("0.2"), partnerShareRate: provided("0.05"),
  fixedCostMonthly: provided("1000"), payrollMonthly: provided("1000"), capexInitial: provided("5000"), preOperationMonths: provided("0"), entryValuePerContract: provided("100"),
  paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"),
  paymentCardInstallmentMixRate: provided("0"), paymentCardInstallmentMdrRate: provided("0"), paymentCardInstallmentSettlementDays: provided("0"),
  paymentDebitMixRate: provided("0"), paymentDebitMdrRate: provided("0"), paymentDebitSettlementDays: provided("0"),
  paymentRecurringChequeMixRate: provided("0"), paymentRecurringChequeMdrRate: provided("0"), paymentRecurringChequeSettlementDays: provided("0"),
  paymentBoletoMixRate: provided("0"), paymentBoletoMdrRate: provided("0"), paymentBoletoSettlementDays: provided("0"), discountRateAnnual: provided("0.12"),
};
const commercialOperationsDefinition = {
  room: {
    rooms: [{ roomId: "main", tables: "4", overflowTables: "1" }],
    operatingDaysPerMonth: "20", operatingHoursPerDay: "8", shifts: "2",
    averageTourDurationMinutes: "60", toursPerTable: "1",
    receptionists: "2", receptionCapacityPerPerson: "200",
    consultants: "2", consultantCapacityPerPerson: "100",
    closers: "2", closerSalesCapacityPerPerson: "20",
    peakFlowFactor: "1.5", maxWaitMinutes: "15",
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
      trainerMonthlyCost: "100", candidateMonthlySalary: "50", monthlySupportCost: "0",
      approvalRate: "1", certificationRate: "1", timeToProductiveMonths: 0,
      targetProductivePeople: "2",
    }],
  },
  commissions: { cashflowTreatment: "included_in_project_totals", policies: [] },
} satisfies CommercialOperationsDefinition;

function contextFor(userId: number, role: "user" | "admin" = "admin"): TrpcContext {
  return { user: { id: userId, openId: `igr-e2e-${userId}`, name: "IGR E2E", email: `igr-e2e-${userId}@test.local`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

afterAll(async () => {
  const db = await getDb();
  if (!db || !ids.projectId) return;
  await db.execute(sql`DELETE FROM audit_events WHERE entityId IN (${ids.projectId}, ${ids.versionId}, ${ids.pendingSnapshotId}, ${ids.snapshotId}, ${ids.decisionId}, ${ids.costId}, ${ids.commercialConditionId}, ${ids.receivablesPolicyId}, ${ids.scenarioBranchId}, ${ids.scenarioVersionId}, ${ids.meetingScenarioBranchId}, ${ids.meetingScenarioVersionId}, ${ids.cotiaVersionId}, ${ids.cotiaRollbackVersionId}, ${ids.cotiaCreatedVersionId})`);
  await db.execute(sql`DELETE FROM historical_benchmarks WHERE tenantId = ${ownerId} AND sourceRef = ${`snapshot:${ids.snapshotHash}`}`);
  await db.execute(sql`DELETE FROM approval_decisions WHERE snapshotId = ${ids.snapshotId}`);
  await db.execute(sql`DELETE FROM kpi_memory_records WHERE snapshotId = ${ids.snapshotId}`);
  await db.execute(sql`DELETE FROM calculation_snapshots WHERE projectVersionId IN (${ids.versionId}, ${ids.scenarioVersionId}, ${ids.meetingScenarioVersionId})`);
  await db.execute(sql`DELETE FROM decision_records WHERE versionId = ${ids.versionId}`);
  await db.execute(sql`DELETE FROM cost_catalog_items WHERE versionId = ${ids.versionId}`);
  await db.execute(sql`DELETE FROM project_component_records WHERE versionId IN (${ids.versionId}, ${ids.scenarioVersionId}, ${ids.meetingScenarioVersionId}, ${ids.cotiaVersionId}, ${ids.cotiaRollbackVersionId}, ${ids.cotiaCreatedVersionId})`);
  await db.execute(sql`DELETE FROM input_values WHERE versionId IN (${ids.versionId}, ${ids.scenarioVersionId}, ${ids.meetingScenarioVersionId}, ${ids.cotiaVersionId}, ${ids.cotiaRollbackVersionId}, ${ids.cotiaCreatedVersionId})`);
  await db.execute(sql`DELETE FROM workflow_events WHERE projectId IN (${ids.projectId}, ${ids.cotiaProjectId}, ${ids.cotiaRollbackProjectId}, ${ids.cotiaCreatedProjectId})`);
  await db.execute(sql`DELETE FROM scenario_branches WHERE projectId = ${ids.projectId}`);
  await db.execute(sql`DELETE FROM project_versions WHERE id = ${ids.scenarioVersionId}`);
  await db.execute(sql`DELETE FROM project_versions WHERE id = ${ids.meetingScenarioVersionId}`);
  await db.execute(sql`DELETE FROM project_versions WHERE id = ${ids.versionId}`);
  await db.execute(sql`DELETE FROM projects WHERE id = ${ids.projectId}`);
  await db.execute(sql`DELETE FROM project_versions WHERE id IN (${ids.cotiaVersionId}, ${ids.cotiaRollbackVersionId}, ${ids.cotiaCreatedVersionId})`);
  await db.execute(sql`DELETE FROM projects WHERE id IN (${ids.cotiaProjectId}, ${ids.cotiaRollbackProjectId}, ${ids.cotiaCreatedProjectId})`);
});

describe("igrRouter + banco", () => {
  it("percorre o fluxo crítico pela API e bloqueia outro tenant", async () => {
    const owner = igrRouter.createCaller(contextFor(ownerId));
    const outsider = igrRouter.createCaller(contextFor(outsiderId));
    const created = await owner.createProject({ name: "[TEST] IGR tRPC integrado", inputs });
    ids.projectId = created.projectId; ids.versionId = created.versionId;
    await expect(outsider.project({ projectId: created.projectId })).rejects.toThrow("não autorizado");
    const assembly = await owner.upsertBuilderComponent({ versionId: created.versionId, componentType: "project_assembly", name: "Ficha de Montagem", status: "provided", payload: { nomeProjeto: "[TEST] Projeto Pipa", praca: "Pipa, RN", inicioOperacao: "2027-03", totalApartamentos: "40", cotasPorApartamento: "52", horizonteMeses: "24", investimentoPreOperacional: "5000" }, sourceType: "current_decision", sourceRef: "Briefing de abertura" });
    expect(assembly.componentType).toBe("project_assembly");
    const components = await owner.builderComponents({ versionId: created.versionId });
    expect(components.some(component => component.componentType === "project_assembly")).toBe(true);
    expect(components.find(component => component.componentType === "project_assembly")?.payload).toMatchObject({ nomeProjeto: "[TEST] Projeto Pipa", praca: "Pipa, RN", totalApartamentos: "40" });

    const updatedInputs: FinancialInputSnapshot = {
      ...inputs,
      qualifiedCouplesMonth1: provided("1"),
      qualifiedCouplesGrowthRate: provided("0.9"),
      conversionRate: provided("1"),
      averageTicket: provided("1100"),
    };
    await owner.updateInputs({ versionId: created.versionId, inputs: updatedInputs });
    expect((await owner.versionInputs({ versionId: created.versionId })).averageTicket.value).toBe("1100");
    const decision = await owner.createDecision({ versionId: created.versionId, inputKey: "averageTicket", title: "Ticket aprovado", decisionValue: "1100", rationale: "Comitê validou o ticket com base no produto definido.", responsible: "Comitê de investimento", sourceRef: "Ata de integração tRPC" });
    ids.decisionId = decision.id;
    const cost = await owner.createCostCatalogItem({ versionId: created.versionId, category: "operations", name: "Custo validado", frequency: "monthly", cashflowTreatment: "included_in_project_totals", amountText: "1200", status: "provided", sourceType: "current_document", sourceRef: "Contrato operacional" });
    ids.costId = cost.id;

    const commercialModelInput = {
      versionId: created.versionId,
      asOfMonth: 0,
      skus: [
        {
          id: "pipa-2q",
          name: "Pipa 2 Quartos",
          unitType: "2Q",
          unitQuantity: 20,
          sharesPerUnit: 4,
          grossSoldShares: 3,
          returnedShares: 0,
          blockedShares: 1,
          status: "provided",
          sourceType: "current_document",
          sourceRef: "Memorial de incorporação",
          pricePhases: [{ id: "launch", startsAtMonth: 0, price: "110000" }],
        },
      ],
      conditions: [{
        productSkuCode: "pipa-2q",
        status: "provided" as const,
        sourceType: "current_document" as const,
        sourceRef: "Tabela comercial",
        condition: {
          id: "standard",
          name: "Condição padrão",
          listPrice: "110000",
          discount: "0",
          entry: { total: "20000", installments: 4, firstDueMonth: 0 },
          balance: {
            principal: "89000",
            installments: 48,
            graceMonths: 1,
            firstDueMonth: 2,
          },
          explicitCharges: "1000",
          explicitChargesDueMonth: 7,
          materialityTolerance: "0.01",
        },
      }],
    };
    const savedCommercialModel = await owner.saveCommercialModel(commercialModelInput);
    ids.commercialConditionId = savedCommercialModel.conditions[0]!.record.id;
    const catalog = await owner.productCatalog({
      versionId: created.versionId,
      asOfMonth: 0,
    });
    expect(catalog.evaluation.totals).toMatchObject({
      initialShares: 80,
      netSoldShares: 3,
      availableShares: 76,
    });
    await expect(outsider.productCatalog({ versionId: created.versionId, asOfMonth: 0 })).rejects.toThrow("não autorizado");
    await expect(outsider.saveCommercialModel(commercialModelInput)).rejects.toThrow("não autorizado");
    const savedConditions = await owner.commercialConditions({ versionId: created.versionId });
    expect(savedConditions[0]?.reconciliation.status).toBe("valid");
    expect(savedConditions[0]?.condition).toMatchObject({
      explicitCharges: "1000",
      explicitChargesDueMonth: 7,
    });

    const policy = {
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
      policyVersion: "portfolio-v1",
      sourceRef: "Ata de política de carteira",
    };
    const capturePoint = {
      pointId: "pipa-pdv",
      name: "PDV Pipa",
      channel: "PDV",
      activationCost: "5000",
      monthlyFixedCost: "1000",
      costPerSale: "50",
      approaches: "100",
      researchRate: "1",
      qualificationRate: "1",
      invitationRate: "1",
      appointmentRate: "1",
      showRate: "1",
      tourRate: "1",
      saleRate: "0.1",
      cannibalizationRate: "0",
      cashflowTreatment: "included_in_project_totals" as const,
    };
    const pendingPoints = await owner.replaceCapturePoints({
      versionId: created.versionId,
      points: [{
        status: "pending",
        sourceType: "current_decision",
        definition: capturePoint,
      }],
    });
    expect(pendingPoints).toHaveLength(1);
    expect(pendingPoints[0]).toMatchObject({
      status: "pending",
      definition: { pointId: "pipa-pdv" },
    });
    await expect(owner.replaceCapturePoints({
      versionId: created.versionId,
      points: [{
        status: "provided",
        sourceType: "current_document",
        sourceRef: "Cadastro de pontos",
        definition: { ...capturePoint, saleRate: "1.01" },
      }],
    })).rejects.toThrow();
    await expect(outsider.capturePoints({ versionId: created.versionId }))
      .rejects.toThrow("não autorizado");
    const pendingOperations = await owner.upsertCommercialOperations({
      versionId: created.versionId,
      status: "pending",
      sourceType: "current_decision",
      definition: commercialOperationsDefinition,
    });
    expect(pendingOperations).toMatchObject({
      record: { status: "pending", name: "commercial-operations" },
      definition: { room: { rooms: [{ roomId: "main" }] } },
    });
    expect(await owner.commercialOperations({ versionId: created.versionId }))
      .toMatchObject({ record: { status: "pending" } });
    await expect(owner.upsertCommercialOperations({
      versionId: created.versionId,
      status: "provided",
      sourceType: "current_document",
      sourceRef: "Plano de operações",
      definition: {
        ...commercialOperationsDefinition,
        room: { ...commercialOperationsDefinition.room, shifts: "0" },
      },
    })).rejects.toThrow();
    await expect(outsider.commercialOperations({ versionId: created.versionId }))
      .rejects.toThrow("não autorizado");
    const pendingPolicy = await owner.upsertReceivablesPolicy({
      versionId: created.versionId,
      status: "pending",
      sourceType: "current_decision",
      policy,
    });
    ids.receivablesPolicyId = pendingPolicy.record.id;
    expect(pendingPolicy).toMatchObject({
      record: { status: "pending", sourceRef: null },
      policy: { policyVersion: "portfolio-v1" },
    });
    expect(await owner.receivablesPolicy({ versionId: created.versionId })).toMatchObject({
      record: { id: pendingPolicy.record.id, status: "pending" },
    });
    await expect(
      outsider.receivablesPolicy({ versionId: created.versionId }),
    ).rejects.toThrow("não autorizado");
    const pendingSnapshot = await owner.calculate({
      versionId: created.versionId,
      horizonMonths: 24,
    });
    ids.pendingSnapshotId = pendingSnapshot.id;
    expect(pendingSnapshot.status).toBe("blocked_by_pending_inputs");
    expect(pendingSnapshot.domainBlockers).toContain("receivables_policy.pending");
    expect(pendingSnapshot.domainBlockers).toContain("capture_points.pending");
    expect(pendingSnapshot.domainBlockers).toContain("commercial_operations.pending");
    expect(pendingSnapshot.domainInvalidities).not.toContain("receivables_policy.invalid");

    const providedPolicy = await owner.upsertReceivablesPolicy({
      versionId: created.versionId,
      status: "provided",
      sourceType: "current_decision",
      sourceRef: "Ata de política de carteira",
      policy,
    });
    expect(providedPolicy).toMatchObject({
      record: { id: pendingPolicy.record.id, status: "provided", sourceRef: "Ata de política de carteira" },
      policy,
    });
    await expect(
      outsider.upsertReceivablesPolicy({
        versionId: created.versionId,
        status: "provided",
        sourceType: "current_decision",
        sourceRef: "Ata de política de carteira",
        policy,
      }),
    ).rejects.toThrow("não autorizado");
    await owner.replaceCapturePoints({
      versionId: created.versionId,
      points: [{
        status: "provided",
        sourceType: "current_document",
        sourceRef: "Cadastro de pontos",
        definition: capturePoint,
      }],
    });
    await expect(outsider.replaceCapturePoints({
      versionId: created.versionId,
      points: [{
        status: "provided",
        sourceType: "current_document",
        sourceRef: "Cadastro de pontos",
        definition: capturePoint,
      }],
    })).rejects.toThrow("não autorizado");
    await owner.upsertCommercialOperations({
      versionId: created.versionId,
      status: "provided",
      sourceType: "current_document",
      sourceRef: "Plano de operações",
      definition: commercialOperationsDefinition,
    });
    await expect(outsider.upsertCommercialOperations({
      versionId: created.versionId,
      status: "provided",
      sourceType: "current_document",
      sourceRef: "Plano de operações",
      definition: commercialOperationsDefinition,
    })).rejects.toThrow("não autorizado");

    const scenario = await owner.createScenario({
      baseVersionId: created.versionId,
      name: "Política herdada",
      reason: "Provar cópia autoritativa da política de carteira.",
    });
    ids.scenarioBranchId = scenario.branchId;
    ids.scenarioVersionId = scenario.versionId;
    expect(await owner.receivablesPolicy({ versionId: scenario.versionId })).toMatchObject({
      record: { versionId: scenario.versionId, status: "provided", sourceRef: "Ata de política de carteira" },
      policy,
    });
    expect(await owner.capturePoints({ versionId: scenario.versionId })).toMatchObject([{
      record: { versionId: scenario.versionId },
      status: "provided",
      definition: { pointId: "pipa-pdv" },
    }]);
    expect(await owner.commercialOperations({ versionId: scenario.versionId }))
      .toMatchObject({
        record: { versionId: scenario.versionId, status: "provided" },
        definition: { room: { rooms: [{ roomId: "main" }] } },
      });

    const snapshot = await owner.calculate({ versionId: created.versionId, horizonMonths: 24 });
    ids.snapshotId = snapshot.id; ids.snapshotHash = snapshot.snapshotHash;
    expect(snapshot.kpis.grossSales).toBe("8893572.83741480");
    expect(snapshot.kpis.grossEntryGenerated).toBe("1617013.24316633");
    expect(snapshot.kpis.grossReceivablesGenerated).toBe("8893572.83741480");
    expect(Number(snapshot.kpis.installmentCollections)).toBeGreaterThan(0);
    expect(snapshot.projections.reduce((total, row) => total + Number(row.contracts), 0)).toBeCloseTo(80.85066215831636, 7);
    expect(Math.max(...snapshot.projections.map(row => Number(row.activeContracts)))).toBeLessThanOrEqual(76);
    expect(snapshot.authoritativeDomains?.commercialModel?.derived).toMatchObject({ averageTicket: "110000.00000000", entryValuePerContract: "20000.00000000", maxContracts: "76.00000000" });
    expect(snapshot.authoritativeDomains?.commercialModel?.derived.paymentSchedulePerContract.length).toBeGreaterThan(1);
    expect(snapshot.authoritativeDomains?.commercialModel?.derived.paymentSchedulePerContract).toContainEqual({
      component: "explicit_charge",
      dueMonthOffset: 7,
      grossAmount: "1000.00000000",
    });
    expect(snapshot.authoritativeDomains?.receivablesPolicy).toMatchObject({
      status: "provided",
      policy,
    });
    expect(snapshot.authoritativeDomains?.capturePoints).toMatchObject({
      definitions: [{ status: "provided", definition: { pointId: "pipa-pdv" } }],
      economics: {
        totals: {
          funnel: { qualified: "100.00000000" },
          production: { totalSales: "10.00000000" },
        },
      },
    });
    expect(snapshot.authoritativeDomains?.commercialOperations).toMatchObject({
      status: "provided",
      definition: { room: { rooms: [{ roomId: "main" }] } },
      results: {
        room: { capacity: { limitedToursMonthly: "200.00000000" } },
        training: [{ trainingId: "academy" }],
      },
    });
    expect(snapshot.authoritativeDomains?.commercialOperations?.results?.workforce.months[0])
      .toMatchObject({ month: 0 });
    expect(Number(snapshot.projections[7]?.grossReceivablesSettled)).toBeGreaterThan(0);
    const contextWithSnapshot = await owner.projectContext({ projectId: created.projectId });
    const validSnapshotHistory = contextWithSnapshot.snapshotHistory.find(item => item.id === snapshot.id);
    expect(validSnapshotHistory).toMatchObject({ id: snapshot.id, snapshotHash: snapshot.snapshotHash, calculationStatus: "valid" });
    expect(validSnapshotHistory?.kpis).toHaveProperty("npv");
    expect(contextWithSnapshot.latestImpact.changedInputKeys).toContain("averageTicket");
    const simulation = await owner.simulateCaptadores({ versionId: created.versionId, horizonMonths: 24, captadorDelta: "-2", qualifiedCouplesPerCaptadorMonth: "12", loadedCostPerCaptadorMonth: "3500", payrollMonthlyDelta: "750", variableCostMonthlyDelta: "300", capexInitialDelta: "2500" });
    expect(simulation.mode).toBe("non_persistent");
    expect(simulation.after.qualifiedCouplesMonth1).toBe("76.00000000");
    expect(simulation.after.capexInitial).toBe("7500.00000000");
    expect(simulation.marginal).toMatchObject({ investment: "2500.00000000" });
    expect(simulation.marginal.npv).toMatch(/^-?\d+\.\d{8}$/);
    expect(simulation.marginal.method).toContain("caixa incremental");
    const baselineInputsBeforeMeeting = await owner.versionInputs({ versionId: created.versionId });
    const salesTargetSimulation = await owner.simulateCaptadores({
      versionId: created.versionId,
      horizonMonths: 24,
      captadorDelta: "0",
      qualifiedCouplesPerCaptadorMonth: "25",
      loadedCostPerCaptadorMonth: "0",
      targetGrossSalesMonth1: "12",
    });
    expect(salesTargetSimulation.before.grossSalesMonth1).toBe("10.00000000");
    expect(salesTargetSimulation.after.grossSalesMonth1).toBe("12.00000000");
    expect(Number(salesTargetSimulation.after.qualifiedCouplesMonth1)).toBeGreaterThan(Number(salesTargetSimulation.before.qualifiedCouplesMonth1));
    expect(salesTargetSimulation.after.kpis.npv).not.toBe(salesTargetSimulation.before.kpis.npv);
    expect(await owner.versionInputs({ versionId: created.versionId })).toEqual(baselineInputsBeforeMeeting);
    const promotedMeeting = await owner.promoteMeetingSimulationToScenario({
      versionId: created.versionId,
      baseSnapshotId: snapshot.id,
      horizonMonths: 24,
      captadorDelta: "0",
      qualifiedCouplesPerCaptadorMonth: "25",
      loadedCostPerCaptadorMonth: "0",
      targetGrossSalesMonth1: "12",
      name: "Boardroom 12 vendas",
      reason: "Meta deliberada no teste integrado.",
      sourceRef: "Ata Boardroom 42",
    });
    ids.meetingScenarioBranchId = promotedMeeting.branchId;
    ids.meetingScenarioVersionId = promotedMeeting.versionId;
    expect(await owner.versionInputs({ versionId: promotedMeeting.versionId })).toMatchObject({
      qualifiedCouplesMonth1: { value: "120.00000000", sourceType: "current_decision", sourceRef: "Ata Boardroom 42" },
    });
    expect(await owner.capturePoints({ versionId: promotedMeeting.versionId })).toMatchObject([{
      sourceType: "current_decision",
      sourceRef: "Ata Boardroom 42",
      definition: { pointId: "pipa-pdv", approaches: "120.00000000" },
    }]);
    expect((await owner.calculate({ versionId: promotedMeeting.versionId, horizonMonths: 24 })).status).toBe("valid");
    expect(await owner.versionInputs({ versionId: created.versionId })).toEqual(baselineInputsBeforeMeeting);

    const db = await getDb();
    expect(db).not.toBeNull();
    expect((await db!.select().from(auditEvents).where(and(
      eq(auditEvents.entityId, promotedMeeting.versionId),
      eq(auditEvents.action, "meeting_simulation.promoted"),
    )).limit(1))[0]?.metadata).toMatchObject({ sourceRef: "Ata Boardroom 42", baseSnapshotId: snapshot.id });
    const scenarioCountBeforeRollback = (await db!.select({ id: projectVersions.id }).from(projectVersions)).length;
    await db!.execute(sql.raw("CREATE TRIGGER meeting_promotion_rollback BEFORE INSERT ON audit_events FOR EACH ROW SET NEW.entityId = IF(NEW.action = 'meeting_simulation.promoted', NULL, NEW.entityId)"));
    try {
      await expect(owner.promoteMeetingSimulationToScenario({
        versionId: created.versionId,
        baseSnapshotId: snapshot.id,
        horizonMonths: 24,
        captadorDelta: "0",
        qualifiedCouplesPerCaptadorMonth: "25",
        loadedCostPerCaptadorMonth: "0",
        targetGrossSalesMonth1: "14",
        name: "Boardroom rollback",
        reason: "Forçar falha após clone.",
        sourceRef: "Ata rollback",
      })).rejects.toThrow();
    } finally {
      await db!.execute(sql.raw("DROP TRIGGER IF EXISTS meeting_promotion_rollback"));
    }
    expect((await db!.select({ id: projectVersions.id }).from(projectVersions)).length).toBe(scenarioCountBeforeRollback);
    const envelope = await owner.capitalEnvelope({
      versionId: created.versionId,
      horizonMonths: 24,
      availableCapital: "1000000",
    });
    expect(envelope.requiredCapital).toMatch(/^\d+\.\d{8}$/);
    const goal = await owner.goalSeek({
      versionId: created.versionId,
      horizonMonths: 24,
      targetKpi: "totalOperatingCashFlow",
      variableKey: "qualifiedCouplesMonth1",
      target: "0",
      lowerBound: "0",
      upperBound: "200",
    });
    expect(["converged", "unreachable", "iteration_limit"]).toContain(goal.status);
    await expect(
      owner.goalSeek({
        versionId: created.versionId,
        horizonMonths: 24,
        targetKpi: "npv",
        variableKey: "conversionRate",
        target: "0",
        lowerBound: "0",
        upperBound: "100",
      })
    ).rejects.toThrow("entre 0 e 1");
    expect((await owner.exportEligibility({ snapshotId: snapshot.id })).eligible).toBe(false);
    await owner.approveSnapshot({ snapshotId: snapshot.id, rationale: "Ciclo tRPC integrado aprovado para teste." });
    await owner.freezeBaseline({ snapshotId: snapshot.id });
    expect((await owner.exportEligibility({ snapshotId: snapshot.id })).eligible).toBe(true);
    await expect(owner.updateInputs({ versionId: created.versionId, inputs: updatedInputs })).rejects.toThrow("Apenas versão de trabalho");
    await expect(
      owner.upsertReceivablesPolicy({
        versionId: created.versionId,
        status: "provided",
        sourceType: "current_decision",
        sourceRef: "Ata revisada",
        policy: { ...policy, sourceRef: "Ata revisada" },
      }),
    ).rejects.toThrow("política de carteira");
    await expect(owner.replaceCapturePoints({
      versionId: created.versionId,
      points: [{
        status: "provided",
        sourceType: "current_document",
        sourceRef: "Cadastro de pontos revisado",
        definition: capturePoint,
      }],
    })).rejects.toThrow("versão de trabalho");
    await expect(owner.upsertCommercialOperations({
      versionId: created.versionId,
      status: "provided",
      sourceType: "current_document",
      sourceRef: "Plano revisado",
      definition: commercialOperationsDefinition,
    })).rejects.toThrow("versão de trabalho");
  }, 30_000);

  it("registra a Pagina 1 em uma transacao e preserva SKU e fases nao controlados", async () => {
    const owner = igrRouter.createCaller(contextFor(ownerId));
    const outsider = igrRouter.createCaller(contextFor(outsiderId));
    const pendingInputs = Object.fromEntries(Object.keys(inputs).map(key => [
      key,
      { status: "pending", sourceType: "current_decision" },
    ])) as FinancialInputSnapshot;
    const created = await owner.createProject({ name: "[TEST] Cotia transacional", inputs: pendingInputs });
    ids.cotiaProjectId = created.projectId;
    ids.cotiaVersionId = created.versionId;

    await owner.saveCommercialModel({
      versionId: created.versionId,
      asOfMonth: 0,
      skus: [
        {
          id: "produto-principal", name: "Produto Cotia", unitType: "UH",
          unitQuantity: 60, sharesPerUnit: 52, grossSoldShares: 0,
          returnedShares: 0, blockedShares: 0, status: "provided",
          sourceType: "current_document", sourceRef: "Tabela original",
          pricePhases: [
            { id: "base", startsAtMonth: 0, price: "28000" },
            { id: "futura", startsAtMonth: 6, price: "35000" },
          ],
        },
        {
          id: "outro-sku", name: "Produto preservado", unitType: "UH",
          unitQuantity: 10, sharesPerUnit: 10, grossSoldShares: 0,
          returnedShares: 0, blockedShares: 0, status: "provided",
          sourceType: "current_document", sourceRef: "Tabela paralela",
          pricePhases: [{ id: "base-outro", startsAtMonth: 0, price: "50000" }],
        },
      ],
      conditions: [
        {
          productSkuCode: "produto-principal", status: "provided",
          sourceType: "current_document", sourceRef: "Tabela original",
          condition: {
            id: "condicao-base-cotia", name: "Condicao Cotia", listPrice: "28000", discount: "0",
            entry: { total: "3200", installments: 8, firstDueMonth: 0 },
            balance: { principal: "24800", installments: 84, graceMonths: 2, firstDueMonth: 3 },
            explicitCharges: "0", materialityTolerance: "0.01",
          },
        },
        {
          productSkuCode: "outro-sku", status: "provided",
          sourceType: "current_document", sourceRef: "Tabela paralela",
          condition: {
            id: "condicao-outro", name: "Condicao preservada", listPrice: "50000", discount: "0",
            entry: { total: "5000", installments: 1, firstDueMonth: 0 },
            balance: { principal: "45000", installments: 36, graceMonths: 0, firstDueMonth: 1 },
            explicitCharges: "0", materialityTolerance: "0.01",
          },
        },
      ],
    });
    const db = (await getDb())!;
    const cotiaSkuRow = (await db.select({ id: productSkus.id }).from(productSkus).where(and(eq(productSkus.versionId, created.versionId), eq(productSkus.skuCode, "produto-principal"))).limit(1))[0]!;
    await db.update(productPricePhases).set({ promotionalPriceText: "27000" }).where(and(eq(productPricePhases.productSkuId, cotiaSkuRow.id), eq(productPricePhases.startsAtMonth, 0)));
    const revisionBefore = (await (await getDb())!.select({ financialRevision: projectVersions.financialRevision }).from(projectVersions).where(eq(projectVersions.id, created.versionId)).limit(1))[0]!.financialRevision;
    const assemblyPayload = {
      nomeProjeto: "Projeto Ponta Negra", nomeProduto: "Cota Ponta Negra", praca: "Natal/RN",
      dataBase: "08/2026", inicioOperacao: "01/2027", horizonteMeses: "120",
      valorCota: "30.000,00", valorEntrada: "3.200,00", parcelasEntrada: "8",
      primeiroVencimentoEntradaMes: "0", parcelasSaldo: "84", carenciaSaldoMeses: "2",
      primeiroVencimentoSaldoMes: "3", cotasPorApartamento: "52", totalApartamentos: "60",
      cotasBloqueadas: "0", cotasVendidasAcumuladas: "0", cotasRetornadas: "0",
      cotasVendidasMes: "100", eficiencia: "20", taxaCancelamento: "30",
      percentualAdimplente: "75", descontoComercial: "0", encargosExplicitos: "0",
      toleranciaMaterialidade: "0,01", taxaCorrecao: "1", taxaJuros: "0,5",
      politicaCarteiraVersao: "natal-v1", cancelamentoD7: "5", cancelamentoD30: "10",
      cancelamentoD60: "15", cancelamentoD90: "20", cancelamentoD180: "25",
      cancelamentoLifetime: "30", inadimplencia: "25", curaD1a30: "40",
      curaD31a60: "30", curaD61a90: "20", curaD90Mais: "10", writeOffAposDias: "180",
    };

    await expect(outsider.registerCotiaAssembly({
      versionId: created.versionId, name: "Montagem do Projeto", payload: assemblyPayload,
      sourceRef: "Ata Natal",
    })).rejects.toThrow("não autorizado");
    const registered = await owner.registerCotiaAssembly({
      versionId: created.versionId, name: "Montagem do Projeto", payload: assemblyPayload,
      sourceRef: "Ata Natal",
    });
    expect(registered).toMatchObject({
      status: "provided", commercialModelUpdated: true, policyUpdated: true,
      commercialConditionStatus: "pending",
      warnings: [expect.stringContaining("calendário financeiro indexado")],
    });

    const catalog = await owner.productCatalog({ versionId: created.versionId, asOfMonth: 0 });
    expect(catalog.records.map(record => record.skuCode)).toEqual(["outro-sku", "produto-principal"]);
    const cotiaSku = catalog.records.find(record => record.skuCode === "produto-principal")!;
    expect(cotiaSku.pricePhases.map(phase => ({ month: phase.startsAtMonth, price: phase.priceText }))).toEqual([
      { month: 0, price: "30000" },
      { month: 6, price: "35000" },
    ]);
    expect(cotiaSku.pricePhases.find(phase => phase.startsAtMonth === 0)?.promotionalPriceText).toBe("27000");
    expect(catalog.records.find(record => record.skuCode === "outro-sku")?.pricePhases[0]?.priceText).toBe("50000");
    const conditions = await owner.commercialConditions({ versionId: created.versionId });
    expect(conditions.map(item => item.condition.id)).toEqual(["condicao-base-cotia", "condicao-outro"]);
    expect(conditions.find(item => item.condition.id === "condicao-base-cotia")?.condition).toMatchObject({
      listPrice: "30000", correctionRate: "0.01", interestRate: "0.005",
    });
    expect(conditions.find(item => item.condition.id === "condicao-base-cotia")?.record.status).toBe("pending");
    expect((await owner.receivablesPolicy({ versionId: created.versionId }))?.policy).toMatchObject({
      policyVersion: "natal-v1",
      cancellationCurve: { d7: "0.05", lifetime: "0.3" },
      delinquencyRate: "0.25",
    });
    expect((await owner.versionInputs({ versionId: created.versionId })).averageTicket.value).toBe("30000");
    const revisionAfter = (await (await getDb())!.select({ financialRevision: projectVersions.financialRevision }).from(projectVersions).where(eq(projectVersions.id, created.versionId)).limit(1))[0]!.financialRevision;
    expect(revisionAfter).toBe(revisionBefore + 1);
    const auditCount = await (await getDb())!.select({ value: count() }).from(auditEvents).where(and(eq(auditEvents.entityId, created.versionId), eq(auditEvents.action, "cotia_assembly.registered")));
    expect(auditCount[0]?.value).toBe(1);

    const rollbackCreated = await owner.createProject({ name: "[TEST] Cotia rollback", inputs: pendingInputs });
    ids.cotiaRollbackProjectId = rollbackCreated.projectId;
    ids.cotiaRollbackVersionId = rollbackCreated.versionId;
    await expect(owner.registerCotiaAssembly({
      versionId: rollbackCreated.versionId, name: "Montagem do Projeto",
      payload: { ...assemblyPayload, valorEntrada: "40000" }, sourceRef: "Ata invalida",
    })).rejects.toThrow("exceder o valor da cota");
    expect((await owner.versionInputs({ versionId: rollbackCreated.versionId })).averageTicket.status).toBe("pending");
    expect(await owner.builderComponents({ versionId: rollbackCreated.versionId })).toEqual([]);
    expect((await owner.productCatalog({ versionId: rollbackCreated.versionId, asOfMonth: 0 })).records).toEqual([]);
  }, 30_000);

  it("cria projeto pela Pagina 1 em uma unica transacao e nao deixa residuos invalidos", async () => {
    const owner = igrRouter.createCaller(contextFor(ownerId));
    const db = (await getDb())!;
    const payload = {
      nomeProjeto: "Projeto Cotia atomico", nomeProduto: "Cota Atomica", praca: "Natal/RN",
      dataBase: "08/2026", inicioOperacao: "01/2027", horizonteMeses: "120",
      valorCota: "30000", valorEntrada: "3200", parcelasEntrada: "8",
      primeiroVencimentoEntradaMes: "0", parcelasSaldo: "84", carenciaSaldoMeses: "2",
      primeiroVencimentoSaldoMes: "3", cotasPorApartamento: "52", totalApartamentos: "60",
      cotasBloqueadas: "0", cotasVendidasAcumuladas: "0", cotasRetornadas: "0",
      cotasVendidasMes: "100", eficiencia: "20", taxaCancelamento: "30",
      percentualAdimplente: "75", descontoComercial: "0", encargosExplicitos: "0",
      toleranciaMaterialidade: "0.01", taxaCorrecao: "0", taxaJuros: "0",
    };
    const projectsBefore = (await db.select({ value: count() }).from(projects).where(eq(projects.tenantId, ownerId)))[0]!.value;
    const auditsBefore = (await db.select({ value: count() }).from(auditEvents).where(eq(auditEvents.tenantId, ownerId)))[0]!.value;

    await expect(owner.createProjectFromCotiaAssembly({
      name: "[TEST] Cotia invalido preco", assemblyName: "Montagem do Projeto",
      payload: { ...payload, valorEntrada: "40000" }, sourceRef: "Ata invalida",
    })).rejects.toThrow("exceder o valor da cota");
    await expect(owner.createProjectFromCotiaAssembly({
      name: "[TEST] Cotia invalido estoque", assemblyName: "Montagem do Projeto",
      payload: { ...payload, cotasBloqueadas: "4000" }, sourceRef: "Ata invalida",
    })).rejects.toThrow("exceder o estoque fisico");
    expect((await db.select({ value: count() }).from(projects).where(eq(projects.tenantId, ownerId)))[0]!.value).toBe(projectsBefore);
    expect((await db.select({ value: count() }).from(auditEvents).where(eq(auditEvents.tenantId, ownerId)))[0]!.value).toBe(auditsBefore);

    const created = await owner.createProjectFromCotiaAssembly({
      name: "[TEST] Cotia criado atomicamente", assemblyName: "Montagem do Projeto",
      payload, sourceRef: "Ata valida",
    });
    ids.cotiaCreatedProjectId = created.projectId;
    ids.cotiaCreatedVersionId = created.versionId;
    expect(created).toMatchObject({
      status: "provided", commercialConditionStatus: "provided", warnings: [],
    });
    expect(await owner.project({ projectId: created.projectId })).toMatchObject({ id: created.projectId });
    expect(await owner.builderComponents({ versionId: created.versionId })).toHaveLength(1);
    expect((await owner.productCatalog({ versionId: created.versionId, asOfMonth: 0 })).records).toHaveLength(1);
    expect(await owner.commercialConditions({ versionId: created.versionId })).toHaveLength(1);
    expect((await owner.versionInputs({ versionId: created.versionId })).averageTicket.value).toBe("30000");
    expect((await db.select({ value: count() }).from(auditEvents).where(and(eq(auditEvents.entityId, created.versionId), eq(auditEvents.action, "cotia_assembly.registered"))))[0]!.value).toBe(1);
  }, 30_000);
});
