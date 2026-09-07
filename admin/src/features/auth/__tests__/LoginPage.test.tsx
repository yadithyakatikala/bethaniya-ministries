import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import { useAuthStore } from '../../../store/authStore';

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  it('calls signIn with the entered credentials on submit', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ signIn, status: 'unauthenticated', authErrorMessage: null });

    renderLoginPage();
    const user = userEvent.setup();
    await user.type(screen.getByTestId('email-input'), 'host@example.com');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-submit-button'));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('host@example.com', 'secret123')
    );
  });

  it('shows the friendly error message from the store without crashing', async () => {
    useAuthStore.setState({
      status: 'unauthenticated',
      authErrorMessage: 'No account found with that email and password.',
    });

    renderLoginPage();
    expect(screen.getByTestId('login-error')).toHaveTextContent(
      'No account found with that email and password.'
    );
  });

  it('disables the submit button until both fields are filled in', () => {
    useAuthStore.setState({ status: 'unauthenticated', authErrorMessage: null });
    renderLoginPage();
    expect(screen.getByTestId('login-submit-button')).toBeDisabled();
  });
});
