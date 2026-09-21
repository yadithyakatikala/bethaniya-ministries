import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  VOTD_TIMEZONE,
  bumpVotdPoolVersion,
  saveVotdConfig,
  type VersePoolEntryDocument,
  type VotdConfigDocument,
} from '../../../services/firebase/votd';
import { prepareVersePool } from '../votdSelection';
import { hasErrors, validateVotdConfig, type VotdConfigErrors } from '../votdValidation';
import { votdCycle } from '../votdStatus';
import { VOTD_YEAR_LENGTH } from '../votdYear';

/**
 * HOW IT WORKS -- the status of the automation, and the two controls
 * that change it.
 *
 * ---------------------------------------------------------------------
 * WHY THIS IS A TAB AND NOT A PAGE
 * ---------------------------------------------------------------------
 * Because it is not a feature. The Verse of the Day has ONE behaviour --
 * the app works each day's verse out from the date -- and this is simply
 * where the two knobs on that behaviour live. When it was a page of its
 * own called "Verse Automation", sitting in the sidebar beside another
 * page called "Daily Verses", a church administrator was being asked to
 * understand a distinction the product does not actually have, and to
 * guess which of the two the congregation was reading.
 *
 * The status sentence at the top is the part that was missing entirely.
 * Nobody should have to infer "it is working" from an empty table.
 *
 * ---------------------------------------------------------------------
 * THERE IS NOTHING HERE THAT RUNS DAILY
 * ---------------------------------------------------------------------
 * No job, no queue, no scheduled function, nothing to switch on each
 * morning and nothing that can fall behind. Every device computes the
 * same answer from the date, the seed and the pool version -- which is
 * also why this page can show a year's schedule without anything having
 * been created. See ../votdSelection.ts.
 */
export function AutomationPanel({
  config,
  pool,
  canManage,
}: {
  config: VotdConfigDocument;
  pool: VersePoolEntryDocument[];
  canManage: boolean;
}) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [seed, setSeed] = useState(config.seed);
  const [poolVersion, setPoolVersion] = useState(String(config.poolVersion));
  const [errors, setErrors] = useState<VotdConfigErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [bumping, setBumping] = useState(false);

  const prepared = useMemo(() => prepareVersePool(pool), [pool]);
  const cycle = useMemo(() => votdCycle(config, prepared), [config, prepared]);

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
    <Stack spacing={3} data-testid="votd-config-panel">
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 3 }}>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          How it works
        </Typography>

        <Stack spacing={1}>
          <Chip
            label={config.enabled ? 'Running' : 'Paused'}
            color={config.enabled ? 'success' : 'default'}
            size="small"
            sx={{ alignSelf: 'flex-start' }}
            data-testid="votd-automation-status"
          />
          <Typography sx={{ fontSize: 15 }} data-testid="votd-automation-summary">
            {/* The whole point of the page, in one sentence. */}
            {cycle.using === 'year'
              ? `The app chooses a verse for every day on its own, from its built-in year of ${VOTD_YEAR_LENGTH} verses. There is nothing to set up and nothing to do each morning.`
              : `The app chooses a verse for every day on its own, from the ${cycle.days} verses your church added. There is nothing to do each morning.`}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 14 }}>
            Each verse comes up once before any of them repeats, so the cycle lasts{' '}
            {cycle.days} days. The day changes at midnight {VOTD_TIMEZONE.replace('_', ' ')},
            wherever the member is.
          </Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: 3 }}>
        <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
          Settings
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 14, mb: 2 }}>
          Most churches never change these.
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
                  slotProps={{ input: { 'aria-label': 'Use your church’s own verses' } }}
                  data-testid="votd-enabled-switch"
                />
              }
              label={
                enabled
                  ? 'Using your church’s own verses when you have added some'
                  : 'Paused — your church’s own verses are ignored and the app uses its built-in year'
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
              Raise this after editing your church&rsquo;s verses: it restarts the rotation
              and refreshes every phone.
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

        {canManage ? (
          <Box sx={{ mt: 3 }}>
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
      </Paper>
    </Stack>
  );
}
