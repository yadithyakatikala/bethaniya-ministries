import React from 'react';
import { StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react-native';
import { Chip } from '../ui/Chip';
import { FloatingAction } from '../ui/FloatingAction';
import { Icon } from '../ui/Icon';
import { ScreenTitle } from '../ui/ScreenTitle';
import { TOAST_MS, Toast, useToast } from '../ui/Toast';
import { AuthProvider } from '../../context/AuthContext';
import { PreferencesProvider } from '../../context/PreferencesContext';
import { darkTokens, lightTokens } from '../tokens';

jest.mock('../../services/firebase/app');

/**
 * The pieces the new navigation shell is built from: the selected look of an
 * icon, the ribbon that hangs from the tab bar, a chip that is a door, the
 * confirmation toast, the floating action and the title of a top-level screen.
 */
afterEach(async () => {
  await cleanup();
});

function Themed({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PreferencesProvider>{children}</PreferencesProvider>
    </AuthProvider>
  );
}

async function renderThemed(ui: React.ReactElement) {
  return render(<Themed>{ui}</Themed>);
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

interface TreeNode {
  type: string;
  props: Record<string, unknown>;
  children?: (TreeNode | string)[] | null;
}

/** Every host node of a type, depth first. */
function findByType(node: TreeNode | TreeNode[] | null, type: string): TreeNode[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap((child) => findByType(child, type));
  const own = node.type === type ? [node] : [];
  const kids = (node.children ?? []).filter((c): c is TreeNode => typeof c !== 'string');
  return [...own, ...kids.flatMap((child) => findByType(child, type))];
}

describe('Icon, selected', () => {
  it('is drawn at 1.75 and unwashed until it is selected', async () => {
    const { toJSON } = await renderThemed(<Icon name="home" color="#112233" />);
    const [svg] = findByType(toJSON() as TreeNode, 'RNSVGSvgView');
    expect(svg.props.strokeWidth).toBe(1.75);
    for (const path of findByType(toJSON() as TreeNode, 'RNSVGPath')) {
      expect(path.props.fillOpacity).toBeUndefined();
    }
  });

  it('takes a heavier stroke and a 14% wash of its own colour when `filled`', async () => {
    // The weight of the glyph says "this one": colour alone would not.
    const { toJSON } = await renderThemed(<Icon name="home" filled color="#112233" />);
    const [svg] = findByType(toJSON() as TreeNode, 'RNSVGSvgView');
    expect(svg.props.strokeWidth).toBe(2);
    expect(svg.props.stroke).toBe('#112233');
    const paths = findByType(toJSON() as TreeNode, 'RNSVGPath');
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.props.fillOpacity).toBe(0.14);
      // The wash is the glyph's own colour, not another one.
      expect(path.props.fill).toEqual({ type: 0, payload: 0xff112233 });
    }
  });

  it('washes every kind of shape: circles and rectangles as well as paths', async () => {
    // "calendar" has a rectangle, "prayer" and "people" circles; a wash that
    // only reached paths would leave some selected glyphs unmarked.
    for (const name of ['calendar', 'people', 'you', 'bible'] as const) {
      const { toJSON, unmount } = await renderThemed(
        <Icon name={name} filled color="#112233" />
      );
      const shapes = [
        ...findByType(toJSON() as TreeNode, 'RNSVGPath'),
        ...findByType(toJSON() as TreeNode, 'RNSVGCircle'),
        ...findByType(toJSON() as TreeNode, 'RNSVGRect'),
      ];
      expect(shapes.length).toBeGreaterThan(0);
      for (const shape of shapes) expect(shape.props.fillOpacity).toBe(0.14);
      await unmount();
    }
  });

  it('keeps a solid glyph solid: the play triangle is not washed to 14%', async () => {
    const { toJSON } = await renderThemed(<Icon name="play" filled color="#112233" />);
    const solid = findByType(toJSON() as TreeNode, 'RNSVGPath').filter(
      (path) => path.props.fillOpacity === undefined
    );
    expect(solid.length).toBeGreaterThan(0);
  });

  it('lets a caller choose the stroke', async () => {
    const { toJSON } = await renderThemed(<Icon name="home" strokeWidth={1.25} filled />);
    const [svg] = findByType(toJSON() as TreeNode, 'RNSVGSvgView');
    expect(svg.props.strokeWidth).toBe(1.25);
  });
});

