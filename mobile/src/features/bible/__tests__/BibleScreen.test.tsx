import React from 'react';
import { render } from '@testing-library/react-native';
import { BibleScreen } from '../BibleScreen';
import { PLACEHOLDER_VERSES } from '../placeholderData';

describe('BibleScreen', () => {
  it('renders the placeholder-content banner', async () => {
    const { getByTestId } = await render(<BibleScreen />);
    expect(getByTestId('bible-placeholder-banner')).toBeTruthy();
  });

  it('renders every placeholder verse reference', async () => {
    const { getByText } = await render(<BibleScreen />);
    for (const verse of PLACEHOLDER_VERSES) {
      expect(getByText(verse.reference)).toBeTruthy();
    }
  });
});

describe('PLACEHOLDER_VERSES', () => {
  it('is all explicitly marked as placeholder data', () => {
    expect(PLACEHOLDER_VERSES.length).toBeGreaterThan(0);
    for (const verse of PLACEHOLDER_VERSES) {
      expect(verse.isPlaceholder).toBe(true);
    }
  });

  it('includes both English and Telugu placeholder entries', () => {
    const languages = new Set(PLACEHOLDER_VERSES.map((v) => v.language));
    expect(languages.has('en')).toBe(true);
    expect(languages.has('te')).toBe(true);
  });
});
