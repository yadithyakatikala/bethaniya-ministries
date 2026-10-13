import { COUNTRIES, DEFAULT_COUNTRY_ISO, countryByIso } from '../countries';
import {
  countryOfE164,
  formatNational,
  isValidPhoneInput,
  readPhone,
  splitStoredPhone,
} from '../phone';

const india = countryByIso('IN');
const us = countryByIso('US');
const uae = countryByIso('AE');

/**
 * Writing a phone number down. No SMS is ever sent and nothing here
 * touches a network: these are the rules by which what a person typed
 * becomes the string the church keeps.
 */
describe('the country list', () => {
  it('starts at India, where the church is', () => {
    expect(DEFAULT_COUNTRY_ISO).toBe('IN');
    expect(COUNTRIES[0].iso).toBe('IN');
    expect(COUNTRIES[0].dial).toBe('91');
  });

  it('has a unique id per country, digits-only codes, and both languages for every name', () => {
    const isos = COUNTRIES.map((c) => c.iso);
    expect(new Set(isos).size).toBe(isos.length);
    for (const c of COUNTRIES) {
      expect(c.dial).toMatch(/^\d{1,3}$/);
      expect(c.name.en.length).toBeGreaterThan(1);
      expect(c.name.te.length).toBeGreaterThan(1);
    }
  });

  it('falls back to India for an unknown id rather than crashing', () => {
    expect(countryByIso('ZZ').iso).toBe('IN');
  });
});

describe('an Indian number', () => {
  it('is ten digits, written however people write it', () => {
    for (const typed of ['9876543210', '98765 43210', '98765-43210', '(98765) 43210']) {
      expect(readPhone(typed, india)).toEqual({ e164: '+919876543210', problem: null });
    }
  });

  it('may carry the trunk zero, which is dropped', () => {
    expect(readPhone('09876543210', india).e164).toBe('+919876543210');
  });

  it('is rejected when it is nine or eleven digits', () => {
    expect(readPhone('987654321', india)).toEqual({ e164: null, problem: 'tooShort' });
    expect(readPhone('98765432101', india)).toEqual({ e164: null, problem: 'tooLong' });
  });

  it('takes the numerals a Telugu keyboard types', () => {
    expect(readPhone('౯౮౭౬౫౪౩౨౧౦', india).e164).toBe('+919876543210');
  });
});

describe('a number from somewhere else', () => {
  it('gets the selected country code in front', () => {
    expect(readPhone('415 555 0132', us)).toEqual({
      e164: '+14155550132',
      problem: null,
    });
    expect(readPhone('50 123 4567', uae)).toEqual({
      e164: '+971501234567',
      problem: null,
    });
  });

  it('is rejected when it is too short or would pass the E.164 limit of 15 digits', () => {
    expect(readPhone('12345', us)).toEqual({ e164: null, problem: 'tooShort' });
    // +1 plus 14 digits is 15 digits in all (fine); plus 15 is not.
    expect(readPhone('1'.repeat(14), us).problem).toBeNull();
    expect(readPhone('1'.repeat(15), us)).toEqual({ e164: null, problem: 'tooLong' });
  });
});

describe('a number typed with its own "+"', () => {
  it('is a complete international number: the selected country is ignored', () => {
    expect(readPhone('+44 20 7946 0958', india)).toEqual({
      e164: '+442079460958',
      problem: null,
    });
    expect(readPhone('+91 98765 43210', us).e164).toBe('+919876543210');
  });

  it('still has to be a plausible length', () => {
    expect(readPhone('+12345', india)).toEqual({ e164: null, problem: 'tooShort' });
    expect(readPhone('+' + '9'.repeat(16), india)).toEqual({
      e164: null,
      problem: 'tooLong',
    });
    expect(readPhone('+', india)).toEqual({ e164: null, problem: 'empty' });
  });
});

describe('what is not a number', () => {
  it('is empty, or contains letters', () => {
    expect(readPhone('', india)).toEqual({ e164: null, problem: 'empty' });
    expect(readPhone('   ', india)).toEqual({ e164: null, problem: 'empty' });
    expect(readPhone('98765 4321O', india)).toEqual({ e164: null, problem: 'invalid' });
    expect(readPhone('call me', india)).toEqual({ e164: null, problem: 'invalid' });
    expect(isValidPhoneInput('abc', india)).toBe(false);
    expect(isValidPhoneInput('9876543210', india)).toBe(true);
  });
});

describe('reading a stored number back for the form', () => {
  it('splits an E.164 number into its country and the part the member types', () => {
    expect(splitStoredPhone('+919876543210')).toEqual({
      countryIso: 'IN',
      national: '9876543210',
    });
    expect(splitStoredPhone('+971501234567')).toEqual({
      countryIso: 'AE',
      national: '501234567',
    });
    // +1 is shared; the first country in the list stands for all of them.
    expect(splitStoredPhone('+14155550132')).toEqual({
      countryIso: 'US',
      national: '4155550132',
    });
  });

  it('prefers the longest matching code', () => {
    // +971 (UAE), not +9 anything shorter.
    expect(countryOfE164('+971501234567')?.iso).toBe('AE');
    expect(countryOfE164('+353861234567')?.iso).toBe('IE');
  });

  it('treats a number stored before country codes as Indian', () => {
    expect(splitStoredPhone('9876543210')).toEqual({
      countryIso: 'IN',
      national: '9876543210',
    });
    expect(splitStoredPhone('98765 43210')).toEqual({
      countryIso: 'IN',
      national: '9876543210',
    });
  });

  it('keeps a number with a code the list does not have, whole, so nothing is lost', () => {
    expect(splitStoredPhone('+99912345678')).toEqual({
      countryIso: 'IN',
      national: '+99912345678',
    });
  });

  it('starts empty when there is nothing stored', () => {
    expect(splitStoredPhone(null)).toEqual({ countryIso: 'IN', national: '' });
    expect(splitStoredPhone(undefined)).toEqual({ countryIso: 'IN', national: '' });
    expect(splitStoredPhone('  ')).toEqual({ countryIso: 'IN', national: '' });
  });

  it('round-trips: what is stored reads back as what was typed', () => {
    const typed = readPhone('415 555 0132', us).e164!;
    const back = splitStoredPhone(typed);
    expect(readPhone(back.national, countryByIso(back.countryIso)).e164).toBe(typed);
  });

  it('formats an Indian number in the usual 5+5 grouping, and leaves others alone', () => {
    expect(formatNational('9876543210', india)).toBe('98765 43210');
    expect(formatNational('4155550132', us)).toBe('4155550132');
  });
});
