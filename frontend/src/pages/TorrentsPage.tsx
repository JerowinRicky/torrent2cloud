import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  DownloadCloud, 
  RefreshCw,
  Layers,
  Cpu,
  UserCheck
} from 'lucide-react';
import { 
  fetchTorrentsApi, 
  pauseTorrentApi, 
  resumeTorrentApi, 
  cancelTorrentApi, 
  deleteTorrentApi,
  retryTorrentApi,
  updateTorrentPriorityApi,
  fetchQueueStatsApi
} from '../lib/api';
import { TorrentCard } from '../components/torrents/TorrentCard';
import { AddTorrentModal } from '../components/torrents/AddTorrentModal';
import { useTorrentTelemetry } from '../hooks/useTorrentTelemetry';

export const TorrentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'QUEUED' | 'COMPLETED' | 'PAUSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Real-time telemetry via WebSocket with fallback to HTTP polling
  const { isConnected: isLiveConnected, isConnecting: isWsConnecting } = useTorrentTelemetry();

  // Fast 3s polling fallback when disconnected, relaxed 15s refetch when WebSocket is live
  const { data: torrents, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['torrents', filter],
    queryFn: () => fetchTorrentsApi(filter),
    refetchInterval: isLiveConnected ? 15000 : 3000,
  });

  // Poll queue statistics
  const { data: queueStats } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: () => fetchQueueStatsApi(),
    refetchInterval: 5000,
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => pauseTorrentApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => resumeTorrentApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelTorrentApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTorrentApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => retryTorrentApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  const priorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: number }) => 
      updateTorrentPriorityApi(id, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  const filteredTorrents = (torrents || []).filter((job) =>
    job.torrent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.info_hash.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <span>Cloud Torrent Downloads</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
              libtorrent 2.1
            </span>
            {isLiveConnected ? (
              <span className="flex items-center space-x-1.5 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Socket</span>
              </span>
            ) : isWsConnecting ? (
              <span className="flex items-center space-x-1.5 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Connecting...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200">
                <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                <span>HTTP Polling</span>
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Active, queued and archived remote cloud downloads with real-time speed telemetry
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 shadow-xs transition-colors"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Download</span>
          </button>
        </div>
      </div>

      {/* Queue Health & Capacity Banner */}
      {queueStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 flex items-center space-x-3 shadow-card">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Your Active Jobs</div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {queueStats.user_active} / {queueStats.user_limit} allowed
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 flex items-center space-x-3 shadow-card">
            <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 flex items-center justify-center flex-shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cluster Capacity</div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {queueStats.global_active} / {queueStats.global_limit} workers
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 flex items-center space-x-3 shadow-card">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Download Queue</div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {queueStats.user_queued} yours ({queueStats.total_queued} total)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Segmented Tabs */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl self-start border border-slate-200/60 dark:border-slate-800">
          {(['ALL', 'ACTIVE', 'QUEUED', 'COMPLETED', 'PAUSED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize
                ${filter === tab ? 'bg-white dark:bg-[#181920] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
            >
              {tab.toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search downloads..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-white dark:bg-[#111218] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Torrent Downloads Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center space-y-3">
          <RefreshCw className="w-7 h-7 animate-spin text-indigo-600" />
          <span className="text-xs font-medium">Loading active cloud torrents...</span>
        </div>
      ) : filteredTorrents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center flex flex-col items-center justify-center space-y-3 bg-white/50 dark:bg-transparent">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
            <DownloadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              No torrent downloads found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              {searchQuery ? 'No downloads match your search query.' : 'Submit a magnet link or upload a .torrent file to start downloading to your private cloud.'}
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs shadow-indigo-600/20 transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Download</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredTorrents.map((job) => (
            <TorrentCard
              key={job.id}
              job={job}
              onPause={(id) => pauseMutation.mutate(id)}
              onResume={(id) => resumeMutation.mutate(id)}
              onCancel={(id) => cancelMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onRetry={(id) => retryMutation.mutate(id)}
              onPriorityChange={(id, priority) => priorityMutation.mutate({ id, priority })}
            />
          ))}
        </div>
      )}

      {/* Add Torrent Modal */}
      <AddTorrentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['torrents'] });
          queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
        }}
      />
    </div>
  );
};
