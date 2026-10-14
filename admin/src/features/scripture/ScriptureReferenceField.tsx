import { useState, type ReactNode } from 'react';
import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import { PassagePicker } from './PassagePicker';
import type { ScriptureLanguage } from './passages';

/**
 * A text field for a Scripture reference with a way to choose one from the
 * Bible instead of typing it.
 *
 * THE FIELD STAYS A TEXT FIELD. A Verse of the Day or a Prophet verse has
 * always taken a reference as free text -- "John 3:16", "Psalm 23:1-3", a
 * paraphrase's own citation -- and what is already saved in those documents
 * must stay editable exactly as it is. So nothing here validates the text or
 * rejects what is typed; the button beside it is a convenience that fills the
 * field with a reference written the one canonical way, checked against the
 * 66 books and the real verse count of every chapter, so the commonest typo
 * ("Jhon 3:16", "Psalm 151") cannot get in by that route.
 *
 * It is the same picker the reading-plan editor uses for a day's passages
 * (./PassagePicker.tsx), which hands back only a written reference and so
 * shares nothing with the plan model.
 */
export function ScriptureReferenceField({
  label,
  value,
  onChange,
  error,
  helperText,
  placeholder,
  disabled,
  language,
  testId,
}: {
  label: string;
  value: string;
  onChange: (reference: string) => void;
  /** Shows `helperText` in the error colour. */
  error?: boolean;
  helperText?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  /** Fix the book names' language; leave out to let the person choose. */
  language?: ScriptureLanguage;
  /** The text input's test id; the picker's ids are derived from it. */
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TextField
        label={label}
        placeholder={placeholder}
        fullWidth
        margin="normal"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        helperText={helperText}
        slotProps={{
          htmlInput: { 'data-testid': testId },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Choose from the Bible">
                  <span>
                    <IconButton
                      edge="end"
                      aria-label="Choose a passage from the Bible"
                      disabled={disabled}
                      onClick={() => setOpen(true)}
                      data-testid={`${testId}-choose`}
                    >
                      <MenuBookOutlined fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />
      <PassagePicker
        open={open}
        language={language}
        title="Choose a passage"
        confirmLabel="Use this passage"
        onClose={() => setOpen(false)}
        onPick={(passage) => {
          onChange(passage);
          setOpen(false);
        }}
        testIdPrefix={`${testId}-picker`}
      />
    </>
  );
}
