import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { FinancialInputSnapshot } from "../../shared/financial/types";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { igrRouter } from "./igr";

const ownerId = 1;
const outsiderId = 991_001;
const ids = { projectId: "", versionId: "", snapshotId: "", snapshotHash: "", decisionId: "", costId: "" };
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

function contextFor(userId: number, role: "user" | "admin" = "admin"): TrpcContext {
  return { user: { id: userId, openId: `igr-e2e-${userId}`, name: "IGR E2E", email: `igr-e2e-${userId}@test.local`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

afterAll(async () => {
  const db = await getDb();
  if (!db || !ids.projectId) return;
  await db.execute(sql`DELETE FROM audit_events WHERE entityId IN (${ids.projectId}, ${ids.versionId}, ${ids.snapshotId}, ${ids.decisionId}, ${ids.costId})`);
  await db.execute(sql`DELETE FROM historical_benchmarks WHERE tenantId = ${ownerId} AND sourceRef = ${`snapshot:${ids.snapshotHash}`}`);
  await db.execute(sql`DELETE FROM approval_decisions WHERE snapshotId = ${ids.snapshotId}`);
  await db.execute(sql`DELETE FROM kpi_memory_records WHERE snapshotId = ${ids.snapshotId}`);
  await db.execute(sql`DELETE FROM calculation_snapshots WHERE projectVersionId = ${ids.versionId}`);
  await db.execute(sql`DELETE FROM decision_records WHERE versionId = ${ids.versionId}`);
  await db.execute(sql`DELETE FROM cost_catalog_items WHERE versionId = ${ids.versionId}`);
  await db.execute(sql`DELETE FROM project_component_records WHERE versionId = ${ids.versionId}`);
  await db.execute(sql`DELETE FROM input_values WHERE versionId = ${ids.versionId}`);
  await db.execute(sql`DELETE FROM workflow_events WHERE projectId = ${ids.projectId}`);
  await db.execute(sql`DELETE FROM project_versions WHERE id = ${ids.versionId}`);
  await db.execute(sql`DELETE FROM projects WHERE id = ${ids.projectId}`);
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

    const updatedInputs: FinancialInputSnapshot = { ...inputs, averageTicket: provided("1100") };
    await owner.updateInputs({ versionId: created.versionId, inputs: updatedInputs });
    expect((await owner.versionInputs({ versionId: created.versionId })).averageTicket.value).toBe("1100");
    const decision = await owner.createDecision({ versionId: created.versionId, inputKey: "averageTicket", title: "Ticket aprovado", decisionValue: "1100", rationale: "Comitê validou o ticket com base no produto definido.", responsible: "Comitê de investimento", sourceRef: "Ata de integração tRPC" });
    ids.decisionId = decision.id;
    const cost = await owner.createCostCatalogItem({ versionId: created.versionId, category: "operations", name: "Custo validado", frequency: "monthly", amountText: "1200", status: "provided", sourceType: "current_document", sourceRef: "Contrato operacional" });
    ids.costId = cost.id;

    const snapshot = await owner.calculate({ versionId: created.versionId, horizonMonths: 24 });
    ids.snapshotId = snapshot.id; ids.snapshotHash = snapshot.snapshotHash;
    const contextWithSnapshot = await owner.projectContext({ projectId: created.projectId });
    expect(contextWithSnapshot.snapshotHistory[0]).toMatchObject({ id: snapshot.id, snapshotHash: snapshot.snapshotHash, calculationStatus: "valid" });
    expect(contextWithSnapshot.snapshotHistory[0]?.kpis).toHaveProperty("npv");
    expect(contextWithSnapshot.latestImpact.changedInputKeys).toContain("averageTicket");
    const simulation = await owner.simulateCaptadores({ versionId: created.versionId, horizonMonths: 24, captadorDelta: "-2", qualifiedCouplesPerCaptadorMonth: "12", loadedCostPerCaptadorMonth: "3500", payrollMonthlyDelta: "750", variableCostMonthlyDelta: "300", capexInitialDelta: "2500" });
    expect(simulation.mode).toBe("non_persistent");
    expect(simulation.after.qualifiedCouplesMonth1).toBe("76.00000000");
    expect(simulation.after.capexInitial).toBe("7500.00000000");
    expect(simulation.marginal).toMatchObject({ investment: "2500.00000000" });
    expect(simulation.marginal.npv).toMatch(/^-?\d+\.\d{8}$/);
    expect(simulation.marginal.method).toContain("caixa incremental");
    expect((await owner.exportEligibility({ snapshotId: snapshot.id })).eligible).toBe(false);
    await owner.approveSnapshot({ snapshotId: snapshot.id, rationale: "Ciclo tRPC integrado aprovado para teste." });
    await owner.freezeBaseline({ snapshotId: snapshot.id });
    expect((await owner.exportEligibility({ snapshotId: snapshot.id })).eligible).toBe(true);
    await expect(owner.updateInputs({ versionId: created.versionId, inputs: updatedInputs })).rejects.toThrow("Apenas versão de trabalho");
  });
});
