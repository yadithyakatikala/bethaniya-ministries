import { useEffect } from 'react';
import { useUnsavedChanges } from '../store/unsavedChangesStore';

/**
 * Call from a page that holds unsaved work. While `dirty` is true:
 *   * the navigation rail asks before following a link away (see
 *     AdminLayout), showing `message`;
 *   * closing or reloading the tab triggers the browser's own warning.
 * Both are lifted the moment `dirty` goes false or the page unmounts.
 */
export function useUnsavedChangesGuard(dirty: boolean, message: string): void {
  const set = useUnsavedChanges((state) => state.set);

  useEffect(() => {
    set(dirty ? message : null);
    return () => set(null);
  }, [dirty, message, set]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required by some browsers to show the prompt; the text itself is
      // ignored by all modern ones.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}
