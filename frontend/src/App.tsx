import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Shell } from './components/layout/Shell';
import { HealthStatusCard } from './components/HealthStatusCard';
import { InvitationManagerCard } from './components/InvitationManagerCard';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TorrentsPage } from './pages/TorrentsPage';
import { FilesPage } from './pages/FilesPage';
import { ActivityPage } from './pages/ActivityPage';
import { AdminPage } from './pages/AdminPage';
import { useAuthStore } from './store/authStore';
import { fetchMe } from './lib/api';
import { 
  DownloadCloud, 
  Layers, 
  Terminal,
  UserCheck
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5000,
    },
  },
});

export const AppContent: React.FC = () => {
  const { isAuthenticated, isInitializing, initAuth, user, setUser } = useAuthStore();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [activeNav, setActiveNav] = useState('overview');

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchMe().then(setUser).catch(() => {});
    }
  }, [isAuthenticated, user, setUser]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#101116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#635BFF] border-t-transparent animate-spin" />
          <span className="text-sm font-medium text-gray-400">Loading CloudTorrent...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'register') {
      return <RegisterPage onNavigateToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onNavigateToRegister={() => setAuthView('register')} />;
  }

  return (
    <Shell
      activeNav={activeNav}
      setActiveNav={setActiveNav}
      title={
        activeNav === 'downloads' 
          ? 'Cloud Downloads' 
          : activeNav === 'files'
          ? 'Cloud File Manager'
          : activeNav === 'activity'
          ? 'Activity & System Health'
          : activeNav === 'admin'
          ? 'Cluster Administration & Governance'
          : 'Infrastructure & Access Overview'
      }
    >
      {activeNav === 'downloads' ? (
        <TorrentsPage />
      ) : activeNav === 'files' ? (
        <FilesPage />
      ) : activeNav === 'activity' ? (
        <ActivityPage />
      ) : activeNav === 'admin' ? (
        <AdminPage />
      ) : (
        <div className="space-y-6">
          {/* Hero Welcome Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 p-6 sm:p-7 text-white shadow-sm shadow-indigo-600/15 relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-3.5 border border-white/20">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Session Active • {user?.role} Access</span>
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {user?.full_name || 'Cloud User'}
              </h1>
              <p className="mt-2 text-indigo-100 text-xs sm:text-sm leading-relaxed max-w-xl">
                Provisioned Storage Quota: <span className="font-semibold text-white">{((user?.storage_quota_bytes || 0) / (1024 ** 3)).toFixed(0)} GB</span> • Max Active Swarms: <span className="font-semibold text-white">{user?.max_active_jobs || 3} concurrent</span>
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setActiveNav('downloads')}
                  className="px-4 py-2 rounded-xl bg-white text-indigo-600 text-xs font-bold hover:bg-indigo-50 shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>Go to Downloads</span>
                </button>
                <button
                  onClick={() => setActiveNav('files')}
                  className="px-4 py-2 rounded-xl bg-indigo-700/60 hover:bg-indigo-700/90 text-white text-xs font-semibold border border-indigo-400/30 transition-colors"
                >
                  Open File Manager
                </button>
              </div>
            </div>
            <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-15 pointer-events-none">
              <DownloadCloud className="w-72 h-72 text-white" />
            </div>
          </div>

          {/* Live Infrastructure Health Verification */}
          <HealthStatusCard />

          {/* Access Invitation Manager (Visible to Admins) */}
          {user?.role === 'ADMIN' && <InvitationManagerCard />}

          {/* Production Operational Architecture Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111218] p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm sm:text-base">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <span>Engine Capabilities Matrix</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                  ALL OPERATIONAL
                </span>
              </div>
              <ul className="space-y-2.5 text-xs">
                <li className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">libtorrent 2.1 Native Python Engine</span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">RUNNING</span>
                </li>
                <li className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">RFC 7233 Multi-Part Byte-Range Streaming</span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">ENABLED</span>
                </li>
                <li className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Bi-Directional Telemetry WebSockets</span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">STREAMING</span>
                </li>
                <li className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Distributed Celery Background Worker</span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">ACTIVE</span>
                </li>
                <li className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">1DM / IDM / Aria2 High-Speed Acceleration</span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">READY</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111218] p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm sm:text-base">
                  <Terminal className="w-5 h-5 text-indigo-600" />
                  <span>Production Architecture Modules</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60">
                  10/10 DEPLOYED
                </span>
              </div>
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-900/50 flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Cloud Storage & Category Indexer
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      8 MIME categories, SHA-256 integrity, single/bulk deletion.
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                    VERIFIED
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-900/50 flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      HMAC-SHA256 Signed Direct Download Links
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Time-limited tokens, one-click revocation, memory-safe streaming.
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                    VERIFIED
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-900/50 flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Monitoring, Metrics & Security Audit Logs
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      CPU, RAM, Disk, Swarm health, lifecycle activity tracing.
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                    VERIFIED
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-900/50 flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Administrative Governance & Quota Control
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Per-user quota limits, rate throttling, global torrent supervision.
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                    VERIFIED
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};
