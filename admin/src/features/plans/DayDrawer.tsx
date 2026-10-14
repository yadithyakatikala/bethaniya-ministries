import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import type { PlanLanguage } from '../../types';
import { adminColors } from '../../theme/tokens';
import { DAY_LIMITS, validateDay, type DayDraft } from './planDays';
import { PassageListField } from './PassageListField';

type DayPatch = Partial<Omit<DayDraft, 'key' | 'id'>>;

function counter(value: string, max: number): string {
  return `${value.trim().length.toLocaleString('en')} / ${max.toLocaleString('en')}`;
}

/**
 * One day, opened for editing in a drawer beside the list. Edits are applied
 * as they are typed (there is no Apply step), so closing the drawer never
 * loses anything; nothing is SAVED until the plan is saved.
 *
 * Previous / Next move between days without closing the drawer, which is
 * how a thirty-day plan is actually written.
 */
export function DayDrawer({
  open,
  day,
  dayNumber,
  dayCount,
  language,
  readOnly,
  showErrors,
  onChange,
  onClose,
  onPrevious,
  onNext,
}: {
  open: boolean;
  day: DayDraft | null;
  dayNumber: number;
  dayCount: number;
  language: PlanLanguage;
  readOnly: boolean;
  /** Show "required" messages too (after a failed save or publish attempt). */
  showErrors: boolean;
  onChange: (patch: DayPatch) => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const errors = day ? validateDay(day) : {};

  return (
    <Drawer
      anchor="right"
      open={open && day !== null}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { width: { xs: '100%', sm: 560 }, maxWidth: '100%' },
          // The drawer is a dialog to assistive technology: it takes focus,
          // and the page behind it is inert until it closes.
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': 'day-drawer-title',
        } as object,
      }}
      data-testid="day-drawer"
    >
      {day ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2.5,
              py: 1.5,
              borderBottom: `1px solid ${adminColors.border}`,
            }}
          >
            <Typography
              id="day-drawer-title"
              variant="h5"
              component="h2"
              sx={{ flex: 1, minWidth: 0 }}
            >
              Day {dayNumber}{' '}
              <Typography component="span" color="text.secondary">
                of {dayCount}
              </Typography>
            </Typography>
            <Tooltip title="Previous day">
              <span>
                <IconButton
                  aria-label="Previous day"
                  onClick={onPrevious}
                  disabled={dayNumber <= 1}
                  data-testid="day-drawer-previous"
                >
                  <ChevronLeftOutlined />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Next day">
              <span>
                <IconButton
                  aria-label="Next day"
                  onClick={onNext}
                  disabled={dayNumber >= dayCount}
                  data-testid="day-drawer-next"
                >
                  <ChevronRightOutlined />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              aria-label="Close"
              onClick={onClose}
              data-testid="day-drawer-close"
            >
              <CloseOutlined />
            </IconButton>
          </Box>

          <Box
            component="fieldset"
            disabled={readOnly}
            sx={{ border: 0, m: 0, p: 2.5, minWidth: 0, flex: 1, overflowY: 'auto' }}
          >
            <TextField
              label="Title"
              fullWidth
              required
              value={day.title}
              onChange={(event) => onChange({ title: event.target.value })}
              error={Boolean(errors.title) && (showErrors || day.title.trim().length > 0)}
              helperText={
                (showErrors || day.title.trim().length > 0 ? errors.title : undefined) ??
                'Shown at the top of the day, e.g. "The Lord is my shepherd".'
              }
              slotProps={{ htmlInput: { 'data-testid': 'day-title' } }}
            />

            <PassageListField
              passages={day.passages}
              onChange={(passages) => onChange({ passages })}
              language={language}
              disabled={readOnly}
              showRequired={showErrors}
              testIdPrefix="day"
            />

            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2">What members read and do</Typography>
            <Typography variant="body2" color="text.secondary">
              All optional. Leave out anything this day does not need.
            </Typography>

            <TextField
              label="Devotional"
              fullWidth
              multiline
              minRows={5}
              margin="normal"
              value={day.devotional}
              onChange={(event) => onChange({ devotional: event.target.value })}
              error={Boolean(errors.devotional)}
              helperText={
                errors.devotional ??
                `${counter(day.devotional, DAY_LIMITS.devotional)} · A blank line starts a new paragraph.`
              }
              slotProps={{ htmlInput: { 'data-testid': 'day-devotional' } }}
            />
            <TextField
              label="Reflection question"
              fullWidth
              multiline
              minRows={2}
              margin="normal"
              value={day.reflectionQuestion}
              onChange={(event) => onChange({ reflectionQuestion: event.target.value })}
              error={Boolean(errors.reflectionQuestion)}
              helperText={
                errors.reflectionQuestion ??
                `${counter(day.reflectionQuestion, DAY_LIMITS.reflectionQuestion)} · A question to think about after reading.`
              }
              slotProps={{ htmlInput: { 'data-testid': 'day-reflection' } }}
            />
            <TextField
              label="Prayer"
              fullWidth
              multiline
              minRows={2}
              margin="normal"
              value={day.prayerPrompt}
              onChange={(event) => onChange({ prayerPrompt: event.target.value })}
              error={Boolean(errors.prayerPrompt)}
              helperText={
                errors.prayerPrompt ??
                `${counter(day.prayerPrompt, DAY_LIMITS.prayerPrompt)} · A prompt for prayer.`
              }
              slotProps={{ htmlInput: { 'data-testid': 'day-prayer' } }}
            />
            <TextField
              label="Application"
              fullWidth
              multiline
              minRows={2}
              margin="normal"
              value={day.application}
              onChange={(event) => onChange({ application: event.target.value })}
              error={Boolean(errors.application)}
              helperText={
                errors.application ??
                `${counter(day.application, DAY_LIMITS.application)} · One way to put today's reading into practice.`
              }
              slotProps={{ htmlInput: { 'data-testid': 'day-application' } }}
            />
            <TextField
              label="Notes for readers"
              fullWidth
              multiline
              minRows={2}
              margin="normal"
              value={day.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              error={Boolean(errors.notes)}
              helperText={
                errors.notes ??
                `${counter(day.notes, DAY_LIMITS.notes)} · Background shown to readers in the app. Not private.`
              }
              slotProps={{ htmlInput: { 'data-testid': 'day-notes' } }}
            />
          </Box>

          <Box
            sx={{
              p: 2,
              borderTop: `1px solid ${adminColors.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Button variant="contained" onClick={onClose} data-testid="day-drawer-done">
              Done
            </Button>
          </Box>
        </Box>
      ) : null}
    </Drawer>
  );
}
