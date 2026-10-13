import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { EventDetailScreen, buildMapsSearchUrl } from '../EventDetailScreen';
import type { PublishedEvent } from '../../../services/firebase/events';
import { fontFamilies, lightTokens } from '../../../theme/tokens';

jest.mock('../../../services/firebase/app');

const BASE_EVENT: PublishedEvent = {
  id: 'e1',
  title: 'Sunday Service',
  location: '123 Main St, Springfield',
  description: 'Weekly gathering with worship and teaching.',
  startsAt: new Date('2026-09-20T18:30:00'),
  isLive: false,
  youtubeUrl: '',
};

/**
 * Only `route.params.event` and `navigation.navigate` are used by this
 * screen -- same `as never` convention as SongDetailScreen.test.tsx for
 * the rest of NativeStackScreenProps' shape.
 *
 * Wrapped in AuthProvider/PreferencesProvider since the screen now reads
 * useTheme() -- same reasoning as EventsListScreen.test.tsx.
 */
async function renderScreen(event: PublishedEvent, navigate = jest.fn()) {
  const goBack = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <EventDetailScreen
          navigation={{ navigate, goBack } as never}
          route={{ key: 'EventDetail', name: 'EventDetail', params: { event } } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate, goBack };
}

describe('EventDetailScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows title/starts-at/location/description', async () => {
    const { getByText, getByTestId } = await renderScreen(BASE_EVENT);
    expect(getByText('Sunday Service')).toBeTruthy();
    expect(getByText('123 Main St, Springfield')).toBeTruthy();
    expect(getByTestId('event-description').props.children).toBe(BASE_EVENT.description);
  });

  it('opens Maps with a URL built from the event location when "Open in Maps" is pressed', async () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByTestId } = await renderScreen(BASE_EVENT);
    await fireEvent.press(getByTestId('open-maps-button'));
    expect(openURLSpy).toHaveBeenCalledWith(buildMapsSearchUrl(BASE_EVENT.location));
    expect(openURLSpy.mock.calls[0][0]).toContain(
      encodeURIComponent(BASE_EVENT.location)
    );
  });

  it('does not show a WATCH LIVE button when the event is not live', async () => {
    const { queryByTestId } = await renderScreen(BASE_EVENT);
    expect(queryByTestId('watch-live-button')).toBeNull();
  });

  it('shows a WATCH LIVE button when isLive is true, navigating to YouTubePlayer with the youtubeUrl', async () => {
    const liveEvent: PublishedEvent = {
      ...BASE_EVENT,
      isLive: true,
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    };
    const { getByTestId, navigate } = await renderScreen(liveEvent);
    const watchLiveButton = getByTestId('watch-live-button');
    expect(watchLiveButton).toBeTruthy();
    await fireEvent.press(watchLiveButton);
    // The player's top bar carries the event's name.
    expect(navigate).toHaveBeenCalledWith('YouTubePlayer', {
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      title: 'Sunday Service',
    });
  });

  it('has a top bar whose Back leaves the screen', async () => {
    const { getByRole, goBack } = await renderScreen(BASE_EVENT);
    await fireEvent.press(getByRole('button', { name: 'Back' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('announces the title as a heading, in the serif of its script', async () => {
    const latin = await renderScreen(BASE_EVENT);
    expect(latin.getByRole('header', { name: 'Sunday Service' })).toBeTruthy();
    expect(
      StyleSheet.flatten(latin.getByTestId('event-title').props.style).fontFamily
    ).toBe(fontFamilies.serifEnSemiBold);
    await latin.unmount();

    const mixed = await renderScreen({ ...BASE_EVENT, title: 'Sunday ఆరాధన' });
    expect(
      StyleSheet.flatten(mixed.getByTestId('event-title').props.style).fontFamily
    ).toBe(fontFamilies.interfaceSemiBold);
  });

  it('says when it starts in the short form, and that the date is to come when it has none', async () => {
    const dated = await renderScreen({
      ...BASE_EVENT,
      startsAt: new Date(2033, 5, 1, 18, 30),
    });
    expect(dated.getByTestId('event-when')).toHaveTextContent(
      /^Wed 1 Jun 2033, 6:30\s?PM$/i
    );
    await dated.unmount();

    const undated = await renderScreen({ ...BASE_EVENT, startsAt: null });
    expect(undated.getByTestId('event-when')).toHaveTextContent(
      'Date and time to be announced'
    );
  });

  it('shows the LIVE NOW badge only for a live event', async () => {
    const quiet = await renderScreen(BASE_EVENT);
    expect(quiet.queryByTestId('event-live-badge')).toBeNull();
    expect(quiet.queryByTestId('event-live-bar')).toBeNull();
    await quiet.unmount();

    const live = await renderScreen({
      ...BASE_EVENT,
      isLive: true,
      youtubeUrl: 'https://youtu.be/x',
    });
    expect(live.getByTestId('event-live-badge')).toHaveTextContent('LIVE NOW');
  });

  it('puts the live button in a bar at the foot, full width, in the live colour -- not the error red', async () => {
    const { getByTestId } = await renderScreen({
      ...BASE_EVENT,
      isLive: true,
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });
    const bar = StyleSheet.flatten(getByTestId('event-live-bar').props.style);
    expect(bar).toMatchObject({ position: 'absolute', bottom: 0, left: 0, right: 0 });
    const button = getByTestId('watch-live-button');
    expect(button).toHaveTextContent('Watch live on YouTube');
    const style = StyleSheet.flatten(button.props.style);
    expect(style.backgroundColor).toBe(lightTokens.live);
    expect(style.alignSelf).toBe('stretch');
  });

  it('leaves out the place row and the Maps button when there is no place', async () => {
    const { queryByTestId } = await renderScreen({ ...BASE_EVENT, location: '   ' });
    expect(queryByTestId('event-location')).toBeNull();
    expect(queryByTestId('open-maps-button')).toBeNull();
  });

  it('leaves out the description when there is none', async () => {
    const { queryByTestId } = await renderScreen({ ...BASE_EVENT, description: '' });
    expect(queryByTestId('event-description')).toBeNull();
  });
});
