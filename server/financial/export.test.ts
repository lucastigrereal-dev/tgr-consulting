import {
  PDFArray,
  PDFDocument,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { calculatePointEconomics } from "../../shared/financial/pointEconomics";
import { calculateCommercialOperations } from "../../shared/financial/commercialOperations";
import {
  HARMONY_COMPAT_FORMULA_SET_V1,
  IGR_CORE_FORMULA_SET_V1,
} from "../../shared/financial/formulas";
import type { FinancialCalculation, FinancialInputSnapshot } from "../../shared/financial/types";
import { calculateAuthoritativeSnapshot } from "./snapshot";
import {
  buildBoardroomPdf,
  buildBoardroomPptx,
  buildBoardroomXlsx,
  createExportPackHash,
  createExportableSnapshot,
  createScenarioComparisonPayload,
} from "./export";

const pointEconomics = calculatePointEconomics({
  points: [
    {
      pointId: "cotia-mall",
      name: "Quiosque Cotia Mall",
      channel: "Shopping",
      activationCost: "12000",
      monthlyFixedCost: "4000",
      costPerSale: "250",
      approaches: "1000",
      researchRate: "0.5",
      qualificationRate: "0.4",
      invitationRate: "0.8",
      appointmentRate: "0.75",
      showRate: "0.8",
      tourRate: "0.5",
      saleRate: "0.2",
      averageTicket: "1000",
      averageEntry: "100",
      contributionMarginRate: "0.75",
      healthyD90Rate: "0.8",
      cannibalizationRate: "0.1",
      cashflowTreatment: "incremental",
    },
  ],
});

const provided = (value: string) => ({ status: "provided" as const, value, sourceType: "assumption" as const, sourceRef: "export-test" });
const pending = () => ({ status: "pending" as const, sourceType: "assumption" as const, sourceRef: "export-test" });
const inputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("100"), qualifiedCouplesGrowthRate: provided("0"), conversionRate: provided("0.1"), averageTicket: provided("1000"), collectionRate: provided("1"), cancellationRate: provided("0"), variableCostRate: provided("0"), partnerShareRate: provided("0"), fixedCostMonthly: provided("0"), payrollMonthly: provided("0"), capexInitial: provided("0"), preOperationMonths: provided("0"), entryValuePerContract: provided("100"), paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"), paymentCardInstallmentMixRate: provided("0"), paymentCardInstallmentMdrRate: provided("0"), paymentCardInstallmentSettlementDays: provided("0"), paymentDebitMixRate: provided("0"), paymentDebitMdrRate: provided("0"), paymentDebitSettlementDays: provided("0"), paymentRecurringChequeMixRate: provided("0"), paymentRecurringChequeMdrRate: provided("0"), paymentRecurringChequeSettlementDays: provided("0"), paymentBoletoMixRate: provided("0"), paymentBoletoMdrRate: provided("0"), paymentBoletoSettlementDays: provided("0"), discountRateAnnual: provided("0"), capexAcquisitionShareRate: pending(), capexAcquisitionMonth: pending(), capexSalesRoomShareRate: pending(), capexSalesRoomMonth: pending(), capexSalesKitShareRate: pending(), capexSalesKitMonth: pending(),
};
const commercialOperations = calculateCommercialOperations({
  horizonMonths: 2,
  pointDemand: { toursMonthly: "100", salesMonthly: "10" },
  definition: {
    room: { rooms: [{ roomId: "sala-cotia", tables: "2", overflowTables: "0" }], operatingDaysPerMonth: "20", operatingHoursPerDay: "8", shifts: "2", averageTourDurationMinutes: "60", toursPerTable: "1", receptionists: "1", receptionCapacityPerPerson: "200", consultants: "1", consultantCapacityPerPerson: "50", closers: "1", closerSalesCapacityPerPerson: "20", peakFlowFactor: "1", maxWaitMinutes: "15" },
    workforce: { cashflowTreatment: "incremental", cohorts: [
      { cohortId: "consultants", role: "consultant", capacityUnit: "tours", headcount: "1", hireMonth: 0, trainingMonths: 0, certificationRate: "1", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }], matureProductivity: "80", absenteeismRate: "0", monthlyTurnoverRate: "0", fixedCompensation: "100", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0" },
      { cohortId: "closers", role: "closer", capacityUnit: "sales", headcount: "1", hireMonth: 0, trainingMonths: 0, certificationRate: "1", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "1" }], matureProductivity: "8", absenteeismRate: "0", monthlyTurnoverRate: "0", fixedCompensation: "200", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0" },
    ] },
    training: { cashflowTreatment: "incremental", plans: [{ trainingId: "academy", role: "closer", startMonth: 0, candidates: "2", classes: "1", durationMonths: 1, trainers: "1", trainerMonthlyCost: "50", candidateMonthlySalary: "25", monthlySupportCost: "0", approvalRate: "1", certificationRate: "1", timeToProductiveMonths: 0, targetProductivePeople: "2" }] },
    commissions: { cashflowTreatment: "incremental", policies: [{ policyId: "closer-fixed", role: "closer", eligibleBase: "fixed", mode: "fixed", fixedAmount: "10", percentageRate: "0", tiers: [], guarantee: "0", cutoffDay: 15, paymentLagMonths: 0, qualityMultiplier: "1", holdbackRate: "0", reversalEnabled: false }] },
  },
});
const authoritativeDomains = {
  asOfMonth: 0,
  productCatalog: {
    records: [{
      skuCode: "studio",
      status: "provided",
      sourceType: "current_document",
      sourceRef: "Tabela aprovada",
    }],
  },
  commercialConditions: [{
    productSkuCode: "studio",
    status: "provided",
    sourceType: "current_document",
    sourceRef: "Tabela comercial",
  }],
  receivablesPolicy: {
    status: "provided",
    sourceType: "current_decision",
    sourceRef: "Ata de carteira",
  },
  capturePoints: {
    definitions: [{
      status: "provided",
      sourceType: "current_document",
      sourceRef: "Cadastro de pontos",
      definition: { pointId: "cotia-mall", name: "Quiosque Cotia Mall" },
    }],
  },
  commercialOperations: {
    status: "provided",
    sourceType: "current_document",
    sourceRef: "Plano de operações",
  },
};
const snapshot = calculateAuthoritativeSnapshot({
  projectVersionId: "version-base-approved",
  inputs,
  calculationInputs: inputs,
  calculationOptions: { pointEconomics, commercialOperations },
  authoritativeDomains,
  horizonMonths: 2,
  formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id,
});
if (snapshot.status !== "valid") throw new Error("Snapshot operacional inválido.");
const scenarioInputs: FinancialInputSnapshot = {
  ...inputs,
  fixedCostMonthly: provided("100"),
};
const scenarioSnapshot = calculateAuthoritativeSnapshot({
  projectVersionId: "version-scenario-approved",
  inputs: scenarioInputs,
  calculationInputs: scenarioInputs,
  calculationOptions: { pointEconomics, commercialOperations },
  authoritativeDomains,
  horizonMonths: 2,
  formulaSetVersionId: IGR_CORE_FORMULA_SET_V1.id,
});
if (scenarioSnapshot.status !== "valid") throw new Error("Snapshot de cenário inválido.");
const scenarioComparison = createScenarioComparisonPayload({
  baseSnapshotHash: snapshot.snapshotHash,
  entries: [
    {
      versionId: "version-base-approved",
      kind: "working",
      state: "approved",
      isImmutable: true,
      label: "Base aprovada",
      reason: null,
      snapshotId: "snapshot-base-approved",
      snapshotHash: snapshot.snapshotHash,
      comparisonStatus: "comparable",
      horizonMonths: 2,
      asOfMonth: 0,
      kpis: snapshot.kpis,
    },
    {
      versionId: "version-scenario-fixed-cost",
      kind: "scenario",
      state: "draft",
      isImmutable: false,
      label: "Cenário custo fixo",
      reason: "Validar sensibilidade de custo fixo.",
      snapshotId: "snapshot-scenario-fixed-cost",
      snapshotHash: scenarioSnapshot.snapshotHash,
      comparisonStatus: "comparable",
      horizonMonths: 2,
      asOfMonth: 0,
      kpis: scenarioSnapshot.kpis,
    },
  ],
});

