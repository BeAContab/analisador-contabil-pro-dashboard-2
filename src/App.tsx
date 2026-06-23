import { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { CompanyCard } from './components/CompanyCard';
import { CompanyOverviewCard } from './components/CompanyOverviewCard';
import { CompanyReport } from './types';
import { Sidebar } from './components/Sidebar';
import { Dropzone } from './components/Dropzone';
import { SummaryCards } from './components/SummaryCards';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import { useFileProcessing } from './hooks/useFileProcessing';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LandingPage } from './components/LandingPage';
import { AuthPages } from './components/AuthPages';
import { AccountPanel } from './components/AccountPanel';

const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy').then((module) => ({ default: module.PrivacyPolicy })));
const DataSecurity = lazy(() => import('./components/DataSecurity').then((module) => ({ default: module.DataSecurity })));
const LocalProcessingDoc = lazy(() =>
  import('./components/LocalProcessingDoc').then((module) => ({ default: module.LocalProcessingDoc }))
);
const ChatbotFab = lazy(() => import('./components/ChatbotFab').then((module) => ({ default: module.ChatbotFab })));

/** Conjunto de todas as visualizações possíveis da aplicação */
type View = 'landing' | 'login' | 'signup' | 'paywall' | 'account' | 'main' | 'privacy' | 'security' | 'docs';

/**
 * Componente raiz interno que consome o contexto de autenticação.
 * Gerencia a navegação entre as views e as proteções de acesso.
 */
function AppInner() {
  const { isAuthenticated, hasActiveSubscription, loading, user } = useAuth();
  const [view, setView] = useState<View>('landing');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  // Plano pré-selecionado pelo usuário na landing page antes de fazer login
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

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

  /**
   * Regra de negócio de navegação:
   * Após o carregamento da sessão, direciona o usuário para a view correta
   * conforme seu estado de autenticação e assinatura.
   */
  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      // Usuário não autenticado: mantém na landing, login ou signup
      if (!['landing', 'login', 'signup'].includes(view)) {
        setView('landing');
      }
      return;
    }

    // Usuário autenticado mas sem assinatura ativa
    if (!hasActiveSubscription) {
      if (!['paywall', 'account'].includes(view)) {
        setView('paywall');
      }
      return;
    }

    // Usuário autenticado com assinatura ativa
    if (['landing', 'login', 'signup', 'paywall'].includes(view)) {
      setView('main');
    }
  }, [loading, isAuthenticated, hasActiveSubscription]);

  /** Navega para uma view de dashboard, respeitando as regras de acesso */
  const handleNavigate = (newView: 'main' | 'privacy' | 'security' | 'docs') => {
    setView(newView);
    setSelectedCompanyId(null);
  };

  const selectedCompany = useMemo(
    () => reports.find(r => r.id === selectedCompanyId) || null,
    [reports, selectedCompanyId]
  );

  /**
   * Inicia o fluxo de assinatura: redireciona para o Stripe Checkout.
   * Se o usuário não estiver autenticado, salva o plano e redireciona para signup.
   */
  const handleSelectPlan = async (plan: 'monthly' | 'quarterly' | 'annual') => {
    if (!isAuthenticated) {
      setPendingPlan(plan);
      setView('signup');
      return;
    }
    await redirectToCheckout(plan);
  };

  const redirectToCheckout = async (plan: string) => {
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      console.error('Erro ao criar sessão de checkout:', e);
    }
  };

  // Redireciona o usuário autenticado para a view correspondente ao seu status de assinatura
  const handleGoToDashboard = () => {
    if (hasActiveSubscription) {
      setView('main');
    } else {
      setView('paywall');
    }
  };

  // Após login/signup, se houver um plano pendente, inicia o checkout automaticamente.
  // Se não houver, direciona para o dashboard ou paywall de forma segura.
  const handleAuthSuccess = async () => {
    if (pendingPlan) {
      await redirectToCheckout(pendingPlan);
      setPendingPlan(null);
    } else {
      setView(hasActiveSubscription ? 'main' : 'paywall');
    }
  };

  // Exibe indicador de carregamento enquanto verifica a sessão
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-white text-[24px]">monitoring</span>
          </div>
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  // ── Views públicas ──
  if (view === 'landing') {
    return (
      <LandingPage
        onNavigateToLogin={() => setView('login')}
        onNavigateToSignup={() => setView('signup')}
        onSelectPlan={handleSelectPlan}
        onNavigateToDashboard={handleGoToDashboard}
      />
    );
  }

  if (view === 'login') {
    return (
      <AuthPages
        initialMode="login"
        onSuccess={handleAuthSuccess}
        onNavigateToLanding={() => setView('landing')}
      />
    );
  }

  if (view === 'signup') {
    return (
      <AuthPages
        initialMode="signup"
        onSuccess={handleAuthSuccess}
        onNavigateToLanding={() => setView('landing')}
      />
    );
  }

  // ── Tela de Paywall: usuário autenticado mas sem assinatura ──
  if (view === 'paywall') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-warning text-[32px]">lock</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Assinatura necessária</h1>
            <p className="text-muted-foreground">
              Olá, <strong>{user?.name}</strong>! Para acessar o Analisador Contábil Pro, você precisa de uma assinatura ativa.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setView('landing')}
              className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary-hover transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">star</span>
              Ver planos e assinar
            </button>
            <button
              onClick={() => setView('account')}
              className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Gerenciar minha conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Painel de conta ──
  if (view === 'account') {
    return (
      <AccountPanel
        onNavigateToDashboard={() => setView(hasActiveSubscription ? 'main' : 'paywall')}
      />
    );
  }

  // ── Dashboard principal (requer assinatura ativa) ──
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      <Sidebar currentView={view as 'main' | 'privacy' | 'security' | 'docs'} onNavigate={handleNavigate} onNavigateToAccount={() => setView('account')} />

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

          {isProcessing && processingIndex > 0 && (
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

/**
 * Componente raiz da aplicação.
 * Envolve toda a árvore de componentes com o AuthProvider
 * para disponibilizar o contexto de autenticação globalmente.
 */
export function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function buildResultsSummary(reports: CompanyReport[]) {
  let companiesWithAlerts = 0;
  let reportsWithOccurrences = 0;
  let totalOccurrences = 0;

  reports.forEach((report) => {
    const comparisonOccurrence = report.comparisonReport.isAttention ? 1 : 0;
    const analysisOccurrences = report.analysisReports.map((analysis) => ({
      reportCount: analysis.isAttention ? 1 : 0,
      rowCount: analysis.rows.length > 0 ? analysis.rows.length : analysis.isAttention ? 1 : 0
    }));

    const reportCount =
      (report.invertedRows.length > 0 ? 1 : 0) +
      (report.zeroMovementRows.length > 0 ? 1 : 0) +
      comparisonOccurrence +
      analysisOccurrences.reduce((sum, item) => sum + item.reportCount, 0);

    const occurrenceCount =
      report.invertedRows.length +
      report.zeroMovementRows.length +
      comparisonOccurrence +
      analysisOccurrences.reduce((sum, item) => sum + item.rowCount, 0);

    if (reportCount > 0) {
      companiesWithAlerts += 1;
    }

    reportsWithOccurrences += reportCount;
    totalOccurrences += occurrenceCount;
  });

  return {
    companiesWithAlerts,
    reportsWithOccurrences,
    totalOccurrences
  };
}
