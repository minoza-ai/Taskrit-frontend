import { create } from 'zustand';

interface ChatSettingsState {
  optimizeUploadedImages: boolean;
  setOptimizeUploadedImages: (enabled: boolean) => void;
  messageStyle: 'bubble' | 'irc';
  setMessageStyle: (style: 'bubble' | 'irc') => void;
}

const OPTIMIZE_STORAGE_KEY = 'taskrit_chat_optimize_images';
const MESSAGE_STYLE_STORAGE_KEY = 'taskrit_chat_message_style';

function loadOptimizeUploadedImages(): boolean {
  const saved = localStorage.getItem(OPTIMIZE_STORAGE_KEY);
  if (saved === null) return true;
  return saved === 'true';
}

function loadMessageStyle(): 'bubble' | 'irc' {
  const saved = localStorage.getItem(MESSAGE_STYLE_STORAGE_KEY);
  if (saved === 'irc') return 'irc';
  return 'irc';
}

export const useChatSettingsStore = create<ChatSettingsState>((set) => ({
  optimizeUploadedImages: loadOptimizeUploadedImages(),
  messageStyle: loadMessageStyle(),

  setOptimizeUploadedImages: (enabled) => {
    localStorage.setItem(OPTIMIZE_STORAGE_KEY, String(enabled));
    set({ optimizeUploadedImages: enabled });
  },

  setMessageStyle: (style) => {
    localStorage.setItem(MESSAGE_STYLE_STORAGE_KEY, style);
    set({ messageStyle: style });
  },
}));
