import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import DoNotDisturbOnOutlined from '@mui/icons-material/DoNotDisturbOnOutlined';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import { ToneChip, type Tone } from '../../components/ui';
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
  { label: string; tone: Tone; Icon: ComponentType<SvgIconProps> }
> = {
  open: { label: 'Open', tone: 'warning', Icon: FlagOutlined },
  resolved: { label: 'Resolved', tone: 'success', Icon: CheckCircleOutlined },
  dismissed: { label: 'Dismissed', tone: 'archived', Icon: DoNotDisturbOnOutlined },
};

export function ReportStatusChip({
  status,
  testId,
}: {
  status: ReportStatus;
  testId?: string;
}) {
  // A report written by hand can carry any status string; an unknown one is
  // shown as open, which is the safe reading (it still asks for a decision).
  const { label, tone, Icon } = REPORT_STATUS[status] ?? REPORT_STATUS.open;
  return (
    <ToneChip tone={tone} label={label} Icon={Icon} testId={testId} data={{ status }} />
  );
}
