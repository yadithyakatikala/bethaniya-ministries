import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

/**
 * A single reusable screen for both Privacy Policy and Terms of Service --
 * added during the V1 production-readiness audit after
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Profile+Settings requirement
 * ("Privacy policy + terms (links)") was found completely missing from the
 * app. SettingsScreen.tsx links to two Stack.Screen registrations of this
 * component (see AppNavigator.tsx's "PrivacyPolicy"/"Terms" routes), each
 * passed a different title/body.
 *
 * The body text below is a real placeholder, not a decorative one -- it
 * accurately describes what this app actually does (the auth methods it
 * uses, that Firestore/Firebase Auth hold the data, that no data is sold)
 * without inventing legal language a lawyer hasn't reviewed. This mirrors
 * this codebase's established pattern for anything not yet fully resolved
 * (e.g. BIBLE_LICENSING.md's placeholder-verse labeling) -- ship something
 * honest and clearly provisional rather than nothing, or something
 * fabricated. A church deploying this app for real should have its own
 * counsel review and replace this text before launch.
 */
export function LegalScreen({ title, body }: { title: string; body: string }) {
  const { colors, spacing, type } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background, padding: spacing.lg },
      ]}
      testID="legal-screen"
    >
      <View style={{ gap: spacing.md }}>
        <Text style={[type.title, { color: colors.text }]} testID="legal-screen-title">
          {title}
        </Text>
        <Text style={[type.bodySmall, { color: colors.secondaryText }]} testID="legal-screen-body">
          {body}
        </Text>
      </View>
    </ScrollView>
  );
}

export const PRIVACY_POLICY_TITLE = 'Privacy Policy';
export const PRIVACY_POLICY_BODY = `This is a provisional privacy notice, not yet reviewed by counsel -- the church operating this app should replace this text before public launch.

What we collect: when you create an account or sign in (with an email address and password, or with Google), Firebase Authentication creates an account record containing your email address and, if you provide one, your name. Your profile (display name, photo, language and theme preference, and whether notifications are enabled) is stored in our Firestore database, tied to your account.

What we don't do: we do not sell your data, and we do not share it with advertisers. We do not collect your location, your contacts, or the contents of your device. Content you create in the app (such as prayer requests) is private to your account unless this app's documentation says otherwise for a specific feature.

Who can see what: church administrators can see your name, email address, and role, as needed to run the app. Firestore security rules restrict what each administrator role can access.

Deleting your data: contact the church using the support email in Settings to request account deletion.`;

export const TERMS_TITLE = 'Terms of Service';
export const TERMS_BODY = `This is a provisional terms notice, not yet reviewed by counsel -- the church operating this app should replace this text before public launch.

By using this app, you agree to use it respectfully and only for its intended purpose: staying connected with this church's announcements, events, songs, Bible reading, and community features.

Content: announcements, events, songs, and Bible text are provided by the church and its licensors. Do not copy or redistribute copyrighted content from this app without permission.

Accounts: you're responsible for keeping your sign-in method secure. The church may suspend accounts that misuse the app's features (for example, posting inappropriate content where the app allows user posts).

Availability: this app is provided as-is, without warranty. Features may change or be temporarily unavailable.

Contact: for questions about these terms, use the support email in Settings.`;

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
});
