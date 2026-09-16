import { darkTokens, lightTokens, type ThemeColors } from '../tokens';

/**
 * Real WCAG 2.1 contrast arithmetic over the foreground/background pairs
 * the app actually paints, in both palettes.
 *
 * WHY THIS EXISTS. The final UI/UX pass found that several places painted
 * a hardcoded '#FFFFFF' onto a themed surface. That reads fine in light
 * mode, where `primary`, `live` and `danger` are dark, and is close to
 * illegible in dark mode, where all three are LIGHT (a sage and two
 * corals). The worst case was AppButton -- the primitive behind every
 * screen's main call to action -- at 2.04:1 against its own background.
 *
 * Asserting "AppButton uses colors.onPrimary" would only restate the
 * implementation. Computing the ratio is what actually catches the next
 * person who adds a palette colour, or retunes an existing one, without
 * checking whether the text on it still reads. Every pair below is a real
 * pairing somewhere in src/ -- see the comment on each.
 *
 * 4.5:1 is the WCAG 2.1 AA minimum for normal-size text. Nothing in this
 * app renders its on-colour text at the >=18.66px that would qualify for
 * the relaxed 3:1 large-text threshold, so one threshold covers all of it.
 */
const AA_NORMAL_TEXT = 4.5;

/** Relative luminance, per WCAG 2.1's definition. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Every [foreground, background] pairing the UI puts text into. */
const PAIRS: { name: string; fg: keyof ThemeColors; bg: keyof ThemeColors }[] = [
  // ui/AppButton.tsx -- primary and destructive variants.
  { name: 'AppButton primary label', fg: 'onPrimary', bg: 'primary' },
  { name: 'AppButton primary label, pressed', fg: 'onPrimary', bg: 'primaryPressed' },
  { name: 'AppButton destructive label', fg: 'onDanger', bg: 'danger' },
  { name: 'AppButton secondary label', fg: 'primary', bg: 'paper' },
  // ui/Badge.tsx -- the six variants.
  { name: 'Badge live', fg: 'onLive', bg: 'live' },
  { name: 'Badge success', fg: 'primaryPressed', bg: 'primaryTint' },
  { name: 'Badge draft/neutral', fg: 'inkMuted', bg: 'surfaceRaised' },
  { name: 'Badge featured/warning', fg: 'accent', bg: 'liveTint' },
  // features/auth/HomeScreen.tsx + SignInScreen.tsx + more/MoreScreen.tsx --
  // the church monogram and the avatar initial.
  { name: 'monogram / avatar initial', fg: 'onPrimary', bg: 'primary' },
  // features/events/* -- the LIVE badge and its "Watch live" call to action.
  { name: 'LIVE badge text', fg: 'onLive', bg: 'live' },
  { name: 'live CTA label', fg: 'live', bg: 'onLive' },
  // features/songs/SongDetailScreen.tsx -- the favourited pill.
  { name: 'favourited pill label', fg: 'onPrimary', bg: 'accent' },
  { name: 'unfavourited pill label', fg: 'accent', bg: 'surface' },
  // Body and secondary text on every screen background.
  { name: 'body text on paper', fg: 'ink', bg: 'paper' },
  { name: 'body text on surface', fg: 'ink', bg: 'surface' },
  { name: 'secondary text on paper', fg: 'inkMuted', bg: 'paper' },
  { name: 'secondary text on surface', fg: 'inkMuted', bg: 'surface' },
  // features/bible/ChapterScreen.tsx verse numbers, daily-verse references.
  { name: 'accent text on paper', fg: 'accent', bg: 'paper' },
  { name: 'accent text on surface', fg: 'accent', bg: 'surface' },
  // Error banners -- SignInScreen.tsx and the shared error states.
  { name: 'error banner text', fg: 'danger', bg: 'liveTint' },
  { name: 'primary link on surface', fg: 'primary', bg: 'surface' },
];

describe.each([
  ['light', lightTokens],
  ['dark', darkTokens],
] as const)('%s palette meets WCAG AA for normal text', (_paletteName, tokens) => {
  it.each(PAIRS)('$name', ({ fg, bg }) => {
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT
    );
  });
});

describe('the on- tokens exist precisely because white is not always right', () => {
  it('uses white on the light palette, where primary/live/danger are dark', () => {
    expect(lightTokens.onPrimary).toBe('#FFFFFF');
    expect(lightTokens.onLive).toBe('#FFFFFF');
    expect(lightTokens.onDanger).toBe('#FFFFFF');
  });

  it('does NOT use white on the dark palette, where they are light', () => {
    // This is the regression the tokens were introduced for. If someone
    // "simplifies" these back to white, the pairs above fail -- this test
    // just names the reason.
    for (const token of [
      darkTokens.onPrimary,
      darkTokens.onLive,
      darkTokens.onDanger,
    ]) {
      expect(token).not.toBe('#FFFFFF');
      expect(contrastRatio(token, darkTokens.paper)).toBeLessThan(2);
    }
  });

  it('would fail AA if white were painted on the dark palette', () => {
    // Proves the test above has teeth: these are the ratios that shipped
    // before this pass.
    expect(contrastRatio('#FFFFFF', darkTokens.primary)).toBeLessThan(AA_NORMAL_TEXT);
    expect(contrastRatio('#FFFFFF', darkTokens.live)).toBeLessThan(AA_NORMAL_TEXT);
    expect(contrastRatio('#FFFFFF', darkTokens.danger)).toBeLessThan(AA_NORMAL_TEXT);
  });
});
