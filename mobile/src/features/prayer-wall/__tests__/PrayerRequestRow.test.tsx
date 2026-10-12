import React from 'react';
import { StyleSheet } from 'react-native';
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fontFamilies, lightTokens } from '../../../theme/tokens';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { AuthProvider } from '../../../context/AuthContext';
import { PrayerRequestRow } from '../PrayerRequestRow';
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

function renderRow(props: Partial<Parameters<typeof PrayerRequestRow>[0]> = {}) {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <PrayerRequestRow
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
    const screen = await renderRow();
    expect(screen.getByTestId('prayer-request-author-p1')).toBeTruthy();
    expect(screen.getByText('Asha Kumar')).toBeTruthy();
  });

  it('shows the words and the status', async () => {
    const screen = await renderRow();
    expect(screen.getByText('Please pray')).toBeTruthy();
    expect(screen.getByText('For my family this week.')).toBeTruthy();
    expect(screen.getByTestId('prayer-request-status-p1')).toBeTruthy();
  });
});

describe('an anonymous request', () => {
  it('shows the word Anonymous instead of a name', async () => {
    const screen = await renderRow({
      request: request({ anonymous: true, authorName: null }),
    });
    expect(screen.getByText('Anonymous')).toBeTruthy();
  });

  it('renders NOTHING that identifies the author, anywhere in the tree', async () => {
    // Text, testIDs and accessibility labels all live in the rendered
    // tree, so serialising the whole thing catches a leak into any of
    // them -- including the accessibility label, which a visual review
    // would never see.
    const screen = await renderRow({
      request: request({ anonymous: true, authorName: null }),
    });
    const tree = renderedText(screen);
    expect(tree).not.toContain('Asha');
    expect(tree).not.toContain('member-1');
    expect(tree).toContain('Anonymous');
  });

  it('still shows the request itself', async () => {
    const screen = await renderRow({
      request: request({ anonymous: true, authorName: null }),
    });
    expect(screen.getByText('Please pray')).toBeTruthy();
  });
});

describe('a removed request', () => {
  it('leaves a tombstone rather than a gap', async () => {
    const screen = await renderRow({ request: request({ removed: true }) });
    expect(screen.getByTestId('prayer-request-p1')).toBeTruthy();
    expect(screen.getByText('This request was removed.')).toBeTruthy();
  });

  it('does not show the words that were removed', async () => {
    const screen = await renderRow({ request: request({ removed: true }) });
    expect(screen.queryByText('For my family this week.')).toBeNull();
  });
});

describe('what each reader can do', () => {
  it('offers edit, answered and delete on your OWN request', async () => {
    const screen = await renderRow({ isOwn: true });
    expect(screen.getByTestId('prayer-request-edit-p1')).toBeTruthy();
    expect(screen.getByTestId('prayer-request-answered-p1')).toBeTruthy();
    expect(screen.getByTestId('prayer-request-delete-p1')).toBeTruthy();
    // Reporting your own request is not a thing anybody means to do.
    expect(screen.queryByTestId('prayer-request-report-p1')).toBeNull();
  });

  it('offers only report on somebody else’s', async () => {
    const screen = await renderRow({ isOwn: false });
    expect(screen.getByTestId('prayer-request-report-p1')).toBeTruthy();
    expect(screen.queryByTestId('prayer-request-delete-p1')).toBeNull();
  });

  it('says so, and disables the control, once you have reported it', async () => {
    const screen = await renderRow({ alreadyReported: true });
    const report = screen.getByTestId('prayer-request-report-p1');
    expect(report.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText('Reported')).toBeTruthy();
  });

  it('labels delete with WHAT is being deleted, for a screen reader', async () => {
    const screen = await renderRow({ isOwn: true });
    expect(
      screen.getByTestId('prayer-request-delete-p1').props.accessibilityLabel
    ).toContain('Please pray');
  });
});

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
});

