import { Alert, Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { adminColors, adminRadii } from '../../theme/tokens';
import { DAY_LIMITS, dayHasErrors, type DayDraft } from './planDays';
import { checkPassageList } from './passages';

/**
 * The plan's days, in order. A day's number is its place in this list --
 * there is no number to type, so two days can never share one -- and the
 * arrows are how the order changes.
 *
 * Each row shows what an administrator scanning thirty days needs: the
 * number, the title, the reading, and whether anything on that day still
 * has to be fixed before the plan can be published.
 */
export function PlanDaysTab({
  days,
  selectedKey,
  live,
  readOnly,
  showErrors,
  onAdd,
  onAddSeveral,
  onOpen,
  onMove,
  onDuplicate,
  onRemove,
}: {
  days: readonly DayDraft[];
  selectedKey: string | null;
  /** The plan is visible (or about to be) to members. */
  live: boolean;
  readOnly: boolean;
  showErrors: boolean;
  onAdd: () => void;
  onAddSeveral: (count: number) => void;
  onOpen: (key: string) => void;
  onMove: (key: string, direction: 'up' | 'down') => void;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const atLimit = days.length >= DAY_LIMITS.maxDays;

  return (
    <Box data-testid="plan-days-tab">
      {live ? (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="plan-days-live-warning">
          Members can see this plan now. Their progress is saved by day number, so moving
          or removing a day changes which day they have finished. Adding days at the end
          is always safe.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          mb: 2,
        }}
      >
        <Typography variant="h5" component="h2">
          {days.length === 0
            ? 'Days'
            : `${days.length} ${days.length === 1 ? 'day' : 'days'}`}
        </Typography>
        {!readOnly ? (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              disabled={atLimit}
              onClick={() => onAddSeveral(Math.min(7, DAY_LIMITS.maxDays - days.length))}
              data-testid="plan-add-seven-days"
            >
              Add 7 blank days
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddOutlined />}
              disabled={atLimit}
              onClick={onAdd}
              data-testid="plan-add-day"
            >
              Add day
            </Button>
          </Box>
        ) : null}
      </Box>

      {days.length === 0 ? (
        <AdminEmptyState
          testId="plan-days-empty"
          icon={<EventNoteOutlined />}
          title="No days yet"
          message="A plan is a list of days, each with a reading and, if you like, a devotional, a question and a prayer. Add the first day to begin."
          action={
            !readOnly ? (
              <Button variant="contained" onClick={onAdd} startIcon={<AddOutlined />}>
                Add the first day
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Box
          component="ol"
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}
          data-testid="plan-days-list"
        >
          {days.map((day, index) => {
            const number = index + 1;
            const problems = dayHasErrors(day);
            const passages = checkPassageList(day.passages);
            const reading = passages.stored || 'No reading yet';
            return (
              <Box
                component="li"
                key={day.key}
                data-testid={`plan-day-row-${number}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  // A phone cannot hold the number, a readable title and five
                  // buttons side by side; the buttons drop to their own line
                  // instead of squeezing the title to a few letters.
                  flexWrap: 'wrap',
                  gap: 1.5,
                  p: 1.5,
                  border: `1px solid ${
                    selectedKey === day.key ? adminColors.accent : adminColors.border
                  }`,
                  borderRadius: `${adminRadii.control}px`,
                  bgcolor: adminColors.surface,
                }}
              >
                <Box
                  title={`Day ${number}`}
                  sx={{
                    flexShrink: 0,
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: adminColors.primaryTint,
                    color: adminColors.primary,
                    fontWeight: 600,
                  }}
                >
                  {number}
                </Box>

                <Box sx={{ flex: '1 1 160px', minWidth: 0 }}>
                  <Typography
                    sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                    data-testid={`plan-day-title-${number}`}
                  >
                    {day.title.trim() || 'Untitled day'}
                  </Typography>
                  <Typography
                    variant="body2"
                    color={
                      passages.results.length === 0 ? 'text.disabled' : 'text.secondary'
                    }
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {reading}
                  </Typography>
                </Box>

                {problems &&
                (showErrors || day.title.trim() || passages.results.length > 0) ? (
                  <Chip
                    size="small"
                    icon={<ErrorOutlineOutlined />}
                    label="Needs attention"
                    color="warning"
                    variant="outlined"
                    data-testid={`plan-day-problem-${number}`}
                  />
                ) : null}

                <Box sx={{ display: 'flex', flexShrink: 0, ml: 'auto' }}>
                  <Tooltip title={readOnly ? 'View day' : 'Edit day'}>
                    <IconButton
                      aria-label={`${readOnly ? 'View' : 'Edit'} day ${number}`}
                      onClick={() => onOpen(day.key)}
                      data-testid={`plan-day-open-${number}`}
                    >
                      <EditOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {!readOnly ? (
                    <>
                      <Tooltip title="Move earlier">
                        <span>
                          <IconButton
                            aria-label={`Move day ${number} earlier`}
                            disabled={index === 0}
                            onClick={() => onMove(day.key, 'up')}
                            data-testid={`plan-day-up-${number}`}
                          >
                            <ArrowUpwardOutlined fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move later">
                        <span>
                          <IconButton
                            aria-label={`Move day ${number} later`}
                            disabled={index === days.length - 1}
                            onClick={() => onMove(day.key, 'down')}
                            data-testid={`plan-day-down-${number}`}
                          >
                            <ArrowDownwardOutlined fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Duplicate day">
                        <span>
                          <IconButton
                            aria-label={`Duplicate day ${number}`}
                            disabled={atLimit}
                            onClick={() => onDuplicate(day.key)}
                            data-testid={`plan-day-duplicate-${number}`}
                          >
                            <ContentCopyOutlined fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete day">
                        <IconButton
                          aria-label={`Delete day ${number}`}
                          onClick={() => onRemove(day.key)}
                          data-testid={`plan-day-delete-${number}`}
                        >
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
