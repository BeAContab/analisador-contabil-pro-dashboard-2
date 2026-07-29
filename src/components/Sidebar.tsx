import { useEffect, useState } from 'react';
import packageJson from '../../package.json';

interface SidebarProps {
  currentView: 'main' | 'privacy' | 'security' | 'docs';
  onNavigate: (view: 'main' | 'privacy' | 'security' | 'docs') => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark') ||
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Barra fina so com icones quando recolhido - nunca some por completo, para
  // nao perder a navegacao de vista (mesmo padrao de persistencia do isDark).
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const navItems = [
    { id: 'main', label: 'Dashboard', icon: 'dashboard' },
    { id: 'privacy', label: 'Privacy Policy', icon: 'policy' },
    { id: 'security', label: 'Data Security', icon: 'security' },
    { id: 'docs', label: 'Documentation', icon: 'description' },
  ] as const;

  return (
    <aside
      className={`${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0 bg-surface border-r border-surface-border flex flex-col h-full z-10 transition-all duration-300`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Pular para o conteúdo principal
      </a>

      <div className={`p-6 border-b border-surface-border flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-accent" aria-hidden="true">monitoring</span>
          <span className={isCollapsed ? 'sr-only' : ''}>Analisador Pro</span>
        </h1>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 p-4 space-y-2 overflow-y-auto">
        <div className={`text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-3 ${isCollapsed ? 'sr-only' : ''}`}>
          Menu
        </div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={currentView === item.id ? 'page' : undefined}
            title={isCollapsed ? item.label : undefined}
            className={`w-full flex items-center gap-3 rounded-lg transition-all duration-200 text-sm font-medium ${
              isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
            } ${
              currentView === item.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-surface-border/50 hover:text-foreground'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{item.icon}</span>
            <span className={isCollapsed ? 'sr-only' : ''}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-surface-border flex flex-col gap-4">
        <button
          onClick={() => setIsCollapsed((current) => !current)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          className={`flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-surface-border/50 hover:text-foreground transition-all w-full ${
            isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            {isCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
          <span className={isCollapsed ? 'sr-only' : ''}>Recolher menu</span>
        </button>
        <button
          onClick={() => setIsDark(!isDark)}
          aria-pressed={isDark}
          title={isCollapsed ? (isDark ? 'Modo Claro' : 'Modo Escuro') : undefined}
          className={`flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-surface-border/50 hover:text-foreground transition-all w-full ${
            isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
          <span className={isCollapsed ? 'sr-only' : ''}>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>
        <div className={`text-xs text-muted-foreground text-center ${isCollapsed ? 'sr-only' : ''}`}>
          v{packageJson.version}
        </div>
      </div>
    </aside>
  );
}