describe('the row, as designed', () => {
  it('is a hairline row, not a card: a foot rule and no box', async () => {
    const screen = await renderRow();
    const style = flat(screen.getByTestId('prayer-request-p1'));
    expect(style).toMatchObject({
      borderBottomWidth: 1,
      borderBottomColor: lightTokens.border,
    });
    expect(style.borderWidth).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderRadius).toBeUndefined();
  });

  it('puts who and when on one line: the name bold, the date quiet, at the right', async () => {
    const screen = await renderRow();
    expect(flat(screen.getByTestId('prayer-request-author-p1'))).toMatchObject({
      fontFamily: fontFamilies.interfaceSemiBold,
      fontSize: 14,
      lineHeight: 20,
      color: lightTokens.ink,
    });
    // 1 March: day first, no year for the current year, with the year for any other.
    expect(screen.getByText(/^1 Mar( \d{4})?$/)).toBeTruthy();
  });

  it('sets the subject at 17/24 semibold and the words at 16/24, in ink', async () => {
    const screen = await renderRow();
    expect(flat(screen.getByText('Please pray'))).toMatchObject({
      fontFamily: fontFamilies.interfaceSemiBold,
      fontSize: 17,
      lineHeight: 24,
      color: lightTokens.ink,
    });
    expect(flat(screen.getByText('For my family this week.'))).toMatchObject({
      fontFamily: fontFamilies.interfaceRegular,
      fontSize: 16,
      lineHeight: 24,
    });
  });

  it('gives Telugu the leading its marks need', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const screen = await renderRow({
      request: request({ title: 'ప్రార్థన కావాలి', body: 'ఈ వారం నా కుటుంబం కోసం.' }),
    });
    await waitFor(() =>
      expect(flat(screen.getByText('ప్రార్థన కావాలి')).lineHeight).toBe(28)
    );
    expect(flat(screen.getByText('ఈ వారం నా కుటుంబం కోసం.')).lineHeight).toBe(29);
  });

  it('shows the status and the category as quiet, neutral badges', async () => {
    const screen = await renderRow();
    const status = screen.getByTestId('prayer-request-status-p1');
    expect(within(status).getByText('Praying')).toBeTruthy();
    expect(flat(status).backgroundColor).toBe(lightTokens.surfaceRaised);
    // The category is not a status: the same neutral, never the retired Info blue.
    expect(screen.getByText('Family')).toBeTruthy();
  });

  it('marks an answered request with a success tint and a tick, beside the word', async () => {
    const screen = await renderRow({ request: request({ status: 'answered' }) });
    const status = screen.getByTestId('prayer-request-status-p1');
    expect(within(status).getByText('Answered')).toBeTruthy();
    expect(flat(status).backgroundColor).toBe(lightTokens.successTint);
    // The tick is a drawn glyph in the badge, not a character in the word.
    expect(JSON.stringify(screen.toJSON())).toContain('RNSVGSvgView');
  });

  it('draws no tick on one that is still being prayed for', async () => {
    const screen = await renderRow();
    expect(JSON.stringify(screen.toJSON())).not.toContain('RNSVGSvgView');
  });

  it('shows no category badge for a request with none', async () => {
    const screen = await renderRow({ request: request({ category: null }) });
    expect(screen.queryByText('Family')).toBeNull();
  });

  it('puts "Report" at the right edge as a plain word, in the quiet ink, 44 high', async () => {
    const screen = await renderRow();
    const report = screen.getByTestId('prayer-request-report-p1');
    expect(flat(report)).toMatchObject({ minHeight: 44, marginLeft: 'auto' });
    expect(flat(screen.getByText('Report'))).toMatchObject({
      color: lightTokens.inkMuted,
      fontSize: 13.5,
    });
  });

  it('fires onReport, and says "Reported" in the disabled ink once it has been', async () => {
    const onReport = jest.fn();
    const screen = await renderRow({ onReport });
    await fireEvent.press(screen.getByTestId('prayer-request-report-p1'));
    expect(onReport).toHaveBeenCalledTimes(1);
    await screen.unmount();

    const done = await renderRow({ alreadyReported: true, onReport });
    expect(flat(done.getByText('Reported')).color).toBe(lightTokens.disabledInk);
    await fireEvent.press(done.getByTestId('prayer-request-report-p1'));
    expect(onReport).toHaveBeenCalledTimes(1);
  });
});

