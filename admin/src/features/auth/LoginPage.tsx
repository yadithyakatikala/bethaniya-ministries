import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Box, Button, Link, Paper, TextField, Typography } from '@mui/material';
import { ADMIN_TITLE } from '../../theme/brand';
import { useAuthStore } from '../../store/authStore';
import { sendPasswordReset } from '../../services/firebase/authService';

/**
 * Minimal email/password login screen -- enough to exercise the real
 * architecture, not a polished design (per the Day 2 directive's Phase 8).
 *
 * Password reset (added during the V1 production-readiness audit, after
 * FINAL_ARCHITECTURE_SPECIFICATION.md's "Password reset via email" admin
 * auth requirement was found entirely missing): a plain client-SDK call,
 * no Cloud Function/Blaze involvement, so it works on the Spark plan.
 * Firebase's sendPasswordResetEmail intentionally does not reveal whether
 * the address has an account -- the success message below is shown
 * regardless, which is correct behavior, not a bug: revealing that would
 * let anyone enumerate admin email addresses.
 */
export function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const authErrorMessage = useAuthStore((s) => s.authErrorMessage);
  const signIn = useAuthStore((s) => s.signIn);
  const clearAuthError = useAuthStore((s) => s.clearAuthError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'sign-in' | 'reset-password'>('sign-in');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    clearAuthError();
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      // authErrorMessage is already set by the store -- nothing more to do.
    } finally {
      setSubmitting(false);
    }
  }

  function enterResetMode() {
    setMode('reset-password');
    setResetError(null);
    setResetSent(false);
  }

  function backToSignIn() {
    setMode('sign-in');
    setResetError(null);
    setResetSent(false);
  }

  async function handleResetSubmit(event: FormEvent) {
    event.preventDefault();
    setResetError(null);
    setResetSubmitting(true);
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch {
      setResetError(
        'Could not send the reset email. Please check the address and try again.'
      );
    } finally {
      setResetSubmitting(false);
    }
  }

  if (mode === 'reset-password') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <Paper sx={{ p: 4, width: 360 }} component="form" onSubmit={handleResetSubmit}>
          <Typography variant="h5" component="h1" gutterBottom>
            Reset password
          </Typography>

          {resetSent ? (
            <Alert severity="success" sx={{ mb: 2 }} data-testid="reset-password-success">
              If an account exists for that email, a password reset link has been sent.
            </Alert>
          ) : null}
          {resetError ? (
            <Alert severity="error" sx={{ mb: 2 }} data-testid="reset-password-error">
              {resetError}
            </Alert>
          ) : null}

          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            slotProps={{ htmlInput: { 'data-testid': 'reset-email-input' } }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 2 }}
            disabled={resetSubmitting || !email}
            data-testid="reset-password-submit-button"
          >
            Send reset email
          </Button>
          <Link
            component="button"
            type="button"
            variant="body2"
            sx={{ mt: 2, display: 'block' }}
            onClick={backToSignIn}
            data-testid="back-to-sign-in-link"
          >
            Back to sign in
          </Link>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
      <Paper sx={{ p: 4, width: 360 }} component="form" onSubmit={handleSubmit}>
        <Typography variant="h5" component="h1" gutterBottom>
          {ADMIN_TITLE}
        </Typography>

        {authErrorMessage ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="login-error">
            {authErrorMessage}
          </Alert>
        ) : null}

        <TextField
          label="Email"
          type="email"
          fullWidth
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'email-input' } }}
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'password-input' } }}
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
          disabled={submitting || !email || !password}
          data-testid="login-submit-button"
        >
          Sign in
        </Button>
        <Link
          component="button"
          type="button"
          variant="body2"
          sx={{ mt: 2, display: 'block' }}
          onClick={enterResetMode}
          data-testid="forgot-password-link"
        >
          Forgot password?
        </Link>
      </Paper>
    </Box>
  );
}
