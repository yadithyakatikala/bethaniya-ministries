import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { MoreScreen } from '../MoreScreen';

jest.mock('../../../services/firebase/app');

/**
 * MoreScreen calls useNavigation() directly (same pattern as
 * HomeScreen.tsx), so it needs a real Stack.Navigator in its render tree
 * -- same test helper shape as HomeScreen.test.tsx, with stub screens for
 * the three destinations this screen links to.
 */
const Stack = createNativeStackNavigator();

function ProfileStub() {
  return <Text testID="profile-stub">Profile stub</Text>;
}
function NotificationCenterStub() {
  return <Text testID="notification-center-stub">Notification center stub</Text>;
}
function SettingsStub() {
  return <Text testID="settings-stub">Settings stub</Text>;
}

function mockSignedIn() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'u1', displayName: 'Jane Doe', email: null, phoneNumber: null });
    return jest.fn();
  });
}

async function renderScreen() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator>
            <Stack.Screen name="More" component={MoreScreen} />
            <Stack.Screen name="Profile" component={ProfileStub} />
            <Stack.Screen name="NotificationCenter" component={NotificationCenterStub} />
            <Stack.Screen name="Settings" component={SettingsStub} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

describe('MoreScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('greets the signed-in user by display name', async () => {
    mockSignedIn();
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Jane Doe')).toBeTruthy());
  });

  it('navigates to Profile when the profile row is pressed', async () => {
    mockSignedIn();
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('more-profile-link')).toBeTruthy());
    fireEvent.press(getByTestId('more-profile-link'));
    await waitFor(() => expect(getByTestId('profile-stub')).toBeTruthy());
  });

  it('navigates to Notifications when the notifications row is pressed', async () => {
    mockSignedIn();
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('more-notifications-link')).toBeTruthy());
    fireEvent.press(getByTestId('more-notifications-link'));
    await waitFor(() => expect(getByTestId('notification-center-stub')).toBeTruthy());
  });

  it('navigates to Settings when the settings row is pressed', async () => {
    mockSignedIn();
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('more-settings-link')).toBeTruthy());
    fireEvent.press(getByTestId('more-settings-link'));
    await waitFor(() => expect(getByTestId('settings-stub')).toBeTruthy());
  });
});
