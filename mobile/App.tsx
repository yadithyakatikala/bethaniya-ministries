import { StatusBar } from 'expo-status-bar';
import { AppStateProvider } from './src/context/AppStateContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoadingScreen } from './src/features/auth/LoadingScreen';
import { SignInScreen } from './src/features/auth/SignInScreen';
import { AppNavigator } from './src/navigation/AppNavigator';

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
 * "SongsList" / "SongDetail" too.
 */
export default function App() {
  return (
    <AppStateProvider>
      <AuthProvider>
        <AuthGate />
        <StatusBar style="auto" />
      </AuthProvider>
    </AppStateProvider>
  );
}

function AuthGate() {
  const { status } = useAuth();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'authenticated') return <AppNavigator />;
  // 'unauthenticated' and 'error' both resolve to the sign-in screen -- an
  // Auth-subsystem error (see AuthContext.tsx) still needs a way for the
  // user to retry signing in, and authErrorMessage surfaces what went wrong.
  return <SignInScreen />;
}
