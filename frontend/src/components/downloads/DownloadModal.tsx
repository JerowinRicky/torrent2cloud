import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  ShieldCheck, 
  Clock, 
  Terminal, 
  AlertCircle,
  Trash2,
  Zap
} from 'lucide-react';
import { StoredFile } from '../../types/storage';
import { DownloadLink } from '../../types/download';
import { generateDownloadLinkApi, revokeDownloadLinkApi } from '../../lib/api';
import { formatBytes } from '../files/FileDetailsModal';

interface DownloadModalProps {
  file: StoredFile | null;
  onClose: () => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({ file, onClose }) => {
  const [expiresInHours, setExpiresInHours] = useState<number>(24);
  const [downloadLink, setDownloadLink] = useState<DownloadLink | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeCliTab, setActiveCliTab] = useState<'curl' | 'wget' | 'aria2c'>('curl');

  useEffect(() => {
    if (!file) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    generateDownloadLinkApi(file.id, expiresInHours)
      .then((link) => {
        if (isMounted) {
          setDownloadLink(link);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to generate download token');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [file, expiresInHours]);

  if (!file) return null;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const getCliCommand = () => {
    if (!downloadLink) return '';
    const url = downloadLink.download_url;
    switch (activeCliTab) {
      case 'curl':
        return `curl -C - -O "${url}"`;
      case 'wget':
        return `wget -c "${url}"`;
      case 'aria2c':
        return `aria2c -c -x 4 "${url}"`;
    }
  };

  const handleRevoke = async () => {
    if (!downloadLink) return;
    try {
      await revokeDownloadLinkApi(downloadLink.link_id);
      setDownloadLink(null);
      setError('Download link has been revoked.');
    } catch (e: any) {
      setError(e.message || 'Failed to revoke link');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 shadow-elevated overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-1.5 truncate">
                <span>Secure HTTPS Direct Download</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {file.filename} ({formatBytes(file.file_size)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Lifetime Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Link Expiration Window</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '1 Hour', hours: 1 },
                { label: '6 Hours', hours: 6 },
                { label: '24 Hours', hours: 24 },
                { label: '7 Days', hours: 168 },
              ].map((opt) => (
                <button
                  key={opt.hours}
                  type="button"
                  onClick={() => setExpiresInHours(opt.hours)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition-all ${
                    expiresInHours === opt.hours
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs shadow-indigo-600/25'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading or Error */}
          {isLoading && (
            <div className="p-6 text-center text-xs text-slate-400">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto mb-2" />
              <span>Generating cryptographically signed token...</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {downloadLink && !isLoading && (
            <div className="space-y-4">
              {/* Signed Download URL Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Signed Direct URL</span>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>HMAC-SHA256 Signed</span>
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 truncate select-all shadow-xs">
                    {downloadLink.download_url}
                  </div>
                  <button
                    onClick={() => copyToClipboard(downloadLink.download_url, 'url')}
                    className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs shadow-indigo-600/20 flex-shrink-0 transition-all"
                  >
                    {copiedType === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedType === 'url' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>Expires: {new Date(downloadLink.expires_at).toLocaleString()}</span>
                  <span>Access count: {downloadLink.download_count}</span>
                </div>
              </div>

              {/* Terminal CLI Snippet */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                    <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Remote CLI Download (Curl / Wget / Aria2)</span>
                  </div>
                  {/* CLI Tabs */}
                  <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    {(['curl', 'wget', 'aria2c'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveCliTab(tab)}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors ${
                          activeCliTab === tab
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <div className="p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] break-all border border-slate-800 pr-16 select-all shadow-xs">
                    {getCliCommand()}
                  </div>
                  <button
                    onClick={() => copyToClipboard(getCliCommand(), 'cli')}
                    className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Copy command"
                  >
                    {copiedType === 'cli' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Feature Badges */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-start space-x-2.5">
                <Zap className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
                <span>
                  <strong>1DM, IDM & Multi-Part Acceleration Ready:</strong> RFC 7233 Byte-Ranges and HTTP 206 Partial Content are enabled. Download accelerators will split this file into multiple parallel parts for maximum throughput.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between">
          {downloadLink ? (
            <button
              onClick={handleRevoke}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Revoke Link</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Close
            </button>
            {downloadLink && (
              <a
                href={downloadLink.download_url}
                download={file.filename}
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs shadow-indigo-600/20 rounded-xl transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Now</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
