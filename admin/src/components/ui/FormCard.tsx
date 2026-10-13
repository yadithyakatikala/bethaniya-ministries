import type { FormEventHandler, ReactNode } from 'react';
import { Box, Divider, Paper, Typography } from '@mui/material';
import { adminRadii } from '../../theme/tokens';

/**
 * The white card every create/edit form sits in. Padding shrinks on a
 * phone so a field never loses width to chrome.
 */
export function FormCard({
  onSubmit,
  children,
  testId,
}: {
  onSubmit?: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Paper
      component="form"
      variant="outlined"
      noValidate
      onSubmit={onSubmit}
      data-testid={testId}
      sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: `${adminRadii.card}px` }}
    >
      {children}
    </Paper>
  );
}

/**
 * A titled group of fields inside a long form, so a form with a dozen
 * fields reads as three short parts rather than one long column.
 */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box component="section" sx={{ '& + &': { mt: 4 } }}>
      <Typography variant="h5" component="h2">
        {title}
      </Typography>
      {description ? (
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5, maxWidth: 560 }}>
          {description}
        </Typography>
      ) : null}
      <Box sx={{ mt: 1 }}>{children}</Box>
    </Box>
  );
}

/**
 * The row of buttons that ends a form: the primary action first, then the
 * cancel, set off from the fields by a rule.
 */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <>
      <Divider sx={{ mt: 4, mb: 3 }} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        {children}
      </Box>
    </>
  );
}
