import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from './src/context/AppStateContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PreferencesProvider } from './src/context/PreferencesContext';
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
 * hand-rolled bottom tab bar (see src/navigation/BottomTabBar.tsx) and
 * the screens with a hidden native header (Home, the Bible reader, Daily
 * Verse -- see AppNavigator.tsx's headerShown: false options) use to pad
 * for the status bar/home indicator instead of a hardcoded constant.
 * Without this provider those hooks throw at runtime on a real device
 * (Jest's mock of the package is more forgiving, which is why this was
 * missing until now).
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <AuthProvider>
          <PreferencesProvider>
            <AuthGate />
            <StatusBar style="auto" />
          </PreferencesProvider>
        </AuthProvider>
      </AppStateProvider>
    </SafeAreaProvider>
  );
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
