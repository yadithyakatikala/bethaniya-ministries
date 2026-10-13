/**
 * The browser's local time zone name (e.g. "Asia/Kolkata"), or null when
 * the platform will not say. `<input type="datetime-local">` carries no
 * zone, so every scheduling field names the one it means.
 */
export function localTimeZoneName(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
