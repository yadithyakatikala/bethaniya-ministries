import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { translate } from '../../../i18n';
import { fontFamilies, lightTokens } from '../../../theme';
import {
  LegalScreen,
  PRIVACY_POLICY_SECTIONS,
  TERMS_SECTIONS,
  type LegalKind,
} from '../LegalScreen';

// LegalScreen uses useTheme(), which reads PreferencesContext, which reads
// AuthContext and transitively imports services/firebase/app.ts -- mock it
// away and wrap both providers, same pattern as every other screen test
// that touches useTheme() (e.g. SettingsScreen.test.tsx).
jest.mock('../../../services/firebase/app');

/**
 * THE PRIVACY POLICY AND THE TERMS.
 *
 * The text is provisional and English only (the church's counsel has not
 * reviewed it, and there is no approved Telugu version); what is pinned here
 * is how it is PRESENTED -- real headings a screen reader can jump between,
 * a line that says the text is provisional (in the app's language), a Back
 * button -- and that the redesign changed none of the words a member is told.
 */
const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;

/** The stroke colour of every drawn (SVG) mark under a node. */
function drawnMarks(node: unknown): unknown[] {
  const { type, props, children } = node as {
    type: unknown;
    props: { stroke?: unknown };
    children?: unknown[];
  };
  const own = type === 'RNSVGSvgView' ? [props.stroke] : [];
  return [
    ...own,
    ...(children ?? []).flatMap((child) =>
      typeof child === 'string' ? [] : drawnMarks(child)
    ),
  ];
}

function renderLegal(kind: LegalKind, onBack?: () => void) {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <LegalScreen kind={kind} onBack={onBack} />
      </PreferencesProvider>
    </AuthProvider>
  );
}

afterEach(async () => {
  await AsyncStorage.clear();
});

describe('LegalScreen', () => {
  it.each([
    ['privacy', 'Privacy policy'],
    ['terms', 'Terms of service'],
  ] as const)(
    'opens the %s document with its title as a heading',
    async (kind, title) => {
      const { getByTestId } = await renderLegal(kind);
      const heading = getByTestId('legal-screen-title');
      expect(heading.props.children).toBe(title);
      expect(heading.props.accessibilityRole).toBe('header');
    }
  );

  it('sets the title in the serif at 28/36', async () => {
    const { getByTestId } = await renderLegal('privacy');
    expect(flat(getByTestId('legal-screen-title'))).toMatchObject({
      fontFamily: fontFamilies.serifEnSemiBold,
      fontSize: 28,
      lineHeight: 36,
      color: lightTokens.ink,
    });
  });

  it('says the text is provisional, in a warning-tinted line with a mark', async () => {
    const { getByTestId, getByText } = await renderLegal('privacy');
    const line = getByTestId('legal-screen-provisional');
    expect(flat(line).backgroundColor).toBe(lightTokens.warningTint);
    const words = getByText(
      'Provisional text. The church’s counsel has not reviewed it yet.'
    );
    expect(flat(words).color).toBe(lightTokens.warning);
    // A mark before the words, in the same colour: the tint is never the only thing that says "warning".
    expect(drawnMarks(line)).toEqual([lightTokens.warning]);
  });

  it('shows no copy of that developer sentence anywhere on the page', async () => {
    const { queryByText } = await renderLegal('terms');
    expect(queryByText(/replace this text before public launch/)).toBeNull();
    expect(queryByText(/not yet reviewed by counsel/)).toBeNull();
  });
});

describe('the headings are real headings', () => {
  it('makes every section’s heading a header a screen reader can jump to, and no paragraph one', async () => {
    const { getByText } = await renderLegal('privacy');
    for (const section of PRIVACY_POLICY_SECTIONS) {
      expect(getByText(section.heading as string).props.accessibilityRole).toBe('header');
      expect(getByText(section.text).props.accessibilityRole).toBeUndefined();
    }
  });

  it('gives the terms an opening paragraph with no heading of its own, then headed sections', async () => {
    const { getByTestId, getByText, queryAllByRole } = await renderLegal('terms');
    expect(TERMS_SECTIONS[0].heading).toBeNull();
    expect(getByText(TERMS_SECTIONS[0].text)).toBeTruthy();
    // The first section holds a paragraph and nothing that is a heading.
    const first = getByTestId('legal-section-0');
    expect(first.children).toHaveLength(1);
    // Headings on the page: the title plus the four headed sections.
    expect(queryAllByRole('header')).toHaveLength(1 + (TERMS_SECTIONS.length - 1));
  });

  it('lists the sections in the order they are written, one after another', async () => {
    const { getByTestId } = await renderLegal('privacy');
    const body = getByTestId('legal-screen-body');
    expect(body.children).toHaveLength(PRIVACY_POLICY_SECTIONS.length);
    PRIVACY_POLICY_SECTIONS.forEach((_, index) => {
      expect(getByTestId(`legal-section-${index}`)).toBeTruthy();
    });
  });

  it('sets a heading in the serif at 18/26 and its paragraph at 16/26', async () => {
    const { getByText } = await renderLegal('privacy');
    expect(flat(getByText('What we collect'))).toMatchObject({
      fontFamily: fontFamilies.serifEnSemiBold,
      fontSize: 18,
      lineHeight: 26,
    });
    expect(flat(getByText(PRIVACY_POLICY_SECTIONS[0].text))).toMatchObject({
      fontFamily: fontFamilies.interfaceRegular,
      fontSize: 16,
      lineHeight: 26,
    });
  });

  it('marks the English text as English, for a screen reader that would otherwise read it in the app’s language', async () => {
    const { getByText } = await renderLegal('privacy');
    expect(getByText('What we collect').props.accessibilityLanguage).toBe('en');
    expect(getByText(PRIVACY_POLICY_SECTIONS[0].text).props.accessibilityLanguage).toBe(
      'en'
    );
  });
});

