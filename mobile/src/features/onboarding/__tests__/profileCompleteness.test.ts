import type { UserProfile } from '../../../services/firebase/userProfile';
import {
  MAX_NAME_LENGTH,
  MAX_PHONE_DIGITS,
  MIN_PHONE_DIGITS,
  isProfileComplete,
  isValidFullName,
  isValidPhoneNumber,
  normalizePhoneNumber,
  onboardingDefaults,
} from '../profileCompleteness';

/**
 * The rules, as rules. Everything here is pure, so these are the cheapest
 * place to pin what counts as a valid answer -- and the place the form,
 * the gate and the Profile screen all have to agree with.
 */
function profile(partial: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'u1',
    role: 'member',
    displayName: null,
    email: null,
    phoneNumber: null,
    photoURL: null,
    gender: null,
    profileCompletedAt: null,
    languagePreference: null,
    appLanguage: null,
    bibleMode: null,
    themePreference: null,
    notificationsEnabled: null,
    ...partial,
  };
}

describe('a phone number a person actually typed', () => {
  it('accepts the shapes people write an Indian mobile in', () => {
    expect(isValidPhoneNumber('9876543210')).toBe(true);
    expect(isValidPhoneNumber('98765 43210')).toBe(true);
    expect(isValidPhoneNumber('98765-43210')).toBe(true);
    expect(isValidPhoneNumber('+91 98765 43210')).toBe(true);
    expect(isValidPhoneNumber('+91 (98765) 43210')).toBe(true);
  });

  it('accepts a foreign number, because congregations have relatives abroad', () => {
    expect(isValidPhoneNumber('+1 415 555 0132')).toBe(true);
    expect(isValidPhoneNumber('+44 20 7946 0958')).toBe(true);
  });

  it('rejects the things that are typos rather than numbers', () => {
    expect(isValidPhoneNumber('')).toBe(false);
    expect(isValidPhoneNumber('   ')).toBe(false);
    expect(isValidPhoneNumber('12345')).toBe(false); // too short
    expect(isValidPhoneNumber('9'.repeat(MAX_PHONE_DIGITS + 1))).toBe(false);
    expect(isValidPhoneNumber('not a number')).toBe(false);
    expect(isValidPhoneNumber('+')).toBe(false);
  });

  it('takes exactly the documented bounds, not one more or less', () => {
    expect(isValidPhoneNumber('9'.repeat(MIN_PHONE_DIGITS))).toBe(true);
    expect(isValidPhoneNumber('9'.repeat(MIN_PHONE_DIGITS - 1))).toBe(false);
    expect(isValidPhoneNumber('9'.repeat(MAX_PHONE_DIGITS))).toBe(true);
  });

  it('stores one number one way, whatever style it was typed in', () => {
    // Two members who gave the same number must not be two numbers in
    // the church's records.
    expect(normalizePhoneNumber('98765 43210')).toBe('9876543210');
    expect(normalizePhoneNumber('98765-43210')).toBe('9876543210');
    expect(normalizePhoneNumber('(98765) 43210')).toBe('9876543210');
    expect(normalizePhoneNumber('+91 98765 43210')).toBe('+919876543210');
  });

  it('keeps a leading + and drops everything else that is not a digit', () => {
    expect(normalizePhoneNumber('  +91-98765.43210  ')).toBe('+919876543210');
    expect(normalizePhoneNumber('abc9876543210')).toBe('9876543210');
  });
});

describe('a name', () => {
  it('is not blank and not a novel', () => {
    expect(isValidFullName('Ruth Samuel')).toBe(true);
    expect(isValidFullName('R')).toBe(true);
    expect(isValidFullName('')).toBe(false);
    expect(isValidFullName('    ')).toBe(false);
    expect(isValidFullName('x'.repeat(MAX_NAME_LENGTH))).toBe(true);
    expect(isValidFullName('x'.repeat(MAX_NAME_LENGTH + 1))).toBe(false);
  });

  it('accepts a Telugu name, which is the common case here', () => {
    expect(isValidFullName('రూతు')).toBe(true);
  });

  it('uses the same bound firestore.rules does, so the form cannot offer an impossible save', () => {
    // isValidUserProfileSelfUpdate() caps displayName at 200. A form that
    // accepted 201 would hand the member a permission error they cannot
    // act on.
    expect(MAX_NAME_LENGTH).toBe(200);
  });
});

describe('whether the questionnaire has been answered', () => {
  it('is the marker, and nothing else', () => {
    expect(isProfileComplete(profile({ profileCompletedAt: new Date() }))).toBe(true);
    expect(isProfileComplete(profile({ profileCompletedAt: null }))).toBe(false);
  });

  it('is NOT re-derived from whether the answers happen to be filled in', () => {
    // A member who later clears their phone number in Profile has still
    // been through onboarding, and must not be dragged back through it.
    const answeredThenCleared = profile({
      displayName: 'Ruth Samuel',
      phoneNumber: null,
      gender: 'female',
      appLanguage: 'te',
      profileCompletedAt: new Date(),
    });
    expect(isProfileComplete(answeredThenCleared)).toBe(true);

    // And the converse: a profile that happens to carry every answer but
    // was never submitted is not complete.
    const neverSubmitted = profile({
      displayName: 'Ruth Samuel',
      phoneNumber: '9876543210',
      gender: 'female',
      appLanguage: 'te',
    });
    expect(isProfileComplete(neverSubmitted)).toBe(false);
  });

  it('treats "not loaded" and "no document" as not complete, so the gate can tell them apart itself', () => {
    expect(isProfileComplete(undefined)).toBe(false);
    expect(isProfileComplete(null)).toBe(false);
  });
});

describe('what the form starts with', () => {
  it('uses what Google already told us rather than making someone retype it', () => {
    const defaults = onboardingDefaults({
      profile: null,
      authDisplayName: 'Ruth Samuel',
      authPhoneNumber: '+919876543210',
      appLanguage: 'en',
    });
    expect(defaults.fullName).toBe('Ruth Samuel');
    expect(defaults.phoneNumber).toBe('+919876543210');
  });

  it('prefers the profile over the auth record, since the profile is what was edited', () => {
    const defaults = onboardingDefaults({
      profile: profile({ displayName: 'Ruth S.', phoneNumber: '9876500000' }),
      authDisplayName: 'Ruth Samuel',
      authPhoneNumber: '+919876543210',
      appLanguage: 'en',
    });
    expect(defaults.fullName).toBe('Ruth S.');
    expect(defaults.phoneNumber).toBe('9876500000');
  });

  it('starts an email/password member with empty fields, not a guess', () => {
    const defaults = onboardingDefaults({
      profile: profile(),
      authDisplayName: null,
      authPhoneNumber: null,
      appLanguage: 'en',
    });
    expect(defaults.fullName).toBe('');
    expect(defaults.phoneNumber).toBe('');
  });

  it('never preselects a gender', () => {
    // A default here would record an answer the member never gave.
    expect(
      onboardingDefaults({
        profile: null,
        authDisplayName: null,
        authPhoneNumber: null,
        appLanguage: 'en',
      }).gender
    ).toBeNull();
  });

  it('starts the language at the one they are already reading', () => {
    expect(
      onboardingDefaults({
        profile: null,
        authDisplayName: null,
        authPhoneNumber: null,
        appLanguage: 'te',
      }).preferredLanguage
    ).toBe('te');
  });
});
