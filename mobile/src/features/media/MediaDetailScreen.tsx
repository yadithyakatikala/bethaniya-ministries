import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton, Icon, NoticeBanner, Skeleton, Tappable, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { usePreferences } from '../../context/PreferencesContext';
import { useAuth } from '../../context/AuthContext';
import { TopBar } from '../common/TopBar';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  MAX_COMMENT_LENGTH,
  addComment,
  deleteComment,
  subscribeToComments,
  type MediaComment,
} from '../../services/firebase/media';
import { fetchReportedItemKeys, reportedItemKey } from '../../services/firebase/reports';
import { useMemberIdentity } from '../../context/useMemberIdentity';
import { ReportSheet } from '../moderation/ReportSheet';
import { toYouTubeEmbedUrl } from '../events/youtube';
import { isValidMediaUrl } from './mediaUrl';
import { PostVerse } from './MediaParts';
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
 * safe one. Any OTHER https video link is shown as a LINK CARD -- the
 * caption, "This video plays outside the app.", and an Open video button --
 * rather than guessed at: this app has no video player component, and a
 * WebView pointed at an arbitrary URL is a browser, not a player. (It used
 * to be handed to an <Image>, which draws nothing for a video file.)
 *
 * THE LOOK. A top bar with Back; the picture, the player or the link card
 * in a 16-radius frame; the caption; the verse (a thin gold bar, the serif of
 * its script); who posted it; three outlined pill buttons -- like, share,
 * save -- with what is on in ink (a solid heart, a solid ribbon); a quiet
 * Report; the comments as rows; and the comment box fixed to the foot.
 *
 * =====================================================================
 * THE ONE REAL-TIME LISTENER IN THE FEATURE
 * =====================================================================
 * Comments are subscribed to while this screen is open and only while it
 * is open. A comment appearing as it is written is the point of a
 * comment thread; the cost is bounded by the page size and by the screen
 * being closed. Everything else in the media feature is a plain fetch.
 */
