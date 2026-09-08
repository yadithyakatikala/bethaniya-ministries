import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AuthProvider } from '../../context/AuthContext';
import { PreferencesProvider } from '../../context/PreferencesContext';
import { TabBar } from '../TabBar';

jest.mock('../../services/firebase/app');

async function renderBar(activeRoute: string | undefined, onNavigate = jest.fn()) {
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <TabBar activeRoute={activeRoute} onNavigate={onNavigate} />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, onNavigate };
}

describe('TabBar', () => {
  it('renders all five tabs', async () => {
    const { getByTestId } = await renderBar('Home');
    expect(getByTestId('tab-home')).toBeTruthy();
    expect(getByTestId('tab-bible')).toBeTruthy();
    expect(getByTestId('tab-songs')).toBeTruthy();
    expect(getByTestId('tab-events')).toBeTruthy();
    expect(getByTestId('tab-more')).toBeTruthy();
  });

  it('marks only the active tab as selected', async () => {
    const { getByTestId } = await renderBar('SongsList');
    expect(getByTestId('tab-songs').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('tab-home').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('tab-bible').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('tab-events').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('tab-more').props.accessibilityState.selected).toBe(false);
  });

  it('marks no tab selected when the current route is not one of the five', async () => {
    const { getByTestId } = await renderBar('SongDetail');
    expect(getByTestId('tab-home').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('tab-songs').props.accessibilityState.selected).toBe(false);
  });

  it('calls onNavigate with the tapped tab route', async () => {
    const { getByTestId, onNavigate } = await renderBar('Home');
    fireEvent.press(getByTestId('tab-bible'));
    expect(onNavigate).toHaveBeenCalledWith('BibleBooks');

    fireEvent.press(getByTestId('tab-events'));
    expect(onNavigate).toHaveBeenCalledWith('EventsList');

    fireEvent.press(getByTestId('tab-more'));
    expect(onNavigate).toHaveBeenCalledWith('More');
  });
});
