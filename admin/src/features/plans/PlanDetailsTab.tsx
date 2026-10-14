import { useState } from 'react';
import {
  Autocomplete,
  Box,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import { FormSection } from '../../components/ui';
import { ImageField } from '../../components/media';
import type { PlanLanguage } from '../../types';
import { validatePlanCoverImage } from './validation';
import {
  PLAN_CATEGORY_SUGGESTIONS,
  PLAN_LANGUAGE_OPTIONS,
  PLAN_LIMITS,
  validatePlanId,
  type PlanDetailsErrors,
  type PlanDetailsForm,
} from './planDetails';

/**
 * Everything about a plan except its days: what it is called, who it is
 * for, how long a day takes, and its cover.
 *
 * The plan's ID is chosen once. While the plan is new it follows the title
 * (and can be typed over); once saved it is shown, read-only, because
 * members' progress is stored under it.
 */
export function PlanDetailsTab({
  details,
  errors,
  planId,
  mode,
  idError,
  readOnly,
  showErrors,
  onChange,
  onChangePlanId,
  onUploadingChange,
}: {
  details: PlanDetailsForm;
  errors: PlanDetailsErrors;
  planId: string;
  mode: 'create' | 'edit';
  /** A problem with the id that only Firestore knows (it is already taken). */
  idError: string | null;
  readOnly: boolean;
  /** Show "required" messages (after a failed save or publish attempt). */
  showErrors: boolean;
  onChange: (field: keyof PlanDetailsForm, value: string | null) => void;
  onChangePlanId: (value: string) => void;
  onUploadingChange: (busy: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const idProblem = mode === 'create' ? (idError ?? validatePlanId(planId)) : null;
  const showIdProblem =
    idProblem !== null && (showErrors || planId.length > 0 || idError);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(planId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the id is on screen to select.
    }
  }

  return (
    <Box
      component="fieldset"
      disabled={readOnly}
      sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}
      data-testid="plan-details-tab"
    >
      <FormSection
        title="The plan"
        description="What members see in the plan library, before they open it."
      >
        <TextField
          label="Title"
          fullWidth
          required
          margin="normal"
          value={details.title}
          onChange={(event) => onChange('title', event.target.value)}
          error={Boolean(errors.title)}
          helperText={errors.title ?? 'For example, "Seven Days in the Psalms".'}
          slotProps={{ htmlInput: { 'data-testid': 'plan-title' } }}
        />

        <TextField
          label="Plan ID"
          fullWidth
          required
          margin="normal"
          value={planId}
          onChange={(event) => onChangePlanId(event.target.value)}
          disabled={readOnly}
          error={Boolean(showIdProblem)}
          helperText={
            mode === 'edit'
              ? "This ID cannot be changed. Members' progress is saved under it."
              : ((showIdProblem ? idProblem : null) ??
                "Made from the title. It cannot be changed after the plan is saved, because members' progress is saved under it.")
          }
          slotProps={{
            htmlInput: {
              'data-testid': 'plan-id',
              readOnly: mode === 'edit',
              spellCheck: false,
              autoCapitalize: 'none',
            },
            input:
              mode === 'edit'
                ? {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={copied ? 'Copied' : 'Copy ID'}>
                          <IconButton
                            aria-label="Copy plan ID"
                            edge="end"
                            onClick={() => void copyId()}
                            data-testid="plan-id-copy"
                          >
                            {copied ? (
                              <CheckOutlined fontSize="small" />
                            ) : (
                              <ContentCopyOutlined fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }
                : undefined,
          }}
        />

        <TextField
          label="Subtitle"
          fullWidth
          margin="normal"
          value={details.subtitle}
          onChange={(event) => onChange('subtitle', event.target.value)}
          error={Boolean(errors.subtitle)}
          helperText={errors.subtitle ?? 'Optional. A short line under the title.'}
          slotProps={{ htmlInput: { 'data-testid': 'plan-subtitle' } }}
        />

        <TextField
          label="Description"
          fullWidth
          required
          multiline
          minRows={4}
          margin="normal"
          value={details.description}
          onChange={(event) => onChange('description', event.target.value)}
          error={
            Boolean(errors.description) || (showErrors && !details.description.trim())
          }
          helperText={
            errors.description ??
            (showErrors && !details.description.trim()
              ? 'Write a short description. It is what members read before they start.'
              : `${details.description.trim().length.toLocaleString('en')} / ${PLAN_LIMITS.description.toLocaleString('en')} · What the plan is about and who it is for.`)
          }
          slotProps={{ htmlInput: { 'data-testid': 'plan-description' } }}
        />
      </FormSection>

      <FormSection
        title="Audience and length"
        description="Helps members choose a plan that suits them."
      >
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          }}
        >
          <TextField
            select
            label="Language"
            margin="normal"
            fullWidth
            // A MUI select is not a native control, so the fieldset's
            // `disabled` does not reach it.
            disabled={readOnly}
            value={details.language}
            onChange={(event) => onChange('language', event.target.value as PlanLanguage)}
            helperText="The language the plan is written in."
            slotProps={{ htmlInput: { 'data-testid': 'plan-language' } }}
          >
            {PLAN_LANGUAGE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <Autocomplete
            freeSolo
            options={PLAN_CATEGORY_SUGGESTIONS}
            inputValue={details.category}
            onInputChange={(_event, value) => onChange('category', value)}
            disabled={readOnly}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Category"
                required
                margin="normal"
                error={Boolean(errors.category)}
                helperText={errors.category ?? 'Choose one or type your own.'}
                slotProps={{
                  ...params.slotProps,
                  htmlInput: {
                    ...params.slotProps.htmlInput,
                    'data-testid': 'plan-category',
                  },
                }}
              />
            )}
          />

          <TextField
            label="Estimated time per day"
            type="number"
            margin="normal"
            fullWidth
            value={details.estimatedMinutes}
            onChange={(event) => onChange('estimatedMinutes', event.target.value)}
            error={Boolean(errors.estimatedMinutes)}
            helperText={errors.estimatedMinutes ?? 'Optional. Minutes a day takes.'}
            slotProps={{
              htmlInput: {
                min: PLAN_LIMITS.estimatedMinutes.min,
                max: PLAN_LIMITS.estimatedMinutes.max,
                'data-testid': 'plan-minutes',
              },
              input: {
                endAdornment: <InputAdornment position="end">min</InputAdornment>,
              },
            }}
          />

          <TextField
            label="Author"
            margin="normal"
            fullWidth
            value={details.author}
            onChange={(event) => onChange('author', event.target.value)}
            error={Boolean(errors.author)}
            helperText={errors.author ?? 'Optional. Who wrote the plan.'}
            slotProps={{ htmlInput: { 'data-testid': 'plan-author' } }}
          />
        </Box>
      </FormSection>

      <FormSection
        title="Cover image"
        description="Shown on the plan's card in the app. Optional."
      >
        <ImageField
          label="Cover image"
          value={details.coverImageUrl}
          onChange={(url) => onChange('coverImageUrl', url)}
          category="cover"
          testIdPrefix="plan-cover"
          validateFile={validatePlanCoverImage}
          disabled={readOnly}
          onBusyChange={onUploadingChange}
          helperText="A wide picture works best. It is cropped to fit the card."
        />
      </FormSection>

      <FormSection
        title="Where it appears"
        description="Plans are listed in the app from the lowest number to the highest."
      >
        <TextField
          label="Display order"
          type="number"
          margin="normal"
          sx={{ maxWidth: 240 }}
          value={details.order}
          onChange={(event) => onChange('order', event.target.value)}
          error={Boolean(errors.order)}
          helperText={errors.order ?? 'Lower numbers appear first.'}
          slotProps={{ htmlInput: { 'data-testid': 'plan-order' } }}
        />
      </FormSection>
    </Box>
  );
}
