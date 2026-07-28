import { lazy, Suspense, useMemo, useState } from 'react';
import { CompanyCard } from './components/CompanyCard';
import { CompanyOverviewCard } from './components/CompanyOverviewCard';
import { CompanyReport } from './types';
import { Sidebar } from './components/Sidebar';
import { Dropzone } from './components/Dropzone';
import { SummaryCards } from './components/SummaryCards';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import { useFileProcessing } from './hooks/useFileProcessing';
import { companyOccurrences, companyReportsWithAlerts } from './utils/occurrences';

const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy').then((module) => ({ default: module.PrivacyPolicy })));
const DataSecurity = lazy(() => import('./components/DataSecurity').then((module) => ({ default: module.DataSecurity })));
const LocalProcessingDoc = lazy(() =>
  import('./components/LocalProcessingDoc').then((module) => ({ default: module.LocalProcessingDoc }))
);
const ChatbotFab = lazy(() => import('./components/ChatbotFab').then((module) => ({ default: module.ChatbotFab })));

type View = 'main' | 'privacy' | 'security' | 'docs';

export function App() {
  const [view, setView] = useState<View>('main');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const {
    files,
    reports,
    isProcessing,
    isDragging,
    message,
    processingIndex,
    processingFileName,
    processingPercent,
    totalUnclassified,
    handleFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeFile,
    processFiles,
    clearAll
  } = useFileProcessing();

  const resultsSummary = useMemo(() => buildResultsSummary(reports), [reports]);

  const handleNavigate = (newView: View) => {
    setView(newView);
    setSelectedCompanyId(null);
  };

  const selectedCompany = useMemo(
    () => reports.find(r => r.id === selectedCompanyId) || null,
    [reports, selectedCompanyId]
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      <Sidebar currentView={view} onNavigate={handleNavigate} />

      <div className="flex-1 relative flex flex-col h-full overflow-y-auto overflow-x-hidden">
        <main className="flex-1 w-full max-w-container-max mx-auto px-6 py-8 md:px-12 flex flex-col gap-xl">
          {view === 'main' && (
            <div className="space-y-xl animate-in fade-in duration-500">
              
              {!selectedCompany ? (
                <>
                  <section className="flex flex-col gap-sm">
                    <h1 className="font-display-lg text-primary tracking-tight">Analisador de Balancetes</h1>
                    <p className="text-muted-foreground font-body-md max-w-2xl">
                      Inicie a análise carregando seus arquivos contábeis em PDF para identificação automática de alertas,
                      saldos invertidos e inconsistências.
                    </p>
                  </section>

                  <Dropzone
                    isDragging={isDragging}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onFileChange={handleFiles}
                    files={files}
                    onRemoveFile={removeFile}
                    isProcessing={isProcessing}
                    onProcess={processFiles}
                    onClear={clearAll}
                  />

                  {message && (
                    <div className="p-4 bg-error/10 text-error rounded-xl border border-error/20 flex items-center gap-3 glass-panel">
                      <span className="material-symbols-outlined">error</span>
                      <span className="font-medium">{message}</span>
                    </div>
                  )}

                  {reports.length > 0 && (
                    <section id="results" className="space-y-xl mt-8 pt-8 border-t border-surface-border">
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-bold text-accent uppercase tracking-wider">Resultados da Análise</span>
                        <h2 className="text-2xl font-bold text-foreground">{reports.length} empresa(s) processada(s)</h2>
                      </div>

                      <SummaryCards
                        companiesWithAlerts={resultsSummary.companiesWithAlerts}
                        reportsWithOccurrences={resultsSummary.reportsWithOccurrences}
                        totalOccurrences={resultsSummary.totalOccurrences}
                        totalUnclassified={totalUnclassified}
                      />

                      <div className="mt-8">
                        <div className="flex flex-col gap-2 mb-6">
                          <h3 className="text-xl font-bold text-foreground">Relatórios por Empresa</h3>
                          <p className="text-sm text-muted-foreground">Selecione uma empresa abaixo para detalhar os achados.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {reports.map((report) => (
                            <CompanyOverviewCard 
                              key={report.id} 
                              company={report} 
                              onClick={() => setSelectedCompanyId(report.id)} 
                            />
                          ))}
                        </div>
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <div className="animate-in slide-in-from-right-8 duration-500 fade-in">
                  <button 
                    onClick={() => setSelectedCompanyId(null)}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-semibold mb-6 px-4 py-2 bg-surface border border-surface-border rounded-xl hover:shadow-md transition-all group"
                  >
                    <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">arrow_back</span>
                    Voltar ao Dashboard
                  </button>
                  <CompanyCard company={selectedCompany} />
                </div>
              )}

            </div>
          )}

          <Suspense fallback={<div className="text-muted-foreground flex items-center gap-2"><span className="material-symbols-outlined animate-spin">progress_activity</span> Carregando conteúdo...</div>}>
            {view === 'privacy' && <PrivacyPolicy />}
            {view === 'security' && <DataSecurity />}
            {view === 'docs' && <LocalProcessingDoc />}
          </Suspense>

          {isProcessing && (
            <ProcessingOverlay
              index={processingIndex}
              total={files.length}
              percent={processingPercent}
              fileName={processingFileName}
            />
          )}
        </main>
      </div>

      <Suspense fallback={null}>
        <ChatbotFab reports={reports} isProcessing={isProcessing} />
      </Suspense>
    </div>
  );
}

function buildResultsSummary(reports: CompanyReport[]) {
  let companiesWithAlerts = 0;
  let reportsWithOccurrences = 0;
  let totalOccurrences = 0;

  reports.forEach((report) => {
    const reportCount = companyReportsWithAlerts(report);

    if (reportCount > 0) {
      companiesWithAlerts += 1;
    }

    reportsWithOccurrences += reportCount;
    totalOccurrences += companyOccurrences(report);
  });

  return {
    companiesWithAlerts,
    reportsWithOccurrences,
    totalOccurrences
  };
}
