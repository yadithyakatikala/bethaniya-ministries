import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../auth/LoadingScreen';
import {
  subscribeToOwnProfile,
  type UserProfile,
} from '../../services/firebase/userProfile';
import { isProfileComplete } from './profileCompleteness';
import { OnboardingScreen } from './OnboardingScreen';

/**
 * Decides whether a signed-in member sees the questionnaire or the app.
 *
 * =====================================================================
 * WHERE IT SITS, AND WHY NOT IN THE NAVIGATOR
 * =====================================================================
 * Between the auth gate and the navigator, exactly like SignInScreen
 * sits in front of both -- so onboarding is a state the app can be in,
 * not a route inside it. Making it a route would mean the five-tab bar
 * and a back gesture exist behind a form that is supposed to be
 * answered, and would add a screen to RootStackParamList that nothing
 * should ever navigate to directly. The app already has exactly this
 * shape for "you are signed in but cannot use the app yet"; this is one
 * more case of it.
 *
 * =====================================================================
 * THE THREE-STATE RULE
 * =====================================================================
 * `undefined` profile means NOT LOADED YET -- not "incomplete". The
 * difference matters: treating the first tick as incomplete would flash
 * the questionnaire at every returning member on every cold start, which
 * is a worse bug than the one this feature fixes. So the gate renders
 * the loading screen until the first snapshot arrives, and a profile
 * that genuinely does not exist yet (`null`) still counts as an answer
 * -- a brand-new account has no document for a moment, and that member
 * does need onboarding.
 *
 * A read failure resolves to SHOWING THE APP, not the form. If Firestore
 * cannot be reached, the honest position is that we do not know whether
 * they have done this, and the member who has already answered must not
 * be asked again because the network was down.
 *
 * =====================================================================
 * ONCE PAST IT, STAYS PAST IT
 * =====================================================================
 * `settled` latches. Both completing and skipping set it, and nothing
 * clears it for the life of this mount. Without that latch, the
 * local snapshot that fires before the server acknowledges the write
 * carries a null `profileCompletedAt` (serverTimestamp() has no value
 * yet), and the member would be bounced back into the form they just
 * submitted. It resets when a different member signs in, which is the
 * only time it should.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;

  // Both pieces of state are STAMPED WITH THE uid they belong to, and
  // derived below rather than reset when the uid changes. Resetting them
  // in the effect body would be a synchronous setState inside an effect
  // (the same cascading-render pattern the reader's loader avoids), and
  // it would also leave a frame in which the previous member's answer was
  // still on screen for the next one.
  const [loaded, setLoaded] = useState<{
    uid: string;
    profile: UserProfile | null;
  } | null>(null);
  const [settledFor, setSettledFor] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return undefined;
    const unsubscribe = subscribeToOwnProfile(
      uid,
      (next) => setLoaded({ uid, profile: next }),
      (error) => {
        // Unknown, not incomplete. See the header.
        console.warn('[onboarding] could not read the profile:', error);
        setSettledFor(uid);
      }
    );
    return unsubscribe;
  }, [uid]);

  /** `undefined` while this uid's first snapshot has not arrived. */
  const profile = loaded && loaded.uid === uid ? loaded.profile : undefined;
  const settled = settledFor !== null && settledFor === uid;

  // Not signed in: this gate has no opinion, and App.tsx never renders it
  // in that state anyway.
  if (!uid) return <>{children}</>;
  if (settled || isProfileComplete(profile)) return <>{children}</>;
  if (profile === undefined) return <LoadingScreen />;

  return (
    <OnboardingScreen
      profile={profile}
      onDone={() => setSettledFor(uid)}
      onSkip={() => setSettledFor(uid)}
    />
  );
}
