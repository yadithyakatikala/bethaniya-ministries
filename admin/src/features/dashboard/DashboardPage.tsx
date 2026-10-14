import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, Typography } from '@mui/material';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { PageContainer, SectionCard } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { ROLE_LABELS, type UserRole } from '../../types';
import { adminColors, adminFonts, adminRadii } from '../../theme/tokens';
import { indiaDateKey } from '../daily-verses/votdDate';
import {
  VOTD_SOURCE_LABELS,
  indexOverridesByDate,
  resolveVotdDay,
} from '../daily-verses/votdStatus';
import { currentProphetVerseId } from '../prophet-verses/state';
import { useNow } from '../prophet-verses/useNow';
import { ItemList, PanelSkeleton, QuickActionList, StatTile } from './DashboardSections';
import {
  buildItems,
  buildTiles,
  canCreateContent,
  comingUp,
  countPlans,
  describeAge,
  isLoaded,
  liveEvent,
  needsAttention,
  planCountsLine,
  quickActionsFor,
  recentPlans,
  recentlyUpdated,
} from './dashboardModel';
import { FAILED_READ_NAMES, useDashboardData } from './useDashboardData';

/**
 * The first page after signing in: what needs doing, what is coming, what has
 * just changed, and the shortcuts to the things done most.
 *
 * REAL DATA ONLY. Every figure is a count of documents the pages below it
 * already read (with the same subscriptions), every list is real documents in a
 * stated order, and a figure that cannot be known yet is a dash, never a
 * zero. If a collection cannot be read the page says so, because a number
 * from a failed read is not the answer to anything. No analytics are
 * invented.
 *
 * TODAY'S VERSE is resolved the way the Verse of the Day page resolves it --
 * by the same functions -- and says where it came from. (It used to say
 * "Not set" when nobody had set a verse by hand, which was wrong: the app
 * chooses one every day by itself.)
 *
 * ROLES. Content administrators and above see the shortcuts to create things,
 * can open every row, and see the moderation count. A host, who can look and
 * run the live stream, sees the rows as plain text and shortcuts to their own
 * work. As elsewhere, hiding a control is a courtesy; firestore.rules is the
 * boundary.
 */
