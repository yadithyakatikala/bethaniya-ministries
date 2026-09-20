/**
 * The app's identity, pinned -- M6 BUG 2 and BUG 3.
 *
 * =====================================================================
 * WHAT THIS FILE IS FOR
 * =====================================================================
 * The reported bug was "changing the theme changes the app's name and
 * icon". No runtime code does that, and none could: nothing in src/ reads
 * or writes app.json, and Android's launcher label and icon are baked into
 * the APK at build time. Two real causes were found instead, and this file
 * exists so neither can come back unnoticed.
 *
 * ---------------------------------------------------------------------
 * CAUSE 1 -- THE ICON REALLY DID FOLLOW A THEME. JUST NOT THIS APP'S.
 * ---------------------------------------------------------------------
 * `android.adaptiveIcon.monochromeImage` opts an app into Android 13+
 * THEMED ICONS. When a launcher has themed icons turned on, it discards
 * the real icon and draws the monochrome layer instead, tinted to the
 * SYSTEM theme -- so the icon genuinely changes appearance when the phone
 * switches between light and dark, which is indistinguishable from the app
 * doing it.
 *
 * It was worse than a mismatch. This app's icon is a photograph, and the
 * monochrome layer derived from it was a faint outline sketch -- once
 * tinted, a nearly invisible scribble. A photograph has no silhouette to
 * reduce to, so there is no good monochrome layer to be had. The opt-in is
 * therefore removed rather than redrawn: with no monochrome layer, every
 * launcher shows the real adaptive icon in every system theme.
 * (assets/android-icon-monochrome.png is left in place, unreferenced --
 * deleting artwork is the owner's call, not this milestone's.)
 *
 * ---------------------------------------------------------------------
 * CAUSE 2 -- A STALE NATIVE PROJECT, WHICH IS WHERE THE NAME CAME FROM
 * ---------------------------------------------------------------------
 * `expo.name` has read 'Maranatha' since M0, and that is what the launcher
 * label is generated from. But mobile/android/ is gitignored, generated,
 * and NOT overwritten by a plain `expo prebuild` -- so a native project
 * generated before the M0 rename keeps the old label and the old icons in
 * its res/ folder forever, and every later build ships them. /DEPLOYMENT.md
 * used to instruct exactly that ("run prebuild exactly once ... don't run
 * it again"), which was sound when the signing configuration was a manual
 * edit to build.gradle and is not now that plugins/withReleaseSigning.js
 * applies it on every prebuild. That instruction is corrected there.
 *
 * ---------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT CHANGED
 * ---------------------------------------------------------------------
 * Every technical identifier keeps its V1 value -- the Android package,
 * the iOS bundle identifier, the Expo slug, the deep-link schemes. They
 * are plumbing, and changing one orphans existing installs and accounts.
 * They are asserted below precisely so a future rename cannot quietly take
 * them with it. See ../theme/brand.ts.
 */
import appJson from '../../app.json';
import { PRODUCT_NAME } from '../theme/brand';

const { expo } = appJson;

describe('the app is called what the app says it is called', () => {
  it('ships the M0 product name as the launcher label', () => {
    expect(expo.name).toBe('Maranatha');
  });

  it('uses the same name the interface does, from one source', () => {
    // A build whose launcher label and Home screen disagree is how the
    // original "the app renamed itself" report starts.
    expect(expo.name).toBe(PRODUCT_NAME);
  });
});

describe('the launcher icon cannot follow any theme', () => {
  it('declares no monochrome layer, so themed icons never replace it', () => {
    // THE regression this file exists for. Re-adding this key hands the
    // launcher permission to recolour the icon with the system theme.
    expect(expo.android.adaptiveIcon).not.toHaveProperty('monochromeImage');
  });

  it('still ships the M0 adaptive icon, both layers', () => {
    expect(expo.android.adaptiveIcon.foregroundImage).toBe(
      './assets/android-icon-foreground.png'
    );
    expect(expo.android.adaptiveIcon.backgroundImage).toBe(
      './assets/android-icon-background.png'
    );
    expect(expo.icon).toBe('./assets/icon.png');
  });

  it('has no light/dark variant of the icon anywhere in the config', () => {
    // Expo can express a per-scheme icon. The app must not: the icon is
    // branding, and branding does not have a night mode.
    const config = JSON.stringify(appJson);
    expect(config).not.toContain('monochromeImage');
    expect(expo.icon).not.toEqual(expect.objectContaining({ dark: expect.anything() }));
  });
});

describe('the technical identifiers are not branding and do not move', () => {
  it('keeps the V1 Android package and iOS bundle identifier', () => {
    expect(expo.android.package).toBe('com.bethaniyaministries.app');
    expect(expo.ios.bundleIdentifier).toBe('com.bethaniyaministries.app');
  });

  it('keeps the V1 Expo slug and deep-link schemes', () => {
    expect(expo.slug).toBe('bethaniya-ministries');
    expect(expo.scheme).toEqual(['bethaniyaministries', 'com.bethaniyaministries.app']);
  });
});
