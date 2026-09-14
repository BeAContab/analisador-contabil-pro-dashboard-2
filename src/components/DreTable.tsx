import { DreReport } from '../types';

interface DreTableProps {
  report: DreReport;
}

/**
 * Tabela das linhas cruas da DRE. Diferente de `DataTable` (balancete), as
 * colunas de periodo mudam de quantidade a cada arquivo - por isso os
 * cabecalhos vem de `report.periods`/`report.previousYearLabel` em vez de
 * fixos, e nao ha uma variante generica compartilhada entre os dois (ver
 * "Decisoes de arquitetura" do plano de implementacao da DRE).
 */
export function DreTable({ report }: DreTableProps) {
  const previousYearHeader = report.previousYearLabel || 'Média (ano anterior)';

  return (
    <div className="glass-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[900px]">
          <thead className="bg-surface-50 border-b border-surface-border sticky top-0 backdrop-blur-md z-10">
            <tr>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider">Linha</th>
              {report.periods.map((period) => (
                <th key={period} className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider text-right">
                  {period}
                </th>
              ))}
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider text-right">Total</th>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider text-right">%</th>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider text-right">Média</th>
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider text-right">{previousYearHeader}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface-30">
            {report.lines.length === 0 ? (
              <tr>
                <td colSpan={report.periods.length + 5} className="px-6 py-12 text-center text-muted-foreground italic">
                  Nenhuma linha encontrada.
                </td>
              </tr>
            ) : (
              report.lines.map((line, index) => (
                <tr key={`${line.label}-${index}`} className="hover:bg-primary/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-foreground" style={{ paddingLeft: `${16 + line.level * 20}px` }}>
                    {line.label}
                  </td>
                  {line.periodValues.map((value, valueIndex) => (
                    <td key={valueIndex} className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {value?.raw ?? '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-foreground">{line.total?.raw ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{line.percent?.raw ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{line.average?.raw ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{line.averagePreviousYear?.raw ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
