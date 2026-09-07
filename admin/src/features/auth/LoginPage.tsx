import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useAuthStore } from '../../store/authStore';

/**
 * Minimal email/password login screen -- enough to exercise the real
 * architecture, not a polished design (per the Day 2 directive's Phase 8).
 */
export function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const authErrorMessage = useAuthStore((s) => s.authErrorMessage);
  const signIn = useAuthStore((s) => s.signIn);
  const clearAuthError = useAuthStore((s) => s.clearAuthError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
      <Paper sx={{ p: 4, width: 360 }} component="form" onSubmit={handleSubmit}>
        <Typography variant="h5" component="h1" gutterBottom>
          Bethaniya Ministries — Admin
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
      </Paper>
    </Box>
  );
}
