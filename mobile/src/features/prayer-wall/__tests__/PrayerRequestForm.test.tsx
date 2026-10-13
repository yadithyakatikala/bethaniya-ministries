import React from 'react';
import { StyleSheet } from 'react-native';
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import {
  MAX_PRAYER_BODY_LENGTH,
  MAX_PRAYER_TITLE_LENGTH,
  PRAYER_CATEGORIES,
  type PrayerRequest,
} from '../../../services/firebase/prayerRequests';
import { lightTokens } from '../../../theme/tokens';
import { PrayerRequestForm } from '../PrayerRequestForm';

jest.mock('../../../services/firebase/app');

/**
 * The "Ask for prayer" sheet. Three things matter most and are asserted
 * hardest: a failed send keeps every word the member wrote, the anonymous
 * promise is stated where the switch is (not behind a hint), and an EDIT never
 * offers the anonymity switch -- it says, with a lock, that it cannot change.
 */
function ui(props: Partial<React.ComponentProps<typeof PrayerRequestForm>> = {}) {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <PrayerRequestForm
          visible
          onClose={jest.fn()}
          onSubmit={jest.fn().mockResolvedValue(undefined)}
          {...props}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

function existing(overrides: Partial<PrayerRequest> = {}): PrayerRequest {
  return {
    id: 'p1',
    title: 'Wisdom for our move',
    body: 'We move to a new city next month.',
    category: 'family',
    anonymous: false,
    authorName: 'Asha',
    status: 'open',
    createdAt: new Date('2026-03-01T09:00:00Z'),
    updatedAt: null,
    removed: false,
    ...overrides,
  };
}

/** Whether a drawn glyph (react-native-svg's host view) is anywhere inside a node. */
function hasGlyph(node: unknown): boolean {
  const { type, children } = node as { type: unknown; children?: unknown[] };
  if (type === 'RNSVGSvgView') return true;
  return (children ?? []).some((child) => typeof child !== 'string' && hasGlyph(child));
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

afterEach(async () => {
  await cleanup();
});

describe('a new request', () => {
  it('is titled "Ask for prayer" and asks for a Subject, Details and a Category', async () => {
    const { getByText, getByTestId } = await render(ui());
    expect(getByText('Ask for prayer')).toBeTruthy();
    expect(getByText('Subject')).toBeTruthy();
    expect(getByText('Details')).toBeTruthy();
    expect(getByText('Category')).toBeTruthy();
    expect(getByTestId('prayer-form-title').props.placeholder).toBe(
      'What would you like prayer for?'
    );
    expect(getByTestId('prayer-form-body').props.placeholder).toBe(
      'Tell the church as much as you would like to share.'
    );
  });

  it('offers "No category" and the six, as a wrap of chips with "No category" chosen', async () => {
    const { getByTestId } = await render(ui());
    expect(getByTestId('prayer-form-category').props.accessibilityRole).toBe(
      'radiogroup'
    );
    expect(
      getByTestId('prayer-form-category-__none__').props.accessibilityState.selected
    ).toBe(true);
    for (const category of PRAYER_CATEGORIES) {
      expect(
        getByTestId(`prayer-form-category-${category}`).props.accessibilityRole
      ).toBe('radio');
    }
    expect(PRAYER_CATEGORIES).toHaveLength(6);
  });

  it('bounds the subject and the details', async () => {
    const { getByTestId } = await render(ui());
    expect(getByTestId('prayer-form-title').props.maxLength).toBe(
      MAX_PRAYER_TITLE_LENGTH
    );
    expect(getByTestId('prayer-form-body').props.maxLength).toBe(MAX_PRAYER_BODY_LENGTH);
  });

  it('offers the anonymous switch, off, with the promise written under it', async () => {
    const { getByTestId } = await render(ui());
    expect(getByTestId('prayer-form-anonymous').props.value).toBe(false);
    const help = getByTestId('prayer-form-anonymous-help');
    expect(help).toHaveTextContent(
      'Other members and the church team will not see your name. The church’s main administrator can look it up, only to deal with a report.'
    );
    // 13/18 muted: a sentence a member can read, not a hint behind a tap.
    expect(flat(help)).toMatchObject({
      fontSize: 13,
      lineHeight: 18,
      color: lightTokens.inkMuted,
    });
  });

  it('names the switch for a screen reader, and hands it the same promise as a hint', async () => {
    const { getByTestId } = await render(ui());
    const toggle = getByTestId('prayer-form-anonymous');
    expect(toggle.props.accessibilityLabel).toBe('Post anonymously');
    expect(toggle.props.accessibilityHint).toContain('will not see your name');
  });

  it('is "Share request", and sends the trimmed words, the category and the choice', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { getByTestId, getByText } = await render(ui({ onSubmit, onClose }));
    expect(getByText('Share request')).toBeTruthy();

    await fireEvent.changeText(getByTestId('prayer-form-title'), '  Wisdom  ');
    await fireEvent.changeText(getByTestId('prayer-form-body'), '  For our move.  ');
    await fireEvent.press(getByTestId('prayer-form-category-guidance'));
    await fireEvent(getByTestId('prayer-form-anonymous'), 'valueChange', true);
    await fireEvent.press(getByTestId('prayer-form-submit'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Wisdom',
        body: 'For our move.',
        category: 'guidance',
        anonymous: true,
      })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('sends no category when "No category" is chosen again', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = await render(ui({ onSubmit }));
    await fireEvent.press(getByTestId('prayer-form-category-healing'));
    await fireEvent.press(getByTestId('prayer-form-category-__none__'));
    await fireEvent.changeText(getByTestId('prayer-form-title'), 'A');
    await fireEvent.changeText(getByTestId('prayer-form-body'), 'B');
    await fireEvent.press(getByTestId('prayer-form-submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].category).toBeNull();
  });
});

describe('validation', () => {
  it('asks for a subject and for details, in words, and sends nothing', async () => {
    const onSubmit = jest.fn();
    const { getByTestId, getByText } = await render(ui({ onSubmit }));
    await fireEvent.press(getByTestId('prayer-form-submit'));
    expect(getByText('Please write a subject.')).toBeTruthy();
    expect(getByText('Please write a little more.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('treats a field of only spaces as empty', async () => {
    const onSubmit = jest.fn();
    const { getByTestId, getByText } = await render(ui({ onSubmit }));
    await fireEvent.changeText(getByTestId('prayer-form-title'), '    ');
    await fireEvent.changeText(getByTestId('prayer-form-body'), 'Something');
    await fireEvent.press(getByTestId('prayer-form-submit'));
    expect(getByText('Please write a subject.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('marks an empty field with the error colour as well as the sentence', async () => {
    const { getByTestId } = await render(ui());
    await fireEvent.press(getByTestId('prayer-form-submit'));
    expect(flat(getByTestId('prayer-form-title')).borderColor).toBe(lightTokens.danger);
    expect(getByTestId('prayer-form-title').props['aria-invalid']).toBe(true);
  });
});

describe('when sending fails', () => {
  it('keeps every word, stays open, and says it could not be shared', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('offline'));
    const onClose = jest.fn();
    const { getByTestId, getByText } = await render(ui({ onSubmit, onClose }));
    await fireEvent.changeText(getByTestId('prayer-form-title'), 'A subject');
    await fireEvent.changeText(getByTestId('prayer-form-body'), 'A long prayer I wrote');
    await fireEvent.press(getByTestId('prayer-form-category-family'));
    await fireEvent(getByTestId('prayer-form-anonymous'), 'valueChange', true);
    await fireEvent.press(getByTestId('prayer-form-submit'));

    await waitFor(() => expect(getByTestId('prayer-form-error')).toBeTruthy());
    expect(getByText('Your request could not be shared.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    // Losing a prayer request to a dropped connection is the one outcome this form must not have.
    expect(getByTestId('prayer-form-title').props.value).toBe('A subject');
    expect(getByTestId('prayer-form-body').props.value).toBe('A long prayer I wrote');
    expect(
      getByTestId('prayer-form-category-family').props.accessibilityState.selected
    ).toBe(true);
    expect(getByTestId('prayer-form-anonymous').props.value).toBe(true);
  });

  it('can be tried again, and the notice goes when it works', async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const { getByTestId, queryByTestId } = await render(ui({ onSubmit }));
    await fireEvent.changeText(getByTestId('prayer-form-title'), 'A');
    await fireEvent.changeText(getByTestId('prayer-form-body'), 'B');
    await fireEvent.press(getByTestId('prayer-form-submit'));
    await waitFor(() => expect(getByTestId('prayer-form-error')).toBeTruthy());

    await fireEvent.press(getByTestId('prayer-form-submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(queryByTestId('prayer-form-error')).toBeNull());
  });
});

describe('editing a request', () => {
  it('is titled "Edit your request", filled in with what was written', async () => {
    const { getByText, getByTestId } = await render(ui({ editing: existing() }));
    expect(getByText('Edit your request')).toBeTruthy();
    expect(getByTestId('prayer-form-title').props.value).toBe('Wisdom for our move');
    expect(getByTestId('prayer-form-body').props.value).toBe(
      'We move to a new city next month.'
    );
    expect(
      getByTestId('prayer-form-category-family').props.accessibilityState.selected
    ).toBe(true);
  });

  it('says "Save", not "Share request"', async () => {
    const { getByText, queryByText } = await render(ui({ editing: existing() }));
    expect(getByText('Save')).toBeTruthy();
    expect(queryByText('Share request')).toBeNull();
  });

  it('does NOT offer the anonymity switch: it says, with a lock, that it cannot change', async () => {
    const { getByTestId, queryByTestId } = await render(ui({ editing: existing() }));
    expect(queryByTestId('prayer-form-anonymous')).toBeNull();
    expect(queryByTestId('prayer-form-anonymous-help')).toBeNull();
    const locked = getByTestId('prayer-form-anonymous-locked');
    expect(
      within(locked).getByText('Whether this request shows your name cannot be changed.')
    ).toBeTruthy();
    // The lock is a drawn glyph in front of the sentence.
    expect(hasGlyph(locked)).toBe(true);
  });

  it('saves the edit, keeping the request’s anonymity as it was', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = await render(
      ui({ editing: existing({ anonymous: true, authorName: null }), onSubmit })
    );
    await fireEvent.changeText(getByTestId('prayer-form-title'), 'Wisdom, please');
    await fireEvent.press(getByTestId('prayer-form-submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // The form carries the original choice through; the service strips what it must.
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Wisdom, please',
      anonymous: true,
    });
  });
});

describe('the sheet', () => {
  it('draws nothing while it is not visible', async () => {
    const { queryByTestId } = await render(ui({ visible: false }));
    expect(queryByTestId('prayer-form-title')).toBeNull();
  });

  it('closes from its own Close button', async () => {
    const onClose = jest.fn();
    const { getAllByRole } = await render(ui({ onClose }));
    const close = getAllByRole('button').find(
      (b) => b.props.accessibilityLabel === 'Close'
    );
    expect(close).toBeTruthy();
    await fireEvent.press(close!);
    expect(onClose).toHaveBeenCalled();
  });
});
