import { HealthResponse } from '../types/health';
import { User, TokenResponse, Invitation, InvitationValidation } from '../types/auth';
import { TorrentJob, TorrentInspectResponse, QueueStats, QueueConfig } from '../types/torrent';
import { StoredFile, StorageStats, FileListResponse, BulkDeleteResponse } from '../types/storage';
import { DownloadLink, DownloadLinkListResponse, MultiFileDownloadResponse } from '../types/download';
import { ActivityListResponse, SystemMetrics } from '../types/activity';
import { 
  AdminUser, 
  AdminUserListResponse, 
  AdminUserUpdateRequest, 
  AdminGlobalTorrentListResponse, 
  AdminSystemSettingItem 
} from '../types/admin';
import { useAuthStore } from '../store/authStore';

export const API_BASE_URL = '/api/v1';

async function authenticatedFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken, refreshToken, logout, setAuth } = useAuthStore.getState();

  const headers = new Headers(options.headers || {});
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle Token Expiration and Refresh rotation
  if (response.status === 401 && refreshToken) {
    try {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (refreshRes.ok) {
        const newTokens: TokenResponse = await refreshRes.json();
        setAuth(newTokens);

        // Replay original request with new token
        headers.set('Authorization', `Bearer ${newTokens.access_token}`);
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
      } else {
        logout();
      }
    } catch {
      logout();
    }
  }

  return response;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok && response.status !== 503) {
    throw new Error(`API health check failed with status: ${response.status}`);
  }
  return response.json();
}

export async function loginApi(email: string, password: string): Promise<TokenResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(errorData.detail || 'Invalid email or password');
  }
  return response.json();
}

export async function registerApi(payload: {
  invitation_code: string;
  email: string;
  password: string;
  full_name: string;
}): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(errorData.detail || 'Registration failed');
  }
  return response.json();
}

export async function validateInvitationApi(code: string): Promise<InvitationValidation> {
  const response = await fetch(`${API_BASE_URL}/auth/invitations/validate/${encodeURIComponent(code)}`);
  if (!response.ok) {
    throw new Error('Failed to validate invitation code');
  }
  return response.json();
}

export async function fetchMe(): Promise<User> {
  const response = await authenticatedFetch('/auth/me');
  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }
  return response.json();
}

export async function createInvitationApi(email?: string, expiresInDays = 7): Promise<Invitation> {
  const response = await authenticatedFetch('/auth/invitations', {
    method: 'POST',
    body: JSON.stringify({ email: email || null, expires_in_days: expiresInDays }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to create invitation' }));
    throw new Error(errorData.detail || 'Failed to create invitation');
  }
  return response.json();
}

export async function fetchInvitationsApi(): Promise<Invitation[]> {
  const response = await authenticatedFetch('/auth/invitations');
  if (!response.ok) {
    throw new Error('Failed to fetch invitations');
  }
  return response.json();
}

export async function logoutApi(): Promise<void> {
  const { refreshToken, logout } = useAuthStore.getState();
  if (refreshToken) {
    await authenticatedFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => {});
  }
  logout();
}

/* ==========================================================================
   Torrent Engine APIs
   ========================================================================== */

export async function inspectMagnetApi(magnetUri: string): Promise<TorrentInspectResponse> {
  const response = await authenticatedFetch('/torrents/inspect-magnet', {
    method: 'POST',
    body: JSON.stringify({ magnet_uri: magnetUri }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to inspect magnet' }));
    throw new Error(errorData.detail || 'Failed to inspect magnet');
  }
  return response.json();
}

export async function inspectTorrentFileApi(file: File): Promise<TorrentInspectResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authenticatedFetch('/torrents/inspect-file', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to inspect torrent file' }));
    throw new Error(errorData.detail || 'Failed to inspect torrent file');
  }
  return response.json();
}

export async function createTorrentJobApi(payload: {
  magnet_uri?: string;
  torrent_file_b64?: string;
  selected_indices?: number[];
}): Promise<TorrentJob> {
  const response = await authenticatedFetch('/torrents/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to create torrent job' }));
    throw new Error(errorData.detail || 'Failed to create torrent job');
  }
  return response.json();
}

export async function fetchTorrentsApi(statusFilter?: string): Promise<TorrentJob[]> {
  const query = statusFilter && statusFilter !== 'ALL' ? `?status=${encodeURIComponent(statusFilter)}` : '';
  const response = await authenticatedFetch(`/torrents${query}`);
  if (!response.ok) {
    throw new Error('Failed to fetch torrent downloads');
  }
  return response.json();
}

