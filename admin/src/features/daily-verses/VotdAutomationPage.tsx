import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
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
import { useAuthStore } from '../../store/authStore';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
import {
  VOTD_TIMEZONE,
  bumpVotdPoolVersion,
  deleteVersePoolEntry,
  saveVersePoolEntry,
  saveVotdConfig,
  setVersePoolEntryActive,
  subscribeToVersePool,
  subscribeToVotdConfig,
  type VersePoolEntryDocument,
  type VotdConfigDocument,
} from '../../services/firebase/votd';
import { subscribeToDailyVerses } from '../../services/firebase/dailyVerses';
import { indiaDateKey, isDateKey } from './votdDate';
import { prepareVersePool, selectVerseForDate } from './votdSelection';
import {
  BOOK_OPTIONS,
  formatPoolReference,
  hasErrors,
  validateVersePoolEntry,
  validateVotdConfig,
  type VersePoolEntryErrors,
  type VotdConfigErrors,
} from './votdValidation';
import { bookStructureById, verseCountFor } from './bibleStructure';
import type { DailyVerse } from '../../types';

/**
 * Verse of the Day automation -- the M5 admin page.
 *
 * ---------------------------------------------------------------------
 * WHAT THIS PAGE IS FOR
 * ---------------------------------------------------------------------
 * Nobody should have to choose a verse every morning. This page
 * configures the rotation that fills in every date, and lets an
 * administrator SEE what the congregation will get on any date -- which
 * is the point: a rotation nobody can inspect is a rotation nobody
 * trusts.
 *
 * It does NOT replace the Daily Verses page. An explicit verse for a
 * named date still wins over the automation, and the preview says so
 * plainly when one exists, so the two pages never quietly contradict each
 * other.
 *
 * ---------------------------------------------------------------------
 * THE PREVIEW SHOWS A REFERENCE, NOT THE VERSE TEXT
 * ---------------------------------------------------------------------
 * On purpose. The Bible is bundled in the mobile app, not in Firestore
 * and not in this dashboard's bundle -- that is the whole reason the
 * automation stores references. Copying 31,102 verses into the admin
 * bundle to render a preview would cost every administrator an 8 MB
 * download to see three words they already know.
 *
 * What the preview therefore reports is the decision: which reference,
 * and WHERE IT CAME FROM -- an override, the pool, or the app's bundled
 * fallback. The selection algorithm is the same code the phone runs; see
 * ./votdSelection.ts's note on how the two copies are kept in step.
 *
 * ---------------------------------------------------------------------
 * RBAC
 * ---------------------------------------------------------------------
 * Every dashboard role can VIEW -- seeing which verse the congregation
 * gets is not privileged. Only a content admin or super admin sees the
 * controls, matching firestore.rules' verse_pool and settings/dailyVerse
 * rules. As everywhere else in this app, that gate is a convenience; the
 * rules are the boundary.
 */
function canManageVotd(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

/** Where a previewed verse came from -- the thing the brief asks to surface. */
type PreviewSource = 'override' | 'pool' | 'fallback';

interface Preview {
  dateKey: string;
  source: PreviewSource;
  reference: string;
}

export function VotdAutomationPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = canManageVotd(role);

  const [config, setConfig] = useState<VotdConfigDocument | null>(null);
  const [pool, setPool] = useState<VersePoolEntryDocument[] | null>(null);
  const [overrides, setOverrides] = useState<DailyVerse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeConfig = subscribeToVotdConfig(
      (next) => {
        setConfig(next);
        setError(null);
      },
      () => setError('Could not load the Verse of the Day configuration.')
    );
    const unsubscribePool = subscribeToVersePool(
      (next) => setPool(next),
      () => setError('Could not load the verse pool.')
    );
    // The overrides are what lets the preview say "this date is already
    // set by hand" instead of showing a verse nobody will see. They are
    // already listed on the Daily Verses page, so this is the same read.
    const unsubscribeOverrides = subscribeToDailyVerses(
      (next) => setOverrides(next),
      () => setOverrides([])
    );
    return () => {
      unsubscribeConfig();
      unsubscribePool();
      unsubscribeOverrides();
    };
  }, []);

  return (
    <Box sx={{ p: 4 }} data-testid="votd-automation-page">
      <AdminPageHeader title="Verse of the Day Automation" />

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }} data-testid="votd-error">
          {error}
        </Alert>
      ) : null}

      {!config || !pool ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="votd-loading" />
        </Box>
      ) : (
        <Stack spacing={3}>
          <ConfigPanel config={config} canManage={canManage} />
          <PreviewPanel config={config} pool={pool} overrides={overrides ?? []} />
          <PoolPanel config={config} pool={pool} canManage={canManage} />
        </Stack>
      )}
    </Box>
  );
}

