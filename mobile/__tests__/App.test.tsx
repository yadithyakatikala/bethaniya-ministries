import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../App';

// Day 1 smoke test: verifies the scaffold actually builds and renders.
// Real feature tests (auth, navigation, screens) are added as those features
// are built, starting Day 2.
describe('App', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<App />);
    expect(getByText('Bethaniya Ministries')).toBeTruthy();
  });
});
