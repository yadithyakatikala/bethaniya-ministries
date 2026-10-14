/**
 * Copies text to the clipboard. Resolves false, rather than throwing, when
 * the browser will not allow it (an insecure page, a denied permission, a
 * test environment) so the caller can say "select it and copy" instead.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
