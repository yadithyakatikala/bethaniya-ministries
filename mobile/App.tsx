import type { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PreferencesProvider } from './src/context/PreferencesContext';
import { useAppFonts, useTheme } from './src/theme';
import { LoadingScreen } from './src/features/auth/LoadingScreen';
import { SignInScreen } from './src/features/auth/SignInScreen';
import { AppNavigator } from './src/navigation/AppNavigator';
import {
  configureNotificationHandler,
  useNotificationListeners,
} from './src/services/notifications/notificationService';

// Configuring the foreground-notification handler is a one-time, module-
// scope side effect (see notificationService.ts) -- it doesn't depend on
// auth state or React lifecycle, so it runs once at import time rather
// than inside a component.
configureNotificationHandler();

/**
 * Root component.
 *
 * Day 1 built the scaffold; Day 2 adds the real authentication foundation
 * (see AuthContext.tsx): the app now renders one of Loading / SignIn / Home
 * based on Firebase's actual auth state, instead of the static placeholder
 * screen Day 1 shipped. Day 6 introduces real navigation (see
 * AppNavigator.tsx): once authenticated, the app renders the navigator
 * (which itself renders HomeScreen as its initial "Home" route) instead
 * of HomeScreen directly, so the authenticated app can now navigate to
 * "SongsList" / "SongDetail" too. Day 9 adds PreferencesProvider (see
 * PreferencesContext.tsx) inside AuthProvider -- it needs useAuth() to
 * know whether/who to sync language/theme/notification preferences to
 * Firestore for -- so every screen (including SignIn/Loading) sees a
 * consistent theme from app start, not just once signed in.
 *
 * SafeAreaProvider wraps everything -- required by
 * react-native-safe-area-context's useSafeAreaInsets(), which the
 * hand-rolled bottom tab bar (see src/navigation/TabBar.tsx) and the
 * screens with a hidden native header (Home, the Bible reader, Daily
 * Verse -- see AppNavigator.tsx's headerShown: false options) use to pad
 * for the status bar/home indicator instead of a hardcoded constant.
 * Without this provider those hooks throw at runtime on a real device
 * (Jest's mock of the package is more forgiving, which is why this was
 * missing until now).
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PreferencesProvider>
          <FontGate>
            <AuthGate />
          </FontGate>
          <ThemedStatusBar />
        </PreferencesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * Holds the first real render until the bundled typefaces have
 * registered -- M3.
 *
 * Without this the app paints one frame in the system font and then
 * reflows as eight faces arrive, which on a page of verses is a visible
 * jump.
 *
 * It waits for the load to SETTLE, not to succeed: useAppFonts() reports
 * `ready` either way, and a failure leaves React Native falling back to
 * the system font -- exactly how the app looked before M3. A font that
 * failed to register is not a reason to show a congregation a dead
 * screen. See src/theme/fonts.ts.
 */
function FontGate({ children }: { children: ReactNode }) {
  const { ready } = useAppFonts();
  if (!ready) return <LoadingScreen />;
  return <>{children}</>;
}

/**
 * The status bar has to follow the APP's theme, not the OS scheme.
 * `style="auto"` reads the OS colour scheme, but this app's theme comes
 * from the user's own Light/Dark/System setting (see
 * PreferencesContext.tsx). Someone running the app in Dark while the
 * phone is in Light got dark status-bar icons on a #141A17 header --
 * effectively invisible. Reading `isDark` makes the two agree in every
 * combination.
 */
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

function AuthGate() {
  const { status } = useAuth();
  // Registered unconditionally (hooks can't be called from inside an
  // if-branch) -- harmless before sign-in, since
  // notificationService.ts's tap handler checks navigationRef.isReady()
  // before navigating, and AppNavigator (which owns navigationRef) only
  // exists once status === 'authenticated' anyway.
  useNotificationListeners();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'authenticated') return <AppNavigator />;
  // 'unauthenticated' and 'error' both resolve to the sign-in screen -- an
  // Auth-subsystem error (see AuthContext.tsx) still needs a way for the
  // user to retry signing in, and authErrorMessage surfaces what went wrong.
  return <SignInScreen />;
}
