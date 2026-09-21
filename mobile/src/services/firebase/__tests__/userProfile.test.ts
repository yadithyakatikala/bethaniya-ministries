import { doc, onSnapshot, runTransaction, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  ensureOwnProfileExists,
  subscribeToOwnProfile,
  updateOwnProfile,
} from '../userProfile';

jest.mock('../app');

describe('subscribeToOwnProfile', () => {
  afterEach(() => jest.clearAllMocks());

  it('subscribes to users/{uid}', () => {
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    subscribeToOwnProfile('uid-1', jest.fn(), jest.fn());
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'uid-1');
  });

  it('maps an existing document into a UserProfile', () => {
    const onNext = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        id: 'uid-1',
        data: () => ({
          role: 'member',
          displayName: 'Jane Doe',
          email: 'jane@example.com',
          phoneNumber: '+15551234567',
          photoURL: 'https://example.com/p.png',
          languagePreference: 'te',
          appLanguage: 'en',
          bibleMode: 'bilingual',
          themePreference: 'dark',
          notificationsEnabled: true,
        }),
      });
      return jest.fn();
    });

    subscribeToOwnProfile('uid-1', onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith({
      uid: 'uid-1',
      role: 'member',
      displayName: 'Jane Doe',
      email: 'jane@example.com',
      phoneNumber: '+15551234567',
      photoURL: 'https://example.com/p.png',
      // V1's single field is still mapped: it is kept for backward
      // compatibility alongside the two V2 fields that supersede it.
      languagePreference: 'te',
      appLanguage: 'en',
      bibleMode: 'bilingual',
      themePreference: 'dark',
      notificationsEnabled: true,
      // M6's onboarding fields. A document written before onboarding
      // existed carries neither, and both map to null rather than being
      // left off the object -- OnboardingGate reads profileCompletedAt,
      // and an absent key would be indistinguishable from a profile that
      // has not loaded.
      gender: null,
      profileCompletedAt: null,
      // M7's fields, on the same reasoning. `accountStatus` is the one
      // that does NOT default to null: a member whose document says
      // nothing about suspension is active, and a missing value must
      // never read as "suspended".
      authProvider: null,
      lastActiveAt: null,
      accountStatus: 'active',
      // M8. Null, and ../../features/account/suspension.ts reads that as
      // "nothing recorded" -- or, on a suspended account, as a
      // suspension that never expires.
      suspension: null,
    });
  });

  it('maps the M6 onboarding fields when a profile has been completed', async () => {
    const onNext = jest.fn();
    const completedAt = new Date('2026-04-03T09:00:00.000Z');
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        id: 'uid-1m6',
        data: () => ({
          role: 'member',
          gender: 'female',
          profileCompletedAt: completedAt,
        }),
      });
      return jest.fn();
    });

    subscribeToOwnProfile('uid-1m6', onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({ gender: 'female', profileCompletedAt: completedAt })
    );
  });

  it('rejects a gender value outside the two the app supports', async () => {
    // Same defensive mapping as the language fields above: whatever is in
    // the document, this returns something the app's types allow.
    const onNext = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        id: 'uid-1m7',
        data: () => ({ role: 'member', gender: 'other', profileCompletedAt: 'soon' }),
      });
      return jest.fn();
    });

    subscribeToOwnProfile('uid-1m7', onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({ gender: null, profileCompletedAt: null })
    );
  });

  it('maps a V1 profile that has no V2 language fields', async () => {
    const onNext = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        id: 'uid-1b',
        data: () => ({ role: 'member', languagePreference: 'te' }),
      });
      return jest.fn();
    });

    subscribeToOwnProfile('uid-1b', onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({
        languagePreference: 'te',
        appLanguage: null,
        bibleMode: null,
      })
    );
  });

  it('rejects a language value that is not one this app supports', async () => {
    const onNext = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        id: 'uid-1c',
        data: () => ({ role: 'member', appLanguage: 'fr', bibleMode: 'klingon' }),
      });
      return jest.fn();
    });

    subscribeToOwnProfile('uid-1c', onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({ appLanguage: null, bibleMode: null })
    );
  });

  it('defaults missing/invalid preference fields to null rather than throwing', () => {
    const onNext = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        id: 'uid-2',
        data: () => ({ role: 'member' }),
      });
      return jest.fn();
    });

    subscribeToOwnProfile('uid-2', onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: null,
        photoURL: null,
        languagePreference: null,
        appLanguage: null,
        bibleMode: null,
        themePreference: null,
        notificationsEnabled: null,
      })
    );
  });

  it('calls onNext with null when the document does not exist', () => {
    const onNext = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({ exists: () => false });
      return jest.fn();
    });

    subscribeToOwnProfile('uid-3', onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith(null);
  });

  it('forwards Firestore errors to onError', () => {
    const onError = jest.fn();
    const error = { code: 'permission-denied' };
    (onSnapshot as jest.Mock).mockImplementation((_ref, _next, err) => {
      err(error);
      return jest.fn();
    });

    subscribeToOwnProfile('uid-4', jest.fn(), onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe('updateOwnProfile', () => {
  afterEach(() => jest.clearAllMocks());

  it('only writes the fields explicitly passed', async () => {
    await updateOwnProfile('uid-1', { displayName: 'New Name' });
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      displayName: 'New Name',
    });
  });

  it('supports updating multiple preference fields at once', async () => {
    await updateOwnProfile('uid-1', {
      languagePreference: 'te',
      themePreference: 'dark',
      notificationsEnabled: false,
    });
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      languagePreference: 'te',
      themePreference: 'dark',
      notificationsEnabled: false,
    });
  });

  it('carries the two V2 language fields through the allowlist', async () => {
    // A field missing from updateOwnProfile()'s copy would be dropped
    // silently, so the preference would appear to save and then come back
    // wrong on the next device.
    await updateOwnProfile('uid-1', { appLanguage: 'te', bibleMode: 'bilingual' });
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      appLanguage: 'te',
      bibleMode: 'bilingual',
    });
  });

  it('never sends role, email, phoneNumber, or createdAt', async () => {
    await updateOwnProfile('uid-1', { displayName: 'X' } as never);
    const [, sentUpdate] = (updateDoc as jest.Mock).mock.calls[0];
    expect(Object.keys(sentUpdate)).not.toEqual(
      expect.arrayContaining(['role', 'email', 'phoneNumber', 'createdAt'])
    );
  });
});

