import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import CampaignOutlined from '@mui/icons-material/CampaignOutlined';
import MusicNoteOutlined from '@mui/icons-material/MusicNoteOutlined';
import EventOutlined from '@mui/icons-material/EventOutlined';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import PermMediaOutlined from '@mui/icons-material/PermMediaOutlined';
import WbSunnyOutlined from '@mui/icons-material/WbSunnyOutlined';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import PeopleOutlined from '@mui/icons-material/PeopleOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';

export interface NavItem {
  label: string;
  path: string;
  testId: string;
  Icon: ComponentType<SvgIconProps>;
}

export interface NavGroup {
  /** Omitted for the groups that need no heading. */
  label?: string;
  items: NavItem[];
}

/**
 * Every admin destination, grouped by the job it does. The groups exist so
 * thirteen destinations read as five short lists instead of one long one;
 * the order inside a group is the order an administrator reaches for them.
 *
 * ONE ENTRY PER FEATURE. "Daily Verses" and "Verse Automation" used to be
 * two entries for what has only ever been one thing, which made an
 * automatic feature look like a manual one. The two verse streams below
 * stay separate because they genuinely are separate -- a prophet verse is
 * never a candidate for the Verse of the Day -- and the labels now say
 * which is which.
 *
 * `Photos & Videos` is the congregation's feed (the /media route and the
 * `sidebar-media-link` test id are unchanged). The new `Media Library` is
 * the store of uploaded files that every form's picker draws from; naming
 * them apart is what stops "Media" meaning two things.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        label: 'Dashboard',
        path: '/',
        testId: 'sidebar-dashboard-link',
        Icon: DashboardOutlined,
      },
    ],
  },
  {
    label: 'Content',
    items: [
      {
        label: 'Announcements',
        path: '/announcements',
        testId: 'sidebar-announcements-link',
        Icon: CampaignOutlined,
      },
      { label: 'Songs', path: '/songs', testId: 'sidebar-songs-link', Icon: MusicNoteOutlined },
      { label: 'Events', path: '/events', testId: 'sidebar-events-link', Icon: EventOutlined },
      {
        label: 'Community',
        path: '/community',
        testId: 'sidebar-community-link',
        Icon: ForumOutlined,
      },
      {
        label: 'Photos & Videos',
        path: '/media',
        testId: 'sidebar-media-link',
        Icon: PermMediaOutlined,
      },
    ],
  },
  {
    label: 'Bible',
    items: [
      {
        label: 'Verse of the Day',
        path: '/daily-verses',
        testId: 'sidebar-daily-verses-link',
        Icon: WbSunnyOutlined,
      },
      {
        label: 'Prophet Verse of the Day',
        path: '/prophet-verses',
        testId: 'sidebar-prophet-verses-link',
        Icon: AutoStoriesOutlined,
      },
      {
        label: 'Reading Plans',
        path: '/plans',
        testId: 'sidebar-plans-link',
        Icon: MenuBookOutlined,
      },
    ],
  },
  {
    label: 'Library',
    items: [
      {
        label: 'Media Library',
        path: '/media-library',
        testId: 'sidebar-media-library-link',
        Icon: PhotoLibraryOutlined,
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        label: 'Notifications',
        path: '/notifications',
        testId: 'sidebar-notifications-link',
        Icon: NotificationsOutlined,
      },
      // M7. Moderation sits next to Users: it is day-to-day work on the
      // congregation's own content, and it is the people whose content it
      // is that an administrator reaches for next.
      { label: 'Reports', path: '/reports', testId: 'sidebar-reports-link', Icon: FlagOutlined },
      { label: 'Users', path: '/users', testId: 'sidebar-users-link', Icon: PeopleOutlined },
    ],
  },
  {
    items: [
      {
        label: 'Settings',
        path: '/settings',
        testId: 'sidebar-settings-link',
        Icon: SettingsOutlined,
      },
    ],
  },
];

/**
 * Whether a destination is the current one. A page inside a section
 * (`/plans/abc/edit`) keeps its section highlighted; the dashboard, whose
 * path is a prefix of everything, matches only itself.
 */
export function isNavItemActive(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}
