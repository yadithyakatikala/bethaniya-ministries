import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../context/AuthContext';
import { PreferencesProvider } from '../../context/PreferencesContext';
import { brandGold } from '../tokens';
import { GoldBar, GoldFill, GoldRibbon, GoldRule } from '../ui/GoldLine';

jest.mock('../../services/firebase/app');

/**
 * Gold, kept thin: the three places the brand's metal appears as a LINE.
 *
 * The rule the design set is that gold is lines, small text and brand marks
 * -- never a fill, a background or an icon colour. What is worth pinning is
 * that these lines are drawn in the REAL stops of the active palette (not a
 * stray hex that drifts from the brand), that the rule on a photograph takes
 * the night metal whatever the theme (the daytime brown would vanish on a
 * dark veil), and that none of them says anything to a screen reader.
 */
type Host = {
  type?: string;
  props?: Record<string, unknown>;
  children?: unknown[] | null;
};

function hosts(node: unknown, out: Host[] = []): Host[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((child) => hosts(child, out));
    return out;
  }
  const host = node as Host;
  out.push(host);
  (host.children ?? []).forEach((child) => hosts(child, out));
  return out;
}

/** The native gradient is [offset, argb, offset, argb, ...] with signed 32-bit colours. */
function stopsOf(json: unknown): { offset: number; hex: string; alpha: number }[] {
  const gradient = hosts(json).find((host) => host.type === 'RNSVGLinearGradient')?.props
    ?.gradient as number[] | undefined;
  if (!gradient) throw new Error('no gradient was drawn');
  const stops: { offset: number; hex: string; alpha: number }[] = [];
  for (let i = 0; i < gradient.length; i += 2) {
    const argb = gradient[i + 1] >>> 0;
    stops.push({
      offset: gradient[i],
      hex: `#${(argb & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`,
      alpha: (argb >>> 24) / 255,
    });
  }
  return stops;
}

async function draw(ui: React.ReactElement, theme: 'light' | 'dark' = 'light') {
  await AsyncStorage.setItem('theme_preference', theme);
  const view = await render(
    <AuthProvider>
      <PreferencesProvider>{ui}</PreferencesProvider>
    </AuthProvider>
  );
  // The palette arrives from storage a moment after the first frame.
  await waitFor(() => expect(view.toJSON()).toBeTruthy());
  return view;
}

afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
});

