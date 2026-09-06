/**
 * Shared TypeScript types for the mobile app.
 * Populated incrementally as features are built (auth, content models, etc).
 * Day 1: intentionally empty beyond the app-wide Role type, since no feature
 * screens have been built yet.
 */

export type UserRole = 'super_admin' | 'content_admin' | 'host' | 'member';
