import path from "node:path";
import { createRequire } from "node:module";
import ExcelJS from "exceljs";
import pdfMake from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces.js";

const require = createRequire(import.meta.url);
const pdfmakeDir = path.dirname(require.resolve("pdfmake/package.json"));
const robotoFontsDir = path.join(pdfmakeDir, "fonts", "Roboto");

export interface ReportExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ReportExportSheet {
  name: string;
  columns: ReportExportColumn[];
  rows: Array<Record<string, unknown>>;
}

export async function buildExcelReport(input: { title: string; sheets: ReportExportSheet[] }): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sports Booking System";
  workbook.created = new Date();

  for (const sheetInput of input.sheets) {
    const sheet = workbook.addWorksheet(sheetInput.name.slice(0, 31));
    sheet.columns = sheetInput.columns.map((column) => ({ header: column.header, key: column.key, width: column.width ?? 20 }));
    sheet.getRow(1).font = { bold: true };
    sheetInput.rows.forEach((row) => sheet.addRow(row));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface ReportExportSection {
  heading: string;
  table?: { columns: ReportExportColumn[]; rows: Array<Record<string, unknown>> };
  kpis?: Array<{ label: string; value: string }>;
}

const fonts = {
  Roboto: {
    normal: path.join(robotoFontsDir, "Roboto-Regular.ttf"),
    bold: path.join(robotoFontsDir, "Roboto-Medium.ttf"),
    italics: path.join(robotoFontsDir, "Roboto-Italic.ttf"),
    bolditalics: path.join(robotoFontsDir, "Roboto-MediumItalic.ttf")
  }
};

pdfMake.setFonts(fonts);
pdfMake.setLocalAccessPolicy((filePath) => filePath.startsWith(robotoFontsDir));
pdfMake.setUrlAccessPolicy(() => false);

export async function buildPdfReport(input: { title: string; subtitle?: string; sections: ReportExportSection[] }): Promise<Buffer> {
  const content: TDocumentDefinitions["content"] = [
    { text: input.title, style: "title" },
    ...(input.subtitle ? [{ text: input.subtitle, style: "subtitle" }] : [])
  ];

  for (const section of input.sections) {
    content.push({ text: section.heading, style: "sectionHeading", margin: [0, 12, 0, 6] });

    if (section.kpis?.length) {
      content.push({
        columns: section.kpis.map((kpi) => ({
          text: [{ text: `${kpi.label}\n`, fontSize: 9, color: "#666666" }, { text: kpi.value, fontSize: 13, bold: true }]
        }))
      });
    }

    if (section.table) {
      content.push({
        table: {
          headerRows: 1,
          widths: section.table.columns.map(() => "*"),
          body: [
            section.table.columns.map((column) => ({ text: column.header, bold: true })),
            ...section.table.rows.map((row) => section.table!.columns.map((column) => String(row[column.key] ?? "")))
          ]
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 8]
      });
    }
  }

  const docDefinition: TDocumentDefinitions = {
    content,
    defaultStyle: { font: "Roboto", fontSize: 10 },
    styles: {
      title: { fontSize: 18, bold: true },
      subtitle: { fontSize: 11, color: "#666666", margin: [0, 2, 0, 0] },
      sectionHeading: { fontSize: 13, bold: true }
    }
  };

  return pdfMake.createPdf(docDefinition).getBuffer();
}
