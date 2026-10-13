/**
 * Writing a phone number down.
 *
 * The question is asked as a country and a number, and stored as ONE
 * string in E.164 form -- "+919876543210" -- so the church's records hold
 * a number that can be dialled from anywhere, and two members who typed
 * the same number in different styles are not two different numbers.
 *
 * NO SMS IS EVER SENT. There is no OTP, no verification, no carrier
 * lookup and no network call in here; this is a number the church can ring,
 * typed by a person, and the only failure worth catching is an obvious
 * typo. Everything is pure so the rules can be tested as rules.
 *
 * Validation is deliberately loose outside India (E.164's own limits:
 * 15 digits in all) and exact inside it, where nearly everyone is: an
 * Indian number is ten digits once a leading trunk "0" is dropped.
 */
import { COUNTRIES, DEFAULT_COUNTRY_ISO, countryByIso, type Country } from './countries';
import { toAsciiDigits } from './digits';

/** E.164: at most 15 digits, country code included. */
export const MAX_E164_DIGITS = 15;
/** The shortest plausible national number outside India. */
export const MIN_NATIONAL_DIGITS = 6;
export const INDIA_NATIONAL_DIGITS = 10;

const PUNCTUATION = /[\s\-().]/g;

/**
 * Digits of `input`, ignoring the punctuation people actually type.
 * Telugu, Devanagari and Arabic-Indic numerals count as the digits they are.
 */
function digitsOf(input: string): string {
  return toAsciiDigits(input).replace(PUNCTUATION, '').replace(/\D/g, '');
}

/** The national digits for `country`, with a single leading trunk "0" dropped. */
function nationalDigits(input: string): string {
  const digits = digitsOf(input);
  return digits.length > 1 && digits.startsWith('0') ? digits.slice(1) : digits;
}

/** True when the person typed a full international number ("+44 ..."). */
function isInternational(input: string): boolean {
  return input.trim().startsWith('+');
}

export type PhoneProblem = 'empty' | 'tooShort' | 'tooLong' | 'invalid';

export interface PhoneResult {
  /** "+919876543210", or null when `problem` is set. */
  e164: string | null;
  problem: PhoneProblem | null;
}

/**
 * Validates and normalises what the person typed.
 *
 *   * typed with a leading "+" -> treated as a complete international
 *     number and the selected country is ignored;
 *   * otherwise -> `country`'s code is put in front.
 */
export function readPhone(input: string, country: Country): PhoneResult {
  if (input.trim() === '') return { e164: null, problem: 'empty' };

  if (isInternational(input)) {
    const digits = digitsOf(input);
    if (digits.length === 0) return { e164: null, problem: 'empty' };
    // A "+" number must at least have a country code and a short number.
    if (digits.length < 7) return { e164: null, problem: 'tooShort' };
    if (digits.length > MAX_E164_DIGITS) return { e164: null, problem: 'tooLong' };
    return { e164: `+${digits}`, problem: null };
  }

  if (/[^\d\s\-().]/.test(toAsciiDigits(input)))
    return { e164: null, problem: 'invalid' };
  const national = nationalDigits(input);
  if (national.length === 0) return { e164: null, problem: 'empty' };

  if (country.dial === '91') {
    if (national.length < INDIA_NATIONAL_DIGITS)
      return { e164: null, problem: 'tooShort' };
    if (national.length > INDIA_NATIONAL_DIGITS)
      return { e164: null, problem: 'tooLong' };
  } else {
    if (national.length < MIN_NATIONAL_DIGITS) return { e164: null, problem: 'tooShort' };
    if (country.dial.length + national.length > MAX_E164_DIGITS) {
      return { e164: null, problem: 'tooLong' };
    }
  }
  return { e164: `+${country.dial}${national}`, problem: null };
}

export function isValidPhoneInput(input: string, country: Country): boolean {
  return readPhone(input, country).problem === null;
}

/** The country whose code a stored "+..." number starts with (longest code wins). */
export function countryOfE164(e164: string): Country | null {
  const digits = e164.replace(/\D/g, '');
  let best: Country | null = null;
  for (const c of COUNTRIES) {
    if (digits.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) {
      best = c;
    }
  }
  return best;
}

/**
 * Splits a stored number back into the country and the national part the
 * form shows, for prefilling.
 *
 *   "+919876543210" -> India, "9876543210"
 *   "9876543210"    -> India, "9876543210"   (stored before country codes)
 *   "+14155550123"  -> United States, "4155550123"
 *   "+99912345678"  -> India, "+99912345678" (a code not in the list: kept
 *                      whole, with its own "+", so nothing is lost)
 */
export function splitStoredPhone(stored: string | null | undefined): {
  countryIso: string;
  national: string;
} {
  const value = (stored ?? '').trim();
  if (value === '') return { countryIso: DEFAULT_COUNTRY_ISO, national: '' };
  if (!value.startsWith('+')) {
    return { countryIso: DEFAULT_COUNTRY_ISO, national: digitsOf(value) };
  }
  const country = countryOfE164(value);
  if (!country)
    return { countryIso: DEFAULT_COUNTRY_ISO, national: `+${digitsOf(value)}` };
  // Several countries share +1; the first in the list (the US) stands for them.
  const national = value.replace(/\D/g, '').slice(country.dial.length);
  return { countryIso: country.iso, national };
}

/** "+91 98765 43210"-style display for an already-valid number. Purely cosmetic. */
export function formatNational(national: string, country: Country): string {
  const d = digitsOf(national);
  if (country.dial === '91' && d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return d;
}

export { countryByIso };
