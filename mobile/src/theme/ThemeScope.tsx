import { createContext, useContext, type ReactNode } from 'react';

/** A palette a part of the tree can be set in, besides the app's own light or dark. */
export type ScopePalette = 'sepia';

const ThemeScopeContext = createContext<ScopePalette | null>(null);

/**
 * Sets everything beneath it in another palette than the app's own -- today
 * only the Bible reader's sepia page.
 *
 * `useTheme()` reads this, so a screen's page and chrome change colour by being
 * placed inside, with no component knowing about it. `palette={null}` puts a
 * part of the tree BACK in the app's palette, which is how the reader's sheets
 * stay in the app's light or dark while the page behind them is sepia: a React
 * Native `Modal` keeps the context of where it is rendered, so a sheet drawn
 * inside the scope would otherwise inherit it.
 *
 * It changes colours and nothing else -- not the status bar, not the app's
 * stored theme preference (see ../services/firebase/userProfile.ts's
 * ThemePreference for why that one has a closed set).
 */
export function ThemeScope({
  palette,
  children,
}: {
  palette: ScopePalette | null;
  children: ReactNode;
}) {
  return (
    <ThemeScopeContext.Provider value={palette}>{children}</ThemeScopeContext.Provider>
  );
}

/** The palette this part of the tree is scoped to, or null for the app's own. */
export function useThemeScope(): ScopePalette | null {
  return useContext(ThemeScopeContext);
}
