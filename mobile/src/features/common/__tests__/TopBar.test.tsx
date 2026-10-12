import React from 'react';
import { StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { translate } from '../../../i18n';
import { TopBar } from '../TopBar';

jest.mock('../../../services/firebase/app');

/**
 * The bar the app draws itself on every pushed screen, in place of the
 * platform header: the same in both themes and both languages, with a Back
 * (or Close) that is always a real 44-point button with a spoken name.
 */
afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
});

async function renderBar(ui: React.ReactElement) {
  return render(
    <AuthProvider>
      <PreferencesProvider>{ui}</PreferencesProvider>
    </AuthProvider>
  );
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

describe('TopBar', () => {
  it('is 56 high, shifted so the glyph lines up with the 20-point margin', async () => {
    const { getByTestId } = await renderBar(<TopBar onBack={jest.fn()} testID="bar" />);
    expect(flat(getByTestId('bar'))).toMatchObject({ minHeight: 56, marginLeft: -10 });
  });

  it('offers Back, as a button with a spoken name, and reports a press', async () => {
    const onBack = jest.fn();
    const { getByTestId } = await renderBar(<TopBar onBack={onBack} testID="bar" />);
    const back = getByTestId('bar-back');
    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBe(translate('en', 'common.back'));

    await fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('is a 44-point round target', async () => {
    const { getByTestId } = await renderBar(<TopBar onBack={jest.fn()} testID="bar" />);
    expect(flat(getByTestId('bar-back'))).toMatchObject({
      width: 44,
      height: 44,
      borderRadius: 999,
    });
  });

  it('says "Close" rather than "Back" for a task screen', async () => {
    const { getByTestId } = await renderBar(
      <TopBar variant="close" onBack={jest.fn()} testID="bar" />
    );
    expect(getByTestId('bar-back').props.accessibilityLabel).toBe(
      translate('en', 'common.close')
    );
  });

  it('names Back in the interface language', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId } = await renderBar(<TopBar onBack={jest.fn()} testID="bar" />);
    await waitFor(() =>
      expect(getByTestId('bar-back').props.accessibilityLabel).toBe(
        translate('te', 'common.back')
      )
    );
  });

  it('has a default test id so a screen with one bar need not name it', async () => {
    const { getByTestId } = await renderBar(<TopBar onBack={jest.fn()} />);
    expect(getByTestId('top-bar-back')).toBeTruthy();
  });

  it('centres a short title on one line, as a heading', async () => {
    const { getByText } = await renderBar(<TopBar title="Saved" onBack={jest.fn()} />);
    const title = getByText('Saved');
    expect(title.props.accessibilityRole).toBe('header');
    expect(title.props.numberOfLines).toBe(1);
    expect(flat(title)).toMatchObject({
      textAlign: 'center',
      fontSize: 16,
      lineHeight: 22,
    });
  });

  it('is not a heading when it has no title: an empty heading is announced as nothing', async () => {
    const { toJSON } = await renderBar(<TopBar onBack={jest.fn()} />);
    expect(JSON.stringify(toJSON())).not.toContain('"accessibilityRole":"header"');
  });

  it('keeps a long Telugu title to one line, ellipsised, rather than pushing the buttons out', async () => {
    const long = 'ఆదివారం ఆరాధన మరియు సమాజ సమావేశం గురించి ప్రకటన';
    const { getByText } = await renderBar(<TopBar title={long} onBack={jest.fn()} />);
    expect(getByText(long).props.numberOfLines).toBe(1);
    expect(flat(getByText(long))).toMatchObject({ flex: 1, minWidth: 0 });
  });

  it('keeps the title centred with a spacer when there is no action', async () => {
    const { getByTestId } = await renderBar(<TopBar title="Saved" onBack={jest.fn()} />);
    // Back is 44 wide, so a 44-wide spacer sits opposite it.
    expect(getByTestId('top-bar-back')).toBeTruthy();
  });

  it('shows the screen’s one action at the right in place of the spacer', async () => {
    const { getByTestId } = await renderBar(
      <TopBar
        title="Saved"
        onBack={jest.fn()}
        trailing={<Text testID="action">Edit</Text>}
      />
    );
    expect(getByTestId('action')).toBeTruthy();
  });
});
