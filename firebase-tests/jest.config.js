/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts'],
  testTimeout: 30000,
  /**
   * ONE WORKER, AND IT IS NOT A PERFORMANCE COMPROMISE -- M7.
   *
   * Every suite here talks to the SAME Firestore emulator instance, and
   * every suite calls clearFirestore() in afterEach. Run in parallel,
   * one file's cleanup wipes another file's seeded /users documents
   * mid-test -- and because callerRole() reads the caller's own user
   * document, the victim does not fail with "permission denied" but with
   * a rules EVALUATION ERROR ("Null value error"), which reads like a
   * broken rule rather than like a deleted fixture.
   *
   * That is exactly how it presented: M7's tests made the suite heavy
   * enough for the race to land, and two unrelated, untouched tests -- an
   * announcement lifecycle check and a phone-number self-update -- began
   * failing at rules the change had not been near. The same run with
   * --runInBand was green.
   *
   * The alternatives are worse. A project id per worker would give each
   * one its own rules sandbox, but storage.rules resolves its
   * cross-service firestore.get() calls against the project the EMULATOR
   * was started with, so the storage suite would then be reading a
   * different project's documents (see firestore.rules.test.ts's note
   * about PROJECT_ID). Dropping clearFirestore() would leak state
   * between tests. Serial is the honest fix, and the suite takes about
   * thirty seconds either way.
   */
  maxWorkers: 1,
};
