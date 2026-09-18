import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import {
  BookIcon,
  CalendarIcon,
  HomeIcon,
  MoreIcon,
  MusicIcon,
} from '../theme/ui/TabIcons';
import { useTranslation } from '../i18n';
import type { StringKey } from '../i18n';

/**
 * The five destinations the hand-rolled tab bar switches between. Kept as
 * a narrow literal union (not the full RootStackParamList) since this is
 * the only navigable-by-tab subset -- see AppNavigator.tsx's doc comment
 * for why a hand-rolled bar was built instead of
 * @react-navigation/bottom-tabs (an explicit decision to add no new
 * navigation dependency).
 */
export type TabRouteName = 'Home' | 'BibleBooks' | 'SongsList' | 'EventsList' | 'More';

interface TabIconProps {
  color: string;
  size?: number;
  filled?: boolean;
}

/**
 * `labelKey` rather than a literal: the bar showed hardcoded English even
 * with the app set to Telugu, because there was no translation layer to
 * read from -- see ../i18n/strings.ts.
 */
const TABS: {
  route: TabRouteName;
  labelKey: StringKey;
  testID: string;
  Icon: ComponentType<TabIconProps>;
}[] = [
  { route: 'Home', labelKey: 'nav.home', testID: 'tab-home', Icon: HomeIcon },
  { route: 'BibleBooks', labelKey: 'nav.bible', testID: 'tab-bible', Icon: BookIcon },
  { route: 'SongsList', labelKey: 'nav.songs', testID: 'tab-songs', Icon: MusicIcon },
  {
    route: 'EventsList',
    labelKey: 'nav.events',
    testID: 'tab-events',
    Icon: CalendarIcon,
  },
  { route: 'More', labelKey: 'nav.more', testID: 'tab-more', Icon: MoreIcon },
];

/**
 * Persistent bottom tab bar -- Vespers direction (see the UI audit and
 * its approved visual prototype: "Home is a stack of five identical
 * buttons... deserve a tab bar"). Purely presentational: AppNavigator.tsx
 * owns which route is active and only mounts this component while the
 * current top-level route is one of the five tab destinations (pushed
 * detail screens -- SongDetail, EventDetail, BibleChapters, Profile,
 * Settings, etc. -- hide it, the same "tab bar disappears on drill-down"
 * behavior @react-navigation/bottom-tabs would give for free).
 *
 * ICON OVER LABEL, per tab. The bar previously showed a 4px dot above a
 * text label, which read as an unfinished prototype rather than a mobile
 * navigation bar. Icons come from ../theme/ui/TabIcons.tsx -- drawn from
 * Views, no new dependency and no emoji; see that file's header.
 *
 * The selected tab differs in THREE ways, not just colour: the icon is
 * filled rather than outlined, the label goes bold, and both take
 * `colors.primary`. Colour alone would fail the "never colour-only"
 * rule the Badge primitive already follows.
 *
 * VERIFICATION NOTE: this project has no device/simulator harness (same
 * documented limitation as AudioPlayer.tsx/YouTubePlayerScreen.tsx) --
 * TabBar.test.tsx proves the active-tab styling, the icons, the
 * accessibility labels and the onNavigate wiring in isolation, not that
 * native-stack renders correctly inside the flex layout on a real device.
 */
export function TabBar({
  activeRoute,
  onNavigate,
}: {
  activeRoute: string | undefined;
  onNavigate: (route: TabRouteName) => void;
}) {
  const { colors, type } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="tab-bar"
      // A tab bar is one control group; TalkBack should present the five
      // items as tabs within it.
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {TABS.map((tab) => {
        const active = activeRoute === tab.route;
        const label = t(tab.labelKey);
        const tint = active ? colors.primary : colors.inkMuted;
        return (
          <Pressable
            key={tab.route}
            testID={tab.testID}
            // "tab", not "button": TalkBack then announces these as
            // "tab 2 of 5, selected" instead of five unrelated buttons.
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            // The icon is decorative (see TabIcons.tsx), so the label the
            // screen reader speaks comes from here and is translated.
            accessibilityLabel={label}
            onPress={() => onNavigate(tab.route)}
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
          >
            <tab.Icon color={tint} size={22} filled={active} />
            <Text
              // At the largest Android font scale a wrapped label would
              // push the bar taller on one item only; clipping one line
              // keeps all five the same height.
              numberOfLines={1}
              style={[type.caption, { color: tint }, active ? styles.labelActive : null]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    // paddingBottom is set inline from useSafeAreaInsets() -- see the
    // component body -- so the home indicator/nav bar on real devices
    // gets real padding instead of a guessed constant.
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    // 52, not 44: an icon over a label needs the extra height, and this
    // is still comfortably above the 44dp accessibility minimum.
    minHeight: 52,
    justifyContent: 'center',
    paddingVertical: 2,
  },
  // The only local text override in the app: the ACTIVE tab's label is
  // heavier, so selection is carried by weight as well as by colour.
  labelActive: { fontWeight: '700' },
});
