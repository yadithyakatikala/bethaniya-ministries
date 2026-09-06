import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * Placeholder app-wide context (Day 1 foundation only).
 *
 * Per FINAL_ARCHITECTURE_SPECIFICATION.md, state management is React Context +
 * local state — no Redux. This context currently only tracks whether the app
 * has finished its initial bootstrap; auth state, user profile, and preferences
 * (language/theme) will be added here or in sibling contexts starting Day 2.
 */

interface AppState {
  isBootstrapped: boolean;
  setBootstrapped: (value: boolean) => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [isBootstrapped, setBootstrapped] = useState(false);

  const value = useMemo(
    () => ({ isBootstrapped, setBootstrapped }),
    [isBootstrapped]
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return ctx;
}
