import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  createAccountWithEmail,
  sendPasswordReset,
  signInWithAppleIdentityToken,
  signInWithEmail,
  signInWithGoogleIdToken,
  signOutUser,
} from '../authService';

jest.mock('../app');

/** See SignInScreen.test.tsx's copy of this: jest.clearAllMocks() clears
 * recorded calls but not an implementation installed by
 * mockResolvedValue/mockRejectedValue. */
function resetEmailAuthMocks() {
  (signInWithEmailAndPassword as jest.Mock).mockImplementation(async (_auth, email) => ({
    user: { uid: 'email-user', email },
  }));
  (createUserWithEmailAndPassword as jest.Mock).mockImplementation(async (_auth, email) => ({
    user: { uid: 'new-email-user', email, emailVerified: false },
  }));
  (sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);
  (sendEmailVerification as jest.Mock).mockResolvedValue(undefined);
  (updateProfile as jest.Mock).mockResolvedValue(undefined);
}

describe('authService (email/password -- the primary V1 method)', () => {
  beforeEach(() => resetEmailAuthMocks());
  afterEach(() => jest.clearAllMocks());

  it('signs in with a trimmed email address', async () => {
    await signInWithEmail('  member@example.com ', 'pw');
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'member@example.com',
      'pw'
    );
  });

  it('creates an account, sets the display name, and sends a verification email', async () => {
    await createAccountWithEmail(' new@example.com ', 'longenough', '  Asha K  ');

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'new@example.com',
      'longenough'
    );
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'new-email-user' }),
      { displayName: 'Asha K' }
    );
    expect(sendEmailVerification).toHaveBeenCalled();
  });

  it('skips updateProfile when no display name was given', async () => {
    await createAccountWithEmail('new@example.com', 'longenough');
    expect(updateProfile).not.toHaveBeenCalled();
    expect(sendEmailVerification).toHaveBeenCalled();
  });

  it('skips updateProfile when the display name is only whitespace', async () => {
    await createAccountWithEmail('new@example.com', 'longenough', '   ');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('still resolves when setting the display name fails -- the account already exists', async () => {
    // A post-creation failure must not surface as "sign-up failed": the user
    // is already created AND already signed in by that point.
    (updateProfile as jest.Mock).mockRejectedValue(new Error('network'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      createAccountWithEmail('new@example.com', 'longenough', 'Asha K')
    ).resolves.toEqual(expect.objectContaining({ user: expect.anything() }));

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('still resolves when the verification email cannot be sent', async () => {
    (sendEmailVerification as jest.Mock).mockRejectedValue(new Error('quota'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      createAccountWithEmail('new@example.com', 'longenough')
    ).resolves.toEqual(expect.objectContaining({ user: expect.anything() }));

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('propagates a real account-creation failure', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue({
      code: 'auth/email-already-in-use',
    });
    await expect(
      createAccountWithEmail('taken@example.com', 'longenough')
    ).rejects.toEqual({ code: 'auth/email-already-in-use' });
    // Nothing downstream should have run.
    expect(updateProfile).not.toHaveBeenCalled();
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });

  it('sends a password reset email to a trimmed address', async () => {
    await sendPasswordReset('  member@example.com  ');
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      'member@example.com'
    );
  });
});

describe('authService', () => {
  afterEach(() => jest.clearAllMocks());

  it('exchanges a Google id token for a Firebase credential', async () => {
    (signInWithCredential as jest.Mock).mockResolvedValue({ user: { uid: 'g-1' } });
    await signInWithGoogleIdToken('the-id-token');

    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith('the-id-token');
    expect(signInWithCredential).toHaveBeenCalled();
  });

  it('exchanges an Apple identity token + nonce for a Firebase credential', async () => {
    (signInWithCredential as jest.Mock).mockResolvedValue({ user: { uid: 'a-1' } });
    await signInWithAppleIdentityToken('the-identity-token', 'the-raw-nonce');

    expect(OAuthProvider).toHaveBeenCalledWith('apple.com');
    expect(signInWithCredential).toHaveBeenCalled();
  });

  it('signs the user out', async () => {
    (signOut as jest.Mock).mockResolvedValue(undefined);
    await signOutUser();
    expect(signOut).toHaveBeenCalled();
  });
});
