import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import Decimal from "decimal.js";
import { createHash } from "node:crypto";
import {
  FINANCIAL_INPUT_KEYS,
  type FinancialCalculation,
  type FinancialInput,
  type FinancialInputSnapshot,
  type FinancialModelMode,
} from "../../shared/financial/types";
import {
  getFinancialModelModeDefinition,
  resolveLegacyFinancialModelMode,
} from "../../shared/financial/modelMode";

const NAVY = "0B1220";
const PANEL = "111C2F";
const GOLD = "E8BD5A";
const LIGHT = "E8EDF5";
const MUTED = "93A0B4";
const EMU = 914400;

export type ExportPackScenarioComparisonEntry = {
  versionId: string;
  kind: "working" | "scenario" | "approval" | "baseline";
  state: "draft" | "in_review" | "approved" | "baseline";
  isImmutable: boolean;
  label: string;
  reason: string | null;
  snapshotId: string | null;
  snapshotHash: string | null;
  comparisonStatus: "comparable" | "not_comparable";
  horizonMonths: number | null;
  asOfMonth: number | null;
  kpis: FinancialCalculation["kpis"] | null;
};

export type ExportPackScenarioComparison = {
  source: "persisted_scenario_snapshots.v1";
  baseSnapshotHash: string;
  selectionHash: string;
  entries: ExportPackScenarioComparisonEntry[];
};

export type ExportMetadata = {
  snapshotId: string;
  versionId: string;
  generatedAt: string;
  generatedBy: {
    id: number;
    name: string;
    email: string | null;
  };
  lifecycleStatus: "baseline";
  approvalStatus: "approved";
  financialModelMode?: FinancialModelMode;
  financialModelModeLabel?: string;
};

export type ExportableSnapshot = FinancialCalculation & {
  snapshotHash: string;
  exportPackHash: string;
  effectiveInputs?: FinancialInputSnapshot;
  authoritativeDomains?: Record<string, unknown>;
  domainBlockers?: string[];
  domainInvalidities?: string[];
  scenarioComparison?: ExportPackScenarioComparison;
  exportMetadata?: ExportMetadata;
  financialModelModeLabel?: string;
};

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export function createScenarioComparisonPayload(params: {
  baseSnapshotHash: string;
  entries: ExportPackScenarioComparisonEntry[];
}): ExportPackScenarioComparison {
  if (!params.baseSnapshotHash)
    throw new Error("Comparação de cenários exige hash do snapshot-base.");
  const entries = [...params.entries]
    .map(entry => ({
      ...entry,
      reason: entry.reason ?? null,
      snapshotId: entry.snapshotId ?? null,
      snapshotHash: entry.snapshotHash ?? null,
      comparisonStatus: entry.comparisonStatus,
      horizonMonths: entry.horizonMonths ?? null,
      asOfMonth: entry.asOfMonth ?? null,
      kpis: entry.kpis ?? null,
    }))
    .sort((left, right) => {
      const leftIsBase = left.snapshotHash === params.baseSnapshotHash ? 0 : 1;
      const rightIsBase = right.snapshotHash === params.baseSnapshotHash ? 0 : 1;
      return (
        leftIsBase - rightIsBase ||
        left.kind.localeCompare(right.kind) ||
        left.label.localeCompare(right.label) ||
        left.versionId.localeCompare(right.versionId)
      );
    });
  const selectionHash = sha256({
    source: "persisted_scenario_snapshots.v1",
    baseSnapshotHash: params.baseSnapshotHash,
    entries: entries.map(entry => ({
      versionId: entry.versionId,
      kind: entry.kind,
      state: entry.state,
      label: entry.label,
      snapshotId: entry.snapshotId,
      snapshotHash: entry.snapshotHash,
      comparisonStatus: entry.comparisonStatus,
      horizonMonths: entry.horizonMonths,
      asOfMonth: entry.asOfMonth,
    })),
  });
  return {
    source: "persisted_scenario_snapshots.v1",
    baseSnapshotHash: params.baseSnapshotHash,
    selectionHash,
    entries,
  };
}

export function createExportPackHash(params: {
  snapshotHash: string;
  scenarioComparison?: ExportPackScenarioComparison;
  exportMetadata?: ExportMetadata;
}): string {
  const metadataModel = params.exportMetadata?.financialModelMode
    ? getFinancialModelModeDefinition(params.exportMetadata.financialModelMode)
    : undefined;
  if (
    metadataModel &&
    params.exportMetadata?.financialModelModeLabel !== undefined &&
    params.exportMetadata.financialModelModeLabel !== metadataModel.label
  )
    throw new Error(
      `Label financeiro inválido para ${metadataModel.id}; esperado ${metadataModel.label}.`
    );
  return sha256({
    source: "investor_export_pack.v1",
    snapshotHash: params.snapshotHash,
    scenarioSelectionHash: params.scenarioComparison?.selectionHash ?? null,
    exportIdentity: params.exportMetadata
      ? {
          snapshotId: params.exportMetadata.snapshotId,
          versionId: params.exportMetadata.versionId,
          lifecycleStatus: params.exportMetadata.lifecycleStatus,
          approvalStatus: params.exportMetadata.approvalStatus,
          ...(params.exportMetadata.financialModelMode
            ? {
                financialModelMode: params.exportMetadata.financialModelMode,
                financialModelModeLabel: metadataModel!.label,
              }
            : {}),
        }
      : null,
  });
}

export function createExportableSnapshot(
  calculation: FinancialCalculation,
  snapshotHash: string,
  scenarioComparison?: ExportPackScenarioComparison,
  exportMetadata?: ExportMetadata
): ExportableSnapshot {
  if (!snapshotHash)
    throw new Error("Snapshot autoritativo sem hash não pode ser exportado.");
  if (
    calculation.financialModelMode &&
    exportMetadata?.financialModelMode &&
    calculation.financialModelMode !== exportMetadata.financialModelMode
  )
    throw new Error(
      `Modo financeiro do cálculo ${calculation.financialModelMode} diverge do metadata ${exportMetadata.financialModelMode}.`
    );
  const explicitFinancialModelMode =
    calculation.financialModelMode ?? exportMetadata?.financialModelMode;
  const inferredLegacyFinancialModelMode = explicitFinancialModelMode
    ? null
    : resolveLegacyFinancialModelMode(
        calculation.formulaSetVersion,
        calculation.engineVersion
      );
  const financialModelMode =
    explicitFinancialModelMode ?? inferredLegacyFinancialModelMode ?? undefined;
  if (!financialModelMode)
    throw new Error(
      `Cálculo legado sem modo não permite inferência para formula ${calculation.formulaSetVersion} / engine ${calculation.engineVersion}.`
    );
  const modelDefinition = getFinancialModelModeDefinition(financialModelMode);
  const effectiveInputs = (
    calculation as FinancialCalculation & { effectiveInputs?: FinancialInputSnapshot }
  ).effectiveInputs;
  if (
    financialModelMode === "HARMONY_COMPAT_V1" &&
    effectiveInputs &&
    Object.values(effectiveInputs).some(input =>
      input.sourceRef?.toUpperCase().includes("TEST_DATA")
    )
  )
    throw new Error(
      "Snapshot Harmony com proveniência TEST_DATA não pode gerar artefato aprovado."
    );
  if (
    explicitFinancialModelMode &&
    calculation.formulaSetVersion !==
      modelDefinition.formulaSetVersion.semanticVersion
  )
    throw new Error(
      `Formula Set ${calculation.formulaSetVersion} incompatível com ${financialModelMode}; esperado ${modelDefinition.formulaSetVersion.semanticVersion}.`
    );
  if (
    explicitFinancialModelMode &&
    calculation.engineVersion !== modelDefinition.formulaSetVersion.engineVersion
  )
    throw new Error(
      `Engine ${calculation.engineVersion} incompatível com ${financialModelMode}; esperado ${modelDefinition.formulaSetVersion.engineVersion}.`
    );
  if (
    exportMetadata?.financialModelModeLabel !== undefined &&
    exportMetadata.financialModelModeLabel !== modelDefinition.label
  )
    throw new Error(
      `Label financeiro inválido para ${financialModelMode}; esperado ${modelDefinition.label}.`
    );
  const financialModelModeLabel = modelDefinition.label;
  const hasExplicitModelIdentity =
    explicitFinancialModelMode !== undefined ||
    exportMetadata?.financialModelModeLabel !== undefined;
  const normalizedMetadata = exportMetadata
    ? {
        ...exportMetadata,
        ...(hasExplicitModelIdentity
          ? { financialModelMode, financialModelModeLabel }
          : {}),
      }
    : undefined;
  return {
    ...calculation,
    financialModelMode,
    financialModelModeLabel,
    snapshotHash,
    scenarioComparison,
    exportMetadata: normalizedMetadata,
    exportPackHash: createExportPackHash({
      snapshotHash,
      scenarioComparison,
      exportMetadata: normalizedMetadata,
    }),
  };
}

function exportAuthor(metadata: ExportMetadata | undefined): string {
  if (!metadata) return "TGR Consulting";
  return metadata.generatedBy.email
    ? `${metadata.generatedBy.name} <${metadata.generatedBy.email}>`
    : metadata.generatedBy.name;
}

function exportProvenance(snapshot: ExportableSnapshot): string {
  const metadata = snapshot.exportMetadata;
  const financialModel = snapshot.financialModelMode
    ? ` | financial model ${snapshot.financialModelMode} (${snapshot.financialModelModeLabel ?? getFinancialModelModeDefinition(snapshot.financialModelMode).label})`
    : "";
  const compatibilityAuthority = compatibilityAuthorityLines(snapshot);
  if (!metadata)
    return [
      `Snapshot ${snapshot.snapshotHash}${financialModel}`,
      ...compatibilityAuthority,
    ].join(" | ");
  return [
    `Snapshot hash ${snapshot.snapshotHash}`,
    `snapshot ${metadata.snapshotId}`,
    `version ${metadata.versionId}`,
    `generated ${metadata.generatedAt}`,
    `author ${exportAuthor(metadata)}`,
    `lifecycle ${metadata.lifecycleStatus}`,
    `approval ${metadata.approvalStatus}`,
    `pack ${snapshot.exportPackHash}`,
    `formula set ${snapshot.formulaSetVersion}`,
    `engine ${snapshot.engineVersion}`,
    ...(snapshot.financialModelMode
      ? [
          `financial model ${snapshot.financialModelMode}`,
          `financial model label ${snapshot.financialModelModeLabel ?? getFinancialModelModeDefinition(snapshot.financialModelMode).label}`,
        ]
      : []),
    ...compatibilityAuthority,
  ].join(" | ");
}

