import { useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { usePreferences } from '../../context/PreferencesContext';
import { SuspendedScreen } from './SuspendedScreen';
import { isSuspended, msUntilSuspensionEnds } from './suspension';

/**
 * Stops a suspended member at the door.
 *
 * =====================================================================
 * WHERE IT SITS, AND WHY
 * =====================================================================
 * Above the onboarding gate and the navigator, in the same place
 * SignInScreen and OnboardingGate sit -- so "suspended" is a state the
 * app can be in, not a route inside it. A route would mean the tab bar
 * and a back gesture exist behind the notice, which is exactly the
 * escape hatch a suspension must not have.
 *
 * Above onboarding, specifically: a member who has been suspended
 * should not first be asked to fill in a profile form.
 *
 * =====================================================================
 * "CAN THEY CLOSE THE APP AND GET BACK IN?" -- NO
 * =====================================================================
 * Three reasons, and it is worth being precise about each:
 *
 *   1. NOTHING IS CACHED THAT WOULD HELP. The decision is made from the
 *      live profile snapshot (PreferencesContext's listener), which is
 *      read fresh on every launch. There is no local "I am allowed"
 *      flag to survive a restart, and no timestamp the device could
 *      set.
 *   2. IT IS RECHECKED ON EVERY RETURN FROM THE BACKGROUND. Closing and
 *      reopening runs the check again; so does switching away and back,
 *      which is the more common gesture.
 *   3. THE RULES DO NOT DEPEND ON ANY OF THIS. Even a member running a
 *      modified client writes nothing: firestore.rules refuses it
 *      server-side (see isActiveMember there). This gate is what makes
 *      the app HONEST about the state; the rules are what make it a
 *      boundary.
 *
 * What it is NOT is a disabled sign-in. Disabling a Firebase Auth
 * account needs the Admin SDK, which needs a deployed Cloud Function,
 * which needs the Blaze plan this project stays off. The member keeps a
 * valid token and can still READ. Anybody describing this as "the
 * account has been disabled" would be wrong, and the screen it shows is
 * careful not to.
 *
 * =====================================================================
 * A TEMPORARY SUSPENSION LETS GO BY ITSELF
 * =====================================================================
 * No job flips anything when it expires -- there is none, and there
 * cannot be on this plan. The expiry is a COMPARISON, made here and in
 * the rules. So this gate holds a timer for the moment the suspension
 * ends, and re-renders itself into the app at that moment; the
 * background check covers the case where the phone was asleep through
 * it. `accountStatus` stays 'suspended' on the document either way,
 * because it is a record of what was decided, not a cache of whether it
 * still applies.
 */
export function SuspensionGate({ children }: { children: ReactNode }) {
  const { accountStatus, suspension } = usePreferences();

  // Bumped to force a fresh evaluation. Never read -- its only job is to
  // be a new value, which is why it is a counter and not a Date: storing
  // a clock reading here would make the render impure.
  const [recheck, setRecheck] = useState(0);

  const account = { accountStatus, suspension };
  const blocked = isSuspended(account);

  // The moment this suspension ends, if it ends. Recomputed on every
  // render, which is what `recheck` is for.
  const waitMs = msUntilSuspensionEnds(account);

  useEffect(() => {
    if (waitMs === null) return undefined;
    const timer = setTimeout(() => setRecheck((n) => n + 1), waitMs);
    return () => clearTimeout(timer);
    // `recheck` is a dependency on purpose: each tick reschedules the
    // next one, which is how a suspension longer than the clamp in
    // ./suspension.ts is still released promptly.
  }, [waitMs, recheck]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      // Coming back to the app is the moment worth re-evaluating: a
      // member who was suspended -- or released -- while the phone was
      // in their pocket sees the right thing immediately.
      if (next === 'active') setRecheck((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);

  if (blocked) return <SuspendedScreen suspension={suspension} />;
  return <>{children}</>;
}
