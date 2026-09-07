/**
 * Calls the logAdminAction callable Cloud Function (Day 3,
 * functions/src/logAdminAction.ts) after a real admin write -- the piece
 * Day 3 deliberately left undone ("Nothing yet calls logAdminAction from a
 * real admin action, because no admin CRUD UI exists yet", SECURITY.md).
 * Announcements CRUD (Day 4) is the first caller.
 *
 * admin_id/admin_email are derived server-side from the callable's verified
 * auth context (see logAdminAction.ts) -- nothing here can influence them;
 * only the content fields below (action/collection/documentId/changeSummary)
 * are client-supplied, same as any other audit-log entry content.
 *
 * Failures are logged, not thrown: a failed audit-log write should never
 * block or roll back the content write that already succeeded (the Firestore
 * write and this call are two separate operations, not a transaction --
 * consistent with logAdminAction's own callable design, which runs after
 * the client's Firestore write per its header comment).
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from './app';

export type AuditAction = 'create' | 'update' | 'delete' | 'publish' | 'unpublish';
export type AuditCollection =
  'users' | 'announcements' | 'daily_verses' | 'songs' | 'events' | 'settings';

export interface LogAdminActionInput {
  action: AuditAction;
  collection: AuditCollection;
  documentId: string;
  changeSummary: string;
  details?: Record<string, unknown>;
}

const callLogAdminAction = httpsCallable<LogAdminActionInput, { logged: true }>(
  functions,
  'logAdminAction'
);

/** Never throws -- see module doc for why a failed audit log must not block the caller. */
export async function logAdminAction(input: LogAdminActionInput): Promise<void> {
  try {
    await callLogAdminAction(input);
  } catch (error) {
    console.error('logAdminAction call failed (content write already succeeded):', error);
  }
}
