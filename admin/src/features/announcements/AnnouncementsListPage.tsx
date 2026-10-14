import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import {
  deleteAnnouncement,
  setAnnouncementPublished,
  subscribeToAnnouncements,
} from '../../services/firebase/announcements';
import { useAuthStore } from '../../store/authStore';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
import { PageContainer, StatusChip, TableSkeleton } from '../../components/ui';
import type { Announcement } from '../../types';

/** Matches firestore.rules' isContentAdminOrAbove() -- Host can read all announcements but not write any, per the RBAC table in FINAL_ARCHITECTURE_SPECIFICATION.md. Gating these buttons is a UX convenience only; the rules are the real boundary. */
function canManageAnnouncements(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

/**
 * Admin announcements list -- Day 4. Table of every announcement (admins
 * can read all, unlike members) with publish status, and, for Content
 * Admin/Super Admin only, edit/delete/publish-toggle actions and a "New
 * Announcement" button. Host sees the same table read-only.
 */
export function AnnouncementsListPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = canManageAnnouncements(role);

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAnnouncements(
      (next) => {
        setAnnouncements(next);
        setError(null);
      },
      () => {
        setError('Could not load announcements. Please try again.');
      }
    );
    return unsubscribe;
  }, []);

  async function handleTogglePublished(announcement: Announcement) {
    setBusyId(announcement.id);
    try {
      await setAnnouncementPublished(
        announcement.id,
        announcement.title,
        !announcement.published
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteAnnouncement(deleteTarget.id, deleteTarget.title);
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <PageContainer testId="announcements-list-page">
      <AdminPageHeader
        title="Announcements"
        subtitle="News for the whole congregation. A draft stays hidden from members until you publish it."
        action={
          canManage ? (
            <Button
              variant="contained"
              component={RouterLink}
              to="/announcements/new"
              startIcon={<AddOutlined />}
              data-testid="new-announcement-button"
            >
              New Announcement
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Alert severity="error" data-testid="announcements-error">
          {error}
        </Alert>
      ) : null}

      {!announcements && !error ? (
        <TableSkeleton testId="announcements-loading" label="Loading announcements" />
      ) : null}

      {announcements && announcements.length === 0 ? (
        <AdminEmptyState
          testId="announcements-empty"
          title="No announcements yet"
          message={
            canManage
              ? 'Write the first one and publish it when it is ready. Members see it in the app straight away.'
              : 'Nothing has been announced yet.'
          }
        />
      ) : null}

      {announcements && announcements.length > 0 ? (
        <AdminTableCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Status</TableCell>
                  {canManage ? <TableCell align="right">Actions</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {announcements.map((announcement) => (
                  <TableRow
                    key={announcement.id}
                    data-testid={`announcement-row-${announcement.id}`}
                  >
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, overflowWrap: 'break-word' }}>
                        {announcement.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={announcement.published ? 'published' : 'draft'} />
                    </TableCell>
                    {canManage ? (
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => void handleTogglePublished(announcement)}
                          disabled={busyId === announcement.id}
                          data-testid={`toggle-published-${announcement.id}`}
                        >
                          {announcement.published ? 'Unpublish' : 'Publish'}
                        </Button>
                        <IconButton
                          component={RouterLink}
                          to={`/announcements/${announcement.id}/edit`}
                          aria-label="Edit"
                          data-testid={`edit-announcement-${announcement.id}`}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="Delete"
                          onClick={() => setDeleteTarget(announcement)}
                          disabled={busyId === announcement.id}
                          data-testid={`delete-announcement-${announcement.id}`}
                        >
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AdminTableCard>
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete announcement?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget
              ? `"${deleteTarget.title}" will be permanently deleted. This cannot be undone.`
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => void handleConfirmDelete()}
            data-testid="confirm-delete-button"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