describe('Chip, as a door', () => {
  it('puts an 18-point glyph before the words, in the ink of the chip', async () => {
    const { getByTestId } = await renderThemed(
      <Chip icon="calendar" label="Events" onPress={jest.fn()} testID="door" />
    );
    const svgs = findByType(getByTestId('door') as unknown as TreeNode, 'RNSVGSvgView');
    // Rendered inside the chip: one glyph, 18 across.
    expect(svgs).toHaveLength(1);
    expect(svgs[0].props.width).toBe(18);
    expect(svgs[0].props.stroke).toBe(lightTokens.ink);
  });

  it('turns the glyph to the on-ink colour when chosen', async () => {
    const { getByTestId } = await renderThemed(
      <Chip icon="calendar" label="Events" selected onPress={jest.fn()} testID="door" />
    );
    const [svg] = findByType(getByTestId('door') as unknown as TreeNode, 'RNSVGSvgView');
    expect(svg.props.stroke).toBe(lightTokens.onPrimary);
  });

  it('is 44 high with no extra hit area when `tall`, and 36 with one when not', async () => {
    const { getByTestId } = await renderThemed(
      <>
        <Chip tall icon="music" label="Songs" onPress={jest.fn()} testID="tall" />
        <Chip label="Healing" onPress={jest.fn()} testID="short" />
      </>
    );
    expect(flat(getByTestId('tall')).minHeight).toBe(44);
    expect(getByTestId('tall').props.hitSlop).toBeUndefined();
    expect(flat(getByTestId('short')).minHeight).toBe(36);
    expect(getByTestId('short').props.hitSlop).toEqual({ top: 4, bottom: 4 });
  });

  it('is named by its words alone; the glyph carries none', async () => {
    const { getByTestId } = await renderThemed(
      <Chip icon="photo" label="Photos and videos" onPress={jest.fn()} testID="door" />
    );
    expect(getByTestId('door').props.accessibilityLabel).toBe('Photos and videos');
    expect(getByTestId('door').props.accessibilityRole).toBe('button');
  });
});

describe('Toast', () => {
  it('draws nothing while there is nothing to say', async () => {
    const { queryByTestId, queryByRole, toJSON } = await renderThemed(
      <Toast message={null} />
    );
    expect(queryByTestId('toast')).toBeNull();
    expect(queryByRole('alert')).toBeNull();
    // Not even the tick: no empty pill is left over the content.
    expect(findByType(toJSON() as TreeNode | null, 'RNSVGSvgView')).toHaveLength(0);
  });

  it('is the primary ink with a tick and the words, announced politely', async () => {
    const { getByTestId, getByText } = await renderThemed(
      <Toast message="Your request was shared" />
    );
    const pill = getByTestId('toast');
    expect(flat(pill)).toMatchObject({
      backgroundColor: lightTokens.primary,
      borderRadius: 999,
    });
    expect(pill.props.accessibilityRole).toBe('alert');
    expect(pill.props.accessibilityLiveRegion).toBe('polite');
    expect(flat(getByText('Your request was shared')).color).toBe(lightTokens.onPrimary);
  });

  it('takes no touches: it never covers a control it is not meant to answer', async () => {
    const { getByTestId } = await renderThemed(<Toast message="Saved" testID="t" />);
    // The wrapper two levels up carries pointerEvents="none".
    let node = getByTestId('t').parent;
    let found = false;
    while (node) {
      if (node.props.pointerEvents === 'none') found = true;
      node = node.parent;
    }
    expect(found).toBe(true);
  });

  it('floats clear of a floating action unless told otherwise', async () => {
    const { getByTestId } = await renderThemed(
      <>
        <Toast message="A" testID="a" />
        <Toast message="B" testID="b" bottom={24} />
      </>
    );
    const bottomOf = (id: string) => {
      let node = getByTestId(id).parent;
      while (node) {
        const style = flat(node);
        if (style.position === 'absolute') return style.bottom;
        node = node.parent;
      }
      return undefined;
    };
    expect(bottomOf('a')).toBe(88);
    expect(bottomOf('b')).toBe(24);
  });

  it('takes the dark palette’s ink at night', async () => {
    await AsyncStorage.setItem('theme_preference', 'dark');
    try {
      const { getByTestId } = await renderThemed(<Toast message="Saved" testID="t" />);
      await waitFor(() =>
        expect(flat(getByTestId('t')).backgroundColor).toBe(darkTokens.primary)
      );
      expect(darkTokens.primary).not.toBe(lightTokens.primary);
    } finally {
      await AsyncStorage.clear();
    }
  });
});

