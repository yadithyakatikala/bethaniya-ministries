import { describe, expect, it } from 'vitest';
import {
  appLanguageLabel,
  authProviderLabel,
  filterUsers,
  genderLabel,
  lastActiveLabel,
  matchesUserQuery,
  profileCompletionLabel,
} from '../userSearch';
import type { AdminUserSummary } from '../../../types';

/**
 * Finding one member, and saying honestly what is known about them.
 *
 * The label functions matter as much as the matching here: "not
 * recorded" and "email account" are different answers, and an
 * administrative record that guesses is worse than one that says it does
 * not know.
 */
function user(overrides: Partial<AdminUserSummary> = {}): AdminUserSummary {
  return {
    uid: 'uid-abc123',
    displayName: 'Asha Kumar',
    email: 'asha@example.com',
    phoneNumber: '+91 98765 43210',
    role: 'member',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    gender: null,
    appLanguage: null,
    authProvider: null,
    lastActiveAt: null,
    profileCompletedAt: null,
    accountStatus: 'active',
    suspension: null,
    ...overrides,
  };
}

describe('searching', () => {
  it('matches an empty query against everybody', () => {
    expect(matchesUserQuery(user(), '')).toBe(true);
    expect(matchesUserQuery(user(), '   ')).toBe(true);
  });

  it('matches part of a name, ignoring case', () => {
    expect(matchesUserQuery(user(), 'asha')).toBe(true);
    expect(matchesUserQuery(user(), 'KUMAR')).toBe(true);
  });

  it('matches an email address', () => {
    expect(matchesUserQuery(user(), 'asha@example')).toBe(true);
  });

  it('matches a uid -- the one an administrator reads off a log line', () => {
    expect(matchesUserQuery(user(), 'abc123')).toBe(true);
  });

  it('finds an account with NO name by its email or uid', () => {
    // The account most likely to need looking up is the one that has no
    // name on it, which is exactly what a name-only search cannot find.
    const nameless = user({ displayName: null });
    expect(matchesUserQuery(nameless, 'asha@example.com')).toBe(true);
    expect(matchesUserQuery(nameless, 'uid-abc')).toBe(true);
  });

  it('matches a phone number typed WITHOUT its spaces or country code', () => {
    // "+91 98765 43210" stored, "9876543210" typed off a piece of paper.
    expect(matchesUserQuery(user(), '9876543210')).toBe(true);
  });

  it('matches a phone number typed exactly as stored', () => {
    expect(matchesUserQuery(user(), '+91 98765')).toBe(true);
  });

  it('does not match somebody unrelated', () => {
    expect(matchesUserQuery(user(), 'zzz-nobody')).toBe(false);
  });

  it('filters a list down', () => {
    const people = [user(), user({ uid: 'u2', displayName: 'Ravi', email: null })];
    expect(filterUsers(people, 'ravi').map((u) => u.uid)).toEqual(['u2']);
    expect(filterUsers(people, '')).toHaveLength(2);
  });
});

describe('saying what is actually known', () => {
  it('does NOT call an unrecorded provider "email"', () => {
    // Reading another user's Firebase Auth record needs the Admin SDK,
    // which this project cannot deploy -- so an account that has not
    // signed in since M7 has no recorded provider, and guessing one
    // would be a plausible-looking lie in an administrative record.
    expect(authProviderLabel(null)).toBe('Not recorded yet');
  });

  it('names each provider it does know', () => {
    expect(authProviderLabel('password')).toBe('Email and password');
    expect(authProviderLabel('google.com')).toBe('Google');
    expect(authProviderLabel('apple.com')).toBe('Apple');
  });

  it('does not call an unrecorded last-active "never"', () => {
    // Never WRITTEN is not the same as the member never having opened
    // the app.
    expect(lastActiveLabel(null)).toBe('Not recorded yet');
  });

  it('reports profile completion from the explicit marker', () => {
    expect(profileCompletionLabel(null)).toBe('Not completed');
    expect(profileCompletionLabel(new Date('2026-02-01T00:00:00Z'))).toContain(
      'Completed'
    );
  });

  it('says "Not set" rather than guessing a gender or a language', () => {
    expect(genderLabel(null)).toBe('Not set');
    expect(appLanguageLabel(null)).toBe('Not set');
    expect(genderLabel('female')).toBe('Female');
    expect(appLanguageLabel('te')).toBe('Telugu');
  });
});
