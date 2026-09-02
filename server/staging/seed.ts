import {
  approveSnapshotForTenant,
  createCalculationSnapshot,
  createCostCatalogItemForTenant,
  createProjectFromCotiaAssemblyForTenant,
  freezeBaselineForTenant,
  getProjectContextForTenant,
  getScenarioComparisonForTenant,
  getUserByOpenId,
  listProjectsForTenant,
  promoteMeetingSimulationToScenarioForTenant,
  replaceCapturePointsForTenant,
  saveCommercialModelForTenant,
  updateInputsForTenant,
  upsertCommercialOperationsForTenant,
  upsertReceivablesPolicyForTenant,
  upsertUser,
} from "../db";
import { createHarmonyNatalInputs, HARMONY_NATAL_HORIZON_MONTHS } from "../../shared/financial/harmonyNatal";
import { GOLDEN_NATAL_PONTA_NEGRA_2026 } from "../../shared/financial/natalGolden";
import type { FinancialCalculation } from "../../shared/financial/types";
import harmonyReference from "../../golden/natal-harmony-master-v1.reference.json";

export const STAGING_NATAL_PROJECT_NAME = "Projeto Único Ponta Negra";
const SOURCE_REF = harmonyReference.authority.availableSource;
const PRICE_SCENARIOS = [
  { id: "C2_35K", name: "Harmony R$35 mil", price: "35000", delta: "7000" },
  { id: "C3_40K", name: "Harmony R$40 mil", price: "40000", delta: "12000" },
] as const;

export function assertStagingSeedAllowed(
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (
    environment.NODE_ENV !== "production" ||
    environment.APP_ENV !== "staging"
  ) throw new Error("O seed Natal é exclusivo de staging em runtime de produção.");
  if (environment.STAGING_SEED_NATAL !== "true")
    throw new Error("O seed Natal exige STAGING_SEED_NATAL=true.");
}

type SeedKpis = Pick<
  FinancialCalculation["kpis"],
  "capitalRequired" | "npv" | "irrAnnual" | "paybackMonths" | "grossReceivablesGenerated"
>;

export function assertHarmonySeedKpis(
  scenarioId: keyof typeof harmonyReference.scenarios,
  kpis: SeedKpis,
) {
  const reconstructed = harmonyReference.scenarios[scenarioId].reconstructed;
  const expected = {
    capitalRequired: reconstructed.capitalRequired,
    npv: reconstructed.npv,
    irrAnnual: reconstructed.irrAnnual,
    paybackMonths: reconstructed.paybackMonths,
    grossReceivablesGenerated: reconstructed.vgv,
  };
  for (const [key, value] of Object.entries(expected) as Array<[
    keyof SeedKpis,
    string,
  ]>) {
    if (kpis[key] !== value)
      throw new Error(
        `${scenarioId}.${key} divergiu do Golden Harmony: esperado ${value}, obtido ${kpis[key] ?? "null"}.`,
      );
  }
}

export function findCanonicalBaselineEntry<T extends { label: string }>(
  entries: T[],
) {
  return entries.find(entry => entry.label === "Baseline");
}

function cotiaPayload(): Record<string, string> {
  return {
    nomeProjeto: STAGING_NATAL_PROJECT_NAME,
    nomeProduto: "Cota Ponta Negra",
    praca: "Natal/RN",
    dataBase: "09/2026",
    inicioOperacao: "01/2027",
    horizonteMeses: "144",
    valorCota: "28000",
    valorEntrada: "3200",
    parcelasEntrada: "8",
    primeiroVencimentoEntradaMes: "0",
    parcelasSaldo: "84",
    carenciaSaldoMeses: "4",
    primeiroVencimentoSaldoMes: "4",
    cotasPorApartamento: "52",
    totalApartamentos: "60",
    cotasBloqueadas: "0",
    cotasVendidasAcumuladas: "0",
    cotasRetornadas: "0",
    cotasVendidasMes: "100",
    eficiencia: "20",
    taxaCancelamento: "30",
    percentualAdimplente: "75",
    descontoComercial: "0",
    encargosExplicitos: "0",
    toleranciaMaterialidade: "0.01",
  };
}

