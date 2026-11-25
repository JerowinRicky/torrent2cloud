export type FileCategory = 
  | 'VIDEOS' 
  | 'AUDIO' 
  | 'IMAGES' 
  | 'DOCUMENTS' 
  | 'ARCHIVES' 
  | 'DISK_IMAGES' 
  | 'CODE' 
  | 'OTHER';

export interface StoredFile {
  id: string;
  user_id: string;
  job_id?: string | null;
  torrent_file_id?: string | null;
  filename: string;
  relative_path: string;
  file_size: number;
  extension: string;
  mime_type: string;
  category: FileCategory;
  storage_path: string;
  sha256_hash?: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
  torrent_name?: string | null;
  info_hash?: string | null;
}

export interface StorageCategoryStat {
  category: FileCategory;
  count: number;
  bytes: number;
}

export interface DiskUsageStat {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
}

export interface StorageStats {
  quota_bytes: number;
  used_bytes: number;
  free_bytes: number;
  usage_percentage: number;
  is_near_capacity: boolean;
  total_files: number;
  categories: StorageCategoryStat[];
  disk_usage: DiskUsageStat;
}

export interface FileListResponse {
  items: StoredFile[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface BulkDeleteResponse {
  deleted_count: number;
  freed_bytes: number;
  failed_ids: string[];
}
