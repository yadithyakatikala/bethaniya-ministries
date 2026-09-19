/**
 * Emulator-backed tests for firestore.rules.
 *
 * These run against a real Firestore emulator instance via
 * @firebase/rules-unit-testing -- assertSucceeds/assertFails perform actual
 * writes/reads through the rules engine, they do not re-implement the rule
 * logic in JS.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

// Must match whatever project id 'firebase emulators:exec' auto-detects.
// With no .firebaserc present it defaults to 'demo-no-project' -- if a real
// .firebaserc is later added (see ENVIRONMENT.md), update this to match its
// default project, since storage.rules' cross-service firestore.get() calls
// are resolved against that project, not the one this SDK client requests.
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

/** Seed data bypassing security rules entirely (admin-equivalent access). */
async function seed(fn: (adminDb: any) => Promise<void>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fn(ctx.firestore() as any);
  });
}

function dbFor(uid: string | null) {
  const ctx = uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext();
  return ctx.firestore();
}

describe('firestore.rules', () => {
  describe('default deny', () => {
    it('blocks unauthenticated reads of an undeclared collection', async () => {
      const db = dbFor(null);
      await assertFails(db.doc('nonexistent_collection/doc1').get());
    });

    it('blocks unauthenticated writes of an undeclared collection', async () => {
      const db = dbFor(null);
      await assertFails(db.doc('nonexistent_collection/doc1').set({ x: 1 }));
    });
  });

  describe('users collection', () => {
    it('allows a new signed-in user to create their own doc with role=member', async () => {
      const db = dbFor('member-1');
      await assertSucceeds(
        db.doc('users/member-1').set({ role: 'member', displayName: 'New Member' })
      );
    });

    it('blocks self-elevation on create (role != member)', async () => {
      const db = dbFor('attacker-1');
      await assertFails(
        db.doc('users/attacker-1').set({ role: 'super_admin', displayName: 'Attacker' })
      );
    });

    it('blocks creating a user doc for a different uid', async () => {
      const db = dbFor('member-1');
      await assertFails(db.doc('users/someone-else').set({ role: 'member' }));
    });

    it('allows a member to read their own doc', async () => {
      await seed(async (db) => db.doc('users/member-1').set({ role: 'member' }));
      const db = dbFor('member-1');
      await assertSucceeds(db.doc('users/member-1').get());
    });

    it('blocks a member from reading another member doc', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/member-2').set({ role: 'member' });
      });
      const db = dbFor('member-1');
      await assertFails(db.doc('users/member-2').get());
    });

    it('allows a content_admin to read any user doc', async () => {
      await seed(async (db) => {
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('users/member-1').set({ role: 'member' });
      });
      const db = dbFor('admin-1');
      await assertSucceeds(db.doc('users/member-1').get());
    });

    // --- Self-creation of one's own profile document -------------------
    // In the deployed app this is the ONLY path that creates /users/{uid}:
    // the equivalent Cloud Function trigger cannot be deployed under the
    // zero-billing constraint, so mobile's ensureOwnProfileExists() is what
    // actually runs. These pin the exact contract that client depends on.

    it('allows a signed-in user to create their own member profile with the expected field shape', async () => {
      // Exactly what mobile's ensureOwnProfileExists() writes.
      const db = dbFor('new-member');
      await assertSucceeds(
        db.doc('users/new-member').set({
          role: 'member',
          displayName: 'New Member',
          email: 'new@example.com',
          phoneNumber: null,
          createdAt: new Date(),
        })
      );
    });

    it('allows omitting optional fields when self-creating a profile', async () => {
      // hasOnly permits a subset, so a caller need not send every key.
      const db = dbFor('new-member');
      await assertSucceeds(
        db.doc('users/new-member').set({ role: 'member', createdAt: new Date() })
      );
    });

    it('blocks self-creating a profile with an elevated role', async () => {
      const db = dbFor('new-member');
      await assertFails(
        db.doc('users/new-member').set({ role: 'super_admin', createdAt: new Date() })
      );
    });

    it('blocks creating a profile document for someone else', async () => {
      const db = dbFor('new-member');
      await assertFails(
        db.doc('users/somebody-else').set({ role: 'member', createdAt: new Date() })
      );
    });

    it('blocks smuggling arbitrary extra fields in at creation time', async () => {
      // The tight update rule only governs LATER writes, so without a
      // keys() allowlist on create, anything injected here would persist
      // unchallenged.
      const db = dbFor('new-member');
      await assertFails(
        db.doc('users/new-member').set({
          role: 'member',
          createdAt: new Date(),
          isChurchAdmin: true,
        })
      );
    });

    it('blocks a member from changing their own role field (self-modification prevention)', async () => {
      await seed(async (db) =>
        db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
      );
      const db = dbFor('member-1');
      await assertFails(db.doc('users/member-1').update({ role: 'super_admin' }));
    });

    it('allows a member to update their own non-role fields', async () => {
      await seed(async (db) =>
        db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
      );
      const db = dbFor('member-1');
      await assertSucceeds(
        db.doc('users/member-1').update({ displayName: 'Updated Name' })
      );
    });

    // Day 9: an owner's self-update may touch displayName/photoURL/
    // languagePreference/themePreference/notificationsEnabled -- and ONLY
    // those fields, each subject to isValidUserProfileSelfUpdate()'s value
    // checks -- see firestore.rules' users/{userId} update rule and its
    // isValidUserProfileSelfUpdate() helper. These cases were added
    // alongside that rule change; the existing 'own non-role fields' test
    // above (displayName alone) already covered the pre-Day-9 shape and
    // still passes unchanged under the new rule.
    describe('Day 9: self-update field/value restrictions', () => {
      it('allows a member to update photoURL/languagePreference/themePreference/notificationsEnabled together', async () => {
        await seed(async (db) =>
          db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
        );
        const db = dbFor('member-1');
        await assertSucceeds(
          db.doc('users/member-1').update({
            photoURL: 'https://example.com/photo.jpg',
            languagePreference: 'te',
            themePreference: 'dark',
            notificationsEnabled: false,
          })
        );
      });

      it('allows a member to set photoURL to null', async () => {
        await seed(async (db) =>
          db
            .doc('users/member-1')
            .set({ role: 'member', displayName: 'A', photoURL: 'https://x/y.jpg' })
        );
        const db = dbFor('member-1');
        await assertSucceeds(db.doc('users/member-1').update({ photoURL: null }));
      });

      it("blocks a member from self-updating their email field", async () => {
        await seed(async (db) =>
          db
            .doc('users/member-1')
            .set({ role: 'member', displayName: 'A', email: 'a@example.com' })
        );
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1').update({ email: 'attacker@example.com' })
        );
      });

      it('blocks a member from self-updating their phoneNumber field', async () => {
        await seed(async (db) =>
          db
            .doc('users/member-1')
            .set({ role: 'member', displayName: 'A', phoneNumber: '+10000000000' })
        );
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1').update({ phoneNumber: '+19999999999' })
        );
      });

      it('blocks a member from self-updating their createdAt field', async () => {
        await seed(async (db) =>
          db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
        );
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1').update({ createdAt: new Date() })
        );
      });

      it('blocks bundling an allowed field with a disallowed one in the same self-update', async () => {
        await seed(async (db) =>
          db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
        );
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1').update({ displayName: 'B', email: 'new@example.com' })
        );
      });

      it('blocks an empty displayName', async () => {
        await seed(async (db) =>
          db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
        );
        const db = dbFor('member-1');
        await assertFails(db.doc('users/member-1').update({ displayName: '' }));
      });

      it('blocks a displayName over 200 characters', async () => {
        await seed(async (db) =>
          db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
        );
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1').update({ displayName: 'x'.repeat(201) })
        );
      });

      it('blocks an invalid languagePreference value', async () => {
        await seed(async (db) =>
          db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
        );
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1').update({ languagePreference: 'fr' })
        );
      });

      it('blocks an invalid themePreference value', async () => {
        await seed(async (db) =>
          db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
        );
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1').update({ themePreference: 'blue' })
        );
      });

      it('blocks a non-boolean notificationsEnabled value', async () => {
        await seed(async (db) =>
          db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
        );
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1').update({ notificationsEnabled: 'yes' })
        );
      });

      it('blocks a non-string, non-null photoURL', async () => {
        await seed(async (db) =>
          db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
        );
        const db = dbFor('member-1');
        await assertFails(db.doc('users/member-1').update({ photoURL: 12345 }));
      });
    });

    it("blocks a content_admin from changing another user's role (only super_admin may)", async () => {
      await seed(async (db) => {
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('users/member-1').set({ role: 'member' });
      });
      const db = dbFor('admin-1');
      await assertFails(db.doc('users/member-1').update({ role: 'host' }));
    });

    it("allows a super_admin to change another user's role field alone", async () => {
      await seed(async (db) => {
        await db.doc('users/super-1').set({ role: 'super_admin' });
        await db.doc('users/member-1').set({ role: 'member' });
      });
      const db = dbFor('super-1');
      await assertSucceeds(db.doc('users/member-1').update({ role: 'host' }));
    });

    it("blocks a member from changing another user's role", async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/member-2').set({ role: 'member' });
      });
      const db = dbFor('member-1');
      await assertFails(db.doc('users/member-2').update({ role: 'super_admin' }));
    });

    // --- Role-value validation (isValidRole) ---------------------------
    // These matter more than they used to: admin role changes now go
    // through a direct client write rather than the (undeployable on
    // Spark) updateUserRole callable, so rules are the ONLY thing
    // validating the incoming value. See
    // admin/src/services/firebase/users.ts.

    it('allows a super_admin to set each of the four recognised roles', async () => {
      await seed(async (db) => {
        await db.doc('users/super-1').set({ role: 'super_admin' });
        await db.doc('users/target-1').set({ role: 'member' });
      });
      const db = dbFor('super-1');
      for (const role of ['member', 'host', 'content_admin', 'super_admin']) {
        await assertSucceeds(db.doc('users/target-1').update({ role }));
      }
    });

    it('blocks a super_admin from setting an unrecognised role value', async () => {
      // Without isValidRole() this succeeded, leaving the target with a
      // role matching no hasRole() branch -- silently stripping every
      // permission they had, including access to their own profile, with
      // no way back short of direct database access.
      await seed(async (db) => {
        await db.doc('users/super-1').set({ role: 'super_admin' });
        await db.doc('users/target-1').set({ role: 'member' });
      });
      const db = dbFor('super-1');
      await assertFails(db.doc('users/target-1').update({ role: 'administrator' }));
      await assertFails(db.doc('users/target-1').update({ role: '' }));
    });

    it('blocks a non-string role value', async () => {
      await seed(async (db) => {
        await db.doc('users/super-1').set({ role: 'super_admin' });
        await db.doc('users/target-1').set({ role: 'member' });
      });
      const db = dbFor('super-1');
      await assertFails(db.doc('users/target-1').update({ role: 42 }));
      await assertFails(db.doc('users/target-1').update({ role: null }));
    });

    it('blocks a super_admin from changing their own role even to a valid value (self-demotion guard)', async () => {
      // The updateUserRole callable enforced this server-side; with the
      // callable out of the path, rules are the only enforcement left.
      await seed(async (db) => {
        await db.doc('users/super-1').set({ role: 'super_admin' });
      });
      const db = dbFor('super-1');
      await assertFails(db.doc('users/super-1').update({ role: 'member' }));
    });

    it('blocks bundling another field into a role change', async () => {
      // admin/src/services/firebase/users.ts writes ONLY { role } for
      // exactly this reason -- an updatedAt touch would be rejected.
      await seed(async (db) => {
        await db.doc('users/super-1').set({ role: 'super_admin' });
        await db.doc('users/target-1').set({ role: 'member' });
      });
      const db = dbFor('super-1');
      await assertFails(
        db.doc('users/target-1').update({ role: 'host', displayName: 'Renamed' })
      );
    });

    it("blocks a host from changing another user's role", async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('users/member-1').set({ role: 'member' });
      });
      const db = dbFor('host-1');
      await assertFails(db.doc('users/member-1').update({ role: 'content_admin' }));
    });

    // Day 11: self-demotion guard, rules layer. functions/src/
    // updateUserRole.ts's callable is the app's only intended path for a
    // role change and independently rejects a caller targeting their own
    // uid -- these two tests prove the SAME restriction holds even for a
    // direct Firestore write that bypasses that callable entirely (e.g.
    // a Super Admin using the client SDK straight from a browser
    // console), which is the actual security boundary the callable's own
    // guard cannot enforce on its own.
    it('blocks a super_admin from changing their own role, even to another valid role', async () => {
      await seed(async (db) => db.doc('users/super-1').set({ role: 'super_admin' }));
      const db = dbFor('super-1');
      await assertFails(db.doc('users/super-1').update({ role: 'content_admin' }));
      // Not just a "same value" no-op edge case -- setting it to a
      // *different*, otherwise-valid role for someone else is still
      // rejected when the target is the caller's own document.
      await assertFails(db.doc('users/super-1').update({ role: 'host' }));
    });

    it('still allows a super_admin to update their own profile fields, unaffected by the self-role-change block', async () => {
      await seed(async (db) =>
        db.doc('users/super-1').set({ role: 'super_admin', displayName: 'A' })
      );
      const db = dbFor('super-1');
      await assertSucceeds(db.doc('users/super-1').update({ displayName: 'B' }));
    });

    it('blocks a super_admin from bundling a role change with other field changes', async () => {
      await seed(async (db) => {
        await db.doc('users/super-1').set({ role: 'super_admin' });
        await db.doc('users/member-1').set({ role: 'member', displayName: 'A' });
      });
      const db = dbFor('super-1');
      await assertFails(
        db.doc('users/member-1').update({ role: 'host', displayName: 'B' })
      );
    });

    it('allows only super_admin to delete a user doc', async () => {
      await seed(async (db) => {
        await db.doc('users/super-1').set({ role: 'super_admin' });
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('users/member-1').set({ role: 'member' });
      });
      await assertFails(dbFor('admin-1').doc('users/member-1').delete());
      await assertSucceeds(dbFor('super-1').doc('users/member-1').delete());
    });
  });

  describe('announcements (published-content restriction)', () => {
    it('blocks an unauthenticated user from reading any announcement', async () => {
      await seed(async (db) => db.doc('announcements/a1').set({ published: true }));
      await assertFails(dbFor(null).doc('announcements/a1').get());
    });

    it('blocks a signed-in member from reading an unpublished announcement', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('announcements/a1').set({ published: false });
      });
      await assertFails(dbFor('member-1').doc('announcements/a1').get());
    });

    it('allows a signed-in member to read a published announcement', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('announcements/a1').set({ published: true });
      });
      await assertSucceeds(dbFor('member-1').doc('announcements/a1').get());
    });

    it('allows a content_admin to read an unpublished announcement', async () => {
      await seed(async (db) => {
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('announcements/a1').set({ published: false });
      });
      await assertSucceeds(dbFor('admin-1').doc('announcements/a1').get());
    });

    it('allows a host to read an unpublished announcement (RBAC table promises Host "read all")', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('announcements/a1').set({ published: false });
      });
      await assertSucceeds(dbFor('host-1').doc('announcements/a1').get());
    });

    it('blocks a member from writing announcements', async () => {
      await seed(async (db) => db.doc('users/member-1').set({ role: 'member' }));
      await assertFails(
        dbFor('member-1').doc('announcements/a2').set({ published: true, body: 'x' })
      );
    });

    it('allows a content_admin to write a valid announcement', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(
        dbFor('admin-1')
          .doc('announcements/a2')
          .set({ title: 'Sunday Service', content: 'Join us at 10am.', published: true, imageUrl: null })
      );
    });

    // ---- Day 4: isValidAnnouncement() field-level validation ------------
    // BLOCKED in this environment: cannot run (see the emulator-cache
    // limitation reported for Day 4 in the End-of-Day report) -- written
    // now so it's ready to run once the emulator is reachable again.
    it('blocks a host from writing announcements (content_admin+ only)', async () => {
      await seed(async (db) => db.doc('users/host-1').set({ role: 'host' }));
      await assertFails(
        dbFor('host-1')
          .doc('announcements/a3')
          .set({ title: 'Title', content: 'Content', published: true, imageUrl: null })
      );
    });

    it('blocks a content_admin write missing a title', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('announcements/a4')
          .set({ content: 'Content', published: true, imageUrl: null })
      );
    });

    it('blocks a content_admin write missing content', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('announcements/a5')
          .set({ title: 'Title', published: true, imageUrl: null })
      );
    });

    it('blocks a content_admin write with an empty title', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('announcements/a6')
          .set({ title: '', content: 'Content', published: true, imageUrl: null })
      );
    });

    it('blocks a content_admin write with a title over 200 characters', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('announcements/a7')
          .set({ title: 'x'.repeat(201), content: 'Content', published: true, imageUrl: null })
      );
    });

    it('blocks a content_admin write with a non-boolean published field', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('announcements/a8')
          .set({ title: 'Title', content: 'Content', published: 'yes', imageUrl: null })
      );
    });

    it('allows a content_admin write with imageUrl omitted entirely', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(
        dbFor('admin-1')
          .doc('announcements/a9')
          .set({ title: 'Title', content: 'Content', published: false })
      );
    });

    it("blocks a content_admin update that leaves an existing announcement's title malformed", async () => {
      await seed(async (db) =>
        db
          .doc('announcements/a10')
          .set({ title: 'Valid', content: 'Content', published: false, imageUrl: null })
      );
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1').doc('announcements/a10').update({ title: '' })
      );
    });
  });

  describe('daily_verses', () => {
    it('allows any signed-in user to read', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('daily_verses/v1').set({ text: 'placeholder' });
      });
      await assertSucceeds(dbFor('member-1').doc('daily_verses/v1').get());
    });

    it('blocks unauthenticated reads', async () => {
      await seed(async (db) => db.doc('daily_verses/v1').set({ text: 'placeholder' }));
      await assertFails(dbFor(null).doc('daily_verses/v1').get());
    });

    it('blocks a member from writing', async () => {
      await seed(async (db) => db.doc('users/member-1').set({ role: 'member' }));
      await assertFails(dbFor('member-1').doc('daily_verses/v1').set({ text: 'x' }));
    });

    it('allows a content_admin to write a valid daily verse', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(
        dbFor('admin-1')
          .doc('daily_verses/v2')
          .set({
            reference: 'John 3:16',
            text: 'For God so loved the world...',
            date: '2026-09-07',
            imageUrl: null,
          })
      );
    });

    // ---- Day 5: isValidDailyVerse() field-level validation ---------------
    // BLOCKED in this environment: cannot run (same emulator-cache
    // limitation reported for Day 4/5's other rules tests) -- written now
    // so it's ready to run once the emulator is reachable again.
    it('blocks a host from writing daily verses (content_admin+ only)', async () => {
      await seed(async (db) => db.doc('users/host-1').set({ role: 'host' }));
      await assertFails(
        dbFor('host-1')
          .doc('daily_verses/v3')
          .set({ reference: 'Ref', text: 'Text', date: '2026-09-07', imageUrl: null })
      );
    });

    it('blocks a content_admin write missing a reference', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('daily_verses/v4')
          .set({ text: 'Text', date: '2026-09-07', imageUrl: null })
      );
    });

    it('blocks a content_admin write missing text', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('daily_verses/v5')
          .set({ reference: 'Ref', date: '2026-09-07', imageUrl: null })
      );
    });

    it('blocks a content_admin write with a missing date', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('daily_verses/v6')
          .set({ reference: 'Ref', text: 'Text', imageUrl: null })
      );
    });

    it('blocks a content_admin write with a malformed date', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('daily_verses/v7')
          .set({ reference: 'Ref', text: 'Text', date: 'not-a-date', imageUrl: null })
      );
    });

    it('blocks a content_admin write with a reference over 200 characters', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('daily_verses/v8')
          .set({ reference: 'x'.repeat(201), text: 'Text', date: '2026-09-07', imageUrl: null })
      );
    });

    it('allows a content_admin write with imageUrl omitted entirely', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(
        dbFor('admin-1')
          .doc('daily_verses/v9')
          .set({ reference: 'Ref', text: 'Text', date: '2026-09-07' })
      );
    });

    it("blocks a content_admin update that leaves an existing daily verse's text malformed", async () => {
      await seed(async (db) =>
        db
          .doc('daily_verses/v10')
          .set({ reference: 'Ref', text: 'Valid text', date: '2026-09-07', imageUrl: null })
      );
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(dbFor('admin-1').doc('daily_verses/v10').update({ text: '' }));
    });
  });

  describe('songs (mirrors announcements)', () => {
    it('blocks reading an unpublished song as a member', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('songs/s1').set({ published: false });
      });
      await assertFails(dbFor('member-1').doc('songs/s1').get());
    });

    it('allows a host to read an unpublished song (RBAC table promises Host "read all")', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('songs/s1').set({ published: false });
      });
      await assertSucceeds(dbFor('host-1').doc('songs/s1').get());
    });

    it('blocks a member from writing songs', async () => {
      await seed(async (db) => db.doc('users/member-1').set({ role: 'member' }));
      await assertFails(dbFor('member-1').doc('songs/s1').set({ published: true }));
    });

    it('allows a content_admin to write a valid song', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(
        dbFor('admin-1')
          .doc('songs/s2')
          .set({
            title: 'Amazing Grace',
            artist: 'Traditional',
            category: 'Hymn',
            lyrics: 'Amazing grace, how sweet the sound',
            audioUrl: 'https://example.com/amazing-grace.mp3',
            published: true,
            coverUrl: null,
          })
      );
    });

    // ---- Day 6: isValidSong() field-level validation ---------------------
    // BLOCKED in this environment: cannot run (see the emulator-cache
    // limitation reported for Day 4 in the End-of-Day report) -- written
    // now so it's ready to run once the emulator is reachable again.
    it('blocks a host from writing songs (content_admin+ only)', async () => {
      await seed(async (db) => db.doc('users/host-1').set({ role: 'host' }));
      await assertFails(
        dbFor('host-1')
          .doc('songs/s3')
          .set({
            title: 'Title',
            artist: 'Artist',
            category: 'Category',
            lyrics: 'Lyrics',
            audioUrl: 'https://example.com/song.mp3',
            published: true,
            coverUrl: null,
          })
      );
    });

    it('blocks a content_admin write missing a title', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('songs/s4')
          .set({
            artist: 'Artist',
            category: 'Category',
            lyrics: 'Lyrics',
            audioUrl: 'https://example.com/song.mp3',
            published: true,
            coverUrl: null,
          })
      );
    });

    it('blocks a content_admin write missing an artist', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('songs/s5')
          .set({
            title: 'Title',
            category: 'Category',
            lyrics: 'Lyrics',
            audioUrl: 'https://example.com/song.mp3',
            published: true,
            coverUrl: null,
          })
      );
    });

    it('blocks a content_admin write missing a category', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('songs/s6')
          .set({
            title: 'Title',
            artist: 'Artist',
            lyrics: 'Lyrics',
            audioUrl: 'https://example.com/song.mp3',
            published: true,
            coverUrl: null,
          })
      );
    });

    it('blocks a content_admin write missing lyrics', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('songs/s7')
          .set({
            title: 'Title',
            artist: 'Artist',
            category: 'Category',
            audioUrl: 'https://example.com/song.mp3',
            published: true,
            coverUrl: null,
          })
      );
    });

    it('blocks a content_admin write missing an audioUrl', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('songs/s8')
          .set({
            title: 'Title',
            artist: 'Artist',
            category: 'Category',
            lyrics: 'Lyrics',
            published: true,
            coverUrl: null,
          })
      );
    });

    it('blocks a content_admin write with an empty title', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('songs/s9')
          .set({
            title: '',
            artist: 'Artist',
            category: 'Category',
            lyrics: 'Lyrics',
            audioUrl: 'https://example.com/song.mp3',
            published: true,
            coverUrl: null,
          })
      );
    });

    it('blocks a content_admin write with a title over 200 characters', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('songs/s10')
          .set({
            title: 'x'.repeat(201),
            artist: 'Artist',
            category: 'Category',
            lyrics: 'Lyrics',
            audioUrl: 'https://example.com/song.mp3',
            published: true,
            coverUrl: null,
          })
      );
    });

    it('blocks a content_admin write with a non-boolean published field', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('songs/s11')
          .set({
            title: 'Title',
            artist: 'Artist',
            category: 'Category',
            lyrics: 'Lyrics',
            audioUrl: 'https://example.com/song.mp3',
            published: 'yes',
            coverUrl: null,
          })
      );
    });

    it('allows a content_admin write with coverUrl omitted entirely', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(
        dbFor('admin-1')
          .doc('songs/s12')
          .set({
            title: 'Title',
            artist: 'Artist',
            category: 'Category',
            lyrics: 'Lyrics',
            audioUrl: 'https://example.com/song.mp3',
            published: false,
          })
      );
    });

    it("blocks a content_admin update that leaves an existing song's title malformed", async () => {
      await seed(async (db) =>
        db.doc('songs/s13').set({
          title: 'Valid',
          artist: 'Artist',
          category: 'Category',
          lyrics: 'Lyrics',
          audioUrl: 'https://example.com/song.mp3',
          published: false,
          coverUrl: null,
        })
      );
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(dbFor('admin-1').doc('songs/s13').update({ title: '' }));
    });
  });

  describe('events (host field-restricted update, isValidEvent())', () => {
    /** A complete, isValidEvent()-passing event document -- spread and override per test. */
    function validEvent(overrides: Record<string, unknown> = {}) {
      return {
        title: 'Sunday Service',
        location: '123 Main St, Springfield',
        description: 'Weekly gathering with worship and teaching.',
        startsAt: new Date('2026-09-20T18:30:00Z'),
        published: true,
        isLive: false,
        youtubeUrl: '',
        ...overrides,
      };
    }

    it('blocks a host from creating an event', async () => {
      await seed(async (db) => db.doc('users/host-1').set({ role: 'host' }));
      await assertFails(dbFor('host-1').doc('events/e1').set(validEvent()));
    });

    it('allows a host to update only isLive/youtubeUrl on an existing event', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('events/e1').set(validEvent());
      });
      await assertSucceeds(
        dbFor('host-1')
          .doc('events/e1')
          .update({ isLive: true, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' })
      );
    });

    it('allows a host to clear youtubeUrl back to an empty string', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db
          .doc('events/e1')
          .set(validEvent({ isLive: true, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }));
      });
      await assertSucceeds(
        dbFor('host-1').doc('events/e1').update({ isLive: false, youtubeUrl: '' })
      );
    });

    it('blocks a host from updating other event fields (e.g. title)', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('events/e1').set(validEvent());
      });
      await assertFails(dbFor('host-1').doc('events/e1').update({ title: 'Renamed' }));
    });

    it('blocks a host from updating title even when isLive is also included', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('events/e1').set(validEvent());
      });
      await assertFails(
        dbFor('host-1').doc('events/e1').update({ isLive: true, title: 'Renamed' })
      );
    });

    it("blocks a host's live-stream update if the resulting youtubeUrl is not a valid http(s) URL", async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('events/e1').set(validEvent());
      });
      await assertFails(
        dbFor('host-1')
          .doc('events/e1')
          .update({ isLive: true, youtubeUrl: 'not-a-url' })
      );
    });

    // Regression test for a Day 7 review finding: an earlier version of
    // admin/src/services/firebase/events.ts's setEventLiveStream() also
    // wrote `updatedAt` alongside isLive/youtubeUrl. Because the rule
    // below is `.hasOnly(['isLive', 'youtubeUrl'])` -- not `.hasAny(...)`
    // -- a Host write that touches ANY other key, including updatedAt,
    // must be rejected. This test proves the rule itself is correctly
    // strict (it was never the bug); the fix was removing updatedAt from
    // the client write, covered separately in
    // admin/src/services/firebase/__tests__/events.test.ts.
    it('blocks a host from modifying updatedAt, even when bundled with a valid isLive/youtubeUrl update', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('events/e1').set(validEvent());
      });
      await assertFails(
        dbFor('host-1')
          .doc('events/e1')
          .update({
            isLive: true,
            youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
            updatedAt: new Date(),
          })
      );
    });

    it('allows a content_admin to create a valid event and fully edit it', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(dbFor('admin-1').doc('events/e2').set(validEvent()));
      await assertSucceeds(
        dbFor('admin-1').doc('events/e2').update(validEvent({ title: 'Renamed' }))
      );
    });

    it('allows a super_admin the same full event management as a content_admin', async () => {
      await seed(async (db) => db.doc('users/super-1').set({ role: 'super_admin' }));
      await assertSucceeds(dbFor('super-1').doc('events/e2').set(validEvent()));
      await assertSucceeds(
        dbFor('super-1').doc('events/e2').update(validEvent({ title: 'Renamed' }))
      );
      await assertSucceeds(dbFor('super-1').doc('events/e2').delete());
    });

    it('allows a content_admin to delete an event; blocks a host from deleting', async () => {
      await seed(async (db) => {
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('events/e1').set(validEvent());
        await db.doc('events/e2').set(validEvent());
      });
      await assertFails(dbFor('host-1').doc('events/e1').delete());
      await assertSucceeds(dbFor('admin-1').doc('events/e2').delete());
    });

    it('blocks a content_admin create with a missing required field (e.g. no location)', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      const { location: _location, ...withoutLocation } = validEvent();
      await assertFails(dbFor('admin-1').doc('events/e3').set(withoutLocation));
    });

    it('blocks a content_admin create where startsAt is not a timestamp', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('events/e3')
          .set(validEvent({ startsAt: '2026-09-20T18:30:00Z' }))
      );
    });

    it('blocks a content_admin create with a non-YouTube-shaped youtubeUrl', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1').doc('events/e3').set(validEvent({ youtubeUrl: 'not-a-url' }))
      );
    });

    it('allows a content_admin create with an empty youtubeUrl (no stream set yet)', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(
        dbFor('admin-1').doc('events/e3').set(validEvent({ youtubeUrl: '' }))
      );
    });

    it('blocks a member from reading an unpublished event', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('events/e1').set(validEvent({ published: false }));
      });
      await assertFails(dbFor('member-1').doc('events/e1').get());
    });

    it('allows a host to read an unpublished event (RBAC table promises Host "read all")', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('events/e1').set(validEvent({ published: false }));
      });
      await assertSucceeds(dbFor('host-1').doc('events/e1').get());
    });

    it('allows a member to read a published event', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('events/e1').set(validEvent({ published: true }));
      });
      await assertSucceeds(dbFor('member-1').doc('events/e1').get());
    });
  });

  describe('notifications_log (write only via Admin SDK)', () => {
    it('blocks all client writes regardless of role', async () => {
      await seed(async (db) => db.doc('users/super-1').set({ role: 'super_admin' }));
      await assertFails(dbFor('super-1').doc('notifications_log/n1').set({ x: 1 }));
    });

    it('allows a host to read the log', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('notifications_log/n1').set({ x: 1 });
      });
      await assertSucceeds(dbFor('host-1').doc('notifications_log/n1').get());
    });

    it('blocks a member from reading the log', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('notifications_log/n1').set({ x: 1 });
      });
      await assertFails(dbFor('member-1').doc('notifications_log/n1').get());
    });
  });

  describe('audit_log (super_admin read-only, write only via Admin SDK)', () => {
    it('blocks all client writes regardless of role', async () => {
      await seed(async (db) => db.doc('users/super-1').set({ role: 'super_admin' }));
      await assertFails(dbFor('super-1').doc('audit_log/e1').set({ x: 1 }));
    });

    it('allows only super_admin to read', async () => {
      await seed(async (db) => {
        await db.doc('users/super-1').set({ role: 'super_admin' });
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('audit_log/e1').set({ x: 1 });
      });
      await assertSucceeds(dbFor('super-1').doc('audit_log/e1').get());
      await assertFails(dbFor('admin-1').doc('audit_log/e1').get());
    });
  });

  describe('settings', () => {
    it('allows any signed-in user to read', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('settings/app').set({ maintenanceMode: false });
      });
      await assertSucceeds(dbFor('member-1').doc('settings/app').get());
    });

    it('blocks a content_admin from writing settings (super_admin only)', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1').doc('settings/app').set({ maintenanceMode: true })
      );
    });

    it('allows a super_admin to write settings', async () => {
      await seed(async (db) => db.doc('users/super-1').set({ role: 'super_admin' }));
      await assertSucceeds(
        dbFor('super-1').doc('settings/app').set({ maintenanceMode: true })
      );
    });
  });

  // ---- New V1 features (Plans/Prayers/Community) -------------------------
  // Added per explicit owner decision after this project's original
  // FINAL_ARCHITECTURE_SPECIFICATION.md scope -- see
  // PRODUCTION_READINESS.md's "New V1 features" section.

  describe('users/{userId}/prayers (fully private per-owner)', () => {
    it('blocks a different member from reading another member\'s prayers', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/member-2').set({ role: 'member' });
        await db
          .doc('users/member-1/prayers/p1')
          .set({ text: 'Please pray for my family.', answered: false });
      });
      await assertFails(dbFor('member-2').doc('users/member-1/prayers/p1').get());
    });

    it('blocks a content_admin from reading another user\'s prayers (fully private, no admin override)', async () => {
      await seed(async (db) => {
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('users/member-1').set({ role: 'member' });
        await db
          .doc('users/member-1/prayers/p1')
          .set({ text: 'Please pray for my family.', answered: false });
      });
      await assertFails(dbFor('admin-1').doc('users/member-1/prayers/p1').get());
    });

    it('allows a member to create/read/update/delete their own prayer', async () => {
      const db = dbFor('member-1');
      await assertSucceeds(
        db.doc('users/member-1/prayers/p1').set({ text: 'Thank you Lord.', answered: false })
      );
      await assertSucceeds(db.doc('users/member-1/prayers/p1').get());
      await assertSucceeds(db.doc('users/member-1/prayers/p1').update({ answered: true }));
      await assertSucceeds(db.doc('users/member-1/prayers/p1').delete());
    });

    it('blocks creating a prayer under a different uid', async () => {
      await assertFails(
        dbFor('member-1')
          .doc('users/member-2/prayers/p1')
          .set({ text: 'x', answered: false })
      );
    });

    it('blocks a prayer write with empty text', async () => {
      await assertFails(
        dbFor('member-1').doc('users/member-1/prayers/p1').set({ text: '', answered: false })
      );
    });
  });

  describe('community (published-content restriction, mirrors announcements)', () => {
    it('blocks a signed-in member from reading an unpublished community post', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('community/c1').set({ published: false });
      });
      await assertFails(dbFor('member-1').doc('community/c1').get());
    });

    it('allows a host to read an unpublished community post (RBAC table promises Host "read all")', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('community/c1').set({ published: false });
      });
      await assertSucceeds(dbFor('host-1').doc('community/c1').get());
    });

    it('allows a signed-in member to read a published community post', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('community/c1').set({ published: true });
      });
      await assertSucceeds(dbFor('member-1').doc('community/c1').get());
    });

    it('blocks a member from writing community posts', async () => {
      await seed(async (db) => db.doc('users/member-1').set({ role: 'member' }));
      await assertFails(
        dbFor('member-1').doc('community/c2').set({ title: 'x', content: 'y', published: true })
      );
    });

    it('allows a content_admin to write a valid community post', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(
        dbFor('admin-1')
          .doc('community/c2')
          .set({ title: 'Baptism Testimony', content: 'God is good.', published: true, imageUrl: null })
      );
    });

    it('blocks a content_admin write missing content', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1').doc('community/c3').set({ title: 'Title', published: true })
      );
    });
  });

  describe('plans + plans/{id}/days (published-content restriction, day visibility follows parent)', () => {
    it('blocks a signed-in member from reading an unpublished plan', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('plans/p1').set({ published: false });
      });
      await assertFails(dbFor('member-1').doc('plans/p1').get());
    });

    it('allows a host to read an unpublished plan (RBAC table promises Host "read all")', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('plans/p1').set({ published: false });
      });
      await assertSucceeds(dbFor('host-1').doc('plans/p1').get());
    });

    it('allows a signed-in member to read a published plan', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('plans/p1').set({ published: true });
      });
      await assertSucceeds(dbFor('member-1').doc('plans/p1').get());
    });

    it('blocks a member from writing plans', async () => {
      await seed(async (db) => db.doc('users/member-1').set({ role: 'member' }));
      await assertFails(
        dbFor('member-1')
          .doc('plans/p2')
          .set({ title: 't', description: 'd', category: 'c', dayCount: 0, order: 0, published: true })
      );
    });

    it('allows a content_admin to write a valid plan', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(
        dbFor('admin-1')
          .doc('plans/p2')
          .set({
            title: '7 Days of Gratitude',
            description: 'A short devotional plan.',
            category: 'Devotional',
            dayCount: 7,
            order: 0,
            published: true,
            coverImageUrl: null,
          })
      );
    });

    it("blocks a member from reading a day under an unpublished plan", async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('plans/p3').set({ published: false });
        await db
          .doc('plans/p3/days/d1')
          .set({ dayNumber: 1, title: 'Day 1', scriptureReference: 'John 3:16', devotional: 'x' });
      });
      await assertFails(dbFor('member-1').doc('plans/p3/days/d1').get());
    });

    it('allows a host to read a day under an unpublished plan (RBAC table promises Host "read all")', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('plans/p3').set({ published: false });
        await db
          .doc('plans/p3/days/d1')
          .set({ dayNumber: 1, title: 'Day 1', scriptureReference: 'John 3:16', devotional: 'x' });
      });
      await assertSucceeds(dbFor('host-1').doc('plans/p3/days/d1').get());
    });

    it('allows a member to read a day under a published plan', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('plans/p3').set({ published: true });
        await db
          .doc('plans/p3/days/d1')
          .set({ dayNumber: 1, title: 'Day 1', scriptureReference: 'John 3:16', devotional: 'x' });
      });
      await assertSucceeds(dbFor('member-1').doc('plans/p3/days/d1').get());
    });

    it('blocks a member from writing a plan day', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('plans/p3').set({ published: true });
      });
      await assertFails(
        dbFor('member-1')
          .doc('plans/p3/days/d2')
          .set({ dayNumber: 2, title: 'Day 2', scriptureReference: 'x', devotional: 'y' })
      );
    });
  });

  describe('users/{userId}/planProgress (fully private per-owner)', () => {
    it('blocks a different member from reading another member\'s plan progress', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/member-2').set({ role: 'member' });
        await db
          .doc('users/member-1/planProgress/p1')
          .set({ startedAt: new Date(), currentDay: 1, completedDays: [] });
      });
      await assertFails(dbFor('member-2').doc('users/member-1/planProgress/p1').get());
    });

    it('allows a member to create/read/update their own plan progress', async () => {
      const db = dbFor('member-1');
      await assertSucceeds(
        db
          .doc('users/member-1/planProgress/p1')
          .set({ startedAt: new Date(), currentDay: 1, completedDays: [] })
      );
      await assertSucceeds(db.doc('users/member-1/planProgress/p1').get());
      await assertSucceeds(
        db.doc('users/member-1/planProgress/p1').update({ currentDay: 2, completedDays: [1] })
      );
    });

    it('blocks creating plan progress under a different uid', async () => {
      await assertFails(
        dbFor('member-1')
          .doc('users/member-2/planProgress/p1')
          .set({ startedAt: new Date(), currentDay: 1, completedDays: [] })
      );
    });
  });

  /**
   * M4 -- the Bible reader's private documents.
   *
   * The whole authorization story is isOwner(userId), so the tests that
   * matter most are the cross-uid ones: a member's highlights, notes,
   * reading settings and reading position must be unreadable and
   * unwritable by anyone else, INCLUDING an admin. The rest pin the field
   * validators, which exist so a hand-written or tampered document cannot
   * put the reader into a state it will not render.
   */
  describe('users/{userId}/highlights (M4, fully private per-owner)', () => {
    const HIGHLIGHT = {
      translationId: 'en',
      bookId: 'john',
      chapter: 3,
      verse: 16,
      colour: 'yellow',
      createdAt: new Date(),
    };

    it('allows a member to create, read, update and delete their own highlight', async () => {
      const db = dbFor('member-1');
      await assertSucceeds(
        db.doc('users/member-1/highlights/en_john_3_16').set(HIGHLIGHT)
      );
      await assertSucceeds(db.doc('users/member-1/highlights/en_john_3_16').get());
      await assertSucceeds(
        db
          .doc('users/member-1/highlights/en_john_3_16')
          .set({ ...HIGHLIGHT, colour: 'blue' })
      );
      await assertSucceeds(db.doc('users/member-1/highlights/en_john_3_16').delete());
    });

    it("blocks another member from reading or writing someone's highlights", async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/member-2').set({ role: 'member' });
        await db.doc('users/member-1/highlights/en_john_3_16').set(HIGHLIGHT);
      });
      await assertFails(
        dbFor('member-2').doc('users/member-1/highlights/en_john_3_16').get()
      );
      await assertFails(
        dbFor('member-2').doc('users/member-1/highlights/en_john_3_16').delete()
      );
      await assertFails(
        dbFor('member-2').doc('users/member-1/highlights/x').set(HIGHLIGHT)
      );
    });

    it('blocks a content_admin too -- there is no admin override on private data', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('users/member-1/highlights/en_john_3_16').set(HIGHLIGHT);
      });
      await assertFails(
        dbFor('admin-1').doc('users/member-1/highlights/en_john_3_16').get()
      );
    });

    it('blocks an unauthenticated caller entirely', async () => {
      await assertFails(dbFor(null).doc('users/member-1/highlights/en_john_3_16').get());
    });

    it('rejects a colour that is not one of the four named tints', async () => {
      await assertFails(
        dbFor('member-1')
          .doc('users/member-1/highlights/en_john_3_16')
          .set({ ...HIGHLIGHT, colour: 'octarine' })
      );
    });

    it('rejects a translation id that is not a bundled translation', async () => {
      // 'bilingual' is a DISPLAY mode, never a translation an annotation
      // can belong to.
      await assertFails(
        dbFor('member-1')
          .doc('users/member-1/highlights/h1')
          .set({ ...HIGHLIGHT, translationId: 'bilingual' })
      );
    });

    it('rejects a reference outside the canon', async () => {
      // 150 is Psalms' chapter count and 176 Psalm 119's verse count --
      // the two maxima in the 66-book canon.
      const db = dbFor('member-1');
      await assertFails(
        db.doc('users/member-1/highlights/h1').set({ ...HIGHLIGHT, chapter: 0 })
      );
      await assertFails(
        db.doc('users/member-1/highlights/h1').set({ ...HIGHLIGHT, chapter: 151 })
      );
      await assertFails(
        db.doc('users/member-1/highlights/h1').set({ ...HIGHLIGHT, verse: 0 })
      );
      await assertFails(
        db.doc('users/member-1/highlights/h1').set({ ...HIGHLIGHT, verse: 177 })
      );
    });

    it('rejects a localized or otherwise non-slug book id', async () => {
      // Book ids are never localized -- see mobile/src/features/bible/books.ts.
      const db = dbFor('member-1');
      await assertFails(
        db.doc('users/member-1/highlights/h1').set({ ...HIGHLIGHT, bookId: 'ఆదికాండము' })
      );
      await assertFails(
        db.doc('users/member-1/highlights/h1').set({ ...HIGHLIGHT, bookId: 'John 3' })
      );
    });

    it('rejects an extra field smuggled onto the document', async () => {
      await assertFails(
        dbFor('member-1')
          .doc('users/member-1/highlights/h1')
          .set({ ...HIGHLIGHT, role: 'super_admin' })
      );
    });
  });

  describe('users/{userId}/bookmarks (M4, fully private per-owner)', () => {
    const BOOKMARK = {
      translationId: 'te',
      bookId: 'song-of-solomon',
      chapter: 2,
      verse: 1,
      createdAt: new Date(),
    };

    it('allows a member to manage their own bookmarks', async () => {
      const db = dbFor('member-1');
      await assertSucceeds(
        db.doc('users/member-1/bookmarks/te_song-of-solomon_2_1').set(BOOKMARK)
      );
      // Idempotent: the same deterministic id, written twice.
      await assertSucceeds(
        db.doc('users/member-1/bookmarks/te_song-of-solomon_2_1').set(BOOKMARK)
      );
      await assertSucceeds(
        db.doc('users/member-1/bookmarks/te_song-of-solomon_2_1').delete()
      );
    });

    it('accepts the optional note field the schema documents', async () => {
      await assertSucceeds(
        dbFor('member-1')
          .doc('users/member-1/bookmarks/b1')
          .set({ ...BOOKMARK, note: 'A short label.' })
      );
    });

    it("blocks another member from touching someone's bookmarks", async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/member-1/bookmarks/b1').set(BOOKMARK);
      });
      await assertFails(dbFor('member-2').doc('users/member-1/bookmarks/b1').get());
      await assertFails(dbFor('member-2').doc('users/member-1/bookmarks/b1').delete());
    });
  });

  describe('users/{userId}/verseNotes (M4, fully private per-owner)', () => {
    const NOTE = {
      translationId: 'en',
      bookId: 'john',
      chapter: 3,
      verse: 16,
      text: 'The whole gospel in one verse.',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('allows a member to write, read and delete their own note', async () => {
      const db = dbFor('member-1');
      await assertSucceeds(db.doc('users/member-1/verseNotes/en_john_3_16').set(NOTE));
      await assertSucceeds(db.doc('users/member-1/verseNotes/en_john_3_16').get());
      await assertSucceeds(db.doc('users/member-1/verseNotes/en_john_3_16').delete());
    });

    it('keeps a note private from every other member AND from admins', async () => {
      // A member's notes on scripture are theirs. This is not a comment
      // system, and no role can read them.
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/admin-1').set({ role: 'super_admin' });
        await db.doc('users/member-1/verseNotes/en_john_3_16').set(NOTE);
      });
      await assertFails(
        dbFor('member-2').doc('users/member-1/verseNotes/en_john_3_16').get()
      );
      await assertFails(
        dbFor('admin-1').doc('users/member-1/verseNotes/en_john_3_16').get()
      );
    });

    it('rejects an empty note and one past the length cap', async () => {
      const db = dbFor('member-1');
      await assertFails(
        db.doc('users/member-1/verseNotes/n1').set({ ...NOTE, text: '' })
      );
      await assertFails(
        db.doc('users/member-1/verseNotes/n1').set({ ...NOTE, text: 'x'.repeat(5001) })
      );
    });
  });

  describe('users/{userId}/readingPrefs (M4)', () => {
    it('allows a member to write and read their own reading settings', async () => {
      const db = dbFor('member-1');
      await assertSucceeds(
        db.doc('users/member-1/readingPrefs/reader').set({
          font: 'serif',
          size: 'lg',
          lineHeight: 'relaxed',
          width: 'wide',
          layout: 'stacked',
        })
      );
      await assertSucceeds(db.doc('users/member-1/readingPrefs/reader').get());
      // A partial merge, which is what the client actually writes.
      await assertSucceeds(
        db.doc('users/member-1/readingPrefs/reader').set({ size: 'xs' }, { merge: true })
      );
    });

    it('rejects a value outside the named steps', async () => {
      const db = dbFor('member-1');
      await assertFails(
        db.doc('users/member-1/readingPrefs/reader').set({ size: 'enormous' })
      );
      await assertFails(db.doc('users/member-1/readingPrefs/reader').set({ size: 42 }));
      await assertFails(
        db.doc('users/member-1/readingPrefs/reader').set({ lineHeight: 'airy' })
      );
      await assertFails(
        db.doc('users/member-1/readingPrefs/reader').set({ width: 'full' })
      );
      await assertFails(
        db.doc('users/member-1/readingPrefs/reader').set({ layout: 'carousel' })
      );
    });

    it('rejects a theme field here -- the app has ONE theme preference', async () => {
      await assertFails(
        dbFor('member-1').doc('users/member-1/readingPrefs/reader').set({ theme: 'dark' })
      );
    });

    it("blocks another member from reading someone's reading settings", async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/member-1/readingPrefs/reader').set({ size: 'lg' });
      });
      await assertFails(
        dbFor('member-2').doc('users/member-1/readingPrefs/reader').get()
      );
    });
  });

  describe('users/{userId}/readingPosition (M4)', () => {
    const POSITION = {
      bookId: 'psalms',
      chapter: 119,
      verse: 105,
      updatedAt: new Date(),
    };

    it('keeps one document per translation', async () => {
      const db = dbFor('member-1');
      await assertSucceeds(db.doc('users/member-1/readingPosition/te').set(POSITION));
      await assertSucceeds(db.doc('users/member-1/readingPosition/en').set(POSITION));
      await assertSucceeds(db.doc('users/member-1/readingPosition/te').get());
    });

    it('rejects a document id that is not a bundled translation', async () => {
      const db = dbFor('member-1');
      await assertFails(db.doc('users/member-1/readingPosition/bilingual').set(POSITION));
      await assertFails(db.doc('users/member-1/readingPosition/fr').set(POSITION));
    });

    it('rejects a reference outside the canon, or an extra field', async () => {
      const db = dbFor('member-1');
      await assertFails(
        db.doc('users/member-1/readingPosition/te').set({ ...POSITION, chapter: 151 })
      );
      // The translation is the document id, not a field.
      await assertFails(
        db
          .doc('users/member-1/readingPosition/te')
          .set({ ...POSITION, translationId: 'te' })
      );
    });

    it("blocks another member from reading someone's place in the Bible", async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/member-1/readingPosition/te').set(POSITION);
      });
      await assertFails(dbFor('member-2').doc('users/member-1/readingPosition/te').get());
    });
  });

  describe("the owner's theme preference accepts 'system' (M4)", () => {
    it('accepts all three values, so the reader and Settings cannot disagree', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member', displayName: 'Member One' });
      });
      const db = dbFor('member-1');
      for (const themePreference of ['light', 'dark', 'system']) {
        await assertSucceeds(db.doc('users/member-1').update({ themePreference }));
      }
    });

    it('still rejects a theme value the app does not recognise', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member', displayName: 'Member One' });
      });
      await assertFails(
        dbFor('member-1').doc('users/member-1').update({ themePreference: 'sepia' })
      );
    });
  });

  // ---- M5: automated Verse of the Day + Prophet Verse ---------------------
  // Two separate systems, tested separately. Every case below is about one
  // of three things: a member cannot configure the automation, a member
  // cannot see content that is not yet due, and a malformed document
  // cannot be stored.

  describe('settings/dailyVerse (M5 VOTD configuration)', () => {
    const config = {
      enabled: true,
      seed: 'maranatha',
      poolVersion: 1,
      timezone: 'Asia/Kolkata',
    };

    it('lets any signed-in member READ it -- every device needs the seed', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('settings/dailyVerse').set(config);
      });
      await assertSucceeds(dbFor('member-1').doc('settings/dailyVerse').get());
    });

    it('blocks a member from changing the seed, the pool version or the switch', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('settings/dailyVerse').set(config);
      });
      const db = dbFor('member-1');
      await assertFails(db.doc('settings/dailyVerse').set({ ...config, seed: 'mine' }));
      await assertFails(db.doc('settings/dailyVerse').update({ enabled: false }));
      await assertFails(db.doc('settings/dailyVerse').update({ poolVersion: 99 }));
      await assertFails(db.doc('settings/dailyVerse').delete());
    });

    it('blocks a host too -- hosts run live streams, not scripture selection', async () => {
      await seed(async (db) => db.doc('users/host-1').set({ role: 'host' }));
      await assertFails(dbFor('host-1').doc('settings/dailyVerse').set(config));
    });

    it('lets a content_admin configure it', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(dbFor('admin-1').doc('settings/dailyVerse').set(config));
    });

    it('lets a super_admin configure it', async () => {
      await seed(async (db) => db.doc('users/super-1').set({ role: 'super_admin' }));
      await assertSucceeds(dbFor('super-1').doc('settings/dailyVerse').set(config));
    });

    it('does NOT hand content admins the rest of settings', async () => {
      // The whole reason settings/dailyVerse is a second, narrower match
      // rather than a widened generic rule: settings/church carries the
      // church's public identity and support email.
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1').doc('settings/church').set({ churchName: 'Not Maranatha' })
      );
    });

    it('rejects a configuration the app could not honour', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      const db = dbFor('admin-1');
      // The timezone is pinned: the selection uses a fixed +05:30 offset,
      // so storing another zone would be a promise the app cannot keep.
      await assertFails(
        db.doc('settings/dailyVerse').set({ ...config, timezone: 'America/New_York' })
      );
      await assertFails(db.doc('settings/dailyVerse').set({ ...config, seed: '' }));
      await assertFails(db.doc('settings/dailyVerse').set({ ...config, poolVersion: 0 }));
      await assertFails(
        db.doc('settings/dailyVerse').set({ ...config, poolVersion: 1.5 })
      );
      await assertFails(db.doc('settings/dailyVerse').set({ ...config, enabled: 'yes' }));
      // A seed is hashed, never rendered -- but it is read by every device
      // on every app open, so it is length- and charset-bounded.
      await assertFails(
        db.doc('settings/dailyVerse').set({ ...config, seed: 'a'.repeat(65) })
      );
      await assertFails(
        db.doc('settings/dailyVerse').set({ ...config, seed: '<script>' })
      );
    });

    it('refuses an unexpected field rather than storing it', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('settings/dailyVerse')
          .set({ ...config, verseText: 'smuggled scripture' })
      );
    });
  });

  describe('verse_pool (M5 automated selection pool)', () => {
    const entry = {
      reference: 'John 3:16',
      bookId: 'john',
      chapter: 3,
      verse: 16,
      order: 0,
      active: true,
    };

    it('lets a member read an ACTIVE entry', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('verse_pool/v1').set(entry);
      });
      await assertSucceeds(dbFor('member-1').doc('verse_pool/v1').get());
    });

    it('hides a deactivated entry from a member, and shows it to an admin', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('verse_pool/v1').set({ ...entry, active: false });
      });
      await assertFails(dbFor('member-1').doc('verse_pool/v1').get());
      // The admin page has to show what it has switched off.
      await assertSucceeds(dbFor('admin-1').doc('verse_pool/v1').get());
    });

    it('blocks a member from adding to, editing or emptying the pool', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('verse_pool/v1').set(entry);
      });
      const db = dbFor('member-1');
      await assertFails(db.doc('verse_pool/v2').set(entry));
      await assertFails(db.doc('verse_pool/v1').update({ active: false }));
      await assertFails(db.doc('verse_pool/v1').delete());
    });

    it('lets a content_admin curate the pool', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      const db = dbFor('admin-1');
      await assertSucceeds(db.doc('verse_pool/v1').set(entry));
      await assertSucceeds(db.doc('verse_pool/v1').set({ ...entry, active: false }));
      await assertSucceeds(db.doc('verse_pool/v1').delete());
    });

    it('rejects a reference that is not a reference', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      const db = dbFor('admin-1');
      // 150 is Psalms' chapter count and 176 is Psalm 119's verse count --
      // the two maxima in the canon, not arbitrary caps.
      await assertFails(db.doc('verse_pool/v1').set({ ...entry, chapter: 151 }));
      await assertFails(db.doc('verse_pool/v1').set({ ...entry, verse: 177 }));
      await assertFails(db.doc('verse_pool/v1').set({ ...entry, chapter: 0 }));
      await assertFails(db.doc('verse_pool/v1').set({ ...entry, verse: 0 }));
      await assertFails(db.doc('verse_pool/v1').set({ ...entry, bookId: 'John' }));
      await assertFails(db.doc('verse_pool/v1').set({ ...entry, bookId: '' }));
      await assertFails(db.doc('verse_pool/v1').set({ ...entry, order: -1 }));
      await assertFails(db.doc('verse_pool/v1').set({ ...entry, active: 'yes' }));
    });

    it('refuses verse TEXT on a pool entry -- the Bible is bundled, not stored', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1')
          .doc('verse_pool/v1')
          .set({ ...entry, text: 'For God so loved the world' })
      );
    });
  });

  describe('prophet_verses (M5, a separate content system)', () => {
    const past = new Date('2020-01-01T00:00:00.000Z');
    const future = new Date('2099-01-01T00:00:00.000Z');
    const record = {
      title: 'A word for the church',
      reference: 'Isaiah 43:19',
      text: 'Behold, I will do a new thing.',
      published: true,
      publishAt: past,
    };

    it('lets a member read one that is published and due', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('prophet_verses/p1').set(record);
      });
      await assertSucceeds(dbFor('member-1').doc('prophet_verses/p1').get());
    });

    it('hides an UNPUBLISHED draft from a member', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('prophet_verses/p1').set({ ...record, published: false });
      });
      await assertFails(dbFor('member-1').doc('prophet_verses/p1').get());
    });

    it('hides a FUTURE schedule from a member, whatever their phone clock says', async () => {
      // The rule compares against request.time -- the server's clock -- so
      // winding the device forward changes nothing.
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('prophet_verses/p1').set({ ...record, publishAt: future });
      });
      await assertFails(dbFor('member-1').doc('prophet_verses/p1').get());
    });

    it('shows drafts and future schedules to a content_admin, who manages them', async () => {
      await seed(async (db) => {
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('prophet_verses/p1').set({ ...record, published: false });
        await db.doc('prophet_verses/p2').set({ ...record, publishAt: future });
      });
      const db = dbFor('admin-1');
      await assertSucceeds(db.doc('prophet_verses/p1').get());
      await assertSucceeds(db.doc('prophet_verses/p2').get());
    });

    it('blocks a member from creating, editing, publishing or deleting one', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('prophet_verses/p1').set({ ...record, published: false });
      });
      const db = dbFor('member-1');
      await assertFails(db.doc('prophet_verses/p2').set(record));
      await assertFails(db.doc('prophet_verses/p1').update({ published: true }));
      await assertFails(db.doc('prophet_verses/p1').update({ text: 'rewritten' }));
      await assertFails(db.doc('prophet_verses/p1').delete());
    });

    it('blocks a host as well', async () => {
      await seed(async (db) => db.doc('users/host-1').set({ role: 'host' }));
      await assertFails(dbFor('host-1').doc('prophet_verses/p1').set(record));
    });

    it('lets a content_admin write, schedule, publish, unpublish and delete', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      const db = dbFor('admin-1');
      await assertSucceeds(db.doc('prophet_verses/p1').set(record));
      await assertSucceeds(db.doc('prophet_verses/p1').set({ ...record, publishAt: future }));
      await assertSucceeds(db.doc('prophet_verses/p1').set({ ...record, published: false }));
      await assertSucceeds(db.doc('prophet_verses/p1').delete());
    });

    it('requires publishAt to be a TIMESTAMP, not a date string', async () => {
      // daily_verses.date is a "YYYY-MM-DD" calendar key matched exactly;
      // publishAt is an instant compared with <=. Different questions,
      // deliberately different types.
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1').doc('prophet_verses/p1').set({ ...record, publishAt: '2026-04-03' })
      );
    });

    it('accepts an external https image url and refuses anything else', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      const db = dbFor('admin-1');
      await assertSucceeds(
        db.doc('prophet_verses/p1').set({ ...record, imageUrl: 'https://example.org/a.jpg' })
      );
      await assertSucceeds(db.doc('prophet_verses/p1').set({ ...record, imageUrl: null }));
      // There is no Storage bucket on this plan, so there are no uploads --
      // and http:// would render as a broken image on Android anyway.
      for (const bad of [
        'http://example.org/a.jpg',
        'javascript:alert(1)',
        'gs://bucket/a.jpg',
        '/local/a.jpg',
        42,
      ]) {
        await assertFails(db.doc('prophet_verses/p1').set({ ...record, imageUrl: bad }));
      }
    });

    it('rejects a record with no words of its own, and an over-long one', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      const db = dbFor('admin-1');
      await assertFails(db.doc('prophet_verses/p1').set({ ...record, title: '' }));
      await assertFails(db.doc('prophet_verses/p1').set({ ...record, text: '' }));
      await assertFails(
        db.doc('prophet_verses/p1').set({ ...record, text: 'x'.repeat(5001) })
      );
      await assertFails(
        db.doc('prophet_verses/p1').set({ ...record, attribution: 'x'.repeat(201) })
      );
    });

    it('refuses an unexpected field rather than storing it', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertFails(
        dbFor('admin-1').doc('prophet_verses/p1').set({ ...record, pinned: true })
      );
    });
  });

  describe('M5 leaves the existing daily-verse override exactly as it was', () => {
    const verse = {
      reference: 'John 3:16',
      text: 'For God so loved the world...',
      date: '2026-04-03',
    };

    it('still lets any signed-in member read an override', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('daily_verses/2026-04-03').set(verse);
      });
      await assertSucceeds(dbFor('member-1').doc('daily_verses/2026-04-03').get());
    });

    it('still blocks a member from writing one', async () => {
      await seed(async (db) => db.doc('users/member-1').set({ role: 'member' }));
      await assertFails(dbFor('member-1').doc('daily_verses/2026-04-03').set(verse));
    });

    it('still lets a content_admin write one -- the override that beats automation', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(dbFor('admin-1').doc('daily_verses/2026-04-03').set(verse));
    });
  });
});