const workbookSheet = async (archive: JSZip, sheetNumber: number) =>
  archive.file(`xl/worksheets/sheet${sheetNumber}.xml`)?.async("string");

function pdfVisibleText(pdf: PDFDocument, pageNumber = 0) {
  const contents = pdf.getPages()[pageNumber]?.node.Contents();
  if (!(contents instanceof PDFArray)) return "";
  const operators = Array.from({ length: contents.size() }, (_, index) => {
    const stream = pdf.context.lookup(contents.get(index), PDFRawStream);
    return Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
  }).join("\n");
  return [...operators.matchAll(/<([0-9A-F]+)>\s*Tj/g)]
    .map(match => Buffer.from(match[1], "hex").toString("latin1"))
    .join("\n");
}

const exportMetadata = {
  snapshotId: "snapshot-natal-approved",
  versionId: "version-natal-baseline",
  generatedAt: "2026-08-31T12:34:56.000Z",
  generatedBy: {
    id: 42,
    name: "Lucas Tigre",
    email: "lucas@example.com",
  },
  lifecycleStatus: "baseline" as const,
  approvalStatus: "approved" as const,
};

const provenanceSnapshot = {
  ...snapshot,
  snapshotHash: snapshot.snapshotHash,
  exportPackHash: createExportPackHash({
    snapshotHash: snapshot.snapshotHash,
    exportMetadata,
  }),
  exportMetadata,
};

