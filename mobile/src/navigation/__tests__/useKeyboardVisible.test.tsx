import { Keyboard, Platform } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useKeyboardVisible } from '../useKeyboardVisible';

type Handler = () => void;

/** Captures what the hook subscribes to, so a test can raise the keyboard by hand. */
function spyOnKeyboard() {
  const handlers = new Map<string, Handler>();
  const remove = jest.fn();
  const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    event: string,
    handler: Handler
  ) => {
    handlers.set(event, handler);
    return { remove };
  }) as never);
  return { handlers, remove, spy };
}

describe('useKeyboardVisible', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is false until the keyboard shows, true while it is up, false again once it goes', async () => {
    const { handlers } = spyOnKeyboard();
    const { result } = await renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);

    const show = [...handlers.entries()].find(([event]) => /Show$/.test(event))?.[1];
    const hide = [...handlers.entries()].find(([event]) => /Hide$/.test(event))?.[1];
    expect(show).toBeDefined();
    expect(hide).toBeDefined();

    await act(async () => show?.());
    expect(result.current).toBe(true);
    await act(async () => hide?.());
    expect(result.current).toBe(false);
  });

  it('listens for the event of its platform: "will" on iOS, which moves first; "did" on Android', async () => {
    const original = Platform.OS;
    try {
      for (const [os, show, hide] of [
        ['ios', 'keyboardWillShow', 'keyboardWillHide'],
        ['android', 'keyboardDidShow', 'keyboardDidHide'],
      ] as const) {
        Platform.OS = os;
        const { handlers } = spyOnKeyboard();
        const { unmount } = await renderHook(() => useKeyboardVisible());
        expect([...handlers.keys()].sort()).toEqual([hide, show].sort());
        await unmount();
        jest.restoreAllMocks();
      }
    } finally {
      Platform.OS = original;
    }
  });

  it('stops listening when it goes away', async () => {
    const { remove } = spyOnKeyboard();
    const { unmount } = await renderHook(() => useKeyboardVisible());
    await unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
