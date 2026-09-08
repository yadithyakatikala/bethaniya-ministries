import { describe, expect, it } from 'vitest';
import {
  CHURCH_NAME_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  LOGO_URL_MAX_LENGTH,
  SUPPORT_EMAIL_MAX_LENGTH,
  hasValidationErrors,
  validateSettingsInput,
} from '../validation';

const VALID_INPUT = {
  churchName: 'Bethaniya Ministries',
  logoUrl: 'https://example.com/logo.png',
  description: 'A community of faith, worship, and fellowship.',
  supportEmail: 'support@example.com',
};

describe('validateSettingsInput', () => {
  it('returns no errors for valid input', () => {
    expect(hasValidationErrors(validateSettingsInput(VALID_INPUT))).toBe(false);
  });

  it('requires a non-empty church name', () => {
    const errors = validateSettingsInput({ ...VALID_INPUT, churchName: '   ' });
    expect(errors.churchName).toBeDefined();
  });

  it('rejects a church name over the max length', () => {
    const errors = validateSettingsInput({
      ...VALID_INPUT,
      churchName: 'x'.repeat(CHURCH_NAME_MAX_LENGTH + 1),
    });
    expect(errors.churchName).toBeDefined();
  });

  it('requires a non-empty logo URL', () => {
    const errors = validateSettingsInput({ ...VALID_INPUT, logoUrl: '   ' });
    expect(errors.logoUrl).toBeDefined();
  });

  it('rejects a logo URL that is not a valid http(s) URL', () => {
    const errors = validateSettingsInput({ ...VALID_INPUT, logoUrl: 'not-a-url' });
    expect(errors.logoUrl).toBeDefined();
  });

  it('accepts an http (not just https) logo URL', () => {
    const errors = validateSettingsInput({
      ...VALID_INPUT,
      logoUrl: 'http://example.com/logo.png',
    });
    expect(errors.logoUrl).toBeUndefined();
  });

  it('rejects a logo URL over the max length', () => {
    const errors = validateSettingsInput({
      ...VALID_INPUT,
      logoUrl: `https://example.com/${'x'.repeat(LOGO_URL_MAX_LENGTH)}`,
    });
    expect(errors.logoUrl).toBeDefined();
  });

  it('requires a non-empty description', () => {
    const errors = validateSettingsInput({ ...VALID_INPUT, description: '   ' });
    expect(errors.description).toBeDefined();
  });

  it('rejects a description over the max length', () => {
    const errors = validateSettingsInput({
      ...VALID_INPUT,
      description: 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1),
    });
    expect(errors.description).toBeDefined();
  });

  it('requires a non-empty support email', () => {
    const errors = validateSettingsInput({ ...VALID_INPUT, supportEmail: '   ' });
    expect(errors.supportEmail).toBeDefined();
  });

  it('rejects a support email without an @ and domain', () => {
    const errors = validateSettingsInput({
      ...VALID_INPUT,
      supportEmail: 'not-an-email',
    });
    expect(errors.supportEmail).toBeDefined();
  });

  it('rejects a support email over the max length', () => {
    const errors = validateSettingsInput({
      ...VALID_INPUT,
      supportEmail: `${'x'.repeat(SUPPORT_EMAIL_MAX_LENGTH)}@example.com`,
    });
    expect(errors.supportEmail).toBeDefined();
  });

  it('accepts every field exactly at its max length', () => {
    const errors = validateSettingsInput({
      churchName: 'x'.repeat(CHURCH_NAME_MAX_LENGTH),
      logoUrl: `https://x.co/${'a'.repeat(LOGO_URL_MAX_LENGTH - 13)}`,
      description: 'x'.repeat(DESCRIPTION_MAX_LENGTH),
      supportEmail: `${'a'.repeat(SUPPORT_EMAIL_MAX_LENGTH - 12)}@example.com`,
    });
    expect(hasValidationErrors(errors)).toBe(false);
  });
});
