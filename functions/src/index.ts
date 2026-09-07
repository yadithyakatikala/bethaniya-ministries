/**
 * Bethaniya Ministries — Cloud Functions entry point.
 *
 * healthCheck is the Day 1 foundation function, proving the TypeScript
 * build, deploy pipeline, and Firebase Admin SDK wiring work.
 *
 * createUserProfile (Day 2, see ./createUserProfile.ts) creates the
 * Firestore /users/{uid} profile document on first sign-in.
 *
 * Still to come per FINAL_ARCHITECTURE_SPECIFICATION.md:
 *   - logAdminAction()     — Day 3, audit logging trigger on admin writes
 *   - sendNotification()   — Day 10, FCM delivery on admin "send" action
 *
 * Admin SDK is initialized once here and re-exported so future function
 * modules share a single app instance instead of each calling initializeApp().
 */
import { onRequest } from 'firebase-functions/v2/https';
import * as functionsV1 from 'firebase-functions/v1';
import { initializeApp } from 'firebase-admin/app';
import { createUserProfileHandler } from './createUserProfile';

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
