import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { FinancialInputSnapshot } from "../shared/financial/types";
import {
  approveSnapshotForTenant,
  createCalculationSnapshot,
  createProjectForTenant,
  createScenarioForTenant,
  freezeBaselineForTenant,
  getDb,
  getExportEligibilityForTenant,
  getInputsForVersion,
  getProjectContextForTenant,
  getProjectForTenant,
  listHistoricalBenchmarksForTenant,
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

afterAll(async () => {
  const db = await getDb();
  if (!db || !ids.projectId) return;
  await db.execute(
    sql`DELETE FROM audit_events WHERE entityId IN (${ids.projectId}, ${ids.versionId}, ${ids.snapshotId}, ${ids.scenarioVersionId}, ${ids.scenarioSnapshotId}, ${ids.rollbackProjectId}, ${ids.rollbackVersionId}, ${ids.rollbackSnapshotId})`
  );
  await db.execute(
    sql`DELETE FROM historical_benchmarks WHERE tenantId = ${tenantId} AND sourceRef = ${`snapshot:${ids.snapshotHash}`}`
  );
  await db.execute(
    sql`DELETE FROM approval_decisions WHERE snapshotId = ${ids.snapshotId}`
  );
  await db.execute(
    sql`DELETE FROM approval_decisions WHERE snapshotId = ${ids.rollbackSnapshotId}`
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
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.versionId}`
  );
  await db.execute(
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.scenarioVersionId}`
  );
  await db.execute(
    sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.rollbackVersionId}`
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
    sql`DELETE FROM scenario_branches WHERE projectId = ${ids.projectId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.projectId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.rollbackProjectId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.versionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.rollbackVersionId}`
  );
  await db.execute(sql`DELETE FROM projects WHERE id = ${ids.projectId}`);
  await db.execute(
    sql`DELETE FROM projects WHERE id = ${ids.rollbackProjectId}`
  );
});

describe("IGR database integration", () => {
  it("reverte toda a aprovação quando uma escrita intermediária falha", async () => {
    const created = await createProjectForTenant({
      tenantId,
      actorId,
      name: "[TEST] Rollback de aprovação",
      inputs,
    });
    ids.rollbackProjectId = created.projectId;
    ids.rollbackVersionId = created.versionId;
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
        "CREATE TRIGGER tgr_test_fail_approval_workflow BEFORE INSERT ON workflow_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced approval failure'"
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
      ).rejects.toThrow("forced approval failure");
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
    const snapshot = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: created.versionId,
      horizonMonths: 24,
    });
    expect(snapshot.status).toBe("valid");
    ids.snapshotId = snapshot.id;
    ids.snapshotHash = snapshot.snapshotHash;
    expect(
      (await getExportEligibilityForTenant(snapshot.id, tenantId)).eligible
    ).toBe(false);

    await approveSnapshotForTenant({
      tenantId,
      actorId,
      snapshotId: snapshot.id,
      rationale: "Integração valida o ciclo de governança.",
    });
    await freezeBaselineForTenant({
      tenantId,
      actorId,
      snapshotId: snapshot.id,
    });
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
