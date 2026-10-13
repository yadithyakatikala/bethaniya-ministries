import type { ReactNode } from 'react';
import { TextField } from '@mui/material';
import { localTimeZoneName } from './timeZone';

/**
 * The browser's own date-and-time control, wearing the design system's
 * field, with one addition every scheduling field needs: it says which
 * clock it means.
 *
 * `<input type="datetime-local">` carries no time zone, so a bare field
 * leaves an administrator to guess whether "09:00" is theirs or the
 * server's. It is the browser's local time zone, and the helper names it.
 * The native control is used deliberately -- it is keyboard-operable, has
 * the platform's own accessible picker on every device, and ships no
 * extra dependency.
 *
 * `value` is the input's own format, "YYYY-MM-DDTHH:mm" (see
 * ../../features/prophet-verses/validation.ts's toDateTimeLocalValue and
 * parsePublishAt, which every scheduling form already uses).
 */
export function DateTimeField({
  label,
  value,
  onChange,
  error,
  helperText,
  testId,
  disabled,
  required,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: ReactNode;
  testId?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
}) {
  const zone = localTimeZoneName();
  return (
    <TextField
      label={label}
      type="datetime-local"
      fullWidth
      margin="normal"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      disabled={disabled}
      required={required}
      helperText={
        <>
          {helperText ? <>{helperText} </> : null}
          {zone ? `Times are in your local time zone (${zone}).` : null}
        </>
      }
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { 'data-testid': testId, min },
      }}
    />
  );
}
