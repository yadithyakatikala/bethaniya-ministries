import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ListGroup, ListRow, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { useMemberIdentity } from '../../context/useMemberIdentity';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useSavedCounts } from './useSavedCounts';

/**
 * You's first tab: everything the member has KEPT, in one list of six rows --
 * their notes, highlights and bookmarks in the Bible, the reading plans they
 * have started, the photos and videos they saved, and their prayer journal.
 *
 * Each row is one button into the real place, with how many there are (and
 * no number at all until it is known -- never a wrong one). Nothing here is
 * stored twice: it is a doorway to where each thing already lives, so a
 * member never has to remember which screen kept what.
 *
 * All of it is the member's own and private; the rules that keep it so are
 * the existing owner-only ones.
 */
export function SavedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, layout } = useTheme();
  const { t } = useTranslation();
  const { uid } = useMemberIdentity();
  const counts = useSavedCounts(uid);
  const show = (value: number | null) => (value === null ? undefined : String(value));

  return (
    <ScrollView
      testID="saved-screen"
      contentContainerStyle={[
        styles.container,
        { paddingHorizontal: layout.screenMargin },
      ]}
    >
      <View style={[styles.list, { borderTopColor: colors.border }]}>
        <ListGroup>
          <ListRow
            testID="saved-notes"
            leadingIcon="note"
            title={t('you.notes')}
            value={show(counts.notes)}
            onPress={() => navigation.navigate('SavedVerses', { kind: 'notes' })}
          />
          <ListRow
            testID="saved-highlights"
            leadingIcon="highlight"
            title={t('you.highlights')}
            value={show(counts.highlights)}
            onPress={() => navigation.navigate('SavedVerses', { kind: 'highlights' })}
          />
          <ListRow
            testID="saved-bookmarks"
            leadingIcon="bookmark"
            title={t('you.bookmarks')}
            value={show(counts.bookmarks)}
            onPress={() => navigation.navigate('SavedVerses', { kind: 'bookmarks' })}
          />
          <ListRow
            testID="saved-plans"
            leadingIcon="plans"
            title={t('you.readingPlans')}
            value={show(counts.plans)}
            onPress={() => navigation.navigate('BibleBooks', { tab: 'plans' })}
          />
          <ListRow
            testID="saved-media"
            leadingIcon="photo"
            title={t('community.goToMedia')}
            value={show(counts.media)}
            onPress={() => navigation.navigate('SavedMedia')}
          />
          <ListRow
            testID="saved-journal"
            leadingIcon="prayer"
            title={t('you.prayerJournal')}
            value={show(counts.journal)}
            onPress={() => navigation.navigate('PrayersHub', { tab: 'journal' })}
          />
        </ListGroup>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 4, paddingBottom: 32 },
  // The list is drawn between two hairlines; ListGroup draws only the ones between rows.
  list: { borderTopWidth: 0 },
});
