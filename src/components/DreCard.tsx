import { useMemo, useState } from 'react';
import { DreAnalysisKind, DreAnalysisRow, DreReport } from '../types';
import { downloadDrePdf, downloadDreXlsx } from '../utils/dreReports';
import { DreTable } from './DreTable';

interface DreCardProps {
  report: DreReport;
}

type DreTabKind = 'lines' | DreAnalysisKind;

export function DreCard({ report }: DreCardProps) {
  const [activeTab, setActiveTab] = useState<DreTabKind>('lines');

  const tabs = useMemo(
    () => [
      { kind: 'lines' as DreTabKind, label: 'Linhas da DRE', count: report.lines.length, hasAttention: false },
      ...report.analysisReports.map((analysis) => ({
        kind: analysis.kind as DreTabKind,
        label: analysis.title,
        count: analysis.rows.length,
        hasAttention: analysis.isAttention
      }))
    ],
    [report]
  );

  const activeAnalysis = activeTab === 'lines' ? undefined : report.analysisReports.find((analysis) => analysis.kind === activeTab);
  const exportEnabled = report.lines.length > 0;

  return (
    <article className="glass-panel flex flex-col gap-8 p-6 sm:p-10">
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 border-b border-surface-border pb-8">
        <MetaItem label="Empresa" value={report.companyName} bold />
        <MetaItem label="CNPJ" value={report.cnpj} tabular />
        <MetaItem label="Períodos" value={report.periods.join(', ') || '-'} />
        <MetaItem label="Linhas Extraídas" value={`${report.lines.length} registros`} tabular />
      </section>

      {report.errors.length > 0 && (
        <section className="space-y-4">
          {report.errors.map((error, i) => (
            <div key={i} className="bg-error/10 text-error p-4 rounded-xl flex items-center gap-4 border border-error/20">
              <span className="material-symbols-outlined">error</span>
              <span className="text-sm font-semibold">{error}</span>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-b border-surface-border pb-6">
        <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.kind;
            return (
              <button
                key={tab.kind}
                onClick={() => setActiveTab(tab.kind)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-surface hover:bg-surface-border text-muted-foreground hover:text-foreground border border-surface-border'
                }`}
              >
                {tab.label}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    tab.hasAttention
                      ? isActive ? 'bg-error text-error-foreground' : 'bg-error/20 text-error'
                      : isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex gap-3">
          <button
            disabled={!exportEnabled}
            onClick={() => downloadDreXlsx(report)}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-surface-border rounded-xl text-xs font-bold uppercase tracking-wider text-foreground hover:shadow-md transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px] text-success">table_view</span>
            XLSX
          </button>
          <button
            disabled={!exportEnabled}
            onClick={() => downloadDrePdf(report)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary border border-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider hover:shadow-md hover:bg-primary-hover transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            PDF
          </button>
        </div>
      </div>

      <section className="space-y-8">
        <div className="flex flex-col gap-2">
          <h3 className="text-2xl font-bold text-foreground">{activeAnalysis ? activeAnalysis.title : 'Linhas da DRE'}</h3>
          <p className="text-muted-foreground leading-relaxed">
            {activeAnalysis ? activeAnalysis.intro : 'Todas as linhas extraídas do arquivo, na ordem em que aparecem no PDF.'}
          </p>
        </div>

        {activeAnalysis && (
          <div
            className={`p-6 rounded-2xl border flex gap-4 items-start shadow-sm ${
              activeAnalysis.isAttention ? 'bg-error/5 border-error/20 text-error' : 'bg-primary/5 border-primary/20 text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[28px] mt-0.5">{activeAnalysis.isAttention ? 'warning' : 'info'}</span>
            <div>
              <h4 className="font-bold mb-1 text-lg">{activeAnalysis.isAttention ? 'Atenção Necessária' : 'Análise Concluída'}</h4>
              <p className="text-sm font-medium opacity-90">{activeAnalysis.message}</p>
            </div>
          </div>
        )}

        {!activeAnalysis ? <DreTable report={report} /> : <DreAnalysisTable rows={activeAnalysis.rows} />}
      </section>
    </article>
  );
}

function MetaItem({ label, value, bold = false, tabular = false }: { label: string; value: string; bold?: boolean; tabular?: boolean }) {
  return (
    <div className="bg-surface-50 p-4 rounded-xl border border-surface-border shadow-sm">
      <span className="text-[10px] font-bold text-muted-foreground mb-1 block uppercase tracking-wider">{label}</span>
      <p className={`text-sm ${bold ? 'font-bold text-primary' : 'text-foreground'} ${tabular ? 'tabular-nums font-mono' : ''} truncate`} title={value}>
        {value}
      </p>
    </div>
  );
}

function DreAnalysisTable({ rows }: { rows: DreAnalysisRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-surface-border rounded-2xl text-muted-foreground font-semibold bg-surface-50">
        Nenhuma ocorrência detalhada para listar nesta seção.
      </div>
    );
  }

  const headers = rows[0]!.cells.map((cell) => cell.header);

  return (
    <div className="glass-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-surface-50 border-b border-surface-border">
            <tr>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider">Item</th>
              {headers.map((header) => (
                <th key={header} className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider text-right">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface-30">
            {rows.map((row, index) => (
              <tr key={`${row.label}-${index}`} className="hover:bg-primary/5 transition-colors">
                <td className="px-4 py-3 text-sm text-foreground">{row.label}</td>
                {row.cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 text-sm font-mono text-right text-foreground">
                    {cell.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