function compatibilityAuthorityLines(snapshot: ExportableSnapshot): string[] {
  const evidence = snapshot.compatibilityEvidence;
  if (!evidence) return [];
  return [
    `authority ${evidence.authorityStatus}`,
    `available source ${evidence.availableSource}`,
    `missing source ${evidence.missingSource}`,
    "workbook parity not certified while the declared source is missing",
  ];
}

function compatibilityAuthorityVisibleLine(snapshot: ExportableSnapshot): string | null {
  const evidence = snapshot.compatibilityEvidence;
  if (!evidence) return null;
  return `${evidence.authorityStatus} · FONTE AUSENTE ${evidence.missingSource} · PARIDADE NÃO CERTIFICADA`;
}

export function visibleExportModelProvenance(snapshot: ExportableSnapshot) {
  const mode = snapshot.financialModelMode ?? resolveLegacyFinancialModelMode(
    snapshot.formulaSetVersion,
    snapshot.engineVersion
  );
  const definition = mode ? getFinancialModelModeDefinition(mode) : null;
  const label = definition?.label ?? "Modelo não identificado";
  return {
    modeId: mode ?? "UNIDENTIFIED",
    label,
    identityLine: `MODELO FINANCEIRO ${mode ?? "UNIDENTIFIED"} · ${label}`,
    technicalLine: `FORMULA SET ${snapshot.formulaSetVersion} · ENGINE ${snapshot.engineVersion} · SNAPSHOT HASH ${snapshot.snapshotHash}`,
  };
}

function shortHash(hash: string) {
  return hash.slice(0, 12).toUpperCase();
}
function displayHash(hash: string | null | undefined): string {
  return hash ? shortHash(hash) : "SEM HASH";
}
function display(value: string | null): string {
  return value ?? "N/D";
}
function decimalSum(values: Array<string | null | undefined>): string {
  return values.reduce(
    (total, value) => total.plus(value ?? "0"),
    new Decimal(0)
  ).toFixed(8);
}
function decimalDifference(left: string, right: string): string {
  return new Decimal(left).minus(right).toFixed(8);
}
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function emu(value: number): number {
  return Math.round(value * EMU);
}

function xlsxTextCell(reference: string, value: string): string {
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function xlsxNumberCell(
  reference: string,
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "")
    return xlsxTextCell(reference, "N/D");
  return `<c r="${reference}" t="n"><v>${xml(String(value))}</v></c>`;
}

function xlsxRow(index: number, cells: string[]): string {
  return `<row r="${index}">${cells.join("")}</row>`;
}

const KPI_ROWS: Array<[string, keyof ExportableSnapshot["kpis"]]> = [
  ["Venda bruta", "grossSales"],
  ["Entrada bruta gerada", "grossEntryGenerated"],
  ["Recebíveis brutos gerados", "grossReceivablesGenerated"],
  ["Recebíveis brutos liquidados", "grossReceivablesSettled"],
  ["Parcelas líquidas recebidas", "installmentCollections"],
  ["Recebíveis cancelados", "canceledReceivables"],
  ["Saldo inadimplente", "delinquentBalance"],
  ["Recebimentos recuperados", "curedCollections"],
  ["Saldo baixado para perda", "writtenOffBalance"],
  ["Healthy D90 esperado", "healthyD90"],
  ["Receita reconhecida", "recognizedRevenue"],
  ["Taxas de pagamento", "paymentFees"],
  ["Investimento pre-operacional", "preOperationalInvestment"],
  ["Caixa operacional", "totalOperatingCashFlow"],
  ["VPL", "npv"],
  ["TIR anual", "irrAnnual"],
  ["Payback em meses", "paybackMonths"],
];

function inputPayload(snapshot: ExportableSnapshot) {
  return snapshot.effectiveInputs;
}

function textValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/D";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function domainRecords(snapshot: ExportableSnapshot) {
  const domains = snapshot.authoritativeDomains ?? {};
  const model = visibleExportModelProvenance(snapshot);
  const rows: Array<[string, string, string, string, string]> = [
    ["snapshot", "hash", snapshot.status, "snapshot", snapshot.snapshotHash],
    ["snapshot", "financialModelMode", snapshot.status, "model", model.modeId],
    ["snapshot", "financialModelModeLabel", snapshot.status, "model", model.label],
    ["snapshot", "formulaSet", snapshot.status, "formula", snapshot.formulaSetVersion],
    ["snapshot", "engine", snapshot.status, "engine", snapshot.engineVersion],
  ];
  if (snapshot.compatibilityEvidence) {
    rows.push(
      [
        "compatibility_authority",
        "authorityStatus",
        snapshot.compatibilityEvidence.authorityStatus,
        "compatibility_evidence",
        "Paridade com o workbook ausente não certificada",
      ],
      [
        "compatibility_authority",
        "availableSource",
        snapshot.compatibilityEvidence.authorityStatus,
        "current_document",
        snapshot.compatibilityEvidence.availableSource,
      ],
      [
        "compatibility_authority",
        "missingSource",
        snapshot.compatibilityEvidence.authorityStatus,
        "missing_source",
        snapshot.compatibilityEvidence.missingSource,
      ]
    );
  }
  const pushRecord = (domain: string, label: string, record: Record<string, unknown>) => {
    rows.push([
      domain,
      label,
      textValue(record.status),
      textValue(record.sourceType),
      textValue(record.sourceRef),
    ]);
  };
  const productCatalog = domains.productCatalog as { records?: Array<Record<string, unknown>> } | undefined;
  productCatalog?.records?.forEach(record =>
    pushRecord("product_catalog", textValue(record.skuCode), record)
  );
  const commercialConditions = domains.commercialConditions as Array<Record<string, unknown>> | undefined;
  commercialConditions?.forEach(record =>
    pushRecord("commercial_conditions", textValue(record.productSkuCode), record)
  );
  const receivablesPolicy = domains.receivablesPolicy as Record<string, unknown> | null | undefined;
  if (receivablesPolicy) pushRecord("receivables_policy", "policy", receivablesPolicy);
  const capturePoints = domains.capturePoints as { definitions?: Array<Record<string, unknown>> } | undefined;
  capturePoints?.definitions?.forEach(record => {
    const definition = record.definition as Record<string, unknown> | undefined;
    pushRecord("capture_points", textValue(definition?.pointId ?? definition?.name), record);
  });
  const commercialOperations = domains.commercialOperations as Record<string, unknown> | null | undefined;
  if (commercialOperations) pushRecord("commercial_operations", "operations", commercialOperations);
  return rows;
}

function scenarioComparisonRows(snapshot: ExportableSnapshot) {
  const comparison = snapshot.scenarioComparison;
  if (!comparison || comparison.entries.length === 0) {
    return ["Snapshot sem cenários anexados", "Sem comparação fabricada."];
  }
  return [
    `Pack ${displayHash(snapshot.exportPackHash)} · seleção ${displayHash(comparison.selectionHash)}`,
    ...comparison.entries.map(entry =>
      `${entry.label} · ${entry.kind}/${entry.state} · ${entry.comparisonStatus} · horizonte ${entry.horizonMonths ?? "N/D"} · data-base M${entry.asOfMonth ?? "N/D"} · snapshot ${displayHash(entry.snapshotHash)} · VPL ${display(entry.kpis?.npv ?? null)} · caixa ${display(entry.kpis?.totalOperatingCashFlow ?? null)}`
    ),
  ];
}

function shape(
  id: number,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  text = "",
  options?: {
    color?: string;
    size?: number;
    bold?: boolean;
    line?: string;
    margin?: number;
  }
) {
  const color = options?.color ?? LIGHT;
  const size = options?.size ?? 1300;
  const weight = options?.bold ? ' b="1"' : "";
  const margin = emu(options?.margin ?? 0.12);
  const paragraph = text
    ? `<p:txBody><a:bodyPr lIns="${margin}" rIns="${margin}" tIns="${margin}" bIns="${margin}"/><a:lstStyle/><a:p><a:r><a:rPr lang="pt-BR" sz="${size}"${weight} solidFill="${color}"/><a:t>${xml(text)}</a:t></a:r><a:endParaRPr lang="pt-BR" sz="${size}" solidFill="${color}"/></a:p></p:txBody>`
    : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${options?.line ?? fill}"/></a:solidFill></a:ln></p:spPr>${paragraph}</p:sp>`;
}

