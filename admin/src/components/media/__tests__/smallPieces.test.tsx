import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { RULES_NOT_DEPLOYED_MESSAGE, describeLibraryError } from '../libraryErrors';
import { describeAsset, matchesSearch, shortAddress } from '../assetDisplay';
import { MediaThumb } from '../MediaThumb';
import { UploadSetupNotice } from '../UploadSetupNotice';
import type { MediaAsset } from '../../../services/firebase/mediaAssets';
import { INVALID, MISSING, renderThemed } from './helpers';

const IMAGE_URL =
  'https://res.cloudinary.com/my-church/image/upload/v1/maranatha/easter.jpg';

describe('UploadSetupNotice', () => {
  it('names the missing settings for the person fixing it, and never a value', () => {
    renderThemed(<UploadSetupNotice config={MISSING} kind="image" testId="n" />);
    const notice = screen.getByTestId('n');
    expect(notice).toHaveTextContent('Image upload is not set up yet');
    expect(notice).toHaveTextContent('docs/admin/MEDIA_UPLOADS.md');
    expect(notice).toHaveTextContent('VITE_CLOUDINARY_CLOUD_NAME');
    expect(notice).toHaveTextContent('For the person setting it up');
  });

  it('reports a wrong configuration as a warning without echoing the secret', () => {
    renderThemed(<UploadSetupNotice config={INVALID} kind="audio" testId="n" />);
    const notice = screen.getByTestId('n');
    expect(notice).toHaveTextContent('Audio upload is switched off');
    expect(notice).toHaveTextContent('VITE_CLOUDINARY_API_SECRET');
    expect(notice.textContent).not.toContain('do-not-print');
    expect(notice).toHaveClass('MuiAlert-colorWarning');
  });

  it('says only that this kind is not set up when the account is, but this preset is not', () => {
    const imageOnly = {
      status: 'ready' as const,
      cloudName: 'my-church',
      imagePreset: 'p',
      audioPreset: null,
    };
    renderThemed(<UploadSetupNotice config={imageOnly} kind="audio" testId="n" />);
    expect(screen.getByTestId('n')).toHaveTextContent(
      'The audio upload preset has not been added'
    );
    expect(screen.queryByText('For the person setting it up')).toBeNull();
  });
});

describe('MediaThumb', () => {
  it('asks for a small copy of an uploaded image first', () => {
    renderThemed(<MediaThumb kind="image" url={IMAGE_URL} label="Easter" />);
    expect(screen.getByRole('img', { name: 'Easter' })).toHaveAttribute(
      'src',
      expect.stringContaining('/c_fill,w_320,h_240,q_auto,f_auto/')
    );
  });

  it('falls back to the original, then to an icon, as each fails to load', () => {
    renderThemed(<MediaThumb kind="image" url={IMAGE_URL} label="Easter" />);
    fireEvent.error(screen.getByRole('img', { name: 'Easter' }));
    expect(screen.getByRole('img', { name: 'Easter' })).toHaveAttribute('src', IMAGE_URL);
    fireEvent.error(screen.getByRole('img', { name: 'Easter' }));
    // No <img> left: the tile shows the kind's icon, which is an svg with the label.
    expect(screen.getByRole('img', { name: 'Easter' }).tagName.toLowerCase()).toBe('svg');
  });

  it('shows an icon, not a picture, for audio', () => {
    renderThemed(<MediaThumb kind="audio" url="https://x.test/a.mp3" label="Hymn" />);
    expect(screen.getByRole('img', { name: 'Hymn' }).tagName.toLowerCase()).toBe('svg');
  });

  it("uses a video record's own thumbnail", () => {
    renderThemed(
      <MediaThumb
        kind="video"
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        thumbnailUrl="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
        label="Sermon"
      />
    );
    expect(screen.getByRole('img', { name: 'Sermon' })).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    );
  });

  it("leaves a pasted link's address untouched", () => {
    renderThemed(<MediaThumb kind="image" url="https://example.org/p.png" label="P" />);
    expect(screen.getByRole('img', { name: 'P' })).toHaveAttribute(
      'src',
      'https://example.org/p.png'
    );
  });
});

describe('describeLibraryError', () => {
  it('blames the rules, accurately, for a refused read or write', () => {
    expect(describeLibraryError({ code: 'permission-denied' })).toBe(
      RULES_NOT_DEPLOYED_MESSAGE
    );
    expect(describeLibraryError({ code: 'firestore/permission-denied' })).toBe(
      RULES_NOT_DEPLOYED_MESSAGE
    );
  });
  it('names an unreachable service and falls back for anything else', () => {
    expect(describeLibraryError({ code: 'unavailable' })).toMatch(/could not be reached/);
    expect(describeLibraryError(new Error('boom'))).toMatch(/could not be updated/);
    expect(describeLibraryError(null)).toMatch(/could not be updated/);
  });
});

describe('asset display helpers', () => {
  const base: MediaAsset = {
    id: 'a',
    kind: 'image',
    source: 'cloudinary',
    category: 'poster',
    title: 'Easter poster',
    altText: 'A cross at sunrise',
    url: IMAGE_URL,
    thumbnailUrl: null,
    publicId: 'p',
    format: 'jpg',
    bytes: 2097152,
    width: 1600,
    height: 900,
    durationSeconds: null,
    originalFilename: 'easter-final',
    youtubeId: null,
    createdBy: 'u',
    createdByName: 'U',
    createdAt: null,
    updatedAt: null,
  };

  it('describes an asset in one line', () => {
    expect(describeAsset(base)).toBe('JPG · 1600×900 · 2.0 MB');
    expect(
      describeAsset({
        ...base,
        source: 'youtube',
        format: null,
        width: null,
        height: null,
        bytes: null,
      })
    ).toBe('YouTube');
    expect(
      describeAsset({
        ...base,
        source: 'link',
        format: null,
        width: null,
        height: null,
        bytes: null,
      })
    ).toBe('Link');
  });

  it('matches a search on title, file name or description, ignoring case', () => {
    expect(matchesSearch(base, '')).toBe(true);
    expect(matchesSearch(base, '  EASTER ')).toBe(true);
    expect(matchesSearch(base, 'final')).toBe(true);
    expect(matchesSearch(base, 'sunrise')).toBe(true);
    expect(matchesSearch(base, 'christmas')).toBe(false);
  });

  it('shortens an address to something readable', () => {
    expect(shortAddress(IMAGE_URL)).toBe('res.cloudinary.com › easter.jpg');
    expect(shortAddress('https://example.org')).toBe('example.org');
    expect(shortAddress('not a url')).toBe('not a url');
  });
});
