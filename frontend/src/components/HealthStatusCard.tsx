import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../lib/api';
import { 
  Database, 
  HardDrive, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  Zap,
  Cpu
} from 'lucide-react';

export const HealthStatusCard: React.FC = () => {
  const { data: health, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchHealth,
    refetchInterval: 5000,
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111218] p-6 shadow-card">
      <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800/80">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <span>System Infrastructure Health</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
              Live Health
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time telemetry and validation of FastAPI backend, PostgreSQL, Redis, and storage
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs font-medium">Querying cluster microservices...</span>
        </div>
      ) : error ? (
        <div className="mt-5 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <div className="text-xs">
            <span className="font-bold">Backend Communication Error: </span>
            <span>{error instanceof Error ? error.message : 'Failed to connect to FastAPI'}</span>
          </div>
        </div>
      ) : health ? (
        <div className="mt-5 space-y-5">
          {/* Main Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Database Card */}
            <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>PostgreSQL 18</span>
                </span>
                {health.components.database.status === 'healthy' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="mt-3">
                <div className="text-lg font-extrabold text-slate-900 dark:text-white capitalize">
                  {health.components.database.status}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Latency: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{health.components.database.latency_ms} ms</span>
                </div>
              </div>
            </div>

            {/* Redis Card */}
            <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Redis Broker</span>
                </span>
                {health.components.redis.status === 'healthy' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="mt-3">
                <div className="text-lg font-extrabold text-slate-900 dark:text-white capitalize">
                  {health.components.redis.status}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Latency: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{health.components.redis.latency_ms} ms</span>
                </div>
              </div>
            </div>

            {/* Storage Card */}
            <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-violet-500" />
                  <span>Storage Engine</span>
                </span>
                {health.components.storage.status === 'healthy' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="mt-3">
                <div className="text-lg font-extrabold text-slate-900 dark:text-white capitalize">
                  {health.components.storage.status}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Available: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{health.components.storage.free_gigabytes ?? 0} GB</span>
                </div>
              </div>
            </div>

            {/* Torrent Engine Card */}
            <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-sky-500" />
                  <span>libtorrent Native</span>
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-3">
                <div className="text-lg font-extrabold text-slate-900 dark:text-white capitalize">
                  {health.status === 'healthy' ? 'Active' : 'Degraded'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Cluster: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Online & Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