export async function buildBoardroomPdf(
  snapshot: ExportableSnapshot
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const provenance = exportProvenance(snapshot);
  const modelProvenance = visibleExportModelProvenance(snapshot);
  const compatibilityAuthority = compatibilityAuthorityVisibleLine(snapshot);
  pdf.setTitle("TGR Consulting Boardroom Snapshot");
  pdf.setAuthor(exportAuthor(snapshot.exportMetadata));
  pdf.setCreator("TGR Consulting");
  pdf.setProducer("TGR Consulting");
  if (snapshot.exportMetadata) {
    pdf.setCreationDate(new Date(snapshot.exportMetadata.generatedAt));
    pdf.setModificationDate(new Date(snapshot.exportMetadata.generatedAt));
  }
  pdf.setSubject(provenance);
  if (snapshot.pointEconomics) {
    pdf.setSubject(
      `${provenance} | Point Economics · ${snapshot.pointEconomics.totals.pointCount} ponto(s) · contribuição incremental líquida ${snapshot.pointEconomics.totals.value.incrementalNetContribution}`
    );
  }
  if (snapshot.commercialOperations) {
    pdf.setKeywords([
      "Commercial Operations",
      `gargalo-tours:${snapshot.commercialOperations.room.bottlenecks.tours}`,
      `gargalo-vendas:${snapshot.commercialOperations.room.bottlenecks.sales}`,
    ]);
  }
  const page = pdf.addPage([842, 595]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 842,
    height: 595,
    color: rgb(0.043, 0.071, 0.125),
  });
  page.drawRectangle({
    x: 44,
    y: 420,
    width: 754,
    height: 128,
    color: rgb(0.067, 0.11, 0.19),
    borderColor: rgb(0.18, 0.23, 0.31),
    borderWidth: 1,
  });
  page.drawText("TGR CONSULTING", {
    x: 64,
    y: 518,
    size: 10,
    font: bold,
    color: rgb(0.91, 0.74, 0.35),
  });
  page.drawText("Boardroom Snapshot", {
    x: 64,
    y: 482,
    size: 28,
    font: bold,
    color: rgb(0.91, 0.93, 0.96),
  });
  page.drawText(
    "Artefato gerado apenas de snapshot autoritativo, validado e aprovado.",
    { x: 64, y: 456, size: 11, font: regular, color: rgb(0.58, 0.63, 0.71) }
  );
  page.drawText(
    modelProvenance.identityLine,
    { x: 64, y: 440, size: 8, font: bold, color: rgb(0.91, 0.74, 0.35), maxWidth: 710 }
  );
  page.drawText(
    modelProvenance.technicalLine,
    { x: 64, y: 426, size: 6.5, font: regular, color: rgb(0.58, 0.63, 0.71), maxWidth: 710 }
  );
  if (compatibilityAuthority) {
    page.drawText(compatibilityAuthority, {
      x: 64,
      y: 402,
      size: 6.5,
      font: bold,
      color: rgb(0.91, 0.74, 0.35),
      maxWidth: 710,
    });
  }
  if (snapshot.exportMetadata) {
    page.drawText(
      `SNAPSHOT ${snapshot.exportMetadata.snapshotId} · VERSION ${snapshot.exportMetadata.versionId}`,
      { x: 64, y: 414, size: 7, font: regular, color: rgb(0.58, 0.63, 0.71), maxWidth: 710 }
    );
  }
  const metrics = [
    ["VPL", display(snapshot.kpis.npv)],
    ["TIR ANUAL", display(snapshot.kpis.irrAnnual)],
    [
      "PAYBACK",
      snapshot.kpis.paybackMonths
        ? `${snapshot.kpis.paybackMonths} meses`
        : "N/D",
    ],
    ["CAIXA OPERACIONAL", display(snapshot.kpis.totalOperatingCashFlow)],
  ];
  metrics.forEach(([label, value], index) => {
    const x = 44 + index * 192;
    page.drawRectangle({
      x,
      y: 292,
      width: 176,
      height: 98,
      color: rgb(0.067, 0.11, 0.19),
      borderColor: rgb(0.15, 0.2, 0.28),
      borderWidth: 1,
    });
    page.drawText(label, {
      x: x + 16,
      y: 365,
      size: 9,
      font: bold,
      color: rgb(0.91, 0.74, 0.35),
    });
    page.drawText(value, {
      x: x + 16,
      y: 330,
      size: 15,
      font: bold,
      color: rgb(0.91, 0.93, 0.96),
      maxWidth: 144,
    });
  });
  page.drawText("Memória de cálculo", {
    x: 44,
    y: 248,
    size: 15,
    font: bold,
    color: rgb(0.91, 0.93, 0.96),
  });
  snapshot.memory.slice(0, 4).forEach((memory, index) => {
    const y = 215 - index * 36;
    page.drawText(`${memory.label}: ${display(memory.value)}`, {
      x: 44,
      y,
      size: 10,
      font: bold,
      color: rgb(0.91, 0.93, 0.96),
    });
    page.drawText(
      `Fórmula ${memory.formulaId}@${memory.formulaVersion} · ${memory.explanation}`,
      {
        x: 44,
        y: y - 14,
        size: 8,
        font: regular,
        color: rgb(0.58, 0.63, 0.71),
        maxWidth: 740,
      }
    );
  });
  page.drawText(
    modelProvenance.technicalLine,
    { x: 44, y: 28, size: 6.5, font: regular, color: rgb(0.58, 0.63, 0.71), maxWidth: 754 }
  );
  const addChapterPage = (
    title: string,
    subtitle: string,
    rows: string[],
  ) => {
    const chapter = pdf.addPage([842, 595]);
    chapter.drawRectangle({
      x: 0,
      y: 0,
      width: 842,
      height: 595,
      color: rgb(0.043, 0.071, 0.125),
    });
    chapter.drawText(title, {
      x: 44,
      y: 538,
      size: 10,
      font: bold,
      color: rgb(0.91, 0.74, 0.35),
    });
    chapter.drawText(subtitle, {
      x: 44,
      y: 504,
      size: 21,
      font: bold,
      color: rgb(0.91, 0.93, 0.96),
      maxWidth: 740,
    });
    rows.slice(0, 11).forEach((row, index) => {
      chapter.drawText(row, {
        x: 54,
        y: 452 - index * 36,
        size: 9,
        font: index === 0 ? bold : regular,
        color: index === 0 ? rgb(0.91, 0.93, 0.96) : rgb(0.58, 0.63, 0.71),
        maxWidth: 730,
      });
    });
    chapter.drawText(`${modelProvenance.identityLine} · ${modelProvenance.technicalLine}`, {
      x: 44,
      y: 28,
      size: 5.8,
      font: bold,
      color: rgb(0.91, 0.74, 0.35),
      maxWidth: 754,
    });
  };
  const inputs = inputPayload(snapshot);
  addChapterPage(
    "INPUTS E PROVENIÊNCIA",
    "Premissas, status e fontes carregadas pelo snapshot",
    inputs
      ? FINANCIAL_INPUT_KEYS.slice(0, 10).map(key => {
          const input = inputs[key];
          return `${key}: ${input.status === "provided" ? display(input.value ?? null) : "PENDENTE"} · ${input.sourceType} · ${input.sourceRef ?? "sem fonte"}`;
        })
      : ["Snapshot sem input payload", "O exportador não inventa premissas ausentes."],
  );
  addChapterPage(
    "PROJEÇÃO MENSAL",
    "Primeiros meses reconciliados com a projeção do snapshot",
    snapshot.projections.length
      ? snapshot.projections.slice(0, 10).map(row =>
          `M${row.month}: vendas ${row.grossSales} · caixa ${row.operatingCashFlow} · acumulado ${row.cumulativeCashFlow}`
        )
      : ["Snapshot sem projeção mensal carregada."],
  );
  addChapterPage(
    "CENÁRIOS",
    "Estado dos cenários anexados ao snapshot",
    scenarioComparisonRows(snapshot),
  );
  addChapterPage(
    "FÓRMULAS E OUTPUTS",
    "Memória de cálculo e KPIs autoritativos",
    [
      ...snapshot.memory.slice(0, 5).map(memory =>
        `${memory.formulaId}@${memory.formulaVersion}: ${memory.label} = ${display(memory.value)}`
      ),
      ...KPI_ROWS.slice(0, 5).map(([label, key]) =>
        `${label}: ${display(snapshot.kpis[key])}`
      ),
    ],
  );
  if (snapshot.pointEconomics) {
    const pointsPage = pdf.addPage([842, 595]);
    pointsPage.drawRectangle({
      x: 0,
      y: 0,
      width: 842,
      height: 595,
      color: rgb(0.043, 0.071, 0.125),
    });
    pointsPage.drawText("POINT ECONOMICS", {
      x: 44,
      y: 538,
      size: 10,
      font: bold,
      color: rgb(0.91, 0.74, 0.35),
    });
    pointsPage.drawText("Captação reconciliada com o estudo", {
      x: 44,
      y: 506,
      size: 22,
      font: bold,
      color: rgb(0.91, 0.93, 0.96),
    });
    const pointMetrics = [
      ["PONTOS", String(snapshot.pointEconomics.totals.pointCount)],
      ["VENDAS", snapshot.pointEconomics.totals.production.totalSales],
      ["HEALTHY D90", snapshot.pointEconomics.totals.production.healthyD90],
      ["CONTRIB. INCREMENTAL", snapshot.pointEconomics.totals.value.incrementalNetContribution],
    ];
    pointMetrics.forEach(([label, value], index) => {
      const x = 44 + index * 192;
      pointsPage.drawRectangle({
        x,
        y: 375,
        width: 176,
        height: 92,
        color: rgb(0.067, 0.11, 0.19),
        borderColor: rgb(0.15, 0.2, 0.28),
        borderWidth: 1,
      });
      pointsPage.drawText(label, { x: x + 14, y: 442, size: 8, font: bold, color: rgb(0.91, 0.74, 0.35) });
      pointsPage.drawText(value, { x: x + 14, y: 407, size: 14, font: bold, color: rgb(0.91, 0.93, 0.96), maxWidth: 148 });
    });
    pointsPage.drawText("Pontos de captação", {
      x: 44,
      y: 334,
      size: 14,
      font: bold,
      color: rgb(0.91, 0.93, 0.96),
    });
    snapshot.pointEconomics.points.slice(0, 6).forEach((point, index) => {
      const y = 292 - index * 42;
      pointsPage.drawText(`${point.name} · ${point.channel} · ${point.classification}`, {
        x: 44,
        y,
        size: 10,
        font: bold,
        color: rgb(0.91, 0.93, 0.96),
        maxWidth: 380,
      });
      pointsPage.drawText(
        `Qualificados ${point.funnel.qualified} · Tours ${point.funnel.tours} · Vendas ${point.production.totalSales} · Healthy D90 ${point.production.healthyD90}`,
        { x: 430, y, size: 8, font: regular, color: rgb(0.58, 0.63, 0.71), maxWidth: 360 }
      );
      pointsPage.drawText(
        `Custo mensal ${point.costs.monthlyOperating} · Contribuição incremental ${point.value.incrementalNetContribution} · ROI ${display(point.unitEconomics.monthlyRoi)}x · Payback ${display(point.unitEconomics.paybackMonths)} meses`,
        { x: 44, y: y - 15, size: 8, font: regular, color: rgb(0.58, 0.63, 0.71), maxWidth: 746 }
      );
    });
    pointsPage.drawText(
      `Reconciliação · produção ${snapshot.pointEconomics.totals.reconciliation.productionDifference} · valor de vendas ${snapshot.pointEconomics.totals.reconciliation.salesValueDifference}`,
      { x: 44, y: 28, size: 8, font: regular, color: rgb(0.58, 0.63, 0.71) }
    );
    pointsPage.drawText(`${modelProvenance.identityLine} · ${modelProvenance.technicalLine}`, {
      x: 44, y: 14, size: 5.2, font: bold, color: rgb(0.91, 0.74, 0.35), maxWidth: 754,
    });
  }
  if (snapshot.commercialOperations) {
    const operationsPage = pdf.addPage([842, 595]);
    operationsPage.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: rgb(0.043, 0.071, 0.125) });
    operationsPage.drawText("COMMERCIAL OPERATIONS", { x: 44, y: 538, size: 10, font: bold, color: rgb(0.91, 0.74, 0.35) });
    operationsPage.drawText("Sala, workforce, treinamento e comissões", { x: 44, y: 506, size: 22, font: bold, color: rgb(0.91, 0.93, 0.96) });
    const operationsCosts = decimalSum(snapshot.projections.map(row => row.commercialOperationsCosts));
    const commissionPayments = decimalSum(snapshot.projections.map(row => row.commissionPayments));
    const operationsMetrics = [
      ["TOURS / MÊS", snapshot.commercialOperations.room.capacity.limitedToursMonthly],
      ["VENDAS / MÊS", snapshot.commercialOperations.room.capacity.limitedSalesMonthly],
      ["CUSTO OPERAÇÕES", operationsCosts],
      ["COMISSÕES PAGAS", commissionPayments],
    ];
    operationsMetrics.forEach(([label, value], index) => {
      const x = 44 + index * 192;
      operationsPage.drawRectangle({ x, y: 375, width: 176, height: 92, color: rgb(0.067, 0.11, 0.19), borderColor: rgb(0.15, 0.2, 0.28), borderWidth: 1 });
      operationsPage.drawText(label, { x: x + 14, y: 442, size: 8, font: bold, color: rgb(0.91, 0.74, 0.35) });
      operationsPage.drawText(value, { x: x + 14, y: 407, size: 14, font: bold, color: rgb(0.91, 0.93, 0.96), maxWidth: 148 });
    });
    operationsPage.drawText(
      `Gargalos · tours ${snapshot.commercialOperations.room.bottlenecks.tours} · vendas ${snapshot.commercialOperations.room.bottlenecks.sales}`,
      { x: 44, y: 336, size: 11, font: bold, color: rgb(0.91, 0.93, 0.96) }
    );
    const rows = snapshot.commercialOperations.months.slice(0, 6);
    rows.forEach((month, index) => {
      const workforce = snapshot.commercialOperations!.workforce.months[index];
      const projection = snapshot.projections[index];
      const y = 296 - index * 34;
      operationsPage.drawText(
        `M${month.month + 1} · HC ${workforce?.activeHeadcount ?? "N/D"} · FTE ${workforce?.effectiveFte ?? "N/D"} · tours ${month.tourCapacity} · vendas ${month.salesCapacity}`,
        { x: 44, y, size: 9, font: bold, color: rgb(0.91, 0.93, 0.96), maxWidth: 400 }
      );
      operationsPage.drawText(
        `Workforce ${month.incrementalWorkforceCost} · treino ${month.incrementalTrainingCost} · caixa ${projection?.commercialOperationsCosts ?? "0"} · comissão ${projection?.commissionPayments ?? "0"}`,
        { x: 430, y, size: 8, font: regular, color: rgb(0.58, 0.63, 0.71), maxWidth: 360 }
      );
    });
    const training = snapshot.commercialOperations.training[0];
    if (training) operationsPage.drawText(
      `Treinamento ${training.trainingId} · ${training.role} · certificados ${training.summary.certifiedPeople} · produtivo M${training.summary.productiveMonth + 1} · custo ${training.summary.totalCostToProductive}`,
      { x: 44, y: 78, size: 8, font: regular, color: rgb(0.58, 0.63, 0.71), maxWidth: 746 }
    );
    operationsPage.drawText(
      `Ledger de comissões · competência ${snapshot.commissionLedger?.totals.accrued ?? "N/D"} · holdback ${snapshot.commissionLedger?.totals.held ?? "N/D"} · pagável ${snapshot.commissionLedger?.totals.payable ?? "N/D"}`,
      { x: 44, y: 48, size: 9, font: bold, color: rgb(0.91, 0.74, 0.35), maxWidth: 746 }
    );
    operationsPage.drawText(
      snapshot.commercialOperations.room.alerts[0]?.message ?? "Sem alertas críticos de capacidade.",
      { x: 44, y: 28, size: 8, font: regular, color: rgb(0.58, 0.63, 0.71), maxWidth: 746 }
    );
    operationsPage.drawText(`${modelProvenance.identityLine} · ${modelProvenance.technicalLine}`, {
      x: 44, y: 14, size: 5.2, font: bold, color: rgb(0.91, 0.74, 0.35), maxWidth: 754,
    });
  }
  return pdf.save();
}