export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const signOut = useAuthStore((s) => s.signOut);
  const now = useNow();
  const data = useDashboardData(role);

  const canOpen = canCreateContent(role);
  const { sources } = data;
  const loaded = isLoaded(sources);

  const items = useMemo(() => buildItems(sources, now), [sources, now]);
  const attention = useMemo(() => needsAttention(items), [items]);
  const upcoming = useMemo(() => comingUp(items), [items]);
  const recent = useMemo(() => recentlyUpdated(items), [items]);
  const tiles = useMemo(
    () => buildTiles(sources, now, data.openReports),
    [sources, now, data.openReports]
  );
  const planCounts = useMemo(
    () => (sources.plans ? countPlans(sources.plans, now) : null),
    [sources.plans, now]
  );
  const recentPlanItems = useMemo(() => recentPlans(items), [items]);
  const live = sources.events ? liveEvent(sources.events) : null;

  // Today, in the calendar the app uses (India's), not the administrator's own.
  const todayKey = indiaDateKey(now);
  const { config, pool, overrides } = data.verse;
  const verseDay = useMemo(
    () =>
      config && pool && overrides
        ? resolveVotdDay(todayKey, config, pool, indexOverridesByDate(overrides))
        : null,
    [config, pool, overrides, todayKey]
  );
  const verseFailed = data.failed.includes('verse');

  const prophetShowing = useMemo(() => {
    if (!sources.prophet) return undefined;
    const id = currentProphetVerseId([...sources.prophet], now);
    return sources.prophet.find((verse) => verse.id === id) ?? null;
  }, [sources.prophet, now]);

  const failedNames = data.failed.map((name) => FAILED_READ_NAMES[name]);
  const actions = quickActionsFor(role);
  const roleLabel =
    role && role in ROLE_LABELS ? ROLE_LABELS[role as UserRole] : undefined;

  return (
    <PageContainer width="wide" testId="dashboard-page">
      <AdminPageHeader
        eyebrow={roleLabel}
        title={`Welcome, ${user?.email ?? 'Admin'}`}
        subtitle="What needs your attention, what is coming up, and what has just changed in the app."
        action={
          <Button
            variant="outlined"
            onClick={() => void signOut()}
            data-testid="sign-out-button"
          >
            Sign out
          </Button>
        }
      />

      {failedNames.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 3 }} data-testid="dashboard-read-errors">
          Could not read {failedNames.join(', ')}. The figures for{' '}
          {failedNames.length === 1 ? 'it are' : 'them are'} missing or out of date. Check
          your connection and reload the page.
        </Alert>
      ) : null}

      {live ? (
        <Box
          role="status"
          data-testid="dashboard-live"
          sx={{
            mb: 3,
            p: { xs: 2, sm: 3 },
            borderRadius: `${adminRadii.card}px`,
            bgcolor: adminColors.danger,
            color: adminColors.onPrimary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Chip
              label="LIVE NOW"
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.18)',
                color: adminColors.onPrimary,
                fontWeight: 700,
                mb: 1,
              }}
            />
            <Typography
              component="p"
              sx={{
                fontFamily: adminFonts.heading,
                fontSize: '1.375rem',
                fontWeight: 600,
              }}
            >
              {live.title}
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to="/events"
            variant="outlined"
            sx={{
              color: adminColors.onPrimary,
              borderColor: adminColors.onPrimary,
              '&:hover': {
                borderColor: adminColors.onPrimary,
                bgcolor: 'rgba(255,255,255,0.12)',
              },
            }}
          >
            Manage the live stream
          </Button>
        </Box>
      ) : null}

      <Box
        data-testid="dashboard-tiles"
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          mb: 3,
        }}
      >
        {tiles.map((tile) => (
          <StatTile key={tile.id} tile={tile} />
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          },
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
          <SectionCard title="Needs attention" testId="dashboard-attention">
            {loaded ? (
              <ItemList
                items={attention}
                now={now}
                limit={6}
                linked={canOpen}
                label="Drafts that are not published yet"
                testId="dashboard-attention-list"
                empty="No drafts waiting. Everything that has been written is published or scheduled."
              />
            ) : (
              <PanelSkeleton label="Loading drafts" />
            )}
          </SectionCard>

          <SectionCard title="Coming up" testId="dashboard-upcoming">
            {loaded ? (
              <ItemList
                items={upcoming}
                now={now}
                limit={6}
                linked={canOpen}
                label="Scheduled to open"
                testId="dashboard-upcoming-list"
                empty="Nothing is scheduled. Plans, photos and Prophet verses you schedule appear here."
              />
            ) : (
              <PanelSkeleton label="Loading scheduled items" />
            )}
          </SectionCard>

          <SectionCard title="Recently updated" testId="dashboard-recent">
            {loaded ? (
              <ItemList
                items={recent}
                now={now}
                limit={6}
                linked={canOpen}
                label="Published, most recently changed first"
                testId="dashboard-recent-list"
                empty="Nothing has been published yet."
              />
            ) : (
              <PanelSkeleton label="Loading published items" />
            )}
          </SectionCard>
        </Box>

        <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
          {actions.length > 0 ? (
            <SectionCard title="Quick actions" testId="dashboard-quick-actions">
              <QuickActionList actions={actions} />
            </SectionCard>
          ) : null}

          <SectionCard
            title="Today’s verse"
            testId="dashboard-verse"
            link={{ to: '/daily-verses', label: 'Open' }}
          >
            {verseFailed ? (
              <Typography variant="body2" sx={{ color: adminColors.inkMuted }}>
                Could not check today’s verse.
              </Typography>
            ) : verseDay ? (
              <Box>
                <Typography
                  component="p"
                  data-testid="dashboard-verse-reference"
                  sx={{
                    fontFamily: adminFonts.heading,
                    fontSize: '1.375rem',
                    fontWeight: 600,
                  }}
                >
                  {verseDay.reference}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: adminColors.inkMuted, mt: 0.5 }}
                  data-testid="dashboard-verse-source"
                >
                  {VOTD_SOURCE_LABELS[verseDay.source]}
                </Typography>
              </Box>
            ) : (
              <PanelSkeleton label="Loading today’s verse" />
            )}
          </SectionCard>

          <SectionCard
            title="Prophet verse"
            testId="dashboard-prophet"
            link={{ to: '/prophet-verses', label: 'Open' }}
          >
            {prophetShowing === undefined ? (
              <PanelSkeleton label="Loading the Prophet verse" />
            ) : prophetShowing ? (
              <Box>
                <Typography
                  component="p"
                  sx={{
                    fontFamily: adminFonts.heading,
                    fontSize: '1.125rem',
                    fontWeight: 600,
                  }}
                >
                  {prophetShowing.title.trim() || prophetShowing.reference}
                </Typography>
                <Typography variant="body2" sx={{ color: adminColors.inkMuted }}>
                  Showing now · {prophetShowing.reference}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: adminColors.inkMuted }}>
                No Prophet verse is showing.
              </Typography>
            )}
          </SectionCard>

          <SectionCard
            title="Reading plans"
            testId="dashboard-plans"
            link={{ to: '/plans', label: 'All plans' }}
          >
            {planCounts === null ? (
              <PanelSkeleton label="Loading reading plans" />
            ) : (
              <>
                <Typography
                  variant="body2"
                  sx={{ color: adminColors.inkMuted, mb: 1 }}
                  data-testid="dashboard-plans-counts"
                >
                  {planCountsLine(planCounts)}
                </Typography>
                <ItemList
                  items={recentPlanItems}
                  now={now}
                  limit={3}
                  linked={canOpen}
                  label="Recently changed reading plans"
                  testId="dashboard-plans-list"
                  empty="No reading plans yet."
                  showKind={false}
                />
              </>
            )}
          </SectionCard>

          <SectionCard
            title="Last notification"
            testId="dashboard-notification"
            link={{ to: '/notifications', label: 'Notifications' }}
          >
            {data.lastNotification === undefined ? (
              <PanelSkeleton label="Loading notifications" />
            ) : data.lastNotification ? (
              <Box>
                <Typography
                  sx={{
                    fontWeight: 600,
                    color: adminColors.ink,
                    overflowWrap: 'anywhere',
                  }}
                >
                  “{data.lastNotification.title}”
                </Typography>
                <Typography variant="body2" sx={{ color: adminColors.inkMuted }}>
                  Matched {data.lastNotification.recipientCount}{' '}
                  {data.lastNotification.recipientCount === 1 ? 'user' : 'users'}
                  {data.lastNotification.sentAt
                    ? ` · ${describeAge(data.lastNotification.sentAt, now)}`
                    : ''}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: adminColors.inkMuted }}>
                No notifications sent yet.
              </Typography>
            )}
          </SectionCard>
        </Box>
      </Box>
    </PageContainer>
  );
}
