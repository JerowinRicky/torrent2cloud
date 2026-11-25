import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ShieldCheck, HardDrive, Cpu, AlertTriangle, Save } from 'lucide-react';
import { AdminUser, AdminUserUpdateRequest } from '../../types/admin';
import { updateAdminUserApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface EditUserModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [isActive, setIsActive] = useState(true);
  const [quotaGb, setQuotaGb] = useState(10);
  const [maxJobs, setMaxJobs] = useState(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setRole(user.role);
      setIsActive(user.is_active);
      setQuotaGb(Math.round(user.storage_quota_bytes / (1024 ** 3)));
      setMaxJobs(user.max_active_jobs);
      setErrorMessage(null);
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (payload: AdminUserUpdateRequest) => {
      if (!user) throw new Error('No user selected');
      return updateAdminUserApi(user.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to update user');
    },
  });

  if (!isOpen || !user) return null;

  const isSelf = currentUser?.id === user.id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const payload: AdminUserUpdateRequest = {
      full_name: fullName.trim(),
      role: role,
      is_active: isActive,
      storage_quota_bytes: Math.max(1, quotaGb) * 1024 * 1024 * 1024,
      max_active_jobs: maxJobs,
    };

    updateMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Manage User Governance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs font-mono">
              {user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-700 dark:text-rose-400 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSelf && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>You are editing your own admin account. Role de-escalation and deactivation are locked.</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Role & Permissions
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN')}
                disabled={isSelf}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 shadow-xs"
              >
                <option value="USER">Standard User</option>
                <option value="ADMIN">System Administrator</option>
              </select>
            </div>

            {/* Account Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Account Status
              </label>
              <div className="h-[42px] flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={isSelf}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  <span className="ml-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isActive ? 'Active' : 'Disabled'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Storage Quota */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <HardDrive className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Storage Quota (GB)
              </label>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                {quotaGb} GB
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="500"
              step="1"
              value={quotaGb}
              onChange={(e) => setQuotaGb(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>1 GB</span>
              <span>100 GB</span>
              <span>250 GB</span>
              <span>500 GB</span>
            </div>
          </div>

          {/* Max Active Jobs */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Max Concurrent Active Jobs
              </label>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                {maxJobs} jobs
              </span>
            </div>
            <input
              type="number"
              min="1"
              max="50"
              value={maxJobs}
              onChange={(e) => setMaxJobs(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={updateMutation.isPending}
              className="px-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2 shadow-sm shadow-indigo-600/25 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{updateMutation.isPending ? 'Saving Changes...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
