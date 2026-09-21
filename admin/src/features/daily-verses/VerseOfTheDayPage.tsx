import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useAuthStore } from '../../store/authStore';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import {
  subscribeToVersePool,
  subscribeToVotdConfig,
  type VersePoolEntryDocument,
  type VotdConfigDocument,
} from '../../services/firebase/votd';
import { subscribeToDailyVerses } from '../../services/firebase/dailyVerses';
import { indexOverridesByDate } from './votdStatus';
import { TodayPanel } from './panels/TodayPanel';
import { SchedulePanel } from './panels/SchedulePanel';
import { OverridesPanel } from './panels/OverridesPanel';
import { PoolPanel } from './panels/PoolPanel';
import { AutomationPanel } from './panels/AutomationPanel';
import type { DailyVerse } from '../../types';

/**
 * =====================================================================
 * VERSE OF THE DAY -- ONE PAGE
 * =====================================================================
 * There used to be two. "Daily Verses" listed the days somebody had set
 * by hand; "Verse Automation" configured the rotation that fills in
 * every other day. Both were in the sidebar, neither said what the other
 * did, and neither answered the question a church administrator actually
 * arrives with: WHAT IS THE CONGREGATION READING THIS MORNING?
 *
 * That was not two features. It was one feature split across two
 * screens, and the split is what made an automatic system look like a
 * manual one -- if the dashboard offers you a page called "Automation",
 * it is reasonable to assume something has to be set up on it each day.
 * Nothing does. Nothing ever did.
 *
 * ---------------------------------------------------------------------
 * WHAT THE FOUR TABS ARE
 * ---------------------------------------------------------------------
 *   Today          what the app is showing, and what it will show on any
 *                  date you pick -- plus the way to set a day by hand.
 *   Schedule       which verse falls on which day, a year ahead.
 *   Verses         the days set by hand, and the church's own verse list
 *                  if it keeps one. The CONTENT, in one place.
 *   How it works   the status of the automation and its two settings.
 *
 * ---------------------------------------------------------------------
 * WHAT DID NOT CHANGE
 * ---------------------------------------------------------------------
 * The architecture. Nothing about how a verse is chosen was rewritten
 * for this: the selection is still the M5 seeded full-cycle rotation
 * (./votdSelection.ts), the precedence is still override then pool then
 * the app's own year, the documents are still daily_verses,
 * settings/dailyVerse and verse_pool, and firestore.rules is untouched.
 * This page is a rearrangement of what an administrator is shown, not a
 * replacement for what the app does.
 *
 * ---------------------------------------------------------------------
 * THE READS
 * ---------------------------------------------------------------------
 * Three listeners, opened once here and shared by every tab, rather than
 * one per panel. Switching tabs therefore costs nothing, and -- more to
 * the point -- every tab is looking at the same snapshot, so the
 * schedule cannot disagree with the "today" card.
 *
 * RBAC: every dashboard role can view. Seeing which verse the
 * congregation gets is not privileged. Only a content admin or super
 * admin sees the controls, matching firestore.rules. As everywhere in
 * this app, that gate is a convenience; the rules are the boundary.
 */
function canManageVotd(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

type TabKey = 'today' | 'schedule' | 'verses' | 'how';

export function VerseOfTheDayPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = canManageVotd(role);

  const [tab, setTab] = useState<TabKey>('today');
  const [config, setConfig] = useState<VotdConfigDocument | null>(null);
  const [pool, setPool] = useState<VersePoolEntryDocument[] | null>(null);
  const [overrides, setOverrides] = useState<DailyVerse[] | null>(null);
  const [overridesError, setOverridesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeConfig = subscribeToVotdConfig(
      (next) => {
        setConfig(next);
        setError(null);
      },
      () => setError('Could not load the Verse of the Day settings.')
    );
    const unsubscribePool = subscribeToVersePool(
      (next) => setPool(next),
      () => setError('Could not load your church’s verses.')
    );
    const unsubscribeOverrides = subscribeToDailyVerses(
      (next) => {
        setOverrides(next);
        setOverridesError(null);
      },
      // Not fatal to the page: the rotation is still readable and still
      // correct for every day nobody set by hand. The Verses tab says so.
      () => setOverridesError('Could not load daily verses. Please try again.')
    );
    return () => {
      unsubscribeConfig();
      unsubscribePool();
      unsubscribeOverrides();
    };
  }, []);

  const overrideByDate = useMemo(
    () => indexOverridesByDate(overrides ?? []),
    [overrides]
  );

  return (
    <Box sx={{ p: 4 }} data-testid="verse-of-the-day-page">
      <AdminPageHeader title="Verse of the Day" />
      <Typography color="text.secondary" sx={{ fontSize: 14, mt: -2, mb: 3 }}>
        The verse every member sees on the home screen. The app chooses one for every day
        on its own &mdash; you only step in when you want a particular day to be different.
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }} data-testid="votd-error">
          {error}
        </Alert>
      ) : null}

      <Tabs
        value={tab}
        onChange={(_event, next: TabKey) => setTab(next)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        <Tab label="Today" value="today" data-testid="votd-tab-today" />
        <Tab label="Schedule" value="schedule" data-testid="votd-tab-schedule" />
        <Tab label="Verses" value="verses" data-testid="votd-tab-verses" />
        <Tab label="How it works" value="how" data-testid="votd-tab-how" />
      </Tabs>

      {!config || !pool ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="votd-loading" />
        </Box>
      ) : (
        <>
          {tab === 'today' ? (
            <TodayPanel config={config} pool={pool} overrideByDate={overrideByDate} />
          ) : null}

          {tab === 'schedule' ? (
            <SchedulePanel config={config} pool={pool} overrideByDate={overrideByDate} />
          ) : null}

          {tab === 'verses' ? (
            <Stack spacing={3}>
              <OverridesPanel verses={overrides} error={overridesError} />
              <PoolPanel config={config} pool={pool} canManage={canManage} />
            </Stack>
          ) : null}

          {tab === 'how' ? (
            <AutomationPanel config={config} pool={pool} canManage={canManage} />
          ) : null}
        </>
      )}
    </Box>
  );
}
