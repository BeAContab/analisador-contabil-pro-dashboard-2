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
    { id: 'privacy', label: 'Privacy Policy', icon: 'policy' },
    { id: 'security', label: 'Data Security', icon: 'security' },
    { id: 'docs', label: 'Documentation', icon: 'description' },
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

      <div className="p-4 border-t border-surface-border flex flex-col gap-4">
        <button
          onClick={() => setIsDark(!isDark)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-surface-border/50 hover:text-foreground transition-all w-full"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
          {isDark ? 'Modo Claro' : 'Modo Escuro'}
        </button>
        <div className="text-xs text-muted-foreground text-center">
          v{packageJson.version}
        </div>
      </div>
    </aside>
  );
}