function ConfigPanel({
  config,
  canManage,
}: {
  config: VotdConfigDocument;
  canManage: boolean;
}) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [seed, setSeed] = useState(config.seed);
  const [poolVersion, setPoolVersion] = useState(String(config.poolVersion));
  const [errors, setErrors] = useState<VotdConfigErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Seeded from the FIRST snapshot only, so a save-triggered refresh (or
  // another administrator's concurrent edit) never overwrites a field
  // this one is still typing in. Same pattern as SettingsPage.tsx.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    setEnabled(config.enabled);
    setSeed(config.seed);
    setPoolVersion(String(config.poolVersion));
  }, [config]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedVersion = Number(poolVersion);
    const next = validateVotdConfig({ seed, poolVersion: parsedVersion });
    setErrors(next);
    if (hasErrors(next)) return;

    setSaving(true);
    setFailure(null);
    try {
      await saveVotdConfig({ enabled, seed, poolVersion: parsedVersion });
      setSaved(true);
    } catch {
      setFailure('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 3, p: 3 }}
      data-testid="votd-config-panel"
    >
      <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
        Rotation
      </Typography>
      <Typography color="text.secondary" sx={{ fontSize: 14, mb: 2 }}>
        The app works out each day&rsquo;s verse from the date, the seed and the pool
        version, so every member sees the same verse without anyone choosing one. Days
        change at midnight {VOTD_TIMEZONE.replace('_', ' ')}.
      </Typography>

      {saved ? (
        <Alert severity="success" sx={{ mb: 2 }} data-testid="votd-config-saved">
          Saved.
        </Alert>
      ) : null}
      {failure ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="votd-config-failed">
          {failure}
        </Alert>
      ) : null}

      <Box component="form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                disabled={!canManage || saving}
                slotProps={{
                  input: { 'aria-label': 'Automatic verse selection' },
                }}
                data-testid="votd-enabled-switch"
              />
            }
            label={
              enabled
                ? 'Choosing a verse automatically'
                : 'Paused — only dates you set by hand will show a verse from this church'
            }
          />

          <TextField
            label="Seed"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            error={Boolean(errors.seed)}
            helperText={
              errors.seed ??
              'Changing the seed reshuffles the order the verses come up in. Change it back to get the old order back.'
            }
            disabled={!canManage || saving}
            fullWidth
            slotProps={{ htmlInput: { 'data-testid': 'votd-seed-input' } }}
          />

          <TextField
            label="Pool version"
            value={poolVersion}
            onChange={(event) => setPoolVersion(event.target.value)}
            error={Boolean(errors.poolVersion)}
            helperText={errors.poolVersion}
            disabled={!canManage || saving}
            type="number"
            sx={{ width: 160 }}
            slotProps={{
              htmlInput: { 'data-testid': 'votd-pool-version-input', min: 1 },
            }}
          />

          {/* The explanation is deliberately NOT this field's helperText.
              A version number is two digits wide, and capping the whole
              TextField squeezed the sentence into a three-line column. */}
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: -1 }}>
            Raise this after editing the pool: it restarts the rotation and refreshes
            every phone.
          </Typography>

          {canManage ? (
            <Box>
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                data-testid="votd-config-save"
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </Box>
          ) : (
            <Typography color="text.secondary" sx={{ fontSize: 14 }}>
              Only a content admin can change these.
            </Typography>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}

/**
 * What the automation WOULD produce for a date, and where it came from.
 *
 * The date defaults to today in the canonical Indian calendar -- not the
 * administrator's own calendar -- because that is the date the app uses.
 */
function PreviewPanel({
  config,
  pool,
  overrides,
}: {
  config: VotdConfigDocument;
  pool: VersePoolEntryDocument[];
  overrides: DailyVerse[];
}) {
  const [dateKey, setDateKey] = useState(() => indiaDateKey());

  const overrideByDate = useMemo(() => {
    const byDate = new Map<string, DailyVerse>();
    for (const verse of overrides) {
      if (!byDate.has(verse.date)) byDate.set(verse.date, verse);
    }
    return byDate;
  }, [overrides]);

  const preview = useMemo<Preview | null>(() => {
    if (!isDateKey(dateKey)) return null;

    const override = overrideByDate.get(dateKey);
    if (override && override.reference.trim() && override.text.trim()) {
      return { dateKey, source: 'override', reference: override.reference };
    }

    if (config.enabled) {
      const entry = selectVerseForDate(dateKey, config, pool);
      if (entry) return { dateKey, source: 'pool', reference: entry.reference };
    }

    // Everything else lands on the app's own bundled fallback. The admin
    // dashboard deliberately does not carry that list: naming a specific
    // verse here would mean a second copy to keep in step, and what
    // matters is that the church knows this date is not theirs.
    return { dateKey, source: 'fallback', reference: '' };
  }, [dateKey, config, pool, overrideByDate]);

  const today = indiaDateKey();

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 3, p: 3 }}
      data-testid="votd-preview-panel"
    >
      <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
        Preview
      </Typography>
      <Typography color="text.secondary" sx={{ fontSize: 14, mb: 2 }}>
        Exactly what the app will show, worked out with the same rules the app uses.
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: 'flex-start' }}
      >
        <TextField
          label="Date"
          type="date"
          value={dateKey}
          onChange={(event) => setDateKey(event.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'data-testid': 'votd-preview-date' },
          }}
        />
        <Button
          onClick={() => setDateKey(today)}
          disabled={dateKey === today}
          data-testid="votd-preview-today"
        >
          Today
        </Button>
      </Stack>

      <Box sx={{ mt: 2 }} data-testid="votd-preview-result">
        {!preview ? (
          <Alert severity="warning" data-testid="votd-preview-invalid-date">
            Choose a date to preview.
          </Alert>
        ) : preview.source === 'override' ? (
          <Stack spacing={1}>
            <Chip
              label="Set by hand"
              color="primary"
              size="small"
              sx={{ alignSelf: 'flex-start' }}
            />
            <Typography sx={{ fontSize: 18 }} data-testid="votd-preview-reference">
              {preview.reference}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 14 }}>
              A verse set on the Daily Verses page wins over the rotation, so this is what
              members will see.
            </Typography>
          </Stack>
        ) : preview.source === 'pool' ? (
          <Stack spacing={1}>
            <Chip label="From the pool" size="small" sx={{ alignSelf: 'flex-start' }} />
            <Typography sx={{ fontSize: 18 }} data-testid="votd-preview-reference">
              {preview.reference}
            </Typography>
          </Stack>
        ) : (
          <Alert severity="info" data-testid="votd-preview-fallback">
            {config.enabled
              ? 'The pool has no usable verses for this date, so the app will fall back to one of its own built-in verses. Add verses to the pool below.'
              : 'Automatic selection is paused, so the app will fall back to one of its own built-in verses on any date you have not set by hand.'}
          </Alert>
        )}
      </Box>
    </Paper>
  );
}

