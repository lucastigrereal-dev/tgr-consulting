import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  FINANCIAL_INPUT_KEYS,
  type FinancialInputSnapshot,
} from "../../shared/financial/types";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { igrRouter } from "./igr";

const tenantId = 91_200;
const outsiderId = 91_201;
const ids = {
  projectId: "",
  baseVersionId: "",
  branchId: "",
  branchVersionId: "",
};

const inputs = Object.fromEntries(
  FINANCIAL_INPUT_KEYS.map(key => [
    key,
    {
      status: "pending" as const,
      sourceType: "assumption" as const,
    },
  ])
) as FinancialInputSnapshot;

function contextFor(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `goal-seek-${userId}`,
      name: "Goal Seek Test",
      email: null,
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterAll(async () => {
  const db = await getDb();
  if (!db || !ids.projectId) return;
  await db.execute(
    sql`DELETE FROM audit_events WHERE entityId IN (${ids.projectId}, ${ids.baseVersionId}, ${ids.branchId}, ${ids.branchVersionId}) OR tenantId = ${tenantId}`
  );
  await db.execute(
    sql`DELETE FROM decision_records WHERE versionId = ${ids.branchVersionId}`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.projectId}`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId IN (${ids.baseVersionId}, ${ids.branchVersionId})`
  );
  await db.execute(
    sql`DELETE FROM scenario_branches WHERE id = ${ids.branchId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.branchVersionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.baseVersionId}`
  );
  await db.execute(sql`DELETE FROM projects WHERE id = ${ids.projectId}`);
});

describe("Goal Seek aplicado em branch", () => {
  it("persiste input derivado, decisão e auditoria uma única vez sem mutar a versão-base", async () => {
    const owner = igrRouter.createCaller(contextFor(tenantId));
    const outsider = igrRouter.createCaller(contextFor(outsiderId));
    const created = await owner.createProject({
      name: "[TEST] Aplicação Goal Seek",
      inputs,
    });
    ids.projectId = created.projectId;
    ids.baseVersionId = created.versionId;
    const scenario = await owner.createScenario({
      baseVersionId: created.versionId,
      name: "Branch Goal Seek",
      reason: "Aplicar resultado convergido sem tocar na versão-base.",
    });
    ids.branchId = scenario.branchId;
    ids.branchVersionId = scenario.versionId;

    const command = {
      targetVersionId: scenario.versionId,
      sourceVersionId: created.versionId,
      variableKey: "qualifiedCouplesMonth1" as const,
      value: "42.00000000",
      targetKpi: "npv" as const,
      target: "0.00000000",
      objectiveValue: "0.00000000",
      residual: "0.00000000",
      iterations: 7,
    };
    const applied = await owner.applyGoalSeek(command);
    expect(applied).toMatchObject({
      applied: true,
      idempotent: false,
      versionId: scenario.versionId,
    });
    const branchInputs = await owner.versionInputs({
      versionId: scenario.versionId,
    });
    expect(branchInputs.qualifiedCouplesMonth1).toMatchObject({
      status: "provided",
      value: "42.00000000",
      sourceType: "derived_analysis",
    });
    expect(branchInputs.qualifiedCouplesMonth1.sourceRef).toMatch(
      /^goal_seek:/
    );
    expect(
      (await owner.versionInputs({ versionId: created.versionId }))
        .qualifiedCouplesMonth1.status
    ).toBe("pending");
    const decisions = await owner.decisions({ versionId: scenario.versionId });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      inputKey: "qualifiedCouplesMonth1",
      decisionValue: "42.00000000",
      status: "accepted",
    });

    const repeated = await owner.applyGoalSeek(command);
    expect(repeated).toMatchObject({
      applied: false,
      idempotent: true,
      decisionId: applied.decisionId,
    });
    expect(
      await owner.decisions({ versionId: scenario.versionId })
    ).toHaveLength(1);
    await expect(
      owner.applyGoalSeek({ ...command, targetVersionId: created.versionId })
    ).rejects.toThrow("branch de cenário");
    await expect(outsider.applyGoalSeek(command)).rejects.toThrow(
      "não autorizado"
    );
  });
});
