import { create } from 'zustand';
import type { UserProfile, TokenResponse } from './api';
import * as api from './api';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isLoading: boolean;

  login: (user_id: string, password: string, otpCode?: string) => Promise<void>;
  loginWithWallet: (walletAddress: string, signature: string, nonce: string, message?: string, otpCode?: string) => Promise<void>;
  register: (user_id: string, nickname: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  updateUser: (data: { nickname?: string; password?: string; profile_bio?: string; capabilities?: string[] }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  setTokens: (tokens: TokenResponse) => void;
  setUser: (user: UserProfile) => void;
  tryRefresh: () => Promise<boolean>;
}

function saveTokens(access: string, refresh: string) {
  localStorage.setItem('taskrit_access_token', access);
  localStorage.setItem('taskrit_refresh_token', refresh);
}

function clearTokens() {
  localStorage.removeItem('taskrit_access_token');
  localStorage.removeItem('taskrit_refresh_token');
}

function loadTokens() {
  return {
    accessToken: localStorage.getItem('taskrit_access_token'),
    refreshToken: localStorage.getItem('taskrit_refresh_token'),
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...loadTokens(),
  user: null,
  isLoading: false,

  setTokens: (tokens: TokenResponse) => {
    saveTokens(tokens.access_token, tokens.refresh_token);
    set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
  },

  setUser: (user: UserProfile) => {
    set({ user });
  },

  login: async (user_id, password, otpCode) => {
    set({ isLoading: true });
    try {
      const tokens = await api.login(user_id, password, otpCode);
      saveTokens(tokens.access_token, tokens.refresh_token);
      set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      const user = await api.getMe(tokens.access_token);
      set({ user });
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithWallet: async (walletAddress, signature, nonce, message, otpCode) => {
    set({ isLoading: true });
    try {
      const tokens = await api.walletLogin(walletAddress, signature, nonce, message, 'base64', otpCode);
      saveTokens(tokens.access_token, tokens.refresh_token);
      set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      const user = await api.getMe(tokens.access_token);
      set({ user });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (user_id, nickname, password) => {
    set({ isLoading: true });
    try {
      await api.register(user_id, nickname, password);
      const tokens = await api.login(user_id, password);
      saveTokens(tokens.access_token, tokens.refresh_token);
      set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      const user = await api.getMe(tokens.access_token);
      set({ user });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    clearTokens();
    set({ accessToken: null, refreshToken: null, user: null });
  },

  fetchUser: async () => {
    const { accessToken } = get();
    if (!accessToken) return;
    try {
      const user = await api.getMe(accessToken);
      set({ user });
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await get().tryRefresh();
        if (refreshed) {
          const user = await api.getMe(get().accessToken!);
          set({ user });
        } else {
          get().logout();
        }
      }
    }
  },

  updateUser: async (data) => {
    const { accessToken } = get();
    if (!accessToken) throw new Error('Not authenticated');
    await api.updateMe(accessToken, data);
    await get().fetchUser();
  },

  deleteAccount: async () => {
    const { accessToken } = get();
    if (!accessToken) throw new Error('Not authenticated');
    await api.deleteMe(accessToken);
    get().logout();
  },

  tryRefresh: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;
    try {
      const tokens = await api.refreshToken(refreshToken);
      saveTokens(tokens.access_token, tokens.refresh_token);
      set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      return true;
    } catch {
      get().logout();
      return false;
    }
  },
}));
