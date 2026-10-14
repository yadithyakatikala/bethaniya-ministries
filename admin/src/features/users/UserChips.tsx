import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import { ToneChip, type Tone } from '../../components/ui';
import { ROLE_LABELS, type UserRole } from '../../types';
import { SUSPENSION_STATE_LABELS, type SuspensionState } from './suspension';

/**
 * One chip per role, in ascending authority: the Super Admin is the one
 * solid navy chip in the table, then a navy tint, a gold tint, and the plain
 * neutral of an ordinary member.
 */
const ROLE_TONE: Record<UserRole, Tone> = {
  super_admin: 'navy',
  content_admin: 'navyTint',
  host: 'gold',
  member: 'neutral',
};

export function RoleChip({ role }: { role: UserRole }) {
  return <ToneChip tone={ROLE_TONE[role]} label={ROLE_LABELS[role]} data={{ role }} />;
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
  { tone: Tone; Icon: ComponentType<SvgIconProps> }
> = {
  active: { tone: 'neutral', Icon: CheckCircleOutlined },
  temporary: { tone: 'warning', Icon: ScheduleOutlined },
  permanent: { tone: 'danger', Icon: BlockOutlined },
  expired: { tone: 'archived', Icon: HistoryOutlined },
};

export function AccountStateChip({
  state,
  testId,
}: {
  state: SuspensionState;
  testId?: string;
}) {
  const { tone, Icon } = ACCOUNT_LOOK[state];
  return (
    <ToneChip
      tone={tone}
      Icon={Icon}
      label={SUSPENSION_STATE_LABELS[state]}
      testId={testId}
      data={{ state }}
    />
  );
}
