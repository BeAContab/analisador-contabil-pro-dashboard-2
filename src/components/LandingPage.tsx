import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

interface LandingPageProps {
  onNavigateToLogin: () => void;
  onNavigateToSignup: () => void;
  onSelectPlan: (plan: 'monthly' | 'quarterly' | 'annual') => void;
  onNavigateToDashboard: () => void;
}

/** Funcionalidades exibidas na seção de recursos */
const FEATURES = [
  {
    icon: 'upload_file',
    title: 'Upload de Múltiplos PDFs',
    description: 'Carregue vários balancetes contábeis de uma só vez via arrastar e soltar.',
  },
  {
    icon: 'psychology',
    title: 'Análise com Inteligência Artificial',
    description: 'Assistente de IA integrado para consultas e interpretação dos relatórios gerados.',
  },
  {
    icon: 'error',
    title: 'Detecção Automática de Erros',
    description: 'Identifica saldos invertidos, contas sem movimentação e inconsistências contábeis.',
  },
  {
    icon: 'trending_up',
    title: 'Análise de CMV x Receita',
    description: 'Verifica automaticamente a relação entre Custo das Mercadorias Vendidas e a Receita Bruta.',
  },
  {
    icon: 'table_chart',
    title: 'Relatórios por Empresa',
    description: 'Drill-down detalhado por empresa com tabelas ordenáveis, filtráveis e paginadas.',
  },
  {
    icon: 'download',
    title: 'Exportação em PDF e Excel',
    description: 'Exporte os relatórios gerados em formato PDF ou planilha Excel com um clique.',
  },
  {
    icon: 'lock',
    title: 'Processamento 100% Local',
    description: 'Seus arquivos são processados no próprio navegador. Nenhum dado é enviado para servidores.',
  },
  {
    icon: 'dark_mode',
    title: 'Tema Claro e Escuro',
    description: 'Interface adaptável com tema claro ou escuro conforme a preferência do usuário.',
  },
];

/** Configurações dos planos de assinatura */
const PLANS = [
  {
    id: 'monthly' as const,
    name: 'Mensal',
    price: 69.90,
    period: '/mês',
    description: 'Ideal para testar a plataforma',
    highlight: false,
    badge: null,
    savings: null,
    features: ['Acesso completo a todos os recursos', 'Análise ilimitada de PDFs', 'Assistente de IA integrado', 'Exportação PDF e Excel', 'Suporte por e-mail'],
  },
  {
    id: 'quarterly' as const,
    name: 'Trimestral',
    price: 179.90,
    period: '/trimestre',
    pricePerMonth: 59.90,
    description: 'Comprometimento de médio prazo',
    highlight: true,
    badge: 'Mais popular',
    savings: 'Economia de 15%',
    features: ['Tudo do plano Mensal', 'Equivale a R$ 59,90/mês', 'Economia de R$ 29,80 no período', 'Acesso garantido por 3 meses', 'Suporte prioritário'],
  },
  {
    id: 'annual' as const,
    name: 'Anual',
    price: 599.90,
    period: '/ano',
    pricePerMonth: 49.90,
    description: 'Melhor custo-benefício',
    highlight: false,
    badge: 'Melhor valor',
    savings: 'Economia de 28%',
    features: ['Tudo do plano Trimestral', 'Equivale a R$ 49,90/mês', 'Economia de R$ 238,90 no ano', 'Acesso garantido por 12 meses', 'Suporte VIP'],
  },
];

/**
 * Componente da Landing Page do SaaS.
 * Exibe seções de hero, funcionalidades, planos de preços e rodapé.
 */
