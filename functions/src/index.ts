/**
 * Bethaniya Ministries — Cloud Functions entry point.
 *
 * healthCheck is the Day 1 foundation function, proving the TypeScript
 * build, deploy pipeline, and Firebase Admin SDK wiring work.
 *
 * createUserProfile (Day 2, see ./createUserProfile.ts) creates the
 * Firestore /users/{uid} profile document on first sign-in.
 *
 * logAdminAction (Day 3, see ./logAdminAction.ts) writes an immutable
 * /audit_log entry for an admin/host action. It's a callable function, not
 * a Firestore background trigger, despite the spec's "triggers on writes"
 * phrasing -- Firestore triggers carry no caller-identity context at all,
 * so they can't produce a trustworthy admin_id/admin_email. See
 * logAdminAction.ts's own header comment and SECURITY.md's "Day 3" section
 * for the full reasoning.
 *
 * Still to come per FINAL_ARCHITECTURE_SPECIFICATION.md:
 *   - sendNotification()   — Day 10, FCM delivery on admin "send" action
 *
 * Admin SDK is initialized once here and re-exported so future function
 * modules share a single app instance instead of each calling initializeApp().
 */
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import * as functionsV1 from 'firebase-functions/v1';
import { initializeApp } from 'firebase-admin/app';
import { createUserProfileHandler } from './createUserProfile';
import { AdminActionError, logAdminActionHandler } from './logAdminAction';

export const adminApp = initializeApp();

export const healthCheck = onRequest((_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'bethaniya-ministries-functions',
    timestamp: new Date().toISOString(),
  });
});

export const createUserProfile = functionsV1.auth
  .user()
  .onCreate(createUserProfileHandler);

export const logAdminAction = onCall(async (request) => {
  try {
    return await logAdminActionHandler(
      request.data,
      request.auth
        ? { uid: request.auth.uid, email: request.auth.token.email ?? null }
        : undefined
    );
  } catch (error) {
    // Converts the plain AdminActionError logAdminActionHandler throws (see
    // that file's header comment for why it isn't firebase-functions'
    // HttpsError) into a real HttpsError, so callable clients still get the
    // normal { code, message } shape Firebase's SDK expects.
    if (error instanceof AdminActionError) {
      throw new HttpsError(error.code, error.message);
    }
    throw error;
  }
});
