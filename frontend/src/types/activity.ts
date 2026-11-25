export type ActivitySeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface ActivityEvent {
  id: string;
  user_id?: string | null;
  event_type: string;
  severity: ActivitySeverity;
  title: string;
  description: string;
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  meta_data?: string | null;
  created_at: string;
  user_name?: string | null;
}

export interface ActivityListResponse {
  items: ActivityEvent[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SystemMetrics {
  cpu: {
    usage_percent: number;
    cores_count: number;
  };
  memory: {
    total_bytes: number;
    available_bytes: number;
    used_bytes: number;
    usage_percent: number;
  };
  disk: {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    usage_percent: number;
  };
  engine: {
    active_torrents: number;
    downloading_torrents: number;
    seeding_torrents: number;
    total_peers: number;
    global_download_speed: number;
    global_upload_speed: number;
  };
  workers: {
    redis_connected: boolean;
    db_connected: boolean;
    active_workers: number;
    uptime_seconds: number;
  };
  timestamp: string;
}