function PoolPanel({
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
  const [bumping, setBumping] = useState(false);

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

  async function handleBump() {
    setBumping(true);
    setFailure(null);
    try {
      await bumpVotdPoolVersion(config.poolVersion);
    } catch {
      setFailure('Could not restart the rotation. Please try again.');
    } finally {
      setBumping(false);
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 3, p: 3 }}
      data-testid="votd-pool-panel"
    >
      <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
        Verse pool
      </Typography>
      <Typography color="text.secondary" sx={{ fontSize: 14, mb: 2 }}>
        The verses the rotation draws from, in the order it uses them. Each one comes up
        once before any repeats
        {/* Only stated once there is a pool to count. The earlier wording
            fell back to a literal "n" and read like an unfilled
            placeholder on a church that had not added a verse yet. */}
        {active.length > 0
          ? `, so these ${active.length} last ${active.length} days.`
          : '.'}
      </Typography>

      {failure ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="votd-pool-failed">
          {failure}
        </Alert>
      ) : null}

      {canManage ? <AddPoolEntryForm pool={pool} /> : null}

      {active.length === 0 && excluded.length === 0 ? (
        <AdminEmptyState
          message="No verses in the pool yet. Until there are, the app falls back to its own built-in verses."
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
                          onClick={() =>
                            void handleToggle(entry as VersePoolEntryDocument)
                          }
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
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {entry.reference}
                    </TableCell>
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

      {canManage ? (
        <Box sx={{ mt: 2 }}>
          <Button
            onClick={() => void handleBump()}
            disabled={bumping}
            data-testid="votd-bump-pool-version"
          >
            {bumping ? 'Restarting…' : 'Restart the rotation'}
          </Button>
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
            Raises the pool version, which reshuffles the order and refreshes every phone
            on its next open. Worth doing after adding or taking out verses.
          </Typography>
        </Box>
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Remove this verse from the pool?</DialogTitle>
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
 * error -- it is a day on which the congregation silently gets the
 * fallback. Picking from the 66 books and checking the number against the
 * real verse count makes that impossible. See ./bibleStructure.ts.
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
          Added {added} to the pool.
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
