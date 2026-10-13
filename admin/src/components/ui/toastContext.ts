import { createContext, useContext } from 'react';

export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  message: string;
  severity?: ToastSeverity;
  /** How long it stays, in milliseconds. Errors stay until dismissed. */
  durationMs?: number;
}

export interface ToastApi {
  notify: (options: ToastOptions) => void;
}

export const DEFAULT_TOAST_MS = 5000;

/**
 * Outside a provider, notifying does nothing rather than throwing: a
 * component that wants to say "saved" must not crash in a test (or any
 * render) that did not mount the whole app.
 */
export const ToastContext = createContext<ToastApi>({ notify: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
