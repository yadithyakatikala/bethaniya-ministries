import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { createPlan, updatePlan, uploadPlanCoverImage } from '../../services/firebase/plans';
import { hasValidationErrors, validatePlanCoverImage, validatePlanInput } from './validation';
import type { Plan } from '../../types';

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
  const [coverImageUrl] = useState<string | null>(plan?.coverImageUrl ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    category?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setImageFile(null);
      setImageError(null);
      return;
    }
    const error = validatePlanCoverImage(file);
    if (error) {
      setImageError(error);
      setImageFile(null);
      return;
    }
    setImageError(null);
    setImageFile(file);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validatePlanInput({ title, description, category });
    setFieldErrors(errors);
    if (hasValidationErrors(errors) || imageError) return;

    const parsedOrder = Number.parseInt(order, 10);
    const resolvedOrder = Number.isFinite(parsedOrder) ? parsedOrder : 0;

    setSubmitting(true);
    try {
      let resolvedCoverImageUrl = coverImageUrl;
      if (imageFile) {
        resolvedCoverImageUrl = await uploadPlanCoverImage(imageFile);
      }

      if (mode === 'create') {
        await createPlan({
          title,
          description,
          category,
          coverImageUrl: resolvedCoverImageUrl,
          order: resolvedOrder,
        });
      } else if (plan) {
        await updatePlan(plan.id, {
          title,
          description,
          category,
          coverImageUrl: resolvedCoverImageUrl,
          order: resolvedOrder,
        });
      }
      navigate('/plans');
    } catch {
      setSubmitError('Something went wrong while saving. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ p: 4, maxWidth: 640 }}>
      <Paper sx={{ p: 4 }} component="form" onSubmit={handleSubmit}>
        <Typography variant="h5" component="h1" gutterBottom>
          {mode === 'create' ? 'New Reading Plan' : 'Edit Reading Plan'}
        </Typography>

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

        <Box sx={{ mt: 2, mb: 1 }}>
          <Typography variant="body2" gutterBottom>
            Cover image (optional)
          </Typography>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            data-testid="plan-cover-image-input"
          />
          {imageError ? (
            <Typography variant="body2" color="error" data-testid="plan-cover-image-error">
              {imageError}
            </Typography>
          ) : null}
          {coverImageUrl && !imageFile ? (
            <Typography variant="body2" color="text.secondary">
              Current cover image is set. Choose a new file to replace it.
            </Typography>
          ) : null}
        </Box>

        <Button
          type="submit"
          variant="contained"
          sx={{ mt: 2 }}
          disabled={submitting}
          data-testid="plan-form-submit"
        >
          {mode === 'create' ? 'Create' : 'Save changes'}
        </Button>
        <Button sx={{ mt: 2, ml: 1 }} onClick={() => navigate('/plans')} data-testid="plan-form-cancel">
          Cancel
        </Button>
      </Paper>
    </Box>
  );
}
