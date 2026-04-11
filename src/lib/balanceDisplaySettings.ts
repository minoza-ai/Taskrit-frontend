import { create } from 'zustand';

export type BalanceDisplayUnit = 'task' | 'krw';

interface BalanceDisplaySettingsState {
  balanceDisplayUnit: BalanceDisplayUnit;
  setBalanceDisplayUnit: (unit: BalanceDisplayUnit) => void;
}

const BALANCE_DISPLAY_UNIT_STORAGE_KEY = 'taskrit_balance_display_unit';

function loadBalanceDisplayUnit(): BalanceDisplayUnit {
  const saved = localStorage.getItem(BALANCE_DISPLAY_UNIT_STORAGE_KEY);
  if (saved === 'krw') return 'krw';
  return 'task';
}

export const useBalanceDisplaySettingsStore = create<BalanceDisplaySettingsState>((set) => ({
  balanceDisplayUnit: loadBalanceDisplayUnit(),

  setBalanceDisplayUnit: (unit) => {
    localStorage.setItem(BALANCE_DISPLAY_UNIT_STORAGE_KEY, unit);
    set({ balanceDisplayUnit: unit });
  },
}));
