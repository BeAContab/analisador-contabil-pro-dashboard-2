import { CompanyReport } from '../types';
import { buildPdfBytes, buildXlsxBytes, companyHasAlerts, reportFileName } from './reports';

export type ExportFormat = 'xlsx' | 'pdf';
export type SelectionMode = 'alerts' | 'all';

/** Ids pre-marcados para cada modo: "alerts" so as empresas com alerta, "all" todas. */
export function selectionForMode(companies: CompanyReport[], mode: SelectionMode): Set<string> {
  return new Set(
    companies.filter((company) => mode === 'all' || companyHasAlerts(company)).map((company) => company.id)
  );
}

/** Garante nomes unicos dentro do ZIP (mesma empresa e periodo enviados duas vezes, por exemplo). */
export function uniqueFileNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf('.');
    return `${name.slice(0, dot)}-${count}${name.slice(dot)}`;
  });
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Gera XLSX e/ou PDF de cada empresa selecionada e entrega tudo num unico ZIP
 * (varios downloads seguidos sao bloqueados pelo navegador). Tudo roda local.
 * A geracao e sequencial e devolve a thread entre arquivos para a barra de
 * progresso poder atualizar.
 */
export async function downloadReportsZip(
  companies: CompanyReport[],
  formats: ExportFormat[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const { zipSync } = await import('fflate');
  const jobs = companies.flatMap((company) => formats.map((format) => ({ company, format })));
  const names = uniqueFileNames(jobs.map(({ company, format }) => reportFileName(company, format)));
  const files: Record<string, Uint8Array> = {};

  onProgress?.(0, jobs.length);
  for (const [index, { company, format }] of jobs.entries()) {
    files[names[index]!] = format === 'xlsx' ? await buildXlsxBytes(company) : await buildPdfBytes(company);
    onProgress?.(index + 1, jobs.length);
    await yieldToBrowser();
  }

  // xlsx e pdf ja sao comprimidos; nivel 0 evita gastar CPU sem ganho de tamanho relevante.
  const zipped = zipSync(files, { level: 0 });
  const stamp = new Date().toISOString().slice(0, 10);
  saveBlob(new Blob([zipped as BlobPart], { type: 'application/zip' }), `relatorios-balancete_${stamp}.zip`);
}
