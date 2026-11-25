import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  RefreshCw, 
  Trash2, 
  Copy, 
  Check, 
  AlertTriangle, 
  Eye, 
  Download,
  ChevronLeft, 
  ChevronRight,
  HardDrive,
  FileBox,
  CheckSquare,
  Square
} from 'lucide-react';
import { 
  fetchFilesApi, 
  fetchStorageStatsApi, 
  deleteFileApi, 
  bulkDeleteFilesApi, 
  syncStorageApi 
} from '../lib/api';
import { StoredFile, FileCategory } from '../types/storage';
import { FileDetailsModal, formatBytes, getCategoryIcon } from '../components/files/FileDetailsModal';
import { DownloadModal } from '../components/downloads/DownloadModal';

const CATEGORIES: { id: string; label: string; cat?: FileCategory }[] = [
  { id: 'ALL', label: 'All Files' },
  { id: 'VIDEOS', label: 'Videos', cat: 'VIDEOS' },
  { id: 'AUDIO', label: 'Audio', cat: 'AUDIO' },
  { id: 'IMAGES', label: 'Images', cat: 'IMAGES' },
  { id: 'DOCUMENTS', label: 'Documents', cat: 'DOCUMENTS' },
  { id: 'ARCHIVES', label: 'Archives', cat: 'ARCHIVES' },
  { id: 'DISK_IMAGES', label: 'Disk Images', cat: 'DISK_IMAGES' },
  { id: 'CODE', label: 'Code', cat: 'CODE' },
  { id: 'OTHER', label: 'Other', cat: 'OTHER' },
];

