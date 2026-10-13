import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenTitle, UnderlineTabs, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { useRouteTab } from '../../navigation/useRouteTab';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { PrayerWallScreen } from '../prayer-wall/PrayerWallScreen';
import { PrayersScreen } from './PrayersScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'PrayersHub'>;

/**
 * Prayers: ONE destination with two views -- the church's REQUESTS (the shared
 * wall) and MY JOURNAL (private to the member).
 *
 * They used to be two places reached from two tiles and then from More, and a
 * tester reported them as one feature listed twice. They are one tab now, with
 * the two views as underlined tabs under the title.
 *
 * The title and the tabs are handed to the view as the HEADER of its list, so
 * they scroll away with it, as designed -- and each view draws them in every
 * state (loading, error, empty), so the way between the two views is never lost.
 */
export function PrayersHubScreen({ route }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useRouteTab(route.params?.tab, 'requests');

  const header = (
    <>
      <ScreenTitle title={t('nav.prayers')} />
      <UnderlineTabs
        testID="prayers-tabs"
        selected={tab}
        onSelect={setTab}
        tabs={[
          { value: 'requests', label: t('prayers.tabRequests') },
          { value: 'journal', label: t('prayers.tabJournal') },
        ]}
      />
    </>
  );

  return (
    <View
      testID="prayers-hub"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      {tab === 'requests' ? (
        <PrayerWallScreen header={header} />
      ) : (
        <PrayersScreen header={header} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
