import { create } from 'zustand';

/**
 * Whether the page on screen holds work that has not been saved, and what
 * to tell the administrator before they walk away from it.
 *
 * This app uses <BrowserRouter>, which has no built-in "are you sure you
 * want to leave?" hook (that needs a data router), and the pages that need
 * one -- the reading-plan editor holds an afternoon's writing in memory
 * until Save -- are reached by a navigation rail that lives OUTSIDE them.
 * So the page publishes its state here and the shell (components/
 * AdminLayout.tsx) asks before following a link away. Closing or reloading
 * the tab is covered separately, by the browser's own prompt
 * (components/useUnsavedChangesGuard.ts).
 */
interface UnsavedChangesState {
  /** null when there is nothing to lose. */
  message: string | null;
  set: (message: string | null) => void;
}

export const useUnsavedChanges = create<UnsavedChangesState>((set) => ({
  message: null,
  set: (message) => set({ message }),
}));
