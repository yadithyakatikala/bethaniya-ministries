/**
 * Day 15 integration test: "Create announcement -> verify Firestore ->
 * verify mobile," per FINAL_ARCHITECTURE_SPECIFICATION.md's Day 15 plan.
 *
 * Unlike firestore.rules.test.ts's per-rule pass/fail assertions (which
 * already cover the announcements RBAC matrix exhaustively), this file
 * tells one continuous story through the real lifecycle a Content Admin
 * and a mobile member actually experience, using the same
 * @firebase/rules-unit-testing multi-context environment as
 * firestore.rules.test.ts (each authenticatedContext() is a fully separate
 * signed-in session, evaluated against the real, committed
 * firestore.rules -- not a mock or a re-implementation of the rules):
 *
 *   1. A Content Admin creates a new announcement exactly the way
 *      admin/src/features/announcements/AnnouncementForm.tsx does --
 *      unpublished (see that form's own doc comment: "a new announcement
 *      always starts unpublished").
 *   2. The write is verified by reading it back through the rules engine
 *      (not a rules-bypassing seed read) -- proving the data actually
 *      landed in Firestore with the fields the admin UI sent.
 *   3. A signed-in member (the role the mobile app's own users sign in
 *      as) is proven unable to read the still-unpublished announcement --
 *      it must not appear in the mobile home feed yet.
 *   4. The Content Admin publishes it, the same
 *      publishedToggle in admin/src/features/announcements/AnnouncementsListPage.tsx
 *      performs (an update that must still satisfy isValidAnnouncement()).
 *   5. The same member session now reads it successfully, with the
 *      published data intact -- this is "verify mobile": mobile's
 *      subscribeToAnnouncements() (mobile/src/services/firebase/announcements.ts)
 *      runs this exact read as a signed-in member against this exact rule.
 *
 * BLOCKED in this environment, same as every other firebase-tests file
 * (see README.md's "Testing status"): the Firestore emulator binary
 * download from storage.googleapis.com is blocked by this development
 * environment's network allowlist, and firebase-tests/'s own
 * node_modules has never been installed (firebase@^12 vs.
 * @firebase/rules-unit-testing's peer firebase@^10.0.0 conflict). This
 * test is structurally/type sound and ready to run once either blocker
 * clears -- it has not actually executed here.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

// Must match whatever project id 'firebase emulators:exec' auto-detects --
// see firestore.rules.test.ts's identical comment for why.
const PROJECT_ID = 'demo-no-project';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

/** Seed data bypassing security rules -- used only to assign roles here,
 * the same narrow use as firestore.rules.test.ts's identical helper (role
 * assignment itself, via createUserProfile/updateUserRole, is covered by
 * its own tests -- not what this file is proving). */
async function seed(fn: (adminDb: any) => Promise<void>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fn(ctx.firestore() as any);
  });
}

function dbFor(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

describe('announcement lifecycle: create -> verify Firestore -> verify mobile', () => {
  it('a draft is invisible to a mobile member until the Content Admin publishes it', async () => {
    await seed(async (db) => {
      await db.doc('users/admin-1').set({ role: 'content_admin' });
      await db.doc('users/member-1').set({ role: 'member' });
    });

    const adminDb = dbFor('admin-1');
    const memberDb = dbFor('member-1');
    const announcementRef = adminDb.doc('announcements/sunday-service');

    // 1. Content Admin creates the announcement, unpublished -- matching
    //    AnnouncementForm.tsx's real create path exactly.
    await assertSucceeds(
      announcementRef.set({
        title: 'Sunday Service',
        content: 'Join us at 10am for worship and fellowship.',
        published: false,
        imageUrl: null,
      })
    );

    // 2. Verify Firestore: the write actually landed, read back through
    //    the rules engine as the same Content Admin who wrote it (allowed
    //    regardless of published state -- content_admin+ can read drafts).
    const adminReadBack = await announcementRef.get();
    expect(adminReadBack.exists()).toBe(true);
    expect(adminReadBack.data()).toMatchObject({
      title: 'Sunday Service',
      content: 'Join us at 10am for worship and fellowship.',
      published: false,
    });

    // 3. A mobile member cannot see it yet -- it's still a draft.
    await assertFails(memberDb.doc('announcements/sunday-service').get());

    // 4. Content Admin publishes it -- the same update
    //    AnnouncementsListPage.tsx's "Publish" button performs, and it
    //    must still pass isValidAnnouncement() (all required fields
    //    resent, matching the real update code path).
    await assertSucceeds(
      announcementRef.set({
        title: 'Sunday Service',
        content: 'Join us at 10am for worship and fellowship.',
        published: true,
        imageUrl: null,
      })
    );

    // 5. Verify mobile: the same member session now reads the published
    //    announcement successfully, with the real data intact -- this is
    //    the exact read mobile/src/services/firebase/announcements.ts's
    //    subscribeToAnnouncements() performs for a signed-in member.
    const memberRead = await assertSucceeds(
      memberDb.doc('announcements/sunday-service').get()
    );
    expect(memberRead.data()).toMatchObject({
      title: 'Sunday Service',
      content: 'Join us at 10am for worship and fellowship.',
      published: true,
    });
  });
});