export function LandingPage({ onNavigateToLogin, onNavigateToSignup, onSelectPlan, onNavigateToDashboard }: LandingPageProps) {
  const { isAuthenticated, user, logout, refreshUser, hasActiveSubscription } = useAuth();
  const [billingHover, setBillingHover] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark') || 
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [tempName, setTempName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Realiza o logout do usuário e fecha o menu dropdown.
   */
  const handleLogoutClick = async () => {
    setIsDropdownOpen(false);
    await logout();
  };

  /**
   * Envia a alteração de nome do usuário para a API e atualiza a sessão local.
   */
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) {
      setErrorMessage('O nome não pode estar em branco.');
      return;
    }
    setLoadingUpdate(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tempName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar nome.');
      
      await refreshUser();
      setSuccessMessage('Nome atualizado com sucesso!');
      setTimeout(() => {
        setIsEditNameOpen(false);
        setSuccessMessage(null);
      }, 1500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao atualizar nome.');
    } finally {
      setLoadingUpdate(false);
    }
  };

  /**
   * Valida e envia a nova senha informada para a API.
   */
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage('Todos os campos são obrigatórios.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('As senhas novas não coincidem.');
      return;
    }
    setLoadingUpdate(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar senha.');
      
      setSuccessMessage('Senha atualizada com sucesso!');
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setSuccessMessage(null);
      }, 1500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao atualizar senha.');
    } finally {
      setLoadingUpdate(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Barra de Navegação ── */}
      <header className="sticky top-0 z-50 bg-surface-80 backdrop-blur-sm border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 cursor-pointer select-none text-left focus:outline-none animate-in fade-in duration-300"
          >
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white text-[20px]">monitoring</span>
            </div>
            <span className="text-lg font-bold text-foreground hover:text-primary transition-colors">Analisador Contábil Pro</span>
          </button>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#funcionalidades" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#planos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
          </nav>
          <div className="flex items-center gap-3">
            {/* Botão de Alternar Tema (Claro/Escuro) */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="w-9 h-9 rounded-xl border border-surface-border hover:bg-surface-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all mr-1"
              title={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 bg-surface border border-surface-border hover:border-primary/45 rounded-xl transition-all font-semibold text-sm text-foreground"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-bold text-primary">{user?.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="max-w-[110px] truncate hidden sm:inline">{user?.name}</span>
                  <span className="material-symbols-outlined text-[18px] text-muted-foreground">keyboard_arrow_down</span>
                </button>
                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-surface border border-surface-border rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-3 border-b border-surface-border">
                        <p className="font-bold text-foreground truncate">{user?.name}</p>
                        <p className="text-xs text-muted-foreground truncate mb-2">{user?.email}</p>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border ${
                          hasActiveSubscription 
                            ? 'text-success bg-success/10 border-success/20 animate-pulse' 
                            : 'text-error bg-error/10 border-error/20'
                        }`}>
                          {hasActiveSubscription ? 'ASSINATURA ATIVA' : 'ASSINATURA INATIVA'}
                        </span>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            if (hasActiveSubscription) {
                              onNavigateToDashboard();
                            } else {
                              document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface-border/50 flex items-center gap-2 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px] text-muted-foreground">dashboard</span>
                          Ir para o Dashboard
                        </button>
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setTempName(user?.name || '');
                            setErrorMessage(null);
                            setSuccessMessage(null);
                            setIsEditNameOpen(true);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface-border/50 flex items-center gap-2 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px] text-muted-foreground">edit</span>
                          Editar Nome
                        </button>
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                            setErrorMessage(null);
                            setSuccessMessage(null);
                            setIsChangePasswordOpen(true);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface-border/50 flex items-center gap-2 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px] text-muted-foreground">lock_reset</span>
                          Alterar Senha
                        </button>
                      </div>
                      <div className="border-t border-surface-border pt-1">
                        <button
                          onClick={handleLogoutClick}
                          className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error/5 flex items-center gap-2 transition-colors font-semibold"
                        >
                          <span className="material-symbols-outlined text-[18px]">logout</span>
                          Sair da conta
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={onNavigateToLogin}
                  className="px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-border rounded-xl transition-all"
                >
                  Entrar
                </button>
                <button
                  onClick={onNavigateToSignup}
                  className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover transition-all shadow-sm"
                >
                  Começar grátis
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative py-24 md:py-36 px-6 overflow-hidden">
        {/* Gradiente de fundo decorativo */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-56 h-56 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-sm font-semibold mb-8">
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            Análise inteligente para balancetes Athenas
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6">
            Analise seus balancetes{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              em segundos
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Desenvolvido exclusivamente para balancetes exportados do sistema <strong>Athenas3000</strong>.
            Identifique automaticamente saldos invertidos, inconsistências e alertas nos seus arquivos PDF contábeis em segundos.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onNavigateToSignup}
              className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-bold text-lg rounded-2xl hover:bg-primary-hover transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">rocket_launch</span>
              Criar conta gratuita
            </button>
            <button
              onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto px-8 py-4 bg-surface border border-surface-border text-foreground font-semibold text-lg rounded-2xl hover:bg-surface-border/30 transition-all flex items-center justify-center gap-2"
            >
              Ver planos e preços
              <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
            </button>
          </div>

          {/* Indicadores de confiança */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-success text-[18px]">verified</span>
              Processamento 100% local
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-success text-[18px]">lock</span>
              Dados nunca enviados para servidores
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-success text-[18px]">cancel</span>
              Cancele quando quiser
            </div>
          </div>
        </div>
      </section>

      {/* ── Seção de Funcionalidades ── */}
      <section id="funcionalidades" className="py-24 px-6 bg-surface/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-accent uppercase tracking-widest">Funcionalidades</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Uma plataforma completa para análise contábil, projetada para otimizar o trabalho de contadores e escritórios de contabilidade.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="group p-6 bg-surface border border-surface-border rounded-2xl hover:border-primary/40 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <span className="material-symbols-outlined text-primary text-[24px]">{feature.icon}</span>
                </div>
                <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Seção de Planos ── */}
      <section id="planos" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-accent uppercase tracking-widest">Planos e Preços</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
              Escolha o plano ideal para você
            </h2>
            <p className="text-muted-foreground text-lg">
              Valor base de R$ 69,90/mês. Economize ao assinar por períodos maiores.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                onMouseEnter={() => setBillingHover(plan.id)}
                onMouseLeave={() => setBillingHover(null)}
                className={`relative rounded-2xl border-2 p-8 flex flex-col transition-all duration-300 ${
                  plan.highlight
                    ? 'border-primary bg-primary/5 shadow-xl scale-105'
                    : billingHover === plan.id
                    ? 'border-primary/40 bg-surface shadow-lg'
                    : 'border-surface-border bg-surface'
                }`}
              >
                {/* Badge de destaque */}
                {plan.badge && (
                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                    plan.highlight ? 'bg-primary text-primary-foreground' : 'bg-accent text-white'
                  }`}>
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-end gap-1">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-4xl font-bold text-foreground">
                      {plan.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-muted-foreground text-sm mb-1">{plan.period}</span>
                  </div>
                  {plan.savings && (
                    <span className="inline-block mt-2 px-3 py-1 bg-success/10 text-success text-xs font-bold rounded-full">
                      {plan.savings}
                    </span>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="material-symbols-outlined text-success text-[18px] mt-0.5 flex-shrink-0">check_circle</span>
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onSelectPlan(plan.id)}
                  className={`w-full py-3 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                      : 'bg-surface-border/50 text-foreground hover:bg-primary hover:text-primary-foreground hover:-translate-y-0.5'
                  }`}
                >
                  Assinar agora
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[16px]">lock</span>
            Pagamento 100% seguro processado pelo Stripe. Cancele a qualquer momento.
          </p>
        </div>
      </section>

      {/* ── Rodapé ── */}
      <footer className="border-t border-surface-border py-10 px-6 bg-surface">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[16px]">monitoring</span>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Analisador Contábil Pro</p>
              <p className="text-xs text-muted-foreground">© 2026 Barreira & Associados. Todos os direitos reservados.</p>
            </div>
          </div>
          {!isAuthenticated && (
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <button onClick={onNavigateToLogin} className="hover:text-foreground transition-colors">Entrar</button>
              <button onClick={onNavigateToSignup} className="hover:text-foreground transition-colors">Criar conta</button>
            </div>
          )}
        </div>
      </footer>

      {/* ── Modal de Editar Nome ── */}
      {isEditNameOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">edit</span>
              Editar Nome
            </h3>
            <form onSubmit={handleUpdateName} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Seu Nome</label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-surface-border rounded-xl focus:outline-none focus:border-primary text-foreground text-sm"
                  required
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-error/10 border border-error/20 text-error text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-success/10 border border-success/20 text-success text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditNameOpen(false)}
                  className="flex-1 py-3 border border-surface-border text-foreground font-semibold rounded-xl hover:bg-surface-border/50 text-sm transition-all"
                  disabled={loadingUpdate}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary-hover text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                  disabled={loadingUpdate}
                >
                  {loadingUpdate ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      Salvando...
                    </>
                  ) : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Alterar Senha ── */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">lock_reset</span>
              Alterar Senha
            </h3>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Senha Atual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-surface-border rounded-xl focus:outline-none focus:border-primary text-foreground text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nova Senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-surface-border rounded-xl focus:outline-none focus:border-primary text-foreground text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-surface-border rounded-xl focus:outline-none focus:border-primary text-foreground text-sm"
                  required
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-error/10 border border-error/20 text-error text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-success/10 border border-success/20 text-success text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="flex-1 py-3 border border-surface-border text-foreground font-semibold rounded-xl hover:bg-surface-border/50 text-sm transition-all"
                  disabled={loadingUpdate}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary-hover text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                  disabled={loadingUpdate}
                >
                  {loadingUpdate ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      Salvando...
                    </>
                  ) : 'Alterar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
