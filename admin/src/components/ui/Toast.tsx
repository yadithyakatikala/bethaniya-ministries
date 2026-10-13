import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Snackbar } from '@mui/material';
import {
  DEFAULT_TOAST_MS,
  ToastContext,
  type ToastOptions,
} from './toastContext';

interface QueuedToast extends ToastOptions {
  key: number;
}

/**
 * One toast at a time, in order. A burst of saves shows each message in
 * turn instead of stacking them over the content.
 *
 * Announced politely to screen readers (`role="status"` through the
 * Alert) -- a toast reports what already happened and must not interrupt.
 * Errors use `role="alert"` and do not time out: someone who looked away
 * for six seconds must still be able to read why it failed.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedToast[]>([]);
  // A ref, not state: two notifications in the same tick must still get
  // two different keys, which a value captured by a closure cannot give.
  const nextKey = useRef(0);

  const notify = useCallback((options: ToastOptions) => {
    nextKey.current += 1;
    const key = nextKey.current;
    setQueue((current) => [...current, { ...options, key }]);
  }, []);

  const dismiss = useCallback(() => setQueue((current) => current.slice(1)), []);

  const api = useMemo(() => ({ notify }), [notify]);
  const current = queue[0];
  const severity = current?.severity ?? 'info';

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        key={current?.key}
        open={Boolean(current)}
        autoHideDuration={
          severity === 'error' ? null : (current?.durationMs ?? DEFAULT_TOAST_MS)
        }
        onClose={(_event, reason) => {
          if (reason === 'clickaway') return;
          dismiss();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={severity}
          variant="filled"
          onClose={dismiss}
          role={severity === 'error' ? 'alert' : 'status'}
          data-testid="toast"
          sx={{ width: '100%' }}
        >
          {current?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
