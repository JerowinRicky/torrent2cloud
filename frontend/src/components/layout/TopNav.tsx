import React from 'react';
import { Search, Bell, Sun, Moon, ShieldCheck, Activity } from 'lucide-react';

interface TopNavProps {
  darkMode: boolean;
  onToggleTheme: () => void;
  title: string;
}

export const TopNav: React.FC<TopNavProps> = ({
  darkMode,
  onToggleTheme,
  title
}) => {
  return (
    <header className="h-16 px-6 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#111218]/85 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between shadow-xs">
      <div className="flex items-center space-x-4">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h1>
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs font-semibold shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Core Operational</span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Search Input with Shortcut badge */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search downloads, files..."
            className="w-72 pl-9 pr-10 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-2xs"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </div>

        {/* Live Telemetry Indicator */}
        <div className="hidden sm:flex items-center space-x-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-medium px-2 py-1">
          <Activity className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-[11px] font-mono text-slate-500">127.0.0.1:8000</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5" />}
        </button>

        {/* Notifications */}
        <button className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white relative transition-colors">
          <Bell className="w-4.5 h-4.5" />
          <span className="w-2 h-2 rounded-full bg-indigo-600 absolute top-2 right-2 ring-2 ring-white dark:ring-[#111218]" />
        </button>
      </div>
    </header>
  );
};
