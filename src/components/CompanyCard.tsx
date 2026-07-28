import { useEffect, useMemo, useState } from 'react';
import { AnalysisKind, CompanyReport, ReportKind } from '../types';
import { balanceNature, formatNumberAsBrazilianMoney, formatNumberAsPercentage, parseBrazilianMoney } from '../utils/format';
import {
  analysisAttention,
  analysisCalculation,
  analysisDepreciationPairs,
  analysisMessage,
  downloadPdf,
  downloadXlsx,
  hasExportContent,
  reportHasOccurrence,
  reportIntro,
  reportOccurrenceCount,
  reportRows,
  reportTabs,
  reportTitle
} from '../utils/reports';
import { DataTable } from './DataTable';

interface CompanyCardProps {
  company: CompanyReport;
}

export function CompanyCard({ company }: CompanyCardProps) {
  const [activeTab, setActiveTab] = useState<ReportKind>('inverted');
  const [showHiddenReports, setShowHiddenReports] = useState(false);

  const visibleTabs = useMemo(() => reportTabs.filter((tab) => reportHasOccurrence(company, tab.kind)), [company]);
  const displayedTabs = showHiddenReports ? reportTabs : visibleTabs;
  const hiddenReportsCount = reportTabs.length - visibleTabs.length;
  const effectiveTab = displayedTabs.find((tab) => tab.kind === activeTab)?.kind ?? displayedTabs[0]?.kind;

  const activeRows = useMemo(() => (effectiveTab ? reportRows(company, effectiveTab) : []), [company, effectiveTab]);
  const activeTitle = effectiveTab ? reportTitle(effectiveTab, company) : 'Relatórios Ocultos';
  const activeIntro = effectiveTab ? reportIntro(effectiveTab, company) : 'Nenhum relatório com ocorrência está visível no momento.';
  const exportEnabled = hasExportContent(company);

  useEffect(() => {
    if (effectiveTab && effectiveTab !== activeTab) {
      setActiveTab(effectiveTab);
    }
  }, [activeTab, effectiveTab]);

  return (
    <article className="glass-panel flex flex-col gap-8 p-6 sm:p-10">
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 border-b border-surface-border pb-8">
        <MetaItem label="Empresa" value={company.companyName} bold />
        <MetaItem label="CNPJ" value={company.cnpj} tabular />
        <MetaItem label="Período" value={company.period} />
        <MetaItem label="Linhas Extraídas" value={`${company.rows.length} registros`} tabular />
      </section>

      {(company.errors.length > 0 || company.unclassified.length > 0) && (
        <section className="space-y-4">
          {company.errors.map((error, i) => (
            <div key={i} className="bg-error/10 text-error p-4 rounded-xl flex items-center gap-4 border border-error/20">
              <span className="material-symbols-outlined">error</span>
              <span className="text-sm font-semibold">{error}</span>
            </div>
          ))}
          {company.unclassified.length > 0 && (
            <div className="bg-warning/10 text-warning p-4 rounded-xl flex items-center gap-4 border border-warning/20">
              <span className="material-symbols-outlined">help_outline</span>
              <span className="text-sm font-medium">Atenção: {company.unclassified.length} linha(s) não foram classificadas automaticamente.</span>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-b border-surface-border pb-6">
        <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {displayedTabs.map((tab) => {
            const meta = buildReportMeta(company, tab.kind);
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
                    meta.hasAttention 
                      ? isActive ? 'bg-error text-error-foreground' : 'bg-error/20 text-error'
                      : isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {meta.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex gap-3">
          <button
            disabled={!exportEnabled}
            onClick={() => downloadXlsx(company)}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-surface-border rounded-xl text-xs font-bold uppercase tracking-wider text-foreground hover:shadow-md transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px] text-success">table_view</span>
            XLSX
          </button>
          <button
            disabled={!exportEnabled}
            onClick={() => downloadPdf(company)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary border border-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider hover:shadow-md hover:bg-primary-hover transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            PDF
          </button>
        </div>
      </div>

      <section className="space-y-8">
        <div className="flex flex-col gap-2">
          <h3 className="text-2xl font-bold text-foreground">{activeTitle}</h3>
          <p className="text-muted-foreground leading-relaxed">{activeIntro}</p>
        </div>

        {!effectiveTab ? (
          // displayedTabs pode ficar vazio (empresa sem nenhuma ocorrencia e
          // "mostrar mais" desligado) - o titulo/intro acima ja cobrem esse
          // caso, aqui so evitamos forcar um kind inexistente no DataTable.
          <p className="text-muted-foreground italic">Nenhum relatório para exibir no momento.</p>
        ) : effectiveTab === 'comparison' ? (
          <ComparisonPanel company={company} />
        ) : isAnalysisKind(effectiveTab) ? (
          <AnalysisPanel company={company} kind={effectiveTab} />
        ) : (
          <DataTable rows={activeRows} kind={effectiveTab} />
        )}

        {hiddenReportsCount > 0 && (
          <button
            onClick={() => setShowHiddenReports(!showHiddenReports)}
            className="w-full py-4 border-2 border-dashed border-surface-border rounded-xl text-muted-foreground font-semibold hover:bg-surface-50 hover:text-foreground transition-all duration-300"
          >
            {showHiddenReports ? 'Ocultar relatórios sem ocorrência' : `Mostrar mais ${hiddenReportsCount} relatório(s) oculto(s)`}
          </button>
        )}
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

function AnalysisPanel({ company, kind }: { company: CompanyReport; kind: AnalysisKind }) {
  const rows = reportRows(company, kind);
  const depreciationPairs = analysisDepreciationPairs(company, kind);
  const isAttention = analysisAttention(company, kind);
  const message = analysisMessage(company, kind);
  const calculation = analysisCalculation(company, kind);
  const percentageItem = calculation?.items.find((item) => item.format === 'percentage');
  const isAboveLimit = Boolean(percentageItem && percentageItem.value > 1);
  const hasIncompleteBase = message.toLowerCase().includes('base incompleta');
  const hasZeroRevenue = message.toLowerCase().includes('ficou zerada');

  return (
    <div className="space-y-8">
      <div
        className={`p-6 rounded-2xl border flex gap-4 items-start shadow-sm ${
          isAttention ? 'bg-error/5 border-error/20 text-error' : 'bg-primary/5 border-primary/20 text-primary'
        }`}
      >
          <span className="material-symbols-outlined text-[28px] mt-0.5">{isAttention ? 'warning' : 'info'}</span>
          <div>
            <h4 className="font-bold mb-1 text-lg">{isAttention ? 'Atenção Necessária' : 'Análise Concluída'}</h4>
            <p className="text-sm font-medium opacity-90">{message}</p>
          </div>
        </div>

      {calculation && (
        <div className={`grid grid-cols-1 ${percentageItem ? 'xl:grid-cols-3' : ''} gap-6`}>
          <div className={`${percentageItem ? 'xl:col-span-2' : ''} bg-surface p-6 rounded-2xl border border-surface-border space-y-6 shadow-sm`}>
            <div className="flex items-center gap-2 text-foreground">
              <span className="material-symbols-outlined text-[20px] text-accent">calculate</span>
              <h4 className="font-bold">Cálculo de Verificação</h4>
            </div>
            <p className="text-sm font-mono text-muted-foreground bg-background p-3 rounded-xl border border-surface-border">"{calculation.formula}"</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {calculation.items.map((item) => (
                <div key={item.label} className="bg-background p-4 rounded-xl border border-surface-border shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">{item.label}</span>
                  <span className="text-lg font-bold text-foreground tabular-nums font-mono">
                    {item.format === 'percentage' ? formatNumberAsPercentage(item.value) : formatNumberAsBrazilianMoney(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {percentageItem && (
            <div
              className={`p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-md border transition-all ${
                isAttention 
                  ? 'bg-error text-error-foreground border-error/20 shadow-lg shadow-error/10' 
                  : 'bg-primary text-primary-foreground border-primary/20 shadow-lg shadow-primary/10'
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4 shadow-inner">
                <span className="material-symbols-outlined text-[32px]">{isAttention ? 'warning' : 'monitoring'}</span>
              </div>
              <h4 className="text-sm font-bold uppercase tracking-wider opacity-90">Percentual CMV/Receita</h4>
              <p className="text-[48px] leading-none font-bold tabular-nums mt-2 tracking-tighter">{formatNumberAsPercentage(percentageItem.value)}</p>
              <p className="text-sm opacity-90 mt-4 font-medium max-w-[200px]">
                {isAboveLimit
                  ? 'Acima do limite esperado de 100%.'
                  : hasIncompleteBase
                    ? 'Base incompleta: revise os Cod. R. indicados no alerta.'
                    : hasZeroRevenue
                      ? 'Não foi possível calcular: receita total zero.'
                      : 'Dentro do limite esperado de até 100%.'}
              </p>
            </div>
          )}
        </div>
      )}

      {kind === 'analysis11' && depreciationPairs.length > 0 ? (
        <DepreciationPairsTable rows={depreciationPairs} />
      ) : rows.length > 0 ? (
        <DataTable rows={rows} kind={kind} />
      ) : (
        <div className="p-12 text-center border-2 border-dashed border-surface-border rounded-2xl text-muted-foreground font-semibold bg-surface-50">
          Nenhuma ocorrência detalhada para listar nesta seção.
        </div>
      )}
    </div>
  );
}

function DepreciationPairsTable({ rows }: { rows: NonNullable<ReturnType<typeof analysisDepreciationPairs>> }) {
  return (
    <div className="glass-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[1200px]">
          <thead className="bg-surface-50 border-b border-surface-border">
            <tr>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider">Cód. R. (Bem)</th>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider">Nome (Bem)</th>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider text-right">Saldo Atual (Bem)</th>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider">Cód. R. (Deprec.)</th>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider">Nome (Deprec.)</th>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider text-right">Saldo Atual (Deprec.)</th>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider">Ação corretiva</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface-30">
            {rows.map((row, index) => (
              <tr key={`${row.assetCode}-${row.depreciationCode}-${index}`} className="hover:bg-primary/5 transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.assetCode || '-'}</td>
                <td className="px-4 py-3 text-sm text-foreground">{row.assetName}</td>
                <td className="px-4 py-3 text-sm font-mono text-right font-bold text-foreground">
                  {row.assetCurrentBalance === undefined ? '-' : formatNumberAsBrazilianMoney(row.assetCurrentBalance)}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.depreciationCode || '-'}</td>
                <td className="px-4 py-3 text-sm text-foreground">{row.depreciationName}</td>
                <td className="px-4 py-3 text-sm font-mono text-right font-bold text-foreground">
                  {formatNumberAsBrazilianMoney(row.depreciationCurrentBalance)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  <div className="bg-background border border-surface-border px-3 py-1.5 rounded-md shadow-sm line-clamp-2">
                    {row.correctiveAction}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparisonPanel({ company }: { company: CompanyReport }) {
  const { comparisonReport } = company;
  const isAttention = comparisonReport.isAttention;
  const calculationRows = buildCalculationRows(company);

  return (
    <div className="space-y-8">
      <div
        className={`p-6 rounded-2xl border flex gap-4 items-start shadow-sm ${
          isAttention ? 'bg-error/5 border-error/20 text-error' : 'bg-success/5 border-success/20 text-success'
        }`}
      >
        <span className="material-symbols-outlined text-[28px] mt-0.5">{isAttention ? 'warning' : 'check_circle'}</span>
        <div>
          <h4 className="font-bold mb-1 text-lg">{isAttention ? 'Divergência Detectada' : 'Saldos Reconciliados'}</h4>
          <p className="text-sm font-medium opacity-90">{comparisonReport.message}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-surface p-6 rounded-2xl border border-surface-border space-y-6 shadow-sm">
          <div className="flex items-center gap-2 text-foreground">
            <span className="material-symbols-outlined text-[20px] text-accent">calculate</span>
            <h4 className="font-bold">Fórmula de Conciliação</h4>
          </div>
          <p className="text-sm font-mono text-muted-foreground bg-background p-3 rounded-xl border border-surface-border">"{comparisonFormula(company)}"</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {calculationRows.map((row) => (
              <div key={row.label} className="flex justify-between items-center p-4 bg-background rounded-xl border border-surface-border shadow-sm">
                <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider truncate mr-4">{row.label}</span>
                <span className="text-base font-mono font-bold text-foreground whitespace-nowrap">{formatNumberAsBrazilianMoney(row.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-md border ${
          isAttention ? 'bg-gradient-to-br from-error/90 to-error text-error-foreground border-error' : 'bg-gradient-to-br from-success to-success/80 text-success-foreground border-success/20'
        }`}>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4 shadow-inner">
            <span className="material-symbols-outlined text-[32px]">{isAttention ? 'analytics' : 'verified'}</span>
          </div>
          <h4 className="text-sm font-bold uppercase tracking-wider opacity-90">Score de Precisão</h4>
          <p className="text-[48px] leading-none font-bold mt-2 tracking-tighter">{isAttention ? 'Divergente' : '100%'}</p>
          <p className="text-sm opacity-90 mt-4 font-medium max-w-[200px]">
            {isAttention ? 'Verifique os lançamentos manuais.' : 'Dados consistentes com o balancete.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ComparisonAccount title="Conta 3" row={comparisonReport.account3Row} value={signedCurrentBalance(comparisonReport.account3Row)} />
        <ComparisonAccount title="Conta 6" row={comparisonReport.account6Row} value={signedCurrentBalance(comparisonReport.account6Row)} />
        {comparisonReport.mode === 'distribution' && (
          <ComparisonAccount title="Conta 2.4.13" row={comparisonReport.account2413Row} value={signedCurrentBalance(comparisonReport.account2413Row)} />
        )}
        <ComparisonAccount
          title={comparisonReport.mode === 'fallback' ? 'Conta 2.4.13' : 'Conta 1.1.04.019'}
          row={comparisonReport.mode === 'fallback' ? comparisonReport.account2413Row : comparisonReport.distributionRow}
          value={comparisonReport.targetValue}
        />
      </div>
    </div>
  );
}

function ComparisonAccount({
  title,
  row,
  value
}: {
  title: string;
  row?: CompanyReport['rows'][number] | undefined;
  value: number;
}) {
  return (
    <div className="bg-surface-50 border border-surface-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b border-surface-border pb-2">{title}</h5>
      {row ? (
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground truncate" title={row.name}>
            {row.name}
          </p>
          <p className="text-[11px] font-mono text-muted-foreground mb-4">{row.account}</p>
          <div className="flex justify-between items-end mt-6">
            <span className="text-[10px] text-muted-foreground font-bold uppercase">Analisado</span>
            <span className="text-sm font-mono font-bold text-primary">{formatNumberAsBrazilianMoney(value)}</span>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center">
          <span className="text-xs text-muted-foreground italic">Não localizada</span>
        </div>
      )}
    </div>
  );
}

function signedCurrentBalance(row?: CompanyReport['rows'][number]): number {
  if (!row) return 0;
  const value = Math.abs(parseBrazilianMoney(row.currentBalance));
  return balanceNature(row.currentBalance) === 'D' ? -value : value;
}

function comparisonFormula(company: CompanyReport): string {
  const { comparisonReport } = company;
  if (comparisonReport.mode === 'fallback') {
    return '(3 + 6) - 2.4.13';
  }
  return '(3 + 6 + 2.4.13) - 1.1.04.019';
}

function buildCalculationRows(company: CompanyReport) {
  const { comparisonReport } = company;
  const rows = [
    { label: comparisonLabel('Conta 3', comparisonReport.account3Row), value: signedCurrentBalance(comparisonReport.account3Row) },
    { label: comparisonLabel('Conta 6', comparisonReport.account6Row), value: signedCurrentBalance(comparisonReport.account6Row) }
  ];

  if (comparisonReport.mode === 'distribution') {
    rows.push({
      label: comparisonLabel('Conta 2.4.13', comparisonReport.account2413Row),
      value: signedCurrentBalance(comparisonReport.account2413Row)
    });
  }

  rows.push(
    { label: 'Soma Calculada', value: comparisonReport.baseValue },
    {
      label:
        comparisonReport.mode === 'fallback'
          ? comparisonLabel('Conta 2.4.13', comparisonReport.account2413Row)
          : comparisonLabel('Conta 1.1.04.019', comparisonReport.distributionRow),
      value: comparisonReport.targetValue
    },
    { label: 'Diferença', value: comparisonReport.difference }
  );

  return rows;
}

function comparisonLabel(prefix: string, row?: CompanyReport['rows'][number]) {
  return row ? `${prefix} (${row.name})` : prefix;
}

function buildReportMeta(company: CompanyReport, kind: ReportKind) {
  const count = reportOccurrenceCount(company, kind);
  return {
    count,
    hasAttention: count > 0
  };
}

function isAnalysisKind(kind: ReportKind): kind is AnalysisKind {
  return kind.startsWith('analysis');
}
