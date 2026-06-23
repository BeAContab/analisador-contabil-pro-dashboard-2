import { useEffect, useState } from 'react';
import packageJson from '../../package.json';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  currentView: 'main' | 'privacy' | 'security' | 'docs';
  onNavigate: (view: 'main' | 'privacy' | 'security' | 'docs') => void;
  onNavigateToAccount: () => void;
}

export function Sidebar({ currentView, onNavigate, onNavigateToAccount }: SidebarProps) {
  const { user } = useAuth();
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

  const navItems = [
    { id: 'main', label: 'Dashboard', icon: 'dashboard' },
    { id: 'privacy', label: 'Privacidade', icon: 'policy' },
    { id: 'security', label: 'Segurança', icon: 'security' },
    { id: 'docs', label: 'Instruções', icon: 'description' },
  ] as const;

  return (
    <aside className="w-64 flex-shrink-0 bg-surface border-r border-surface-border flex flex-col h-full z-10 transition-colors duration-300">
      <div className="p-6 border-b border-surface-border">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-accent">monitoring</span>
          Analisador Pro
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-3">Menu</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
              currentView === item.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-surface-border/50 hover:text-foreground'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-surface-border flex flex-col gap-2">
        {/* Botão de acesso à conta do usuário */}
        {user && (
          <button
            onClick={onNavigateToAccount}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-surface-border/50 hover:text-foreground transition-all w-full text-left"
          >
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <span className="material-symbols-outlined text-[16px] ml-auto flex-shrink-0">manage_accounts</span>
          </button>
        )}

        {/* Alternância de tema */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-surface-border/50 hover:text-foreground transition-all w-full"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
          {isDark ? 'Modo Claro' : 'Modo Escuro'}
        </button>

        <div className="text-xs text-muted-foreground text-center pt-1">
          v{packageJson.version}
        </div>
      </div>
    </aside>
  );
}
