import React, { useState } from 'react';
import { 
  X, 
  Film, 
  Music, 
  Image as ImageIcon, 
  FileText, 
  Archive, 
  Disc, 
  Code2, 
  File, 
  Copy, 
  Check, 
  Download, 
  Trash2, 
  Calendar,
  Layers,
  FileCode
} from 'lucide-react';
import { StoredFile, FileCategory } from '../../types/storage';

interface FileDetailsModalProps {
  file: StoredFile | null;
  onClose: () => void;
  onDelete: (file: StoredFile) => void;
  onDownload?: (file: StoredFile) => void;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getCategoryIcon(category: FileCategory) {
  switch (category) {
    case 'VIDEOS':
      return <Film className="w-5 h-5 text-purple-500" />;
    case 'AUDIO':
      return <Music className="w-5 h-5 text-pink-500" />;
    case 'IMAGES':
      return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    case 'DOCUMENTS':
      return <FileText className="w-5 h-5 text-blue-500" />;
    case 'ARCHIVES':
      return <Archive className="w-5 h-5 text-amber-500" />;
    case 'DISK_IMAGES':
      return <Disc className="w-5 h-5 text-indigo-500" />;
    case 'CODE':
      return <Code2 className="w-5 h-5 text-cyan-500" />;
    default:
      return <File className="w-5 h-5 text-gray-500" />;
  }
}

export const FileDetailsModal: React.FC<FileDetailsModalProps> = ({
  file,
  onClose,
  onDelete,
  onDownload,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!file) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 shadow-elevated overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3.5 overflow-hidden">
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-200/60 dark:border-slate-700/60">
              {getCategoryIcon(file.category)}
            </div>
            <div className="overflow-hidden">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate tracking-tight" title={file.filename}>
                {file.filename}
              </h3>
              <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                  {file.category}
                </span>
                <span>•</span>
                <span className="font-mono font-medium">{formatBytes(file.file_size)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Details Grid */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>MIME Type</span>
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate font-mono text-xs" title={file.mime_type}>
                {file.mime_type}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Indexed At</span>
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {new Date(file.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Source Torrent Information */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-2.5">
            <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Original Torrent Swarm</span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              {file.torrent_name || 'Direct Cloud File'}
            </div>
            {file.info_hash && (
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-mono bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                <span className="truncate mr-2">Hash: {file.info_hash}</span>
                <button
                  onClick={() => copyToClipboard(file.info_hash!, 'hash')}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white flex-shrink-0 transition-colors"
                  title="Copy hash"
                >
                  {copiedField === 'hash' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Relative & Physical Paths */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Relative Storage Path</div>
            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 text-xs font-mono text-slate-800 dark:text-slate-200 break-all border border-slate-200/60 dark:border-slate-800/60">
              {file.relative_path}
            </div>
          </div>

          {/* SHA-256 Checksum */}
          {file.sha256_hash && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                <span>SHA-256 Checksum</span>
                {copiedField === 'sha' ? (
                  <span className="text-emerald-600 text-[11px] font-semibold flex items-center space-x-1">
                    <Check className="w-3 h-3" />
                    <span>Copied</span>
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 text-xs font-mono text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/60">
                <span className="truncate mr-2">{file.sha256_hash}</span>
                <button
                  onClick={() => copyToClipboard(file.sha256_hash!, 'sha')}
                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                  title="Copy SHA-256"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
          <button
            onClick={() => {
              onDelete(file);
              onClose();
            }}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete File</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => copyToClipboard(window.location.origin + `/api/v1/files/${file.id}`, 'link')}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl shadow-xs transition-colors"
            >
              {copiedField === 'link' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedField === 'link' ? 'Copied' : 'Copy API Link'}</span>
            </button>
            <button
              onClick={() => {
                if (onDownload && file) {
                  onDownload(file);
                }
              }}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 rounded-xl transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Get Download Link</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
