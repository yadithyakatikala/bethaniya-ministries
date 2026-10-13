import type { ReactNode } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Chip, EmptyState, ErrorState, SkeletonRows, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { UpdateRow } from './UpdateRow';
import { useUpdates } from './useUpdates';
import type { UpdateItem } from './updates';

/**
 * The Community hub's first tab: what the church has said lately, and the
 * doors to the rest of church life.
 *
 * THE SHELF under the tabs -- Events, Songs, Photos and videos -- is a row of
 * 44-high chips that side-scrolls (it fades at the right edge to say there
 * may be more). They are where those three places LIVE in the new navigation;
 * none of them has a tab of its own, and Home opens two of them directly.
 *
 * ONE FEED. Announcements and church posts are merged and labelled, newest
 * first (see ./updates.ts); a church that has published neither sees an empty
 * state in words, never an invented item.
 *
 * `header` is the hub's own title and tabs, so they scroll away with the
 * list as the design draws them.
 */
export function UpdatesFeed({ header }: { header?: ReactNode }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const { colors, layout } = useTheme();
  const state = useUpdates();
  const pad = { paddingHorizontal: layout.screenMargin };

  const shelf = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      testID="community-shelf"
      // Bleeds to the screen edges and starts at the margin, so a chip scrolls
      // under the edge of the phone rather than stopping at a gutter.
      style={styles.shelf}
      contentContainerStyle={[styles.shelfContent, pad]}
    >
      <Chip
        tall
        icon="calendar"
        label={t('nav.events')}
        testID="community-open-events"
        onPress={() => navigation.navigate('EventsList')}
      />
      <Chip
        tall
        icon="music"
        label={t('nav.songs')}
        testID="community-open-songs"
        onPress={() => navigation.navigate('SongsList')}
      />
      <Chip
        tall
        icon="photo"
        label={t('community.goToMedia')}
        testID="community-open-media"
        onPress={() => navigation.navigate('MediaFeed')}
      />
    </ScrollView>
  );

  const open = (item: UpdateItem) => {
    if (item.kind === 'announcement' && item.announcement) {
      navigation.navigate('AnnouncementDetail', { announcement: item.announcement });
    } else if (item.post) {
      navigation.navigate('CommunityPostDetail', { post: item.post });
    }
  };

  return (
    <FlatList
      testID="community-list"
      data={state.items}
      keyExtractor={(item) => item.key}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          {header ? <View style={pad}>{header}</View> : null}
          {shelf}
          <View style={[pad, styles.below]}>
            {state.status === 'loading' ? (
              <SkeletonRows
                count={3}
                leading="none"
                label={t('common.loading')}
                testID="community-loading"
              />
            ) : null}
            {state.status === 'error' ? (
              <ErrorState
                testID="community-error"
                message={t('community.loadErrorShort')}
                retryLabel={t('common.tryAgain')}
              />
            ) : null}
            {state.status === 'ready' && state.items.length === 0 ? (
              <EmptyState
                testID="community-empty"
                title={t('announcements.empty')}
                message={t('announcements.emptyMessage')}
              />
            ) : null}
            {state.items.length > 0 ? (
              <View style={[styles.rule, { borderTopColor: colors.border }]} />
            ) : null}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={pad}>
          <UpdateRow item={item} onPress={() => open(item)} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingBottom: 32 },
  shelf: { flexGrow: 0 },
  shelfContent: { gap: 8, paddingTop: 12 },
  below: { marginTop: 14 },
  // The list's top hairline; each row draws its own foot.
  rule: { borderTopWidth: 1 },
});
