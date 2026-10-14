import type { ComponentType } from 'react';
import { Chip } from '@mui/material';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import { adminColors } from '../../theme/tokens';

/**
 * The colours a small label can wear. Each is a pair the design tokens' test
 * already holds to WCAG AA, so choosing one can never produce an unreadable
 * chip.
 *
 *   neutral   nothing to flag
 *   navy      the strongest emphasis (a solid navy chip)
 *   navyTint  a quieter navy
 *   gold      the brand accent
 *   success / warning / danger / info   the four status meanings the admin
 *             shares with the mobile app
 *   archived  retired: neither good news nor bad
 *   outlined  no fill at all, for "this is not in effect"
 */
export type Tone =
  | 'neutral'
  | 'navy'
  | 'navyTint'
  | 'gold'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'archived'
  | 'outlined';

const TONES: Record<Tone, { fg: string; bg: string; border?: string }> = {
  neutral: { fg: adminColors.inkMuted, bg: adminColors.surfaceRaised },
  navy: { fg: adminColors.onPrimary, bg: adminColors.primary },
  navyTint: { fg: adminColors.primary, bg: adminColors.primaryTint },
  gold: { fg: adminColors.accent, bg: adminColors.accentTint },
  success: { fg: adminColors.success, bg: adminColors.successTint },
  warning: { fg: adminColors.warning, bg: adminColors.warningTint },
  danger: { fg: adminColors.danger, bg: adminColors.dangerTint },
  info: { fg: adminColors.info, bg: adminColors.infoTint },
  archived: { fg: adminColors.archived, bg: adminColors.archivedTint },
  outlined: {
    fg: adminColors.inkMuted,
    bg: 'transparent',
    border: adminColors.borderStrong,
  },
};

/**
 * A small label in one of the design system's tones.
 *
 * The word is always the signal. An icon is optional, but a chip that
 * stands for a STATE should carry one (a shape is a second signal for the
 * person who cannot tell the colours apart) and it is hidden from a screen
 * reader so the word is heard once.
 */
export function ToneChip({
  tone,
  label,
  Icon,
  testId,
  data,
}: {
  tone: Tone;
  label: string;
  Icon?: ComponentType<SvgIconProps>;
  testId?: string;
  /** Extra `data-*` attributes, for tests and styling hooks. */
  data?: Record<string, string>;
}) {
  const { fg, bg, border } = TONES[tone];
  const dataAttributes = Object.fromEntries(
    Object.entries(data ?? {}).map(([key, value]) => [`data-${key}`, value])
  );
  return (
    <Chip
      size="small"
      data-testid={testId}
      data-tone={tone}
      {...dataAttributes}
      icon={Icon ? <Icon aria-hidden fontSize="small" /> : undefined}
      label={label}
      sx={{
        bgcolor: bg,
        color: fg,
        ...(border ? { border: `1px solid ${border}` } : null),
        '& .MuiChip-icon': { color: fg, fontSize: 16 },
      }}
    />
  );
}
