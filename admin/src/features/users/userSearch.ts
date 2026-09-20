import type { AccountStatus, AdminUserSummary, AuthProvider } from '../../types';

/**
 * Finding one member in the congregation -- M7.
 *
 * A church list is hundreds of rows and the question is always about ONE
 * person, so the page needs a search that works on whatever the person
 * asking happens to know: a name, an email address, a phone number, or --
 * when they are chasing a support problem -- the uid from a log line.
 *
 * MATCHES ON EVERY IDENTIFYING FIELD, not just the name. "Search by
 * name" is the version of this that fails exactly when somebody is
 * looking up an account with no name on it, which is the account most
 * likely to need looking up.
 *
 * Case-insensitive, and PUNCTUATION-INSENSITIVE FOR PHONE NUMBERS: a
 * number stored as "+91 98765 43210" must be found by typing
 * "9876543210", because that is how somebody reads it off a piece of
 * paper. Nothing else is normalised -- a name is matched as written.
 *
 * Pure, and separate from the page, so the matching rules can be tested
 * without mounting a table.
 */
function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

export function matchesUserQuery(user: AdminUserSummary, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return true;

  const haystacks = [user.displayName, user.email, user.uid].filter(
    (value): value is string => typeof value === 'string'
  );
  if (haystacks.some((value) => value.toLowerCase().includes(trimmed))) return true;

  // The phone number is matched twice: as written, and as bare digits, so
  // both "+91 98765" and "9198765" find the same person.
  if (user.phoneNumber) {
    if (user.phoneNumber.toLowerCase().includes(trimmed)) return true;
    const queryDigits = digitsOf(trimmed);
    if (queryDigits.length > 0 && digitsOf(user.phoneNumber).includes(queryDigits)) {
      return true;
    }
  }
  return false;
}

export function filterUsers(
  users: readonly AdminUserSummary[],
  query: string
): AdminUserSummary[] {
  return users.filter((user) => matchesUserQuery(user, query));
}

/** What the page shows for each provider. `null` is NOT "email". */
export const AUTH_PROVIDER_LABELS: Record<AuthProvider, string> = {
  password: 'Email and password',
  'google.com': 'Google',
  'apple.com': 'Apple',
};

export function authProviderLabel(provider: AuthProvider | null): string {
  // Deliberately not "Email": an account that has not signed in since
  // this was introduced has no recorded provider, and guessing one would
  // be a plausible-looking lie in an administrative record.
  return provider ? AUTH_PROVIDER_LABELS[provider] : 'Not recorded yet';
}

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Active',
  suspended: 'Posting paused',
};

export function appLanguageLabel(language: 'en' | 'te' | null): string {
  return language === 'te' ? 'Telugu' : language === 'en' ? 'English' : 'Not set';
}

export function genderLabel(gender: 'male' | 'female' | null): string {
  return gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : 'Not set';
}

/** "Finished onboarding" is one explicit marker, never a field-by-field guess. */
export function profileCompletionLabel(completedAt: Date | null): string {
  return completedAt ? `Completed ${completedAt.toLocaleDateString()}` : 'Not completed';
}

export function lastActiveLabel(lastActiveAt: Date | null): string {
  // "Never" would be wrong for an account that simply predates the
  // recording -- it has never been WRITTEN, which is not the same as the
  // member never having opened the app.
  return lastActiveAt ? lastActiveAt.toLocaleDateString() : 'Not recorded yet';
}
