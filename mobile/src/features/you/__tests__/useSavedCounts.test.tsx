import { act, renderHook } from '@testing-library/react-native';
import { useSavedCounts } from '../useSavedCounts';
import { fetchSavedMediaIds } from '../../../services/firebase/media';
import { subscribeToPrayers } from '../../../services/firebase/prayers';
import { subscribeToStartedPlanCount } from '../../../services/firebase/plans';
import {
  subscribeToBookmarks,
  subscribeToHighlights,
  subscribeToVerseNotes,
} from '../../../services/firebase/readerAnnotations';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/media');
jest.mock('../../../services/firebase/prayers');
jest.mock('../../../services/firebase/plans');
jest.mock('../../../services/firebase/readerAnnotations');

type Emit = (items: unknown) => void;
type Fail = (error: unknown) => void;

const emit: Record<string, Emit> = {};
const fail: Record<string, Fail> = {};
const unsubscribe: Record<string, jest.Mock> = {};

/** Wires one subscription: remembers how to push to it and how to make it fail. */
function wire(name: string, fn: jest.Mock, errorIndex: number) {
  unsubscribe[name] = jest.fn();
  fn.mockImplementation((...args: unknown[]) => {
    emit[name] = args[1] as Emit;
    fail[name] = args[errorIndex] as Fail;
    return unsubscribe[name];
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  wire('notes', subscribeToVerseNotes as jest.Mock, 2);
  wire('highlights', subscribeToHighlights as jest.Mock, 2);
  wire('bookmarks', subscribeToBookmarks as jest.Mock, 2);
  wire('plans', subscribeToStartedPlanCount as jest.Mock, 2);
  wire('journal', subscribeToPrayers as jest.Mock, 2);
  (fetchSavedMediaIds as jest.Mock).mockResolvedValue(new Set(['m1', 'm2', 'm3', 'm4']));
});

const NOTHING = {
  notes: null,
  highlights: null,
  bookmarks: null,
  plans: null,
  media: null,
  journal: null,
};

describe('useSavedCounts', () => {
  it('counts nothing, and listens to nothing, for a member who is not known', async () => {
    const { result } = await renderHook(() => useSavedCounts(null));
    expect(result.current).toEqual(NOTHING);
    expect(subscribeToVerseNotes).not.toHaveBeenCalled();
    expect(subscribeToPrayers).not.toHaveBeenCalled();
    expect(fetchSavedMediaIds).not.toHaveBeenCalled();
  });

  it('knows no number until each source has answered: never a wrong one', async () => {
    (fetchSavedMediaIds as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const { result } = await renderHook(() => useSavedCounts('u1'));
    expect(result.current).toEqual(NOTHING);
  });

  it('counts each source for the member, separately', async () => {
    const { result } = await renderHook(() => useSavedCounts('u1'));
    await act(async () => {
      emit.notes([{}, {}, {}]);
      emit.highlights(new Array(12).fill({}));
      emit.bookmarks([{}, {}, {}, {}, {}]);
      emit.plans(1);
      emit.journal([{}, {}, {}, {}, {}, {}]);
    });
    expect(result.current).toEqual({
      notes: 3,
      highlights: 12,
      bookmarks: 5,
      plans: 1,
      media: 4,
      journal: 6,
    });
    for (const subscribe of [
      subscribeToVerseNotes,
      subscribeToHighlights,
      subscribeToBookmarks,
      subscribeToStartedPlanCount,
      subscribeToPrayers,
      fetchSavedMediaIds,
    ]) {
      expect((subscribe as jest.Mock).mock.calls[0][0]).toBe('u1');
    }
  });

  it('shows zero when a member really has none', async () => {
    const { result } = await renderHook(() => useSavedCounts('u1'));
    await act(async () => {
      emit.notes([]);
      emit.plans(0);
    });
    expect(result.current.notes).toBe(0);
    expect(result.current.plans).toBe(0);
    // ...and still nothing for what has not answered.
    expect(result.current.highlights).toBeNull();
  });

  it('follows a change, because three of the sources are live listeners', async () => {
    const { result } = await renderHook(() => useSavedCounts('u1'));
    await act(async () => emit.notes([{}]));
    expect(result.current.notes).toBe(1);
    await act(async () => emit.notes([{}, {}]));
    expect(result.current.notes).toBe(2);
  });

  it('stays unknown when a source cannot be read, and breaks nothing', async () => {
    const { result } = await renderHook(() => useSavedCounts('u1'));
    await act(async () => {
      fail.notes({ code: 'permission-denied' });
      fail.journal({ code: 'unavailable' });
      emit.bookmarks([{}, {}]);
    });
    expect(result.current.notes).toBeNull();
    expect(result.current.journal).toBeNull();
    expect(result.current.bookmarks).toBe(2);
  });

  it('stays unknown when the saved-media read is refused', async () => {
    (fetchSavedMediaIds as jest.Mock).mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useSavedCounts('u1'));
    await act(async () => emit.notes([{}]));
    expect(result.current.media).toBeNull();
    expect(result.current.notes).toBe(1);
  });

  it('ignores a saved-media answer that arrives after the screen has gone', async () => {
    let resolve: (ids: Set<string>) => void = () => undefined;
    (fetchSavedMediaIds as jest.Mock).mockReturnValue(
      new Promise<Set<string>>((r) => {
        resolve = r;
      })
    );
    const { result, unmount } = await renderHook(() => useSavedCounts('u1'));
    await unmount();
    // Nothing throws, and nothing is set on an unmounted hook.
    await act(async () => resolve(new Set(['m1'])));
    expect(result.current.media).toBeNull();
  });

  it('lets go of every listener when it unmounts', async () => {
    const { unmount } = await renderHook(() => useSavedCounts('u1'));
    await unmount();
    for (const name of ['notes', 'highlights', 'bookmarks', 'plans', 'journal']) {
      expect(unsubscribe[name]).toHaveBeenCalledTimes(1);
    }
  });

  it('starts again for a different member, and forgets the last one’s numbers', async () => {
    const { result, rerender } = await renderHook(
      (props: { uid: string | null }) => useSavedCounts(props.uid),
      {
        initialProps: { uid: 'u1' as string | null },
      }
    );
    await act(async () => emit.notes([{}, {}]));
    expect(result.current.notes).toBe(2);

    await rerender({ uid: null });
    expect(result.current).toEqual(NOTHING);
    expect(unsubscribe.notes).toHaveBeenCalled();
  });

  it('subscribes once per source, not once per render', async () => {
    const { rerender } = await renderHook(() => useSavedCounts('u1'));
    await rerender({});
    await rerender({});
    expect(subscribeToVerseNotes).toHaveBeenCalledTimes(1);
    expect(fetchSavedMediaIds).toHaveBeenCalledTimes(1);
  });
});
