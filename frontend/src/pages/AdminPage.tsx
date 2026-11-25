import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  ShieldAlert, 
  Settings2, 
  KeyRound, 
  Search, 
  RefreshCw, 
  Play, 
  Pause, 
  XOctagon, 
  Trash2, 
  HardDrive, 
  Cpu, 
  Layers, 
  CheckCircle2, 
  Sliders,
  Save
} from 'lucide-react';

import { 
  fetchAdminUsersApi, 
  fetchAdminTorrentsApi, 
  manageAdminTorrentApi, 
  fetchAdminSettingsApi, 
  updateAdminSettingsApi 
} from '../lib/api';
import { AdminUser } from '../types/admin';
import { EditUserModal } from '../components/admin/EditUserModal';
import { InvitationManagerCard } from '../components/InvitationManagerCard';
import { formatBytes } from './ActivityPage';

export const AdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'torrents' | 'settings' | 'invitations'>('users');

  // Search & Filter state
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<AdminUser | null>(null);
  const [torrentStatusFilter, setTorrentStatusFilter] = useState<string>('ALL');

  // Runtime settings form state
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [settingsSuccessMessage, setSettingsSuccessMessage] = useState<string | null>(null);

  // Queries
  const { data: usersData, isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users', userSearch],
    queryFn: () => fetchAdminUsersApi(userSearch),
    refetchInterval: 10000,
  });

  const { data: torrentsData, isLoading: isLoadingTorrents, refetch: refetchTorrents } = useQuery({
    queryKey: ['admin-torrents', torrentStatusFilter],
    queryFn: () => fetchAdminTorrentsApi(torrentStatusFilter),
    refetchInterval: 5000,
  });

  const { isLoading: isLoadingSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const items = await fetchAdminSettingsApi();
      const map: Record<string, string> = {};
      items.forEach((item) => {
        map[item.key] = item.value;
      });
      setSettingsForm(map);
      return items;
    },
  });

  // Mutations
  const manageTorrentMutation = useMutation({
    mutationFn: ({ jobId, action }: { jobId: string; action: 'pause' | 'resume' | 'cancel' | 'delete' }) =>
      manageAdminTorrentApi(jobId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-torrents'] });
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: Record<string, string>) => updateAdminSettingsApi(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      setSettingsSuccessMessage('Cluster settings and rate limits saved successfully');
      setTimeout(() => setSettingsSuccessMessage(null), 4000);
    },
  });

  // Aggregated Stats
  const totalUsers = usersData?.items.length || 0;
  const totalAllocatedBytes = usersData?.items.reduce((acc, u) => acc + u.storage_quota_bytes, 0) || 0;
  const totalUsedBytes = usersData?.items.reduce((acc, u) => acc + u.used_bytes, 0) || 0;
  const totalActiveTorrents = torrentsData?.items.filter((t) => t.status === 'DOWNLOADING').length || 0;

  const handleSettingChange = (key: string, value: string) => {
    setSettingsForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(settingsForm);
  };

  return (
    <div className="space-y-6">
      {/* Overview Metric Banner Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] p-5 shadow-card">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Registered Accounts</span>
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
            {isLoadingUsers ? '...' : totalUsers}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Across private invite network
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] p-5 shadow-card">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cluster Storage Used</span>
            <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
            {formatBytes(totalUsedBytes)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            of {formatBytes(totalAllocatedBytes)} provisioned quota
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] p-5 shadow-card">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Torrent Swarms</span>
            <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
            {isLoadingTorrents ? '...' : totalActiveTorrents}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {torrentsData?.total || 0} total platform jobs recorded
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] p-5 shadow-card">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Governance Status</span>
            <ShieldAlert className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ENFORCING
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quotas & limits synchronized
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl space-x-1 overflow-x-auto scrollbar-none border border-slate-200/60 dark:border-slate-700/60">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users & Quotas ({usersData?.total || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('torrents')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'torrents'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Global Torrents ({torrentsData?.total || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'settings'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span>Cluster Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'invitations'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Access Invitations</span>
        </button>
      </div>

      {/* TAB 1: USERS & QUOTA GOVERNANCE */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search users by email or name..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              />
            </div>
            <button
              onClick={() => refetchUsers()}
              className="px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-2 self-start sm:self-auto shadow-xs transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Storage Usage & Quota</th>
                    <th className="px-6 py-4">Active Jobs</th>
                    <th className="px-6 py-4">Files</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-400">
                        Loading registered accounts...
                      </td>
                    </tr>
                  ) : usersData?.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-400">
                        No users match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    usersData?.items.map((u) => {
                      const quotaGb = Math.round(u.storage_quota_bytes / (1024 ** 3));
                      const usedPercent = Math.min(100, Math.round((u.used_bytes / u.storage_quota_bytes) * 100));
                      const isNearQuota = usedPercent > 80;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {u.full_name ? u.full_name[0].toUpperCase() : u.email[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {u.full_name || 'Cloud User'}
                                </div>
                                <div className="text-xs text-slate-400 truncate max-w-[180px]">
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              u.role === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50'
                                : 'bg-slate-100 text-slate-700 border-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/60'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                              <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                              <span className={u.is_active ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}>
                                {u.is_active ? 'Active' : 'Disabled'}
                              </span>
                            </span>
                          </td>
                          <td className="px-6 py-4 min-w-[200px]">
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs font-mono">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {formatBytes(u.used_bytes)} / {quotaGb} GB
                                </span>
                                <span className={isNearQuota ? 'text-amber-600 font-bold' : 'text-slate-400'}>
                                  {usedPercent}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-300 ${
                                    isNearQuota ? 'bg-amber-500' : 'bg-indigo-600'
                                  }`}
                                  style={{ width: `${usedPercent}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {u.active_jobs_count}
                            </span>
                            <span className="text-xs text-slate-400"> / {u.max_active_jobs} max</span>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold font-mono text-slate-700 dark:text-slate-300">
                            {u.stored_files_count}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedUserForEdit(u)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors shadow-xs"
                            >
                              Edit Governance
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GLOBAL TORRENTS OVERSIGHT */}
      {activeTab === 'torrents' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="flex items-center space-x-3">
              <select
                value={torrentStatusFilter}
                onChange={(e) => setTorrentStatusFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="DOWNLOADING">Downloading</option>
                <option value="QUEUED">Queued</option>
                <option value="PAUSED">Paused</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
              </select>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {torrentsData?.total || 0} jobs total
              </span>
            </div>

            <button
              onClick={() => refetchTorrents()}
              className="px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-2 self-start sm:self-auto shadow-xs transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Torrent</th>
                    <th className="px-6 py-4">Owner</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Progress & Size</th>
                    <th className="px-6 py-4">Download / Upload</th>
                    <th className="px-6 py-4 text-right">Cluster Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {isLoadingTorrents ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">
                        Loading cluster torrent jobs...
                      </td>
                    </tr>
                  ) : torrentsData?.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">
                        No torrent jobs recorded in this view.
                      </td>
                    </tr>
                  ) : (
                    torrentsData?.items.map((job) => {
                      const progressPct = Math.round(job.progress * 100);
                      return (
                        <tr key={job.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900 dark:text-white truncate max-w-xs">
                              {job.torrent_name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">
                              {job.info_hash}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200/60 dark:border-slate-700/60">
                              {job.user_email}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              job.status === 'DOWNLOADING'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 animate-pulse'
                                : job.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : job.status === 'PAUSED'
                                ? 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300'
                                : job.status === 'QUEUED'
                                ? 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300'
                                : 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 min-w-[180px]">
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs font-mono">
                                <span>{formatBytes(job.downloaded_bytes)} / {formatBytes(job.total_size)}</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{progressPct}%</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${progressPct}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono">
                            <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              ↓ {formatBytes(job.download_speed)}/s
                            </div>
                            <div className="text-slate-400">
                              ↑ {formatBytes(job.upload_speed)}/s
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {job.status === 'DOWNLOADING' && (
                                <button
                                  onClick={() => manageTorrentMutation.mutate({ jobId: job.id, action: 'pause' })}
                                  title="Pause Download"
                                  className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition-colors"
                                >
                                  <Pause className="w-4 h-4 text-amber-500" />
                                </button>
                              )}
                              {job.status === 'PAUSED' && (
                                <button
                                  onClick={() => manageTorrentMutation.mutate({ jobId: job.id, action: 'resume' })}
                                  title="Resume Download"
                                  className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition-colors"
                                >
                                  <Play className="w-4 h-4 text-emerald-600" />
                                </button>
                              )}
                              {(job.status === 'DOWNLOADING' || job.status === 'QUEUED' || job.status === 'PAUSED') && (
                                <button
                                  onClick={() => manageTorrentMutation.mutate({ jobId: job.id, action: 'cancel' })}
                                  title="Cancel Torrent"
                                  className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition-colors"
                                >
                                  <XOctagon className="w-4 h-4 text-rose-500" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to purge torrent "${job.torrent_name}"?`)) {
                                    manageTorrentMutation.mutate({ jobId: job.id, action: 'delete' });
                                  }
                                }}
                                title="Purge Record"
                                className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 shadow-xs transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-rose-500" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLUSTER SETTINGS & LIMITS */}
      {activeTab === 'settings' && (
        <div className="max-w-3xl space-y-6">
          <form onSubmit={handleSaveSettings} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] p-6 shadow-card space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Runtime Cluster Configuration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tune download rate limiting, active worker concurrency, and default provisioning across all users.
              </p>
            </div>

            {settingsSuccessMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/50 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{settingsSuccessMessage}</span>
              </div>
            )}

            {isLoadingSettings ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Loading cluster configuration...
              </div>
            ) : (
            <div className="space-y-4">
              {/* Default Storage Quota */}
              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#13141B]/50 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-900 dark:text-white">
                    Default User Storage Quota (Bytes)
                  </label>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    {formatBytes(parseInt(settingsForm['default_storage_quota_bytes'] || '10737418240', 10))}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Initial quota provisioned when a new user registers through an invite.
                </p>
                <input
                  type="text"
                  value={settingsForm['default_storage_quota_bytes'] || ''}
                  onChange={(e) => handleSettingChange('default_storage_quota_bytes', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                />
              </div>

              {/* Download Speed Limit */}
              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#13141B]/50 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-900 dark:text-white">
                    Global Download Rate Limit (KB/s)
                  </label>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {settingsForm['default_download_rate_limit_kbps'] === '0' ? 'Unlimited' : `${settingsForm['default_download_rate_limit_kbps']} KB/s`}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Global rate limiter for libtorrent background engine. Set 0 for unthrottled gigabit throughput.
                </p>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={settingsForm['default_download_rate_limit_kbps'] || '0'}
                  onChange={(e) => handleSettingChange('default_download_rate_limit_kbps', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                />
              </div>

              {/* Upload Speed Limit */}
              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#13141B]/50 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-900 dark:text-white">
                    Global Upload Rate Limit (KB/s)
                  </label>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 font-mono">
                    {settingsForm['default_upload_rate_limit_kbps'] === '0' ? 'Unlimited' : `${settingsForm['default_upload_rate_limit_kbps']} KB/s`}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Seed choking limit to maintain upstream bandwidth availability for direct HTTPS downloads.
                </p>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={settingsForm['default_upload_rate_limit_kbps'] || '0'}
                  onChange={(e) => handleSettingChange('default_upload_rate_limit_kbps', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                />
              </div>

              {/* Global Concurrent Downloads */}
              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#13141B]/50 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-900 dark:text-white">
                    Global Max Concurrent Active Downloads
                  </label>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    {settingsForm['global_max_concurrent_downloads'] || '10'} workers
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cluster-wide Celery & libtorrent concurrent task allocation ceiling. Excess jobs remain in QUEUED state.
                </p>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settingsForm['global_max_concurrent_downloads'] || '10'}
                  onChange={(e) => handleSettingChange('global_max_concurrent_downloads', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111218] text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                />
              </div>
            </div>
            )}

            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={updateSettingsMutation.isPending}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2 shadow-sm shadow-indigo-600/25 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{updateSettingsMutation.isPending ? 'Applying Limits...' : 'Apply Cluster Limits'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: ACCESS INVITATIONS */}
      {activeTab === 'invitations' && (
        <div className="max-w-4xl">
          <InvitationManagerCard />
        </div>
      )}

      {/* Edit User Modal */}
      <EditUserModal
        user={selectedUserForEdit}
        isOpen={!!selectedUserForEdit}
        onClose={() => setSelectedUserForEdit(null)}
        onSuccess={() => refetchUsers()}
      />
    </div>
  );
};
