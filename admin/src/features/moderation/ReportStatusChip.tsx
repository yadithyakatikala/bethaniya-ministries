import type { ComponentType } from 'react';
import { Chip } from '@mui/material';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import DoNotDisturbOnOutlined from '@mui/icons-material/DoNotDisturbOnOutlined';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import { adminColors } from '../../theme/tokens';
import type { ReportStatus } from '../../services/firebase/reports';

/**
 * Where a report stands. Moderation has its own three states -- they are not
 * the publication states the shared StatusChip names -- but the rule is the
 * same: a word AND a shape as well as a colour, so a red-green colour
 * blindness or a greyscale screen loses nothing.
 *
 *   open       needs a decision (the warning colour: it is waiting on you)
 *   resolved   dealt with
 *   dismissed  looked at and closed with no action
 */
const REPORT_STATUS: Record<
  ReportStatus,
  { label: string; fg: string; bg: string; Icon: ComponentType<SvgIconProps> }
> = {
  open: {
    label: 'Open',
    fg: adminColors.warning,
    bg: adminColors.warningTint,
    Icon: FlagOutlined,
  },
  resolved: {
    label: 'Resolved',
    fg: adminColors.success,
    bg: adminColors.successTint,
    Icon: CheckCircleOutlined,
  },
  dismissed: {
    label: 'Dismissed',
    fg: adminColors.archived,
    bg: adminColors.archivedTint,
    Icon: DoNotDisturbOnOutlined,
  },
};

export function ReportStatusChip({
  status,
  testId,
}: {
  status: ReportStatus;
  testId?: string;
}) {
  const { label, fg, bg, Icon } = REPORT_STATUS[status] ?? REPORT_STATUS.open;
  return (
    <Chip
      size="small"
      data-testid={testId}
      data-status={status}
      icon={<Icon aria-hidden fontSize="small" />}
      label={label}
      sx={{ bgcolor: bg, color: fg, '& .MuiChip-icon': { color: fg, fontSize: 16 } }}
    />
  );
}
