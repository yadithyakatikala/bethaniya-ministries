import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, deleteDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { MediaDetailScreen } from '../MediaDetailScreen';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import type { MediaPost } from '../../../services/firebase/media';

jest.mock('../../../services/firebase/app');

/**
 * The post in full: its media, its comments, and what each of those
 * costs. This is the only screen in the feature that mounts a video or
 * opens a real-time listener, and both of those facts are asserted here.
 */
// Typed, because MediaDetailScreen takes its post from route.params
// and an untyped navigator cannot satisfy that signature.
const Stack = createNativeStackNavigator<RootStackParamList>();

const IMAGE_POST: MediaPost = {
  id: 'm1',
  type: 'image',
  mediaUrl: 'https://example.org/photo.jpg',
  caption: 'Sunday worship',
  verseReference: 'John 3:16',
  verseText: 'For God so loved the world',
  authorName: 'Pastor',
  publishAt: new Date('2026-04-01T00:00:00Z'),
};

const VIDEO_POST: MediaPost = {
  ...IMAGE_POST,
  id: 'm2',
  type: 'video',
  mediaUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
};

function mockSignedIn(uid: string | null) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(uid ? { uid, displayName: 'Ruth', email: null, phoneNumber: null } : null);
    return jest.fn();
  });
}

/** Delivers a comment list, and hands back a way to push more. */
function mockComments(initial: { id: string; data: Record<string, unknown> }[]) {
  let deliver: ((snapshot: unknown) => void) | null = null;
  (onSnapshot as jest.Mock).mockImplementation((target, next) => {
    // ONLY the comments query. PreferencesContext subscribes to the
    // member's /users document through the same onSnapshot, and handing
    // it a list of comments makes it fail in ways that have nothing to do
    // with this screen.
    const path = (target as { path?: string } | undefined)?.path ?? '';
    if (!path.includes('comments')) return jest.fn();
    deliver = next;
    next({ docs: initial.map((c) => ({ id: c.id, data: () => c.data })) });
    return jest.fn();
  });
  return {
    push: (rows: { id: string; data: Record<string, unknown> }[]) => {
      deliver?.({ docs: rows.map((c) => ({ id: c.id, data: () => c.data })) });
    },
  };
}

async function renderDetail(post: MediaPost) {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="MediaDetail"
              component={MediaDetailScreen}
              initialParams={{ post }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PreferencesProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (collection as jest.Mock).mockImplementation((_db, ...segments: string[]) => ({
    path: segments.join('/'),
  }));
  (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
  (addDoc as jest.Mock).mockResolvedValue({ id: 'c-new' });
  (deleteDoc as jest.Mock).mockResolvedValue(undefined);
  mockComments([]);
  mockSignedIn('member-1');
});

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

describe('the post', () => {
  it('shows the caption, the verse and the author', async () => {
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() => expect(screen.getByTestId('media-detail-screen')).toBeTruthy());

    expect(screen.getByTestId('media-detail-caption').props.children).toBe(
      'Sunday worship'
    );
    expect(screen.getByTestId('media-detail-verse')).toBeTruthy();
  });

  it('renders an image post as an image, with no player anywhere', async () => {
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() => expect(screen.getByTestId('media-detail-image')).toBeTruthy());
    expect(screen.queryByTestId('media-detail-player')).toBeNull();
  });

  it('mounts the player only for a video, and only here', async () => {
    const screen = await renderDetail(VIDEO_POST);
    await waitFor(() => expect(screen.getByTestId('media-detail-player')).toBeTruthy());
    expect(screen.queryByTestId('media-detail-image')).toBeNull();
  });

  it('falls back to showing a non-YouTube video link as an image rather than guessing', async () => {
    // The app has no general video player, and a WebView pointed at an
    // arbitrary URL is a browser. See the screen's header.
    const screen = await renderDetail({
      ...VIDEO_POST,
      mediaUrl: 'https://example.org/clip.mp4',
    });
    await waitFor(() => expect(screen.getByTestId('media-detail-image')).toBeTruthy());
    expect(screen.queryByTestId('media-detail-player')).toBeNull();
  });
});

