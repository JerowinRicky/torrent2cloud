import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Server, 
  Database, 
  Zap, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  ArrowDownCircle, 
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  Radio
} from 'lucide-react';
import { fetchActivityEventsApi, fetchSystemMetricsApi } from '../lib/api';
import { ActivitySeverity } from '../types/activity';
import { useAuthStore } from '../store/authStore';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(seconds % 60)}s`;
}

export function getSeverityBadge(severity: ActivitySeverity) {
  switch (severity) {
    case 'SUCCESS':
      return {
        bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/50',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    case 'WARNING':
      return {
        bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/50',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
    case 'ERROR':
    case 'CRITICAL':
      return {
        bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/50',
        icon: <AlertCircle className="w-3.5 h-3.5" />,
      };
    default:
      return {
        bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-800/50',
        icon: <Info className="w-3.5 h-3.5" />,
      };
  }
}

export const ActivityPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [clusterWide, setClusterWide] = useState(user?.role === 'ADMIN');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Real-time system metrics query (refreshes every 3s)
  const { data: metrics, isFetching: isMetricsFetching, refetch: refetchMetrics } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => fetchSystemMetricsApi(),
    refetchInterval: 3000,
  });

  // Activity events query (refreshes every 5s)
  const { data: activityData, isLoading: isActivityLoading, refetch: refetchActivity, isFetching } = useQuery({
    queryKey: ['activity-events', selectedSeverity, searchQuery, clusterWide, page],
    queryFn: () => fetchActivityEventsApi({
      severity: selectedSeverity,
      search: searchQuery,
      cluster_wide: clusterWide,
      page,
      page_size: pageSize,
    }),
    refetchInterval: 5000,
  });

  const events = activityData?.items || [];
  const totalEvents = activityData?.total || 0;
  const totalPages = activityData?.total_pages || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2.5">
            <span>Activity & System Health</span>
            <span className="flex items-center space-x-1.5 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Cluster Active</span>
            </span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time infrastructure performance, worker health, and security audit log
          </p>
        </div>

        <button
          onClick={() => {
            refetchMetrics();
            refetchActivity();
          }}
          disabled={isFetching || isMetricsFetching}
          className="p-2.5 self-start sm:self-auto rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          title="Refresh metrics and logs"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching || isMetricsFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Cluster Hardware & Infrastructure Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CPU Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>CPU Load</span>
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono">
                {metrics.cpu.cores_count} {metrics.cpu.cores_count === 1 ? 'core' : 'cores'}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
              {metrics.cpu.usage_percent}%
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  metrics.cpu.usage_percent > 85 ? 'bg-rose-500' : metrics.cpu.usage_percent > 65 ? 'bg-amber-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${Math.min(100, metrics.cpu.usage_percent)}%` }}
              />
            </div>
          </div>

          {/* Memory Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                <Server className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Memory Allocation</span>
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono">
                {metrics.memory.usage_percent}%
              </span>
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
              {formatBytes(metrics.memory.used_bytes)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Total {formatBytes(metrics.memory.total_bytes)} • {formatBytes(metrics.memory.available_bytes)} free
            </div>
          </div>

          {/* Disk Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Storage Mount</span>
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono">
                {metrics.disk.usage_percent}%
              </span>
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
              {formatBytes(metrics.disk.used_bytes)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Total {formatBytes(metrics.disk.total_bytes)} • {formatBytes(metrics.disk.free_bytes)} free
            </div>
          </div>

          {/* Torrent Engine Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Torrent Engine</span>
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/50">
                {metrics.engine.active_torrents} active
              </span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold font-mono pt-1">
              <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
                <ArrowDownCircle className="w-3.5 h-3.5" />
                <span>{formatBytes(metrics.engine.global_download_speed)}/s</span>
              </div>
              <div className="flex items-center space-x-1 text-indigo-600 dark:text-indigo-400">
                <ArrowUpCircle className="w-3.5 h-3.5" />
                <span>{formatBytes(metrics.engine.global_upload_speed)}/s</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {metrics.engine.total_peers} peers • {metrics.engine.downloading_torrents} downloading
            </div>
          </div>
        </div>
      )}

      {/* Infrastructure Services Health Strip */}
      {metrics && (
        <div className="p-3.5 px-5 rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 shadow-card flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-5">
            <div className="flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-slate-500 dark:text-slate-400">PostgreSQL 18:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Connected</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Radio className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="text-slate-500 dark:text-slate-400">Redis Broker:</span>
              <span className={`font-semibold ${metrics.workers.redis_connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                {metrics.workers.redis_connected ? 'Active' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="text-slate-500 dark:text-slate-400">Uptime:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                {formatUptime(metrics.workers.uptime_seconds)}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Heartbeat: {new Date(metrics.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Activity Log Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Severity filter tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl space-x-1 overflow-x-auto scrollbar-none border border-slate-200/60 dark:border-slate-700/60">
          {[
            { id: 'ALL', label: 'All Severities' },
            { id: 'SUCCESS', label: 'Success' },
            { id: 'INFO', label: 'Info' },
            { id: 'WARNING', label: 'Warnings' },
            { id: 'ERROR', label: 'Errors' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedSeverity(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                selectedSeverity === tab.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Cluster Wide Admin Toggle */}
        <div className="flex items-center space-x-2">
          {user?.role === 'ADMIN' && (
            <button
              type="button"
              onClick={() => {
                setClusterWide(!clusterWide);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                clusterWide
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50'
                  : 'bg-white dark:bg-[#111218] text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              Cluster Wide Audit
            </button>
          )}

          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit events..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Activity Events Timeline Feed */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] shadow-card overflow-hidden">
        {isActivityLoading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading audit event log...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <Activity className="w-8 h-8 text-slate-400 mx-auto opacity-40" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              No activity events found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              User and system lifecycle actions will be displayed here in real time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {events.map((ev) => {
              const badge = getSeverityBadge(ev.severity as ActivitySeverity);
              return (
                <div 
                  key={ev.id}
                  className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex items-start space-x-3.5 text-xs"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${badge.bg}`}>
                    {badge.icon}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          {ev.title}
                        </span>
                        {ev.entity_type && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                            {ev.entity_type}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          {ev.event_type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1 flex-shrink-0 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(ev.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 break-words leading-relaxed">
                      {ev.description}
                    </p>

                    {ev.user_name && (
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 pt-0.5">
                        <span>Initiated by:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{ev.user_name}</span>
                        {ev.ip_address && <span className="font-mono text-[10px]">• IP: {ev.ip_address}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {totalEvents > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing {Math.min(totalEvents, (page - 1) * pageSize + 1)} to {Math.min(totalEvents, page * pageSize)} of {totalEvents} events
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
