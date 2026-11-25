export interface TorrentFileItem {
  file_index: number;
  filename: string;
  relative_path: string;
  file_size: number;
  is_selected: boolean;
}

export interface TorrentInspectResponse {
  info_hash: string;
  name: string;
  total_size: number;
  piece_count: number;
  piece_length: number;
  files: TorrentFileItem[];
  trackers: string[];
  is_magnet: boolean;
}

export interface TorrentFile {
  id: string;
  file_index: number;
  filename: string;
  relative_path: string;
  file_size: number;
  is_selected: boolean;
  is_completed: boolean;
}

export interface TorrentJob {
  id: string;
  info_hash: string;
  torrent_name: string;
  status: 'VALIDATING' | 'FETCHING_METADATA' | 'QUEUED' | 'DOWNLOADING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'EXPIRED';
  total_size: number;
  downloaded_bytes: number;
  uploaded_bytes: number;
  progress: number;
  download_speed: number;
  upload_speed: number;
  eta_seconds: number | null;
  peers_connected: number;
  seeds_connected: number;
  priority: number;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: string;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  files: TorrentFile[];
}

export interface QueueStats {
  global_active: number;
  global_limit: number;
  user_active: number;
  user_limit: number;
  user_queued: number;
  total_queued: number;
}

export interface QueueConfig {
  global_max_concurrent_downloads: number;
  default_max_active_jobs: number;
  download_speed_limit_kbps: number;
  upload_speed_limit_kbps: number;
  max_queued_jobs_per_user: number;
}