describe('useToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(async () => {
    // A message still up when a test ends takes itself down inside act, as it
    // would on a device, rather than as a stray update after the test.
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('starts silent, shows a message, and takes it down after its time', async () => {
    const { result } = await renderHook(() => useToast());
    expect(result.current.message).toBeNull();

    await act(async () => result.current.show('Your request was shared'));
    expect(result.current.message).toBe('Your request was shared');

    await act(async () => {
      jest.advanceTimersByTime(TOAST_MS - 1);
    });
    expect(result.current.message).toBe('Your request was shared');
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.message).toBeNull();
  });

  it('stays up for long enough to read and short enough to be out of the way', () => {
    expect(TOAST_MS).toBeGreaterThanOrEqual(2500);
    expect(TOAST_MS).toBeLessThanOrEqual(5000);
  });

  it('replaces a message with a newer one and restarts the clock', async () => {
    const { result } = await renderHook(() => useToast());
    await act(async () => result.current.show('First'));
    await act(async () => {
      jest.advanceTimersByTime(TOAST_MS - 100);
    });
    await act(async () => result.current.show('Second'));
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    // The first message's timer would have fired by now; the second's has not.
    expect(result.current.message).toBe('Second');
    await act(async () => {
      jest.advanceTimersByTime(TOAST_MS);
    });
    expect(result.current.message).toBeNull();
  });

  it('cancels its own timer when the screen goes away first', async () => {
    // Otherwise it would fire later and set state on a screen that is gone.
    const set = jest.spyOn(global, 'setTimeout');
    const clear = jest.spyOn(global, 'clearTimeout');
    try {
      const { result, unmount } = await renderHook(() => useToast());
      await act(async () => result.current.show('Gone'));
      const index = set.mock.calls.findIndex(([, ms]) => ms === TOAST_MS);
      expect(index).toBeGreaterThanOrEqual(0);
      const handle = set.mock.results[index].value;

      clear.mockClear();
      await unmount();
      expect(clear).toHaveBeenCalledWith(handle);
    } finally {
      set.mockRestore();
      clear.mockRestore();
    }
  });

  it('keeps `show` the same function across renders, so effects can depend on it', async () => {
    const { result, rerender } = await renderHook(() => useToast());
    const first = result.current.show;
    await act(async () => result.current.show('x'));
    await rerender({});
    expect(result.current.show).toBe(first);
  });
});

