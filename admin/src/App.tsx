import { ThemeProvider, CssBaseline, Box, Typography } from '@mui/material';
import { theme } from './theme/theme';

/**
 * Root component — Day 1 foundation placeholder.
 *
 * Does NOT implement real login, dashboard, or CRUD screens yet (Day 1 is
 * foundation only per project instructions). Proves the scaffold builds and
 * is wired to the MUI theme that later screens will use.
 */
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <Typography variant="h4" component="h1">
          Bethaniya Ministries — Admin
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Day 1 foundation — under construction
        </Typography>
      </Box>
    </ThemeProvider>
  );
}

export default App;
