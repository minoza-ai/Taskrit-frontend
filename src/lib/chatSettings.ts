import { create } from 'zustand';

export type ShiftEnterBehavior = 'newline' | 'send';

interface ChatSettingsState {
  optimizeUploadedImages: boolean;
  setOptimizeUploadedImages: (enabled: boolean) => void;
  messageStyle: 'bubble' | 'irc';
  setMessageStyle: (style: 'bubble' | 'irc') => void;
  shiftEnterBehavior: ShiftEnterBehavior;
  setShiftEnterBehavior: (behavior: ShiftEnterBehavior) => void;
}

const OPTIMIZE_STORAGE_KEY = 'taskrit_chat_optimize_images';
const MESSAGE_STYLE_STORAGE_KEY = 'taskrit_chat_message_style';
const SHIFT_ENTER_BEHAVIOR_STORAGE_KEY = 'taskrit_chat_shift_enter_behavior';

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

function loadShiftEnterBehavior(): ShiftEnterBehavior {
  const saved = localStorage.getItem(SHIFT_ENTER_BEHAVIOR_STORAGE_KEY);
  if (saved === 'send') return 'send';
  return 'newline';
}

export const useChatSettingsStore = create<ChatSettingsState>((set) => ({
  optimizeUploadedImages: loadOptimizeUploadedImages(),
  messageStyle: loadMessageStyle(),
  shiftEnterBehavior: loadShiftEnterBehavior(),

  setOptimizeUploadedImages: (enabled) => {
    localStorage.setItem(OPTIMIZE_STORAGE_KEY, String(enabled));
    set({ optimizeUploadedImages: enabled });
  },

  setMessageStyle: (style) => {
    localStorage.setItem(MESSAGE_STYLE_STORAGE_KEY, style);
    set({ messageStyle: style });
  },

  setShiftEnterBehavior: (behavior) => {
    localStorage.setItem(SHIFT_ENTER_BEHAVIOR_STORAGE_KEY, behavior);
    set({ shiftEnterBehavior: behavior });
  },
}));
