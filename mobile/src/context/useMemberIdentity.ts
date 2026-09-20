import { useAuth } from './AuthContext';
import { usePreferences } from './PreferencesContext';

/**
 * Who this member is when they post, and whether they may -- M7.
 *
 * =====================================================================
 * WHY THE NAME NEEDS A RESOLVER AT ALL
 * =====================================================================
 * There are two places a member's name can live, and until M7 the
 * posting surfaces read the wrong one.
 *
 *   Firebase Auth's `user.displayName`  set by Google sign-in, and by an
 *                                       email sign-up that supplied one
 *   users/{uid}.displayName             set by onboarding, and editable
 *                                       on the Profile screen
 *
 * Onboarding writes the SECOND and not the first (see
 * ../services/firebase/userProfile.ts's completeOnboarding), so a member
 * who signed up with an email address and typed their name in onboarding
 * has a name in Firestore and nothing in Auth. Media comments read Auth's
 * value and stamped an empty string, which rules accept and which renders
 * as a comment by nobody. This resolver is the fix, and putting it in one
 * place is what stops the next posting surface making the same mistake.
 *
 * ORDER: the profile first, because it is the one the member can edit and
 * the one onboarding fills in; Auth second, for an account that predates
 * onboarding; and `fallback` last, so a name is never empty on screen.
 *
 * =====================================================================
 * `canPost`
 * =====================================================================
 * False when a super admin has paused this member's posting. This is the
 * EXPLANATION, not the enforcement -- firestore.rules' isActiveMember()
 * refuses the write on the server whatever the app renders. What it buys
 * is that a suspended member is told, rather than typing a message and
 * watching it fail.
 */
export function useMemberIdentity(): {
  uid: string | null;
  /** Never empty for a signed-in member. See the resolution order above. */
  displayName: string;
  /** False while signed out, or while a suspension is in effect. */
  canPost: boolean;
  suspended: boolean;
} {
  const { user } = useAuth();
  const { memberName, accountStatus } = usePreferences();

  const fromProfile = memberName?.trim();
  const fromAuth = user?.displayName?.trim();
  const suspended = accountStatus === 'suspended';

  return {
    uid: user?.uid ?? null,
    displayName:
      fromProfile && fromProfile.length > 0
        ? fromProfile
        : fromAuth && fromAuth.length > 0
          ? fromAuth
          : // Not a name, and not meant to look like one -- it is what a
            // member with no name at all is called, in both catalogues'
            // sense, and it is better than a blank author line.
            (user?.email?.split('@')[0] ?? ''),
    canPost: Boolean(user) && !suspended,
    suspended,
  };
}
