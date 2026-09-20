/**
 * What "a completed profile" means, and what counts as a valid answer.
 *
 * =====================================================================
 * WHY THIS IS A MODULE AND NOT A FEW LINES IN THE SCREEN
 * =====================================================================
 * Three different places have to agree about it: the gate that decides
 * whether to show onboarding at all, the form that validates what the
 * member types, and the Profile screen that lets them change the answers
 * later. Three copies of "is this a plausible phone number" is how the
 * gate and the form end up disagreeing and a member gets stuck on a
 * screen that will not accept anything.
 *
 * Everything here is pure -- no Firestore, no React -- so the rules can
 * be tested as rules.
 *
 * =====================================================================
 * COMPLETION IS A MARKER, NOT AN INFERENCE
 * =====================================================================
 * `isProfileComplete` asks one question: has the member been through the
 * questionnaire? It does NOT re-derive that from whether the four
 * answers are currently filled in. Inferring it would mean a member who
 * later cleared their phone number in Profile got dragged back through
 * onboarding, and it would leave anyone whose answers the church cannot
 * use permanently trapped. See ../../services/firebase/userProfile.ts's
 * `profileCompletedAt`.
 */
import type {
  Gender,
  LanguagePreference,
  UserProfile,
} from '../../services/firebase/userProfile';

/** The two values the church asked to collect. Order is the display order. */
export const GENDERS: readonly Gender[] = ['male', 'female'];

/** The two app languages. NOT the Bible modes -- there is no bilingual
 *  interface, and this choice never touches the Bible. */
export const ONBOARDING_LANGUAGES: readonly LanguagePreference[] = ['en', 'te'];

export const MAX_NAME_LENGTH = 200;

/**
 * A plausible phone number, deliberately loose.
 *
 * NO SMS IS EVER SENT. There is no OTP, no verification, no carrier
 * lookup -- this is a number the church can ring, typed by a person, and
 * the only failure worth catching is an obvious typo. So: strip the
 * punctuation people actually use, allow one leading '+', and require a
 * length that fits real numbers. Ten digits covers an Indian mobile,
 * seven is the shortest plausible landline, and fifteen is E.164's
 * maximum, so anything outside that range is a mistake rather than a
 * number this app has not heard of.
 *
 * It deliberately does NOT enforce a country code, a leading zero, or an
 * Indian prefix. A congregation has relatives abroad.
 */
export const MIN_PHONE_DIGITS = 7;
export const MAX_PHONE_DIGITS = 15;

/** Everything a person might type between the digits. */
const PHONE_PUNCTUATION = /[\s\-().]/g;

/**
 * The number as it will be stored: punctuation removed, a leading '+'
 * kept. Stored normalized so two members who typed the same number in
 * different styles are not two different numbers in the church's records.
 */
export function normalizePhoneNumber(input: string): string {
  const trimmed = input.trim().replace(PHONE_PUNCTUATION, '');
  return trimmed.startsWith('+')
    ? `+${trimmed.slice(1).replace(/\D/g, '')}`
    : trimmed.replace(/\D/g, '');
}

export function isValidPhoneNumber(input: string): boolean {
  const normalized = normalizePhoneNumber(input);
  const digits = normalized.startsWith('+') ? normalized.slice(1) : normalized;
  if (digits.length === 0) return false;
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
}

/** A name is a name: not blank, not a novel. The same 1..200 bound
 *  firestore.rules enforces, so the form can never offer to save
 *  something the server will refuse. */
export function isValidFullName(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH;
}

export function isGender(value: unknown): value is Gender {
  return value === 'male' || value === 'female';
}

export function isOnboardingLanguage(value: unknown): value is LanguagePreference {
  return value === 'en' || value === 'te';
}

/**
 * Has this member already been through onboarding?
 *
 * `undefined` means the profile has not loaded yet and `null` means there
 * is no profile document; neither is an answer, so both are treated as
 * "do not know" by the gate rather than as "no" -- showing the
 * questionnaire to someone whose profile simply has not arrived yet would
 * be the fastest way to make a returning member fill it in twice.
 */
export function isProfileComplete(profile: UserProfile | null | undefined): boolean {
  return Boolean(profile?.profileCompletedAt);
}

/**
 * What to put in the form before the member types anything.
 *
 * A Google sign-in already carries a name, and some accounts already
 * carry a phone number. Making someone retype what the app was just told
 * is the kind of thing that makes a questionnaire feel like a toll gate.
 * The language starts at whatever the app is already showing, which is
 * the one they have been reading since they opened it.
 */
export function onboardingDefaults(options: {
  profile: UserProfile | null | undefined;
  authDisplayName: string | null | undefined;
  authPhoneNumber: string | null | undefined;
  appLanguage: LanguagePreference;
}): {
  fullName: string;
  phoneNumber: string;
  gender: Gender | null;
  preferredLanguage: LanguagePreference;
} {
  const { profile, authDisplayName, authPhoneNumber, appLanguage } = options;
  return {
    fullName: profile?.displayName ?? authDisplayName ?? '',
    phoneNumber: profile?.phoneNumber ?? authPhoneNumber ?? '',
    gender: profile?.gender ?? null,
    preferredLanguage: profile?.appLanguage ?? appLanguage,
  };
}
