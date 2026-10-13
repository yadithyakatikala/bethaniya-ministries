import React from 'react';
import { Text } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { useMemberIdentity } from '../../../context/useMemberIdentity';
import { SavedScreen } from '../SavedScreen';
import { useSavedCounts } from '../useSavedCounts';

jest.mock('../../../services/firebase/app');
jest.mock('../../../context/useMemberIdentity');
jest.mock('../useSavedCounts');

/**
 * You's first tab: six rows, each one button into the place the thing really
 * lives, with how many there are -- and no number until it is known.
 */
const Stack = createNativeStackNavigator();

/** Prints the params it was opened with, so a test can see WHERE the row sent the member. */
function paramsStub(testID: string) {
  return function ParamsStub() {
    const { params } = useRoute();
    return <Text testID={testID}>{JSON.stringify(params ?? null)}</Text>;
  };
}

const SavedVersesStub = paramsStub('saved-verses-stub');
const BibleBooksStub = paramsStub('bible-books-stub');
const SavedMediaStub = paramsStub('saved-media-stub');
const PrayersHubStub = paramsStub('prayers-hub-stub');

function renderSaved() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator>
            <Stack.Screen name="Host" component={SavedScreen} />
            <Stack.Screen name="SavedVerses" component={SavedVersesStub} />
            <Stack.Screen name="BibleBooks" component={BibleBooksStub} />
            <Stack.Screen name="SavedMedia" component={SavedMediaStub} />
            <Stack.Screen name="PrayersHub" component={PrayersHubStub} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

const ROWS = [
  ['saved-notes', 'Notes'],
  ['saved-highlights', 'Highlights'],
  ['saved-bookmarks', 'Bookmarks'],
  ['saved-plans', 'Reading plans'],
  ['saved-media', 'Photos and videos'],
  ['saved-journal', 'Prayer journal'],
] as const;

function counts(overrides: Partial<ReturnType<typeof useSavedCounts>> = {}) {
  (useSavedCounts as jest.Mock).mockReturnValue({
    notes: 3,
    highlights: 12,
    bookmarks: 5,
    plans: 1,
    media: 4,
    journal: 6,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useMemberIdentity as jest.Mock).mockReturnValue({
    uid: 'u1',
    displayName: 'Grace',
    canPost: true,
    suspended: false,
  });
  counts();
});

afterEach(async () => {
  await cleanup();
});

describe('the six rows', () => {
  it('lists notes, highlights, bookmarks, plans, photos and videos, and the prayer journal, in that order', async () => {
    const { getAllByRole } = await renderSaved();
    const rows = getAllByRole('button').filter((node) =>
      String(node.props.testID ?? '').startsWith('saved-')
    );
    expect(rows.map((row) => row.props.testID)).toEqual(ROWS.map(([id]) => id));
  });

  it.each(ROWS)('%s is one button named %s', async (testID, title) => {
    const { getByTestId } = await renderSaved();
    const row = getByTestId(testID);
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityLabel).toContain(title);
  });

  it('shows how many there are on each row, and says it aloud', async () => {
    const { getByTestId } = await renderSaved();
    expect(getByTestId('saved-notes').props.accessibilityLabel).toBe('Notes, 3');
    expect(getByTestId('saved-highlights').props.accessibilityLabel).toBe(
      'Highlights, 12'
    );
    expect(getByTestId('saved-bookmarks').props.accessibilityLabel).toBe('Bookmarks, 5');
    expect(getByTestId('saved-plans').props.accessibilityLabel).toBe('Reading plans, 1');
    expect(getByTestId('saved-media').props.accessibilityLabel).toBe(
      'Photos and videos, 4'
    );
    expect(getByTestId('saved-journal').props.accessibilityLabel).toBe(
      'Prayer journal, 6'
    );
  });

  it('shows 0 when a member has none: that is a number, not a missing one', async () => {
    counts({ notes: 0 });
    const { getByTestId } = await renderSaved();
    expect(getByTestId('saved-notes').props.accessibilityLabel).toBe('Notes, 0');
  });

  it('shows no number at all until it is known, never a wrong one', async () => {
    counts({ notes: null, highlights: null, journal: null });
    const { getByTestId } = await renderSaved();
    expect(getByTestId('saved-notes').props.accessibilityLabel).toBe('Notes');
    expect(getByTestId('saved-highlights').props.accessibilityLabel).toBe('Highlights');
    expect(getByTestId('saved-journal').props.accessibilityLabel).toBe('Prayer journal');
    // ...while the ones that are known still show.
    expect(getByTestId('saved-bookmarks').props.accessibilityLabel).toBe('Bookmarks, 5');
  });

  it('counts the signed-in member’s data, and nobody else’s', async () => {
    await renderSaved();
    expect(useSavedCounts).toHaveBeenCalledWith('u1');
  });
});

describe('where each row goes', () => {
  async function pressAndRead(testID: string, stub: string) {
    const screen = await renderSaved();
    await fireEvent.press(screen.getByTestId(testID));
    await waitFor(() => expect(screen.getByTestId(stub)).toBeTruthy());
    return screen.getByTestId(stub).props.children as string;
  }

  it.each([
    ['saved-notes', 'notes'],
    ['saved-highlights', 'highlights'],
    ['saved-bookmarks', 'bookmarks'],
  ])('%s opens the saved verses on its own list (%s)', async (testID, kind) => {
    expect(await pressAndRead(testID, 'saved-verses-stub')).toBe(
      JSON.stringify({ kind })
    );
  });

  it('opens the reading plans: the Bible tab, on its Plans view', async () => {
    expect(await pressAndRead('saved-plans', 'bible-books-stub')).toBe(
      JSON.stringify({ tab: 'plans' })
    );
  });

  it('opens the saved photos and videos', async () => {
    expect(await pressAndRead('saved-media', 'saved-media-stub')).toBe('null');
  });

  it('opens the prayer journal: the Prayers tab on its My journal view', async () => {
    expect(await pressAndRead('saved-journal', 'prayers-hub-stub')).toBe(
      JSON.stringify({ tab: 'journal' })
    );
  });

  it('sends the three Bible rows to three different lists', async () => {
    const reached: string[] = [];
    for (const testID of ['saved-notes', 'saved-highlights', 'saved-bookmarks']) {
      const screen = await renderSaved();
      await fireEvent.press(screen.getByTestId(testID));
      await waitFor(() => expect(screen.getByTestId('saved-verses-stub')).toBeTruthy());
      reached.push(screen.getByTestId('saved-verses-stub').props.children as string);
      await screen.unmount();
    }
    expect(new Set(reached).size).toBe(3);
  });
});
