import { getPhoneApplicationVerifier } from '../emulatorRecaptchaVerifier';

jest.mock('../app', () => ({ usingFirebaseEmulators: true }));

describe('getPhoneApplicationVerifier (emulator mode)', () => {
  it('returns a verifier satisfying the ApplicationVerifier interface', async () => {
    const verifier = getPhoneApplicationVerifier();
    expect(verifier.type).toBe('recaptcha');
    await expect(verifier.verify()).resolves.toEqual(expect.any(String));
  });
});

describe('getPhoneApplicationVerifier (non-emulator / real backend)', () => {
  it('refuses to hand out the emulator-only stub against a real Firebase backend', async () => {
    jest.resetModules();
    jest.doMock('../app', () => ({ usingFirebaseEmulators: false }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must re-require after jest.resetModules() to pick up the new mock
    const reloaded = require('../emulatorRecaptchaVerifier');
    expect(() => reloaded.getPhoneApplicationVerifier()).toThrow(/not yet implemented/);
  });
});
