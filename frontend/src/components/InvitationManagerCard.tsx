import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  KeyRound, 
  Plus, 
  Copy, 
  Check, 
  Clock, 
  UserCheck, 
  ShieldAlert 
} from 'lucide-react';
import { fetchInvitationsApi, createInvitationApi } from '../lib/api';

export const InvitationManagerCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [targetEmail, setTargetEmail] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: invitations, isLoading } = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: fetchInvitationsApi,
  });

  const createMutation = useMutation({
    mutationFn: (email?: string) => createInvitationApi(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      setTargetEmail('');
    },
  });

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111218] p-6 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800/80">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            <span>Invitation System (Admin)</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60">
              Private Access
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Generate and distribute cryptographic registration codes for private users
          </p>
        </div>

        {/* Quick Create Invitation */}
        <div className="flex items-center space-x-2">
          <input
            type="email"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="Assign to email (optional)"
            className="w-48 sm:w-60 px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-xs"
          />
          <button
            onClick={() => createMutation.mutate(targetEmail || undefined)}
            disabled={createMutation.isPending}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xs shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{createMutation.isPending ? 'Generating...' : 'New Invite'}</span>
          </button>
        </div>
      </div>

      {/* Invitations Table */}
      <div className="mt-5">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading invitations...</div>
        ) : !invitations || invitations.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center space-y-2">
            <ShieldAlert className="w-6 h-6 text-slate-300 dark:text-slate-700" />
            <span>No invitation codes created yet. Generate one above to invite users.</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200/70 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Assigned Email</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-[#111218]">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-200">
                      {inv.code}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {inv.email || <span className="text-slate-400 italic">Open invitation</span>}
                    </td>
                    <td className="py-3 px-4">
                      {inv.is_claimed ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 text-[11px] font-semibold">
                          <UserCheck className="w-3 h-3" />
                          <span>Claimed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 text-[11px] font-semibold">
                          <Clock className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!inv.is_claimed && (
                        <button
                          onClick={() => handleCopy(inv.code)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center space-x-1"
                        >
                          {copiedCode === inv.code ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-semibold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-500" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
