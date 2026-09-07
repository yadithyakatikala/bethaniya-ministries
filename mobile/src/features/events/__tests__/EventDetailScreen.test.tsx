import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { EventDetailScreen, buildMapsSearchUrl } from '../EventDetailScreen';
import type { PublishedEvent } from '../../../services/firebase/events';

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
 */
async function renderScreen(event: PublishedEvent, navigate = jest.fn()) {
  const utils = await render(
    <EventDetailScreen
      navigation={{ navigate } as never}
      route={{ key: 'EventDetail', name: 'EventDetail', params: { event } } as never}
    />
  );
  return { ...utils, navigate };
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
    fireEvent.press(getByTestId('open-maps-button'));
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
    fireEvent.press(watchLiveButton);
    expect(navigate).toHaveBeenCalledWith('YouTubePlayer', {
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });
  });
});
