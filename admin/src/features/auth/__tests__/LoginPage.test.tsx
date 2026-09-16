import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import { useAuthStore } from '../../../store/authStore';
import { sendPasswordReset } from '../../../services/firebase/authService';

vi.mock('../../../services/firebase/authService');

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

  describe('password reset', () => {
    it('switches to the reset-password form when "Forgot password?" is clicked', async () => {
      useAuthStore.setState({ status: 'unauthenticated', authErrorMessage: null });
      renderLoginPage();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('forgot-password-link'));

      expect(screen.getByTestId('reset-email-input')).toBeInTheDocument();
      expect(screen.queryByTestId('email-input')).not.toBeInTheDocument();
    });

    it('sends a reset email and shows a success message that does not reveal whether the account exists', async () => {
      vi.mocked(sendPasswordReset).mockResolvedValue(undefined);
      useAuthStore.setState({ status: 'unauthenticated', authErrorMessage: null });
      renderLoginPage();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('forgot-password-link'));
      await user.type(screen.getByTestId('reset-email-input'), 'admin@example.com');
      await user.click(screen.getByTestId('reset-password-submit-button'));

      await waitFor(() =>
        expect(sendPasswordReset).toHaveBeenCalledWith('admin@example.com')
      );
      expect(screen.getByTestId('reset-password-success')).toHaveTextContent(
        'If an account exists for that email, a password reset link has been sent.'
      );
    });

    it('shows a friendly error if sending the reset email fails', async () => {
      vi.mocked(sendPasswordReset).mockRejectedValue(new Error('network error'));
      useAuthStore.setState({ status: 'unauthenticated', authErrorMessage: null });
      renderLoginPage();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('forgot-password-link'));
      await user.type(screen.getByTestId('reset-email-input'), 'admin@example.com');
      await user.click(screen.getByTestId('reset-password-submit-button'));

      await waitFor(() =>
        expect(screen.getByTestId('reset-password-error')).toBeInTheDocument()
      );
      expect(screen.queryByTestId('reset-password-success')).not.toBeInTheDocument();
    });

    it('returns to the sign-in form via "Back to sign in"', async () => {
      useAuthStore.setState({ status: 'unauthenticated', authErrorMessage: null });
      renderLoginPage();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('forgot-password-link'));
      await user.click(screen.getByTestId('back-to-sign-in-link'));

      expect(screen.getByTestId('login-submit-button')).toBeInTheDocument();
      expect(screen.queryByTestId('reset-email-input')).not.toBeInTheDocument();
    });
  });
});
