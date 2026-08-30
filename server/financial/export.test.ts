import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { calculatePointEconomics } from "../../shared/financial/pointEconomics";
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

const snapshot = {
  status: "valid" as const,
  horizonMonths: 12,
  missingInputKeys: [],
  formulaSetVersion: "1.0.0",
  engineVersion: "igr-engine-1.0.0",
  projections: [],
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
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getSubject()).toContain("Point Economics");
    expect(pdf.getSubject()).toContain(pointEconomics.totals.value.incrementalNetContribution);
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
    expect(
      await archive.file("ppt/slides/slide1.xml")?.async("string")
    ).toContain("TGR Consulting");
    const pointSlide = await archive.file("ppt/slides/slide2.xml")?.async("string");
    expect(pointSlide).toContain("Point Economics");
    expect(pointSlide).toContain("Quiosque Cotia Mall");
    expect(pointSlide).toContain(pointEconomics.totals.value.incrementalNetContribution);
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

    expect(workbook).toContain("Resumo");
    expect(workbook).toContain("Memoria de calculo");
    expect(workbook).toContain("Point Economics");
    expect(summary).toContain("42.00000000");
    expect(summary).toContain(snapshot.snapshotHash);
    expect(memory).toContain("Valor presente líquido");
    expect(memory).toContain("npv@1.0.0");
    expect(points).toContain("Quiosque Cotia Mall");
    expect(points).toContain(pointEconomics.totals.value.incrementalNetContribution);
    expect(points).toContain(pointEconomics.totals.reconciliation.productionDifference);
  });
});
