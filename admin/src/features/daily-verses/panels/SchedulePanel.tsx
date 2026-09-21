import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { AdminTableCard } from '../../../components/AdminTableCard';
import { indiaDateKey } from '../votdDate';
import { prepareVersePool, type VersePoolEntry, type VotdConfig } from '../votdSelection';
import { resolveVotdSchedule, votdCycle, type VotdDaySource } from '../votdStatus';
import type { DailyVerse } from '../../../types';

/**
 * THE SCHEDULE -- which verse falls on which day, for a year ahead.
 *
 * ---------------------------------------------------------------------
 * WHY THIS CAN BE A TABLE AT ALL
 * ---------------------------------------------------------------------
 * Because nothing is scheduled. There is no stored list of days and no
 * queue being consumed: each row below is worked out on the spot from
 * the date, the seed and the pool version, by the same arithmetic the
 * phone runs (see ../votdSelection.ts). That is also why the table can
 * start on any date, run as far as it likes, and never be "behind" --
 * and why a church never has to create a record for tomorrow.
 *
 * It is worth saying plainly what the day numbers mean. "Day 1" is the
 * first day of the run being listed, not a slot the first verse in the
 * pool is pinned to. The rotation steps through the pool by a stride
 * chosen from the seed, so the pool's order is not the order it comes
 * up in -- what IS guaranteed, and what this table lets a pastor check,
 * is that every verse appears exactly once before any of them repeats.
 *
 * ---------------------------------------------------------------------
 * WHY IT IS NOT 365 ROWS ON ARRIVAL
 * ---------------------------------------------------------------------
 * A church administrator opening this tab wants the next week or two.
 * Rendering a year of table rows to satisfy the rarer question costs
 * every visit a slow page for no one's benefit, so the run grows on
 * request instead, up to the whole year.
 */
const SOURCE_LABEL: Record<VotdDaySource, string> = {
  override: 'Set by hand',
  pool: 'Your church’s verses',
  year: 'Built-in year',
};

const FIRST_PAGE = 30;
const PAGE = 90;
const MAX_DAYS = 365;

export function SchedulePanel({
  config,
  pool,
  overrideByDate,
}: {
  config: VotdConfig;
  pool: VersePoolEntry[];
  overrideByDate: Map<string, DailyVerse>;
}) {
  const today = indiaDateKey();
  const [days, setDays] = useState(FIRST_PAGE);

  const prepared = useMemo(() => prepareVersePool(pool), [pool]);
  const cycle = useMemo(() => votdCycle(config, prepared), [config, prepared]);

  const schedule = useMemo(
    () => resolveVotdSchedule(today, days, config, pool, overrideByDate),
    [today, days, config, pool, overrideByDate]
  );

  // The claim the page makes, checked against the rows on screen rather
  // than asserted: if a duplicate ever appeared inside one cycle the
  // count would drop and the sentence below would say so.
  const distinctWithinCycle = useMemo(
    () => new Set(schedule.slice(0, cycle.days).map((day) => day.reference)).size,
    [schedule, cycle.days]
  );

  return (
    <Stack spacing={2} data-testid="votd-schedule-panel">
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 3 }}>
        <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
          The {cycle.days}-day schedule
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 14 }}>
          {cycle.using === 'year'
            ? 'The app carries a year of 365 verses and works out each day’s verse from the date. Nothing has to be created for a day, ever — not by you and not by anyone else.'
            : `Your church’s ${cycle.days} verses, in the order they will come up. Each one appears once before any of them repeats, so the cycle lasts ${cycle.days} days.`}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 13, mt: 1 }}>
          Starting today, {today}. A day set by hand appears here too, in its place.
        </Typography>
      </Paper>

      <AdminTableCard>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Day</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Verse</TableCell>
                <TableCell>Where it comes from</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedule.map((day, index) => (
                <TableRow key={day.dateKey} data-testid={`votd-schedule-row-${day.dateKey}`}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{day.dateKey}</TableCell>
                  <TableCell>{day.reference}</TableCell>
                  <TableCell>
                    {/* Named, never a colour alone. */}
                    <Chip
                      size="small"
                      variant={day.source === 'override' ? 'filled' : 'outlined'}
                      color={day.source === 'override' ? 'primary' : 'default'}
                      label={SOURCE_LABEL[day.source]}
                      data-testid={`votd-schedule-source-${day.dateKey}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AdminTableCard>

      <Box>
        {days < MAX_DAYS ? (
          <Button
            onClick={() => setDays((current) => Math.min(current + PAGE, MAX_DAYS))}
            data-testid="votd-schedule-more"
          >
            Show more days
          </Button>
        ) : null}
        <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
          Showing {schedule.length} days
          {days >= MAX_DAYS ? ' — a full year.' : '.'}
          {schedule.length >= cycle.days
            ? ` All ${distinctWithinCycle} verses of the cycle are different.`
            : ''}
        </Typography>
      </Box>
    </Stack>
  );
}
