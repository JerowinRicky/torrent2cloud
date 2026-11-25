import React, { useState } from 'react';
import { 
  Pause, 
  Play, 
  X, 
  Trash2, 
  DownloadCloud, 
  Users, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { TorrentJob } from '../../types/torrent';

interface TorrentCardProps {
  job: TorrentJob;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry?: (id: string) => void;
  onPriorityChange?: (id: string, priority: number) => void;
}

export const TorrentCard: React.FC<TorrentCardProps> = ({
  job,
  onPause,
  onResume,
  onCancel,
  onDelete,
  onRetry,
  onPriorityChange,
}) => {
  const [expanded, setExpanded] = useState(false);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DOWNLOADING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/60 flex items-center space-x-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            <span>Downloading</span>
          </span>
        );
      case 'QUEUED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 flex items-center space-x-1.5">
            <Clock className="w-3 h-3" />
            <span>Queued</span>
          </span>
        );
      case 'PAUSED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 flex items-center space-x-1.5">
            <Pause className="w-3 h-3" />
            <span>Paused</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Completed</span>
          </span>
        );
      case 'FETCHING_METADATA':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/60 flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-ping" />
            <span>Fetching Metadata</span>
          </span>
        );
      case 'CANCELED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200">
            Canceled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 flex items-center space-x-1.5">
            <AlertTriangle className="w-3 h-3" />
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111218] p-5 shadow-card transition-all hover:border-slate-300 dark:hover:border-slate-700">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-md">
              {job.torrent_name}
            </h4>
            {getStatusBadge(job.status)}

            {/* Priority Badge & Quick Tweak */}
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
              <span>P{job.priority}</span>
              {onPriorityChange && job.status === 'QUEUED' && (
                <div className="flex items-center ml-0.5">
                  <button 
                    onClick={() => onPriorityChange(job.id, Math.min(10, job.priority + 1))}
                    disabled={job.priority >= 10}
                    className="p-0.5 hover:text-indigo-600 disabled:opacity-30"
                    title="Increase Priority"
                  >
                    <ArrowUp className="w-2.5 h-2.5" />
                  </button>
                  <button 
                    onClick={() => onPriorityChange(job.id, Math.max(1, job.priority - 1))}
                    disabled={job.priority <= 1}
                    className="p-0.5 hover:text-indigo-600 disabled:opacity-30"
                    title="Decrease Priority"
                  >
                    <ArrowDown className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Retry counter indicator if previously retried */}
            {job.retry_count > 0 && (
              <span className="text-[10px] text-slate-400 font-mono">
                (Retry {job.retry_count}/{job.max_retries})
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-1 truncate">
            {job.info_hash}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          {job.status === 'DOWNLOADING' && (
            <button
              onClick={() => onPause(job.id)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200/60 dark:border-slate-800"
              title="Pause download"
            >
              <Pause className="w-4 h-4 text-amber-500" />
            </button>
          )}

          {job.status === 'PAUSED' && (
            <button
              onClick={() => onResume(job.id)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200/60 dark:border-slate-800"
              title="Resume download"
            >
              <Play className="w-4 h-4 text-emerald-500" />
            </button>
          )}

          {/* Retry Button for Failed or Canceled Jobs */}
          {['CANCELED', 'FAILED'].includes(job.status) && onRetry && (
            <button
              onClick={() => onRetry(job.id)}
              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors border border-indigo-200/60"
              title="Retry download job"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {['DOWNLOADING', 'PAUSED', 'FETCHING_METADATA', 'QUEUED'].includes(job.status) && (
            <button
              onClick={() => onCancel(job.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200/60 dark:border-slate-800"
              title="Cancel download"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {['COMPLETED', 'CANCELED', 'FAILED'].includes(job.status) && (
            <button
              onClick={() => onDelete(job.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200/60 dark:border-slate-800"
              title="Delete from list"
            >
              <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-500" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-bold text-slate-900 dark:text-white">
            {job.status === 'QUEUED' ? 'Waiting in queue' : `${job.progress.toFixed(1)}% complete`}
          </span>
          <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            {formatBytes(job.downloaded_bytes)} / {formatBytes(job.total_size)}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              job.status === 'COMPLETED' ? 'bg-emerald-500' : job.status === 'QUEUED' ? 'bg-amber-400' : 'bg-indigo-600'
            }`}
            style={{ width: `${job.status === 'QUEUED' ? 100 : Math.min(100, Math.max(0, job.progress))}%` }}
          />
        </div>
      </div>

      {/* Telemetry Metrics */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center space-x-4">
          {job.status === 'QUEUED' ? (
            <span className="flex items-center space-x-1.5 text-amber-600 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Prioritized download queue (Priority {job.priority})</span>
            </span>
          ) : (
            <>
              <span className="flex items-center space-x-1.5 font-mono text-emerald-600 font-semibold">
                <DownloadCloud className="w-3.5 h-3.5 text-indigo-600" />
                <span>↓ {formatSpeed(job.download_speed)}</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>{job.peers_connected} peers</span>
              </span>
              {job.eta_seconds && (
                <span className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{Math.round(job.eta_seconds / 60)} min ETA</span>
                </span>
              )}
            </>
          )}
        </div>

        {/* Files Accordion Trigger */}
        {job.files && job.files.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center space-x-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors font-medium text-xs"
          >
            <span>{job.files.length} files</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Collapsible Files List */}
      {expanded && job.files && job.files.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
          {job.files.map((file) => (
            <div key={file.id} className="py-2 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 truncate min-w-0">
                <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                  {file.filename}
                </span>
              </div>
              <span className="text-slate-400 font-mono text-[11px] ml-2 flex-shrink-0">
                {formatBytes(file.file_size)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
