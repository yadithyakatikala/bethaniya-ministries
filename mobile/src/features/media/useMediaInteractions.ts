import { useCallback, useEffect, useState } from 'react';
import { Share } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  fetchLikedMediaIds,
  fetchSavedMediaIds,
  likeMedia,
  saveMedia,
  unlikeMedia,
  unsaveMedia,
  type MediaPost,
} from '../../services/firebase/media';

/**
 * A member's like and save state, and the four actions that change it.
 *
 * =====================================================================
 * ONE READ FOR THE WHOLE FEED
 * =====================================================================
 * Both sets are fetched once when the member signs in, not per card. A
 * member's likes are their own small collection, so reading all of it
 * costs one query where ten per-post checks would cost ten -- and it
 * means the feed's like state is right on the first frame instead of
 * ten buttons flickering into place.
 *
 * =====================================================================
 * OPTIMISTIC, BUT HONEST
 * =====================================================================
 * The icon fills the moment it is tapped, because a like that waits for
 * a round trip feels broken. If the write then fails, the state is put
 * BACK and the caller is told -- the screens show a message. This is the
 * M6 BUG 1 lesson applied from the start: an interface that reports
 * success it did not get is worse than one that is slow.
 *
 * =====================================================================
 * SIGNED OUT IS A STATE, NOT AN ERROR
 * =====================================================================
 * `canInteract` is false with no account, and the screens use it to
 * explain that signing in is needed rather than to hide the buttons or
 * to fail silently. Sharing is deliberately NOT gated: a link needs no
 * account, and a church wants its media shared.
 */
export interface MediaInteractions {
  /** Whether this member can like, save and comment. False when signed out. */
  canInteract: boolean;
  likedIds: Set<string>;
  savedIds: Set<string>;
  /** Set when an action failed; the screens surface it. */
  actionFailed: boolean;
  clearActionFailed: () => void;
  toggleLike: (mediaId: string) => Promise<void>;
  toggleSave: (post: MediaPost) => Promise<void>;
  share: (post: MediaPost) => Promise<void>;
}

/** What a shared media post says. The caption, then the link -- and the
 *  verse reference when there is one, because that is the part a member
 *  is usually passing on. */
export function buildMediaShareText(post: MediaPost): string {
  const lines = [post.caption.trim()].filter((line) => line.length > 0);
  if (post.verseText) lines.push(`"${post.verseText}"`);
  if (post.verseReference) lines.push(post.verseReference);
  lines.push(post.mediaUrl);
  return lines.join('\n\n');
}

export function useMediaInteractions(): MediaInteractions {
  const { status, user } = useAuth();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [actionFailed, setActionFailed] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const [liked, saved] = await Promise.all([
          fetchLikedMediaIds(uid),
          fetchSavedMediaIds(uid),
        ]);
        if (cancelled) return;
        setLikedIds(liked);
        setSavedIds(saved);
      } catch (error) {
        // Not worth an error state of its own: the member simply sees
        // nothing marked, which is the honest rendering of "we could not
        // find out", and any action they take still writes correctly.
        console.warn('[media] could not read your likes and saves:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const toggleLike = useCallback(
    async (mediaId: string) => {
      if (!uid) return;
      const wasLiked = likedIds.has(mediaId);
      setLikedIds((current) => {
        const next = new Set(current);
        if (wasLiked) next.delete(mediaId);
        else next.add(mediaId);
        return next;
      });
      try {
        if (wasLiked) await unlikeMedia(uid, mediaId);
        else await likeMedia(uid, mediaId);
      } catch (error) {
        console.warn('[media] could not save that like:', error);
        // Put it back. The server did not accept it, so the icon must
        // not claim otherwise.
        setLikedIds((current) => {
          const next = new Set(current);
          if (wasLiked) next.add(mediaId);
          else next.delete(mediaId);
          return next;
        });
        setActionFailed(true);
      }
    },
    [uid, likedIds]
  );

  const toggleSave = useCallback(
    async (post: MediaPost) => {
      if (!uid) return;
      const wasSaved = savedIds.has(post.id);
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.delete(post.id);
        else next.add(post.id);
        return next;
      });
      try {
        if (wasSaved) await unsaveMedia(uid, post.id);
        else await saveMedia(uid, post);
      } catch (error) {
        console.warn('[media] could not save that bookmark:', error);
        setSavedIds((current) => {
          const next = new Set(current);
          if (wasSaved) next.add(post.id);
          else next.delete(post.id);
          return next;
        });
        setActionFailed(true);
      }
    },
    [uid, savedIds]
  );

  const share = useCallback(async (post: MediaPost) => {
    // NOT gated on being signed in. A link needs no account.
    try {
      await Share.share({ message: buildMediaShareText(post) });
    } catch (error) {
      console.warn('[media] could not open the share sheet:', error);
    }
  }, []);

  return {
    canInteract: uid !== null,
    likedIds,
    savedIds,
    actionFailed,
    clearActionFailed: () => setActionFailed(false),
    toggleLike,
    toggleSave,
    share,
  };
}