describe('your own request', () => {
  it('is marked by "Your request" in gold ink, not by a name', async () => {
    const screen = await renderRow({ isOwn: true });
    const author = screen.getByTestId('prayer-request-author-p1');
    expect(author).toHaveTextContent('Your request');
    expect(flat(author).color).toBe(lightTokens.accent);
    expect(screen.queryByText('Asha Kumar')).toBeNull();
  });

  it('carries a thin gold thread down its left edge, and indents the words from it', async () => {
    const screen = await renderRow({ isOwn: true });
    expect(flat(screen.getByTestId('prayer-request-p1')).paddingLeft).toBe(16);
    // The thread is the one gradient drawn on the row.
    expect(JSON.stringify(screen.toJSON())).toContain('RNSVGLinearGradient');
  });

  it("has no thread on somebody else's", async () => {
    const screen = await renderRow({ isOwn: false });
    expect(JSON.stringify(screen.toJSON())).not.toContain('RNSVGLinearGradient');
    expect(flat(screen.getByTestId('prayer-request-p1')).paddingLeft).toBeUndefined();
  });

  it('sets Edit and Mark answered in gold ink and Delete in the error colour, each 44 high', async () => {
    const screen = await renderRow({ isOwn: true });
    expect(flat(screen.getByText('Edit')).color).toBe(lightTokens.accent);
    expect(flat(screen.getByText('Mark answered')).color).toBe(lightTokens.accent);
    expect(flat(screen.getByText('Delete')).color).toBe(lightTokens.danger);
    for (const id of ['edit', 'answered', 'delete']) {
      expect(flat(screen.getByTestId(`prayer-request-${id}-p1`)).minHeight).toBe(44);
    }
  });

  it('says "Still praying" on one that was answered, to undo it', async () => {
    const screen = await renderRow({
      isOwn: true,
      request: request({ status: 'answered' }),
    });
    expect(screen.getByText('Still praying')).toBeTruthy();
    expect(screen.queryByText('Mark answered')).toBeNull();
  });

  it('wires each action to its own handler', async () => {
    const handlers = {
      onEdit: jest.fn(),
      onToggleAnswered: jest.fn(),
      onDelete: jest.fn(),
    };
    const screen = await renderRow({ isOwn: true, ...handlers });
    await fireEvent.press(screen.getByTestId('prayer-request-edit-p1'));
    await fireEvent.press(screen.getByTestId('prayer-request-answered-p1'));
    await fireEvent.press(screen.getByTestId('prayer-request-delete-p1'));
    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleAnswered).toHaveBeenCalledTimes(1);
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });
});

describe('the tombstone, as designed', () => {
  it('is a quiet raised box with a 12 radius, its sentence centred', async () => {
    const screen = await renderRow({ request: request({ removed: true }) });
    expect(flat(screen.getByTestId('prayer-request-p1'))).toMatchObject({
      backgroundColor: lightTokens.surfaceRaised,
      borderRadius: 12,
      alignItems: 'center',
    });
    expect(flat(screen.getByText('This request was removed.'))).toMatchObject({
      textAlign: 'center',
      color: lightTokens.inkMuted,
    });
  });

  it('offers nothing to do to something that is gone', async () => {
    const screen = await renderRow({ request: request({ removed: true }), isOwn: true });
    for (const id of ['edit', 'answered', 'delete', 'report']) {
      expect(screen.queryByTestId(`prayer-request-${id}-p1`)).toBeNull();
    }
  });
});
