export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'low_disk_warning';
  latency_ms?: number;
  error?: string;
  mount_path?: string;
  total_bytes?: number;
  used_bytes?: number;
  free_bytes?: number;
  free_gigabytes?: number;
  usage_percent?: number;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  app_name: string;
  version: string;
  environment: string;
  uptime_seconds: number;
  timestamp: number;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    storage: ComponentHealth;
  };
  system: {
    python_version: string;
    cpu_percent: number;
    memory_percent: number;
  };
}