export async function fetchTorrentDetailApi(jobId: string): Promise<TorrentJob> {
  const response = await authenticatedFetch(`/torrents/${jobId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch torrent detail');
  }
  return response.json();
}

export async function pauseTorrentApi(jobId: string): Promise<TorrentJob> {
  const response = await authenticatedFetch(`/torrents/${jobId}/pause`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to pause download');
  }
  return response.json();
}

export async function resumeTorrentApi(jobId: string): Promise<TorrentJob> {
  const response = await authenticatedFetch(`/torrents/${jobId}/resume`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to resume download');
  }
  return response.json();
}

export async function cancelTorrentApi(jobId: string): Promise<TorrentJob> {
  const response = await authenticatedFetch(`/torrents/${jobId}/cancel`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to cancel download');
  }
  return response.json();
}

export async function deleteTorrentApi(jobId: string, deleteFiles = false): Promise<void> {
  const response = await authenticatedFetch(`/torrents/${jobId}?delete_files=${deleteFiles}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete download job');
  }
}

export async function retryTorrentApi(jobId: string): Promise<TorrentJob> {
  const response = await authenticatedFetch(`/torrents/${jobId}/retry`, { method: 'POST' });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to retry download' }));
    throw new Error(errorData.detail || 'Failed to retry download');
  }
  return response.json();
}

export async function updateTorrentPriorityApi(jobId: string, priority: number): Promise<TorrentJob> {
  const response = await authenticatedFetch(`/torrents/${jobId}/priority`, {
    method: 'PATCH',
    body: JSON.stringify({ priority }),
  });
  if (!response.ok) {
    throw new Error('Failed to update priority');
  }
  return response.json();
}

export async function fetchQueueStatsApi(): Promise<QueueStats> {
  const response = await authenticatedFetch('/torrents/queue/stats');
  if (!response.ok) {
    throw new Error('Failed to fetch queue statistics');
  }
  return response.json();
}

export async function fetchQueueConfigApi(): Promise<QueueConfig> {
  const response = await authenticatedFetch('/torrents/queue/config');
  if (!response.ok) {
    throw new Error('Failed to fetch queue configuration');
  }
  return response.json();
}

