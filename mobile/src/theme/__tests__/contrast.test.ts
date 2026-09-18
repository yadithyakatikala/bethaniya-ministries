import {
  darkTokens,
  highlightTints,
  lightTokens,
  type ThemeColors,
} from '../tokens';

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
  // ui/AppButton.tsx -- the four variants.
  { name: 'AppButton primary label', fg: 'onPrimary', bg: 'primary' },
  { name: 'AppButton primary label, pressed', fg: 'onPrimary', bg: 'primaryPressed' },
  { name: 'AppButton destructive label', fg: 'onDanger', bg: 'danger' },
  { name: 'AppButton secondary label', fg: 'primary', bg: 'paper' },
  { name: 'AppButton secondary label on a card', fg: 'primary', bg: 'surface' },
  { name: 'AppButton text-variant label, pressed', fg: 'primary', bg: 'primaryTint' },
  // ui/Badge.tsx -- M3 gave warning/error/info their own hues. They used
  // to share: `warning` and `featured` were literally the same two
  // colours, and there was no error or info variant at all.
  { name: 'Badge live', fg: 'onLive', bg: 'live' },
  { name: 'Badge success', fg: 'success', bg: 'successTint' },
  { name: 'Badge warning', fg: 'warning', bg: 'warningTint' },
  { name: 'Badge error', fg: 'danger', bg: 'dangerTint' },
  { name: 'Badge info', fg: 'info', bg: 'infoTint' },
  { name: 'Badge featured', fg: 'accent', bg: 'accentTint' },
  { name: 'Badge neutral', fg: 'inkMuted', bg: 'surfaceRaised' },
  // features/auth/HomeScreen.tsx + SignInScreen.tsx + more/MoreScreen.tsx --
  // the church monogram and the avatar initial.
  { name: 'monogram / avatar initial', fg: 'onPrimary', bg: 'primary' },
  // Body, secondary and placeholder text on every screen background.
  { name: 'body text on paper', fg: 'ink', bg: 'paper' },
  { name: 'body text on surface', fg: 'ink', bg: 'surface' },
  { name: 'body text on a raised panel', fg: 'ink', bg: 'surfaceRaised' },
  { name: 'secondary text on paper', fg: 'inkMuted', bg: 'paper' },
  { name: 'secondary text on surface', fg: 'inkMuted', bg: 'surface' },
  { name: 'secondary text on a raised panel', fg: 'inkMuted', bg: 'surfaceRaised' },
  // ui/TextField.tsx -- the brief asks for readable placeholders, and
  // before M3 there was no token for them at all.
  { name: 'placeholder on surface', fg: 'inkSubtle', bg: 'surface' },
  { name: 'placeholder on paper', fg: 'inkSubtle', bg: 'paper' },
  // features/bible/ChapterScreen.tsx verse numbers, daily-verse references.
  { name: 'accent text on paper', fg: 'accent', bg: 'paper' },
  { name: 'accent text on surface', fg: 'accent', bg: 'surface' },
  { name: 'accent text on a raised panel', fg: 'accent', bg: 'surfaceRaised' },
  // ui/ErrorState.tsx.
  { name: 'error state message', fg: 'ink', bg: 'dangerTint' },
  { name: 'primary link on surface', fg: 'primary', bg: 'surface' },
  // Solid status fills, for the places a status is the whole control.
  { name: 'solid success label', fg: 'onSuccess', bg: 'success' },
  { name: 'solid warning label', fg: 'onWarning', bg: 'warning' },
  { name: 'solid info label', fg: 'onInfo', bg: 'info' },
];

/**
 * Pairs that are NOT text and therefore answer to WCAG 1.4.11's 3:1
 * minimum for meaningful non-text UI rather than to 4.5:1.
 */
const AA_NON_TEXT = 3;
const NON_TEXT_PAIRS: { name: string; fg: keyof ThemeColors; bg: keyof ThemeColors }[] = [
  // ui/TextField.tsx's focused outline and ui/SegmentedChoice.tsx's
  // selected border. `border` deliberately does NOT appear here -- it is
  // the decorative hairline, which is why M3 split the two.
  { name: 'input outline on surface', fg: 'borderStrong', bg: 'surface' },
  { name: 'input outline on paper', fg: 'borderStrong', bg: 'paper' },
  // ui/SegmentedChoice.tsx's selected border sits on its own tinted
  // fill, so it uses `primary` rather than `borderStrong` -- the latter
  // measures only 2.7:1 there.
  { name: 'selected chip border on its own fill', fg: 'primary', bg: 'primaryTint' },
];