export const FilesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'file_size' | 'filename'>('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [inspectedFile, setInspectedFile] = useState<StoredFile | null>(null);
  const [fileToDownload, setFileToDownload] = useState<StoredFile | null>(null);
  const [fileToDelete, setFileToDelete] = useState<StoredFile | null>(null);
  const [deleteParentTorrent, setDeleteParentTorrent] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Storage metrics query
  const { data: storageStats, refetch: refetchStats } = useQuery({
    queryKey: ['storage-stats'],
    queryFn: () => fetchStorageStatsApi(),
    refetchInterval: 10000,
  });

  // Stored files query
  const { data: filesData, isLoading: isFilesLoading, refetch: refetchFiles, isFetching } = useQuery({
    queryKey: ['files', selectedCategory, searchQuery, sortBy, order, page],
    queryFn: () => fetchFilesApi({
      category: selectedCategory,
      search: searchQuery,
      sort_by: sortBy,
      order,
      page,
      page_size: pageSize,
    }),
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: ({ fileId, deleteTorrent }: { fileId: string; deleteTorrent: boolean }) =>
      deleteFileApi(fileId, deleteTorrent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      setFileToDelete(null);
      setDeleteParentTorrent(false);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteFilesApi(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
      setSelectedFileIds([]);
      setIsBulkDeleteModalOpen(false);
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => syncStorageApi(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    },
  });

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/api/v1/files/${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const files = filesData?.items || [];
  const totalFiles = filesData?.total || 0;
  const totalPages = filesData?.total_pages || 1;

  const handleSelectAll = () => {
    if (selectedFileIds.length === files.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(files.map((f) => f.id));
    }
  };

  const toggleSelectFile = (id: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <span>Cloud File Manager</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
              Persistent SSD
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Explore, categorize, download and manage completed remote torrent files
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
            title="Synchronize and verify disk quotas"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Sync Quota</span>
          </button>
          <button
            onClick={() => {
              refetchFiles();
              refetchStats();
            }}
            disabled={isFetching}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 transition-colors shadow-xs"
            title="Refresh files"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Storage Capacity & Category Breakdown Card */}
      {storageStats && (
        <div className="rounded-2xl p-5 bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">Cloud Storage Allocation</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                  {formatBytes(storageStats.used_bytes)} used of {formatBytes(storageStats.quota_bytes)} ({storageStats.usage_percentage}%)
                </span>
              </div>
            </div>

            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{storageStats.total_files} completed files</span>
              <span className="mx-2">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatBytes(storageStats.free_bytes)} free</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                storageStats.usage_percentage >= 90 
                  ? 'bg-rose-500' 
                  : storageStats.usage_percentage >= 75 
                    ? 'bg-amber-500' 
                    : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.min(100, storageStats.usage_percentage)}%` }}
            />
          </div>

          {/* Warning Banner if Near Capacity */}
          {storageStats.is_near_capacity && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>
                Your storage allocation has reached {storageStats.usage_percentage}%. Please delete unneeded files to avoid blocking new download jobs.
              </span>
            </div>
          )}

          {/* Category Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
            {storageStats.categories.map((c) => (
              <button
                key={c.category}
                onClick={() => {
                  setSelectedCategory(c.category === selectedCategory ? 'ALL' : c.category);
                  setPage(1);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  selectedCategory === c.category
                    ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs'
                    : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  {c.category}
                </div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {formatBytes(c.bytes)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {c.count} {c.count === 1 ? 'file' : 'files'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controls & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-[#635BFF] text-white shadow-md shadow-[#635BFF]/20'
                  : 'bg-white dark:bg-[#191B23] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search filename..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#191B23] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#635BFF]"
            />
          </div>

          <select
            value={`${sortBy}-${order}`}
            onChange={(e) => {
              const [sb, ord] = e.target.value.split('-') as [any, any];
              setSortBy(sb);
              setOrder(ord);
            }}
            className="px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-[#191B23] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#635BFF]"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="file_size-desc">Size (Largest)</option>
            <option value="file_size-asc">Size (Smallest)</option>
            <option value="filename-asc">Name (A-Z)</option>
            <option value="filename-desc">Name (Z-A)</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Ribbon (Visible when items selected) */}
      {selectedFileIds.length > 0 && (
        <div className="p-3 rounded-xl bg-[#635BFF]/10 border border-[#635BFF]/25 flex items-center justify-between text-xs animate-in fade-in duration-150">
          <div className="flex items-center space-x-2 text-[#635BFF] dark:text-[#918BFF] font-semibold">
            <CheckSquare className="w-4 h-4" />
            <span>{selectedFileIds.length} {selectedFileIds.length === 1 ? 'file' : 'files'} selected</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedFileIds([])}
              className="px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Clear Selection
            </button>
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Files Table / List */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#191B23] shadow-sm overflow-hidden">
        {isFilesLoading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-7 h-7 rounded-full border-2 border-[#635BFF] border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-xs">Loading stored cloud files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800/80 text-gray-400 flex items-center justify-center mx-auto">
              <FileBox className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              No files found in storage
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Completed remote torrent downloads are automatically indexed and organized here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-gray-50/50 dark:bg-[#14151C] text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <div className="col-span-1 flex items-center">
                <button
                  onClick={handleSelectAll}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title="Select all on page"
                >
                  {selectedFileIds.length === files.length && files.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-[#635BFF]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="col-span-5 sm:col-span-6">File Name & Source</div>
              <div className="col-span-3 sm:col-span-2">Category & Size</div>
              <div className="hidden sm:block sm:col-span-2">Indexed Date</div>
              <div className="col-span-3 sm:col-span-1 text-right">Actions</div>
            </div>

            {/* File Rows */}
            {files.map((file) => {
              const isSelected = selectedFileIds.includes(file.id);
              return (
                <div
                  key={file.id}
                  className={`grid grid-cols-12 gap-3 px-4 py-3 items-center text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#635BFF]/5 dark:bg-[#635BFF]/10'
                      : 'hover:bg-gray-50/70 dark:hover:bg-[#1d1f2a]'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="col-span-1 flex items-center">
                    <button
                      onClick={() => toggleSelectFile(file.id)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#635BFF]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Name & Parent Torrent */}
                  <div className="col-span-5 sm:col-span-6 flex items-center space-x-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                      {getCategoryIcon(file.category)}
                    </div>
                    <div className="overflow-hidden">
                      <button
                        onClick={() => setInspectedFile(file)}
                        className="font-medium text-gray-900 dark:text-white truncate block text-left hover:text-[#635BFF] dark:hover:text-[#8E87FF] transition-colors"
                        title={file.filename}
                      >
                        {file.filename}
                      </button>
                      <div className="text-[11px] text-gray-400 truncate flex items-center space-x-1.5 mt-0.5">
                        <span className="truncate">{file.torrent_name || file.relative_path}</span>
                      </div>
                    </div>
                  </div>

                  {/* Category & Size */}
                  <div className="col-span-3 sm:col-span-2 space-y-0.5">
                    <div className="font-semibold text-gray-900 dark:text-gray-200">
                      {formatBytes(file.file_size)}
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                      {file.category}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="hidden sm:block sm:col-span-2 text-gray-500 dark:text-gray-400 text-[11px]">
                    {new Date(file.created_at).toLocaleDateString()}
                  </div>

                  {/* Action Buttons */}
                  <div className="col-span-3 sm:col-span-1 flex items-center justify-end space-x-1">
                    <button
                      onClick={() => setFileToDownload(file)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#635BFF] dark:hover:text-[#8E87FF] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Direct download & signed link"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => copyLink(file.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Copy link"
                    >
                      {copiedId === file.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setInspectedFile(file)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="View file details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setFileToDelete(file)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      title="Delete file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {totalFiles > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#14151C] flex items-center justify-between text-xs text-gray-500">
            <div>
              Showing {Math.min(totalFiles, (page - 1) * pageSize + 1)} to {Math.min(totalFiles, page * pageSize)} of {totalFiles} files
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-medium text-gray-700 dark:text-gray-300">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Modal */}
      {inspectedFile && (
        <FileDetailsModal
          file={inspectedFile}
          onClose={() => setInspectedFile(null)}
          onDelete={(f) => setFileToDelete(f)}
          onDownload={(f) => setFileToDownload(f)}
        />
      )}

      {/* Secure Download Modal */}
      {fileToDownload && (
        <DownloadModal
          file={fileToDownload}
          onClose={() => setFileToDownload(null)}
        />
      )}

      {/* Single Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#191B23] border border-gray-200 dark:border-gray-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Stored File</h3>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">{fileToDelete.filename}</span> ({formatBytes(fileToDelete.file_size)})?
              This action will remove the file permanently and free up your quota.
            </p>

            {fileToDelete.job_id && (
              <label className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={deleteParentTorrent}
                  onChange={(e) => setDeleteParentTorrent(e.target.checked)}
                  className="rounded border-gray-300 text-[#635BFF] focus:ring-[#635BFF]"
                />
                <span>Also delete the original torrent job if no other files remain</span>
              </label>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({
                  fileId: fileToDelete.id,
                  deleteTorrent: deleteParentTorrent
                })}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete File'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#191B23] border border-gray-200 dark:border-gray-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Selected Files</h3>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Are you sure you want to permanently delete <span className="font-semibold text-gray-900 dark:text-white">{selectedFileIds.length} files</span>? 
              Their disk storage will be released immediately.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => bulkDeleteMutation.mutate(selectedFileIds)}
                disabled={bulkDeleteMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20"
              >
                {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selectedFileIds.length} Files`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
