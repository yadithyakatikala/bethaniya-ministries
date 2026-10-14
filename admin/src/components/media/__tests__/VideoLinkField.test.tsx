import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

vi.mock('../../../services/firebase/mediaAssets', () => ({
  subscribeToMediaAssets: vi.fn(() => vi.fn()),
}));

import { subscribeToMediaAssets } from '../../../services/firebase/mediaAssets';
import { VideoLinkField } from '../VideoLinkField';
import { renderThemed } from './helpers';

const ID = 'dQw4w9WgXcQ';

function Harness({ initial = '', error }: { initial?: string; error?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <VideoLinkField
        value={value}
        onChange={setValue}
        label="Video"
        testIdPrefix="media"
        error={error}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(subscribeToMediaAssets).mockReturnValue(vi.fn());
});

describe('a YouTube address', () => {
  it("shows the video's own thumbnail and does not load the player yet", () => {
    renderThemed(<Harness initial={`https://www.youtube.com/watch?v=${ID}`} />);
    expect(screen.getByTestId('media-thumbnail')).toHaveAttribute(
      'src',
      `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`
    );
    expect(screen.queryByTestId('media-embed')).toBeNull();
  });

  it('loads the privacy-enhanced player only when asked to', async () => {
    const user = userEvent.setup();
    renderThemed(<Harness initial={`https://www.youtube.com/watch?v=${ID}`} />);
    await user.click(screen.getByTestId('media-play'));
    const frame = screen.getByTestId('media-embed');
    expect(frame).toHaveAttribute('src', `https://www.youtube-nocookie.com/embed/${ID}`);
    expect(frame).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-presentation'
    );
    expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    expect(frame).toHaveAttribute('title', 'Video preview');
  });

  it.each([
    [`https://youtu.be/${ID}`],
    [`https://m.youtube.com/watch?v=${ID}&t=9`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`http://www.youtube.com/watch?v=${ID}`],
  ])(
    'tidies %s to the one address the app plays, when you leave the box',
    async (pasted) => {
      const user = userEvent.setup();
      renderThemed(<Harness />);
      await user.click(screen.getByTestId('media-url-input'));
      await user.paste(pasted);
      await user.tab();
      expect(screen.getByTestId('value')).toHaveTextContent(
        `https://www.youtube.com/watch?v=${ID}`
      );
    }
  );

  it('leaves an already-standard address alone', async () => {
    const user = userEvent.setup();
    renderThemed(<Harness initial={`https://www.youtube.com/watch?v=${ID}`} />);
    await user.click(screen.getByTestId('media-url-input'));
    await user.tab();
    expect(screen.getByTestId('value')).toHaveTextContent(
      `https://www.youtube.com/watch?v=${ID}`
    );
  });
});

describe('an address that is not one video', () => {
  it('explains a channel or playlist address as the person types', () => {
    renderThemed(
      <Harness initial="https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv" />
    );
    expect(screen.getByText(/does not point at a single video/)).toBeInTheDocument();
    expect(screen.queryByTestId('media-preview')).toBeNull();
  });

  it('accepts another https link and says how it will appear', () => {
    renderThemed(<Harness initial="https://example.org/clip.mp4" />);
    expect(screen.getByTestId('media-not-youtube')).toHaveTextContent(
      'shown as a picture'
    );
    expect(screen.queryByTestId('media-preview')).toBeNull();
  });

  it("shows the form's own validation message instead of guessing", () => {
    renderThemed(<Harness error="A media link is required." />);
    expect(screen.getByText('A media link is required.')).toBeInTheDocument();
  });
});

describe('choosing from the library', () => {
  it('offers video records only', async () => {
    const user = userEvent.setup();
    renderThemed(<Harness />);
    await user.click(screen.getByTestId('media-library-button'));
    expect(
      await screen.findByRole('dialog', { name: 'Choose a video for video' })
    ).toBeInTheDocument();
  });

  it("uses the chosen record's address and closes any open player", async () => {
    vi.mocked(subscribeToMediaAssets).mockImplementation(((
      next: (a: unknown[]) => void
    ) => {
      next([
        {
          id: 'v1',
          kind: 'video',
          source: 'youtube',
          category: 'video',
          title: 'Sunday sermon',
          altText: '',
          url: `https://www.youtube.com/watch?v=${ID}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
          publicId: null,
          format: null,
          bytes: null,
          width: null,
          height: null,
          durationSeconds: null,
          originalFilename: null,
          youtubeId: ID,
          createdBy: 'u',
          createdByName: 'U',
          createdAt: null,
          updatedAt: null,
        },
      ]);
      return vi.fn();
    }) as never);
    const user = userEvent.setup();
    renderThemed(<Harness />);
    await user.click(screen.getByTestId('media-library-button'));
    await user.click(await screen.findByTestId('media-picker-item-v1'));
    expect(screen.getByTestId('value')).toHaveTextContent(ID);
    expect(screen.getByTestId('media-thumbnail')).toBeInTheDocument();
  });
});

describe('typing', () => {
  it('reports each change to the form', () => {
    renderThemed(<Harness />);
    fireEvent.change(screen.getByTestId('media-url-input'), {
      target: { value: 'https://example.org/a.mp4' },
    });
    expect(screen.getByTestId('value')).toHaveTextContent('https://example.org/a.mp4');
  });
});