export async function buildBoardroomPptx(
  snapshot: ExportableSnapshot
): Promise<Buffer> {
  const zip = new JSZip();
  const modelProvenance = visibleExportModelProvenance(snapshot);
  const compatibilityAuthority = compatibilityAuthorityVisibleLine(snapshot);
  const metrics = [
    ["VPL", display(snapshot.kpis.npv)],
    ["TIR ANUAL", display(snapshot.kpis.irrAnnual)],
    [
      "PAYBACK",
      snapshot.kpis.paybackMonths
        ? `${snapshot.kpis.paybackMonths} meses`
        : "N/D",
    ],
    ["CAIXA OPERACIONAL", display(snapshot.kpis.totalOperatingCashFlow)],
  ];
  const groups = `<p:sp><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;
  const slideShapes = [
    shape(2, "Background", 0, 0, 13.333, 7.5, NAVY),
    shape(3, "Header panel", 0.45, 0.4, 12.42, 1.8, PANEL, "", {
      line: "263750",
    }),
    shape(
      4,
      "Eyebrow",
      0.72,
      0.64,
      4.2,
      0.22,
      PANEL,
      "COMITÊ DE INVESTIMENTO",
      { color: GOLD, size: 800, bold: true, margin: 0 }
    ),
    shape(5, "Title", 0.72, 0.96, 7.2, 0.48, PANEL, "Decisão com memória", {
      color: LIGHT,
      size: 2700,
      bold: true,
      margin: 0,
    }),
    shape(
      6,
      "Subtitle",
      0.72,
      1.52,
      6.8,
      0.26,
      PANEL,
      "TGR Consulting · Snapshot autoritativo, validado e aprovado",
      { color: MUTED, size: 1100, margin: 0 }
    ),
    shape(
      7,
      "Hash",
      0.72,
      1.93,
      11.6,
      0.22,
      PANEL,
      modelProvenance.technicalLine,
      { color: GOLD, size: 560, bold: true, margin: 0 }
    ),
    shape(31, "Financial model", 0.72, 1.7, 8.8, 0.18, PANEL, modelProvenance.identityLine, {
      color: LIGHT, size: 720, bold: true, margin: 0,
    }),
    ...(compatibilityAuthority
      ? [shape(32, "Compatibility authority", 0.72, 2.2, 11.6, 0.18, PANEL, compatibilityAuthority, {
          color: GOLD, size: 520, bold: true, margin: 0,
        })]
      : []),
    ...metrics.flatMap(([label, value], index) => {
      const x = 0.45 + index * 3.12;
      return [
        shape(
          8 + index * 2,
          `Metric panel ${index + 1}`,
          x,
          2.55,
          2.85,
          1.35,
          PANEL,
          "",
          { line: "263750" }
        ),
        shape(
          9 + index * 2,
          `Metric ${label}`,
          x + 0.18,
          2.8,
          2.48,
          0.85,
          PANEL,
          `${label}\n${value}`,
          { color: LIGHT, size: 1100, bold: true, margin: 0.06 }
        ),
      ];
    }),
    shape(
      16,
      "Memory heading",
      0.45,
      4.28,
      4,
      0.28,
      NAVY,
      "MEMÓRIA DE CÁLCULO",
      { color: GOLD, size: 800, bold: true, margin: 0 }
    ),
    ...snapshot.memory
      .slice(0, 4)
      .map((memory, index) =>
        shape(
          17 + index,
          `Memory ${index + 1}`,
          0.45,
          4.72 + index * 0.52,
          12.42,
          0.4,
          PANEL,
          `${memory.label}: ${display(memory.value)}  |  ${memory.formulaId}@${memory.formulaVersion}  |  ${memory.explanation}`,
          {
            color: index === 0 ? LIGHT : MUTED,
            size: 760,
            margin: 0.08,
            line: "263750",
          }
        )
      ),
    ...(snapshot.exportMetadata
      ? [shape(
          30,
          "Export provenance",
          0.45,
          7.02,
          12.42,
          0.28,
          NAVY,
          `SNAPSHOT ${snapshot.exportMetadata.snapshotId} | VERSION ${snapshot.exportMetadata.versionId} | GERADO ${snapshot.exportMetadata.generatedAt} | AUTOR ${exportAuthor(snapshot.exportMetadata)} | ${snapshot.exportMetadata.lifecycleStatus}/${snapshot.exportMetadata.approvalStatus}`,
          { color: MUTED, size: 600, margin: 0 }
        )]
      : []),
  ].join("");
  const slide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>${groups}${slideShapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  const chapterSlide = (title: string, subtitle: string, rows: string[]) => {
    const shapes = [
      shape(2, "Background", 0, 0, 13.333, 7.5, NAVY),
      shape(3, "Title", 0.55, 0.45, 8.5, 0.55, NAVY, title, { color: LIGHT, size: 2500, bold: true, margin: 0 }),
      shape(4, "Subtitle", 0.55, 1.08, 10.5, 0.3, NAVY, subtitle, { color: MUTED, size: 980, margin: 0 }),
      ...rows.slice(0, 8).map((row, index) =>
        shape(
          5 + index,
          `${title} row ${index + 1}`,
          0.55,
          1.72 + index * 0.55,
          12.22,
          0.42,
          PANEL,
          row,
          { color: index === 0 ? LIGHT : MUTED, size: 760, margin: 0.07, line: "263750" }
        )
      ),
      shape(20, "Model provenance", 0.55, 6.95, 12.2, 0.2, NAVY, `${modelProvenance.identityLine} · ${modelProvenance.technicalLine}`, { color: GOLD, size: 520, bold: true, margin: 0 }),
    ].join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>${groups}${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  };
  const inputs = inputPayload(snapshot);
  const supplementalSlides = [
    chapterSlide(
      "Inputs e Proveniência",
      "Status, fonte e valor do snapshot exportado",
      inputs
        ? FINANCIAL_INPUT_KEYS.slice(0, 8).map(key => {
            const input = inputs[key];
            return `${key}: ${input.status === "provided" ? display(input.value ?? null) : "PENDENTE"} | ${input.sourceType} | ${input.sourceRef ?? "sem fonte"}`;
          })
        : ["Snapshot sem input payload", "Sem premissas fabricadas no artefato."],
    ),
    chapterSlide(
      "Monthly Projection",
      "Primeiros meses carregados do snapshot",
      snapshot.projections.length
        ? snapshot.projections.slice(0, 8).map(row =>
            `M${row.month}: vendas ${row.grossSales} | caixa ${row.operatingCashFlow} | acumulado ${row.cumulativeCashFlow}`
          )
        : ["Snapshot sem projeção mensal carregada."],
    ),
    chapterSlide(
      "Scenarios",
      "Cenários anexados ou estado honesto de ausência",
      scenarioComparisonRows(snapshot),
    ),
    chapterSlide(
      "Formulas",
      "Memória versionada de cálculo",
      snapshot.memory.length
        ? snapshot.memory.slice(0, 8).map(memory =>
            `${memory.formulaId}@${memory.formulaVersion} | ${memory.label}: ${display(memory.value)}`
          )
        : ["Snapshot sem memória de fórmulas carregada."],
    ),
  ];
  const pointSlideShapes = snapshot.pointEconomics
    ? [
        shape(2, "Background", 0, 0, 13.333, 7.5, NAVY),
        shape(3, "Title", 0.55, 0.45, 7.5, 0.55, NAVY, "Point Economics", { color: LIGHT, size: 2600, bold: true, margin: 0 }),
        shape(4, "Subtitle", 0.55, 1.08, 8, 0.25, NAVY, "Captação reconciliada com o motor financeiro", { color: MUTED, size: 1000, margin: 0 }),
        ...[
          ["PONTOS", String(snapshot.pointEconomics.totals.pointCount)],
          ["VENDAS", snapshot.pointEconomics.totals.production.totalSales],
          ["HEALTHY D90", snapshot.pointEconomics.totals.production.healthyD90],
          ["CONTRIB. INCREMENTAL", snapshot.pointEconomics.totals.value.incrementalNetContribution],
        ].flatMap(([label, value], index) => {
          const x = 0.55 + index * 3.1;
          return [
            shape(5 + index * 2, `Point metric panel ${index + 1}`, x, 1.62, 2.82, 1.15, PANEL, "", { line: "263750" }),
            shape(6 + index * 2, `Point metric ${label}`, x + 0.14, 1.84, 2.52, 0.72, PANEL, `${label}\n${value}`, { color: LIGHT, size: 980, bold: true, margin: 0.04 }),
          ];
        }),
        shape(13, "Point rows heading", 0.55, 3.08, 4, 0.25, NAVY, "PONTOS DE CAPTAÇÃO", { color: GOLD, size: 800, bold: true, margin: 0 }),
        ...snapshot.pointEconomics.points.slice(0, 5).map((point, index) =>
          shape(
            14 + index,
            `Point ${index + 1}`,
            0.55,
            3.48 + index * 0.62,
            12.22,
            0.48,
            PANEL,
            `${point.name} · ${point.channel} · ${point.classification}  |  Qualificados ${point.funnel.qualified} · Tours ${point.funnel.tours} · Vendas ${point.production.totalSales} · Healthy D90 ${point.production.healthyD90}  |  Contribuição incremental ${point.value.incrementalNetContribution}`,
            { color: index === 0 ? LIGHT : MUTED, size: 720, margin: 0.07, line: "263750" }
          )
        ),
        shape(30, "Model provenance", 0.55, 6.95, 12.2, 0.2, NAVY, `${modelProvenance.identityLine} · ${modelProvenance.technicalLine}`, { color: GOLD, size: 520, bold: true, margin: 0 }),
      ].join("")
    : null;
  const pointSlide = pointSlideShapes
    ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>${groups}${pointSlideShapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
    : null;
  const pointSlideNumber = supplementalSlides.length + 2;
  const operationsSlideNumber = pointSlide ? pointSlideNumber + 1 : pointSlideNumber;
  const operationsSlideShapes = snapshot.commercialOperations
    ? [
        shape(2, "Background", 0, 0, 13.333, 7.5, NAVY),
        shape(3, "Title", 0.55, 0.45, 8, 0.55, NAVY, "Commercial Operations", { color: LIGHT, size: 2600, bold: true, margin: 0 }),
        shape(4, "Subtitle", 0.55, 1.08, 9, 0.25, NAVY, "Sala, workforce, treinamento e comissões reconciliados com o caixa", { color: MUTED, size: 1000, margin: 0 }),
        ...[
          ["TOURS / MÊS", snapshot.commercialOperations.room.capacity.limitedToursMonthly],
          ["VENDAS / MÊS", snapshot.commercialOperations.room.capacity.limitedSalesMonthly],
          ["CUSTO OPERAÇÕES", decimalSum(snapshot.projections.map(row => row.commercialOperationsCosts))],
          ["COMISSÕES PAGAS", decimalSum(snapshot.projections.map(row => row.commissionPayments))],
        ].flatMap(([label, value], index) => {
          const x = 0.55 + index * 3.1;
          return [
            shape(5 + index * 2, `Operations metric panel ${index + 1}`, x, 1.62, 2.82, 1.15, PANEL, "", { line: "263750" }),
            shape(6 + index * 2, `Operations metric ${label}`, x + 0.14, 1.84, 2.52, 0.72, PANEL, `${label}\n${value}`, { color: LIGHT, size: 980, bold: true, margin: 0.04 }),
          ];
        }),
        shape(13, "Operations bottlenecks", 0.55, 3.05, 12.22, 0.36, PANEL, `Gargalos · tours ${snapshot.commercialOperations.room.bottlenecks.tours} · vendas ${snapshot.commercialOperations.room.bottlenecks.sales}  |  ${snapshot.commercialOperations.room.alerts[0]?.message ?? "Sem alertas críticos"}`, { color: GOLD, size: 780, bold: true, margin: 0.07, line: "263750" }),
        ...snapshot.commercialOperations.months.slice(0, 4).map((month, index) => {
          const workforce = snapshot.commercialOperations!.workforce.months[index];
          const projection = snapshot.projections[index];
          return shape(
            14 + index,
            `Operations month ${month.month + 1}`,
            0.55,
            3.62 + index * 0.58,
            12.22,
            0.44,
            PANEL,
            `M${month.month + 1} · HC ${workforce?.activeHeadcount ?? "N/D"} · FTE ${workforce?.effectiveFte ?? "N/D"} · tours ${month.tourCapacity} · vendas ${month.salesCapacity}  |  workforce ${month.incrementalWorkforceCost} · treinamento ${month.incrementalTrainingCost} · custo no caixa ${projection?.commercialOperationsCosts ?? "0"} · comissão ${projection?.commissionPayments ?? "0"}`,
            { color: index === 0 ? LIGHT : MUTED, size: 700, margin: 0.07, line: "263750" }
          );
        }),
        shape(
          18,
          "Operations training and commissions",
          0.55,
          6.15,
          12.22,
          0.68,
          PANEL,
          `Treinamento ${snapshot.commercialOperations.training[0]?.trainingId ?? "N/D"} · ${snapshot.commercialOperations.training[0]?.role ?? "sem plano"} · certificados ${snapshot.commercialOperations.training[0]?.summary.certifiedPeople ?? "N/D"}  |  Ledger de comissões · competência ${snapshot.commissionLedger?.totals.accrued ?? "N/D"} · holdback ${snapshot.commissionLedger?.totals.held ?? "N/D"} · pagável ${snapshot.commissionLedger?.totals.payable ?? "N/D"}`,
          { color: LIGHT, size: 760, bold: true, margin: 0.08, line: "263750" }
        ),
        shape(30, "Model provenance", 0.55, 6.95, 12.2, 0.2, NAVY, `${modelProvenance.identityLine} · ${modelProvenance.technicalLine}`, { color: GOLD, size: 520, bold: true, margin: 0 }),
      ].join("")
    : null;
  const operationsSlide = operationsSlideShapes
    ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>${groups}${operationsSlideShapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
    : null;
  const slideFiles = [slide, ...supplementalSlides];
  if (pointSlide) slideFiles.push(pointSlide);
  if (operationsSlide) slideFiles.push(operationsSlide);
  const slideContentTypes = slideFiles
    .map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    .join("");
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slideContentTypes}<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const presentationSlideIds = slideFiles
    .map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`)
    .join("");
  const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${presentationSlideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`;
  const presentationSlideRels = slideFiles
    .map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`)
    .join("");
  const presentationRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${presentationSlideRels}<Relationship Id="rId${slideFiles.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/><Relationship Id="rId${slideFiles.length + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId${slideFiles.length + 4}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`;
  const bareSpTree = `<p:spTree>${groups}</p:spTree>`;
  const master = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="TGR Master">${bareSpTree}</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles/></p:sldMaster>`;
  const layout = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank">${bareSpTree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  const masterRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;
  const layoutRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
  const slideRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
  const theme = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="TGR"><a:themeElements><a:clrScheme name="TGR"><a:dk1><a:srgbClr val="0B1220"/></a:dk1><a:lt1><a:srgbClr val="E8EDF5"/></a:lt1><a:dk2><a:srgbClr val="111C2F"/></a:dk2><a:lt2><a:srgbClr val="FFFFFF"/></a:lt2><a:accent1><a:srgbClr val="E8BD5A"/></a:accent1><a:accent2><a:srgbClr val="5EEAD4"/></a:accent2><a:accent3><a:srgbClr val="93A0B4"/></a:accent3><a:accent4><a:srgbClr val="263750"/></a:accent4><a:accent5><a:srgbClr val="22C55E"/></a:accent5><a:accent6><a:srgbClr val="F59E0B"/></a:accent6><a:hlink><a:srgbClr val="5EEAD4"/></a:hlink><a:folHlink><a:srgbClr val="93A0B4"/></a:folHlink></a:clrScheme><a:fontScheme name="TGR"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="TGR"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`;
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", rootRels);
  zip.file("ppt/presentation.xml", presentation);
  zip.file("ppt/_rels/presentation.xml.rels", presentationRels);
  slideFiles.forEach((file, index) => {
    zip.file(`ppt/slides/slide${index + 1}.xml`, file);
    zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, slideRels);
  });
  zip.file("ppt/slideMasters/slideMaster1.xml", master);
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", masterRels);
  zip.file("ppt/slideLayouts/slideLayout1.xml", layout);
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", layoutRels);
  zip.file("ppt/theme/theme1.xml", theme);
  zip.file(
    "ppt/presProps.xml",
    `<?xml version="1.0"?><p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`
  );
  zip.file(
    "ppt/viewProps.xml",
    `<?xml version="1.0"?><p:viewPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`
  );
  zip.file(
    "ppt/tableStyles.xml",
    `<?xml version="1.0"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def=""/>`
  );
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>${xml(exportAuthor(snapshot.exportMetadata))}</dc:creator><dc:title>Boardroom Snapshot</dc:title><dc:subject>${xml(exportProvenance(snapshot))}</dc:subject>${snapshot.exportMetadata ? `<dcterms:created xsi:type="dcterms:W3CDTF">${xml(snapshot.exportMetadata.generatedAt)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${xml(snapshot.exportMetadata.generatedAt)}</dcterms:modified>` : ""}</cp:coreProperties>`
  );
  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>TGR Consulting</Application></Properties>`
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function buildBoardroomXlsx(
  snapshot: ExportableSnapshot
): Promise<Buffer> {
  const zip = new JSZip();
  const columnName = (index: number) => String.fromCharCode(65 + index);
  const inputs = inputPayload(snapshot);
  const inputsRows = [
    xlsxRow(1, [
      xlsxTextCell("A1", "Input"),
      xlsxTextCell("B1", "Status"),
      xlsxTextCell("C1", "Valor"),
      xlsxTextCell("D1", "Tipo de fonte"),
      xlsxTextCell("E1", "Fonte"),
    ]),
    ...(inputs
      ? FINANCIAL_INPUT_KEYS.map((key, offset) => {
          const row = offset + 2;
          const input: FinancialInput = inputs[key];
          return xlsxRow(row, [
            xlsxTextCell(`A${row}`, key),
            xlsxTextCell(`B${row}`, input.status),
            input.status === "provided"
              ? xlsxNumberCell(`C${row}`, input.value)
              : xlsxTextCell(`C${row}`, "PENDENTE"),
            xlsxTextCell(`D${row}`, input.sourceType),
            xlsxTextCell(`E${row}`, input.sourceRef ?? "N/D"),
          ]);
        })
      : [
          xlsxRow(2, [
            xlsxTextCell("A2", "Snapshot sem input payload"),
            xlsxTextCell("B2", snapshot.status),
            xlsxTextCell("E2", "Sem premissas fabricadas"),
          ]),
        ]),
  ].join("");
  const provenanceRows = [
    xlsxRow(1, [
      xlsxTextCell("A1", "Domínio"),
      xlsxTextCell("B1", "Registro"),
      xlsxTextCell("C1", "Status"),
      xlsxTextCell("D1", "Tipo de fonte"),
      xlsxTextCell("E1", "Fonte / evidência"),
    ]),
    ...domainRecords(snapshot).map(([domain, label, status, sourceType, sourceRef], offset) => {
      const row = offset + 2;
      return xlsxRow(row, [
        xlsxTextCell(`A${row}`, domain),
        xlsxTextCell(`B${row}`, label),
        xlsxTextCell(`C${row}`, status),
        xlsxTextCell(`D${row}`, sourceType),
        xlsxTextCell(`E${row}`, sourceRef),
      ]);
    }),
  ].join("");
  const projectionColumns: Array<
    [keyof FinancialCalculation["projections"][number], string]
  > = [
    ["month", "Mes"],
    ["qualifiedCouples", "Casais qualificados"],
    ["contracts", "Contratos"],
    ["grossSales", "Venda bruta"],
    ["grossEntryGenerated", "Entrada gerada"],
    ["grossEntrySettled", "Entrada liquidada"],
    ["grossReceivablesGenerated", "Recebiveis gerados"],
    ["grossReceivablesSettled", "Recebiveis liquidados"],
    ["installmentCollections", "Parcelas liquidas"],
    ["canceledReceivables", "Recebiveis cancelados"],
    ["delinquentBalance", "Saldo inadimplente"],
    ["curedCollections", "Curas"],
    ["writtenOffBalance", "Write-off"],
    ["healthyD90", "Healthy D90"],
    ["paymentFees", "Taxas"],
    ["netCollections", "Entrada liquida"],
    ["variableCosts", "Custos variaveis"],
    ["partnerShare", "Repasse parceiro"],
    ["fixedCosts", "Custos fixos"],
    ["commercialOperationsCosts", "Custos de Commercial Operations"],
    ["commissionPayments", "Pagamentos de comissão"],
    ["payroll", "Folha"],
    ["preOperationalInvestment", "Investimento pre-operacional"],
    ["operatingCashFlow", "Fluxo de caixa"],
    ["cumulativeCashFlow", "Caixa acumulado"],
    ["discountedCashFlow", "Fluxo descontado"],
  ];
  const projectionRows = [
    xlsxRow(
      1,
      projectionColumns.map(([, label], index) =>
        xlsxTextCell(`${columnName(index)}1`, label)
      )
    ),
    ...snapshot.projections.map((projection, offset) => {
      const row = offset + 2;
      return xlsxRow(
        row,
        projectionColumns.map(([key], index) =>
          xlsxNumberCell(`${columnName(index)}${row}`, projection[key])
        )
      );
    }),
  ].join("");
  const comparison = snapshot.scenarioComparison;
  const scenarioRows = [
    xlsxRow(1, [
      xlsxTextCell("A1", "Cenário"),
      xlsxTextCell("B1", "Tipo"),
      xlsxTextCell("C1", "Estado"),
      xlsxTextCell("D1", "Snapshot ID"),
      xlsxTextCell("E1", "Snapshot Hash"),
      xlsxTextCell("F1", "VPL"),
      xlsxTextCell("G1", "Caixa operacional"),
      xlsxTextCell("H1", "Fonte / seleção"),
      xlsxTextCell("I1", "Comparabilidade"),
      xlsxTextCell("J1", "Horizonte"),
      xlsxTextCell("K1", "Data-base"),
    ]),
    ...(comparison && comparison.entries.length
      ? [
          xlsxRow(2, [
            xlsxTextCell("A2", "Export pack hash"),
            xlsxTextCell("B2", snapshot.exportPackHash),
            xlsxTextCell("C2", "Scenario selection hash"),
            xlsxTextCell("D2", comparison.selectionHash),
            xlsxTextCell("E2", comparison.baseSnapshotHash),
            xlsxTextCell("H2", comparison.source),
          ]),
          ...comparison.entries.map((entry, offset) => {
            const row = offset + 3;
            return xlsxRow(row, [
              xlsxTextCell(`A${row}`, entry.label),
              xlsxTextCell(`B${row}`, entry.kind),
              xlsxTextCell(`C${row}`, entry.state),
              xlsxTextCell(`D${row}`, entry.snapshotId ?? "SEM SNAPSHOT"),
              xlsxTextCell(`E${row}`, entry.snapshotHash ?? "SEM HASH"),
              xlsxNumberCell(`F${row}`, entry.kpis?.npv),
              xlsxNumberCell(`G${row}`, entry.kpis?.totalOperatingCashFlow),
              xlsxTextCell(`H${row}`, entry.reason ?? "Snapshot persistido"),
              xlsxTextCell(`I${row}`, entry.comparisonStatus),
              xlsxNumberCell(`J${row}`, entry.horizonMonths),
              xlsxNumberCell(`K${row}`, entry.asOfMonth),
            ]);
          }),
        ]
      : [
          xlsxRow(2, [
            xlsxTextCell("A2", "Snapshot sem cenários anexados"),
            xlsxTextCell("B2", "sem_dados"),
            xlsxTextCell("H2", "Sem cenário inventado"),
          ]),
        ]),
  ].join("");
  const formulaRows = [
    xlsxRow(1, [
      xlsxTextCell("A1", "KPI"),
      xlsxTextCell("B1", "Valor"),
      xlsxTextCell("C1", "Formula"),
      xlsxTextCell("D1", "Expressao"),
      xlsxTextCell("E1", "Dependencias"),
      xlsxTextCell("F1", "Explicacao"),
    ]),
    ...(snapshot.memory.length
      ? snapshot.memory.map((memory, offset) => {
          const row = offset + 2;
          return xlsxRow(row, [
            xlsxTextCell(`A${row}`, memory.label),
            xlsxNumberCell(`B${row}`, memory.value),
            xlsxTextCell(`C${row}`, `${memory.formulaId}@${memory.formulaVersion}`),
            xlsxTextCell(`D${row}`, memory.expression),
            xlsxTextCell(`E${row}`, memory.dependencies.join(", ")),
            xlsxTextCell(`F${row}`, memory.explanation),
          ]);
        })
      : [
          xlsxRow(2, [
            xlsxTextCell("A2", "Snapshot sem memória de fórmulas carregada"),
          ]),
        ]),
  ].join("");
  const visibleModel = visibleExportModelProvenance(snapshot);
  const modelOutputEntries = [
    ["Financial model mode", visibleModel.modeId],
    ["Financial model label", visibleModel.label],
    ["Formula Set", snapshot.formulaSetVersion],
    ["Engine", snapshot.engineVersion],
    ["Snapshot hash", snapshot.snapshotHash],
  ] as const;
  const outputTailStart = KPI_ROWS.length +
    (snapshot.domainBlockers?.length ?? 0) +
    (snapshot.domainInvalidities?.length ?? 0) +
    2;
  const outputRows = [
    xlsxRow(1, [
      xlsxTextCell("A1", "Output"),
      xlsxTextCell("B1", "Valor"),
      xlsxTextCell("C1", "Status do snapshot"),
      xlsxTextCell("D1", "Hash"),
      xlsxTextCell("E1", "Observação"),
    ]),
    ...KPI_ROWS.map(([label, key], offset) => {
      const row = offset + 2;
      return xlsxRow(row, [
        xlsxTextCell(`A${row}`, label),
        xlsxNumberCell(`B${row}`, snapshot.kpis[key]),
        xlsxTextCell(`C${row}`, snapshot.status),
        xlsxTextCell(`D${row}`, snapshot.snapshotHash),
        xlsxTextCell(`E${row}`, snapshot.missingInputKeys.join(", ")),
      ]);
    }),
    ...(snapshot.domainBlockers ?? []).map((blocker, offset) => {
      const row = KPI_ROWS.length + offset + 2;
      return xlsxRow(row, [
        xlsxTextCell(`A${row}`, "Domain blocker"),
        xlsxTextCell(`E${row}`, blocker),
      ]);
    }),
    ...(snapshot.domainInvalidities ?? []).map((invalidity, offset) => {
      const row = KPI_ROWS.length + (snapshot.domainBlockers?.length ?? 0) + offset + 2;
      return xlsxRow(row, [
        xlsxTextCell(`A${row}`, "Domain invalidity"),
        xlsxTextCell(`E${row}`, invalidity),
      ]);
    }),
    ...modelOutputEntries.map(([label, value], offset) => {
      const row = outputTailStart + offset;
      return xlsxRow(row, [
        xlsxTextCell(`A${row}`, label),
        xlsxTextCell(`B${row}`, value),
        xlsxTextCell(`C${row}`, snapshot.status),
        xlsxTextCell(`D${row}`, snapshot.snapshotHash),
      ]);
    }),
    ...(snapshot.exportMetadata
      ? [
          ["Snapshot ID", snapshot.exportMetadata.snapshotId],
          ["Version ID", snapshot.exportMetadata.versionId],
          ["Generated at", snapshot.exportMetadata.generatedAt],
          ["Generated by", exportAuthor(snapshot.exportMetadata)],
          ["Lifecycle", snapshot.exportMetadata.lifecycleStatus],
          ["Approval", snapshot.exportMetadata.approvalStatus],
          ["Export pack hash", snapshot.exportPackHash],
        ].map(([label, value], offset) => {
          const row = outputTailStart + modelOutputEntries.length + offset;
          return xlsxRow(row, [
            xlsxTextCell(`A${row}`, label),
            xlsxTextCell(`B${row}`, value),
            xlsxTextCell(`C${row}`, snapshot.status),
            xlsxTextCell(`D${row}`, snapshot.snapshotHash),
          ]);
        })
      : []),
  ].join("");
  const pointHeaders = [
    "Escopo",
    "ID do ponto / quantidade",
    "Nome",
    "Canal",
    "Classificação",
    "Qualificados",
    "Tours",
    "Vendas",
    "Healthy D90",
    "Ativação",
    "Custo operacional mensal",
    "Contribuição incremental líquida",
    "ROI mensal",
    "Payback (meses)",
    "CAPEX incremental",
    "OPEX incremental",
    "Diferença de produção",
    "Diferença de valor de vendas",
    "Drivers",
  ];
  const pointRows = [
    xlsxRow(
      1,
      pointHeaders.map((label, index) =>
        xlsxTextCell(`${columnName(index)}1`, label)
      )
    ),
    ...(snapshot.pointEconomics
      ? [
          xlsxRow(2, [
            xlsxTextCell("A2", "TOTAL"),
            xlsxNumberCell("B2", snapshot.pointEconomics.totals.pointCount),
            xlsxTextCell("C2", "Carteira de pontos"),
            xlsxTextCell("D2", "Todos os canais"),
            xlsxTextCell(
              "E2",
              `SCALE ${snapshot.pointEconomics.totals.classificationCounts.SCALE} · OPTIMIZE ${snapshot.pointEconomics.totals.classificationCounts.OPTIMIZE} · KILL ${snapshot.pointEconomics.totals.classificationCounts.KILL}`
            ),
            xlsxNumberCell("F2", snapshot.pointEconomics.totals.funnel.qualified),
            xlsxNumberCell("G2", snapshot.pointEconomics.totals.funnel.tours),
            xlsxNumberCell("H2", snapshot.pointEconomics.totals.production.totalSales),
            xlsxNumberCell("I2", snapshot.pointEconomics.totals.production.healthyD90),
            xlsxNumberCell("J2", snapshot.pointEconomics.totals.cashflow.totalActivationCost),
            xlsxNumberCell("K2", snapshot.pointEconomics.totals.cashflow.totalMonthlyOperatingCost),
            xlsxNumberCell("L2", snapshot.pointEconomics.totals.value.incrementalNetContribution),
            xlsxTextCell("M2", "N/D"),
            xlsxTextCell("N2", "N/D"),
            xlsxNumberCell("O2", snapshot.pointEconomics.totals.cashflow.incrementalCapex),
            xlsxNumberCell("P2", snapshot.pointEconomics.totals.cashflow.incrementalMonthlyOpex),
            xlsxNumberCell("Q2", snapshot.pointEconomics.totals.reconciliation.productionDifference),
            xlsxNumberCell("R2", snapshot.pointEconomics.totals.reconciliation.salesValueDifference),
            xlsxTextCell("S2", "Agregado reconciliado"),
          ]),
          ...snapshot.pointEconomics.points.map((point, offset) => {
            const row = offset + 3;
            return xlsxRow(row, [
              xlsxTextCell(`A${row}`, "PONTO"),
              xlsxTextCell(`B${row}`, point.pointId),
              xlsxTextCell(`C${row}`, point.name),
              xlsxTextCell(`D${row}`, point.channel),
              xlsxTextCell(`E${row}`, point.classification),
              xlsxNumberCell(`F${row}`, point.funnel.qualified),
              xlsxNumberCell(`G${row}`, point.funnel.tours),
              xlsxNumberCell(`H${row}`, point.production.totalSales),
              xlsxNumberCell(`I${row}`, point.production.healthyD90),
              xlsxNumberCell(`J${row}`, point.costs.activation),
              xlsxNumberCell(`K${row}`, point.costs.monthlyOperating),
              xlsxNumberCell(`L${row}`, point.value.incrementalNetContribution),
              xlsxNumberCell(`M${row}`, point.unitEconomics.monthlyRoi),
              xlsxNumberCell(`N${row}`, point.unitEconomics.paybackMonths),
              xlsxNumberCell(`O${row}`, point.cashflow.incrementalCapex),
              xlsxNumberCell(`P${row}`, point.cashflow.incrementalMonthlyOpex),
              xlsxNumberCell(`Q${row}`, point.reconciliation.productionDifference),
              xlsxNumberCell(`R${row}`, point.reconciliation.salesValueDifference),
              xlsxTextCell(`S${row}`, point.drivers.map(driver => driver.message).join(" | ")),
            ]);
          }),
        ]
      : [
          xlsxRow(2, [
            xlsxTextCell("A2", "SEM DADOS"),
            xlsxTextCell("C2", "Snapshot sem Point Economics"),
          ]),
        ]),
  ].join("");
  const operationsHeaders = [
    "Escopo",
    "Mês / ID",
    "Papel / gargalo",
    "Capacidade tours",
    "Capacidade vendas",
    "Headcount ativo",
    "FTE efetivo",
    "Workforce incremental",
    "Treinamento incremental",
    "Operações esperadas",
    "Operações na projeção",
    "Diferença operações",
    "Comissão no ledger",
    "Comissão na projeção",
    "Diferença comissão",
    "Detalhe / status",
  ];
  const operationsRows: string[] = [
    xlsxRow(1, operationsHeaders.map((label, index) =>
      xlsxTextCell(`${columnName(index)}1`, label)
    )),
  ];
  let operationsRowIndex = 2;
  if (snapshot.commercialOperations) {
    const projectionMonths = new Set(snapshot.projections.map(row => row.month));
    const operationsExpectedTotal = decimalSum(snapshot.commercialOperations.months.map(row => row.incrementalOperatingCost));
    const operationsProjectedTotal = decimalSum(snapshot.projections.map(row => row.commercialOperationsCosts));
    const commissionExpectedTotal = decimalSum(
      (snapshot.commissionLedger?.payments ?? [])
        .filter(payment => projectionMonths.has(payment.month))
        .map(payment => payment.amount)
    );
    const commissionProjectedTotal = decimalSum(snapshot.projections.map(row => row.commissionPayments));
    operationsRows.push(xlsxRow(operationsRowIndex++, [
      xlsxTextCell("A2", "TOTAL"),
      xlsxNumberCell("B2", snapshot.horizonMonths),
      xlsxTextCell("C2", `Tours ${snapshot.commercialOperations.room.bottlenecks.tours} · vendas ${snapshot.commercialOperations.room.bottlenecks.sales}`),
      xlsxNumberCell("D2", snapshot.commercialOperations.room.capacity.limitedToursMonthly),
      xlsxNumberCell("E2", snapshot.commercialOperations.room.capacity.limitedSalesMonthly),
      xlsxTextCell("F2", "N/D"),
      xlsxTextCell("G2", "N/D"),
      xlsxNumberCell("H2", decimalSum(snapshot.commercialOperations.months.map(row => row.incrementalWorkforceCost))),
      xlsxNumberCell("I2", decimalSum(snapshot.commercialOperations.months.map(row => row.incrementalTrainingCost))),
      xlsxNumberCell("J2", operationsExpectedTotal),
      xlsxNumberCell("K2", operationsProjectedTotal),
      xlsxNumberCell("L2", decimalDifference(operationsProjectedTotal, operationsExpectedTotal)),
      xlsxNumberCell("M2", commissionExpectedTotal),
      xlsxNumberCell("N2", commissionProjectedTotal),
      xlsxNumberCell("O2", decimalDifference(commissionProjectedTotal, commissionExpectedTotal)),
      xlsxTextCell("P2", `Ledger · competência ${snapshot.commissionLedger?.totals.accrued ?? "N/D"} · holdback ${snapshot.commissionLedger?.totals.held ?? "N/D"} · pagável ${snapshot.commissionLedger?.totals.payable ?? "N/D"}`),
    ]));
    const commissionByMonth = new Map(
      (snapshot.commissionLedger?.payments ?? []).map(payment => [payment.month, payment.amount])
    );
    snapshot.commercialOperations.months.forEach((month, index) => {
      const row = operationsRowIndex++;
      const financialMonth = month.month + 1;
      const workforce = snapshot.commercialOperations!.workforce.months[index];
      const projection = snapshot.projections.find(item => item.month === financialMonth);
      const projectedOperations = projection?.commercialOperationsCosts ?? "0";
      const expectedCommission = commissionByMonth.get(financialMonth) ?? "0";
      const projectedCommission = projection?.commissionPayments ?? "0";
      operationsRows.push(xlsxRow(row, [
        xlsxTextCell(`A${row}`, "MÊS"),
        xlsxNumberCell(`B${row}`, financialMonth),
        xlsxTextCell(`C${row}`, workforce?.cohorts.map(cohort => cohort.role).join(", ") ?? "N/D"),
        xlsxNumberCell(`D${row}`, month.tourCapacity),
        xlsxNumberCell(`E${row}`, month.salesCapacity),
        xlsxNumberCell(`F${row}`, workforce?.activeHeadcount),
        xlsxNumberCell(`G${row}`, workforce?.effectiveFte),
        xlsxNumberCell(`H${row}`, month.incrementalWorkforceCost),
        xlsxNumberCell(`I${row}`, month.incrementalTrainingCost),
        xlsxNumberCell(`J${row}`, month.incrementalOperatingCost),
        xlsxNumberCell(`K${row}`, projectedOperations),
        xlsxNumberCell(`L${row}`, decimalDifference(projectedOperations, month.incrementalOperatingCost)),
        xlsxNumberCell(`M${row}`, expectedCommission),
        xlsxNumberCell(`N${row}`, projectedCommission),
        xlsxNumberCell(`O${row}`, decimalDifference(projectedCommission, expectedCommission)),
        xlsxTextCell(`P${row}`, "Mês operacional reconciliado com a projeção"),
      ]));
    });
    const roomRow = operationsRowIndex++;
    operationsRows.push(xlsxRow(roomRow, [
      xlsxTextCell(`A${roomRow}`, "SALA"),
      xlsxTextCell(`B${roomRow}`, "ROOM"),
      xlsxTextCell(`C${roomRow}`, `Tours ${snapshot.commercialOperations.room.bottlenecks.tours} · vendas ${snapshot.commercialOperations.room.bottlenecks.sales}`),
      xlsxNumberCell(`D${roomRow}`, snapshot.commercialOperations.room.capacity.limitedToursMonthly),
      xlsxNumberCell(`E${roomRow}`, snapshot.commercialOperations.room.capacity.limitedSalesMonthly),
      xlsxTextCell(`P${roomRow}`, `Espera no pico ${snapshot.commercialOperations.room.queue.estimatedPeakWaitMinutes ?? "N/D"} · limite ${snapshot.commercialOperations.room.queue.maxWaitMinutes}`),
    ]));
    snapshot.commercialOperations.room.alerts.forEach(alert => {
      const row = operationsRowIndex++;
      operationsRows.push(xlsxRow(row, [
        xlsxTextCell(`A${row}`, "ALERTA"),
        xlsxTextCell(`B${row}`, alert.code),
        xlsxTextCell(`C${row}`, alert.severity),
        xlsxNumberCell(`D${row}`, alert.demand),
        xlsxNumberCell(`E${row}`, alert.capacity),
        xlsxTextCell(`P${row}`, alert.message),
      ]));
    });
    snapshot.commercialOperations.training.forEach(plan => {
      const row = operationsRowIndex++;
      operationsRows.push(xlsxRow(row, [
        xlsxTextCell(`A${row}`, "TREINAMENTO"),
        xlsxTextCell(`B${row}`, plan.trainingId),
        xlsxTextCell(`C${row}`, plan.role),
        xlsxNumberCell(`F${row}`, plan.summary.certifiedPeople),
        xlsxNumberCell(`G${row}`, plan.summary.productivePeople),
        xlsxNumberCell(`I${row}`, plan.summary.totalCostToProductive),
        xlsxTextCell(`P${row}`, `Produtividade M${plan.summary.productiveMonth + 1} · gap alvo ${plan.summary.targetGap} · custo/produtivo ${plan.summary.costPerProductivePerson ?? "N/D"}`),
      ]));
    });
    if (snapshot.commissionLedger) {
      const totalRow = operationsRowIndex++;
      operationsRows.push(xlsxRow(totalRow, [
        xlsxTextCell(`A${totalRow}`, "COMISSÃO TOTAL"),
        xlsxTextCell(`B${totalRow}`, "LEDGER"),
        xlsxNumberCell(`M${totalRow}`, snapshot.commissionLedger.totals.payable),
        xlsxTextCell(`P${totalRow}`, `Competência ${snapshot.commissionLedger.totals.accrued} · holdback ${snapshot.commissionLedger.totals.held}`),
      ]));
      snapshot.commissionLedger.accruals.forEach(accrual => {
        const row = operationsRowIndex++;
        operationsRows.push(xlsxRow(row, [
          xlsxTextCell(`A${row}`, "COMISSÃO"),
          xlsxTextCell(`B${row}`, accrual.policyId),
          xlsxTextCell(`C${row}`, accrual.role),
          xlsxNumberCell(`M${row}`, accrual.payableCommission),
          xlsxTextCell(`P${row}`, `${accrual.eligibleBase} · competência M${accrual.accrualMonth} · pagamento M${accrual.paymentMonth} · reversão ${accrual.isReversal ? "sim" : "não"}`),
        ]));
      });
    }
  } else {
    operationsRows.push(xlsxRow(2, [
      xlsxTextCell("A2", "SEM DADOS"),
      xlsxTextCell("P2", "Snapshot sem Commercial Operations"),
    ]));
    operationsRowIndex = 3;
  }
  const operationsRowsXml = operationsRows.join("");
  const worksheet = (rows: string, maxColumn: string, maxRow: number) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${maxColumn}${Math.max(1, maxRow)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${rows}</sheetData></worksheet>`;
  const sheets = [
    { name: "Inputs", rows: inputsRows, maxColumn: "E", maxRow: inputs ? FINANCIAL_INPUT_KEYS.length + 1 : 2 },
    { name: "Statuses &amp; Sources", rows: provenanceRows, maxColumn: "E", maxRow: domainRecords(snapshot).length + 1 },
    { name: "Monthly Projection", rows: projectionRows, maxColumn: "Z", maxRow: snapshot.projections.length + 1 },
    { name: "Scenarios", rows: scenarioRows, maxColumn: "H", maxRow: comparison && comparison.entries.length ? comparison.entries.length + 2 : 2 },
    { name: "Formulas", rows: formulaRows, maxColumn: "F", maxRow: Math.max(2, snapshot.memory.length + 1) },
    { name: "Outputs", rows: outputRows, maxColumn: "E", maxRow: KPI_ROWS.length + (snapshot.domainBlockers?.length ?? 0) + (snapshot.domainInvalidities?.length ?? 0) + modelOutputEntries.length + (snapshot.exportMetadata ? 7 : 0) + 1 },
    { name: "Point Economics", rows: pointRows, maxColumn: "S", maxRow: (snapshot.pointEconomics?.points.length ?? 0) + 2 },
    { name: "Commercial Operations", rows: operationsRowsXml, maxColumn: "P", maxRow: operationsRowIndex - 1 },
  ];
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${sheet.name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Aptos"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", rootRels);
  zip.file("xl/workbook.xml", workbook);
  zip.file("xl/_rels/workbook.xml.rels", workbookRels);
  zip.file("xl/styles.xml", styles);
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>${xml(exportAuthor(snapshot.exportMetadata))}</dc:creator><dc:title>Boardroom Snapshot</dc:title><dc:subject>${xml(exportProvenance(snapshot))}</dc:subject>${snapshot.exportMetadata ? `<dcterms:created xsi:type="dcterms:W3CDTF">${xml(snapshot.exportMetadata.generatedAt)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${xml(snapshot.exportMetadata.generatedAt)}</dcterms:modified>` : ""}</cp:coreProperties>`
  );
  sheets.forEach((sheet, index) => {
    zip.file(
      `xl/worksheets/sheet${index + 1}.xml`,
      worksheet(sheet.rows, sheet.maxColumn, sheet.maxRow)
    );
  });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
