import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

interface ShellProps {
  children: React.ReactNode;
  activeNav: string;
  setActiveNav: (nav: string) => void;
  title: string;
}

export const Shell: React.FC<ShellProps> = ({
  children,
  activeNav,
  setActiveNav,
  title
}) => {
  const [collapsed, setCollapsed] = useState(false);
  // Default to main light theme as requested
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('cloudtorrent_theme') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('cloudtorrent_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('cloudtorrent_theme', 'light');
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={`min-h-screen bg-[#F8FAFC] dark:bg-[#0B0C10] text-slate-800 dark:text-slate-100 ${darkMode ? 'dark' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        activeNav={activeNav}
        setActiveNav={setActiveNav}
      />
      <div className={`transition-all duration-300 ease-in-out ${collapsed ? 'pl-20' : 'pl-64'}`}>
        <TopNav
          darkMode={darkMode}
          onToggleTheme={toggleTheme}
          title={title}
        />
        <main className="p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
