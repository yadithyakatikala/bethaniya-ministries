import React from 'react';
import { StyleSheet } from 'react-native';
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { REPORT_REASONS, submitReport } from '../../../services/firebase/reports';
import { ReportSheet } from '../ReportSheet';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/reports', () => ({
  ...jest.requireActual('../../../services/firebase/reports'),
  submitReport: jest.fn(),
}));

/**
 * The one report sheet, used for a prayer request, a chat message, a media post
 * and a comment. What matters, and what these defend: NO REASON IS ASSUMED (a
 * member who taps "Send report" without reading must not have reported a
 * testimony as an advertisement), the report names the content and never its
 * author, and a failure keeps what was typed.
 */
function ui(props: Partial<React.ComponentProps<typeof ReportSheet>> = {}) {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <ReportSheet
          visible
          onClose={jest.fn()}
          targetType="prayer_request"
          targetId="p1"
          onReported={jest.fn()}
          {...props}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

beforeEach(() => {
  jest.clearAllMocks();
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'reporter-1', displayName: 'Asha', email: null, phoneNumber: null });
    return jest.fn();
  });
  (submitReport as jest.Mock).mockResolvedValue(undefined);
});

afterEach(async () => {
  await cleanup();
});

describe('the reasons', () => {
  it('offers all seven, as a wrap of chips -- a radiogroup, not a track of three', async () => {
    const { getByTestId } = await render(ui());
    const group = getByTestId('report-sheet-reason');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    for (const reason of REPORT_REASONS) {
      expect(getByTestId(`report-sheet-reason-${reason}`).props.accessibilityRole).toBe(
        'radio'
      );
    }
    expect(REPORT_REASONS).toHaveLength(7);
  });

  it('assumes none: nothing is chosen when it opens', async () => {
    const { getByTestId } = await render(ui());
    for (const reason of REPORT_REASONS) {
      expect(
        getByTestId(`report-sheet-reason-${reason}`).props.accessibilityState.selected
      ).toBe(false);
    }
  });

  it('chooses the one that is pressed, and only that one', async () => {
    const { getByTestId } = await render(ui());
    await fireEvent.press(getByTestId('report-sheet-reason-harassment'));
    expect(
      getByTestId('report-sheet-reason-harassment').props.accessibilityState.selected
    ).toBe(true);
    expect(
      getByTestId('report-sheet-reason-spam').props.accessibilityState.selected
    ).toBe(false);

    await fireEvent.press(getByTestId('report-sheet-reason-hate'));
    expect(
      getByTestId('report-sheet-reason-harassment').props.accessibilityState.selected
    ).toBe(false);
    expect(
      getByTestId('report-sheet-reason-hate').props.accessibilityState.selected
    ).toBe(true);
  });

  it('says them in plain words, in the order they are triaged by', async () => {
    const { getByText } = await render(ui());
    for (const label of [
      'Spam or advertising',
      'Harassment or bullying',
      'Hateful language',
      'Sexual content',
      'Violence or threats',
      'False information',
      'Something else',
    ]) {
      expect(getByText(label)).toBeTruthy();
    }
  });
});

