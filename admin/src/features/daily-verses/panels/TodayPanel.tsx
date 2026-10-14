import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { VOTD_TIMEZONE } from '../../../services/firebase/votd';
import { SectionCard, ToneChip, type Tone } from '../../../components/ui';
import { adminFonts } from '../../../theme/tokens';
import { indiaDateKey, isDateKey } from '../votdDate';
import {
  VOTD_SOURCE_LABELS,
  resolveVotdDay,
  votdCycle,
  type VotdDay,
  type VotdDaySource,
} from '../votdStatus';
import { prepareVersePool, type VersePoolEntry, type VotdConfig } from '../votdSelection';
import type { DailyVerse } from '../../../types';

/**
 * TODAY -- the first thing a church administrator should see.
 *
 * The question this page exists to answer is "what is the congregation
 * reading this morning", and before the Verse of the Day was
 * consolidated there was no screen that answered it: one page listed
 * verses set by hand, another configured a rotation, and the pastor had
 * to hold both in their head to work out which one won.
 *
 * The date defaults to today in the canonical Indian calendar -- not the
 * administrator's own calendar -- because that is the date the app uses.
 * An administrator travelling abroad must not be shown a different verse
 * from the one their church is reading.
 */
const SOURCE_LABEL = VOTD_SOURCE_LABELS;

/** A day set by hand is the strongest, the church's own list the brand gold, the built-in year the quietest. */
const SOURCE_TONE: Record<VotdDaySource, Tone> = {
  override: 'navy',
  pool: 'gold',
  year: 'outlined',
};

function SourceChip({ source }: { source: VotdDaySource }) {
  return (
    <Box sx={{ alignSelf: 'flex-start' }}>
      <ToneChip
        tone={SOURCE_TONE[source]}
        label={SOURCE_LABEL[source]}
        testId={`votd-source-${source}`}
      />
    </Box>
  );
}

/** The verse reference as a heading-sized line, in the serif the rest of the admin uses for titles. */
function Reference({
  children,
  size,
  testId,
}: {
  children: string;
  size: 'large' | 'medium';
  testId: string;
}) {
  return (
    <Typography
      component="p"
      sx={{
        fontFamily: adminFonts.heading,
        fontWeight: 600,
        lineHeight: 1.25,
        fontSize: size === 'large' ? '1.75rem' : '1.375rem',
      }}
      data-testid={testId}
    >
      {children}
    </Typography>
  );
}

/** One sentence saying why this verse and not another. */
function explain(day: VotdDay, config: VotdConfig, poolSize: number): string {
  if (day.source === 'override') {
    return 'Someone set this date by hand. A verse set for a date always wins over the rotation.';
  }
  if (day.source === 'pool') {
    return `Chosen automatically from your church’s ${poolSize} verses. Nobody has to do anything for this to happen.`;
  }
  return config.enabled
    ? 'Your church has not added any verses of its own, so the app is using its own year of 365 verses. Nothing needs setting up for this to keep working.'
    : 'Automatic selection from your church’s verses is paused, so the app is using its own year of 365 verses.';
}

export function TodayPanel({
  config,
  pool,
  overrideByDate,
  canManage,
}: {
  config: VotdConfig;
  pool: VersePoolEntry[];
  overrideByDate: Map<string, DailyVerse>;
  /** Whether this role may set a day by hand (a content admin and above). */
  canManage: boolean;
}) {
  const today = indiaDateKey();
  const [dateKey, setDateKey] = useState(today);

  const prepared = useMemo(() => prepareVersePool(pool), [pool]);
  const cycle = useMemo(() => votdCycle(config, prepared), [config, prepared]);

  const todayDay = useMemo(
    () => resolveVotdDay(today, config, pool, overrideByDate),
    [today, config, pool, overrideByDate]
  );
  const chosen = useMemo(
    () =>
      isDateKey(dateKey) ? resolveVotdDay(dateKey, config, pool, overrideByDate) : null,
    [dateKey, config, pool, overrideByDate]
  );

  return (
    <Stack spacing={3} data-testid="votd-today-panel">
      <SectionCard
        title="Today"
        accent
        description={
          <>
            {today} &middot; the day changes at midnight {VOTD_TIMEZONE.replace('_', ' ')}
            .
          </>
        }
      >
        {todayDay ? (
          <Stack spacing={1}>
            <SourceChip source={todayDay.source} />
            <Reference size="large" testId="votd-today-reference">
              {todayDay.reference}
            </Reference>
            <Typography color="text.secondary" variant="body2">
              {explain(todayDay, config, prepared.length)}
            </Typography>
          </Stack>
        ) : (
          <Alert severity="warning" data-testid="votd-today-unavailable">
            Today&rsquo;s date could not be read.
          </Alert>
        )}

        <Typography color="text.secondary" variant="body2" sx={{ mt: 2 }}>
          {/* The one number a church actually asks for. */}
          {cycle.using === 'pool'
            ? `A verse comes round again after ${cycle.days} days — one for each verse your church has added.`
            : `A verse comes round again after ${cycle.days} days.`}
        </Typography>
      </SectionCard>

      <SectionCard
        title="Any other day"
        description="Exactly what the app will show, worked out with the same rules the app uses."
        testId="votd-preview-panel"
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: 'flex-start' }}
        >
          <TextField
            label="Date"
            type="date"
            value={dateKey}
            onChange={(event) => setDateKey(event.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { 'data-testid': 'votd-preview-date' },
            }}
          />
          <Button
            onClick={() => setDateKey(today)}
            disabled={dateKey === today}
            data-testid="votd-preview-today"
          >
            Today
          </Button>
        </Stack>

        <Box sx={{ mt: 2 }} data-testid="votd-preview-result">
          {!chosen ? (
            <Alert severity="warning" data-testid="votd-preview-invalid-date">
              Choose a date to preview.
            </Alert>
          ) : (
            <Stack spacing={1}>
              <SourceChip source={chosen.source} />
              <Reference size="medium" testId="votd-preview-reference">
                {chosen.reference}
              </Reference>
              <Typography color="text.secondary" variant="body2">
                {explain(chosen, config, prepared.length)}
              </Typography>
              {canManage && chosen.source !== 'override' ? (
                <Box>
                  {/* The intentional manual override, offered where the
                      question comes up rather than on a page of its own. */}
                  <Button
                    component={RouterLink}
                    to={`/daily-verses/new?date=${chosen.dateKey}`}
                    size="small"
                    data-testid="votd-set-by-hand"
                  >
                    Set this day by hand instead
                  </Button>
                </Box>
              ) : null}
            </Stack>
          )}
        </Box>
      </SectionCard>
    </Stack>
  );
}
