import type { ReactNode } from 'react';

/**
 * Placeholder route guard (Day 1 foundation only).
 *
 * Real authentication (Firebase email/password login, session check) is a
 * Day 2 task per FINAL_ARCHITECTURE_SPECIFICATION.md. This component exists so
 * the folder structure and import graph are in place; it currently renders
 * children unconditionally. IMPORTANT: this is a UX convenience, not security —
 * real authorization is enforced by Firestore security rules server-side,
 * never by this component. See /SECURITY.md.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
