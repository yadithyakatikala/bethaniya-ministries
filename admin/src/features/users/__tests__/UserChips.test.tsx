import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountStateChip, RoleChip } from '../UserChips';
import { SUSPENSION_STATE_LABELS, type SuspensionState } from '../suspension';
import { ROLE_LABELS, type UserRole } from '../../../types';

describe('RoleChip', () => {
  const roles: UserRole[] = ['super_admin', 'content_admin', 'host', 'member'];

  it.each(roles)('names the %s role in words', (role) => {
    render(<RoleChip role={role} />);
    expect(screen.getByText(ROLE_LABELS[role])).toBeInTheDocument();
  });
});

describe('AccountStateChip', () => {
  const states: SuspensionState[] = ['active', 'temporary', 'permanent', 'expired'];

  it.each(states)('says the %s state in words and records it', (state) => {
    render(<AccountStateChip state={state} testId="chip" />);
    expect(screen.getByTestId('chip')).toHaveTextContent(SUSPENSION_STATE_LABELS[state]);
    expect(screen.getByTestId('chip')).toHaveAttribute('data-state', state);
  });

  it('gives every state its own shape, so colour is never the only signal', () => {
    const shapes = new Set<string>();
    for (const state of states) {
      const { container, unmount } = render(<AccountStateChip state={state} />);
      shapes.add(container.querySelector('svg')?.innerHTML ?? '');
      unmount();
    }
    expect(shapes.size).toBe(states.length);
  });

  it('keeps an expired suspension apart from a live one', () => {
    // The row says "this happened", not "this is happening".
    const live = render(<AccountStateChip state="temporary" testId="live" />);
    const liveLook = getComputedStyle(live.getByTestId('live')).color;
    live.unmount();
    render(<AccountStateChip state="expired" testId="over" />);
    expect(getComputedStyle(screen.getByTestId('over')).color).not.toBe(liveLook);
  });
});
