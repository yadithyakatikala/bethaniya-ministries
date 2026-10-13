import { useEffect } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { useRouteTab } from '../useRouteTab';

type Tab = 'requests' | 'journal';

function setup(initial: Tab | undefined) {
  return renderHook(
    (props: { param: Tab | undefined }) => useRouteTab(props.param, 'requests'),
    {
      initialProps: { param: initial },
    }
  );
}

describe('useRouteTab', () => {
  it('starts on the default when the route asks for nothing', async () => {
    const { result } = await setup(undefined);
    expect(result.current[0]).toBe('requests');
  });

  it('starts on the tab the route asks for', async () => {
    const { result } = await setup('journal');
    expect(result.current[0]).toBe('journal');
  });

  it('follows a tap', async () => {
    const { result } = await setup(undefined);
    await act(async () => result.current[1]('journal'));
    expect(result.current[0]).toBe('journal');
    await act(async () => result.current[1]('requests'));
    expect(result.current[0]).toBe('requests');
  });

  it('moves to a NEW tab when the route is navigated to again with a different one', async () => {
    // Saved's "Prayer journal" row, or a notification, sends the member to a
    // hub that is already open.
    const { result, rerender } = await setup(undefined);
    await rerender({ param: 'journal' });
    expect(result.current[0]).toBe('journal');
  });

  it('never paints the old tab after the route has asked for another', async () => {
    // Following a param by adjusting state while rendering means React throws
    // the stale render away before it is committed -- so the screen is never
    // shown on the wrong tab for a frame, as it would be with an effect.
    const committed: Tab[] = [];
    const { rerender } = await renderHook(
      (props: { param: Tab | undefined }) => {
        const [tab] = useRouteTab(props.param, 'requests');
        useEffect(() => {
          committed.push(tab);
        });
        return tab;
      },
      { initialProps: { param: undefined as Tab | undefined } }
    );
    expect(committed).toEqual(['requests']);

    await rerender({ param: 'journal' });
    expect(committed).toEqual(['requests', 'journal']);
    // ...and exactly one commit for the change, not two.
    expect(committed.filter((tab) => tab === 'journal')).toHaveLength(1);
  });

  it("keeps the member's own choice when the param is cleared", async () => {
    // Pressing a tab in the bar navigates with no params: that must not snap
    // the hub back to its default view.
    const { result, rerender } = await setup('journal');
    await act(async () => result.current[1]('requests'));
    await rerender({ param: undefined });
    expect(result.current[0]).toBe('requests');
  });

  it('keeps the member’s tap when the same param is delivered again', async () => {
    const { result, rerender } = await setup('journal');
    await act(async () => result.current[1]('requests'));
    await rerender({ param: 'journal' });
    // The param did not CHANGE (it was 'journal' all along): the tap stands.
    expect(result.current[0]).toBe('requests');
  });

  it('can be sent back to a tab it left, by a later change of param', async () => {
    const { result, rerender } = await setup('journal');
    await rerender({ param: 'requests' });
    expect(result.current[0]).toBe('requests');
    await rerender({ param: 'journal' });
    expect(result.current[0]).toBe('journal');
  });
});
