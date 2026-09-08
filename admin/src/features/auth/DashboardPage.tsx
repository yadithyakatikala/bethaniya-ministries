import { useEffect, useState } from 'react';
import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import { useAuthStore } from '../../store/authStore';
import { subscribeToAnnouncements } from '../../services/firebase/announcements';
import { subscribeToSongs } from '../../services/firebase/songs';
import { subscribeToEvents } from '../../services/firebase/events';
import { subscribeToDailyVerses } from '../../services/firebase/dailyVerses';
import { subscribeToNotificationLog } from '../../services/firebase/notifications';
import type { Announcement, Event, NotificationLogEntry, Song } from '../../types';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A small stat card, backed by a real subscription below -- never
 * decorative/invented numbers (the UI audit is explicit: "Do not invent
 * meaningless analytics"). Shows a dash while its subscription's first
 * snapshot hasn't arrived yet, rather than a misleading 0.
 */
function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, flex: '1 1 200px' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography
        sx={{ fontFamily: 'Newsreader, serif', fontSize: 28, fontWeight: 500, mt: 0.5 }}
      >
        {value}
      </Typography>
      {detail ? (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
          {detail}
        </Typography>
      ) : null}
    </Paper>
  );
}

/**
 * Authenticated dashboard shell -- Day 2 proved the authenticated +
 * authorized state renders and sign-out works. Days 4-11 each added a
 * link into that day's new page via a plain button row on this page
 * (Announcements, Daily Verses, Songs, Events, Notifications, Users).
 *
 * Day 13 removes that button row: App.tsx now wraps every authenticated
 * route (including this one) in AdminLayout.tsx, a persistent sidebar
 * providing the exact same links -- see that file's doc comment for the
 * "Sidebar navigation, responsive layout" refinement this implements.
 * Keeping both would mean two navigation surfaces pointing at the same
 * places, which is what Day 13's "Admin dashboard polished" goal argues
 * against, not for. Sign out stays here (an account action on this
 * specific screen, not a navigation link the sidebar is responsible
 * for).
 *
 * Restyled for the approved "Vespers" direction: a live-status banner
 * plus stat cards for content counts, today's verse, and the most
 * recent notification -- each one reads through the same
 * subscribeTo*() functions the corresponding list pages already use
 * (see services/firebase/), so nothing here is a new query shape or an
 * invented number. "Welcome, {email}" / "Role: {role}" and the
 * sign-out button keep their exact text/testID.
 */
export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const signOut = useAuthStore((s) => s.signOut);

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [hasTodaysVerse, setHasTodaysVerse] = useState<boolean | null>(null);
  const [latestNotification, setLatestNotification] = useState<
    NotificationLogEntry[] | null
  >(null);

  useEffect(
    () => subscribeToAnnouncements(setAnnouncements, () => setAnnouncements([])),
    []
  );
  useEffect(() => subscribeToSongs(setSongs, () => setSongs([])), []);
  useEffect(() => subscribeToEvents(setEvents, () => setEvents([])), []);
  useEffect(
    () =>
      subscribeToDailyVerses(
        (verses) => setHasTodaysVerse(verses.some((v) => v.date === todayDateString())),
        () => setHasTodaysVerse(false)
      ),
    []
  );
  useEffect(
    () =>
      subscribeToNotificationLog(setLatestNotification, () => setLatestNotification([])),
    []
  );

  const liveEvent = events?.find((event) => event.isLive) ?? null;
  const publishedAnnouncements = announcements?.filter((a) => a.published).length ?? null;
  const draftAnnouncements = announcements?.filter((a) => !a.published).length ?? null;
  const mostRecentNotification = latestNotification?.[0] ?? null;

  return (
    <Box sx={{ p: { xs: 2.5, sm: 4 } }} data-testid="dashboard-page">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" component="h1" gutterBottom>
            Welcome, {user?.email ?? 'Admin'}
          </Typography>
          <Typography color="text.secondary">Role: {role}</Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => void signOut()}
          data-testid="sign-out-button"
        >
          Sign out
        </Button>
      </Box>

      {liveEvent ? (
        <Paper
          sx={{
            bgcolor: '#C0392B',
            color: '#fff',
            p: 3,
            borderRadius: 3,
            mb: 3,
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
                bgcolor: 'rgba(255,255,255,0.16)',
                color: '#fff',
                fontWeight: 700,
                mb: 1,
              }}
            />
            <Typography sx={{ fontFamily: 'Newsreader, serif', fontSize: 20 }}>
              {liveEvent.title}
            </Typography>
          </Box>
        </Paper>
      ) : null}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <StatCard
          label="Announcements"
          value={announcements ? String(announcements.length) : '—'}
          detail={
            publishedAnnouncements !== null
              ? `${publishedAnnouncements} published · ${draftAnnouncements} draft`
              : undefined
          }
        />
        <StatCard label="Songs" value={songs ? String(songs.length) : '—'} />
        <StatCard label="Events" value={events ? String(events.length) : '—'} />
        <StatCard
          label="Today's verse"
          value={hasTodaysVerse === null ? '—' : hasTodaysVerse ? 'Set' : 'Not set'}
        />
      </Box>

      <Paper variant="outlined" sx={{ mt: 3, p: 2.5, borderRadius: 3 }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: 'text.secondary',
            mb: 1.5,
          }}
        >
          RECENT NOTIFICATION ACTIVITY
        </Typography>
        {mostRecentNotification ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
              "{mostRecentNotification.title}"
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
              Matched {mostRecentNotification.recipientCount} users
            </Typography>
          </Box>
        ) : (
          <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
            {latestNotification === null ? 'Loading…' : 'No notifications sent yet.'}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
