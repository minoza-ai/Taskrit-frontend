import { create } from 'zustand';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedTheme: () => 'dark' | 'light';
}

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', theme);
}

const savedMode = (localStorage.getItem('taskrit_theme') as ThemeMode | null) ?? 'system';

// Apply theme immediately on load
applyTheme(
  savedMode === 'system' ? getSystemTheme() : savedMode,
);

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: savedMode,

  setMode: (mode) => {
    localStorage.setItem('taskrit_theme', mode);
    set({ mode });
    applyTheme(mode === 'system' ? getSystemTheme() : mode);
  },

  resolvedTheme: () => {
    const { mode } = get();
    return mode === 'system' ? getSystemTheme() : mode;
  },
}));

// Watch for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const { mode } = useThemeStore.getState();
  if (mode === 'system') {
    applyTheme(getSystemTheme());
  }
});
