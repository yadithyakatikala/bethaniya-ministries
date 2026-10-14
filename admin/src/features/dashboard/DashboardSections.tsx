import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Paper, Skeleton, Typography } from '@mui/material';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import { adminColors, adminFonts, adminRadii } from '../../theme/tokens';
import {
  KIND_LABELS,
  describeAge,
  describeWhen,
  type DashboardItem,
  type QuickAction,
  type Tile,
} from './dashboardModel';

/** A figure that is a count of real documents, linked to the page that holds them. */
export function StatTile({ tile }: { tile: Tile }) {
  return (
    <Paper
      variant="outlined"
      component={RouterLink}
      to={tile.to}
      data-testid={`dashboard-tile-${tile.id}`}
      aria-label={`${tile.label}: ${tile.value}${tile.detail ? `. ${tile.detail}` : ''}`}
      sx={{
        display: 'block',
        p: 2.25,
        borderRadius: `${adminRadii.card}px`,
        borderColor: adminColors.border,
        bgcolor: adminColors.surface,
        color: 'inherit',
        textDecoration: 'none',
        transition: 'border-color 120ms, background-color 120ms',
        '&:hover': {
          borderColor: adminColors.borderStrong,
          bgcolor: adminColors.surfaceRaised,
        },
      }}
    >
      <Typography
        variant="overline"
        component="p"
        sx={{ color: adminColors.inkMuted, m: 0 }}
      >
        {tile.label}
      </Typography>
      <Typography
        component="p"
        sx={{
          fontFamily: adminFonts.heading,
          fontSize: '2rem',
          fontWeight: 600,
          lineHeight: 1.15,
          color: adminColors.ink,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {tile.value}
      </Typography>
      {tile.detail ? (
        <Typography variant="body2" sx={{ color: adminColors.inkMuted, mt: 0.5 }}>
          {tile.detail}
        </Typography>
      ) : null}
    </Paper>
  );
}

function KindLabel({ kind }: { kind: DashboardItem['kind'] }) {
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        px: 1,
        py: 0.25,
        borderRadius: `${adminRadii.pill}px`,
        bgcolor: adminColors.accentTint,
        color: adminColors.accent,
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      {KIND_LABELS[kind]}
    </Box>
  );
}

function itemMeta(item: DashboardItem, now: Date): string {
  if (item.state === 'scheduled') {
    return item.publishAt ? `Opens ${describeWhen(item.publishAt)}` : 'Scheduled';
  }
  const age = describeAge(item.at, now);
  if (item.state === 'draft') return age ? `Draft · edited ${age}` : 'Draft';
  return age ? `Updated ${age}` : 'Published';
}

/**
 * Items as rows. A row opens the thing it names -- for someone who can change
 * it; a host, who can only look, gets the same row as plain text.
 */
export function ItemList({
  items,
  now,
  limit,
  linked,
  label,
  testId,
  empty,
  showKind = true,
}: {
  items: readonly DashboardItem[];
  now: Date;
  limit: number;
  linked: boolean;
  label: string;
  testId: string;
  /** What to say when there are none. */
  empty: string;
  /**
   * Whether each row says what kind of thing it is ("Plan", "Song"). A panel
   * that lists only one kind -- the reading plans -- leaves it off, because a
   * label repeated down every row says nothing.
   */
  showKind?: boolean;
}) {
  if (items.length === 0) {
    return (
      <Typography
        variant="body2"
        sx={{ color: adminColors.inkMuted }}
        data-testid={`${testId}-empty`}
      >
        {empty}
      </Typography>
    );
  }
  const shown = items.slice(0, limit);
  const hidden = items.length - shown.length;
  return (
    <Box>
      <Box
        component="ul"
        aria-label={label}
        data-testid={testId}
        sx={{ listStyle: 'none', m: 0, p: 0 }}
      >
        {shown.map((item) => {
          const inner = (
            <>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  component="span"
                  sx={{
                    display: 'block',
                    fontWeight: 600,
                    color: adminColors.ink,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {item.title}
                </Typography>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ display: 'block', color: adminColors.inkMuted }}
                >
                  {itemMeta(item, now)}
                </Typography>
              </Box>
              {showKind ? <KindLabel kind={item.kind} /> : null}
            </>
          );
          const rowSx = {
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            py: 1.25,
            px: 0.5,
            color: 'inherit',
            textDecoration: 'none',
          } as const;
          return (
            <Box
              key={item.key}
              component="li"
              sx={{
                borderTop: `1px solid ${adminColors.border}`,
                '&:first-of-type': { borderTop: 0 },
              }}
            >
              {linked ? (
                <Box
                  component={RouterLink}
                  to={item.to}
                  sx={{
                    ...rowSx,
                    borderRadius: `${adminRadii.control}px`,
                    '&:hover': { bgcolor: adminColors.surfaceRaised },
                  }}
                >
                  {inner}
                </Box>
              ) : (
                <Box sx={rowSx}>{inner}</Box>
              )}
            </Box>
          );
        })}
      </Box>
      {hidden > 0 ? (
        <Typography variant="body2" sx={{ color: adminColors.inkMuted, mt: 1 }}>
          and {hidden} more
        </Typography>
      ) : null}
    </Box>
  );
}

/** Placeholder lines while a panel's data is on its way. */
export function PanelSkeleton({ label }: { label: string }) {
  return (
    <Box role="status" aria-label={label} sx={{ display: 'grid', gap: 1.25 }}>
      <Skeleton variant="rounded" height={20} width="80%" />
      <Skeleton variant="rounded" height={20} width="65%" />
      <Skeleton variant="rounded" height={20} width="72%" />
    </Box>
  );
}

export function QuickActionList({ actions }: { actions: readonly QuickAction[] }) {
  return (
    <Box
      component="ul"
      aria-label="Quick actions"
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}
    >
      {actions.map((action) => (
        <li key={action.id}>
          <Button
            component={RouterLink}
            to={action.to}
            variant="outlined"
            fullWidth
            endIcon={<ArrowForwardOutlined fontSize="small" />}
            data-testid={`dashboard-action-${action.id}`}
            sx={{ justifyContent: 'space-between', textAlign: 'left' }}
          >
            {action.label}
          </Button>
        </li>
      ))}
    </Box>
  );
}
