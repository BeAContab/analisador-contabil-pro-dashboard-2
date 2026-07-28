import { CompanyReport } from '../types';

/**
 * Contagem canonica de ocorrencias de um relatorio.
 *
 * Esta formula estava replicada em quatro lugares (App.tsx, ChatbotFab.tsx,
 * chatbot.ts e gemini.ts). Todas eram identicas, mas manter quatro copias
 * significava que incluir uma nova regra de analise exigiria lembrar dos quatro
 * pontos - e o badge do chat, o resumo do dashboard e o contexto da IA podiam
 * divergir silenciosamente.
 *
 * Regra: cada linha sinalizada conta como uma ocorrencia; uma analise sem
 * linhas, mas marcada como atencao, conta como uma unica ocorrencia.
 */
export function companyOccurrences(report: CompanyReport): number {
  return (
    report.invertedRows.length +
    report.zeroMovementRows.length +
    (report.comparisonReport.isAttention ? 1 : 0) +
    report.analysisReports.reduce((sum, analysis) => sum + analysisOccurrences(analysis), 0)
  );
}

export function sumOccurrences(reports: CompanyReport[]): number {
  return reports.reduce((sum, report) => sum + companyOccurrences(report), 0);
}

function analysisOccurrences(analysis: CompanyReport['analysisReports'][number]): number {
  if (analysis.rows.length > 0) return analysis.rows.length;
  return analysis.isAttention ? 1 : 0;
}

/**
 * Quantos relatorios distintos da empresa estao sinalizados (nao quantas linhas).
 * Usado pelo resumo do dashboard, que mede abrangencia e nao volume.
 */
export function companyReportsWithAlerts(report: CompanyReport): number {
  return (
    (report.invertedRows.length > 0 ? 1 : 0) +
    (report.zeroMovementRows.length > 0 ? 1 : 0) +
    (report.comparisonReport.isAttention ? 1 : 0) +
    report.analysisReports.filter((analysis) => analysis.isAttention).length
  );
}
