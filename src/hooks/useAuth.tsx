import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

/** Estrutura do usuário autenticado no sistema */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  plan_type: 'monthly' | 'quarterly' | 'annual' | 'lifetime' | null;
  subscription_status: 'active' | 'inactive' | 'canceled' | 'trialing' | 'unpaid';
  expires_at: number | null;
  stripe_customer_id: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasActiveSubscription: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Hook para consumir o contexto de autenticação.
 * Lança erro se usado fora do AuthProvider.
 */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

/**
 * Provedor de contexto de autenticação.
 * Gerencia o estado global do usuário logado, verificando a sessão
 * via cookie HTTP-only no endpoint /api/auth/me.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /** Verifica a sessão atual consultando o endpoint de validação */
  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Verifica a sessão ao montar o componente
  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  /** Realiza login e atualiza o estado do usuário */
  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer login.');
    setUser(data);
  };

  /** Cria nova conta e loga automaticamente */
  const signup = async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao criar conta.');
    setUser(data);
  };

  /** Realiza logout e limpa o estado do usuário */
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  // Regra de negócio: assinatura é considerada ativa apenas quando o status é 'active'
  const hasActiveSubscription = user?.subscription_status === 'active';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        hasActiveSubscription,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
