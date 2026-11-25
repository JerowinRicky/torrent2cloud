export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'USER' | 'ADMIN';
  is_active: boolean;
  storage_quota_bytes: number;
  max_active_jobs: number;
  used_bytes: number;
  active_jobs_count: number;
  stored_files_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminUserUpdateRequest {
  full_name?: string;
  role?: 'USER' | 'ADMIN';
  is_active?: boolean;
  storage_quota_bytes?: number;
  max_active_jobs?: number;
}

export interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
}

export interface AdminGlobalTorrent {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  info_hash: string;
  torrent_name: string;
  status: string;
  total_size: number;
  downloaded_bytes: number;
  uploaded_bytes: number;
  progress: number;
  download_speed: number;
  upload_speed: number;
  eta_seconds?: number | null;
  peers_connected: number;
  seeds_connected: number;
  priority: number;
  created_at: string;
}

export interface AdminGlobalTorrentListResponse {
  items: AdminGlobalTorrent[];
  total: number;
}

export interface AdminSystemSettingItem {
  key: string;
  value: string;
  description?: string | null;
  updated_at: string;
}

export interface AdminSystemSettingsUpdate {
  settings: Record<string, string>;
}
