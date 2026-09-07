import { useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { theme } from './theme/theme';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/auth/DashboardPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { subscribeToAuthChanges } from './store/authStore';

/**
 * Root component.
 *
 * Day 1 built the static placeholder scaffold; Day 2 adds the real
 * authentication foundation (see store/authStore.ts): /login for
 * email/password sign-in, and / behind ProtectedRoute for the dashboard
 * shell, gated on the real Firebase Auth + role state instead of always
 * rendering unconditionally.
 */
function App() {
  useEffect(() => subscribeToAuthChanges(), []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
