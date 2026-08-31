import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { projectVersions } from "../../drizzle/schema";
import {
  FINANCIAL_INPUT_KEYS,
  type FinancialInputSnapshot,
} from "../../shared/financial/types";
import type { CommercialOperationsDefinition } from "../../shared/financial/commercialOperations";
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
  divergedBranchId: "",
  divergedBranchVersionId: "",
  raceBranchId: "",
  raceBranchVersionId: "",
};
const provided = (value: string) => ({
  status: "provided" as const,
  value,
  sourceType: "assumption" as const,
  sourceRef: "igr.goalseek.database.integration.test",
});

const inputs = Object.fromEntries(
  FINANCIAL_INPUT_KEYS.map(key => [
    key,
    {
      status: "pending" as const,
      sourceType: "assumption" as const,
    },
  ])
) as FinancialInputSnapshot;

const completeInputs: FinancialInputSnapshot = {
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

const commercialOperationsDefinition = {
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
        cohortId: "tours-team",
        role: "consultant",
        capacityUnit: "tours",
        headcount: "2",
        hireMonth: 0,
        trainingMonths: 0,
        certificationRate: "1",
        rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }],
        matureProductivity: "100",
        absenteeismRate: "0",
        monthlyTurnoverRate: "0",
        fixedCompensation: "1000",
        burden: "0",
        guarantee: "0",
        allowance: "0",
        replacementCost: "0",
      },
      {
        cohortId: "sales-team",
        role: "closer",
        capacityUnit: "sales",
        headcount: "2",
        hireMonth: 0,
        trainingMonths: 0,
        certificationRate: "1",
        rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }],
        matureProductivity: "20",
        absenteeismRate: "0",
        monthlyTurnoverRate: "0",
        fixedCompensation: "1500",
        burden: "0",
        guarantee: "0",
        allowance: "0",
        replacementCost: "0",
      },
    ],
  },
  training: {
    cashflowTreatment: "included_in_project_totals",
    plans: [
      {
        trainingId: "academy",
        role: "closer",
        startMonth: 0,
        candidates: "2",
        classes: "1",
        durationMonths: 1,
        trainers: "1",
        trainerMonthlyCost: "100",
        candidateMonthlySalary: "50",
        monthlySupportCost: "0",
        approvalRate: "1",
        certificationRate: "1",
        timeToProductiveMonths: 0,
        targetProductivePeople: "2",
      },
    ],
  },
  commissions: { cashflowTreatment: "included_in_project_totals", policies: [] },
} satisfies CommercialOperationsDefinition;

const receivablesPolicy = {
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

async function makeAuthoritativeProject(owner: ReturnType<typeof igrRouter.createCaller>) {
  const created = await owner.createProject({
    name: "[TEST] Aplicação Goal Seek",
    inputs: completeInputs,
  });
  ids.projectId = created.projectId;
  ids.baseVersionId = created.versionId;
  await owner.saveCommercialModel({
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
    conditions: [
      {
        productSkuCode: "pipa-2q",
        status: "provided",
        sourceType: "current_document",
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
      },
    ],
  });
  await owner.upsertReceivablesPolicy({
    versionId: created.versionId,
    status: "provided",
    sourceType: "current_decision",
    sourceRef: "Ata de política de carteira",
    policy: receivablesPolicy,
  });
  await owner.replaceCapturePoints({
    versionId: created.versionId,
    points: [
      {
        status: "provided",
        sourceType: "current_document",
        sourceRef: "Cadastro de pontos",
        definition: capturePoint,
      },
    ],
  });
  await owner.upsertCommercialOperations({
    versionId: created.versionId,
    status: "provided",
    sourceType: "current_document",
    sourceRef: "Plano de operações",
    definition: commercialOperationsDefinition,
  });
  return created;
}

async function getFinancialRevision(versionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de integração indisponível.");
  const rows = await db
    .select({ financialRevision: projectVersions.financialRevision })
    .from(projectVersions)
    .where(eq(projectVersions.id, versionId))
    .limit(1);
  return rows[0]?.financialRevision;
}

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
    sql`DELETE FROM decision_records WHERE versionId IN (${ids.branchVersionId}, ${ids.divergedBranchVersionId}, ${ids.raceBranchVersionId})`
  );
  await db.execute(
    sql`DELETE FROM workflow_events WHERE projectId = ${ids.projectId}`
  );
  await db.execute(
    sql`DELETE FROM input_values WHERE versionId IN (${ids.baseVersionId}, ${ids.branchVersionId}, ${ids.divergedBranchVersionId}, ${ids.raceBranchVersionId})`
  );
  await db.execute(
    sql`DELETE FROM scenario_branches WHERE id = ${ids.branchId}`
  );
  await db.execute(
    sql`DELETE FROM scenario_branches WHERE id = ${ids.divergedBranchId}`
  );
  await db.execute(
    sql`DELETE FROM scenario_branches WHERE id = ${ids.raceBranchId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.branchVersionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.divergedBranchVersionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.raceBranchVersionId}`
  );
  await db.execute(
    sql`DELETE FROM project_versions WHERE id = ${ids.baseVersionId}`
  );
  await db.execute(sql`DELETE FROM projects WHERE id = ${ids.projectId}`);
});

