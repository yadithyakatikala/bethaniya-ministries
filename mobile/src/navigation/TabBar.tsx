import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

/**
 * The five destinations the hand-rolled tab bar switches between. Kept as
 * a narrow literal union (not the full RootStackParamList) since this is
 * the only navigable-by-tab subset -- see AppNavigator.tsx's doc comment
 * for why a hand-rolled bar was built instead of
 * @react-navigation/bottom-tabs (an explicit decision to add no new
 * navigation dependency).
 */
export type TabRouteName = 'Home' | 'BibleBooks' | 'SongsList' | 'EventsList' | 'More';

const TABS: { route: TabRouteName; label: string; testID: string }[] = [
  { route: 'Home', label: 'Home', testID: 'tab-home' },
  { route: 'BibleBooks', label: 'Bible', testID: 'tab-bible' },
  { route: 'SongsList', label: 'Songs', testID: 'tab-songs' },
  { route: 'EventsList', label: 'Events', testID: 'tab-events' },
  { route: 'More', label: 'More', testID: 'tab-more' },
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
 * VERIFICATION NOTE: this project has no device/simulator harness (same
 * documented limitation as AudioPlayer.tsx/YouTubePlayerScreen.tsx) --
 * TabBar.test.tsx proves the active-tab styling and onNavigate wiring in
 * isolation, not that native-stack renders correctly inside the flex
 * layout on a real device.
 */
export function TabBar({
  activeRoute,
  onNavigate,
}: {
  activeRoute: string | undefined;
  onNavigate: (route: TabRouteName) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID="tab-bar"
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}
    >
      {TABS.map((tab) => {
        const active = activeRoute === tab.route;
        return (
          <Pressable
            key={tab.route}
            testID={tab.testID}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onNavigate(tab.route)}
            style={styles.item}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: active ? colors.primary : 'transparent' },
              ]}
            />
            <Text
              style={[
                styles.label,
                { color: active ? colors.primary : colors.secondaryText },
                active ? styles.labelActive : null,
              ]}
            >
              {tab.label}
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
    paddingBottom: 22,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  dot: { width: 4, height: 4, borderRadius: 2, marginBottom: 1 },
  label: { fontSize: 10.5, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
});
