import React from 'react';
import { cleanup, render } from '@testing-library/react-native';
import { OpeningCanvas } from '../OpeningCanvas';
import { scenePalette } from '../palette';
import {
  FISH_SCALE,
  FISH_STROKE,
  LOGO,
  OPENING_DURATION,
  SPEED,
  T,
  TIERS,
} from '../engine/constants';
import { renderOpeningFrame } from '../engine/frame';
import { getOpeningScene } from '../engine/scene';
import { LETTER_PATHS } from '../engine/wordmark';
import { brandGold, darkTokens, lightTokens } from '../../../theme/tokens';

afterEach(async () => {
  await cleanup();
});

type HostNode = {
  type: string;
  props: Record<string, unknown>;
  children?: (HostNode | string)[];
};

function walk(node: HostNode, out: HostNode[] = []): HostNode[] {
  out.push(node);
  for (const child of node.children ?? [])
    if (typeof child === 'object') walk(child, out);
  return out;
}

const scene = getOpeningScene();
const light = scenePalette(lightTokens, brandGold.light);
const dark = scenePalette(darkTokens, brandGold.dark);
const portrait = { uri: 'portrait' };

async function draw(seconds: number, palette = light) {
  const view = await render(
    <OpeningCanvas
      frame={renderOpeningFrame(scene, seconds)}
      palette={palette}
      portrait={portrait}
    />
  );
  return { ...view, nodes: walk(view.toJSON() as unknown as HostNode) };
}

describe('OpeningCanvas', () => {
  it("paints the app's own paper behind the scene, in both themes", async () => {
    const a = await draw(0, light);
    const root = a.getByTestId('opening-canvas');
    expect(JSON.stringify(root.props.style)).toContain(lightTokens.paper);
    await a.unmount();

    const b = await draw(0, dark);
    expect(JSON.stringify(b.getByTestId('opening-canvas').props.style)).toContain(
      darkTokens.paper
    );
  });

  it('draws the film in its own 320 x 660 space, covering the screen', async () => {
    const { nodes } = await draw(0);
    const svg = nodes.find((n) => n.type === 'RNSVGSvgView')!;
    expect(svg.props.vbWidth).toBe(320);
    expect(svg.props.vbHeight).toBe(660);
    expect(svg.props.align).toBe('xMidYMid');
    expect(svg.props.meetOrSlice).toBe(1); // slice: the scene covers the screen
  });

  it('never intercepts touches: the overlay owns them', async () => {
    const { getByTestId } = await draw(0);
    expect(getByTestId('opening-canvas').props.pointerEvents).toBe('none');
  });

  it('clips the real portrait to a circle at the approved place and size', async () => {
    const { nodes } = await draw(0.8);
    const image = nodes.find((n) => n.type === 'RNSVGImage')!;
    expect(image.props.src).toEqual(portrait);
    expect(image.props.x).toBe(LOGO.x - LOGO.r);
    expect(image.props.y).toBe(LOGO.y - LOGO.r);
    expect(image.props.width).toBe(LOGO.r * 2);
    expect(image.props.height).toBe(LOGO.r * 2);
    const clip = nodes.find((n) => n.type === 'RNSVGClipPath')!;
    expect(image.props.clipPath).toBe(clip.props.name);
    const circle = (clip.children as HostNode[])[0];
    expect([circle.props.cx, circle.props.cy, circle.props.r]).toEqual([
      LOGO.x,
      LOGO.y,
      LOGO.r,
    ]);
  });

  it('scales the portrait about its own centre as it fades in', async () => {
    const seconds = 0.2;
    const { nodes } = await draw(seconds);
    const f = renderOpeningFrame(scene, seconds);
    const logoGroup = nodes.find(
      (n) => n.type === 'RNSVGGroup' && n.props.opacity === f.logo.opacity
    )!;
    const s = f.logo.scale;
    const expected = [s, 0, 0, s, LOGO.x * (1 - s), LOGO.y * (1 - s)];
    (logoGroup.props.matrix as number[]).forEach((v, i) =>
      expect(v).toBeCloseTo(expected[i], 6)
    );
  });

  it('places the fish exactly as translate(x y) rotate(heading) scale(0.58) would', async () => {
    for (const t of [1.2, 1.9, 2.6]) {
      const f = renderOpeningFrame(scene, t);
      const { nodes, unmount } = await draw(t);
      const fish = nodes.find(
        (n) =>
          n.type === 'RNSVGGroup' &&
          (n.children ?? []).length === 2 &&
          (n.children as HostNode[]).every((c) => c.props.strokeWidth === FISH_STROKE)
      )!;
      expect(fish.props.opacity).toBe(f.fish.opacity);
      const r = (f.fish.angle * Math.PI) / 180;
      const c = Math.cos(r) * FISH_SCALE;
      const n = Math.sin(r) * FISH_SCALE;
      const expected = [c, n, -n, c, f.fish.x, f.fish.y];
      (fish.props.matrix as number[]).forEach((v, i) =>
        expect(v).toBeCloseTo(expected[i], 6)
      );
      await unmount();
    }
  });

  it('paints the wordmark with one gold gradient laid across all nine letters', async () => {
    const { nodes } = await draw(OPENING_DURATION);
    const letters = nodes.filter(
      (n) => n.type === 'RNSVGPath' && LETTER_PATHS.includes(n.props.d as string)
    );
    expect(letters).toHaveLength(9);
    const fills = new Set(letters.map((l) => JSON.stringify(l.props.fill)));
    expect(fills.size).toBe(1); // every letter references the same gradient
    const gradient = nodes.find(
      (n) => n.type === 'RNSVGLinearGradient' && n.props.gradientUnits === 1
    )!;
    // userSpaceOnUse, spanning the word, resting at 0 once the sheen has crossed.
    expect([gradient.props.x1, gradient.props.x2]).toEqual(['84', '236']);
    expect(gradient.props.gradientTransform).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('shows no letters, haze or ribbons before their beats', async () => {
    const { nodes } = await draw(0.3);
    expect(
      nodes.filter(
        (n) => n.type === 'RNSVGPath' && LETTER_PATHS.includes(n.props.d as string)
      )
    ).toHaveLength(0);
    // The only paths are the two fish arcs (invisible at this point).
    expect(nodes.filter((n) => n.type === 'RNSVGPath')).toHaveLength(2);
  });

  it('carries the gold as brightness tiers while the fish flies', async () => {
    const { nodes } = await draw(2.0 * SPEED);
    const tiers = nodes.filter(
      (n) =>
        n.type === 'RNSVGPath' &&
        n.props.strokeLinecap === 1 &&
        n.props.strokeWidth !== FISH_STROKE
    );
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers.length).toBeLessThanOrEqual(TIERS);
  });

  it('gives every canvas its own gradient ids', async () => {
    const f = renderOpeningFrame(scene, T.letters[1] * SPEED);
    const view = await render(
      <>
        <OpeningCanvas frame={f} palette={light} portrait={portrait} />
        <OpeningCanvas frame={f} palette={light} portrait={portrait} />
      </>
    );
    const names = walk(view.toJSON() as unknown as HostNode)
      .filter((n) => n.type === 'RNSVGLinearGradient' || n.type === 'RNSVGRadialGradient')
      .map((n) => n.props.name as string);
    expect(names).toHaveLength(8); // four gradients per canvas
    expect(new Set(names).size).toBe(8);
  });
});
