import { create } from 'zustand';
import { User, TokenResponse } from '../types/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setAuth: (data: TokenResponse) => void;
  setUser: (user: User) => void;
  logout: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('ct_access_token'),
  refreshToken: localStorage.getItem('ct_refresh_token'),
  isAuthenticated: !!localStorage.getItem('ct_access_token'),
  isInitializing: true,

  setAuth: (data: TokenResponse) => {
    localStorage.setItem('ct_access_token', data.access_token);
    localStorage.setItem('ct_refresh_token', data.refresh_token);
    localStorage.setItem('ct_user', JSON.stringify(data.user));
    set({
      user: data.user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isAuthenticated: true,
      isInitializing: false,
    });
  },

  setUser: (user: User) => {
    localStorage.setItem('ct_user', JSON.stringify(user));
    set({ user });
  },

  logout: () => {
    localStorage.removeItem('ct_access_token');
    localStorage.removeItem('ct_refresh_token');
    localStorage.removeItem('ct_user');
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isInitializing: false,
    });
  },

  initAuth: () => {
    const token = localStorage.getItem('ct_access_token');
    const refresh = localStorage.getItem('ct_refresh_token');
    const userStr = localStorage.getItem('ct_user');

    if (token && refresh && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({
          user,
          accessToken: token,
          refreshToken: refresh,
          isAuthenticated: true,
          isInitializing: false,
        });
        return;
      } catch {
        // Corrupt storage
      }
    }
    set({ isInitializing: false, isAuthenticated: false });
  },
}));