async function configureNatalDraft(params: {
  tenantId: number;
  actorId: number;
  versionId: string;
}) {
  const { tenantId, actorId, versionId } = params;
  await updateInputsForTenant({
    tenantId,
    actorId,
    versionId,
    inputs: createHarmonyNatalInputs("100", "28000"),
  });
  await saveCommercialModelForTenant({
    tenantId,
    actorId,
    versionId,
    asOfMonth: 0,
    skus: [{
      id: "produto-principal",
      name: STAGING_NATAL_PROJECT_NAME,
      unitType: "UH",
      unitQuantity: GOLDEN_NATAL_PONTA_NEGRA_2026.metadata.units,
      sharesPerUnit: GOLDEN_NATAL_PONTA_NEGRA_2026.metadata.sharesPerUnit,
      grossSoldShares: 0,
      returnedShares: 0,
      blockedShares: 0,
      status: "provided",
      sourceType: "current_decision",
      sourceRef: SOURCE_REF,
      pricePhases: [{ id: "natal-launch", startsAtMonth: 0, price: "28000" }],
    }],
    conditions: [{
      productSkuCode: "produto-principal",
      status: "provided",
      sourceType: "current_decision",
      sourceRef: SOURCE_REF,
      condition: {
        id: "natal-standard",
        name: "Condição Natal 2026",
        listPrice: "28000",
        discount: "0",
        entry: { total: "3200", installments: 8, firstDueMonth: 0 },
        balance: {
          principal: "24800",
          installments: 84,
          graceMonths: 4,
          firstDueMonth: 4,
        },
        explicitCharges: "0",
        explicitChargesDueMonth: 0,
        materialityTolerance: "0.01",
      },
    }],
  });
  await replaceCapturePointsForTenant({
    tenantId,
    actorId,
    versionId,
    points: [{
      status: "provided",
      sourceType: "current_decision",
      sourceRef: SOURCE_REF,
      definition: {
        pointId: "natal-primary",
        name: "Ponta Negra",
        channel: "Natal/RN",
        activationCost: "0",
        monthlyFixedCost: "0",
        costPerSale: "0",
        approaches: "1000",
        researchRate: "1",
        qualificationRate: "0.5",
        invitationRate: "1",
        appointmentRate: "1",
        showRate: "1",
        tourRate: "1",
        saleRate: "0.2",
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
    sourceType: "current_decision",
    sourceRef: SOURCE_REF,
    definition: {
      room: {
        rooms: [{ roomId: "natal-room", tables: "20", overflowTables: "4" }],
        operatingDaysPerMonth: "25",
        operatingHoursPerDay: "8",
        shifts: "2",
        averageTourDurationMinutes: "60",
        toursPerTable: "1",
        receptionists: "4",
        receptionCapacityPerPerson: "250",
        consultants: "15",
        consultantCapacityPerPerson: "50",
        closers: "6",
        closerSalesCapacityPerPerson: "25",
        peakFlowFactor: "1",
        maxWaitMinutes: "15",
      },
      workforce: {
        cashflowTreatment: "included_in_project_totals",
        cohorts: [
          {
            cohortId: "natal-consultants", role: "consultant", capacityUnit: "tours",
            headcount: "15", hireMonth: 0, trainingMonths: 0, certificationRate: "1",
            rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }],
            matureProductivity: "50", absenteeismRate: "0", monthlyTurnoverRate: "0",
            fixedCompensation: "0", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0",
          },
          {
            cohortId: "natal-closers", role: "closer", capacityUnit: "sales",
            headcount: "6", hireMonth: 0, trainingMonths: 0, certificationRate: "1",
            rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }],
            matureProductivity: "25", absenteeismRate: "0", monthlyTurnoverRate: "0",
            fixedCompensation: "0", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0",
          },
        ],
      },
      training: { cashflowTreatment: "included_in_project_totals", plans: [] },
      commissions: { cashflowTreatment: "included_in_project_totals", policies: [] },
    },
  });
  await createCostCatalogItemForTenant({
    tenantId,
    actorId,
    versionId,
    category: "operations",
    name: "Custos agregados Golden Natal Harmony canônico",
    frequency: "monthly",
    cashflowTreatment: "included_in_project_totals",
    amountText: "280000",
    status: "provided",
    sourceType: "current_document",
    sourceRef: SOURCE_REF,
  });
  await upsertReceivablesPolicyForTenant({
    tenantId,
    actorId,
    versionId,
    status: "provided",
    sourceType: "current_document",
    sourceRef: SOURCE_REF,
    policy: {
      cancellationCurve: {
        d7: "0.02", d30: "0.05", d60: "0.08", d90: "0.12", d180: "0.20", lifetime: "0.30",
      },
      delinquencyRate: "0.25",
      cureRates: { days1To30: "0.20", days31To60: "0.15", days61To90: "0.10", days90Plus: "0.05" },
      writeOffAfterDays: 180,
      policyVersion: "harmony-golden-v1",
      sourceRef: SOURCE_REF,
    },
  });
}

