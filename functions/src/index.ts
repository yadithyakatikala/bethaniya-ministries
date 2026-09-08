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
 * sendNotification (Day 10, see ./sendNotification.ts) is the admin
 * "Send Notification" action's callable, following the identical
 * callable-not-trigger architecture as logAdminAction for the same
 * reason. It does NOT perform real FCM delivery -- see that file's header
 * comment for the full, honest disclosure of why (no registered push
 * tokens exist anywhere in this project).
 *
 * updateUserRole (Day 11, see ./updateUserRole.ts) is the admin Users
 * page's "change role" callable, same architecture again. Only a Super
 * Admin may call it; it independently enforces a self-demotion guard
 * (a Super Admin can never change their own role through this function)
 * and writes a matching /audit_log entry in the same invocation.
 *
 * Admin SDK is initialized once here and re-exported so future function
 * modules share a single app instance instead of each calling initializeApp().
 */
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import * as functionsV1 from 'firebase-functions/v1';
import { initializeApp } from 'firebase-admin/app';
import { createUserProfileHandler } from './createUserProfile';
import { AdminActionError, logAdminActionHandler } from './logAdminAction';
import { SendNotificationError, sendNotificationHandler } from './sendNotification';
import { UpdateUserRoleError, updateUserRoleHandler } from './updateUserRole';

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

export const sendNotification = onCall(async (request) => {
  try {
    return await sendNotificationHandler(
      request.data,
      request.auth
        ? { uid: request.auth.uid, email: request.auth.token.email ?? null }
        : undefined
    );
  } catch (error) {
    // Same plain-Error-to-HttpsError conversion as logAdminAction above,
    // for the same reason (see sendNotification.ts's header comment).
    if (error instanceof SendNotificationError) {
      throw new HttpsError(error.code, error.message);
    }
    throw error;
  }
});

export const updateUserRole = onCall(async (request) => {
  try {
    return await updateUserRoleHandler(
      request.data,
      request.auth
        ? { uid: request.auth.uid, email: request.auth.token.email ?? null }
        : undefined
    );
  } catch (error) {
    // Same plain-Error-to-HttpsError conversion as logAdminAction/
    // sendNotification above, for the same reason (see updateUserRole.ts's
    // header comment).
    if (error instanceof UpdateUserRoleError) {
      throw new HttpsError(error.code, error.message);
    }
    throw error;
  }
});
