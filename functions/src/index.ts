/**
 * Bethaniya Ministries — Cloud Functions entry point.
 *
 * Day 1 foundation only: a single health-check function to prove the
 * TypeScript build, deploy pipeline, and Firebase Admin SDK wiring work.
 *
 * Real functions land starting Day 2/3 per FINAL_ARCHITECTURE_SPECIFICATION.md:
 *   - createUserProfile()  — Day 2, on first sign-in
 *   - logAdminAction()     — Day 3, audit logging trigger on admin writes
 *   - sendNotification()   — Day 10, FCM delivery on admin "send" action
 *
 * Admin SDK is initialized once here and re-exported so future function
 * modules share a single app instance instead of each calling initializeApp().
 */
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';

export const adminApp = initializeApp();

export const healthCheck = onRequest((_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'bethaniya-ministries-functions',
    timestamp: new Date().toISOString(),
  });
});
