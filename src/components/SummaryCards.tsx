interface SummaryCardsProps {
  companiesWithAlerts: number;
  reportsWithOccurrences: number;
  totalOccurrences: number;
  totalUnclassified: number;
}

export function SummaryCards({ 
  companiesWithAlerts, 
  reportsWithOccurrences, 
  totalOccurrences, 
  totalUnclassified 
}: SummaryCardsProps) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 auto-rows-[minmax(160px,auto)] animate-in fade-in duration-700 slide-in-from-bottom-2">
      {/* Principal Bento Box - Empresas com Alerta */}
      <div className={`md:col-span-2 rounded-3xl p-6 sm:p-8 flex flex-col justify-between overflow-hidden relative group transition-all duration-500 hover:shadow-xl ${
        companiesWithAlerts > 0 
          ? 'bg-error text-error-foreground shadow-lg shadow-error/15' 
          : 'bg-success text-success-foreground shadow-lg shadow-success/15'
      }`}>
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700 pointer-events-none"></div>
        <div className="flex justify-between items-start relative z-10">
          <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-md">
            <span className="material-symbols-outlined text-[18px]">
              {companiesWithAlerts > 0 ? 'warning' : 'verified_user'}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">Status Geral</span>
          </div>
          <span className="material-symbols-outlined text-white/30 text-[80px] absolute right-0 -top-4 group-hover:rotate-6 transition-transform duration-500 pointer-events-none">
            domain
          </span>
        </div>
        <div className="mt-8 relative z-10">
          <div className="text-[64px] sm:text-[80px] leading-none font-bold tabular-nums tracking-tighter">
            {companiesWithAlerts}
          </div>
          <p className="text-lg opacity-90 font-medium mt-2">Empresas com Alertas</p>
        </div>
      </div>

      {/* Relatórios Bento Box */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col justify-between group hover:border-primary/50 hover:shadow-lg transition-all duration-300">
        <div className="flex justify-between items-start">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
            <span className="material-symbols-outlined">description</span>
          </div>
        </div>
        <div className="mt-8">
          <div className="text-5xl font-bold tabular-nums text-foreground tracking-tight">{reportsWithOccurrences}</div>
          <p className="text-sm text-muted-foreground font-medium mt-2">Relatórios Afetados</p>
        </div>
      </div>

      {/* Ocorrências Bento Box */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col justify-between group hover:border-accent/50 hover:shadow-lg transition-all duration-300">
        <div className="flex justify-between items-start">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center group-hover:scale-110 group-hover:bg-accent group-hover:text-accent-foreground transition-all duration-300">
            <span className="material-symbols-outlined">analytics</span>
          </div>
        </div>
        <div className="mt-8">
          <div className="text-5xl font-bold tabular-nums text-foreground tracking-tight">{totalOccurrences}</div>
          <p className="text-sm text-muted-foreground font-medium mt-2">Total de Ocorrências</p>
        </div>
      </div>

      {/* Linhas não classificadas Bento Box */}
      <div className={`md:col-span-2 glass-panel p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all duration-300 hover:shadow-lg ${
        totalUnclassified > 0 ? 'hover:border-warning/50' : 'hover:border-success/50'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:rotate-12 ${
            totalUnclassified > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
          }`}>
            <span className="material-symbols-outlined text-[28px]">
              {totalUnclassified > 0 ? 'help_outline' : 'check_circle'}
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Atenção Estrutural</p>
            <p className="text-lg text-foreground font-medium">Linhas do balancete não classificadas</p>
          </div>
        </div>
        <div className="text-5xl font-bold tabular-nums text-foreground tracking-tight">
          {totalUnclassified}
        </div>
      </div>
    </section>
  );
}
