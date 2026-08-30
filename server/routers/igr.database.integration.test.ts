import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { FinancialInputSnapshot } from "../../shared/financial/types";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { igrRouter } from "./igr";

const ownerId = 1;
const outsiderId = 991_001;
const ids = { projectId: "", versionId: "", snapshotId: "", snapshotHash: "", decisionId: "", costId: "", commercialConditionId: "" };
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
  await db.execute(sql`DELETE FROM audit_events WHERE entityId IN (${ids.projectId}, ${ids.versionId}, ${ids.snapshotId}, ${ids.decisionId}, ${ids.costId}, ${ids.commercialConditionId})`);
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
            principal: "90000",
            installments: 48,
            graceMonths: 1,
            firstDueMonth: 2,
          },
          explicitCharges: "0",
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
    expect((await owner.commercialConditions({ versionId: created.versionId }))[0]?.reconciliation.status).toBe("valid");

    const snapshot = await owner.calculate({ versionId: created.versionId, horizonMonths: 24 });
    ids.snapshotId = snapshot.id; ids.snapshotHash = snapshot.snapshotHash;
    expect(snapshot.kpis.grossSales).toBe("8360000.00000000");
    expect(snapshot.kpis.grossEntryGenerated).toBe("1520000.00000000");
    expect(snapshot.projections.reduce((total, row) => total + Number(row.contracts), 0)).toBe(76);
    expect(snapshot.authoritativeDomains?.commercialModel?.derived).toMatchObject({ averageTicket: "110000.00000000", entryValuePerContract: "20000.00000000", maxContracts: "76.00000000" });
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
  });
});
