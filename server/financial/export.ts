import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import type { FinancialCalculation } from "../../shared/financial/types";

const NAVY = "0B1220";
const PANEL = "111C2F";
const GOLD = "E8BD5A";
const LIGHT = "E8EDF5";
const MUTED = "93A0B4";
const EMU = 914400;

export type ExportableSnapshot = FinancialCalculation & {
  snapshotHash: string;
};

export function createExportableSnapshot(
  calculation: FinancialCalculation,
  snapshotHash: string
): ExportableSnapshot {
  if (!snapshotHash)
    throw new Error("Snapshot autoritativo sem hash não pode ser exportado.");
  return { ...calculation, snapshotHash };
}

function shortHash(hash: string) {
  return hash.slice(0, 12).toUpperCase();
}
function display(value: string | null): string {
  return value ?? "N/D";
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
    `HASH ${shortHash(snapshot.snapshotHash)} · FORMULA SET ${snapshot.formulaSetVersion}`,
    { x: 64, y: 435, size: 9, font: bold, color: rgb(0.91, 0.74, 0.35) }
  );
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
    "TGR Consulting · Este arquivo não substitui as premissas e a decisão aprovada no sistema.",
    { x: 44, y: 28, size: 8, font: regular, color: rgb(0.58, 0.63, 0.71) }
  );
  return pdf.save();
}

export async function buildBoardroomPptx(
  snapshot: ExportableSnapshot
): Promise<Buffer> {
  const zip = new JSZip();
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
      1.87,
      7.2,
      0.18,
      PANEL,
      `HASH ${shortHash(snapshot.snapshotHash)} · FORMULA SET ${snapshot.formulaSetVersion}`,
      { color: GOLD, size: 700, bold: true, margin: 0 }
    ),
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
  ].join("");
  const slide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>${groups}${slideShapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`;
  const presentationRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`;
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
  zip.file("ppt/slides/slide1.xml", slide);
  zip.file("ppt/slides/_rels/slide1.xml.rels", slideRels);
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
    `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>TGR Consulting</dc:creator><dc:title>Boardroom Snapshot</dc:title></cp:coreProperties>`
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
  const kpiRows: Array<[string, string | null | undefined]> = [
    ["Venda bruta", snapshot.kpis.grossSales],
    ["Entrada bruta gerada", snapshot.kpis.grossEntryGenerated],
    ["Recebíveis brutos gerados", snapshot.kpis.grossReceivablesGenerated],
    ["Recebíveis brutos liquidados", snapshot.kpis.grossReceivablesSettled],
    ["Parcelas líquidas recebidas", snapshot.kpis.installmentCollections],
    ["Recebíveis cancelados", snapshot.kpis.canceledReceivables],
    ["Saldo inadimplente", snapshot.kpis.delinquentBalance],
    ["Recebimentos recuperados", snapshot.kpis.curedCollections],
    ["Saldo baixado para perda", snapshot.kpis.writtenOffBalance],
    ["Healthy D90 esperado", snapshot.kpis.healthyD90],
    ["Receita reconhecida", snapshot.kpis.recognizedRevenue],
    ["Taxas de pagamento", snapshot.kpis.paymentFees],
    ["Investimento pre-operacional", snapshot.kpis.preOperationalInvestment],
    ["Caixa operacional", snapshot.kpis.totalOperatingCashFlow],
    ["VPL", snapshot.kpis.npv],
    ["TIR anual", snapshot.kpis.irrAnnual],
    ["Payback em meses", snapshot.kpis.paybackMonths],
  ];
  const summaryRows = [
    xlsxRow(1, [xlsxTextCell("A1", "TGR Consulting - Snapshot autoritativo")]),
    xlsxRow(2, [
      xlsxTextCell("A2", "Snapshot hash"),
      xlsxTextCell("B2", snapshot.snapshotHash),
    ]),
    xlsxRow(3, [
      xlsxTextCell("A3", "Formula set"),
      xlsxTextCell("B3", snapshot.formulaSetVersion),
    ]),
    xlsxRow(4, [
      xlsxTextCell("A4", "Engine"),
      xlsxTextCell("B4", snapshot.engineVersion),
    ]),
    xlsxRow(5, [
      xlsxTextCell("A5", "Status"),
      xlsxTextCell("B5", snapshot.status),
    ]),
    xlsxRow(6, [
      xlsxTextCell("A6", "Horizonte (meses)"),
      xlsxNumberCell("B6", snapshot.horizonMonths),
    ]),
    xlsxRow(8, [
      xlsxTextCell("A8", "KPI"),
      xlsxTextCell("B8", "Valor autoritativo"),
    ]),
    ...kpiRows.map(([label, value], offset) => {
      const row = offset + 9;
      return xlsxRow(row, [
        xlsxTextCell(`A${row}`, label),
        xlsxNumberCell(`B${row}`, value),
      ]);
    }),
  ].join("");
  const memoryRows = [
    xlsxRow(1, [
      xlsxTextCell("A1", "KPI"),
      xlsxTextCell("B1", "Valor"),
      xlsxTextCell("C1", "Formula"),
      xlsxTextCell("D1", "Expressao"),
      xlsxTextCell("E1", "Dependencias"),
      xlsxTextCell("F1", "Explicacao"),
    ]),
    ...snapshot.memory.map((memory, offset) => {
      const row = offset + 2;
      return xlsxRow(row, [
        xlsxTextCell(`A${row}`, memory.label),
        xlsxNumberCell(`B${row}`, memory.value),
        xlsxTextCell(`C${row}`, `${memory.formulaId}@${memory.formulaVersion}`),
        xlsxTextCell(`D${row}`, memory.expression),
        xlsxTextCell(`E${row}`, memory.dependencies.join(", ")),
        xlsxTextCell(`F${row}`, memory.explanation),
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
    ["payroll", "Folha"],
    ["preOperationalInvestment", "Investimento pre-operacional"],
    ["operatingCashFlow", "Fluxo de caixa"],
    ["cumulativeCashFlow", "Caixa acumulado"],
    ["discountedCashFlow", "Fluxo descontado"],
  ];
  const columnName = (index: number) => String.fromCharCode(65 + index);
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
  const worksheet = (rows: string, maxColumn: string, maxRow: number) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${maxColumn}${Math.max(1, maxRow)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${rows}</sheetData></worksheet>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Resumo" sheetId="1" r:id="rId1"/><sheet name="Memoria de calculo" sheetId="2" r:id="rId2"/><sheet name="Projecao mensal" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Aptos"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", rootRels);
  zip.file("xl/workbook.xml", workbook);
  zip.file("xl/_rels/workbook.xml.rels", workbookRels);
  zip.file("xl/styles.xml", styles);
  zip.file(
    "xl/worksheets/sheet1.xml",
    worksheet(summaryRows, "B", kpiRows.length + 8)
  );
  zip.file(
    "xl/worksheets/sheet2.xml",
    worksheet(memoryRows, "F", snapshot.memory.length + 1)
  );
  zip.file(
    "xl/worksheets/sheet3.xml",
    worksheet(projectionRows, "P", snapshot.projections.length + 1)
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
