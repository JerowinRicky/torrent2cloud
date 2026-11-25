import React from 'react';
import { 
  LayoutDashboard, 
  DownloadCloud, 
  FolderTree, 
  Activity, 
  HardDrive, 
  Settings, 
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  CloudLightning,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { logoutApi } from '../../lib/api';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeNav: string;
  setActiveNav: (nav: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
  activeNav,
  setActiveNav
}) => {
  const user = useAuthStore((state) => state.user);

  const navItems: {
    id: string;
    label: string;
    icon: any;
    badge?: string;
    adminOnly?: boolean;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'downloads', label: 'Downloads', icon: DownloadCloud },
    { id: 'files', label: 'Files', icon: FolderTree },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'settings', label: 'Settings', icon: Settings },
    ...(user?.role === 'ADMIN' ? [{ id: 'admin', label: 'Administration', icon: ShieldAlert, adminOnly: true }] : []),
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 ease-in-out border-r
        bg-white dark:bg-[#111218] border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between shadow-[1px_0_4px_rgba(0,0,0,0.02)]
        ${collapsed ? 'w-20' : 'w-64'}`}
    >
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
              <CloudLightning className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white leading-tight">
                  CloudTorrent
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
                  Private Cloud
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm transition-all group relative
                  ${isActive 
                    ? 'bg-indigo-50 text-indigo-600 font-semibold dark:bg-indigo-950/40 dark:text-indigo-300 shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white font-medium'
                  }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${
                  isActive 
                    ? 'text-indigo-600 dark:text-indigo-400' 
                    : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                }`} />
                {!collapsed && (
                  <span className="ml-3 truncate flex-1 text-left">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {item.badge}
                  </span>
                )}
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute right-0 top-2 bottom-2 w-1 bg-indigo-600 rounded-l-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className={`flex items-center justify-between ${collapsed ? 'flex-col space-y-3' : 'px-2 py-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60'}`}>
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs">
              {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'CT'}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center space-x-1.5 truncate">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {user?.full_name || 'Cloud User'}
                  </span>
                  {user?.role === 'ADMIN' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 flex items-center">
                      <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                      ADMIN
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                  {user?.email || ''}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => logoutApi()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
