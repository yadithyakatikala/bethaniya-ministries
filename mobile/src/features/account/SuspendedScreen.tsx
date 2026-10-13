import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { AppButton, Icon, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { formatDayMonthYear, formatTimeOfDay } from '../../i18n/locale';
import { subscribeToChurchSettings } from '../../services/firebase/settings';
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
 * THE LOOK
 * =====================================================================
 * A pause mark in a ring (not the portrait: the portrait is the church's
 * welcome, and this is not one), the title in the serif, one plain
 * sentence, and -- for a temporary suspension -- the date it ends in a
 * warning-tinted box. Two quieter sentences follow. When the church has
 * set a support email, it is shown as PLAIN TEXT under "Contact the
 * church", which a member can press and hold to copy. Sign out sits
 * apart, at the foot of the screen.
 *
 * It is announced when it appears (a polite live region) and its title is
 * a heading, so a screen reader opens on what happened.
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
 * worse than the sentence it replaced. The support email, when there is
 * one, is words a member can read and copy -- not a link. Sign out is
 * here because a shared phone is normal in this congregation, and the
 * household's other member must be able to get to their own account.
 *
 * Reading the church's support email needs no more than being signed in
 * (firestore.rules: any signed-in member may read /settings), and a
 * suspension stops writes, not reads -- so this works for a suspended
 * member. If it cannot be read the row is simply absent.
 */
function formatWhen(date: Date, appLanguage: 'en' | 'te'): string {
  return `${formatDayMonthYear(date, appLanguage)}, ${formatTimeOfDay(date, appLanguage)}`;
}

export function SuspendedScreen({ suspension }: { suspension: MemberSuspension | null }) {
  const { colors, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [supportEmail, setSupportEmail] = useState('');

  useEffect(
    () =>
      subscribeToChurchSettings(
        (settings) => setSupportEmail(settings?.supportEmail ?? ''),
        // Unreadable: the row stays out (or as it was). The notice never waits on it.
        () => undefined
      ),
    []
  );

  const expiresAt = suspension?.expiresAt ?? null;

  return (
    <View
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
      testID="suspended-screen"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View accessibilityLiveRegion="polite" style={styles.group}>
          <View
            style={[styles.mark, { borderColor: colors.borderStrong }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name="pause" size={28} color={colors.ink} />
          </View>

          <Text
            accessibilityRole="header"
            textBreakStrategy="balanced"
            style={[
              type.headline,
              styles.title,
              appLanguage === 'te' ? styles.titleTe : styles.titleEn,
              { color: colors.ink },
            ]}
            testID="suspended-title"
          >
            {t('suspended.title')}
          </Text>

          <Text
            style={[type.bodyLarge, { color: colors.inkMuted }]}
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
            <View style={[styles.until, { backgroundColor: colors.warningTint }]}>
              <Text
                style={[type.button, { color: colors.warning }]}
                testID="suspended-until"
              >
                {t('suspended.until', { when: formatWhen(expiresAt, appLanguage) })}
              </Text>
            </View>
          ) : null}

          <Text style={[type.bodySmall, { color: colors.inkSubtle }]}>
            {t('suspended.canStillRead')}
          </Text>
          <Text style={[type.bodySmall, { color: colors.inkSubtle }]}>
            {t('suspended.contactChurch')}
          </Text>
        </View>

        {supportEmail ? (
          <View
            testID="suspended-contact"
            style={[styles.contact, { borderTopColor: colors.border }]}
          >
            <Icon name="msg" size={20} color={colors.inkMuted} />
            <View style={styles.contactWords}>
              <Text style={[type.help, { color: colors.inkMuted }]}>
                {t('settings.contactChurch')}
              </Text>
              <Text
                selectable
                testID="suspended-contact-email"
                style={[type.button, { color: colors.ink }]}
              >
                {supportEmail}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.foot,
          {
            backgroundColor: colors.paper,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 34),
          },
        ]}
      >
        <AppButton
          title={t('suspended.signOut')}
          variant="secondary"
          fullWidth
          onPress={() => void signOut()}
          testID="suspended-sign-out"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Centred in the space above Sign out; a long Telugu message scrolls
  // rather than pushing the button off the screen.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  group: { gap: 14 },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: 6 },
  titleEn: { fontSize: 28, lineHeight: 36 },
  titleTe: { fontSize: 25, lineHeight: 40 },
  until: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 6,
  },
  contactWords: { flex: 1, minWidth: 0 },
  foot: {
    borderTopWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
});
