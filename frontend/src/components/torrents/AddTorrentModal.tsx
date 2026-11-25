import React, { useState } from 'react';
import { 
  X, 
  Magnet, 
  Upload, 
  FolderTree, 
  HardDrive, 
  Check, 
  AlertCircle, 
  FileText, 
  ArrowRight,
  CheckSquare,
  Square
} from 'lucide-react';
import { inspectMagnetApi, inspectTorrentFileApi, createTorrentJobApi } from '../../lib/api';
import { TorrentInspectResponse } from '../../types/torrent';
import { useAuthStore } from '../../store/authStore';

interface AddTorrentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddTorrentModal: React.FC<AddTorrentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<'magnet' | 'file'>('magnet');
  const [magnetInput, setMagnetInput] = useState('');
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);

  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectData, setInspectData] = useState<TorrentInspectResponse | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInspectMagnet = async () => {
    if (!magnetInput.trim()) return;
    setIsInspecting(true);
    setErrorMessage(null);
    try {
      const data = await inspectMagnetApi(magnetInput.trim());
      setInspectData(data);
      setSelectedIndices(data.files.map((f) => f.file_index));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to inspect magnet link');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileObject(file);
    setIsInspecting(true);
    setErrorMessage(null);

    // Read base64 for creation payload
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(',')[1];
      setFileBase64(b64);
      try {
        const data = await inspectTorrentFileApi(file);
        setInspectData(data);
        setSelectedIndices(data.files.map((f) => f.file_index));
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Invalid .torrent file');
      } finally {
        setIsInspecting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleFile = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const toggleAll = () => {
    if (!inspectData) return;
    if (selectedIndices.length === inspectData.files.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(inspectData.files.map((f) => f.file_index));
    }
  };

  const calculateSelectedSize = () => {
    if (!inspectData || !inspectData.files.length) return inspectData?.total_size || 0;
    return inspectData.files
      .filter((f) => selectedIndices.includes(f.file_index))
      .reduce((sum, f) => sum + f.file_size, 0);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createTorrentJobApi({
        magnet_uri: activeTab === 'magnet' ? magnetInput.trim() : undefined,
        torrent_file_b64: activeTab === 'file' ? (fileBase64 || undefined) : undefined,
        selected_indices: selectedIndices,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create download job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const selectedSize = calculateSelectedSize();
  const userQuota = user?.storage_quota_bytes || 50 * 1024 * 1024 * 1024;
  const isOverQuota = selectedSize > userQuota;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-elevated animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
              <Magnet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Add Torrent Download
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Submit magnet links or upload .torrent files for remote retrieval
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Method Selector Tabs */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <button
              onClick={() => {
                setActiveTab('magnet');
                setInspectData(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-2
                ${activeTab === 'magnet' ? 'bg-white dark:bg-[#181920] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>Magnet Link</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('file');
                setInspectData(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-2
                ${activeTab === 'file' ? 'bg-white dark:bg-[#181920] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>.torrent File Upload</span>
            </button>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Option A: Magnet Input */}
          {activeTab === 'magnet' && (
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Paste Magnet URI
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={magnetInput}
                  onChange={(e) => setMagnetInput(e.target.value)}
                  placeholder="magnet:?xt=urn:btih:..."
                  className="flex-1 px-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-xs"
                />
                <button
                  onClick={handleInspectMagnet}
                  disabled={isInspecting || !magnetInput.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xs shadow-indigo-600/20"
                >
                  {isInspecting ? 'Inspecting...' : 'Inspect'}
                </button>
              </div>
            </div>
          )}

          {/* Option B: File Upload */}
          {activeTab === 'file' && (
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Upload .torrent File
              </label>
              <label className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {fileObject ? fileObject.name : 'Click to browse or drop .torrent file here'}
                </span>
                <span className="text-[11px] text-slate-400 mt-1">Accepts standard .torrent (max 10MB)</span>
                <input
                  type="file"
                  accept=".torrent"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Metadata Inspector Card */}
          {inspectData && (
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-md">
                    {inspectData.name}
                  </h4>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    Hash: {inspectData.info_hash}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {formatBytes(selectedSize)}
                  </span>
                  <div className="text-[11px] text-slate-400">
                    {selectedIndices.length} / {inspectData.files.length || 1} files selected
                  </div>
                </div>
              </div>

              {/* File Selection Tree */}
              {inspectData.files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                      <FolderTree className="w-3.5 h-3.5 text-slate-400" />
                      <span>Available Files</span>
                    </span>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-indigo-600 hover:text-indigo-700 font-semibold text-[11px]"
                    >
                      {selectedIndices.length === inspectData.files.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-[#111218]">
                    {inspectData.files.map((file) => {
                      const isChecked = selectedIndices.includes(file.file_index);
                      return (
                        <div
                          key={file.file_index}
                          onClick={() => toggleFile(file.file_index)}
                          className="px-3.5 py-2 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            )}
                            <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate text-slate-800 dark:text-slate-200 font-medium">
                              {file.filename}
                            </span>
                          </div>
                          <span className="text-slate-500 dark:text-slate-400 ml-2 font-mono flex-shrink-0 text-[11px]">
                            {formatBytes(file.file_size)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Storage Quota Preview */}
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Available Storage Quota: {formatBytes(userQuota)}</span>
                </span>
                {isOverQuota ? (
                  <span className="font-bold text-rose-600">Exceeds remaining quota</span>
                ) : (
                  <span className="font-bold text-emerald-600 flex items-center space-x-1">
                    <Check className="w-3 h-3" />
                    <span>Within Quota Limit</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!inspectData || isSubmitting || isOverQuota || (inspectData.files.length > 0 && selectedIndices.length === 0)}
            className="flex items-center space-x-2 px-5 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Starting...' : 'Start Cloud Download'}</span>
            {!isSubmitting && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