function withoutSnapshotData(overrides: Partial<FinancialCalculation> = {}) {
  return {
    status: "blocked_by_pending_inputs" as const,
    horizonMonths: 12,
    missingInputKeys: ["averageTicket"] as const,
    formulaSetVersion: "formula-v-test",
    engineVersion: "engine-v-test",
    projections: [],
    kpis: {
      grossSales: null,
      grossEntryGenerated: null,
      grossReceivablesGenerated: null,
      grossReceivablesSettled: null,
      installmentCollections: null,
      canceledReceivables: null,
      delinquentBalance: null,
      curedCollections: null,
      writtenOffBalance: null,
      healthyD90: null,
      recognizedRevenue: null,
      paymentFees: null,
      preOperationalInvestment: null,
      totalOperatingCashFlow: null,
      npv: null,
      irrAnnual: null,
      paybackMonths: null,
    },
    memory: [],
    snapshotHash: "b".repeat(64),
    ...overrides,
  };
}

describe("geradores de artefato Boardroom", () => {
  it("transporta modo financeiro e label no payload e na proveniência quando fornecidos", async () => {
    const harmonyPersistedPayload: FinancialCalculation = {
      ...withoutSnapshotData(),
      financialModelMode: "HARMONY_COMPAT_V1",
      formulaSetVersion: HARMONY_COMPAT_FORMULA_SET_V1.semanticVersion,
      engineVersion: HARMONY_COMPAT_FORMULA_SET_V1.engineVersion,
      compatibilityEvidence: {
        authorityStatus: "CANONICAL_FROM_HARMONY_MASTER_V1",
        availableSource: "docs/tgr/golden/COTAS_NATAL_HARMONY_GOLDEN_V1_RULES.json",
        adoptedGrossContracts: "4457.00000000",
        sourceConflicts: [{
          id: "SC-001",
          status: "SOURCE_CONFLICT",
          adoptedRule: "4.457 no cronograma; 4.458 na linha indicadora.",
        }],
      },
    };
    const exportable = createExportableSnapshot(
      harmonyPersistedPayload,
      "h".repeat(64),
      undefined,
      {
        ...exportMetadata,
        financialModelMode: "HARMONY_COMPAT_V1",
      }
    );

    expect(exportable).toMatchObject({
      financialModelMode: "HARMONY_COMPAT_V1",
      exportMetadata: {
        financialModelMode: "HARMONY_COMPAT_V1",
        financialModelModeLabel: "Harmony Compatível V1",
      },
    });
    const pdf = await PDFDocument.load(await buildBoardroomPdf(exportable));
    expect(pdf.getSubject()).toContain("HARMONY_COMPAT_V1");
    expect(pdf.getSubject()).toContain("Harmony Compatível V1");
    expect(pdf.getSubject()).toContain("CANONICAL_FROM_HARMONY_MASTER_V1");
    expect(pdf.getSubject()).toContain("COTAS_NATAL_HARMONY_GOLDEN_V1_RULES.json");
    expect(pdf.getSubject()).toContain("SC-001");
    const pdfCover = pdfVisibleText(pdf);
    expect(pdfCover).toContain("MODELO FINANCEIRO HARMONY_COMPAT_V1");
    expect(pdfCover).toContain("FORMULA SET 1.0.0");
    expect(pdfCover).toContain("ENGINE harmony-compat-engine-v1");
    expect(pdfCover).toContain("SNAPSHOT HASH");
    expect(pdfCover).toContain("CANONICAL_FROM_HARMONY_MASTER_V1");
    expect(pdfCover).toContain("GOLDEN HARMONY CERTIFICADO");
    expect(pdfCover).toContain("SC-001");

    const pptx = await JSZip.loadAsync(await buildBoardroomPptx(exportable));
    const cover = await pptx.file("ppt/slides/slide1.xml")?.async("string");
    expect(cover).toContain("MODELO FINANCEIRO HARMONY_COMPAT_V1");
    expect(cover).toContain("Harmony Compatível V1");
    expect(cover).toContain("harmony-compat-engine-v1");
    expect(cover).toContain("CANONICAL_FROM_HARMONY_MASTER_V1");
    expect(cover).toContain("GOLDEN HARMONY CERTIFICADO");
    expect(cover).toContain("SC-001");

    const xlsx = await JSZip.loadAsync(await buildBoardroomXlsx(exportable));
    const visibleProvenance = await workbookSheet(xlsx, 2);
    expect(visibleProvenance).toContain("HARMONY_COMPAT_V1");
    expect(visibleProvenance).toContain("Harmony Compatível V1");
    expect(visibleProvenance).toContain("harmony-compat-engine-v1");
    expect(visibleProvenance).toContain("CANONICAL_FROM_HARMONY_MASTER_V1");
    expect(visibleProvenance).toContain("COTAS_NATAL_HARMONY_GOLDEN_V1_RULES.json");
    expect(visibleProvenance).toContain("SC-001");
    expect(visibleProvenance).toContain("Golden Harmony canônico certificado");
  });

  it("recusa exportar Harmony aprovado quando qualquer input ainda deriva de TEST_DATA", () => {
    const contaminated = {
      ...withoutSnapshotData(),
      financialModelMode: "HARMONY_COMPAT_V1" as const,
      formulaSetVersion: HARMONY_COMPAT_FORMULA_SET_V1.semanticVersion,
      engineVersion: HARMONY_COMPAT_FORMULA_SET_V1.engineVersion,
      effectiveInputs: {
        ...inputs,
        fixedCostMonthly: {
          ...inputs.fixedCostMonthly,
          sourceRef: "TEST_DATA:fixture-antigo",
        },
      },
    } as FinancialCalculation & { effectiveInputs: FinancialInputSnapshot };

    expect(() =>
      createExportableSnapshot(contaminated, "h".repeat(64), undefined, {
        ...exportMetadata,
        financialModelMode: "HARMONY_COMPAT_V1",
      })
    ).toThrow("Snapshot Harmony com proveniência TEST_DATA não pode gerar artefato aprovado.");
  });

  it("rejeita conflito entre modo do cálculo e modo do metadata", () => {
    expect(() =>
      createExportableSnapshot(snapshot, snapshot.snapshotHash, undefined, {
        ...exportMetadata,
        financialModelMode: "HARMONY_COMPAT_V1",
      })
    ).toThrow("Modo financeiro do cálculo TGR_CANONICAL_V2 diverge do metadata HARMONY_COMPAT_V1.");
  });

  it("rejeita versões e label que não correspondem ao registry do modo", () => {
    const harmonyCalculation: FinancialCalculation = {
      ...withoutSnapshotData(),
      financialModelMode: "HARMONY_COMPAT_V1",
      formulaSetVersion: HARMONY_COMPAT_FORMULA_SET_V1.semanticVersion,
      engineVersion: HARMONY_COMPAT_FORMULA_SET_V1.engineVersion,
    };

    expect(() =>
      createExportableSnapshot(
        { ...harmonyCalculation, formulaSetVersion: IGR_CORE_FORMULA_SET_V1.semanticVersion },
        "h".repeat(64)
      )
    ).toThrow("Formula Set 1.9.0 incompatível com HARMONY_COMPAT_V1; esperado 1.0.0.");
    expect(() =>
      createExportableSnapshot(
        { ...harmonyCalculation, engineVersion: IGR_CORE_FORMULA_SET_V1.engineVersion },
        "h".repeat(64)
      )
    ).toThrow("Engine igr-engine-1.9.0 incompatível com HARMONY_COMPAT_V1; esperado harmony-compat-engine-v1.");
    expect(() =>
      createExportableSnapshot(harmonyCalculation, "h".repeat(64), undefined, {
        ...exportMetadata,
        financialModelMode: "HARMONY_COMPAT_V1",
        financialModelModeLabel: "Harmony inventado",
      })
    ).toThrow("Label financeiro inválido para HARMONY_COMPAT_V1; esperado Harmony Compatível V1.");
  });

  it.each([
    ["1.3.0", "igr-engine-1.3.0"],
    ["1.4.0", "igr-engine-1.4.0"],
    ["1.5.0", "igr-engine-1.5.0"],
    ["1.6.0", "igr-engine-1.6.0"],
    ["1.7.0", "igr-engine-1.7.0"],
    ["1.8.0", "igr-engine-1.8.0"],
    ["1.9.0", "igr-engine-1.9.0"],
  ])(
    "infere canônico para cálculo legado %s/%s sem mudar o hash do pack",
    (formulaSetVersion, engineVersion) => {
    const {
      financialModelMode: _mode,
      snapshotHash: _snapshotHash,
      ...legacyCalculation
    } = snapshot;
    legacyCalculation.formulaSetVersion = formulaSetVersion;
    legacyCalculation.engineVersion = engineVersion;
    const legacyMetadata = {
      ...exportMetadata,
    };
    const expectedLegacyHash = createExportPackHash({
      snapshotHash: snapshot.snapshotHash,
      exportMetadata: legacyMetadata,
    });
    const exportable = createExportableSnapshot(
      legacyCalculation,
      snapshot.snapshotHash,
      undefined,
      legacyMetadata
    );

    expect(exportable.financialModelMode).toBe("TGR_CANONICAL_V2");
    expect(exportable.financialModelModeLabel).toBe("TGR Canônico V2");
    expect(exportable.exportMetadata?.financialModelMode).toBeUndefined();
    expect(exportable.exportPackHash).toBe(expectedLegacyHash);
    }
  );

  it("identifica o modo canônico inferido de um snapshot legado também no conteúdo visível", async () => {
    const {
      financialModelMode: _mode,
      snapshotHash: _snapshotHash,
      ...legacyCalculation
    } = snapshot;
    legacyCalculation.formulaSetVersion = "1.8.0";
    legacyCalculation.engineVersion = "igr-engine-1.8.0";
    const legacy = createExportableSnapshot(
      legacyCalculation,
      snapshot.snapshotHash
    );

    const pdf = await PDFDocument.load(await buildBoardroomPdf(legacy));
    expect(pdfVisibleText(pdf)).toContain("MODELO FINANCEIRO TGR_CANONICAL_V2");

    const pptx = await JSZip.loadAsync(await buildBoardroomPptx(legacy));
    expect(await pptx.file("ppt/slides/slide1.xml")?.async("string")).toContain(
      "TGR Canônico V2"
    );

    const xlsx = await JSZip.loadAsync(await buildBoardroomXlsx(legacy));
    const provenance = await workbookSheet(xlsx, 2);
    expect(provenance).toContain("TGR_CANONICAL_V2");
    expect(provenance).toContain("TGR Canônico V2");
  });

  it.each([
    ["1.3.0", "igr-engine-1.4.0"],
    ["1.9.0", "igr-engine-1.8.0"],
    ["9.9.9", "igr-engine-9.9.9"],
    ["1.0.0", "harmony-compat-engine-v1"],
  ])(
    "não infere modo legado para par desconhecido ou cruzado %s/%s",
    (formulaSetVersion, engineVersion) => {
    expect(() =>
      createExportableSnapshot(
        {
          ...withoutSnapshotData(),
          formulaSetVersion,
          engineVersion,
        },
        "h".repeat(64)
      )
    ).toThrow(
      `Cálculo legado sem modo não permite inferência para formula ${formulaSetVersion} / engine ${engineVersion}.`
    );
    }
  );

  it("inclui toda a proveniência no hash determinístico do pack", () => {
    const first = createExportPackHash({
      snapshotHash: snapshot.snapshotHash,
      exportMetadata,
    });
    const repeated = createExportPackHash({
      snapshotHash: snapshot.snapshotHash,
      exportMetadata: { ...exportMetadata, generatedBy: { ...exportMetadata.generatedBy } },
    });
    const anotherGeneration = createExportPackHash({
      snapshotHash: snapshot.snapshotHash,
      exportMetadata: {
        ...exportMetadata,
        generatedAt: "2026-08-31T12:35:00.000Z",
      },
    });
    const anotherVersion = createExportPackHash({
      snapshotHash: snapshot.snapshotHash,
      exportMetadata: {
        ...exportMetadata,
        versionId: "version-other-baseline",
      },
    });

    expect(first).toBe(repeated);
    expect(first).toBe(anotherGeneration);
    expect(first).not.toBe(anotherVersion);
  });

  it("preserva o hash legado quando o consumidor não fornece modo financeiro", () => {
    expect(
      createExportPackHash({
        snapshotHash: "x".repeat(64),
        exportMetadata: {
          snapshotId: "snapshot-legacy",
          versionId: "version-legacy",
          generatedAt: "2026-08-31T12:34:56.000Z",
          generatedBy: { id: 42, name: "Lucas Tigre", email: null },
          lifecycleStatus: "baseline",
          approvalStatus: "approved",
        },
      })
    ).toBe("ce192e1bf91ad13987c69014de665c4906169f548186f2b4f32d71ae1af0f295");
  });

  it("transporta hash completo, versão, geração, autor e lifecycle no PDF/PPTX/XLSX", async () => {
    const pdf = await PDFDocument.load(await buildBoardroomPdf(provenanceSnapshot));
    expect(pdf.getSubject()).toContain(snapshot.snapshotHash);
    expect(pdf.getSubject()).toContain(exportMetadata.snapshotId);
    expect(pdf.getSubject()).toContain(exportMetadata.versionId);
    expect(pdf.getSubject()).toContain(exportMetadata.lifecycleStatus);
    expect(pdf.getAuthor()).toBe("Lucas Tigre <lucas@example.com>");
    expect(pdf.getCreationDate()?.toISOString()).toBe(exportMetadata.generatedAt);
    expect(pdf.getSubject()).toContain("TGR_CANONICAL_V2");
    expect(pdf.getSubject()).toContain("TGR Canônico V2");
    expect(pdf.getSubject()).toContain(snapshot.formulaSetVersion);
    expect(pdf.getSubject()).toContain(snapshot.engineVersion);
    const visiblePdfCover = pdfVisibleText(pdf);
    expect(visiblePdfCover).toContain("MODELO FINANCEIRO TGR_CANONICAL_V2");
    expect(visiblePdfCover).toContain(`FORMULA SET ${snapshot.formulaSetVersion}`);
    expect(visiblePdfCover).toContain(`ENGINE ${snapshot.engineVersion}`);
    expect(visiblePdfCover).toContain(`SNAPSHOT HASH ${snapshot.snapshotHash}`);

    const pptx = await JSZip.loadAsync(await buildBoardroomPptx(provenanceSnapshot));
    const cover = await pptx.file("ppt/slides/slide1.xml")?.async("string");
    const pptxCore = await pptx.file("docProps/core.xml")?.async("string");
    expect(cover).toContain(snapshot.snapshotHash);
    expect(cover).toContain(exportMetadata.snapshotId);
    expect(cover).toContain(exportMetadata.versionId);
    expect(cover).toContain(exportMetadata.generatedAt);
    expect(cover).toContain("Lucas Tigre");
    expect(cover).toContain("baseline");
    expect(cover).toContain("MODELO FINANCEIRO TGR_CANONICAL_V2");
    expect(cover).toContain("TGR Canônico V2");
    expect(cover).toContain(snapshot.formulaSetVersion);
    expect(cover).toContain(snapshot.engineVersion);
    expect(pptxCore).toContain("Lucas Tigre &lt;lucas@example.com&gt;");

    const xlsx = await JSZip.loadAsync(await buildBoardroomXlsx(provenanceSnapshot));
    const outputs = await workbookSheet(xlsx, 6);
    const xlsxCore = await xlsx.file("docProps/core.xml")?.async("string");
    expect(outputs).toContain(snapshot.snapshotHash);
    expect(outputs).toContain(exportMetadata.snapshotId);
    expect(outputs).toContain(exportMetadata.versionId);
    expect(outputs).toContain(exportMetadata.generatedAt);
    expect(outputs).toContain("Lucas Tigre");
    expect(outputs).toContain("baseline");
    expect(outputs).toContain("TGR_CANONICAL_V2");
    expect(outputs).toContain("TGR Canônico V2");
    expect(outputs).toContain(snapshot.formulaSetVersion);
    expect(outputs).toContain(snapshot.engineVersion);
    expect(xlsxCore).toContain("Lucas Tigre &lt;lucas@example.com&gt;");
  });

  it("enriquece o payload persistido com o hash autoritativo da linha", () => {
    const { snapshotHash: _ignored, ...persistedPayload } = snapshot;

    expect(
      createExportableSnapshot(persistedPayload, snapshot.snapshotHash)
    ).toMatchObject({
      snapshotHash: snapshot.snapshotHash,
      status: "valid",
      kpis: { npv: snapshot.kpis.npv },
      effectiveInputs: {
        qualifiedCouplesMonth1: inputs.qualifiedCouplesMonth1,
      },
    });
  });

  it("anexa comparação canônica de cenários reais ao pack sem recalcular números", async () => {
    const { snapshotHash: _ignored, ...persistedPayload } = snapshot;
    const exportable = createExportableSnapshot(
      persistedPayload,
      snapshot.snapshotHash,
      scenarioComparison,
    );

    expect(exportable.exportPackHash).toBeTruthy();
    expect(exportable.exportPackHash).not.toBe(snapshot.snapshotHash);
    expect(exportable.scenarioComparison?.selectionHash).toBe(
      scenarioComparison.selectionHash
    );

    const pptx = await JSZip.loadAsync(await buildBoardroomPptx(exportable));
    const scenarioSlide = await pptx.file("ppt/slides/slide4.xml")?.async("string");
    expect(scenarioSlide).toContain("Base aprovada");
    expect(scenarioSlide).toContain("Cenário custo fixo");
    expect(scenarioSlide).toContain(scenarioComparison.selectionHash.slice(0, 12).toUpperCase());

    const xlsx = await JSZip.loadAsync(await buildBoardroomXlsx(exportable));
    const scenarios = await workbookSheet(xlsx, 4);
    expect(scenarios).toContain("Base aprovada");
    expect(scenarios).toContain(snapshot.snapshotHash);
    expect(scenarios).toContain(snapshot.kpis.npv);
    expect(scenarios).toContain("Cenário custo fixo");
    expect(scenarios).toContain(scenarioSnapshot.snapshotHash);
    expect(scenarios).toContain(scenarioSnapshot.kpis.npv);
    expect(scenarios).toContain(exportable.exportPackHash);
    expect(scenarios).toContain(scenarioComparison.selectionHash);
  });

  it("gera PDF com conteúdo a partir de snapshot", async () => {
    const bytes = await buildBoardroomPdf(snapshot);
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(7);
    expect(pdf.getSubject()).toContain("Point Economics");
    expect(pdf.getSubject()).toContain(pointEconomics.totals.value.incrementalNetContribution);
    expect(pdf.getKeywords()).toContain("Commercial Operations");
    expect(pdf.getKeywords()).toContain(commercialOperations.room.bottlenecks.tours);
  });

  it("gera PPTX com conteúdo a partir de snapshot", async () => {
    const buffer = await buildBoardroomPptx(snapshot);
    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(buffer.slice(0, 2).toString()).toBe("PK");
    const archive = await JSZip.loadAsync(buffer);
    expect(archive.file("[Content_Types].xml")).toBeTruthy();
    expect(archive.file("ppt/presentation.xml")).toBeTruthy();
    expect(archive.file("ppt/slides/slide1.xml")).toBeTruthy();
    expect(archive.file("ppt/slides/slide2.xml")).toBeTruthy();
    expect(archive.file("ppt/slides/slide3.xml")).toBeTruthy();
    expect(archive.file("ppt/slides/slide4.xml")).toBeTruthy();
    expect(archive.file("ppt/slides/slide5.xml")).toBeTruthy();
    expect(archive.file("ppt/slides/slide6.xml")).toBeTruthy();
    expect(archive.file("ppt/slides/slide7.xml")).toBeTruthy();
    expect(
      await archive.file("ppt/slides/slide1.xml")?.async("string")
    ).toContain("TGR Consulting");
    const inputSlide = await archive.file("ppt/slides/slide2.xml")?.async("string");
    expect(inputSlide).toContain("Inputs e Proveniência");
    expect(inputSlide).toContain("qualifiedCouplesMonth1");
    expect(inputSlide).toContain("export-test");
    const scenarioSlide = await archive.file("ppt/slides/slide4.xml")?.async("string");
    expect(scenarioSlide).toContain("Snapshot sem cenários anexados");
    expect(scenarioSlide).not.toContain("Base aprovada");
    const formulaSlide = await archive.file("ppt/slides/slide5.xml")?.async("string");
    expect(formulaSlide).toContain(`${snapshot.memory[0].formulaId}@${snapshot.memory[0].formulaVersion}`);
    const pointSlide = await archive.file("ppt/slides/slide6.xml")?.async("string");
    expect(pointSlide).toContain("Point Economics");
    expect(pointSlide).toContain("Quiosque Cotia Mall");
    expect(pointSlide).toContain(pointEconomics.totals.value.incrementalNetContribution);
    const operationsSlide = await archive.file("ppt/slides/slide7.xml")?.async("string");
    expect(operationsSlide).toContain("Commercial Operations");
    expect(operationsSlide).toContain("academy");
    expect(operationsSlide).toContain(snapshot.commissionLedger!.totals.payable);
  });

  it("gera XLSX investor pack reconciliável com o snapshot", async () => {
    const buffer = await buildBoardroomXlsx(snapshot);
    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(buffer.slice(0, 2).toString()).toBe("PK");

    const archive = await JSZip.loadAsync(buffer);
    const workbook = await archive.file("xl/workbook.xml")?.async("string");
    const inputsSheet = await workbookSheet(archive, 1);
    const provenanceSheet = await workbookSheet(archive, 2);
    const projections = await workbookSheet(archive, 3);
    const scenarios = await workbookSheet(archive, 4);
    const formulas = await workbookSheet(archive, 5);
    const outputs = await workbookSheet(archive, 6);
    const points = await workbookSheet(archive, 7);
    const operations = await workbookSheet(archive, 8);

    expect(workbook).toContain("Inputs");
    expect(workbook).toContain("Statuses &amp; Sources");
    expect(workbook).toContain("Monthly Projection");
    expect(workbook).toContain("Scenarios");
    expect(workbook).toContain("Formulas");
    expect(workbook).toContain("Outputs");
    expect(workbook).toContain("Point Economics");
    expect(workbook).toContain("Commercial Operations");
    expect(inputsSheet).toContain("qualifiedCouplesMonth1");
    expect(inputsSheet).toContain("100");
    expect(inputsSheet).toContain("capexAcquisitionShareRate");
    expect(inputsSheet).toContain("PENDENTE");
    expect(provenanceSheet).toContain("Tabela aprovada");
    expect(provenanceSheet).toContain("Ata de carteira");
    expect(provenanceSheet).toContain("Cadastro de pontos");
    expect(provenanceSheet).toContain(snapshot.snapshotHash);
    expect(provenanceSheet).toContain("financialModelMode");
    expect(provenanceSheet).toContain("TGR_CANONICAL_V2");
    expect(provenanceSheet).toContain("TGR Canônico V2");
    expect(provenanceSheet).toContain(snapshot.formulaSetVersion);
    expect(provenanceSheet).toContain(snapshot.engineVersion);
    expect(scenarios).toContain("Snapshot sem cenários anexados");
    expect(scenarios).not.toContain("Base aprovada");
    expect(formulas).toContain(snapshot.memory[0].label);
    expect(formulas).toContain(`${snapshot.memory[0].formulaId}@${snapshot.memory[0].formulaVersion}`);
    expect(outputs).toContain("VPL");
    expect(outputs).toContain(snapshot.kpis.npv);
    expect(outputs).toContain(snapshot.snapshotHash);
    expect(points).toContain("Quiosque Cotia Mall");
    expect(points).toContain(pointEconomics.totals.value.incrementalNetContribution);
    expect(points).toContain(pointEconomics.totals.reconciliation.productionDifference);
    expect(operations).toContain("academy");
    expect(operations).toContain("closer-fixed");
    expect(operations).toContain("Tours planejados excedem a capacidade limitada.");
    expect(operations).toContain(snapshot.commissionLedger!.totals.payable);
    expect(operations).toContain("0.00000000");
    expect(projections).toContain("Custos de Commercial Operations");
    expect(projections).toContain("Pagamentos de comissão");
    expect(projections).toContain(snapshot.projections[0].commercialOperationsCosts);
    expect(projections).toContain(snapshot.projections[0].commissionPayments);
  });

  it("registra estado honesto quando o snapshot não carrega inputs nem cenários", async () => {
    const archive = await JSZip.loadAsync(
      await buildBoardroomXlsx(withoutSnapshotData())
    );

    expect(await workbookSheet(archive, 1)).toContain("Snapshot sem input payload");
    expect(await workbookSheet(archive, 4)).toContain("Snapshot sem cenários anexados");
    expect(await workbookSheet(archive, 6)).toContain("blocked_by_pending_inputs");
    expect(await workbookSheet(archive, 6)).toContain("averageTicket");
  });

  it("mantém os artefatos compatíveis quando Commercial Operations está ausente", async () => {
    const { commercialOperations: _operations, commissionLedger: _ledger, ...withoutOperations } = snapshot;

    const pdfBytes = await buildBoardroomPdf(withoutOperations);
    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(6);

    const pptx = await JSZip.loadAsync(await buildBoardroomPptx(withoutOperations));
    expect(pptx.file("ppt/slides/slide2.xml")).toBeTruthy();
    expect(pptx.file("ppt/slides/slide6.xml")).toBeTruthy();
    expect(pptx.file("ppt/slides/slide7.xml")).toBeNull();

    const xlsx = await JSZip.loadAsync(await buildBoardroomXlsx(withoutOperations));
    const operations = await xlsx.file("xl/worksheets/sheet8.xml")?.async("string");
    expect(operations).toContain("Snapshot sem Commercial Operations");
  });
});