describe('FloatingAction', () => {
  it('is a primary pill, at least 48 high, saying what it does in words', async () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = await renderThemed(
      <FloatingAction label="Ask for prayer" onPress={onPress} testID="fab" />
    );
    const fab = getByTestId('fab');
    expect(flat(fab)).toMatchObject({
      minHeight: 48,
      borderRadius: 999,
      backgroundColor: lightTokens.primary,
    });
    expect(fab.props.accessibilityRole).toBe('button');
    expect(fab.props.accessibilityLabel).toBe('Ask for prayer');
    expect(flat(getByText('Ask for prayer')).color).toBe(lightTokens.onPrimary);

    await fireEvent.press(fab);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is placed 20 from the right and 18 above the bottom of its container', async () => {
    const { getByTestId } = await renderThemed(
      <FloatingAction label="New entry" onPress={jest.fn()} testID="fab" />
    );
    let node = getByTestId('fab').parent;
    let placed: Record<string, number | string> | null = null;
    while (node && !placed) {
      const style = flat(node);
      if (style.position === 'absolute') placed = style;
      node = node.parent;
    }
    expect(placed).toMatchObject({ right: 20, bottom: 18 });
  });

  it('lets a touch through everywhere except the button', async () => {
    const { getByTestId } = await renderThemed(
      <FloatingAction label="New entry" onPress={jest.fn()} testID="fab" />
    );
    let node = getByTestId('fab').parent;
    let wrapperEvents: unknown;
    while (node && wrapperEvents === undefined) {
      if (flat(node).position === 'absolute') wrapperEvents = node.props.pointerEvents;
      node = node.parent;
    }
    expect(wrapperEvents).toBe('box-none');
  });

  it('paints the disabled pill, stays announced as disabled, and does not press', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await renderThemed(
      <FloatingAction label="Ask for prayer" onPress={onPress} disabled testID="fab" />
    );
    const fab = getByTestId('fab');
    expect(flat(fab).backgroundColor).toBe(lightTokens.disabledSurface);
    expect(fab.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(fab);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('can float higher, for a screen with something at its foot', async () => {
    const { getByTestId } = await renderThemed(
      <FloatingAction label="Go" onPress={jest.fn()} testID="fab" bottom={72} />
    );
    let node = getByTestId('fab').parent;
    let bottom: unknown;
    while (node && bottom === undefined) {
      if (flat(node).position === 'absolute') bottom = flat(node).bottom;
      node = node.parent;
    }
    expect(bottom).toBe(72);
  });
});

describe('ScreenTitle', () => {
  it('is the headline, a heading, in a row at least 56 high', async () => {
    const { getByText, getByTestId } = await renderThemed(
      <ScreenTitle title="Prayers" testID="title" />
    );
    expect(getByText('Prayers').props.accessibilityRole).toBe('header');
    expect(flat(getByText('Prayers'))).toMatchObject({
      fontSize: 26,
      lineHeight: 32,
      color: lightTokens.ink,
    });
    expect(flat(getByTestId('title')).minHeight).toBe(56);
  });

  it('holds the screen’s icon buttons at the right, shifted to line up with the margin', async () => {
    const { getByTestId } = await renderThemed(
      <ScreenTitle
        title="You"
        trailing={<Text testID="bell">bell</Text>}
        testID="title"
      />
    );
    expect(getByTestId('bell').parent).toBeTruthy();
    const holder = getByTestId('bell').parent!;
    expect(flat(holder).marginRight).toBe(-10);
  });

  it('has no empty holder when there is nothing trailing', async () => {
    const { getByTestId } = await renderThemed(
      <ScreenTitle title="Prayers" testID="title" />
    );
    // Only the title itself sits in the row.
    expect(getByTestId('title').children).toHaveLength(1);
  });

  it('wraps a long title instead of pushing the buttons out', async () => {
    const { getByText } = await renderThemed(
      <ScreenTitle title="ప్రార్థనలు మరియు విన్నపాలు" trailing={<Text>x</Text>} />
    );
    expect(flat(getByText('ప్రార్థనలు మరియు విన్నపాలు'))).toMatchObject({
      flex: 1,
      minWidth: 0,
    });
  });
});
