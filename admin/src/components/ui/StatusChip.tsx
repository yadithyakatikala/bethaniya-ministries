import type { ComponentType } from 'react';
import { Chip } from '@mui/material';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import FiberManualRecord from '@mui/icons-material/FiberManualRecord';
import { adminColors } from '../../theme/tokens';
import { STATUS_LABELS, type PublicationStatus } from './status';

/**
 * A status as a coloured chip. Each status has a WORD and a SHAPE as well
 * as a colour. A colour alone is not an accessible signal (and roughly one
 * man in twelve cannot tell the green from the red), so the label is
 * always rendered and the icon is different for every status.
 */
const STATUS: Record<
  PublicationStatus,
  { label: string; fg: string; bg: string; Icon: ComponentType<SvgIconProps> }
> = {
  draft: {
    label: STATUS_LABELS.draft,
    fg: adminColors.inkMuted,
    bg: adminColors.surfaceRaised,
    Icon: EditNoteOutlined,
  },
  scheduled: {
    label: STATUS_LABELS.scheduled,
    fg: adminColors.info,
    bg: adminColors.infoTint,
    Icon: ScheduleOutlined,
  },
  published: {
    label: STATUS_LABELS.published,
    fg: adminColors.success,
    bg: adminColors.successTint,
    Icon: CheckCircleOutlined,
  },
  archived: {
    label: STATUS_LABELS.archived,
    fg: adminColors.archived,
    bg: adminColors.archivedTint,
    Icon: Inventory2Outlined,
  },
  live: {
    label: STATUS_LABELS.live,
    fg: adminColors.danger,
    bg: adminColors.dangerTint,
    Icon: FiberManualRecord,
  },
};

export function StatusChip({
  status,
  label,
  testId,
}: {
  status: PublicationStatus;
  /** Override the word (e.g. "Published · live since Sunday"). */
  label?: string;
  testId?: string;
}) {
  const { fg, bg, Icon, label: defaultLabel } = STATUS[status];
  return (
    <Chip
      size="small"
      data-testid={testId}
      data-status={status}
      icon={<Icon aria-hidden fontSize="small" />}
      label={label ?? defaultLabel}
      sx={{
        bgcolor: bg,
        color: fg,
        '& .MuiChip-icon': { color: fg, fontSize: 16 },
      }}
    />
  );
}
