import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton, GoldRule, contentTextStyle, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { BrandFish } from '../opening/BrandFish';
import { TopBar } from '../common/TopBar';
import { BottomBar, PlanProgressLine } from './PlanParts';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanDone'>;

/**
 * "Plan complete": where a member lands on marking the last day of a plan done.
 *
 * Quiet, as a finish to a week of reading should be: the brand's fish in gold, a
 * thin gold rule, the words, the thread full, and "Day 7 of 7" (centred, with no
 * percentage -- the full thread says it). One action in the
 * bar -- **Choose another plan**, which goes to the Bible's Plans view -- and a
 * plain **Done**, which goes back to the plan. The close at the top does the same
 * as Done. Nothing here is a confetti: the design says so.
 */
export function PlanDoneScreen({ route, navigation }: Props) {
  const { plan } = route.params;
  const { colors, layout, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();
  const total = plan.dayCount;

  return (
    <View
      testID="plan-done-screen"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      <View style={{ paddingHorizontal: layout.screenMargin }}>
        <TopBar variant="close" onBack={() => navigation.goBack()} />
      </View>
      <View style={[styles.body, { paddingHorizontal: layout.screenMargin }]}>
        <BrandFish size={88} testID="plan-done-fish" />
        <View style={styles.rule}>
          <GoldRule />
        </View>
        <Text
          accessibilityRole="header"
          testID="plan-done-title"
          style={[
            contentTextStyle(t('plans.doneTitle'), {
              size: 26,
              line: 32,
              teSize: 24,
              teLine: 40,
              weight: 'semiBold',
              fallback: appLanguage,
            }),
            styles.centred,
            { color: colors.ink },
          ]}
        >
          {t('plans.doneTitle')}
        </Text>
        <Text
          testID="plan-done-message"
          style={[type.body, styles.centred, styles.message, { color: colors.inkMuted }]}
        >
          {t('plans.doneMessage', { n: total, plan: plan.title })}
        </Text>
        <View style={styles.progress}>
          <PlanProgressLine
            left={t('home.dayOf', { current: total, total })}
            percent={100}
          />
        </View>
      </View>
      <BottomBar>
        <AppButton
          testID="plan-done-choose-another"
          title={t('plans.chooseAnother')}
          fullWidth
          onPress={() =>
            navigation.navigate('BibleBooks', { tab: 'plans' }, { pop: true })
          }
        />
        <AppButton
          testID="plan-done-done"
          title={t('common.done')}
          variant="text"
          fullWidth
          onPress={() => navigation.goBack()}
        />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, alignItems: 'center', paddingTop: 48, gap: 12 },
  rule: { width: 96 },
  centred: { textAlign: 'center' },
  message: { maxWidth: 252 },
  progress: { width: '100%', marginTop: 8 },
});
