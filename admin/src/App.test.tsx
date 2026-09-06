import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Day 1 smoke test: verifies the scaffold actually builds and renders.
// Real feature tests (login, CRUD forms) are added as those features are
// built, starting Day 2.
describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText('Bethaniya Ministries — Admin')).toBeInTheDocument();
  });
});
