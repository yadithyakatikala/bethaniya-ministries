import { doc, onSnapshot, runTransaction, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { ensureOwnProfileExists, subscribeToOwnProfile, updateOwnProfile } from '../userProfile';

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
      languagePreference: 'te',
      themePreference: 'dark',
      notificationsEnabled: true,
    });
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