export async function updateQueueConfigApi(config: Partial<QueueConfig>): Promise<QueueConfig> {
  const response = await authenticatedFetch('/torrents/queue/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error('Failed to update queue configuration');
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Cloud File Management & Storage APIs
// ---------------------------------------------------------------------------

export async function fetchFilesApi(params?: {
  category?: string;
  search?: string;
  sort_by?: string;
  order?: string;
  page?: number;
  page_size?: number;
  job_id?: string;
}): Promise<FileListResponse> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.search) query.set('search', params.search);
  if (params?.sort_by) query.set('sort_by', params.sort_by);
  if (params?.order) query.set('order', params.order);
  if (params?.page) query.set('page', params.page.toString());
  if (params?.page_size) query.set('page_size', params.page_size.toString());
  if (params?.job_id) query.set('job_id', params.job_id);

  const qs = query.toString();
  const response = await authenticatedFetch(`/files${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    throw new Error('Failed to fetch stored files');
  }
  return response.json();
}

export async function fetchStorageStatsApi(): Promise<StorageStats> {
  const response = await authenticatedFetch('/files/stats');
  if (!response.ok) {
    throw new Error('Failed to fetch storage statistics');
  }
  return response.json();
}

export async function fetchFileDetailsApi(fileId: string): Promise<StoredFile> {
  const response = await authenticatedFetch(`/files/${fileId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch file details');
  }
  return response.json();
}

export async function deleteFileApi(fileId: string, deleteTorrent = false): Promise<{ status: string; file_id: string; freed_bytes: number }> {
  const response = await authenticatedFetch(`/files/${fileId}?delete_torrent=${deleteTorrent}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete file');
  }
  return response.json();
}

export async function bulkDeleteFilesApi(fileIds: string[]): Promise<BulkDeleteResponse> {
  const response = await authenticatedFetch('/files/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ file_ids: fileIds }),
  });
  if (!response.ok) {
    throw new Error('Failed to delete selected files');
  }
  return response.json();
}

export async function syncStorageApi(): Promise<{ status: string; used_bytes: number }> {
  const response = await authenticatedFetch('/files/sync', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to synchronize storage');
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Secure Direct HTTPS Download Service APIs
// ---------------------------------------------------------------------------

export async function generateDownloadLinkApi(fileId: string, expiresInHours = 24): Promise<DownloadLink> {
  const response = await authenticatedFetch('/downloads/generate', {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId, expires_in_hours: expiresInHours }),
  });
  if (!response.ok) {
    throw new Error('Failed to generate download link');
  }
  return response.json();
}

export async function generateBatchDownloadLinksApi(fileIds: string[], expiresInHours = 24): Promise<MultiFileDownloadResponse> {
  const response = await authenticatedFetch('/downloads/generate-batch', {
    method: 'POST',
    body: JSON.stringify({ file_ids: fileIds, expires_in_hours: expiresInHours }),
  });
  if (!response.ok) {
    throw new Error('Failed to generate batch download links');
  }
  return response.json();
}

export async function fetchDownloadLinksApi(): Promise<DownloadLinkListResponse> {
  const response = await authenticatedFetch('/downloads/links');
  if (!response.ok) {
    throw new Error('Failed to fetch active download links');
  }
  return response.json();
}

export async function revokeDownloadLinkApi(linkId: string): Promise<{ status: string; link_id: string }> {
  const response = await authenticatedFetch(`/downloads/links/${linkId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to revoke download link');
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Monitoring & Activity Audit APIs
// ---------------------------------------------------------------------------

export async function fetchActivityEventsApi(params?: {
  severity?: string;
  event_type?: string;
  search?: string;
  cluster_wide?: boolean;
  page?: number;
  page_size?: number;
}): Promise<ActivityListResponse> {
  const query = new URLSearchParams();
  if (params?.severity) query.set('severity', params.severity);
  if (params?.event_type) query.set('event_type', params.event_type);
  if (params?.search) query.set('search', params.search);
  if (params?.cluster_wide) query.set('cluster_wide', 'true');
  if (params?.page) query.set('page', params.page.toString());
  if (params?.page_size) query.set('page_size', params.page_size.toString());

  const qs = query.toString();
  const response = await authenticatedFetch(`/monitoring/activity${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    throw new Error('Failed to fetch activity events');
  }
  return response.json();
}

export async function fetchSystemMetricsApi(): Promise<SystemMetrics> {
  const response = await authenticatedFetch('/monitoring/metrics');
  if (!response.ok) {
    throw new Error('Failed to fetch system metrics');
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Administration & Governance APIs
// ---------------------------------------------------------------------------

export async function fetchAdminUsersApi(search?: string): Promise<AdminUserListResponse> {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  const qs = query.toString();
  const response = await authenticatedFetch(`/admin/users${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to fetch users' }));
    throw new Error(err.detail || 'Failed to fetch users');
  }
  return response.json();
}

export async function updateAdminUserApi(
  userId: string,
  payload: AdminUserUpdateRequest
): Promise<AdminUser> {
  const response = await authenticatedFetch(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to update user' }));
    throw new Error(err.detail || 'Failed to update user');
  }
  return response.json();
}

export async function fetchAdminTorrentsApi(status?: string): Promise<AdminGlobalTorrentListResponse> {
  const query = new URLSearchParams();
  if (status && status !== 'ALL') query.set('status', status);
  const qs = query.toString();
  const response = await authenticatedFetch(`/admin/torrents${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to fetch global torrents' }));
    throw new Error(err.detail || 'Failed to fetch global torrents');
  }
  return response.json();
}

export async function manageAdminTorrentApi(
  jobId: string,
  action: 'pause' | 'resume' | 'cancel' | 'delete'
): Promise<{ status: string; job_id: string; action: string }> {
  const response = await authenticatedFetch(`/admin/torrents/${jobId}/${action}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `Failed to ${action} torrent` }));
    throw new Error(err.detail || `Failed to ${action} torrent`);
  }
  return response.json();
}

export async function fetchAdminSettingsApi(): Promise<AdminSystemSettingItem[]> {
  const response = await authenticatedFetch('/admin/settings');
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to fetch settings' }));
    throw new Error(err.detail || 'Failed to fetch settings');
  }
  return response.json();
}

export async function updateAdminSettingsApi(
  settings: Record<string, string>
): Promise<AdminSystemSettingItem[]> {
  const response = await authenticatedFetch('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to update settings' }));
    throw new Error(err.detail || 'Failed to update settings');
  }
  return response.json();
}