/**
 * A disabled control is exempt from WCAG, but the brief asks for
 * readable disabled states -- a control nobody can read is a control
 * nobody can tell is disabled rather than broken. 3:1 is the floor.
 */
const DISABLED_PAIRS: { name: string; fg: keyof ThemeColors; bg: keyof ThemeColors }[] = [
  { name: 'disabled label on its own fill', fg: 'disabledInk', bg: 'disabledSurface' },
  { name: 'disabled label on surface', fg: 'disabledInk', bg: 'surface' },
  { name: 'disabled label on paper', fg: 'disabledInk', bg: 'paper' },
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


describe.each([
  ['light', lightTokens],
  ['dark', darkTokens],
] as const)('%s palette meets 3:1 for meaningful non-text UI', (_name, tokens) => {
  it.each(NON_TEXT_PAIRS)('$name', ({ fg, bg }) => {
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});

describe.each([
  ['light', lightTokens],
  ['dark', darkTokens],
] as const)('%s palette keeps disabled states readable', (_name, tokens) => {
  it.each(DISABLED_PAIRS)('$name', ({ fg, bg }) => {
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('still reads as disabled rather than as enabled', () => {
    // If `disabledInk` were as strong as `ink`, nothing would look
    // disabled -- which is the other half of the requirement.
    expect(contrastRatio(tokens.disabledInk, tokens.surface)).toBeLessThan(
      contrastRatio(tokens.ink, tokens.surface)
    );
  });
});

describe('the decorative border is deliberately low-contrast', () => {
  it.each([
    ['light', lightTokens],
    ['dark', darkTokens],
  ] as const)('%s: border is softer than borderStrong', (_name, tokens) => {
    expect(contrastRatio(tokens.border, tokens.surface)).toBeLessThan(
      contrastRatio(tokens.borderStrong, tokens.surface)
    );
    // ...but still visible. An invisible card edge is not a card edge.
    expect(contrastRatio(tokens.border, tokens.surface)).toBeGreaterThanOrEqual(1.3);
  });
});

describe('the five status hues are distinguishable from each other', () => {
  it.each([
    ['light', lightTokens],
    ['dark', darkTokens],
  ] as const)('%s: no two status colours are the same value', (_name, tokens) => {
    // Not a contrast requirement -- a correctness one. Before M3 the
    // Badge's `warning` and `featured` variants resolved to identical
    // colours, so a warning and a pinned item looked the same.
    const statuses = {
      success: tokens.success,
      warning: tokens.warning,
      danger: tokens.danger,
      info: tokens.info,
    };
    expect(new Set(Object.values(statuses)).size).toBe(4);
    const tints = {
      success: tokens.successTint,
      warning: tokens.warningTint,
      danger: tokens.dangerTint,
      info: tokens.infoTint,
    };
    expect(new Set(Object.values(tints)).size).toBe(4);
  });
});

describe('verse highlights M4 will paint', () => {
  it.each([
    ['light', highlightTints.light, lightTokens],
    ['dark', highlightTints.dark, darkTokens],
  ] as const)('%s: body text still reads on every highlight', (_name, tints, tokens) => {
    for (const [hue, background] of Object.entries(tints)) {
      const ratio = contrastRatio(tokens.ink, background);
      expect(`${hue}: ${ratio >= AA_NORMAL_TEXT}`).toBe(`${hue}: true`);
    }
  });

  it('keeps all four highlights at one lightness, so a page keeps its rhythm', () => {
    // The documented consequence: hue alone cannot distinguish them, so
    // M4's picker must name each colour rather than show four swatches.
    for (const tints of [highlightTints.light, highlightTints.dark]) {
      const values = Object.values(tints);
      for (const a of values) {
        for (const b of values) {
          expect(contrastRatio(a, b)).toBeLessThan(1.6);
        }
      }
    }
  });
});