describe('GoldRule', () => {
  it('is a 1-point hairline in its own box', async () => {
    const view = await draw(<GoldRule testID="rule" />);
    const rule = view.getByTestId('rule', { includeHiddenElements: true });
    expect(rule.props.style).toEqual({ height: 1 });
  });

  it('runs base, high, base, then fades out to nothing, in the daytime metal', async () => {
    const view = await draw(<GoldRule />);
    const stops = stopsOf(view.toJSON());
    expect(stops.map((stop) => stop.hex)).toEqual([
      brandGold.light.base,
      brandGold.light.high,
      brandGold.light.base,
      brandGold.light.base,
    ]);
    expect(stops.map((stop) => stop.offset)).toEqual([0, 0.38, 0.7, 1]);
    // ...and the last one is clear: the thread fades out rather than stopping.
    expect(stops[3].alpha).toBe(0);
    expect(stops[0].alpha).toBe(1);
  });

  it('takes the night metal at night', async () => {
    const view = await draw(<GoldRule />, 'dark');
    await waitFor(() =>
      expect(stopsOf(view.toJSON())[0].hex).toBe(brandGold.dark.base.toUpperCase())
    );
  });

  it('takes the night metal over a photograph, whatever the theme', async () => {
    // The daytime gold is a dark brown: on a dark veil it is invisible.
    const view = await draw(<GoldRule tone="photo" />, 'light');
    const stops = stopsOf(view.toJSON());
    expect(stops[0].hex).toBe(brandGold.dark.base.toUpperCase());
    expect(stops[1].hex).toBe(brandGold.dark.high.toUpperCase());
  });

  it('is hidden from a screen reader: a line carries no words', async () => {
    const view = await draw(<GoldRule testID="rule" />);
    const rule = view.getByTestId('rule', { includeHiddenElements: true });
    expect(rule.props.accessibilityElementsHidden).toBe(true);
    expect(rule.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('GoldBar', () => {
  it('stands as tall as the row it is in, rounded to its own width', async () => {
    const view = await draw(<GoldBar width={3} testID="bar" />);
    const style = view
      .getByTestId('bar', { includeHiddenElements: true })
      .props.style.reduce((all: object, part: object) => ({ ...all, ...part }), {});
    expect(style).toMatchObject({ alignSelf: 'stretch', width: 3, borderRadius: 3 });
  });

  it("is 2 across when asked: a Prophet Verse's bar", async () => {
    const view = await draw(<GoldBar width={2} testID="bar" />);
    const parts = view.getByTestId('bar', { includeHiddenElements: true }).props
      .style as {
      width?: number;
    }[];
    expect(parts.some((part) => part.width === 2)).toBe(true);
  });

  it('is brightest at the top and deepest at the foot', async () => {
    const view = await draw(<GoldBar />);
    const stops = stopsOf(view.toJSON());
    expect(stops.map((stop) => stop.hex)).toEqual([
      brandGold.light.high,
      brandGold.light.base,
      brandGold.light.rim,
    ]);
    expect(stops.map((stop) => stop.offset)).toEqual([0, 0.55, 1]);
  });

  it('is decorative', async () => {
    const view = await draw(<GoldBar testID="bar" />);
    expect(
      view.getByTestId('bar', { includeHiddenElements: true }).props
        .accessibilityElementsHidden
    ).toBe(true);
  });
});

describe('GoldFill', () => {
  it('goes from the base metal to the bright one, left to right', async () => {
    const view = await draw(<GoldFill />);
    const stops = stopsOf(view.toJSON());
    expect(stops.map((stop) => stop.hex)).toEqual([
      brandGold.light.base,
      brandGold.light.high,
    ]);
  });

  it('fills whatever box it is given', async () => {
    const view = await draw(<GoldFill testID="fill" />);
    expect(
      view.getByTestId('fill', { includeHiddenElements: true }).props.style
    ).toMatchObject({
      flex: 1,
      overflow: 'hidden',
    });
  });
});

describe('GoldRibbon', () => {
  it('is a 24 by 4 tab: square where it meets the bar, rounded at its foot', async () => {
    const view = await draw(<GoldRibbon testID="ribbon" />);
    const style = view.getByTestId('ribbon', { includeHiddenElements: true }).props.style;
    expect(style).toMatchObject({
      width: 24,
      height: 4,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
      overflow: 'hidden',
    });
    // Nothing rounds the top: it comes out of the bar's edge.
    expect(style.borderTopLeftRadius).toBeUndefined();
    expect(style.borderTopRightRadius).toBeUndefined();
  });

  it('runs base, high, base across, in the daytime metal, and never fades out', async () => {
    const view = await draw(<GoldRibbon />);
    const stops = stopsOf(view.toJSON());
    expect(stops.map((stop) => stop.hex)).toEqual([
      brandGold.light.base,
      brandGold.light.high,
      brandGold.light.base,
    ]);
    expect(stops.map((stop) => stop.offset)).toEqual([0, 0.5, 1]);
    // A ribbon is a solid mark; only the rule is allowed to fade.
    expect(stops.every((stop) => stop.alpha === 1)).toBe(true);
  });

  it('takes the night metal at night', async () => {
    const view = await draw(<GoldRibbon />, 'dark');
    await waitFor(() =>
      expect(stopsOf(view.toJSON())[1].hex).toBe(brandGold.dark.high.toUpperCase())
    );
  });

  it('is decorative: the tab says its name and that it is selected', async () => {
    const view = await draw(<GoldRibbon testID="ribbon" />);
    const ribbon = view.getByTestId('ribbon', { includeHiddenElements: true });
    expect(ribbon.props.accessibilityElementsHidden).toBe(true);
    expect(ribbon.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('gives two ribbons on one screen two different gradients, so neither draws the other', async () => {
    // react-native-svg resolves url(#id) in one namespace; a shared id would
    // paint every ribbon with whichever gradient was registered last.
    const view = await draw(
      <>
        <GoldRibbon />
        <GoldRibbon />
      </>
    );
    const ids = hosts(view.toJSON())
      .filter((host) => host.type === 'RNSVGLinearGradient')
      .map((host) => host.props?.name);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
