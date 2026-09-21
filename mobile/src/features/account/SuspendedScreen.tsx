import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { useTheme, useTypographyFor } from '../../theme';
import { useTranslation } from '../../i18n';
import { AppButton } from '../../theme/ui/AppButton';
import type { MemberSuspension } from '../../services/firebase/userProfile';

/**
 * What a suspended member sees instead of the app.
 *
 * =====================================================================
 * WHY THIS SCREEN EXISTS AT ALL
 * =====================================================================
 * Before it, a suspension was invisible until you tried to use the app.
 * The member could open every screen, type a prayer request, tap send,
 * and be told nothing -- firestore.rules refused the write on the
 * server, correctly and silently. From the pew that is not "you are
 * suspended", it is "this church's app is broken".
 *
 * So the app says it. Once, at the door, in plain words, with the date
 * it ends when there is one.
 *
 * =====================================================================
 * WHAT IT DOES NOT SAY
 * =====================================================================
 * The REASON an administrator recorded. That note is written by one
 * administrator for the next one -- "third warning about the chat" --
 * and putting it on this screen would turn every internal record into a
 * message delivered to the member. A church tells somebody why in
 * person; this screen tells them the fact and points them at the people
 * who can discuss it.
 *
 * It also does not say that the account has been closed or disabled,
 * because it has not been. The member stays signed in, nothing is
 * deleted, and they can still be restored by one tap in the dashboard.
 *
 * =====================================================================
 * SIGN OUT IS THE ONLY ACTION
 * =====================================================================
 * Not a "contact us" button: this app has no support inbox, and a
 * button that opened a blank mail composer addressed to nobody would be
 * worse than the sentence it replaced. Sign out is here because a shared
 * phone is normal in this congregation, and the household's other
 * member must be able to get to their own account.
 */
function formatWhen(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SuspendedScreen({ suspension }: { suspension: MemberSuspension | null }) {
  const { colors, spacing, radii } = useTheme();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { appLanguage } = usePreferences();
  // The interface typeface for the member's own language -- this screen
  // is chrome, not scripture, so it follows the app language.
  const typography = useTypographyFor(appLanguage);
  const insets = useSafeAreaInsets();

  const expiresAt = suspension?.expiresAt ?? null;

  return (
    <View
      style={[styles.screen, { backgroundColor: colors.background }]}
      testID="suspended-screen"
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xxl,
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: spacing.screen,
          },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.card,
              padding: spacing.lg,
              gap: spacing.md,
            },
          ]}
        >
          <Text
            style={[typography.headline, { color: colors.ink }]}
            testID="suspended-title"
          >
            {t('suspended.title')}
          </Text>

          <Text
            style={[typography.body, { color: colors.inkMuted }]}
            testID="suspended-message"
          >
            {expiresAt
              ? t('suspended.temporaryMessage')
              : t('suspended.permanentMessage')}
          </Text>

          {/* The date, only when there is one. A permanent suspension
              has nothing honest to put here, and inventing a date would
              be the cruellest possible mistake on this screen. */}
          {expiresAt ? (
            <View
              style={[
                styles.untilRow,
                {
                  backgroundColor: colors.warningTint,
                  borderRadius: radii.control,
                  padding: spacing.md,
                },
              ]}
            >
              <Text
                style={[typography.title, { color: colors.onWarning }]}
                testID="suspended-until"
              >
                {t('suspended.until', { when: formatWhen(expiresAt) })}
              </Text>
            </View>
          ) : null}

          <Text style={[typography.bodySmall, { color: colors.inkSubtle }]}>
            {t('suspended.canStillRead')}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.inkSubtle }]}>
            {t('suspended.contactChurch')}
          </Text>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <AppButton
            title={t('suspended.signOut')}
            variant="secondary"
            fullWidth
            onPress={() => void signOut()}
            testID="suspended-sign-out"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  untilRow: { alignItems: 'center' },
});
