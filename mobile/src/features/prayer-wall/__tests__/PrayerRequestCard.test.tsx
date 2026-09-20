import React from 'react';
import { render } from '@testing-library/react-native';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { AuthProvider } from '../../../context/AuthContext';
import { PrayerRequestCard } from '../PrayerRequestCard';
import type { PrayerRequest } from '../../../services/firebase/prayerRequests';

jest.mock('../../../services/firebase/app');

/**
 * What a prayer request shows, and -- the point of this file -- what it
 * cannot show.
 *
 * ../../../services/firebase/prayerRequests.ts proves an anonymous
 * request never carries an identity. This proves the RENDERED card
 * cannot leak one either: not in its text, not in a testID, and not in
 * an accessibility label, which is the leak that a visual review misses
 * because nobody sees it.
 */
function request(overrides: Partial<PrayerRequest> = {}): PrayerRequest {
  return {
    id: 'p1',
    title: 'Please pray',
    body: 'For my family this week.',
    category: 'family',
    anonymous: false,
    authorName: 'Asha Kumar',
    status: 'open',
    createdAt: new Date('2026-03-01T09:00:00Z'),
    updatedAt: null,
    removed: false,
    ...overrides,
  };
}

function renderCard(props: Partial<Parameters<typeof PrayerRequestCard>[0]> = {}) {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <PrayerRequestCard
          request={request()}
          isOwn={false}
          alreadyReported={false}
          onEdit={jest.fn()}
          onToggleAnswered={jest.fn()}
          onDelete={jest.fn()}
          onReport={jest.fn()}
          {...props}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

/** Every string the card rendered, flattened.
 *
 * `render()` is awaited in this version of the testing library, so the
 * helper takes what the await produced rather than ReturnType<typeof
 * render>, which is the Promise. */
function renderedText(tree: { toJSON: () => unknown }): string {
  return JSON.stringify(tree.toJSON());
}

describe('a named request', () => {
  it('shows the author', async () => {
    const screen = await renderCard();
    expect(screen.getByTestId('prayer-request-author-p1')).toBeTruthy();
    expect(screen.getByText('Asha Kumar')).toBeTruthy();
  });

  it('shows the words and the status', async () => {
    const screen = await renderCard();
    expect(screen.getByText('Please pray')).toBeTruthy();
    expect(screen.getByText('For my family this week.')).toBeTruthy();
    expect(screen.getByTestId('prayer-request-status-p1')).toBeTruthy();
  });
});

describe('an anonymous request', () => {
  it('shows the word Anonymous instead of a name', async () => {
    const screen = await renderCard({
      request: request({ anonymous: true, authorName: null }),
    });
    expect(screen.getByText('Anonymous')).toBeTruthy();
  });

  it('renders NOTHING that identifies the author, anywhere in the tree', async () => {
    // Text, testIDs and accessibility labels all live in the rendered
    // tree, so serialising the whole thing catches a leak into any of
    // them -- including the accessibility label, which a visual review
    // would never see.
    const screen = await renderCard({
      request: request({ anonymous: true, authorName: null }),
    });
    const tree = renderedText(screen);
    expect(tree).not.toContain('Asha');
    expect(tree).not.toContain('member-1');
    expect(tree).toContain('Anonymous');
  });

  it('still shows the request itself', async () => {
    const screen = await renderCard({
      request: request({ anonymous: true, authorName: null }),
    });
    expect(screen.getByText('Please pray')).toBeTruthy();
  });
});

describe('a removed request', () => {
  it('leaves a tombstone rather than a gap', async () => {
    const screen = await renderCard({ request: request({ removed: true }) });
    expect(screen.getByTestId('prayer-request-p1')).toBeTruthy();
    expect(screen.getByText('This request was removed.')).toBeTruthy();
  });

  it('does not show the words that were removed', async () => {
    const screen = await renderCard({ request: request({ removed: true }) });
    expect(screen.queryByText('For my family this week.')).toBeNull();
  });
});

describe('what each reader can do', () => {
  it('offers edit, answered and delete on your OWN request', async () => {
    const screen = await renderCard({ isOwn: true });
    expect(screen.getByTestId('prayer-request-edit-p1')).toBeTruthy();
    expect(screen.getByTestId('prayer-request-answered-p1')).toBeTruthy();
    expect(screen.getByTestId('prayer-request-delete-p1')).toBeTruthy();
    // Reporting your own request is not a thing anybody means to do.
    expect(screen.queryByTestId('prayer-request-report-p1')).toBeNull();
  });

  it('offers only report on somebody else’s', async () => {
    const screen = await renderCard({ isOwn: false });
    expect(screen.getByTestId('prayer-request-report-p1')).toBeTruthy();
    expect(screen.queryByTestId('prayer-request-delete-p1')).toBeNull();
  });

  it('says so, and disables the control, once you have reported it', async () => {
    const screen = await renderCard({ alreadyReported: true });
    const report = screen.getByTestId('prayer-request-report-p1');
    expect(report.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText('Reported')).toBeTruthy();
  });

  it('labels delete with WHAT is being deleted, for a screen reader', async () => {
    const screen = await renderCard({ isOwn: true });
    expect(
      screen.getByTestId('prayer-request-delete-p1').props.accessibilityLabel
    ).toContain('Please pray');
  });
});
