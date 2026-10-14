import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import { StatusChip } from '../../components/ui';
import { adminColors, adminRadii } from '../../theme/tokens';
import type { PlanStatus } from '../../types';

/**
 * The strip above the editor: where the plan stands, whether there is
 * anything unsaved, and what can be done to it.
 *
 * Saving and publishing are separate buttons on purpose. "Save draft" keeps
 * the work and changes nothing for members; "Publish" is the one action
 * that does, and it always goes through a confirmation. Which publishing
 * actions are offered follows the status, so a published plan is offered
 * "Unpublish" and never "Publish":
 *
 *   new / draft   Publish...   (menu: Schedule..., Archive)
 *   scheduled     Publish now... (menu: Change schedule..., Unpublish, Archive)
 *   published     Unpublish...   (menu: Archive)
 *   archived      Restore as draft
 *
 * "Duplicate" and "Delete" are in the menu for any plan that has been
 * saved. Duplicating works from the SAVED plan, so it is unavailable while
 * there are unsaved changes rather than silently leaving them out.
 */
export function PlanStatusBar({
  status,
  statusLabel,
  isNew,
  dirty,
  saving,
  uploading,
  readOnly,
  onSave,
  onPublish,
  onSchedule,
  onUnpublish,
  onArchive,
  onRestore,
  onDuplicate,
  onDelete,
}: {
  status: PlanStatus;
  statusLabel?: string;
  isNew: boolean;
  dirty: boolean;
  saving: boolean;
  uploading: boolean;
  readOnly: boolean;
  onSave: () => void;
  onPublish: () => void;
  onSchedule: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const busy = saving || uploading;
  const live = status === 'published' || status === 'scheduled';

  function choose(action: () => void) {
    setAnchor(null);
    action();
  }

  return (
    <Paper
      variant="outlined"
      data-testid="plan-status-bar"
      sx={{
        p: 1.5,
        mb: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
        borderRadius: `${adminRadii.card}px`,
      }}
    >
      <StatusChip status={status} label={statusLabel} testId="plan-status-chip" />
      <Typography
        variant="body2"
        color={dirty || isNew ? 'warning.main' : 'text.secondary'}
        role="status"
        data-testid="plan-save-state"
        sx={{ color: dirty || isNew ? adminColors.warning : adminColors.inkMuted }}
      >
        {isNew
          ? 'Not saved yet'
          : saving
            ? 'Saving…'
            : uploading
              ? 'Uploading…'
              : dirty
                ? 'Unsaved changes'
                : 'All changes saved'}
      </Typography>

      <Box sx={{ flex: 1 }} />

      {readOnly ? (
        <Typography
          variant="body2"
          color="text.secondary"
          data-testid="plan-read-only-note"
        >
          You can look at this plan, but only a content administrator can change it.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="outlined"
            onClick={onSave}
            disabled={busy || (!dirty && !isNew)}
            data-testid="plan-save"
          >
            {live ? 'Save changes' : 'Save draft'}
          </Button>

          {status === 'archived' ? (
            <Button
              variant="contained"
              onClick={onRestore}
              disabled={busy}
              data-testid="plan-restore"
            >
              Restore as draft
            </Button>
          ) : status === 'published' ? (
            <Button
              variant="outlined"
              color="error"
              startIcon={<VisibilityOffOutlined />}
              onClick={onUnpublish}
              disabled={busy}
              data-testid="plan-unpublish"
            >
              Unpublish…
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={onPublish}
              disabled={busy}
              data-testid="plan-publish"
            >
              {status === 'scheduled' ? 'Publish now…' : 'Publish…'}
            </Button>
          )}

          <Tooltip title="More actions">
            <span>
              <IconButton
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={anchor ? 'true' : undefined}
                onClick={(event) => setAnchor(event.currentTarget)}
                disabled={busy}
                data-testid="plan-more"
              >
                <MoreVertOutlined />
              </IconButton>
            </span>
          </Tooltip>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            {status !== 'published' && status !== 'archived' ? (
              <MenuItem
                onClick={() => choose(onSchedule)}
                data-testid="plan-menu-schedule"
              >
                <ListItemIcon>
                  <ScheduleOutlined fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {status === 'scheduled' ? 'Change schedule…' : 'Schedule…'}
                </ListItemText>
              </MenuItem>
            ) : null}
            {status === 'scheduled' ? (
              <MenuItem
                onClick={() => choose(onUnpublish)}
                data-testid="plan-menu-unpublish"
              >
                <ListItemIcon>
                  <VisibilityOffOutlined fontSize="small" />
                </ListItemIcon>
                <ListItemText>Cancel schedule…</ListItemText>
              </MenuItem>
            ) : null}
            {status !== 'archived' ? (
              <MenuItem
                onClick={() => choose(onArchive)}
                disabled={isNew}
                data-testid="plan-menu-archive"
              >
                <ListItemIcon>
                  <Inventory2Outlined fontSize="small" />
                </ListItemIcon>
                <ListItemText>Archive…</ListItemText>
              </MenuItem>
            ) : null}
            <MenuItem
              onClick={() => choose(onDuplicate)}
              disabled={isNew || dirty}
              data-testid="plan-menu-duplicate"
            >
              <ListItemIcon>
                <ContentCopyOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText
                secondary={dirty && !isNew ? 'Save your changes first' : undefined}
              >
                Duplicate…
              </ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => choose(onDelete)}
              disabled={isNew}
              data-testid="plan-menu-delete"
              sx={{ color: adminColors.danger }}
            >
              <ListItemIcon sx={{ color: 'inherit' }}>
                <DeleteOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText>Delete…</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      )}
    </Paper>
  );
}
