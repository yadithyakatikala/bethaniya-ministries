import type { ComponentType } from 'react';
import { Chip } from '@mui/material';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import { adminColors } from '../../theme/tokens';
import { ROLE_LABELS, type UserRole } from '../../types';
import { SUSPENSION_STATE_LABELS, type SuspensionState } from './suspension';

type Look = { fg: string; bg: string };

/**
 * One chip per role, in ascending authority: the Super Admin is the one
 * solid navy chip in the table, then a navy tint, a gold tint, and the plain
 * neutral of an ordinary member. Every pair is one the design tokens' test
 * already holds to WCAG AA.
 */
const ROLE_LOOK: Record<UserRole, Look> = {
  super_admin: { fg: adminColors.onPrimary, bg: adminColors.primary },
  content_admin: { fg: adminColors.primary, bg: adminColors.primaryTint },
  host: { fg: adminColors.accent, bg: adminColors.accentTint },
  member: { fg: adminColors.inkMuted, bg: adminColors.surfaceRaised },
};

export function RoleChip({ role }: { role: UserRole }) {
  const look = ROLE_LOOK[role];
  return (
    <Chip
      size="small"
      label={ROLE_LABELS[role]}
      data-role={role}
      sx={{ bgcolor: look.bg, color: look.fg }}
    />
  );
}

/**
 * How an account stands.
 *
 * 'expired' is deliberately NOT a warning colour. The suspension is over;
 * the row is saying "this happened", not "this is happening", and colouring
 * it like an active restriction would have administrators chasing members
 * who are already back. Each state has its own shape as well as its own
 * colour, so none of them depends on telling red from green.
 */
const ACCOUNT_LOOK: Record<
  SuspensionState,
  Look & { Icon: ComponentType<SvgIconProps> }
> = {
  active: {
    fg: adminColors.inkMuted,
    bg: adminColors.surfaceRaised,
    Icon: CheckCircleOutlined,
  },
  temporary: {
    fg: adminColors.warning,
    bg: adminColors.warningTint,
    Icon: ScheduleOutlined,
  },
  permanent: { fg: adminColors.danger, bg: adminColors.dangerTint, Icon: BlockOutlined },
  expired: {
    fg: adminColors.archived,
    bg: adminColors.archivedTint,
    Icon: HistoryOutlined,
  },
};

export function AccountStateChip({
  state,
  testId,
}: {
  state: SuspensionState;
  testId?: string;
}) {
  const { fg, bg, Icon } = ACCOUNT_LOOK[state];
  return (
    <Chip
      size="small"
      data-testid={testId}
      data-state={state}
      icon={<Icon aria-hidden fontSize="small" />}
      label={SUSPENSION_STATE_LABELS[state]}
      sx={{ bgcolor: bg, color: fg, '& .MuiChip-icon': { color: fg, fontSize: 16 } }}
    />
  );
}
