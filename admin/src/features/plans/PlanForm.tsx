import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, TextField } from '@mui/material';
import { createPlan, updatePlan } from '../../services/firebase/plans';
import {
  hasValidationErrors,
  validatePlanCoverImage,
  validatePlanInput,
} from './validation';
import type { Plan } from '../../types';
import { SAVE_RETRY_MESSAGE } from '../../services/firebase/saveErrors';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { FormActions, FormCard, PageContainer } from '../../components/ui';
import { ImageField } from '../../components/media';

interface PlanFormProps {
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. */
  plan?: Plan;
}

/**
 * Shared create/edit form for a plan's metadata (title/description/
 * category/cover/order). Managing the plan's days is a separate page
 * (PlanDaysPage.tsx), reached from the list page after a plan exists --
 * a brand-new plan is created here with zero days, then days are added
 * one at a time. Publish/unpublish is a separate list-page action, same
 * as ../announcements/AnnouncementForm.tsx.
 */
export function PlanForm({ mode, plan }: PlanFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(plan?.title ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [category, setCategory] = useState(plan?.category ?? '');
  const [order, setOrder] = useState(String(plan?.order ?? 0));
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    plan?.coverImageUrl ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    category?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validatePlanInput({ title, description, category });
    setFieldErrors(errors);
    if (hasValidationErrors(errors) || uploading) return;

    const parsedOrder = Number.parseInt(order, 10);
    const resolvedOrder = Number.isFinite(parsedOrder) ? parsedOrder : 0;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createPlan({
          title,
          description,
          category,
          coverImageUrl,
          order: resolvedOrder,
        });
      } else if (plan) {
        await updatePlan(plan.id, {
          title,
          description,
          category,
          coverImageUrl,
          order: resolvedOrder,
        });
      }
      navigate('/plans');
    } catch {
      setSubmitError(SAVE_RETRY_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer width="narrow">
      <AdminPageHeader
        title={mode === 'create' ? 'New Reading Plan' : 'Edit Reading Plan'}
        breadcrumbs={[
          { label: 'Reading Plans', to: '/plans' },
          { label: mode === 'create' ? 'New' : 'Edit' },
        ]}
      />
      <FormCard onSubmit={handleSubmit}>
        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="plan-form-error">
            {submitError}
          </Alert>
        ) : null}

        <TextField
          label="Title"
          fullWidth
          margin="normal"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={Boolean(fieldErrors.title)}
          helperText={fieldErrors.title}
          slotProps={{ htmlInput: { 'data-testid': 'plan-title-input' } }}
        />
        <TextField
          label="Description"
          fullWidth
          multiline
          minRows={3}
          margin="normal"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={Boolean(fieldErrors.description)}
          helperText={fieldErrors.description}
          slotProps={{ htmlInput: { 'data-testid': 'plan-description-input' } }}
        />
        <TextField
          label="Category"
          fullWidth
          margin="normal"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          error={Boolean(fieldErrors.category)}
          helperText={fieldErrors.category || 'e.g. Devotional, Topical, Seasonal'}
          slotProps={{ htmlInput: { 'data-testid': 'plan-category-input' } }}
        />
        <TextField
          label="Display order"
          type="number"
          margin="normal"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          helperText="Lower numbers appear first in the mobile library."
          slotProps={{ htmlInput: { 'data-testid': 'plan-order-input' } }}
        />

        <ImageField
          label="Cover image (optional)"
          value={coverImageUrl}
          onChange={setCoverImageUrl}
          category="cover"
          testIdPrefix="plan-cover-image"
          validateFile={validatePlanCoverImage}
          onBusyChange={setUploading}
        />

        <FormActions>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || uploading}
            data-testid="plan-form-submit"
          >
            {mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
          <Button onClick={() => navigate('/plans')} data-testid="plan-form-cancel">
            Cancel
          </Button>
        </FormActions>
      </FormCard>
    </PageContainer>
  );
}