describe('sending', () => {
  it('waits for a reason: "Send report" is disabled until one is chosen', async () => {
    const { getByTestId } = await render(ui());
    expect(getByTestId('report-sheet-submit').props.accessibilityState.disabled).toBe(
      true
    );
    await fireEvent.press(getByTestId('report-sheet-submit'));
    expect(submitReport).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId('report-sheet-reason-sexual'));
    expect(getByTestId('report-sheet-submit').props.accessibilityState.disabled).toBe(
      false
    );
  });

  it('reports the CONTENT, with the reason chosen and the words typed, and the reporter on it', async () => {
    const { getByTestId } = await render(
      ui({ targetType: 'community_message', targetId: 'm9' })
    );
    await fireEvent.press(getByTestId('report-sheet-reason-violence'));
    await fireEvent.changeText(
      getByTestId('report-sheet-details'),
      'They threatened someone.'
    );
    await fireEvent.press(getByTestId('report-sheet-submit'));

    await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
    expect((submitReport as jest.Mock).mock.calls[0][0]).toMatchObject({
      reporterUid: 'reporter-1',
      targetType: 'community_message',
      targetId: 'm9',
      reason: 'violence',
      details: 'They threatened someone.',
    });
  });

  it('never carries the author of what is reported', async () => {
    const { getByTestId } = await render(ui());
    await fireEvent.press(getByTestId('report-sheet-reason-spam'));
    await fireEvent.press(getByTestId('report-sheet-submit'));
    await waitFor(() => expect(submitReport).toHaveBeenCalled());
    const sent = (submitReport as jest.Mock).mock.calls[0][0];
    expect(Object.keys(sent).sort()).toEqual(
      [
        'details',
        'reason',
        'reporterUid',
        'targetId',
        'targetParentId',
        'targetType',
      ].sort()
    );
  });

  it('names the post a reported comment belongs to', async () => {
    const { getByTestId } = await render(
      ui({ targetType: 'media_comment', targetId: 'c1', targetParentId: 'post-7' })
    );
    await fireEvent.press(getByTestId('report-sheet-reason-spam'));
    await fireEvent.press(getByTestId('report-sheet-submit'));
    await waitFor(() => expect(submitReport).toHaveBeenCalled());
    expect((submitReport as jest.Mock).mock.calls[0][0].targetParentId).toBe('post-7');
  });

  it('thanks the reporter in place, and tells the caller it is reported', async () => {
    const onReported = jest.fn();
    const { getByTestId, getByText, queryByTestId } = await render(ui({ onReported }));
    await fireEvent.press(getByTestId('report-sheet-reason-spam'));
    await fireEvent.press(getByTestId('report-sheet-submit'));

    await waitFor(() => expect(getByTestId('report-sheet-sent')).toBeTruthy());
    expect(getByText('Thank you')).toBeTruthy();
    expect(getByText('A church administrator will look at this.')).toBeTruthy();
    expect(onReported).toHaveBeenCalledTimes(1);
    // The form is replaced, not closed from under the reporter.
    expect(queryByTestId('report-sheet-submit')).toBeNull();
  });

  it('closes on Done, and the next time starts clean: no reason, no detail, no thanks', async () => {
    const onClose = jest.fn();
    const first = await render(ui({ onClose }));
    await fireEvent.press(first.getByTestId('report-sheet-reason-hate'));
    await fireEvent.changeText(first.getByTestId('report-sheet-details'), 'Half typed');
    await fireEvent.press(first.getByTestId('report-sheet-submit'));
    await waitFor(() => expect(first.getByTestId('report-sheet-done')).toBeTruthy());
    await fireEvent.press(first.getByTestId('report-sheet-done'));
    expect(onClose).toHaveBeenCalledTimes(1);

    // The same component, reused for the next thing reported: nothing carried over.
    expect(first.queryByTestId('report-sheet-sent')).toBeNull();
    for (const reason of REPORT_REASONS) {
      expect(
        first.getByTestId(`report-sheet-reason-${reason}`).props.accessibilityState
          .selected
      ).toBe(false);
    }
    expect(first.getByTestId('report-sheet-details').props.value).toBe('');
    expect(
      first.getByTestId('report-sheet-submit').props.accessibilityState.disabled
    ).toBe(true);
  });

  it('keeps the reason and the words, and says so, when it could not be sent', async () => {
    (submitReport as jest.Mock).mockRejectedValue(new Error('offline'));
    const onReported = jest.fn();
    const { getByTestId, getByText } = await render(ui({ onReported }));
    await fireEvent.press(getByTestId('report-sheet-reason-misinformation'));
    await fireEvent.changeText(getByTestId('report-sheet-details'), 'It is not true.');
    await fireEvent.press(getByTestId('report-sheet-submit'));

    await waitFor(() => expect(getByTestId('report-sheet-error')).toBeTruthy());
    expect(getByText('Your report could not be sent.')).toBeTruthy();
    expect(onReported).not.toHaveBeenCalled();
    expect(
      getByTestId('report-sheet-reason-misinformation').props.accessibilityState.selected
    ).toBe(true);
    expect(getByTestId('report-sheet-details').props.value).toBe('It is not true.');
  });
});

describe('the sheet', () => {
  it('says plainly who will see it and who will not', async () => {
    const { getByTestId } = await render(ui());
    expect(getByTestId('report-sheet-intro')).toHaveTextContent(
      'A church administrator will look at this. Other members will not see your name.'
    );
    expect(flat(getByTestId('report-sheet-intro'))).toMatchObject({
      fontSize: 13,
      lineHeight: 18,
    });
  });

  it('asks for the reason as a question, and offers detail as optional', async () => {
    const { getByText } = await render(ui());
    expect(getByText('Why are you reporting it?')).toBeTruthy();
    expect(getByText('Anything else we should know? (optional)')).toBeTruthy();
  });

  it('is titled "Report this" and closes from its own Close', async () => {
    const onClose = jest.fn();
    const { getByText, getAllByRole } = await render(ui({ onClose }));
    expect(getByText('Report this')).toBeTruthy();
    const close = getAllByRole('button').find(
      (b) => b.props.accessibilityLabel === 'Close'
    );
    expect(close).toBeTruthy();
    await fireEvent.press(close!);
    expect(onClose).toHaveBeenCalled();
  });

  it('draws nothing while it is not visible', async () => {
    const { queryByTestId } = await render(ui({ visible: false }));
    expect(queryByTestId('report-sheet-submit')).toBeNull();
  });

  it('keeps the detail field short, and bounded', async () => {
    const { getByTestId } = await render(ui());
    expect(flat(getByTestId('report-sheet-details')).minHeight).toBe(88);
    expect(getByTestId('report-sheet-details').props.maxLength).toBeGreaterThan(0);
    expect(
      within(getByTestId('report-sheet')).getByTestId('report-sheet-details')
    ).toBeTruthy();
  });
});
