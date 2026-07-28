import { CompanyReport } from '../types';
import { reportTabs, reportHasOccurrence } from '../utils/reports';

interface CompanyOverviewCardProps {
  company: CompanyReport;
  onClick: () => void;
}

export function CompanyOverviewCard({ company, onClick }: CompanyOverviewCardProps) {
  const visibleTabs = reportTabs.filter((tab) => reportHasOccurrence(company, tab.kind));
  const hasErrors = company.errors.length > 0;
  const hasUnclassified = company.unclassified.length > 0;
  const hasAlerts = visibleTabs.length > 0 || hasErrors || hasUnclassified;

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
      aria-label={`Ver detalhes de ${company.companyName}`}
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
          {hasAlerts ? `${visibleTabs.length} Alerta(s)` : 'Sem Alertas'}
        </span>
      </div>
      
      <h3 className="text-lg font-bold text-foreground truncate mb-1" title={company.companyName}>
        {company.companyName}
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        CNPJ: {company.cnpj || '-'}
      </p>

      <div className="grid grid-cols-2 gap-4 border-t border-surface-border pt-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Período</p>
          <p className="text-sm font-medium text-foreground">{company.period || '-'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Linhas</p>
          <p className="text-sm font-medium tabular-nums text-foreground">{company.rows.length}</p>
        </div>
      </div>
    </div>
  );
}
