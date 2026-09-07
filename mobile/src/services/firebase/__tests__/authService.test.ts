import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
  signOut,
} from 'firebase/auth';
import {
  confirmPhoneCode,
  signInWithAppleIdentityToken,
  signInWithGoogleIdToken,
  signOutUser,
  startPhoneSignIn,
} from '../authService';

jest.mock('../app');

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

  it('starts phone sign-in with an emulator-mode application verifier', async () => {
    (signInWithPhoneNumber as jest.Mock).mockResolvedValue({ confirm: jest.fn() });
    await startPhoneSignIn('+15555550123');

    expect(signInWithPhoneNumber).toHaveBeenCalledWith(
      expect.anything(),
      '+15555550123',
      expect.objectContaining({ type: 'recaptcha' })
    );
  });

  it('confirms a phone code against the given ConfirmationResult', async () => {
    const confirm = jest.fn().mockResolvedValue({ user: { uid: 'p-1' } });
    await confirmPhoneCode({ confirm } as never, '123456');
    expect(confirm).toHaveBeenCalledWith('123456');
  });

  it('signs the user out', async () => {
    (signOut as jest.Mock).mockResolvedValue(undefined);
    await signOutUser();
    expect(signOut).toHaveBeenCalled();
  });
});
