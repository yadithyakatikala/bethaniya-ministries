import { useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { AdminEmptyState } from '../../../components/AdminEmptyState';
import { AdminTableCard } from '../../../components/AdminTableCard';
import {
  deleteVersePoolEntry,
  saveVersePoolEntry,
  setVersePoolEntryActive,
  type VersePoolEntryDocument,
  type VotdConfigDocument,
} from '../../../services/firebase/votd';
import { prepareVersePool } from '../votdSelection';
import {
  BOOK_OPTIONS,
  formatPoolReference,
  hasErrors,
  validateVersePoolEntry,
  type VersePoolEntryErrors,
} from '../votdValidation';
import { bookStructureById, verseCountFor } from '../bibleStructure';
import { VOTD_YEAR_LENGTH } from '../votdYear';

/**
 * YOUR CHURCH'S OWN VERSES -- optional, and the page now says so.
 *
 * The pool is what a church adds when it wants its own selection instead
 * of the app's. It has never been required, but an empty pool used to
 * read like an unfinished setup step, and the copy below is the fix for
 * that as much as anything in the code is: a church that adds nothing
 * here gets a full year, and a church that adds seven verses gets a
 * seven-day cycle. Both are stated in the words a pastor would use.
 *
 * The length of the cycle IS the length of the pool. The rotation steps
 * through it by a stride coprime with its length, so every entry comes
 * up once before any of them repeats -- see ../votdSelection.ts. That is
 * also why a five-verse pool is a warning worth printing rather than a
 * configuration worth silently honouring.
 */
export function PoolPanel({
  config,
  pool,
  canManage,
}: {
  config: VotdConfigDocument;
  pool: VersePoolEntryDocument[];
  canManage: boolean;
}) {
  const [deleteTarget, setDeleteTarget] = useState<VersePoolEntryDocument | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // The order the SELECTION will use, not the order Firestore returned --
  // so the table shows the pool as the app sees it. Inactive entries are
  // listed after it, because they are still the administrator's to manage.
  const active = useMemo(() => prepareVersePool(pool), [pool]);
  const activeIds = useMemo(() => new Set(active.map((entry) => entry.id)), [active]);
  const excluded = useMemo(
    () => pool.filter((entry) => !activeIds.has(entry.id)),
    [pool, activeIds]
  );

  async function handleToggle(entry: VersePoolEntryDocument) {
    setBusyId(entry.id);
    setFailure(null);
    try {
      await setVersePoolEntryActive(entry.id, entry.reference, !entry.active);
    } catch {
      setFailure('Could not update that verse. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteVersePoolEntry(deleteTarget.id, deleteTarget.reference);
    } catch {
      setFailure('Could not remove that verse. Please try again.');
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: 3 }} data-testid="votd-pool-panel">
      <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
        Your church&rsquo;s own verses
      </Typography>
      <Typography color="text.secondary" sx={{ fontSize: 14, mb: 2 }}>
        {active.length === 0
          ? `Optional. Leave this empty and the app uses its own year of ${VOTD_YEAR_LENGTH} verses, which needs nothing from you. Add verses here only if your church wants its own selection instead.`
          : `These ${active.length} verses replace the app's built-in year. Each one comes up once before any repeats, so they last ${active.length} days.`}
      </Typography>

      {config.enabled && active.length > 0 && active.length < 30 ? (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="votd-pool-short">
          {/* Not an error -- a church may genuinely want a short cycle --
              but a pastor should not discover the length by noticing a
              verse come round again. */}
          With {active.length} verses, the same verse comes round every {active.length}{' '}
          days. Remove them all to go back to the app&rsquo;s year of {VOTD_YEAR_LENGTH}.
        </Alert>
      ) : null}

      {failure ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="votd-pool-failed">
          {failure}
        </Alert>
      ) : null}

      {canManage ? <AddPoolEntryForm pool={pool} /> : null}

      {active.length === 0 && excluded.length === 0 ? (
        <AdminEmptyState
          message={`No verses of your own. The app is using its own year of ${VOTD_YEAR_LENGTH} verses.`}
          testId="votd-pool-empty"
        />
      ) : (
        <AdminTableCard>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Status</TableCell>
                  {canManage ? <TableCell align="right">Actions</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {active.map((entry, index) => (
                  <TableRow key={entry.id} data-testid={`votd-pool-row-${entry.id}`}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{entry.reference}</TableCell>
                    <TableCell>
                      <Chip
                        label="In rotation"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    </TableCell>
                    {canManage ? (
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => void handleToggle(entry as VersePoolEntryDocument)}
                          disabled={busyId === entry.id}
                          data-testid={`votd-pool-deactivate-${entry.id}`}
                        >
                          Take out
                        </Button>
                        <IconButton
                          aria-label={`Remove ${entry.reference}`}
                          onClick={() => setDeleteTarget(entry as VersePoolEntryDocument)}
                          disabled={busyId === entry.id}
                          data-testid={`votd-pool-delete-${entry.id}`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
                {excluded.map((entry) => (
                  <TableRow key={entry.id} data-testid={`votd-pool-row-${entry.id}`}>
                    <TableCell>&mdash;</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{entry.reference}</TableCell>
                    <TableCell>
                      {/* Labelled, not merely greyed: "not in the rotation"
                          must not be communicated by colour alone. */}
                      <Chip
                        label={entry.active ? 'Not usable' : 'Taken out'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    {canManage ? (
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => void handleToggle(entry)}
                          disabled={busyId === entry.id || entry.active}
                          data-testid={`votd-pool-activate-${entry.id}`}
                        >
                          Put back
                        </Button>
                        <IconButton
                          aria-label={`Remove ${entry.reference}`}
                          onClick={() => setDeleteTarget(entry)}
                          disabled={busyId === entry.id}
                          data-testid={`votd-pool-delete-${entry.id}`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AdminTableCard>
      )}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Remove this verse?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget
              ? `"${deleteTarget.reference}" will no longer come up. This cannot be undone, but you can add it again.`
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => void handleConfirmDelete()}
            data-testid="votd-pool-confirm-delete"
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

/**
 * Adding a verse: a book selector, a chapter and a verse.
 *
 * Not a free-text "John 3:16" field, deliberately. A typed reference can
 * be "Jhon 3:16" or "Psalm 151:1", and the consequence is not a visible
 * error -- it is a day on which the congregation silently gets something
 * else. Picking from the 66 books and checking the number against the
 * real verse count makes that impossible. See ../bibleStructure.ts.
 */
function AddPoolEntryForm({ pool }: { pool: VersePoolEntryDocument[] }) {
  const [bookId, setBookId] = useState('');
  const [chapter, setChapter] = useState('');
  const [verse, setVerse] = useState('');
  const [errors, setErrors] = useState<VersePoolEntryErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const book = bookStructureById(bookId);
  const chapterNumber = Number(chapter);
  const verseCount = verseCountFor(bookId, chapterNumber);

  const nextOrder = useMemo(
    () => pool.reduce((highest, entry) => Math.max(highest, entry.order), -1) + 1,
    [pool]
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = { bookId, chapter: chapterNumber, verse: Number(verse) };
    const next = validateVersePoolEntry(parsed);
    setErrors(next);
    if (hasErrors(next)) return;

    setSaving(true);
    setFailure(null);
    try {
      const reference = formatPoolReference(parsed.bookId, parsed.chapter, parsed.verse);
      await saveVersePoolEntry({ ...parsed, reference, order: nextOrder, active: true });
      setAdded(reference);
      setChapter('');
      setVerse('');
    } catch {
      setFailure('Could not add that verse. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box
      component="form"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      sx={{ mb: 3 }}
      data-testid="votd-add-pool-entry-form"
    >
      {added ? (
        <Alert severity="success" sx={{ mb: 2 }} data-testid="votd-pool-added">
          Added {added}.
        </Alert>
      ) : null}
      {failure ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="votd-pool-add-failed">
          {failure}
        </Alert>
      ) : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: 'flex-start' }}
      >
        <TextField
          select
          label="Book"
          value={bookId}
          onChange={(event) => {
            setBookId(event.target.value);
            setChapter('');
            setVerse('');
          }}
          error={Boolean(errors.bookId)}
          helperText={errors.bookId}
          disabled={saving}
          sx={{ minWidth: 220 }}
          slotProps={{
            select: { inputProps: { 'data-testid': 'votd-pool-book-select' } },
          }}
        >
          {BOOK_OPTIONS.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Chapter"
          type="number"
          value={chapter}
          onChange={(event) => setChapter(event.target.value)}
          error={Boolean(errors.chapter)}
          helperText={errors.chapter ?? (book ? `1–${book.verseCounts.length}` : ' ')}
          disabled={saving || !book}
          sx={{ width: 140 }}
          slotProps={{ htmlInput: { 'data-testid': 'votd-pool-chapter-input', min: 1 } }}
        />

        <TextField
          label="Verse"
          type="number"
          value={verse}
          onChange={(event) => setVerse(event.target.value)}
          error={Boolean(errors.verse)}
          helperText={errors.verse ?? (verseCount > 0 ? `1–${verseCount}` : ' ')}
          disabled={saving || verseCount === 0}
          sx={{ width: 140 }}
          slotProps={{ htmlInput: { 'data-testid': 'votd-pool-verse-input', min: 1 } }}
        />

        <Button
          type="submit"
          variant="outlined"
          disabled={saving}
          sx={{ mt: { sm: 1 } }}
          data-testid="votd-pool-add"
        >
          {saving ? 'Adding…' : 'Add verse'}
        </Button>
      </Stack>
    </Box>
  );
}
