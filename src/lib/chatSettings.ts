import { create } from 'zustand';

interface ChatSettingsState {
  optimizeUploadedImages: boolean;
  setOptimizeUploadedImages: (enabled: boolean) => void;
}

const STORAGE_KEY = 'taskrit_chat_optimize_images';

function loadOptimizeUploadedImages(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) return true;
  return saved === 'true';
}

export const useChatSettingsStore = create<ChatSettingsState>((set) => ({
  optimizeUploadedImages: loadOptimizeUploadedImages(),

  setOptimizeUploadedImages: (enabled) => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    set({ optimizeUploadedImages: enabled });
  },
}));