describe('what a member is told has not changed', () => {
  it('has non-empty, distinct Privacy Policy and Terms content', () => {
    expect(PRIVACY_POLICY_SECTIONS.length).toBeGreaterThan(0);
    expect(TERMS_SECTIONS.length).toBeGreaterThan(0);
    const privacy = PRIVACY_POLICY_SECTIONS.map((section) => section.text).join(' ');
    const terms = TERMS_SECTIONS.map((section) => section.text).join(' ');
    expect(privacy.length).toBeGreaterThan(0);
    expect(terms.length).toBeGreaterThan(0);
    expect(privacy).not.toBe(terms);
  });

  it('keeps every section’s text', () => {
    for (const section of [...PRIVACY_POLICY_SECTIONS, ...TERMS_SECTIONS]) {
      expect(section.text.trim().length).toBeGreaterThan(20);
      if (section.heading !== null)
        expect(section.heading.trim().length).toBeGreaterThan(0);
    }
  });

  it('still says what the app does and does not do with a member’s data', () => {
    const privacy = PRIVACY_POLICY_SECTIONS.map((section) => section.text).join(' ');
    expect(privacy).toContain('We do not sell your data');
    expect(privacy).toContain('Firebase Authentication');
    expect(privacy).toContain('Firestore');
    expect(privacy).toContain('account deletion');
    expect(privacy).toContain('support email in Settings');
  });

  it('still says what a member agrees to, and that the church may suspend accounts', () => {
    const terms = TERMS_SECTIONS.map((section) => section.text).join(' ');
    expect(terms).toContain('use it respectfully');
    expect(terms).toContain('may suspend accounts');
    expect(terms).toContain('without warranty');
    expect(terms).toContain('support email in Settings');
  });

  it('has no two sections with the same heading', () => {
    for (const sections of [PRIVACY_POLICY_SECTIONS, TERMS_SECTIONS]) {
      const headings = sections.map((section) => section.heading).filter(Boolean);
      expect(new Set(headings).size).toBe(headings.length);
    }
  });
});

describe('Back', () => {
  it('has a back button, which leaves the page', async () => {
    const onBack = jest.fn();
    const { getByTestId } = await renderLegal('privacy', onBack);
    await fireEvent.press(getByTestId('top-bar-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('draws no top bar when it was given nowhere to go back to', async () => {
    const { queryByTestId } = await renderLegal('privacy');
    expect(queryByTestId('top-bar-back')).toBeNull();
  });
});

describe('under a Telugu interface', () => {
  it('titles the page in Telugu, and says in Telugu that the text is provisional and English only', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId, getByText } = await renderLegal('privacy');
    await waitFor(() =>
      expect(getByTestId('legal-screen-title').props.children).toBe(
        translate('te', 'settings.privacyPolicy')
      )
    );
    expect(
      getByText(
        `${translate('te', 'legal.provisional')} ${translate('te', 'legal.englishOnly')}`
      )
    ).toBeTruthy();
    expect(flat(getByTestId('legal-screen-title'))).toMatchObject({
      fontSize: 25,
      lineHeight: 40,
    });
  });

  it('keeps the document itself English -- its headings and paragraphs are not translated, and keep their English faces', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByText, getByTestId } = await renderLegal('terms');
    await waitFor(() =>
      expect(getByTestId('legal-screen-title').props.children).toBe(
        translate('te', 'settings.terms')
      )
    );
    expect(flat(getByText('Accounts')).fontFamily).toBe(fontFamilies.serifEnSemiBold);
    expect(flat(getByText(TERMS_SECTIONS[2].text)).fontFamily).toBe(
      fontFamilies.interfaceRegular
    );
  });

  it('does not add the English-only sentence under an English interface', async () => {
    const { queryByText } = await renderLegal('privacy');
    expect(queryByText(/English only/)).toBeNull();
  });
});
