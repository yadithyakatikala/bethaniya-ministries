/**
 * The country calling codes the phone question offers.
 *
 * "International where practical": a congregation has relatives and
 * members abroad -- the Gulf, the UK, North America, Australia -- so the
 * number is asked WITH its country, defaulting to India. A short, curated
 * list rather than all ~240 codes: nobody should scroll a thousand-row
 * picker to find +91, and a code that is not here can still be entered by
 * typing the number with its own leading "+" (see ./phone.ts).
 *
 * Names are shown in the app language. THE TELUGU NAMES ARE DRAFTS and are
 * pending review by a Telugu speaker, like every Telugu string in the app
 * -- see /docs/TELUGU_REVIEW.md.
 *
 * Nothing here is sent anywhere. The code only decides how the number the
 * member typed is written down.
 */
export interface Country {
  /** ISO 3166-1 alpha-2, the picker's identity (several countries share +1). */
  iso: string;
  /** Digits only, no "+". */
  dial: string;
  name: { en: string; te: string };
}

export const COUNTRIES: readonly Country[] = [
  { iso: 'IN', dial: '91', name: { en: 'India', te: 'భారతదేశం' } },
  {
    iso: 'US',
    dial: '1',
    name: { en: 'United States', te: 'అమెరికా సంయుక్త రాష్ట్రాలు' },
  },
  { iso: 'CA', dial: '1', name: { en: 'Canada', te: 'కెనడా' } },
  { iso: 'GB', dial: '44', name: { en: 'United Kingdom', te: 'యునైటెడ్ కింగ్‌డమ్' } },
  {
    iso: 'AE',
    dial: '971',
    name: { en: 'United Arab Emirates', te: 'యునైటెడ్ అరబ్ ఎమిరేట్స్' },
  },
  { iso: 'SA', dial: '966', name: { en: 'Saudi Arabia', te: 'సౌదీ అరేబియా' } },
  { iso: 'QA', dial: '974', name: { en: 'Qatar', te: 'ఖతార్' } },
  { iso: 'KW', dial: '965', name: { en: 'Kuwait', te: 'కువైట్' } },
  { iso: 'OM', dial: '968', name: { en: 'Oman', te: 'ఒమన్' } },
  { iso: 'BH', dial: '973', name: { en: 'Bahrain', te: 'బహ్రెయిన్' } },
  { iso: 'SG', dial: '65', name: { en: 'Singapore', te: 'సింగపూర్' } },
  { iso: 'MY', dial: '60', name: { en: 'Malaysia', te: 'మలేషియా' } },
  { iso: 'AU', dial: '61', name: { en: 'Australia', te: 'ఆస్ట్రేలియా' } },
  { iso: 'NZ', dial: '64', name: { en: 'New Zealand', te: 'న్యూజిలాండ్' } },
  { iso: 'DE', dial: '49', name: { en: 'Germany', te: 'జర్మనీ' } },
  { iso: 'FR', dial: '33', name: { en: 'France', te: 'ఫ్రాన్స్' } },
  { iso: 'IE', dial: '353', name: { en: 'Ireland', te: 'ఐర్లాండ్' } },
  { iso: 'IT', dial: '39', name: { en: 'Italy', te: 'ఇటలీ' } },
  { iso: 'NL', dial: '31', name: { en: 'Netherlands', te: 'నెదర్లాండ్స్' } },
  { iso: 'ZA', dial: '27', name: { en: 'South Africa', te: 'దక్షిణాఫ్రికా' } },
  { iso: 'KE', dial: '254', name: { en: 'Kenya', te: 'కెన్యా' } },
  { iso: 'NG', dial: '234', name: { en: 'Nigeria', te: 'నైజీరియా' } },
  { iso: 'LK', dial: '94', name: { en: 'Sri Lanka', te: 'శ్రీలంక' } },
  { iso: 'NP', dial: '977', name: { en: 'Nepal', te: 'నేపాల్' } },
  { iso: 'BD', dial: '880', name: { en: 'Bangladesh', te: 'బంగ్లాదేశ్' } },
  { iso: 'PK', dial: '92', name: { en: 'Pakistan', te: 'పాకిస్తాన్' } },
  { iso: 'JP', dial: '81', name: { en: 'Japan', te: 'జపాన్' } },
  { iso: 'KR', dial: '82', name: { en: 'South Korea', te: 'దక్షిణ కొరియా' } },
  { iso: 'HK', dial: '852', name: { en: 'Hong Kong', te: 'హాంకాంగ్' } },
];

/** Where the church is, and so where the picker starts. */
export const DEFAULT_COUNTRY_ISO = 'IN';

export function countryByIso(iso: string): Country {
  return COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0];
}