describe('ensureOwnProfileExists', () => {
  afterEach(() => jest.clearAllMocks());

  const user = {
    uid: 'uid-1',
    displayName: 'Jane Doe',
    email: 'jane@example.com',
    phoneNumber: '+15551234567',
  } as User;

  /**
   * Client-side fallback for functions/src/createUserProfile.ts's Auth
   * trigger -- see userProfile.ts's header comment for why the trigger
   * can never run under this project's zero-billing constraint (Cloud
   * Functions require the Blaze plan to deploy at all).
   */
  it("creates the profile with role 'member' when none exists yet", async () => {
    const set = jest.fn();
    (runTransaction as jest.Mock).mockImplementation((_db, updateFunction) =>
      updateFunction({ get: async () => ({ exists: () => false }), set })
    );

    await ensureOwnProfileExists(user);

    expect(set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        role: 'member',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        phoneNumber: '+15551234567',
      })
    );
  });

  it('never overwrites an existing profile (e.g. one a Super Admin already elevated)', async () => {
    const set = jest.fn();
    (runTransaction as jest.Mock).mockImplementation((_db, updateFunction) =>
      updateFunction({ get: async () => ({ exists: () => true }), set })
    );

    await ensureOwnProfileExists(user);

    expect(set).not.toHaveBeenCalled();
  });

  it('does not throw if the transaction fails (sign-in must not be blocked by this)', async () => {
    (runTransaction as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(ensureOwnProfileExists(user)).resolves.toBeUndefined();
  });
});
