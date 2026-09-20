import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, useTypographyFor } from '../../theme';
import { useTranslation } from '../../i18n';
import { usePreferences } from '../../context/PreferencesContext';
import { useAuth } from '../../context/AuthContext';
import { AppButton } from '../../theme/ui/AppButton';
import { TextField } from '../../theme/ui/TextField';
import { Tappable } from '../../theme/ui/Tappable';
import { LoadingState } from '../../theme/ui/LoadingState';
import { BookmarkIcon, HeartIcon, ShareIcon } from '../../theme/ui/MediaIcons';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  MAX_COMMENT_LENGTH,
  addComment,
  deleteComment,
  subscribeToComments,
  type MediaComment,
} from '../../services/firebase/media';
import { toYouTubeEmbedUrl } from '../events/youtube';
import { useMediaInteractions } from './useMediaInteractions';

type Props = NativeStackScreenProps<RootStackParamList, 'MediaDetail'>;

/**
 * One post, in full, with its comments.
 *
 * =====================================================================
 * THIS IS THE ONLY PLACE A VIDEO IS EVER LOADED
 * =====================================================================
 * The feed shows a poster and a play marker and mounts nothing. Here,
 * exactly one video exists, because the member asked for it.
 *
 * A YouTube link plays through YouTube's own /embed player in a WebView
 * -- the same approach, and the same authoritative parser, the live
 * stream already uses (../events/youtube.ts). Nothing is downloaded,
 * proxied or re-hosted, which is both the free-plan constraint and the
 * safe one. Any OTHER https video link is shown as a link rather than
 * guessed at: this app has no video player component, and a WebView
 * pointed at an arbitrary URL is a browser, not a player.
 *
 * =====================================================================
 * THE ONE REAL-TIME LISTENER IN THE FEATURE
 * =====================================================================
 * Comments are subscribed to while this screen is open and only while it
 * is open. A comment appearing as it is written is the point of a
 * comment thread; the cost is bounded by the page size and by the screen
 * being closed. Everything else in the media feature is a plain fetch.
 */