export async function seedStagingNatal(
  environment: NodeJS.ProcessEnv = process.env,
) {
  assertStagingSeedAllowed(environment);
  const username = environment.STAGING_AUTH_USERNAME?.trim();
  if (!username) throw new Error("STAGING_AUTH_USERNAME é obrigatório para o seed.");
  const openId = `staging:${username}`;
  await upsertUser({
    openId,
    name: environment.STAGING_AUTH_DISPLAY_NAME?.trim() || "TGR Staging Admin",
    loginMethod: "staging_password",
    role: "admin",
    lastSignedIn: new Date(),
  });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Usuário administrador de staging não foi persistido.");
  const tenantId = user.id;
  const actorId = user.id;
  const existing = (await listProjectsForTenant(tenantId)).find(
    project => project.name === STAGING_NATAL_PROJECT_NAME,
  );
  let projectId = existing?.id;
  let baselineSnapshotId: string | null = null;
  let baselineKpis: SeedKpis | null = null;

  if (!projectId) {
    const created = await createProjectFromCotiaAssemblyForTenant({
      tenantId,
      actorId,
      name: STAGING_NATAL_PROJECT_NAME,
      assemblyName: "Golden Natal Ponta Negra 2026 — Harmony Compat V1",
      payload: cotiaPayload(),
      sourceRef: SOURCE_REF,
      financialModelMode: "HARMONY_COMPAT_V1",
    });
    projectId = created.projectId;
    await configureNatalDraft({ tenantId, actorId, versionId: created.versionId });
    const calculation = await createCalculationSnapshot({
      tenantId,
      actorId,
      versionId: created.versionId,
      horizonMonths: HARMONY_NATAL_HORIZON_MONTHS,
      asOfMonth: 0,
    });
    assertHarmonySeedKpis("C1_28K", calculation.kpis);
    await approveSnapshotForTenant({
      tenantId,
      actorId,
      snapshotId: calculation.id,
      rationale: "Seed canônico de staging validado contra Harmony Master V1.",
    });
    await freezeBaselineForTenant({
      tenantId,
      actorId,
      snapshotId: calculation.id,
    });
    baselineSnapshotId = calculation.id;
    baselineKpis = calculation.kpis;
  }

  const context = await getProjectContextForTenant(projectId, tenantId);
  let comparison = await getScenarioComparisonForTenant(projectId, tenantId);
  const canonicalBaselineEntry = findCanonicalBaselineEntry(comparison);
  const baselineVersion = context.versions.find(
    version =>
      version.id === canonicalBaselineEntry?.versionId &&
      version.kind === "baseline" &&
      version.state === "baseline" &&
      version.isImmutable,
  );
  if (!baselineVersion)
    throw new Error("Seed Natal existente está incompleto: baseline imutável não encontrado.");
  const baselineEntry = canonicalBaselineEntry;
  baselineSnapshotId ??= baselineEntry?.snapshotId ?? null;
  baselineKpis ??= baselineEntry?.kpis as SeedKpis | null;
  if (!baselineSnapshotId || !baselineKpis)
    throw new Error("Seed Natal existente está incompleto: snapshot baseline não encontrado.");
  assertHarmonySeedKpis("C1_28K", baselineKpis);

  for (const scenario of PRICE_SCENARIOS) {
    let entry = comparison.find(candidate => candidate.label === scenario.name);
    if (!entry) {
      const promoted = await promoteMeetingSimulationToScenarioForTenant({
        tenantId,
        actorId,
        versionId: baselineVersion.id,
        baseSnapshotId: baselineSnapshotId,
        horizonMonths: HARMONY_NATAL_HORIZON_MONTHS,
        asOfMonth: 0,
        captadorDelta: "0",
        qualifiedCouplesPerCaptadorMonth: "25",
        loadedCostPerCaptadorMonth: "0",
        targetGrossSalesMonth1: "100",
        averageTicketDelta: scenario.delta,
        name: scenario.name,
        reason: `Cenário canônico do Golden Harmony com preço de R$ ${scenario.price}.`,
        sourceRef: SOURCE_REF,
      });
      const calculation = await createCalculationSnapshot({
        tenantId,
        actorId,
        versionId: promoted.versionId,
        horizonMonths: HARMONY_NATAL_HORIZON_MONTHS,
        asOfMonth: 0,
      });
      assertHarmonySeedKpis(scenario.id, calculation.kpis);
      comparison = await getScenarioComparisonForTenant(projectId, tenantId);
      entry = comparison.find(candidate => candidate.versionId === promoted.versionId);
    }
    if (!entry?.snapshotId || !entry.kpis)
      throw new Error(`Seed Natal existente está incompleto: cenário ${scenario.name} sem snapshot.`);
    assertHarmonySeedKpis(scenario.id, entry.kpis as SeedKpis);
  }

  return {
    reused: Boolean(existing),
    projectId,
    baselineVersionId: baselineVersion.id,
    baselineSnapshotId,
    scenarioCount: PRICE_SCENARIOS.length,
    harmony: "HARMONY_COMPAT_V1" as const,
    sourceConflict: "SC-001" as const,
  };
}
