export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'USER';
  is_active: boolean;
  storage_quota_bytes: number;
  max_active_jobs: number;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Invitation {
  id: string;
  code: string;
  email: string | null;
  is_claimed: boolean;
  expires_at: string;
  created_at: string;
}

export interface InvitationValidation {
  valid: boolean;
  code: string;
  email: string | null;
  message: string;
}
