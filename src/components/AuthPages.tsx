import { useState, FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';

type AuthMode = 'login' | 'signup';

interface AuthPagesProps {
  initialMode?: AuthMode;
  onSuccess: () => void;
  onNavigateToLanding: () => void;
}

/**
 * Componente unificado de Login e Cadastro.
 * Alterna entre os dois modos via abas, com validação de formulário
 * e exibição de erros contextuais em português.
 */
export function AuthPages({ initialMode = 'login', onSuccess, onNavigateToLanding }: AuthPagesProps) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Estados dos campos de formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const isLogin = mode === 'login';

  /** Limpa o formulário ao alternar entre os modos */
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  /** Processa o envio do formulário de login ou cadastro */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validação de confirmação de senha no cadastro
    if (!isLogin && password !== confirmPassword) {
      setError('As senhas não coincidem. Verifique e tente novamente.');
      return;
    }

    if (!isLogin && password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Gradiente de fundo decorativo */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute top-20 left-1/3 w-64 h-64 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-1/3 w-48 h-48 bg-accent/8 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Cabeçalho com logo */}
        <div className="text-center mb-8">
          <button
            onClick={onNavigateToLanding}
            className="inline-flex items-center gap-3 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all">
              <span className="material-symbols-outlined text-white text-[24px]">monitoring</span>
            </div>
            <div className="text-left">
              <p className="font-bold text-foreground text-lg leading-tight">Analisador Contábil Pro</p>
              <p className="text-xs text-muted-foreground">Barreira & Associados</p>
            </div>
          </button>
        </div>

        {/* Card do formulário */}
        <div className="bg-surface border border-surface-border rounded-2xl shadow-xl p-8">
          {/* Abas de alternância Login / Cadastro */}
          <div className="flex bg-muted rounded-xl p-1 mb-8">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                isLogin
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                !isLogin
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo de nome - apenas no cadastro */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Nome completo
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]">person</span>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required={!isLogin}
                    placeholder="Seu nome"
                    className="w-full pl-10 pr-4 py-3 bg-background border border-surface-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>
            )}

            {/* Campo de e-mail */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]">mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-background border border-surface-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Campo de senha */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Senha
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]">lock</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-background border border-surface-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Campo de confirmação de senha - apenas no cadastro */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Confirmar senha
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]">lock_reset</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required={!isLogin}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-background border border-surface-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>
            )}

            {/* Exibição de erro */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-sm">
                <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Botão de envio */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary-hover transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  {isLogin ? 'Entrando...' : 'Criando conta...'}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">
                    {isLogin ? 'login' : 'person_add'}
                  </span>
                  {isLogin ? 'Entrar na plataforma' : 'Criar minha conta'}
                </>
              )}
            </button>
          </form>

          {/* Link de rodapé para voltar à landing */}
          <div className="mt-6 text-center">
            <button
              onClick={onNavigateToLanding}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
