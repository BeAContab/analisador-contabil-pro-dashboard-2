import { DreAnalysisReport, DreReport } from '../types';
import { nowLabel, slugify } from './format';
import type { Table, UserOptions } from 'jspdf-autotable';

/**
 * Espelha o par downloadXlsx/downloadPdf de `reports.ts`, mas para `DreReport`
 * em vez de `CompanyReport` - arquivo separado (nao estendido em `reports.ts`)
 * porque as formas de dado sao completamente diferentes (ver "Decisoes de
 * arquitetura" do plano de implementacao da DRE).
 */
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: Table;
  }
}

export function dreReportFileName(report: DreReport, extension: 'xlsx' | 'pdf') {
  return `${slugify(report.companyName)}_dre.${extension}`;
}

function lineColumns(report: DreReport): string[] {
  return ['Linha', ...report.periods, 'Total', '%', 'Media', report.previousYearLabel || 'Media (ano anterior)'];
}

function lineBody(report: DreReport): Array<Array<string | number>> {
  return report.lines.map((line) => [
    `${'  '.repeat(line.level)}${line.label}`,
    ...line.periodValues.map((value) => value?.raw ?? ''),
    line.total?.raw ?? '',
    line.percent?.raw ?? '',
    line.average?.raw ?? '',
    line.averagePreviousYear?.raw ?? ''
  ]);
}

function analysisColumns(analysis: DreAnalysisReport): string[] {
  return ['Item', ...(analysis.rows[0]?.cells.map((cell) => cell.header) ?? [])];
}

function analysisBody(analysis: DreAnalysisReport): Array<Array<string | number>> {
  return analysis.rows.map((row) => [row.label, ...row.cells.map((cell) => cell.value)]);
}

export async function downloadDreXlsx(report: DreReport) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const createdAt = nowLabel();

  XLSX.utils.book_append_sheet(
    workbook,
    buildWorksheet(XLSX.utils.aoa_to_sheet, report, 'Linhas da DRE', lineColumns(report), lineBody(report), createdAt),
    'Linhas'
  );

  report.analysisReports.forEach((analysis, index) => {
    if (analysis.rows.length === 0) return;
    XLSX.utils.book_append_sheet(
      workbook,
      buildWorksheet(
        XLSX.utils.aoa_to_sheet,
        report,
        analysis.title,
        analysisColumns(analysis),
        analysisBody(analysis),
        createdAt,
        analysis.message,
        analysis.intro
      ),
      `Analise ${index + 1}`
    );
  });

  XLSX.writeFile(workbook, dreReportFileName(report, 'xlsx'));
}

export async function downloadDrePdf(report: DreReport) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const createdAt = nowLabel();

  doc.setFontSize(14);
  doc.text('Demonstracao do Resultado (DRE)', 40, 36);
  doc.setFontSize(9);
  doc.text(`Empresa: ${report.companyName}`, 40, 58);
  doc.text(`CNPJ: ${report.cnpj}`, 40, 74);
  doc.text(`Periodos: ${report.periods.join(', ') || '-'}`, 40, 90);
  doc.text(`Arquivo: ${report.fileName}`, 40, 106);
  doc.text(`Gerado em: ${createdAt}`, 40, 122);

  let nextY = addPdfSection(doc, autoTable, 'Linhas da DRE', lineColumns(report), lineBody(report), 150);

  report.analysisReports.forEach((analysis) => {
    if (analysis.rows.length === 0) return;
    nextY = addPdfSection(
      doc,
      autoTable,
      analysis.title,
      analysisColumns(analysis),
      analysisBody(analysis),
      nextY + 34,
      analysis.message,
      analysis.intro
    );
  });

  doc.save(dreReportFileName(report, 'pdf'));
}

function buildWorksheet(
  aoaToSheet: (rows: unknown[][]) => ReturnType<(typeof import('xlsx'))['utils']['aoa_to_sheet']>,
  report: DreReport,
  title: string,
  columns: string[],
  body: Array<Array<string | number>>,
  createdAt: string,
  message?: string,
  intro?: string
): ReturnType<(typeof import('xlsx'))['utils']['aoa_to_sheet']> {
  const rows = [
    ['Relatorio', title],
    ['Empresa', report.companyName],
    ['CNPJ', report.cnpj],
    ['Periodos', report.periods.join(', ') || '-'],
    ['Arquivo', report.fileName],
    ['Gerado em', createdAt],
    ...(intro ? [['Introducao', intro]] : []),
    ...(message ? [['Status', message]] : []),
    [],
    columns,
    ...(body.length ? body : [['Nenhum resultado encontrado.']])
  ];
  const worksheet = aoaToSheet(rows as unknown[][]);
  worksheet['!cols'] = columns.map((_, index) => ({ wch: index === 0 ? 42 : 16 }));
  return worksheet;
}

type JsPdfInstance = InstanceType<typeof import('jspdf').default>;

function addPdfSection(
  doc: JsPdfInstance,
  autoTable: (doc: JsPdfInstance, options: UserOptions) => void,
  title: string,
  columns: string[],
  body: Array<Array<string | number>>,
  startY: number,
  message?: string,
  intro?: string
) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const normalizedStartY = startY > pageHeight - 120 ? 40 : startY;
  if (normalizedStartY !== startY) {
    doc.addPage();
  }

  doc.setFontSize(11);
  doc.text(title, 40, normalizedStartY);

  let tableStartY = normalizedStartY + 12;
  if (intro) {
    doc.setFontSize(8);
    doc.text(intro, 40, tableStartY, { maxWidth: doc.internal.pageSize.getWidth() - 80 });
    tableStartY += 14;
  }
  if (message) {
    doc.setFontSize(8);
    doc.text(message, 40, tableStartY, { maxWidth: doc.internal.pageSize.getWidth() - 80 });
    tableStartY += 14;
  }

  autoTable(doc, {
    startY: tableStartY,
    head: [columns],
    body: body.length ? body : [['Nenhum resultado encontrado.']],
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [50, 75, 83] }, // #324B53 - Azul Petroleo Escuro da marca
    margin: { left: 36, right: 36 }
  });

  return getFinalY(doc);
}

function getFinalY(doc: JsPdfInstance) {
  return doc.lastAutoTable?.finalY ?? 150;
}
