import { useState } from 'react';

/**
 * The selected inner tab of a hub (Requests | My journal, Updates | Chat,
 * Saved | Profile), which a member chooses by tapping and which another
 * screen can ask for through the route's `tab` param ("open the Prayers tab
 * on My journal").
 *
 * It starts on the param (or the default). A tap changes it. And when the
 * route is navigated to AGAIN with a different `tab` while the hub is
 * already open -- Saved's "Prayer journal" row, a notification -- the new
 * param wins. That last part is done by adjusting state while rendering, the
 * documented way to follow a changing prop, rather than in an effect, which
 * would paint the wrong tab for a frame first.
 */
export function useRouteTab<T extends string>(
  paramTab: T | undefined,
  fallback: T
): [T, (tab: T) => void] {
  const [tab, setTab] = useState<T>(paramTab ?? fallback);
  const [seenParam, setSeenParam] = useState<T | undefined>(paramTab);
  if (paramTab !== seenParam) {
    setSeenParam(paramTab);
    if (paramTab) setTab(paramTab);
  }
  return [tab, setTab];
}
