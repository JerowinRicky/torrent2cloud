import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { TorrentJob } from '../types/torrent';

export interface TelemetryPacket {
  type: 'telemetry' | 'init' | 'job_status_change' | 'pong';
  job_id?: string;
  info_hash?: string;
  torrent_name?: string;
  status?: TorrentJob['status'];
  progress?: number;
  download_speed?: number;
  upload_speed?: number;
  downloaded_bytes?: number;
  uploaded_bytes?: number;
  total_size?: number;
  eta_seconds?: number | null;
  peers_connected?: number;
  seeds_connected?: number;
  priority?: number;
  jobs?: any[];
  timestamp?: string;
}

export function useTorrentTelemetry() {
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const backoffRef = useRef(1000);

  const connect = useCallback(() => {
    if (!accessToken) {
      setIsConnected(false);
      return;
    }

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setIsConnecting(true);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/telemetry/ws?token=${encodeURIComponent(accessToken)}`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        backoffRef.current = 1000; // Reset backoff on successful connect

        // Start 15s heartbeat
        pingIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      socket.onmessage = (event) => {
        try {
          const packet: TelemetryPacket = JSON.parse(event.data);

          if (packet.type === 'telemetry' && packet.job_id) {
            // Update TanStack Query cache directly with zero-latency telemetry
            queryClient.setQueriesData<TorrentJob[]>({ queryKey: ['torrents'] }, (oldJobs) => {
              if (!oldJobs) return oldJobs;
              return oldJobs.map((job) => {
                if (job.id === packet.job_id) {
                  return {
                    ...job,
                    progress: packet.progress ?? job.progress,
                    download_speed: packet.download_speed ?? job.download_speed,
                    upload_speed: packet.upload_speed ?? job.upload_speed,
                    downloaded_bytes: packet.downloaded_bytes ?? job.downloaded_bytes,
                    uploaded_bytes: packet.uploaded_bytes ?? job.uploaded_bytes,
                    total_size: packet.total_size ?? job.total_size,
                    eta_seconds: packet.eta_seconds !== undefined ? packet.eta_seconds : job.eta_seconds,
                    peers_connected: packet.peers_connected ?? job.peers_connected,
                    seeds_connected: packet.seeds_connected ?? job.seeds_connected,
                    status: packet.status ?? job.status,
                  };
                }
                return job;
              });
            });
          } else if (packet.type === 'job_status_change') {
            queryClient.invalidateQueries({ queryKey: ['torrents'] });
            queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
          } else if (packet.type === 'init' && packet.jobs) {
            // Initial snapshot received
            queryClient.invalidateQueries({ queryKey: ['torrents'] });
          }
        } catch {
          // Ignore unparseable frames
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, up to 15s max
        const nextDelay = Math.min(15000, backoffRef.current * 1.5);
        backoffRef.current = nextDelay;
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, nextDelay);
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [accessToken, queryClient]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    isConnecting,
  };
}
