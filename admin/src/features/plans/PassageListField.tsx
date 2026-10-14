import { useState } from 'react';
import { Box, Button, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import type { PlanLanguage } from '../../types';
import { checkPassageList, parsePassage } from '../scripture/passages';
import { PassagePicker } from '../scripture/PassagePicker';

/**
 * The passages of one day: one box per passage, each checked as it is typed
 * against the real Bible (does that chapter exist? that verse?), with the
 * reading's size shown when it is good and the reason when it is not.
 *
 * On leaving a box, a good passage is rewritten the one canonical way
 * ("psalm 23" -> "Psalm 23", "John 3:16 - 21" -> "John 3:16-21"), so the
 * administrator sees exactly what will be saved. A passage that cannot be
 * read is left as typed, with its reason beside it; the day cannot be
 * published until it is fixed.
 *
 * Everything is shown in the fields themselves rather than only on Save, so
 * nobody finds out a Read button would do nothing after members have it.
 */
export function PassageListField({
  passages,
  onChange,
  language,
  disabled = false,
  showRequired = false,
  testIdPrefix,
}: {
  passages: readonly string[];
  onChange: (passages: string[]) => void;
  language: PlanLanguage;
  disabled?: boolean;
  /** Say "add a passage" even before the administrator has tried to add one. */
  showRequired?: boolean;
  testIdPrefix: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const list = checkPassageList(passages);
  const boxes = passages.length > 0 ? passages : [''];

  function setAt(index: number, value: string) {
    const next = [...boxes];
    next[index] = value;
    onChange(next);
  }

  function tidyAt(index: number) {
    const value = boxes[index] ?? '';
    if (value.trim() === '') return;
    const parsed = parsePassage(value);
    if (parsed.ok && parsed.passage.text !== value) setAt(index, parsed.passage.text);
  }

  function removeAt(index: number) {
    const next = boxes.filter((_, at) => at !== index);
    onChange(next.length > 0 ? next : ['']);
  }

  /** Fills the first empty box rather than adding below a blank one. */
  function addPicked(passage: string) {
    const empty = boxes.findIndex((value) => value.trim() === '');
    if (empty >= 0) {
      setAt(empty, passage);
    } else {
      onChange([...boxes, passage]);
    }
    setPickerOpen(false);
  }

  return (
    <Box
      role="group"
      aria-labelledby={`${testIdPrefix}-label`}
      data-testid={`${testIdPrefix}-passages`}
      sx={{ mt: 2 }}
    >
      <Typography id={`${testIdPrefix}-label`} variant="subtitle2">
        Scripture reading
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        What members read today. The first passage is where the app opens the Bible.
      </Typography>

      {boxes.map((value, index) => {
        const trimmed = value.trim();
        const parsed = trimmed === '' ? null : parsePassage(trimmed);
        return (
          <Box
            key={index}
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 1.5 }}
          >
            <TextField
              fullWidth
              size="small"
              label={`Passage ${index + 1}`}
              placeholder="e.g. John 3:16-21"
              value={value}
              disabled={disabled}
              onChange={(event) => setAt(index, event.target.value)}
              onBlur={() => tidyAt(index)}
              error={parsed !== null && !parsed.ok}
              helperText={
                parsed === null
                  ? ' '
                  : parsed.ok
                    ? `${parsed.passage.verseCount} ${parsed.passage.verseCount === 1 ? 'verse' : 'verses'} · opens in the app`
                    : parsed.message
              }
              slotProps={{
                htmlInput: { 'data-testid': `${testIdPrefix}-passage-${index}` },
              }}
            />
            <Tooltip
              title={boxes.length > 1 ? 'Remove this passage' : 'Clear this passage'}
            >
              <span>
                <IconButton
                  aria-label={`Remove passage ${index + 1}`}
                  disabled={disabled || (boxes.length === 1 && trimmed === '')}
                  onClick={() => removeAt(index)}
                  data-testid={`${testIdPrefix}-remove-passage-${index}`}
                  sx={{ mt: 0.25 }}
                >
                  <CloseOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        );
      })}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          startIcon={<AddOutlined />}
          disabled={disabled || boxes.some((value) => value.trim() === '')}
          onClick={() => onChange([...boxes, ''])}
          data-testid={`${testIdPrefix}-add-passage`}
        >
          Add another passage
        </Button>
        <Button
          size="small"
          startIcon={<MenuBookOutlined />}
          disabled={disabled}
          onClick={() => setPickerOpen(true)}
          data-testid={`${testIdPrefix}-choose-passage`}
        >
          Choose from the Bible
        </Button>
      </Box>

      {list.problem &&
      list.problem !== 'Fix the passages marked below.' &&
      (showRequired || list.problem !== 'Add at least one passage.') ? (
        <Typography
          variant="body2"
          color="error"
          role="alert"
          sx={{ mt: 1 }}
          data-testid={`${testIdPrefix}-passages-problem`}
        >
          {list.problem}
        </Typography>
      ) : null}

      <PassagePicker
        open={pickerOpen}
        language={language}
        onClose={() => setPickerOpen(false)}
        onPick={addPicked}
        testIdPrefix={`${testIdPrefix}-picker`}
      />
    </Box>
  );
}
