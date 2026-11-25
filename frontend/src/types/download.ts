export interface DownloadLink {
  link_id: string;
  file_id: string;
  token: string;
  download_url: string;
  expires_at: string;
  is_revoked: boolean;
  download_count: number;
  last_downloaded_at?: string | null;
  filename: string;
  file_size: number;
  category: string;
  mime_type: string;
}

export interface DownloadLinkListResponse {
  items: DownloadLink[];
  total: number;
}

export interface MultiFileDownloadResponse {
  links: DownloadLink[];
}
