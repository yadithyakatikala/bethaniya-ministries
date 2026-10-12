import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemberIdentity } from '../context/useMemberIdentity';
import { GoldRibbon, Icon, initialOf, contentFontFamily, useTheme } from '../theme';
import type { IconName } from '../theme';
import { fontFamilies } from '../theme/tokens';
import { useTranslation } from '../i18n';
import type { StringKey } from '../i18n';

/**
 * The five destinations the hand-rolled tab bar switches between: Home,
 * Bible, Prayers, Community and You. Kept as a narrow literal union (not the
 * full RootStackParamList) since this is the only navigable-by-tab subset --
 * see AppNavigator.tsx's doc comment for why a hand-rolled bar was built
 * instead of @react-navigation/bottom-tabs (an explicit decision to add no
 * new navigation dependency).
 */
export type TabRouteName = 'Home' | 'BibleBooks' | 'PrayersHub' | 'CommunityHub' | 'You';

/**
 * `labelKey` rather than a literal: the bar must follow the app language.
 * `icon` names a glyph in ../theme/ui/iconShapes.ts; "You" draws the
 * member's own monogram instead.
 */
const TABS: {
  route: TabRouteName;
  labelKey: StringKey;
  testID: string;
  icon: IconName;
}[] = [
  { route: 'Home', labelKey: 'nav.home', testID: 'tab-home', icon: 'home' },
  { route: 'BibleBooks', labelKey: 'nav.bible', testID: 'tab-bible', icon: 'bible' },
  { route: 'PrayersHub', labelKey: 'nav.prayers', testID: 'tab-prayers', icon: 'prayer' },
  {
    route: 'CommunityHub',
    labelKey: 'nav.community',
    testID: 'tab-community',
    icon: 'people',
  },
  { route: 'You', labelKey: 'nav.you', testID: 'tab-you', icon: 'you' },
];

/**
 * The persistent bottom tab bar -- the approved design's, "Shape A": five
 * destinations, labels always shown.
 *
 * THE SELECTED TAB IS MARKED IN THREE WAYS, never by colour alone: a small
 * gold ribbon hangs from the bar's top edge over it, its glyph takes the
 * heavier stroke and a faint wash of its own colour, and its label goes
 * bold -- and its ink is the primary ink where the others are the quiet one.
 * (Gold stays a thin line: it is the ribbon, not a fill behind the tab.)
 *
 * "YOU" is the member: a 24-point circle holding their initial, in the serif
 * of its script (no photos anywhere in the app). Selected, the circle fills.
 * With no name to take an initial from it falls back to the person glyph
 * rather than a "?".
 *
 * Purely presentational: AppNavigator.tsx owns which route is active and only
 * mounts this bar while the current top-level route is one of the five (a
 * pushed detail screen hides it, the same "tab bar disappears on drill-down"
 * behaviour @react-navigation/bottom-tabs would give for free).
 *
 * Accessibility: a tablist of tabs, each with a selected state, so TalkBack
 * says "tab 2 of 5, selected"; the glyphs are decorative and the spoken name
 * is the translated label. Every tab is 52 high, over the 44 minimum.
 *
 * VERIFICATION NOTE: this project has no device/simulator harness --
 * TabBar.test.tsx proves the selected look, the labels, the roles and the
 * onNavigate wiring in isolation, not that native-stack renders correctly
 * inside the flex layout on a real device.
 */
export function TabBar({
  activeRoute,
  onNavigate,
}: {
  activeRoute: string | undefined;
  onNavigate: (route: TabRouteName) => void;
}) {
  const { colors, layout } = useTheme();
  const { t, appLanguage } = useTranslation();
  // The PROFILE's name first (what onboarding wrote and the member can edit),
  // then the sign-in's -- see ../context/useMemberIdentity.ts.
  const { displayName: memberName } = useMemberIdentity();
  const insets = useSafeAreaInsets();
  // Telugu reads smaller than Latin at the same size: the label steps up.
  const labelSize = appLanguage === 'te' ? { fontSize: 12.5, lineHeight: 16 } : LABEL_EN;

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
            // The glyph is decorative, so the label the screen reader
            // speaks comes from here and is translated.
            accessibilityLabel={label}
            onPress={() => onNavigate(tab.route)}
            style={({ pressed }) => [
              styles.item,
              { minHeight: layout.tabItem, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            {active ? (
              <View style={styles.ribbon} pointerEvents="none">
                <GoldRibbon testID="tab-ribbon" />
              </View>
            ) : null}
            {tab.route === 'You' && memberName ? (
              <Monogram name={memberName} tint={tint} active={active} />
            ) : (
              <Icon name={tab.icon} size={24} color={tint} filled={active} />
            )}
            <Text
              // At the largest Android font scale a wrapped label would
              // push the bar taller on one item only; clipping one line
              // keeps all five the same height.
              numberOfLines={1}
              style={[
                labelSize,
                {
                  color: tint,
                  fontFamily: active
                    ? fontFamilies.interfaceBold
                    : fontFamilies.interfaceMedium,
                  fontWeight: active ? '700' : '500',
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 11.5/14 in English; the bar's own size, between a caption and an overline. */
const LABEL_EN = { fontSize: 11.5, lineHeight: 14 } as const;

/**
 * The member as a tab glyph: their initial in a 24-point circle, in the
 * serif of its script. Selected, the circle fills with the tab's ink and the
 * letter takes the page's colour; otherwise it is a ring. Decorative.
 */
function Monogram({
  name,
  tint,
  active,
}: {
  name: string;
  tint: string;
  active: boolean;
}) {
  const { colors } = useTheme();
  const initial = initialOf(name);
  return (
    <View
      testID="tab-monogram"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.monogram,
        { borderColor: tint, backgroundColor: active ? tint : 'transparent' },
      ]}
    >
      <Text
        style={{
          color: active ? colors.paper : tint,
          fontFamily: contentFontFamily(initial, { weight: 'semiBold' }),
          fontSize: 12.5,
          lineHeight: 16,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 11,
    // paddingBottom is set inline from useSafeAreaInsets() -- see the
    // component body -- so the home indicator/nav bar on real devices
    // gets real padding instead of a guessed constant.
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  // Hangs from the bar's top edge: 11 of padding and the 1-point border up.
  ribbon: { position: 'absolute', top: -12, left: 0, right: 0, alignItems: 'center' },
  monogram: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
