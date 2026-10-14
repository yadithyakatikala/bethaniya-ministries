/**
 * Client-side validation for reading plans and their days. Same
 * "UX convenience only, firestore.rules is the real authority" reasoning
 * as ../announcements/validation.ts -- field caps mirror
 * firestore.rules' isValidPlan()/isValidPlanDay() exactly.
 */

import { validateUploadFile } from '../../services/media/uploadRules';

export const PLAN_TITLE_MAX_LENGTH = 200;
export const PLAN_DESCRIPTION_MAX_LENGTH = 2000;
export const PLAN_CATEGORY_MAX_LENGTH = 100;

export interface PlanValidationInput {
  title: string;
  description: string;
  category: string;
}

export interface PlanValidationErrors {
  title?: string;
  description?: string;
  category?: string;
}

export function validatePlanInput(input: PlanValidationInput): PlanValidationErrors {
  const errors: PlanValidationErrors = {};

  const title = input.title.trim();
  if (title.length === 0) {
    errors.title = 'Title is required.';
  } else if (title.length > PLAN_TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${PLAN_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  const description = input.description.trim();
  if (description.length === 0) {
    errors.description = 'Description is required.';
  } else if (description.length > PLAN_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be ${PLAN_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
  }

  const category = input.category.trim();
  if (category.length === 0) {
    errors.category = 'Category is required.';
  } else if (category.length > PLAN_CATEGORY_MAX_LENGTH) {
    errors.category = `Category must be ${PLAN_CATEGORY_MAX_LENGTH} characters or fewer.`;
  }

  return errors;
}

/**
 * Whether this file may be uploaded as a plan cover. It is the shared image
 * rule (../../services/media/uploadRules.ts) -- the same formats and
 * 5 MB ceiling for every picture -- so a mistake is caught in the browser
 * before an upload starts. A courtesy only: the limits that really apply
 * are set on the Cloudinary upload preset (docs/admin/MEDIA_UPLOADS.md).
 */
export function validatePlanCoverImage(file: File): string | null {
  return validateUploadFile(file, 'image');
}

export const PLAN_DAY_TITLE_MAX_LENGTH = 200;
export const PLAN_DAY_SCRIPTURE_REFERENCE_MAX_LENGTH = 200;
export const PLAN_DAY_DEVOTIONAL_MAX_LENGTH = 5000;
export const PLAN_DAY_PRAYER_PROMPT_MAX_LENGTH = 1000;

export interface PlanDayValidationInput {
  dayNumber: number;
  title: string;
  scriptureReference: string;
  devotional: string;
  prayerPrompt: string;
}

export interface PlanDayValidationErrors {
  dayNumber?: string;
  title?: string;
  scriptureReference?: string;
  devotional?: string;
  prayerPrompt?: string;
}

export function validatePlanDayInput(
  input: PlanDayValidationInput
): PlanDayValidationErrors {
  const errors: PlanDayValidationErrors = {};

  if (!Number.isInteger(input.dayNumber) || input.dayNumber < 1) {
    errors.dayNumber = 'Day number must be a whole number of 1 or greater.';
  }

  const title = input.title.trim();
  if (title.length === 0) {
    errors.title = 'Title is required.';
  } else if (title.length > PLAN_DAY_TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${PLAN_DAY_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  const scriptureReference = input.scriptureReference.trim();
  if (scriptureReference.length === 0) {
    errors.scriptureReference = 'Scripture reference is required.';
  } else if (scriptureReference.length > PLAN_DAY_SCRIPTURE_REFERENCE_MAX_LENGTH) {
    errors.scriptureReference = `Scripture reference must be ${PLAN_DAY_SCRIPTURE_REFERENCE_MAX_LENGTH} characters or fewer.`;
  }

  const devotional = input.devotional.trim();
  if (devotional.length === 0) {
    errors.devotional = 'Devotional text is required.';
  } else if (devotional.length > PLAN_DAY_DEVOTIONAL_MAX_LENGTH) {
    errors.devotional = `Devotional text must be ${PLAN_DAY_DEVOTIONAL_MAX_LENGTH} characters or fewer.`;
  }

  if (input.prayerPrompt.trim().length > PLAN_DAY_PRAYER_PROMPT_MAX_LENGTH) {
    errors.prayerPrompt = `Prayer prompt must be ${PLAN_DAY_PRAYER_PROMPT_MAX_LENGTH} characters or fewer.`;
  }

  return errors;
}

export function hasValidationErrors(
  errors: PlanValidationErrors | PlanDayValidationErrors
): boolean {
  return Object.keys(errors).length > 0;
}
