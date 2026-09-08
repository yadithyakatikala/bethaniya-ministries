/**
 * Client-side settings input validation -- UX convenience only, same
 * shape and reasoning as ../events/validation.ts/../notifications/
 * validation.ts. firestore.rules' settings/{settingId} write rule is
 * role-only (isSuperAdmin()), with no field-level validation -- per this
 * session's Day 13 scope decision, no rules change is made (no security
 * gap justifies one; see ../../services/firebase/settings.ts's doc
 * comment), so this file is the only place these checks happen. Day 13's
 * plan explicitly calls for "Form validation (required fields, URL
 * validation)" -- all four fields are required; logoUrl is additionally
 * checked against the same lightweight http(s) pattern
 * ../events/validation.ts's validateEventYouTubeUrl() uses for its own
 * URL field, and supportEmail against a standard, permissive email shape
 * check (this is a UX hint, not an RFC 5322 validator).
 */

export const CHURCH_NAME_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const LOGO_URL_MAX_LENGTH = 2000;
export const SUPPORT_EMAIL_MAX_LENGTH = 320;

const HTTP_URL_PATTERN = /^https?:\/\/.+/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SettingsValidationInput {
  churchName: string;
  logoUrl: string;
  description: string;
  supportEmail: string;
}

export interface SettingsValidationErrors {
  churchName?: string;
  logoUrl?: string;
  description?: string;
  supportEmail?: string;
}

/** Validates all four fields (trimmed). Returns an empty object when valid. */
export function validateSettingsInput(
  input: SettingsValidationInput
): SettingsValidationErrors {
  const errors: SettingsValidationErrors = {};

  const churchName = input.churchName.trim();
  if (churchName.length === 0) {
    errors.churchName = 'Church name is required.';
  } else if (churchName.length > CHURCH_NAME_MAX_LENGTH) {
    errors.churchName = `Church name must be ${CHURCH_NAME_MAX_LENGTH} characters or fewer.`;
  }

  const logoUrl = input.logoUrl.trim();
  if (logoUrl.length === 0) {
    errors.logoUrl = 'Logo URL is required.';
  } else if (logoUrl.length > LOGO_URL_MAX_LENGTH) {
    errors.logoUrl = `Logo URL must be ${LOGO_URL_MAX_LENGTH} characters or fewer.`;
  } else if (!HTTP_URL_PATTERN.test(logoUrl)) {
    errors.logoUrl = 'Logo URL must be a valid http(s) URL.';
  }

  const description = input.description.trim();
  if (description.length === 0) {
    errors.description = 'Description is required.';
  } else if (description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`;
  }

  const supportEmail = input.supportEmail.trim();
  if (supportEmail.length === 0) {
    errors.supportEmail = 'Support email is required.';
  } else if (supportEmail.length > SUPPORT_EMAIL_MAX_LENGTH) {
    errors.supportEmail = `Support email must be ${SUPPORT_EMAIL_MAX_LENGTH} characters or fewer.`;
  } else if (!EMAIL_PATTERN.test(supportEmail)) {
    errors.supportEmail = 'Support email must be a valid email address.';
  }

  return errors;
}

export function hasValidationErrors(errors: SettingsValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
