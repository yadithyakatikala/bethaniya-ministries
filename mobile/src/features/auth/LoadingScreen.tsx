import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/**
 * Shown while AuthContext hasn't yet received Firebase's initial auth state.
 *
 * This is the first app frame every user sees, so it has to be themed: it
 * previously had no `backgroundColor` at all, which meant the default
 * transparent-over-white surface flashed white on every cold start in dark
 * mode before Home/SignIn painted `colors.background` over it. The text
 * colour was likewise a hardcoded `#666`, unreadable on the dark palette.
 * It sits inside PreferencesProvider (see App.tsx), so useTheme() is safe
 * here.
 */
export function LoadingScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="auth-loading-screen"
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.secondaryText }]}>{t('common.loading')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  text: { fontSize: 14 },
});