describe("Goal Seek aplicado em branch", () => {
  it.skipIf(!process.env.DATABASE_URL)(
    "recalcula server-side, rejeita payload forjado e só aplica solução convergida coerente",
    async () => {
    const owner = igrRouter.createCaller(contextFor(tenantId));
    const outsider = igrRouter.createCaller(contextFor(outsiderId));
    const created = await makeAuthoritativeProject(owner);
    expect(await getFinancialRevision(created.versionId)).toBe(4);
    const scenario = await owner.createScenario({
      baseVersionId: created.versionId,
      name: "Branch Goal Seek",
      reason: "Aplicar somente resultado convergido recalculado no servidor.",
    });
    ids.branchId = scenario.branchId;
    ids.branchVersionId = scenario.versionId;
    expect(await getFinancialRevision(scenario.versionId)).toBe(0);

    const solved = await owner.goalSeek({
      versionId: created.versionId,
      horizonMonths: 24,
      asOfMonth: 0,
      targetKpi: "grossSales",
      variableKey: "averageTicket",
      target: "500000",
      lowerBound: "0",
      upperBound: "1000000",
    });
    expect(solved).toMatchObject({
      status: "converged",
      targetKpi: "grossSales",
      variableKey: "averageTicket",
    });
    expect(solved.result).toMatch(/^\d+\.\d{8}$/);
    expect(Math.abs(Number(solved.objectiveValue) - 500000)).toBeLessThanOrEqual(
      0.0001
    );
    expect(Math.abs(Number(solved.residual))).toBeLessThanOrEqual(0.0001);

    const command = {
      targetVersionId: scenario.versionId,
      sourceVersionId: created.versionId,
      horizonMonths: 24,
      asOfMonth: 0,
      variableKey: "averageTicket" as const,
      value: solved.result!,
      targetKpi: "grossSales" as const,
      target: solved.target,
      lowerBound: "0",
      upperBound: "1000000",
      objectiveValue: solved.objectiveValue!,
      residual: solved.residual!,
      iterations: solved.iterations,
    };

    const raceScenario = await owner.createScenario({
      baseVersionId: created.versionId,
      name: "Branch Goal Seek com revisão concorrente",
      reason: "Provar rollback atômico quando a identidade financeira muda no commit.",
    });
    ids.raceBranchId = raceScenario.branchId;
    ids.raceBranchVersionId = raceScenario.versionId;
    const db = await getDb();
    if (!db) throw new Error("Banco de integração indisponível.");
    await db.execute(sql.raw("DROP TRIGGER IF EXISTS goal_seek_revision_race"));
    await db.execute(sql.raw(`
      CREATE TRIGGER goal_seek_revision_race
      BEFORE INSERT ON decision_records
      FOR EACH ROW
      UPDATE project_versions
      SET financialRevision = financialRevision + 1
      WHERE id = NEW.versionId
    `));
    try {
      await expect(
        owner.applyGoalSeek({
          ...command,
          targetVersionId: raceScenario.versionId,
        })
      ).rejects.toThrow("mudou durante a gravação do Goal Seek");
    } finally {
      await db.execute(sql.raw("DROP TRIGGER IF EXISTS goal_seek_revision_race"));
    }
    expect(await getFinancialRevision(raceScenario.versionId)).toBe(0);
    expect(
      await owner.decisions({ versionId: raceScenario.versionId })
    ).toHaveLength(0);

    await expect(
      owner.applyGoalSeek({ ...command, value: "1.00000000" })
    ).rejects.toThrow("diverge do resultado recalculado");
    expect(
      (await owner.versionInputs({ versionId: scenario.versionId })).averageTicket
        .value
    ).not.toBe("1.00000000");

    const applied = await owner.applyGoalSeek(command);
    expect(applied).toMatchObject({
      applied: true,
      idempotent: false,
      versionId: scenario.versionId,
    });
    expect(await getFinancialRevision(scenario.versionId)).toBe(1);
    const branchInputs = await owner.versionInputs({
      versionId: scenario.versionId,
    });
    expect(branchInputs.averageTicket).toMatchObject({
      status: "provided",
      value: solved.result,
      sourceType: "derived_analysis",
    });
    expect(branchInputs.averageTicket.sourceRef).toMatch(
      /^goal_seek:/
    );
    expect(
      (await owner.versionInputs({ versionId: created.versionId }))
        .averageTicket.value
    ).toBe("1000");
    const decisions = await owner.decisions({ versionId: scenario.versionId });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      inputKey: "averageTicket",
      decisionValue: solved.result,
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

    const divergedBranch = await owner.createScenario({
      baseVersionId: created.versionId,
      name: "Branch Goal Seek divergente",
      reason: "Provar que resultado da fonte não atravessa uma branch alterada.",
    });
    ids.divergedBranchId = divergedBranch.branchId;
    ids.divergedBranchVersionId = divergedBranch.versionId;
    const divergedInputs = await owner.versionInputs({
      versionId: divergedBranch.versionId,
    });
    await owner.updateInputs({
      versionId: divergedBranch.versionId,
      inputs: {
        ...divergedInputs,
        fixedCostMonthly: provided("9000"),
      },
    });
    expect(await getFinancialRevision(divergedBranch.versionId)).toBe(1);
    await expect(
      owner.applyGoalSeek({
        ...command,
        targetVersionId: divergedBranch.versionId,
      })
    ).rejects.toThrow("branch-alvo divergiu");
    expect(
      await owner.decisions({ versionId: divergedBranch.versionId })
    ).toHaveLength(0);

    await expect(
      owner.applyGoalSeek({ ...command, targetVersionId: created.versionId })
    ).rejects.toThrow("branch de cenário");
    await expect(outsider.applyGoalSeek(command)).rejects.toThrow(
      "não autorizado"
    );
    },
    15_000
  );

  it("valida versão e tenant antes de retornar unsupported para target sem fórmula autoritativa", async () => {
    const owner = igrRouter.createCaller(contextFor(tenantId));
    const outsider = igrRouter.createCaller(contextFor(outsiderId));

    await expect(
      owner.goalSeek({
        versionId: "versao-inexistente",
        horizonMonths: 120,
        asOfMonth: 0,
        targetKpi: "pointBreakEven",
        variableKey: "averageTicket",
        target: "1",
        lowerBound: "0",
        upperBound: "100",
      })
    ).rejects.toThrow(/Versão de projeto não encontrada|Banco de dados indisponível/);

    if (ids.baseVersionId) {
      await expect(
        outsider.goalSeek({
          versionId: ids.baseVersionId,
          horizonMonths: 120,
          asOfMonth: 0,
          targetKpi: "pointBreakEven",
          variableKey: "averageTicket",
          target: "1",
          lowerBound: "0",
          upperBound: "100",
        })
      ).rejects.toThrow("não autorizado");
    }
  });

  it("aceita target e lever V1 suportados antes de validar a versão", async () => {
    const owner = igrRouter.createCaller(contextFor(tenantId));

    await expect(
      owner.goalSeek({
        versionId: "versao-inexistente",
        horizonMonths: 120,
        asOfMonth: 0,
        targetKpi: "grossSales",
        variableKey: "averageTicket",
        target: "100000",
        lowerBound: "0",
        upperBound: "1000000",
      })
    ).rejects.toThrow(/Versão de projeto não encontrada|Banco de dados indisponível/);
  });
});
