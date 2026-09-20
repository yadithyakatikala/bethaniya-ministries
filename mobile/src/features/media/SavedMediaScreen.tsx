import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, useTypographyFor } from '../../theme';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { EmptyState } from '../../theme/ui/EmptyState';
import { ErrorState } from '../../theme/ui/ErrorState';
import { LoadingState } from '../../theme/ui/LoadingState';
import { Tappable } from '../../theme/ui/Tappable';
import { PlayIcon } from '../../theme/ui/MediaIcons';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fetchMediaPost,
  fetchSavedMedia,
  type SavedMedia,
} from '../../services/firebase/media';

/**
 * The posts this member has bookmarked.
 *
 * ONE QUERY, NOT ONE READ PER SAVE. A save carries a small copy of the
 * post -- its type, url and caption -- so this list renders from the
 * member's own subcollection without touching /media at all. See
 * ../../services/firebase/media.ts for why the copy exists and what it
 * costs (it can go stale if an administrator edits a caption).
 *
 * Opening one re-reads the REAL post, so the detail screen is never the
 * stale copy: a member who taps through sees what the post says now,
 * including a caption or verse that changed since they saved it. A post
 * that has since been deleted or unpublished simply cannot be opened,
 * and says so rather than opening an empty screen.
 */
export function SavedMediaScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, radii, spacing, type } = useTheme();
  const { t } = useTranslation();
  const { appLanguage } = usePreferences();
  const interfaceType = useTypographyFor(appLanguage);
  const { status, user } = useAuth();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;

  const [saved, setSaved] = useState<SavedMedia[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  // Same shape as MediaFeedScreen's loader: every setState happens after
  // an await, so the effect never sets state synchronously in its body.
  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchSavedMedia(uid);
        if (!cancelled && mountedRef.current) setSaved(rows);
      } catch (error) {
        console.warn('[media] could not read your saved media:', error);
        if (!cancelled && mountedRef.current) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, reloadToken]);

  const retry = useCallback(() => {
    setFailed(false);
    setSaved(null);
    setReloadToken((token) => token + 1);
  }, []);

  async function open(id: string) {
    setOpenFailed(false);
    try {
      const post = await fetchMediaPost(id);
      if (!post) {
        // Deleted or unpublished since it was saved.
        setOpenFailed(true);
        return;
      }
      navigation.navigate('MediaDetail', { post });
    } catch (error) {
      console.warn('[media] could not open that saved post:', error);
      setOpenFailed(true);
    }
  }

  if (!uid) {
    return (
      <EmptyState
        testID="saved-media-signed-out"
        title={t('media.savedEmpty')}
        message={t('media.signInRequired')}
      />
    );
  }

  if (failed) {
    return (
      <ErrorState
        testID="saved-media-error"
        message={t('media.loadError')}
        retryLabel={t('common.tryAgain')}
        onRetry={retry}
      />
    );
  }

  if (saved === null) {
    return <LoadingState label={t('common.loading')} testID="saved-media-loading" />;
  }

  return (
    <FlatList
      testID="saved-media-list"
      data={saved}
      keyExtractor={(row) => row.id}
      contentContainerStyle={[
        styles.list,
        { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.background },
      ]}
      ListHeaderComponent={
        openFailed ? (
          <View
            testID="saved-media-open-failed"
            accessibilityLiveRegion="polite"
            style={[
              styles.notice,
              {
                backgroundColor: colors.surface,
                borderColor: colors.danger,
                borderRadius: radii.card,
                padding: spacing.md,
              },
            ]}
          >
            <Text style={[type.bodySmall, { color: colors.ink }]}>
              {t('media.loadError')}
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          testID="saved-media-empty"
          title={t('media.savedEmpty')}
          message={t('media.savedEmptyMessage')}
        />
      }
      renderItem={({ item }) => (
        <Tappable
          testID={`saved-media-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={item.caption || t('media.openPost')}
          onPress={() => void open(item.id)}
          style={[
            styles.row,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.card,
              padding: spacing.sm,
              gap: spacing.sm,
            },
          ]}
        >
          <View>
            <Image
              source={{ uri: item.mediaUrl }}
              style={[styles.thumb, { borderRadius: radii.control }]}
              accessibilityLabel={t('media.imageLabel')}
              resizeMode="cover"
            />
            {item.type === 'video' ? (
              <View style={styles.thumbPlay}>
                <PlayIcon color={colors.onPrimary} size={18} />
              </View>
            ) : null}
          </View>
          <Text
            style={[interfaceType.body, styles.rowCaption, { color: colors.ink }]}
            numberOfLines={3}
          >
            {item.caption}
          </Text>
        </Tappable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  notice: { borderWidth: 1, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  thumb: { width: 72, height: 72 },
  thumbPlay: {
    position: 'absolute',
    top: 27,
    left: 27,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCaption: { flex: 1 },
});
