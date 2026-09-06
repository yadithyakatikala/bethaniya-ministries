import { create } from 'zustand';

/**
 * Placeholder app-wide store (Day 1 foundation only).
 *
 * Per FINAL_ARCHITECTURE_SPECIFICATION.md, admin state management is React
 * Context or Zustand — lightweight, not Redux. This currently only tracks
 * bootstrap status; auth/session state is added Day 2.
 */
interface AppStore {
  isBootstrapped: boolean;
  setBootstrapped: (value: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isBootstrapped: false,
  setBootstrapped: (value) => set({ isBootstrapped: value }),
}));
