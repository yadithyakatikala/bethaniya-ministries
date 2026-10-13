import { StyleSheet, Text, View } from 'react-native';
import { GoldThread, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { BrandPortrait } from '../common/BrandPortrait';

/**
 * Shown while AuthContext hasn't yet received Firebase's initial auth state.
 *
 * THE LOOK. The round portrait (96), a short gold thread under it, and
 * "Loading…" in quiet ink -- centred, a little above the middle of the
 * screen so the group reads as centred once the status bar is counted. It
 * follows the opening, which ends on the same portrait, so a cold start
 * that has to wait for sign-in state looks like a held breath rather than a
 * spinner appearing out of nowhere.
 *
 * THEMED FROM THE FIRST FRAME. This is the first app frame every user
 * sees. It previously had no `backgroundColor` at all, which meant the
 * default transparent-over-white surface flashed white on every cold start
 * in dark mode before Home/SignIn painted `colors.background` over it, and
 * its label was a hardcoded `#666`, unreadable on the dark palette. It sits
 * inside PreferencesProvider (see App.tsx), so useTheme() is safe here.
 *
 * It is one announcement for a screen reader -- a busy progress indicator
 * named "Loading…" -- not a picture, a line and a sentence to swipe past.
 */
export function LoadingScreen() {
  const { colors, type } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="auth-loading-screen"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      accessibilityState={{ busy: true }}
    >
      <BrandPortrait size={96} testID="auth-loading-portrait" />
      <GoldThread testID="auth-loading-thread" />
      <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
        {t('common.loading')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    // Lifts the group a little above the centre: with the status bar above
    // and nothing below, the true centre looks low.
    paddingBottom: 36,
  },
});
