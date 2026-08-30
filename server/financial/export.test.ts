import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { calculatePointEconomics } from "../../shared/financial/pointEconomics";
import { calculateCommercialOperations } from "../../shared/financial/commercialOperations";
import { calculateFinancialProjection } from "../../shared/financial/engine";
import type { FinancialInputSnapshot } from "../../shared/financial/types";
import {
  buildBoardroomPdf,
  buildBoardroomPptx,
  buildBoardroomXlsx,
  createExportableSnapshot,
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
const operationsCalculation = calculateFinancialProjection(inputs, 2, { pointEconomics, commercialOperations });
if (operationsCalculation.status !== "valid") throw new Error("Fixture operacional inválida.");

const snapshot = {
  ...operationsCalculation,
  kpis: {
    grossSales: "100.00000000",
    recognizedRevenue: "80.00000000",
    totalOperatingCashFlow: "50.00000000",
    npv: "42.00000000",
    irrAnnual: "0.12000000",
    paybackMonths: "8.00000000",
  },
  memory: [
    {
      kpiKey: "npv",
      label: "Valor presente líquido",
      value: "42.00000000",
      formulaId: "npv",
      formulaVersion: "1.0.0",
      expression: "Σ",
      dependencies: ["operating-cash-flow"],
      explanation: "Valor presente dos fluxos.",
    },
  ],
  pointEconomics,
  snapshotHash: "a".repeat(64),
};

describe("geradores de artefato Boardroom", () => {
  it("enriquece o payload persistido com o hash autoritativo da linha", () => {
    const { snapshotHash: _ignored, ...persistedPayload } = snapshot;

    expect(
      createExportableSnapshot(persistedPayload, snapshot.snapshotHash)
    ).toMatchObject({
      snapshotHash: snapshot.snapshotHash,
      status: "valid",
      kpis: { npv: "42.00000000" },
    });
  });

  it("gera PDF com conteúdo a partir de snapshot", async () => {
    const bytes = await buildBoardroomPdf(snapshot);
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(3);
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
    expect(
      await archive.file("ppt/slides/slide1.xml")?.async("string")
    ).toContain("TGR Consulting");
    const pointSlide = await archive.file("ppt/slides/slide2.xml")?.async("string");
    expect(pointSlide).toContain("Point Economics");
    expect(pointSlide).toContain("Quiosque Cotia Mall");
    expect(pointSlide).toContain(pointEconomics.totals.value.incrementalNetContribution);
    const operationsSlide = await archive.file("ppt/slides/slide3.xml")?.async("string");
    expect(operationsSlide).toContain("Commercial Operations");
    expect(operationsSlide).toContain("academy");
    expect(operationsSlide).toContain(snapshot.commissionLedger!.totals.payable);
  });

  it("gera XLSX reconciliável com KPIs e memória do snapshot", async () => {
    const buffer = await buildBoardroomXlsx(snapshot);
    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(buffer.slice(0, 2).toString()).toBe("PK");

    const archive = await JSZip.loadAsync(buffer);
    const workbook = await archive.file("xl/workbook.xml")?.async("string");
    const summary = await archive
      .file("xl/worksheets/sheet1.xml")
      ?.async("string");
    const memory = await archive
      .file("xl/worksheets/sheet2.xml")
      ?.async("string");
    const points = await archive
      .file("xl/worksheets/sheet4.xml")
      ?.async("string");
    const operations = await archive
      .file("xl/worksheets/sheet5.xml")
      ?.async("string");
    const projections = await archive
      .file("xl/worksheets/sheet3.xml")
      ?.async("string");

    expect(workbook).toContain("Resumo");
    expect(workbook).toContain("Memoria de calculo");
    expect(workbook).toContain("Point Economics");
    expect(workbook).toContain("Commercial Operations");
    expect(summary).toContain("42.00000000");
    expect(summary).toContain(snapshot.snapshotHash);
    expect(memory).toContain("Valor presente líquido");
    expect(memory).toContain("npv@1.0.0");
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

  it("mantém os artefatos compatíveis quando Commercial Operations está ausente", async () => {
    const { commercialOperations: _operations, commissionLedger: _ledger, ...withoutOperations } = snapshot;

    const pdfBytes = await buildBoardroomPdf(withoutOperations);
    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(2);

    const pptx = await JSZip.loadAsync(await buildBoardroomPptx(withoutOperations));
    expect(pptx.file("ppt/slides/slide2.xml")).toBeTruthy();
    expect(pptx.file("ppt/slides/slide3.xml")).toBeNull();

    const xlsx = await JSZip.loadAsync(await buildBoardroomXlsx(withoutOperations));
    const operations = await xlsx.file("xl/worksheets/sheet5.xml")?.async("string");
    expect(operations).toContain("Snapshot sem Commercial Operations");
  });
});
