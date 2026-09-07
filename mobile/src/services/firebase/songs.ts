/**
 * Real-time listener for published songs -- the mobile-side half of
 * Day 6's "Mobile: Real-time listener on songs collection" plan item.
 * Mirrors announcements.ts's shape exactly: members only ever see
 * published songs (firestore.rules' `songs` read rule matches
 * announcements' -- `isSignedIn() && resource.data.published == true`
 * for anyone who isn't Content Admin+), so the `where('published', '==',
 * true)` clause below mirrors that rule server-side, not just in the UI.
 *
 * Query shape (published == true, ordered by title asc) matches the
 * existing composite index already declared in firestore.indexes.json
 * (added Day 1, unused until now).
 */
import {
  type FirestoreError,
  type Unsubscribe,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from './app';

export interface PublishedSong {
  id: string;
  title: string;
  artist: string;
  category: string;
  lyrics: string;
  /** Always an external URL to a directly-playable audio file/stream (e.g. .mp3, .m4a, or HLS .m3u8) -- see storage.rules' doc comment: no audio files are stored in Firebase Storage. Not a YouTube/Spotify page link; see AudioPlayer.tsx's doc comment for why those aren't playable here. */
  audioUrl: string;
  coverUrl: string | null;
}

function toPublishedSong(id: string, data: Record<string, unknown>): PublishedSong {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    artist: typeof data.artist === 'string' ? data.artist : '',
    category: typeof data.category === 'string' ? data.category : '',
    lyrics: typeof data.lyrics === 'string' ? data.lyrics : '',
    audioUrl: typeof data.audioUrl === 'string' ? data.audioUrl : '',
    coverUrl: typeof data.coverUrl === 'string' ? data.coverUrl : null,
  };
}

export function subscribeToPublishedSongs(
  onNext: (songs: PublishedSong[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, 'songs'),
    where('published', '==', true),
    orderBy('title', 'asc')
  );
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toPublishedSong(d.id, d.data()))),
    onError
  );
}