describe('comments', () => {
  it('shows the ones that exist', async () => {
    mockComments([
      { id: 'c1', data: { text: 'Amen', authorUid: 'other', authorName: 'John' } },
    ]);
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() => expect(screen.getByTestId('media-comment-c1')).toBeTruthy());
  });

  it('says so when there are none', async () => {
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() => expect(screen.getByTestId('media-no-comments')).toBeTruthy());
  });

  it('posts a comment as the signed-in member', async () => {
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() => expect(screen.getByTestId('media-comment-input')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('media-comment-input'), 'Praise God');
    await fireEvent.press(screen.getByTestId('media-comment-submit'));

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const [ref, data] = (addDoc as jest.Mock).mock.calls[0] as [
      { path: string },
      Record<string, unknown>,
    ];
    expect(ref.path).toBe('media/m1/comments');
    expect(data.text).toBe('Praise God');
    // Attributed to the caller -- firestore.rules refuses anything else.
    expect(data.authorUid).toBe('member-1');
  });

  it('clears the draft only after the write is accepted', async () => {
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() => expect(screen.getByTestId('media-comment-input')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('media-comment-input'), 'Praise God');
    await fireEvent.press(screen.getByTestId('media-comment-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('media-comment-input').props.value).toBe('')
    );
  });

  it('KEEPS the draft and says so when the write fails', async () => {
    // A comment somebody has to type twice is the worst outcome here.
    (addDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() => expect(screen.getByTestId('media-comment-input')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('media-comment-input'), 'Praise God');
    await fireEvent.press(screen.getByTestId('media-comment-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('media-comment-input').props.value).toBe('Praise God')
    );
  });

  it('offers a delete only on the member’s OWN comment', async () => {
    mockComments([
      { id: 'mine', data: { text: 'Amen', authorUid: 'member-1', authorName: 'Ruth' } },
      { id: 'theirs', data: { text: 'Amen', authorUid: 'other', authorName: 'John' } },
    ]);
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() => expect(screen.getByTestId('media-comment-mine')).toBeTruthy());

    expect(screen.getByTestId('media-comment-delete-mine')).toBeTruthy();
    expect(screen.queryByTestId('media-comment-delete-theirs')).toBeNull();
  });

  it('deletes that comment when asked', async () => {
    mockComments([
      { id: 'mine', data: { text: 'Amen', authorUid: 'member-1', authorName: 'Ruth' } },
    ]);
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() =>
      expect(screen.getByTestId('media-comment-delete-mine')).toBeTruthy()
    );

    await fireEvent.press(screen.getByTestId('media-comment-delete-mine'));

    await waitFor(() => expect(deleteDoc).toHaveBeenCalled());
  });
});

describe('a signed-out visitor', () => {
  beforeEach(() => {
    mockSignedIn(null);
  });

  it('can read the post and its comments', async () => {
    mockComments([
      { id: 'c1', data: { text: 'Amen', authorUid: 'other', authorName: 'John' } },
    ]);
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() => expect(screen.getByTestId('media-comment-c1')).toBeTruthy());
    expect(screen.getByTestId('media-detail-caption')).toBeTruthy();
  });

  it('is shown an explanation instead of a comment box', async () => {
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() => expect(screen.getByTestId('media-comment-sign-in')).toBeTruthy());
    expect(screen.queryByTestId('media-comment-input')).toBeNull();
  });

  it('is told that liking needs an account', async () => {
    const screen = await renderDetail(IMAGE_POST);
    await waitFor(() => expect(screen.getByTestId('media-detail-like')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('media-detail-like'));

    await waitFor(() =>
      expect(screen.getByTestId('media-detail-sign-in-notice')).toBeTruthy()
    );
  });
});
