import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface AccountPanelProps {
  onNavigateToDashboard: () => void;
}

/** Mapeamento dos tipos de plano para texto exibido em português */
const PLAN_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  annual: 'Anual',
  lifetime: 'Vitalício',
};

/** Mapeamento do status da assinatura para texto e cor em português */
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativo', color: 'text-success bg-success/10 border-success/20' },
  inactive: { label: 'Inativo', color: 'text-muted-foreground bg-muted border-surface-border' },
  canceled: { label: 'Cancelado', color: 'text-error bg-error/10 border-error/20' },
  trialing: { label: 'Período de teste', color: 'text-warning bg-warning/10 border-warning/20' },
  unpaid: { label: 'Pagamento pendente', color: 'text-error bg-error/10 border-error/20' },
};

/**
 * Painel de gerenciamento de conta do usuário.
 * Exibe dados do perfil, status e validade da assinatura,
 * e oferece acesso ao portal de faturamento do Stripe.
 */
export function AccountPanel({ onNavigateToDashboard }: AccountPanelProps) {
  const { user, logout, refreshUser } = useAuth();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [tempName, setTempName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Envia a atualização do nome do usuário para o backend.
   */
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) {
      setError('O nome não pode estar em branco.');
      return;
    }
    setLoadingUpdate(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : 'Erro ao atualizar nome.');
    } finally {
      setLoadingUpdate(false);
    }
  };

  /**
   * Envia as alterações de senha para o backend.
   */
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Todos os campos são obrigatórios.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas novas não coincidem.');
      return;
    }
    setLoadingUpdate(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : 'Erro ao atualizar senha.');
    } finally {
      setLoadingUpdate(false);
    }
  };

  if (!user) return null;

  const status = STATUS_CONFIG[user.subscription_status] ?? STATUS_CONFIG.inactive;
  const planLabel = user.plan_type ? PLAN_LABELS[user.plan_type] ?? user.plan_type : '—';

  /** Formata o timestamp Unix para data legível em português */
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  /** Redireciona o usuário para o portal de faturamento do Stripe */
  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao acessar portal de faturamento.');
    } finally {
      setLoadingPortal(false);
    }
  };

  /** Realiza o logout e redireciona para a tela inicial */
  const handleLogout = async () => {
    setLoadingLogout(true);
    await logout();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">

        {/* Cabeçalho da página */}
        <div className="flex items-center gap-4">
          <button
            onClick={onNavigateToDashboard}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-semibold px-3 py-2 rounded-xl hover:bg-surface-border/50 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Dashboard
          </button>
          <h1 className="text-xl font-bold text-foreground">Minha Conta</h1>
        </div>

        {/* Card de perfil */}
        <div className="bg-surface border border-surface-border rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {/* Botões de Ação Rápida de Perfil */}
          <div className="flex gap-2 mb-6 border-b border-surface-border pb-4">
            <button
              onClick={() => {
                setTempName(user.name);
                setError(null);
                setSuccessMessage(null);
                setIsEditNameOpen(true);
              }}
              className="flex-1 py-2 text-xs font-semibold bg-surface border border-surface-border rounded-xl hover:bg-surface-border/50 text-foreground transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Editar nome
            </button>
            <button
              onClick={() => {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setError(null);
                setSuccessMessage(null);
                setIsChangePasswordOpen(true);
              }}
              className="flex-1 py-2 text-xs font-semibold bg-surface border border-surface-border rounded-xl hover:bg-surface-border/50 text-foreground transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">lock_reset</span>
              Alterar senha
            </button>
          </div>

          <div className="space-y-3">
            {/* Status da assinatura */}
            <div className="flex items-center justify-between py-3 border-b border-surface-border">
              <span className="text-sm text-muted-foreground">Status da assinatura</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                {status.label}
              </span>
            </div>

            {/* Tipo de plano */}
            <div className="flex items-center justify-between py-3 border-b border-surface-border">
              <span className="text-sm text-muted-foreground">Plano atual</span>
              <span className="text-sm font-semibold text-foreground">{planLabel}</span>
            </div>

            {/* Data de validade */}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">
                {user.plan_type === 'lifetime' ? 'Acesso vitalício até' : 'Válido até'}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {user.plan_type === 'lifetime'
                  ? formatDate(user.expires_at)
                  : formatDate(user.expires_at)
                }
              </span>
            </div>
          </div>
        </div>

        {/* Exibição de erro */}
        {error && (
          <div className="flex items-start gap-2 p-4 bg-error/10 border border-error/20 rounded-xl text-error text-sm">
            <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Botão de gerenciamento (apenas para assinaturas Stripe, não para vitalícios) */}
        {user.plan_type !== 'lifetime' && user.stripe_customer_id && (
          <button
            onClick={handleManageSubscription}
            disabled={loadingPortal}
            className="w-full py-3.5 bg-surface border border-surface-border text-foreground font-semibold rounded-xl hover:bg-surface-border/50 hover:border-primary/40 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loadingPortal ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                Abrindo portal...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">credit_card</span>
                Gerenciar assinatura e faturamento
              </>
            )}
          </button>
        )}

        {/* Botão de logout */}
        <button
          onClick={handleLogout}
          disabled={loadingLogout}
          className="w-full py-3.5 bg-error/10 border border-error/20 text-error font-semibold rounded-xl hover:bg-error/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loadingLogout ? (
            <>
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              Saindo...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Sair da conta
            </>
          )}
        </button>
      </div>

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

              {error && (
                <div className="p-3 bg-error/10 border border-error/20 text-error text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{error}</span>
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

              {error && (
                <div className="p-3 bg-error/10 border border-error/20 text-error text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{error}</span>
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
