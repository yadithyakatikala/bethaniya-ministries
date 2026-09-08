/**
 * Font-loading wiring for the Vespers typography -- INTENTIONALLY INERT
 * until the actual font files exist (see mobile/assets/fonts/README.md
 * for the exact list). This file must not `require()` a font file that
 * doesn't exist: Metro resolves `require()` paths statically at bundle
 * time, so a missing file breaks the build immediately, even for dead
 * code. Nothing here is imported by App.tsx yet -- ./tokens.ts's
 * `typography` already references the intended family names safely
 * (React Native falls back to the system font for an unregistered
 * family name), so every screen renders correctly right now, font files
 * or not.
 *
 * Once the files described in mobile/assets/fonts/README.md are added:
 *
 * 1. Add `expo-font` as an explicit dependency. It's already pulled in
 *    transitively by `expo` itself (see `expo`'s own package.json), so
 *    this adds no new capability, cost, or external service -- it's
 *    just not directly importable from app code until it's a direct
 *    dependency too. `npx expo install expo-font` picks the version
 *    that matches this project's Expo SDK.
 * 2. Uncomment the block below.
 * 3. In App.tsx, call `useAppFonts()` before the app's first real
 *    render and hold the splash screen / a blank view until it resolves
 *    -- the standard Expo pattern (see Expo's "Load a font" guide).
 *
 * -----------------------------------------------------------------
 * import { useFonts } from 'expo-font';
 * import { fontFamilies } from './tokens';
 *
 * const FONT_ASSETS = {
 *   [fontFamilies.headingRegular]: require('../../assets/fonts/Newsreader-Regular.ttf'),
 *   [fontFamilies.headingMedium]: require('../../assets/fonts/Newsreader-Medium.ttf'),
 *   [fontFamilies.headingSemiBold]: require('../../assets/fonts/Newsreader-SemiBold.ttf'),
 *   [fontFamilies.headingItalic]: require('../../assets/fonts/Newsreader-Italic.ttf'),
 *   [fontFamilies.interfaceRegular]: require('../../assets/fonts/Archivo-Regular.ttf'),
 *   [fontFamilies.interfaceMedium]: require('../../assets/fonts/Archivo-Medium.ttf'),
 *   [fontFamilies.interfaceSemiBold]: require('../../assets/fonts/Archivo-SemiBold.ttf'),
 *   [fontFamilies.interfaceBold]: require('../../assets/fonts/Archivo-Bold.ttf'),
 *   [fontFamilies.teluguRegular]: require('../../assets/fonts/NotoSansTelugu-Regular.ttf'),
 *   [fontFamilies.teluguSemiBold]: require('../../assets/fonts/NotoSansTelugu-SemiBold.ttf'),
 * };
 *
 * export function useAppFonts() {
 *   const [loaded, error] = useFonts(FONT_ASSETS);
 *   return { fontsReady: loaded, fontsError: error };
 * }
 * -----------------------------------------------------------------
 */
export {};