export function MediaDetailScreen({ route }: Props) {
  const { post } = route.params;
  const { colors, radii, spacing, type } = useTheme();
  const { t } = useTranslation();
  const { appLanguage } = usePreferences();
  const interfaceType = useTypographyFor(appLanguage);
  const { user } = useAuth();
  const interactions = useMediaInteractions();

  const [comments, setComments] = useState<MediaComment[] | null>(null);
  const [commentsFailed, setCommentsFailed] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [signInNotice, setSignInNotice] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToComments(
      post.id,
      (next) => {
        setComments(next);
        setCommentsFailed(false);
      },
      (error) => {
        console.warn('[media] could not read comments:', error);
        setCommentsFailed(true);
      }
    );
    return unsubscribe;
  }, [post.id]);

  const liked = interactions.likedIds.has(post.id);
  const saved = interactions.savedIds.has(post.id);
  const embedUrl = post.type === 'video' ? toYouTubeEmbedUrl(post.mediaUrl) : null;

  function guarded(action: () => void) {
    if (!interactions.canInteract) {
      setSignInNotice(true);
      return;
    }
    action();
  }

  async function handlePostComment() {
    if (!user || draft.trim().length === 0) return;
    setPosting(true);
    setCommentError(null);
    try {
      await addComment({
        mediaId: post.id,
        uid: user.uid,
        authorName: user.displayName ?? '',
        text: draft,
      });
      // Cleared only AFTER the write was accepted. A draft wiped by a
      // failed post is a comment somebody has to type twice.
      setDraft('');
    } catch (error) {
      console.warn('[media] could not post that comment:', error);
      setCommentError(t('media.commentFailed'));
    } finally {
      setPosting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { padding: spacing.md, gap: spacing.md },
        ]}
        keyboardShouldPersistTaps="handled"
        testID="media-detail-screen"
      >
        {embedUrl ? (
          <View
            testID="media-detail-player"
            style={[
              styles.player,
              { borderRadius: radii.card, borderColor: colors.border },
            ]}
          >
            <WebView
              source={{ uri: embedUrl }}
              allowsFullscreenVideo
              javaScriptEnabled
              // Nothing this app hosts runs in here: it is YouTube's own
              // player on YouTube's own origin.
              domStorageEnabled={false}
            />
          </View>
        ) : (
          <Image
            testID="media-detail-image"
            source={{ uri: post.mediaUrl }}
            style={[styles.image, { borderRadius: radii.card }]}
            accessibilityLabel={t('media.imageLabel')}
            resizeMode="cover"
          />
        )}

        {post.caption.length > 0 ? (
          <Text
            testID="media-detail-caption"
            style={[interfaceType.bodyLarge, { color: colors.ink }]}
          >
            {post.caption}
          </Text>
        ) : null}

        {post.verseReference || post.verseText ? (
          <View
            testID="media-detail-verse"
            style={[
              styles.verse,
              { borderLeftColor: colors.primary, paddingLeft: spacing.sm },
            ]}
          >
            {post.verseText ? (
              <Text style={[interfaceType.body, { color: colors.ink }]}>
                {post.verseText}
              </Text>
            ) : null}
            {post.verseReference ? (
              <Text style={[type.scriptureReference, { color: colors.accent }]}>
                {post.verseReference}
              </Text>
            ) : null}
          </View>
        ) : null}

        {post.authorName.length > 0 ? (
          <Text style={[type.caption, { color: colors.inkMuted }]}>
            {post.authorName}
          </Text>
        ) : null}

        <View style={[styles.actions, { gap: spacing.sm }]}>
          <Tappable
            testID="media-detail-like"
            accessibilityRole="button"
            accessibilityState={{ selected: liked }}
            accessibilityLabel={liked ? t('media.liked') : t('media.like')}
            onPress={() => guarded(() => void interactions.toggleLike(post.id))}
            style={[
              styles.action,
              { borderColor: colors.border, borderRadius: radii.control },
            ]}
          >
            <HeartIcon color={liked ? colors.danger : colors.inkMuted} filled={liked} />
          </Tappable>
          <Tappable
            testID="media-detail-share"
            accessibilityRole="button"
            accessibilityLabel={t('media.share')}
            onPress={() => void interactions.share(post)}
            style={[
              styles.action,
              { borderColor: colors.border, borderRadius: radii.control },
            ]}
          >
            <ShareIcon color={colors.inkMuted} />
          </Tappable>
          <Tappable
            testID="media-detail-save"
            accessibilityRole="button"
            accessibilityState={{ selected: saved }}
            accessibilityLabel={saved ? t('media.saved') : t('media.save')}
            onPress={() => guarded(() => void interactions.toggleSave(post))}
            style={[
              styles.action,
              { borderColor: colors.border, borderRadius: radii.control },
            ]}
          >
            <BookmarkIcon
              color={saved ? colors.primary : colors.inkMuted}
              filled={saved}
            />
          </Tappable>
        </View>

        {signInNotice || interactions.actionFailed ? (
          <View
            testID={
              interactions.actionFailed
                ? 'media-detail-action-failed'
                : 'media-detail-sign-in-notice'
            }
            accessibilityLiveRegion="polite"
            style={[
              styles.notice,
              {
                backgroundColor: colors.surface,
                borderColor: interactions.actionFailed ? colors.danger : colors.border,
                borderRadius: radii.card,
                padding: spacing.md,
              },
            ]}
          >
            <Text style={[type.bodySmall, { color: colors.ink }]}>
              {interactions.actionFailed
                ? t('media.actionFailed')
                : t('media.signInRequired')}
            </Text>
          </View>
        ) : null}

        <Text style={[type.label, { color: colors.ink }]}>{t('media.comments')}</Text>

        {comments === null && !commentsFailed ? (
          <LoadingState
            compact
            label={t('common.loading')}
            testID="media-comments-loading"
          />
        ) : null}

        {commentsFailed ? (
          <Text
            testID="media-comments-error"
            style={[type.bodySmall, { color: colors.danger }]}
          >
            {t('media.loadError')}
          </Text>
        ) : null}

        {comments !== null && comments.length === 0 ? (
          <Text
            testID="media-no-comments"
            style={[type.bodySmall, { color: colors.inkMuted }]}
          >
            {t('media.noComments')}
          </Text>
        ) : null}

        {(comments ?? []).map((comment) => (
          <View
            key={comment.id}
            testID={`media-comment-${comment.id}`}
            style={[
              styles.comment,
              {
                borderColor: colors.border,
                borderRadius: radii.card,
                padding: spacing.sm,
              },
            ]}
          >
            <Text style={[type.caption, { color: colors.inkMuted }]}>
              {comment.authorName}
            </Text>
            {/* Interface family: a comment's script is unknown. */}
            <Text style={[interfaceType.body, { color: colors.ink }]}>
              {comment.text}
            </Text>
            {user?.uid === comment.authorUid ? (
              <Tappable
                testID={`media-comment-delete-${comment.id}`}
                accessibilityRole="button"
                accessibilityLabel={t('media.deleteComment')}
                onPress={() => void deleteComment(post.id, comment.id)}
                style={styles.deleteComment}
              >
                <Text style={[type.bodySmall, { color: colors.danger }]}>
                  {t('common.delete')}
                </Text>
              </Tappable>
            ) : null}
          </View>
        ))}

        {interactions.canInteract ? (
          <View style={{ gap: spacing.sm }}>
            <TextField
              testID="media-comment-input"
              label={t('media.comment')}
              placeholder={t('media.commentPlaceholder')}
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                setCommentError(null);
              }}
              multiline
              maxLength={MAX_COMMENT_LENGTH}
              error={commentError}
            />
            <AppButton
              testID="media-comment-submit"
              title={t('media.postComment')}
              onPress={() => void handlePostComment()}
              loading={posting}
              disabled={draft.trim().length === 0}
            />
          </View>
        ) : (
          <Text
            testID="media-comment-sign-in"
            style={[type.bodySmall, { color: colors.inkMuted }]}
          >
            {t('media.signInRequired')}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  image: { width: '100%', aspectRatio: 4 / 3 },
  player: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', borderWidth: 1 },
  verse: { borderLeftWidth: 3, gap: 4 },
  actions: { flexDirection: 'row' },
  action: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: { borderWidth: 1 },
  comment: { borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  deleteComment: { minHeight: 44, justifyContent: 'center' },
});