export function MediaDetailScreen({ route, navigation }: Props) {
  const { post } = route.params;
  const { colors, radii, layout, type } = useTheme();
  const { t } = useTranslation();
  const { appLanguage } = usePreferences();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const identity = useMemberIdentity();
  const interactions = useMediaInteractions();

  const [comments, setComments] = useState<MediaComment[] | null>(null);
  const [commentsFailed, setCommentsFailed] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [signInNotice, setSignInNotice] = useState(false);
  const [commentsToken, setCommentsToken] = useState(0);
  // M7 reporting. `reporting` holds what is being reported: the post
  // itself, or one of its comments -- one sheet, two possible targets.
  const [reporting, setReporting] = useState<
    { type: 'media'; id: string } | { type: 'media_comment'; id: string } | null
  >(null);
  const [reportedKeys, setReportedKeys] = useState<ReadonlySet<string>>(new Set());

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
  }, [post.id, commentsToken]);

  // M7. One read for the whole screen, covering the post and every
  // comment on it -- see ../../services/firebase/reports.ts.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const keys = await fetchReportedItemKeys(user.uid);
        if (!cancelled) setReportedKeys(keys);
      } catch (error) {
        // Not knowing what is already reported costs an affordance, not
        // the screen: a duplicate report is refused by the deterministic
        // marker id anyway.
        console.warn('[media] could not read report markers:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const liked = interactions.likedIds.has(post.id);
  const saved = interactions.savedIds.has(post.id);
  const postReported = reportedKeys.has(reportedItemKey('media', post.id));

  function markReported(type: 'media' | 'media_comment', id: string) {
    setReportedKeys((current) => {
      const next = new Set(current);
      next.add(reportedItemKey(type, id));
      return next;
    });
  }
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
        // M7: the resolved name, not Firebase Auth's. Auth's displayName
        // is empty for a member who signed up with an email address and
        // typed their name in onboarding, so comments were posted with a
        // blank author line. See ../../context/useMemberIdentity.ts.
        authorName: identity.displayName,
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

  const margin = layout.screenMargin;
  const captionStyle = [
    styles.caption,
    appLanguage === 'te' && styles.captionTe,
    { color: colors.ink },
  ];

  /** One of the three outlined pills under the post: muted until on, then ink with a firmer outline. */
  const pill = (
    testID: string,
    label: string,
    icon: 'heart' | 'heartf' | 'share' | 'bookmark' | 'bookmarkf',
    on: boolean,
    onPress: () => void,
    selected?: boolean
  ) => (
    <Tappable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.pill, { borderColor: on ? colors.borderStrong : colors.border }]}
    >
      <Icon name={icon} size={24} color={on ? colors.ink : colors.inkMuted} />
    </Tappable>
  );

  const commentRow = (comment: MediaComment, index: number) => {
    const own = user?.uid === comment.authorUid;
    const reported = reportedKeys.has(reportedItemKey('media_comment', comment.id));
    return (
      <View
        key={comment.id}
        testID={`media-comment-${comment.id}`}
        style={[
          styles.comment,
          { borderBottomColor: colors.border },
          index === 0 && { borderTopColor: colors.border, borderTopWidth: 1 },
        ]}
      >
        <Text style={[styles.commentName, { color: colors.ink }]}>
          {comment.authorName}
        </Text>
        {/* Interface family: a comment's script is unknown. */}
        <Text
          style={[
            styles.commentText,
            appLanguage === 'te' && styles.commentTextTe,
            { color: colors.ink },
          ]}
        >
          {comment.text}
        </Text>
        {own ? (
          <Tappable
            testID={`media-comment-delete-${comment.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('media.deleteComment')}
            onPress={() => void deleteComment(post.id, comment.id)}
            style={styles.commentAction}
          >
            <Text style={[styles.commentActionText, { color: colors.danger }]}>
              {t('common.delete')}
            </Text>
          </Tappable>
        ) : identity.uid ? (
          // M7. Somebody else's comment can be reported; your own can
          // be deleted. Neither offers the other, because "report my
          // own comment" is not a thing anybody means to do.
          <Tappable
            testID={`media-comment-report-${comment.id}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: reported }}
            disabled={reported}
            onPress={() => setReporting({ type: 'media_comment', id: comment.id })}
            style={styles.commentAction}
          >
            <Text style={[styles.commentActionText, { color: colors.inkMuted }]}>
              {reported ? t('report.alreadyReported') : t('report.action')}
            </Text>
          </Tappable>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      testID="media-detail-root"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingHorizontal: margin }}>
        <TopBar onBack={() => navigation.goBack()} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: margin, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        testID="media-detail-screen"
      >
        {embedUrl ? (
          <View
            testID="media-detail-player"
            style={[styles.player, { borderRadius: radii.card }]}
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
        ) : post.type === 'video' ? (
          // Not YouTube: a link, honestly, with the caption as its title.
          <View
            testID="media-detail-link-card"
            style={[
              styles.linkCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            {post.caption.length > 0 ? (
              <Text
                testID="media-detail-caption"
                style={[styles.linkTitle, { color: colors.ink }]}
              >
                {post.caption}
              </Text>
            ) : null}
            <Text style={[styles.linkNote, { color: colors.inkMuted }]}>
              {t('media.videoLink')}
            </Text>
            {isValidMediaUrl(post.mediaUrl) ? (
              <View style={styles.linkAction}>
                <AppButton
                  testID="media-detail-open-video"
                  title={t('media.openVideo')}
                  variant="secondary"
                  compact
                  leadingIcon="external"
                  onPress={() => {
                    Linking.openURL(post.mediaUrl).catch((error: unknown) =>
                      console.warn('[media] could not open the video link:', error)
                    );
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : (
          <Image
            testID="media-detail-image"
            source={{ uri: post.mediaUrl }}
            style={[
              styles.image,
              { borderRadius: radii.card, backgroundColor: colors.surfaceRaised },
            ]}
            accessibilityLabel={t('media.imageLabel')}
            resizeMode="cover"
          />
        )}

        <View style={styles.body}>
          {post.caption.length > 0 && (embedUrl || post.type !== 'video') ? (
            <Text testID="media-detail-caption" style={captionStyle}>
              {post.caption}
            </Text>
          ) : null}

          {post.verseReference || post.verseText ? (
            <PostVerse
              testID="media-detail-verse"
              text={post.verseText}
              reference={post.verseReference}
            />
          ) : null}

          {post.authorName.length > 0 ? (
            <Text style={[type.caption, { color: colors.inkMuted }]}>
              {post.authorName}
            </Text>
          ) : null}

          <View style={styles.pills}>
            {pill(
              'media-detail-like',
              liked ? t('media.liked') : t('media.like'),
              liked ? 'heartf' : 'heart',
              liked,
              () => guarded(() => void interactions.toggleLike(post.id)),
              liked
            )}
            {pill(
              'media-detail-share',
              t('media.share'),
              'share',
              false,
              () => void interactions.share(post)
            )}
            {pill(
              'media-detail-save',
              saved ? t('media.saved') : t('media.save'),
              saved ? 'bookmarkf' : 'bookmark',
              saved,
              () => guarded(() => void interactions.toggleSave(post)),
              saved
            )}
          </View>

          {/* M7. A word rather than an icon: reporting is rare, deliberate
              and consequential, and a glyph in the action row would sit a
              thumb's width from Like. It is only offered to a signed-in
              member, because firestore.rules requires an account to file
              one -- a signed-out visitor pressing it would only ever get a
              permission error. */}
          {identity.uid ? (
            <Tappable
              testID="media-detail-report"
              accessibilityRole="button"
              accessibilityState={{ disabled: postReported }}
              disabled={postReported}
              onPress={() => setReporting({ type: 'media', id: post.id })}
              style={styles.report}
            >
              <Text
                style={[
                  styles.reportText,
                  { color: postReported ? colors.disabledInk : colors.inkMuted },
                ]}
              >
                {postReported ? t('report.alreadyReported') : t('report.action')}
              </Text>
            </Tappable>
          ) : null}

          {signInNotice || interactions.actionFailed ? (
            <NoticeBanner
              testID={
                interactions.actionFailed
                  ? 'media-detail-action-failed'
                  : 'media-detail-sign-in-notice'
              }
              tone={interactions.actionFailed ? 'danger' : 'neutral'}
              message={
                interactions.actionFailed
                  ? t('media.actionFailed')
                  : t('media.signInRequired')
              }
            />
          ) : null}
        </View>

        <Text
          accessibilityRole="header"
          style={[styles.commentsHeading, { color: colors.ink }]}
        >
          {t('media.comments')}
        </Text>

        {comments === null && !commentsFailed ? (
          <View
            testID="media-comments-loading"
            accessibilityRole="progressbar"
            accessibilityLabel={t('common.loading')}
            accessibilityState={{ busy: true }}
            style={styles.commentsWaiting}
          >
            <Skeleton width="50%" height={16} />
            <Skeleton width="85%" height={14} />
          </View>
        ) : null}

        {commentsFailed ? (
          <View style={styles.commentsWaiting}>
            <Text
              testID="media-comments-error"
              accessibilityLiveRegion="polite"
              style={[styles.commentsNote, { color: colors.danger }]}
            >
              {t('media.commentsError')}
            </Text>
            <View style={styles.retry}>
              <AppButton
                testID="media-comments-retry"
                title={t('common.tryAgain')}
                variant="secondary"
                compact
                onPress={() => {
                  setCommentsFailed(false);
                  setComments(null);
                  setCommentsToken((token) => token + 1);
                }}
              />
            </View>
          </View>
        ) : null}

        {comments !== null && comments.length === 0 ? (
          <Text
            testID="media-no-comments"
            style={[
              styles.commentsNote,
              styles.commentsWaiting,
              { color: colors.inkMuted },
            ]}
          >
            {t('media.noComments')}
          </Text>
        ) : null}

        <View style={styles.commentList}>
          {(comments ?? []).map((comment, index) => commentRow(comment, index))}
        </View>
      </ScrollView>

      {/* The comment box, fixed to the foot: a field and Post. A member who is
          not signed in gets the one sentence that says why there is none. */}
      <View
        style={[
          styles.composer,
          {
            backgroundColor: colors.paper,
            borderTopColor: colors.border,
            paddingHorizontal: margin,
            paddingBottom: Math.max(insets.bottom, 12) + 4,
          },
        ]}
      >
        {interactions.canInteract ? (
          <>
            {commentError ? (
              <Text
                testID="media-comment-error"
                accessibilityLiveRegion="polite"
                style={[type.help, { color: colors.danger }]}
              >
                {commentError}
              </Text>
            ) : null}
            <View style={styles.composerRow}>
              <TextInput
                testID="media-comment-input"
                accessibilityLabel={t('media.comment')}
                placeholder={t('media.commentPlaceholder')}
                placeholderTextColor={colors.inkSubtle}
                value={draft}
                onChangeText={(text) => {
                  setDraft(text);
                  setCommentError(null);
                }}
                multiline
                maxLength={MAX_COMMENT_LENGTH}
                style={[
                  styles.input,
                  appLanguage === 'te' && styles.inputTe,
                  {
                    backgroundColor: colors.surface,
                    borderColor: commentError ? colors.danger : colors.borderStrong,
                    borderRadius: radii.control,
                    color: colors.ink,
                  },
                ]}
              />
              <AppButton
                testID="media-comment-submit"
                title={t('media.postComment')}
                onPress={() => void handlePostComment()}
                loading={posting}
                disabled={draft.trim().length === 0}
              />
            </View>
          </>
        ) : (
          <Text
            testID="media-comment-sign-in"
            style={[type.bodySmall, styles.signIn, { color: colors.inkMuted }]}
          >
            {t('media.signInRequired')}
          </Text>
        )}
      </View>

      {reporting ? (
        <ReportSheet
          visible
          targetType={reporting.type}
          targetId={reporting.id}
          // A reported COMMENT carries the post it sits under, so an
          // administrator reviewing the queue can find it. A reported
          // post is its own parent, so this is null.
          targetParentId={reporting.type === 'media_comment' ? post.id : null}
          onClose={() => setReporting(null)}
          onReported={() => markReported(reporting.type, reporting.id)}
          testID="media-report"
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  image: { width: '100%', aspectRatio: 4 / 3, marginTop: 4 },
  player: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginTop: 4,
  },
  linkCard: {
    borderWidth: 1,
    padding: 18,
    gap: 6,
    alignItems: 'flex-start',
    marginTop: 4,
  },
  linkTitle: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
  },
  linkNote: { fontFamily: fontFamilies.interfaceRegular, fontSize: 14.5, lineHeight: 21 },
  linkAction: { marginTop: 4 },
  body: { marginTop: 16, gap: 12 },
  caption: { fontFamily: fontFamilies.interfaceRegular, fontSize: 17, lineHeight: 26 },
  captionTe: { lineHeight: 31 },
  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  report: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  reportText: {
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13.5,
    lineHeight: 18,
  },
  commentsHeading: {
    marginTop: 8,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 20,
  },
  commentsWaiting: { marginTop: 12, gap: 10 },
  commentsNote: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  retry: { alignSelf: 'flex-start' },
  commentList: { marginTop: 6 },
  comment: { paddingVertical: 12, borderBottomWidth: 1, gap: 2 },
  commentName: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 13.5,
    lineHeight: 19,
  },
  commentText: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 15.5,
    lineHeight: 23,
  },
  commentTextTe: { lineHeight: 27 },
  commentAction: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  commentActionText: {
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  composer: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    // A comment can be long, but the box must not grow until it swallows the
    // post: it scrolls past this height.
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    borderWidth: 1,
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 15.5,
    lineHeight: 23,
  },
  inputTe: { lineHeight: 27 },
  signIn: { paddingVertical: 4 },
});
