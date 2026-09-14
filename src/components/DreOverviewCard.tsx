import { DreReport } from '../types';

interface DreOverviewCardProps {
  report: DreReport;
  onClick: () => void;
}

export function DreOverviewCard({ report, onClick }: DreOverviewCardProps) {
  const attentionCount = report.analysisReports.filter((analysis) => analysis.isAttention).length;
  const hasAlerts = attentionCount > 0 || report.errors.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      aria-label={`Ver detalhes da DRE de ${report.companyName}`}
      className={`glass-panel p-6 cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        hasAlerts ? 'hover:border-error/40' : 'hover:border-success/40'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-sm ${
          hasAlerts ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
        }`}>
          <span className="material-symbols-outlined text-[24px]">
            {hasAlerts ? 'warning' : 'verified_user'}
          </span>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
          hasAlerts ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
        }`}>
          {hasAlerts ? `${attentionCount} Alerta(s)` : 'Sem Alertas'}
        </span>
      </div>

      <h3 className="text-lg font-bold text-foreground truncate mb-1" title={report.companyName}>
        {report.companyName}
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        CNPJ: {report.cnpj || '-'}
      </p>

      <div className="grid grid-cols-2 gap-4 border-t border-surface-border pt-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Períodos</p>
          <p className="text-sm font-medium text-foreground truncate" title={report.periods.join(', ')}>
            {report.periods.join(', ') || '-'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Linhas</p>
          <p className="text-sm font-medium tabular-nums text-foreground">{report.lines.length}</p>
        </div>
      </div>
    </div>
  );
}
