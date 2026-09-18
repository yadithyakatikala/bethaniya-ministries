/**
 * Loading the bundled typefaces.
 *
 * All eight faces are real files in mobile/assets/fonts, fetched and
 * verified by scripts/fetch-fonts.py -- see that script for the pinned
 * sources, the asserted SHA-256 of each upstream file, the SIL Open Font
 * License 1.1 terms, and the coverage measurements that chose these
 * families over the ones V1's prototype named.
 *
 * ---------------------------------------------------------------------
 * WHY THE APP STILL RENDERS IF THIS FAILS
 * ---------------------------------------------------------------------
 * `useAppFonts()` reports `ready` when loading has SETTLED, not when it
 * has succeeded. A font that fails to register leaves React Native
 * falling back to the platform system font for that family name, which
 * is exactly what the whole app looked like before M3 -- readable, just
 * unbranded. Blocking the app behind a font is the wrong trade for a
 * congregation that wants to read scripture, so a failure is logged and
 * the app proceeds.
 *
 * There is no network call here and nothing to download at runtime:
 * `require()` resolves these at bundle time, so the files ship inside
 * the binary and "loading" is registering them with the platform.
 */
import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { fontFamilies } from './tokens';

const FONT_ASSETS: Record<string, number> = {
  [fontFamilies.interfaceRegular]: require('../../assets/fonts/HindGuntur-Regular.ttf'),
  [fontFamilies.interfaceMedium]: require('../../assets/fonts/HindGuntur-Medium.ttf'),
  [fontFamilies.interfaceSemiBold]: require('../../assets/fonts/HindGuntur-SemiBold.ttf'),
  [fontFamilies.interfaceBold]: require('../../assets/fonts/HindGuntur-Bold.ttf'),
  [fontFamilies.serifEnRegular]: require('../../assets/fonts/NotoSerif-Regular.ttf'),
  [fontFamilies.serifEnSemiBold]: require('../../assets/fonts/NotoSerif-SemiBold.ttf'),
  [fontFamilies.serifTeRegular]: require('../../assets/fonts/NotoSerifTelugu-Regular.ttf'),
  [fontFamilies.serifTeSemiBold]: require('../../assets/fonts/NotoSerifTelugu-SemiBold.ttf'),
};

/** Every family name the type scale can ask for. */
export const BUNDLED_FONT_FAMILIES = Object.keys(FONT_ASSETS);

export interface AppFontsState {
  /** True once loading has settled, successfully or not. */
  ready: boolean;
  /** True when every face registered. False means system-font fallback. */
  loaded: boolean;
  error: Error | null;
}

export function useAppFonts(): AppFontsState {
  const [state, setState] = useState<AppFontsState>({
    ready: false,
    loaded: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await Font.loadAsync(FONT_ASSETS);
        if (!cancelled) setState({ ready: true, loaded: true, error: null });
      } catch (error) {
        // Not fatal -- see this module's header.
        console.warn(
          '[fonts] bundled typefaces did not register; falling back to the ' +
            'system font',
          error
        );
        if (!cancelled) {
          setState({
            ready: true,
            loaded: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
