import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Icon, IconButton, contentFontFamily, useTheme } from '../../theme';
// The church's own name is admin-configured content in Firestore; this is
// only the fallback for a deployment that has never saved settings.
import { DEFAULT_CHURCH_NAME } from '../../theme/brand';
import { useTranslation } from '../../i18n';
import { BrandFish } from '../opening/BrandFish';
import {
  subscribeToChurchSettings,
  type ChurchSettings,
} from '../../services/firebase/settings';

/**
 * Home's header: the mark, "Welcome, {name}" over the church's name, and one
 * button -- Updates.
 *
 * THE MARK is the gold fish, the brand's own (H4). If the church has saved
 * a logo in the admin Settings page, its logo stands there instead, at the
 * same 36 points; there is no default logo image beyond the fish. The old
 * evergreen initial in a rounded square is retired with the old palette.
 *
 * THE NAME is set in the wordmark role -- the editorial serif -- and the
 * church's name is administrator-written, so when it is not Latin (a Telugu
 * name) it takes the face that covers its script (the design's rule S5, in
 * ../../theme/scriptFace.ts) rather than a serif that has no glyphs for it.
 *
 * ONE BUTTON. Home used to carry Profile and Announcements side by side.
 * Profile lives under "You" in the new navigation, and what remains is the
 * way into what the church is saying: the Updates feed. It is the same
 * 44-point round button every icon-only control in the app is, with a
 * spoken name and hint (IconButton requires one).
 *
 * The settings subscription and its fallback are unchanged from before:
 * the very first snapshot, a missing document and a read error all show the
 * default name -- a sensible default is friendlier than a spinner for
 * something this low-stakes, and the settings read rule never denies a
 * signed-in member. The church's description is still stored and editable
 * in the admin app; Home does not show it.
 */
export function HomeHeader({
  displayLabel,
  onPressUpdates,
}: {
  displayLabel: string;
  onPressUpdates: () => void;
}) {
  const { colors, layout, radii, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const [settings, setSettings] = useState<ChurchSettings | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToChurchSettings(
      (next) => setSettings(next),
      () => setSettings(null)
    );
    return unsubscribe;
  }, []);

  const churchName = settings?.churchName || DEFAULT_CHURCH_NAME;

  return (
    <View style={styles.row} testID="church-branding">
      <View style={styles.brand}>
        {settings?.logoUrl ? (
          <Image
            source={{ uri: settings.logoUrl }}
            style={[styles.logo, { borderRadius: radii.control }]}
            testID="church-logo"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <BrandFish size={layout.rowIcon - 4} testID="church-fish" />
        )}
        <View style={styles.text}>
          <Text style={[type.caption, { color: colors.inkMuted }]} numberOfLines={1}>
            {t('home.welcome')}, {displayLabel}
          </Text>
          <Text
            style={[
              type.wordmark,
              styles.name,
              {
                color: colors.ink,
                fontFamily: contentFontFamily(churchName, {
                  weight: 'semiBold',
                  fallback: appLanguage,
                }),
              },
            ]}
            numberOfLines={2}
          >
            {churchName}
          </Text>
        </View>
      </View>
      <IconButton
        testID="updates-nav-button"
        accessibilityLabel={t('home.updatesLabel')}
        accessibilityHint={t('home.updatesHint')}
        onPress={onPressUpdates}
        style={styles.updates}
      >
        <Icon name="announce" size={24} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  logo: { width: 36, height: 36 },
  text: { flex: 1, minWidth: 0 },
  name: { letterSpacing: 0.19 },
  // The glyph sits a little inside the margin, as drawn: 4 of the button's 10 of air.
  updates: { marginRight: -4 },
});
