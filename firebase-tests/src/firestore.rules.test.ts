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

      // M6 REVERSED THIS ONE, DELIBERATELY. It used to assert that a
      // member could NOT change their own phone number, which was right
      // while nothing in the app collected one: the field was set from
      // whatever Firebase Auth happened to know and was server-controlled
      // thereafter. M6's onboarding questionnaire asks for it, so the
      // owner has to be able to write it -- otherwise a member who signed
      // up with an email address can never give the church their number.
      // The widening is safe because a phone number is not an
      // authentication factor anywhere in this app (no phone provider, no
      // OTP) and nothing reads it to decide anything. Rewritten rather
      // than deleted, so the reversal reads as a decision rather than as
      // lost coverage.
      it('lets a member change their own phone number -- M6, blocked before', async () => {
        await seed(async (db) =>
          db
            .doc('users/member-1')
            .set({ role: 'member', displayName: 'A', phoneNumber: '+10000000000' })
        );
        const db = dbFor('member-1');
        await assertSucceeds(
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

    /**
     * M6 BUG 1 + BUG 2 REGRESSION -- the profile shape the app actually
     * creates, which every test above quietly avoided.
     *
     * mobile/src/services/firebase/userProfile.ts's
     * ensureOwnProfileExists() writes `displayName: user.displayName ?? null`,
     * and Firebase Auth gives no displayName to an email/password account
     * whose sign-up left the name blank -- so that field is genuinely
     * `null` for a large share of real members. Every case in the describe
     * block above seeds `displayName: 'A'`, so nothing ever exercised
     * that shape, and isValidUserProfileSelfUpdate()'s unconditional
     * `data.displayName is string && size() > 0` denied EVERY self-update
     * those members made -- which is what "the Bible language toggle does
     * not stick" and "the theme resets itself" actually were. The Firestore
     * SDK applies an update locally before the server sees it and rolls it
     * back on denial, so the app briefly showed the new value and then
     * reverted: a permissions bug wearing a state-management costume.
     *
     * A self-update must therefore leave a VALID displayName -- where
     * absent or null is valid, because that is the state the app itself
     * creates -- and these cases pin the shape rather than the symptom.
     */
    describe('M6: a member whose displayName was never set', () => {
      /** Exactly what ensureOwnProfileExists() writes for such a member. */
      async function seedNamelessMember() {
        await seed(async (db) =>
          db.doc('users/member-1').set({
            role: 'member',
            displayName: null,
            email: 'member@example.com',
            phoneNumber: null,
            createdAt: new Date(),
          })
        );
      }

      it('can still change their Bible mode (BUG 1)', async () => {
        await seedNamelessMember();
        const db = dbFor('member-1');
        await assertSucceeds(
          db.doc('users/member-1').update({ bibleMode: 'en', languagePreference: 'en' })
        );
      });

      it('can still change their theme (BUG 2)', async () => {
        await seedNamelessMember();
        const db = dbFor('member-1');
        await assertSucceeds(
          db.doc('users/member-1').update({ themePreference: 'dark' })
        );
      });

      it('can still change their app language, independently of the Bible', async () => {
        await seedNamelessMember();
        const db = dbFor('member-1');
        await assertSucceeds(db.doc('users/member-1').update({ appLanguage: 'te' }));
      });

      it('can still change their notification preference', async () => {
        await seedNamelessMember();
        const db = dbFor('member-1');
        await assertSucceeds(
          db.doc('users/member-1').update({ notificationsEnabled: false })
        );
      });

      it('can fill in their name -- the onboarding write', async () => {
        await seedNamelessMember();
        const db = dbFor('member-1');
        await assertSucceeds(
          db.doc('users/member-1').update({ displayName: 'Ruth Samuel' })
        );
      });

      // Tolerating null must not become tolerating rubbish: the value
      // checks the describe block above pins still apply to this shape.
      it('still cannot set an empty name, or a 201-character one', async () => {
        await seedNamelessMember();
        const db = dbFor('member-1');
        await assertFails(db.doc('users/member-1').update({ displayName: '' }));
        await assertFails(
          db.doc('users/member-1').update({ displayName: 'x'.repeat(201) })
        );
      });

      it('still cannot set an invalid preference value, or touch a locked field', async () => {
        await seedNamelessMember();
        const db = dbFor('member-1');
        await assertFails(db.doc('users/member-1').update({ bibleMode: 'fr' }));
        await assertFails(db.doc('users/member-1').update({ themePreference: 'blue' }));
        await assertFails(db.doc('users/member-1').update({ role: 'super_admin' }));
        await assertFails(
          db.doc('users/member-1').update({ email: 'attacker@example.com' })
        );
      });

      // A member who has a name may clear it -- it is their own optional
      // display field -- but that is the only way displayName may become
      // null, and it must not let anything else through with it.
      it('may clear a name they had, and nothing else with it', async () => {
        await seed(async (db) =>
          db.doc('users/member-1').set({ role: 'member', displayName: 'A' })
        );
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1').update({ displayName: null, role: 'host' })
        );
        await assertSucceeds(db.doc('users/member-1').update({ displayName: null }));
      });
    });

    /**
     * M6 ONBOARDING -- the profile questionnaire a member answers once
     * after signing in (mobile/src/features/onboarding/). It is NOT an
     * authentication step: there is no phone sign-in provider and no OTP
     * anywhere in this app, and nothing reads these fields to decide
     * anything. They are congregation details the church keeps.
     *
     * Three keys became owner-writable for it: 'gender' and
     * 'profileCompletedAt' are new, and 'phoneNumber' MOVED from
     * server-controlled to owner-writable -- a member who signed up with
     * an email address had no way to give the church their number. The
     * cases below pin both halves: the new writes are allowed, and the
     * fields that stayed locked (email, createdAt, role) still are.
     *
     * The redesigned onboarding added a fourth, 'age' (a whole number,
     * 1..120).
     */
    describe('M6: the onboarding questionnaire', () => {
      async function seedNewMember() {
        await seed(async (db) =>
          db.doc('users/member-1').set({
            role: 'member',
            displayName: null,
            email: 'member@example.com',
            phoneNumber: null,
            createdAt: new Date(),
          })
        );
      }

      it('lets a member write all four answers in one update', async () => {
        await seedNewMember();
        const db = dbFor('member-1');
        await assertSucceeds(
          db.doc('users/member-1').update({
            displayName: 'Ruth Samuel',
            phoneNumber: '+919876543210',
            gender: 'female',
            appLanguage: 'te',
            profileCompletedAt: new Date(),
          })
        );
      });

      it('lets a member change those answers later', async () => {
        await seedNewMember();
        const db = dbFor('member-1');
        await assertSucceeds(
          db.doc('users/member-1').update({ phoneNumber: '9876543210', gender: 'male' })
        );
      });

      it('lets a member withdraw a phone number they gave', async () => {
        await seedNewMember();
        const db = dbFor('member-1');
        await assertSucceeds(db.doc('users/member-1').update({ phoneNumber: null }));
      });

      it('rejects a gender outside the two supported values', async () => {
        await seedNewMember();
        const db = dbFor('member-1');
        await assertFails(db.doc('users/member-1').update({ gender: 'other' }));
        await assertFails(db.doc('users/member-1').update({ gender: '' }));
        await assertFails(db.doc('users/member-1').update({ gender: 1 }));
      });

      it('rejects an app language outside en/te', async () => {
        // The questionnaire's language answer is the APP language, and it
        // is the same field and the same closed set Settings writes.
        await seedNewMember();
        const db = dbFor('member-1');
        await assertFails(db.doc('users/member-1').update({ appLanguage: 'fr' }));
        // 'bilingual' is a BIBLE mode. There is no bilingual interface.
        await assertFails(db.doc('users/member-1').update({ appLanguage: 'bilingual' }));
      });

      it('rejects a phone number that is not a short string', async () => {
        await seedNewMember();
        const db = dbFor('member-1');
        await assertFails(db.doc('users/member-1').update({ phoneNumber: '' }));
        await assertFails(db.doc('users/member-1').update({ phoneNumber: 9876543210 }));
        await assertFails(
          db.doc('users/member-1').update({ phoneNumber: '9'.repeat(33) })
        );
      });

      it('lets a member write an age, alone or with the other answers', async () => {
        await seedNewMember();
        const db = dbFor('member-1');
        await assertSucceeds(db.doc('users/member-1').update({ age: 34 }));
        await assertSucceeds(
          db.doc('users/member-1').update({ age: 1, gender: 'male' })
        );
        await assertSucceeds(db.doc('users/member-1').update({ age: 120 }));
        // and withdraw it
        await assertSucceeds(db.doc('users/member-1').update({ age: null }));
      });

      it('rejects an age that is not a whole number of years from 1 to 120', async () => {
        await seedNewMember();
        const db = dbFor('member-1');
        await assertFails(db.doc('users/member-1').update({ age: 0 }));
        await assertFails(db.doc('users/member-1').update({ age: -5 }));
        await assertFails(db.doc('users/member-1').update({ age: 121 }));
        await assertFails(db.doc('users/member-1').update({ age: 34.5 }));
        await assertFails(db.doc('users/member-1').update({ age: '34' }));
        await assertFails(db.doc('users/member-1').update({ age: true }));
      });

      it("cannot write another member's age", async () => {
        await seedNewMember();
        await seed(async (db) =>
          db.doc('users/member-2').set({ role: 'member', displayName: 'B' })
        );
        const db = dbFor('member-1');
        await assertFails(db.doc('users/member-2').update({ age: 40 }));
      });

      it('cannot be smuggled in when the profile is created', async () => {
        // The create allowlist is unchanged: age arrives by a later update.
        const db = dbFor('member-9');
        await assertFails(
          db.doc('users/member-9').set({
            role: 'member',
            displayName: 'New',
            email: 'new@example.com',
            phoneNumber: null,
            createdAt: new Date(),
            age: 30,
          })
        );
      });

      it('rejects a non-timestamp completion marker', async () => {
        await seedNewMember();
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1').update({ profileCompletedAt: 'yesterday' })
        );
        await assertFails(db.doc('users/member-1').update({ profileCompletedAt: 1 }));
      });

      it('still cannot reach the fields that were never theirs', async () => {
        // The widening was three keys and no more.
        await seedNewMember();
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1').update({ gender: 'male', role: 'super_admin' })
        );
        await assertFails(
          db.doc('users/member-1').update({ gender: 'male', email: 'attacker@example.com' })
        );
        await assertFails(
          db.doc('users/member-1').update({ gender: 'male', createdAt: new Date() })
        );
      });

      it("cannot fill in another member's questionnaire", async () => {
        await seedNewMember();
        await seed(async (db) =>
          db.doc('users/member-2').set({ role: 'member', displayName: 'B' })
        );
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-2').update({ gender: 'male', phoneNumber: '9876543210' })
        );
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

  /**
   * The reading-plan MANAGER's contract with the rules.
   *
   * The five tests above pin the original published/unpublished behaviour
   * and still pass unchanged. These add what the manager needs:
   *
   *  - four statuses (draft, scheduled, published, archived), with
   *    `published` locked to agree, because members' devices ask for
   *    `published == true` and nothing else;
   *  - a SCHEDULED plan that opens by itself when publishAt arrives (the
   *    server's clock decides, as for the media feed);
   *  - days that are readable exactly when their plan is;
   *  - optional day text (devotional no longer required), so a day can be a
   *    passage, a question and a prayer;
   *  - and, throughout, that nothing a member can ask for ever returns a
   *    plan that is not live.
   *
   * Several of these run the real QUERIES the phone runs, not just single
   * reads: Firestore refuses a query unless its constraints prove every
   * possible result is readable, which is a different check from reading
   * one document and the one that actually decides whether the library
   * loads.
   */
  describe('reading-plan manager (statuses, scheduling, day text)', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const past = () => new Date(Date.now() - DAY);
    const future = () => new Date(Date.now() + DAY);

    /** A plan a content admin may write, with a given status and the flag that must agree. */
    function plan(overrides: Record<string, unknown> = {}) {
      return {
        title: 'Seven Days in the Psalms',
        description: 'A week of psalms.',
        category: 'Devotional',
        dayCount: 7,
        order: 1,
        published: false,
        status: 'draft',
        coverImageUrl: null,
        ...overrides,
      };
    }

    const DRAFT = plan();
    const PUBLISHED = plan({ published: true, status: 'published' });
    const ARCHIVED = plan({ status: 'archived' });
    const SCHEDULED_LATER = () => plan({ status: 'scheduled', publishAt: future() });
    const SCHEDULED_DUE = () => plan({ status: 'scheduled', publishAt: past() });
    /** Written by the app before the manager existed: no status at all. */
    const LEGACY_PUBLISHED = {
      title: 'Old plan',
      description: 'From before.',
      category: 'Topical',
      dayCount: 3,
      order: 5,
      published: true,
    };
    const LEGACY_DRAFT = { ...LEGACY_PUBLISHED, published: false };

    const DAY_DOC = {
      dayNumber: 1,
      title: 'Day 1',
      scriptureReference: 'Psalm 23',
      devotional: 'x',
    };

    async function seedUsers() {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('users/super-1').set({ role: 'super_admin' });
      });
    }

    async function seedPlan(id: string, data: Record<string, unknown>) {
      await seed(async (db) => {
        await db.doc(`plans/${id}`).set(data);
        await db.doc(`plans/${id}/days/d1`).set(DAY_DOC);
      });
    }

    describe('who can read a plan, and its days, in each state', () => {
      it.each([
        ['a draft', DRAFT],
        ['an archived plan', ARCHIVED],
        ['a scheduled plan before its time', SCHEDULED_LATER()],
        ['an old plan that is not published', LEGACY_DRAFT],
      ])('keeps %s from a member, but not from an administrator', async (_name, data) => {
        await seedUsers();
        await seedPlan('p', data);

        await assertFails(dbFor('member-1').doc('plans/p').get());
        await assertFails(dbFor('member-1').doc('plans/p/days/d1').get());
        await assertFails(dbFor(null).doc('plans/p').get());

        await assertSucceeds(dbFor('host-1').doc('plans/p').get());
        await assertSucceeds(dbFor('host-1').doc('plans/p/days/d1').get());
        await assertSucceeds(dbFor('admin-1').doc('plans/p').get());
        await assertSucceeds(dbFor('super-1').doc('plans/p/days/d1').get());
      });

      it.each([
        ['a published plan', PUBLISHED],
        ['an old published plan with no status', LEGACY_PUBLISHED],
        ['a scheduled plan whose time has come', SCHEDULED_DUE()],
      ])('gives %s, and its days, to a signed-in member', async (_name, data) => {
        await seedUsers();
        await seedPlan('p', data);

        await assertSucceeds(dbFor('member-1').doc('plans/p').get());
        await assertSucceeds(dbFor('member-1').doc('plans/p/days/d1').get());
        // Signing in is still required.
        await assertFails(dbFor(null).doc('plans/p').get());
        await assertFails(dbFor(null).doc('plans/p/days/d1').get());
      });

      it('lists the days of a live plan for a member, and of a draft for nobody but staff', async () => {
        await seedUsers();
        await seedPlan('live', PUBLISHED);
        await seedPlan('draft', DRAFT);

        const live = await assertSucceeds(
          dbFor('member-1').collection('plans/live/days').orderBy('dayNumber').get()
        );
        expect(live.size).toBe(1);
        await assertFails(
          dbFor('member-1').collection('plans/draft/days').orderBy('dayNumber').get()
        );
        await assertSucceeds(
          dbFor('host-1').collection('plans/draft/days').orderBy('dayNumber').get()
        );
      });

      it('opens a scheduled plan by the SERVER clock, not by anything the client says', async () => {
        await seedUsers();
        await seedPlan('later', SCHEDULED_LATER());
        // A client cannot make its own copy of the document say it is due:
        // the rule reads the stored publishAt.
        await assertFails(dbFor('member-1').doc('plans/later').get());
        await assertFails(dbFor('member-1').doc('plans/later/days/d1').get());
      });

      it('opens a scheduled plan, and its days, when the server clock reaches its time -- not before', async () => {
        await seedUsers();
        const opensAt = new Date(Date.now() + 5000);
        await seedPlan('soon', plan({ status: 'scheduled', publishAt: opensAt }));
        const startedEarly = Date.now() < opensAt.getTime() - 1500;

        // EVERY attempt is on a connection of its own, on purpose. The emulator
        // fixes `request.time` when a connection is opened, so a client that was
        // already connected when the moment passed keeps being judged by the time
        // it connected, and would stay refused. (A phone that is open across the
        // moment is the case that matters in production; see READING_PLANS.md.)
        async function attempt() {
          const startedAt = Date.now();
          const member = dbFor('member-1');
          try {
            await member.doc('plans/soon').get();
            await member.doc('plans/soon/days/d1').get();
            return { opened: true, startedAt };
          } catch {
            return { opened: false, startedAt };
          }
        }

        const giveUpAt = Date.now() + 25_000;
        let refusals = 0;
        let firstOpen: number | null = null;
        while (firstOpen === null) {
          if (Date.now() > giveUpAt) throw new Error('The scheduled plan never opened.');
          const result = await attempt();
          if (result.opened) firstOpen = result.startedAt;
          else {
            refusals += 1;
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
        }

        // Not early: the first read that worked began no sooner than the plan was
        // due, give or take a second for the round trip.
        expect(firstOpen).toBeGreaterThanOrEqual(opensAt.getTime() - 1000);
        // And it really was refused until then.
        if (startedEarly) expect(refusals).toBeGreaterThan(0);
      });
    });

    describe('the queries the phone runs', () => {
      async function seedLibrary() {
        await seedUsers();
        await seed(async (db) => {
          await db.doc('plans/live').set({ ...PUBLISHED, order: 2 });
          await db.doc('plans/legacy').set({ ...LEGACY_PUBLISHED, order: 3 });
          await db.doc('plans/draft').set({ ...DRAFT, order: 1 });
          await db.doc('plans/archived').set({ ...ARCHIVED, order: 4 });
          await db.doc('plans/later').set({ ...SCHEDULED_LATER(), order: 5 });
          await db.doc('plans/due').set({ ...SCHEDULED_DUE(), order: 6 });
        });
      }

      it('returns exactly the published plans for a member, drafts and the rest never', async () => {
        await seedLibrary();
        const result = await assertSucceeds(
          dbFor('member-1')
            .collection('plans')
            .where('published', '==', true)
            .orderBy('order', 'asc')
            .get()
        );
        expect(result.docs.map((d) => d.id)).toEqual(['live', 'legacy']);
      });

      it('returns the published plans with no ordering, so a plan that has no `order` is not lost', async () => {
        // This is the library query the phone runs: it sorts for itself, because
        // asking Firestore to order by a field leaves out every document without it
        // (a plan from before the manager, or one the starter-plan script wrote).
        await seedLibrary();
        await seed(async (db) => {
          const { order: _order, ...withoutOrder } = LEGACY_PUBLISHED;
          await db.doc('plans/unordered').set(withoutOrder);
        });
        const result = await assertSucceeds(
          dbFor('member-1').collection('plans').where('published', '==', true).get()
        );
        expect(result.docs.map((d) => d.id).sort()).toEqual(['legacy', 'live', 'unordered']);
      });

      it('returns the scheduled plans whose time has come, and only those', async () => {
        await seedLibrary();
        const bound = new Date(Date.now() - 60 * 1000);
        const result = await assertSucceeds(
          dbFor('member-1')
            .collection('plans')
            .where('status', '==', 'scheduled')
            .where('publishAt', '<=', bound)
            .get()
        );
        expect(result.docs.map((d) => d.id)).toEqual(['due']);
      });

      it('refuses a scheduled-plans query that reaches into the future', async () => {
        await seedLibrary();
        // A phone whose clock runs fast asks for a bound the server has not
        // reached; the app retries five minutes earlier on this denial.
        await assertFails(
          dbFor('member-1')
            .collection('plans')
            .where('status', '==', 'scheduled')
            .where('publishAt', '<=', new Date(Date.now() + DAY))
            .get()
        );
      });

      it('refuses a member any query that could return an unpublished plan', async () => {
        await seedLibrary();
        const member = dbFor('member-1');
        await assertFails(member.collection('plans').get());
        await assertFails(
          member.collection('plans').where('published', '==', false).get()
        );
        await assertFails(
          member.collection('plans').where('status', '==', 'draft').get()
        );
        await assertFails(
          member.collection('plans').where('status', '==', 'archived').get()
        );
        await assertFails(member.collection('plans').orderBy('order').get());
        // Asking for scheduled plans without a bound would include future ones.
        await assertFails(
          member.collection('plans').where('status', '==', 'scheduled').get()
        );
      });

      it('lets an administrator list every plan', async () => {
        await seedLibrary();
        for (const uid of ['host-1', 'admin-1', 'super-1']) {
          const all = await assertSucceeds(
            dbFor(uid).collection('plans').orderBy('order', 'asc').get()
          );
          expect(all.size).toBe(6);
        }
      });
    });

    describe('what an administrator may write', () => {
      beforeEach(async () => {
        await seedUsers();
      });

      it('accepts a draft, a published plan, an archived plan and a future schedule', async () => {
        const db = dbFor('admin-1');
        await assertSucceeds(db.doc('plans/a').set(DRAFT));
        await assertSucceeds(db.doc('plans/b').set(PUBLISHED));
        await assertSucceeds(db.doc('plans/c').set(ARCHIVED));
        await assertSucceeds(db.doc('plans/d').set(SCHEDULED_LATER()));
      });

      it('still accepts a plan with none of the manager fields', async () => {
        const db = dbFor('admin-1');
        await assertSucceeds(db.doc('plans/old').set(LEGACY_PUBLISHED));
        await assertSucceeds(db.doc('plans/older').set(LEGACY_DRAFT));
      });

      it('accepts every new optional field when it is valid', async () => {
        await assertSucceeds(
          dbFor('admin-1')
            .doc('plans/full')
            .set(
              plan({
                subtitle: 'Rest for the weary',
                author: 'Pastor Samuel',
                language: 'te',
                estimatedMinutes: 15,
                createdBy: 'admin-1',
                publishedAt: null,
                publishAt: null,
              })
            )
        );
      });

      it('lets a published plan be unpublished and an old plan gain a status on edit', async () => {
        await seed(async (db) => db.doc('plans/p').set(LEGACY_PUBLISHED));
        const db = dbFor('admin-1');
        await assertSucceeds(
          db.doc('plans/p').update({ status: 'published', language: 'en' })
        );
        await assertSucceeds(
          db.doc('plans/p').update({ status: 'draft', published: false })
        );
      });

      describe('status and published must agree', () => {
        it.each([
          ['published=true with status draft', { published: true, status: 'draft' }],
          [
            'published=true with status archived',
            { published: true, status: 'archived' },
          ],
          [
            'published=true with status scheduled',
            { published: true, status: 'scheduled', publishAt: new Date() },
          ],
          [
            'published=false with status published',
            { published: false, status: 'published' },
          ],
          ['an unknown status', { published: false, status: 'live' }],
          ['a status that is not a string', { published: false, status: 1 }],
        ])('refuses %s', async (_name, fields) => {
          await assertFails(dbFor('admin-1').doc('plans/x').set(plan(fields)));
        });

        // An edit that touches only ONE of the two fields. The rules judge the
        // plan as it WOULD BE afterwards, so this cannot leave them disagreeing
        // -- which is what the editor's quick actions rely on.
        describe('when only one of them is changed on a plan that exists', () => {
          it.each([
            ['a draft cannot go live by `published` alone', DRAFT, { published: true }],
            ['a draft cannot go live by `status` alone', DRAFT, { status: 'published' }],
            [
              'a published plan cannot be archived by `status` alone',
              PUBLISHED,
              { status: 'archived' },
            ],
            [
              'a published plan cannot be hidden by `published` alone',
              PUBLISHED,
              { published: false },
            ],
            [
              'a scheduled plan cannot go live by `published` alone',
              SCHEDULED_LATER(),
              { published: true },
            ],
            [
              'a scheduled plan cannot lose the time it was scheduled for',
              SCHEDULED_LATER(),
              { publishAt: null },
            ],
          ])('refuses it: %s', async (_name, stored, change) => {
            await seed(async (db) => db.doc('plans/p').set(stored));
            await assertFails(dbFor('admin-1').doc('plans/p').update(change));
          });

          it('accepts the same changes made together, which is how the editor makes them', async () => {
            await seed(async (db) => {
              await db.doc('plans/d').set(DRAFT);
              await db.doc('plans/p').set(PUBLISHED);
            });
            const db = dbFor('admin-1');
            await assertSucceeds(
              db.doc('plans/d').update({ published: true, status: 'published' })
            );
            await assertSucceeds(
              db.doc('plans/p').update({ published: false, status: 'archived' })
            );
          });

          it('refuses to empty a live plan in place', async () => {
            await seed(async (db) => {
              await db.doc('plans/p').set(PUBLISHED);
              await db.doc('plans/s').set(SCHEDULED_LATER());
            });
            const db = dbFor('admin-1');
            await assertFails(db.doc('plans/p').update({ dayCount: 0 }));
            await assertFails(db.doc('plans/p').update({ description: '' }));
            await assertFails(db.doc('plans/s').update({ dayCount: 0 }));
            await assertFails(db.doc('plans/s').update({ description: '' }));
          });
        });
      });

      describe('scheduling', () => {
        it('needs a publishAt that is a timestamp', async () => {
          const db = dbFor('admin-1');
          const noTime = plan({ status: 'scheduled' });
          await assertFails(db.doc('plans/a').set(noTime));
          await assertFails(
            db.doc('plans/b').set(plan({ status: 'scheduled', publishAt: null }))
          );
          await assertFails(
            db.doc('plans/c').set(plan({ status: 'scheduled', publishAt: '2030-01-01' }))
          );
          await assertSucceeds(db.doc('plans/d').set(SCHEDULED_LATER()));
        });

        it('refuses a publishAt that is not a timestamp on any status', async () => {
          await assertFails(
            dbFor('admin-1')
              .doc('plans/x')
              .set(plan({ publishAt: 'tomorrow' }))
          );
        });
      });

      describe('a plan going live needs something to show', () => {
        it('refuses publishing with no days', async () => {
          await assertFails(
            dbFor('admin-1')
              .doc('plans/x')
              .set(plan({ published: true, status: 'published', dayCount: 0 }))
          );
        });

        it('refuses scheduling with no days', async () => {
          await assertFails(
            dbFor('admin-1')
              .doc('plans/x')
              .set({ ...SCHEDULED_LATER(), dayCount: 0 })
          );
        });

        it('refuses publishing or scheduling with no description', async () => {
          const db = dbFor('admin-1');
          await assertFails(db.doc('plans/x').set({ ...PUBLISHED, description: '' }));
          await assertFails(
            db.doc('plans/y').set({ ...SCHEDULED_LATER(), description: '' })
          );
        });

        it('still lets a half-built plan be saved as a draft or archived', async () => {
          const db = dbFor('admin-1');
          await assertSucceeds(
            db.doc('plans/x').set(plan({ description: '', dayCount: 0 }))
          );
          await assertSucceeds(
            db
              .doc('plans/y')
              .set(plan({ status: 'archived', description: '', dayCount: 0 }))
          );
        });

        it('refuses to flip an empty draft to published in place', async () => {
          await seed(async (db) =>
            db.doc('plans/x').set(plan({ description: '', dayCount: 0 }))
          );
          await assertFails(
            dbFor('admin-1')
              .doc('plans/x')
              .update({ published: true, status: 'published' })
          );
        });

        // COMPATIBILITY, and a deliberate tightening: before the manager, a plan
        // could be published with no days at all (its dayCount was 0). It still
        // READS fine -- members see what they always did -- but it is held to the
        // new rule the next time anyone edits it. The way out is to add a day, or
        // to unpublish or archive it, and both stay open. The editor recomputes
        // dayCount from the real days on every save, so adding a day is enough.
        describe('an old published plan that has no days', () => {
          const OLD_EMPTY = {
            title: 'Old plan',
            description: 'From before.',
            category: 'Topical',
            dayCount: 0,
            order: 3,
            published: true,
          };

          it('is still readable by a member', async () => {
            await seed(async (db) => db.doc('plans/old').set(OLD_EMPTY));
            await assertSucceeds(dbFor('member-1').doc('plans/old').get());
          });

          it('cannot be edited in place while it is published, but can be taken back or fixed', async () => {
            await seed(async (db) => {
              await db.doc('plans/a').set(OLD_EMPTY);
              await db.doc('plans/b').set(OLD_EMPTY);
              await db.doc('plans/c').set(OLD_EMPTY);
            });
            const db = dbFor('admin-1');
            await assertFails(db.doc('plans/a').update({ order: 9 }));
            await assertSucceeds(
              db.doc('plans/a').update({ published: false, status: 'draft' })
            );
            await assertSucceeds(
              db.doc('plans/b').update({ published: false, status: 'archived' })
            );
            await assertSucceeds(db.doc('plans/c').update({ dayCount: 1, order: 9 }));
          });
        });

        it('keeps the description limit', async () => {
          await assertFails(
            dbFor('admin-1')
              .doc('plans/x')
              .set(plan({ description: 'd'.repeat(2001) }))
          );
          await assertSucceeds(
            dbFor('admin-1')
              .doc('plans/y')
              .set(plan({ description: 'd'.repeat(2000) }))
          );
        });
      });

      describe('field shapes', () => {
        it.each([
          ['an empty title', { title: '' }],
          ['a title over 200 characters', { title: 't'.repeat(201) }],
          ['an empty category', { category: '' }],
          ['a category over 100 characters', { category: 'c'.repeat(101) }],
          ['a negative day count', { dayCount: -1 }],
          ['a fractional day count', { dayCount: 1.5 }],
          ['a non-integer order', { order: 'first' }],
          ['published that is not a boolean', { published: 'yes', status: undefined }],
          ['a language the app does not have', { language: 'fr' }],
          ['a language that is not a string', { language: 1 }],
          ['estimatedMinutes of 0', { estimatedMinutes: 0 }],
          ['estimatedMinutes over 240', { estimatedMinutes: 241 }],
          ['a fractional estimatedMinutes', { estimatedMinutes: 7.5 }],
          ['a subtitle over 200 characters', { subtitle: 's'.repeat(201) }],
          ['an author over 120 characters', { author: 'a'.repeat(121) }],
          ['a createdBy that is not a string', { createdBy: 42 }],
          ['a coverImageUrl that is not a string', { coverImageUrl: 7 }],
        ])('refuses %s', async (_name, fields) => {
          const bad = { ...plan(), ...fields } as Record<string, unknown>;
          for (const key of Object.keys(bad)) {
            if (bad[key] === undefined) delete bad[key];
          }
          await assertFails(dbFor('admin-1').doc('plans/x').set(bad));
        });

        it('accepts the edges of each limit', async () => {
          await assertSucceeds(
            dbFor('admin-1')
              .doc('plans/x')
              .set(
                plan({
                  title: 't'.repeat(200),
                  category: 'c'.repeat(100),
                  subtitle: 's'.repeat(200),
                  author: 'a'.repeat(120),
                  estimatedMinutes: 240,
                })
              )
          );
          await assertSucceeds(
            dbFor('admin-1')
              .doc('plans/y')
              .set(plan({ estimatedMinutes: 1 }))
          );
        });
      });

      it('lets a content admin and a super admin delete a plan, and nobody else', async () => {
        await seed(async (db) => {
          await db.doc('plans/a').set(DRAFT);
          await db.doc('plans/b').set(DRAFT);
          await db.doc('plans/c').set(DRAFT);
          await db.doc('plans/d').set(DRAFT);
        });
        await assertFails(dbFor('member-1').doc('plans/a').delete());
        await assertFails(dbFor('host-1').doc('plans/a').delete());
        await assertFails(dbFor(null).doc('plans/a').delete());
        await assertSucceeds(dbFor('admin-1').doc('plans/b').delete());
        await assertSucceeds(dbFor('super-1').doc('plans/c').delete());
      });

      it('lets neither a host nor a member write a plan', async () => {
        await assertFails(dbFor('host-1').doc('plans/x').set(DRAFT));
        await assertFails(dbFor('member-1').doc('plans/x').set(DRAFT));
        await assertFails(dbFor(null).doc('plans/x').set(DRAFT));
      });

      it('lets neither a host nor a member change the status of a plan', async () => {
        await seed(async (db) => db.doc('plans/p').set(DRAFT));
        await assertFails(
          dbFor('host-1').doc('plans/p').update({ published: true, status: 'published' })
        );
        await assertFails(
          dbFor('member-1')
            .doc('plans/p')
            .update({ published: true, status: 'published' })
        );
      });
    });

    describe('what a day may contain', () => {
      beforeEach(async () => {
        await seedUsers();
        await seed(async (db) => db.doc('plans/p').set(PUBLISHED));
      });

      it('accepts a day that is only a passage -- the devotional is optional', async () => {
        await assertSucceeds(
          dbFor('admin-1')
            .doc('plans/p/days/d1')
            .set({ dayNumber: 1, title: 'Psalm 23', scriptureReference: 'Psalm 23' })
        );
      });

      it('accepts a day with an empty devotional', async () => {
        await assertSucceeds(
          dbFor('admin-1')
            .doc('plans/p/days/d1')
            .set({ ...DAY_DOC, devotional: '' })
        );
      });

      it('accepts a day with every optional text field, and several passages', async () => {
        await assertSucceeds(
          dbFor('admin-1')
            .doc('plans/p/days/d1')
            .set({
              ...DAY_DOC,
              scriptureReference: 'Psalm 23; John 10:11-18',
              devotional: 'Reflect.',
              reflectionQuestion: 'Where has the Shepherd led you?',
              prayerPrompt: 'Thank him.',
              application: 'Call someone who is walking through a valley.',
              notes: 'Written by David.',
            })
        );
      });

      it('still accepts a day in the original shape', async () => {
        await assertSucceeds(dbFor('admin-1').doc('plans/p/days/d1').set(DAY_DOC));
      });

      it.each([
        ['day 0', { dayNumber: 0 }],
        ['day 1001', { dayNumber: 1001 }],
        ['a fractional day number', { dayNumber: 1.5 }],
        ['a day number that is not a number', { dayNumber: '1' }],
        ['an empty title', { title: '' }],
        ['a title over 200 characters', { title: 't'.repeat(201) }],
        ['no passage', { scriptureReference: '' }],
        ['a passage field over 200 characters', { scriptureReference: 'p'.repeat(201) }],
        ['a devotional over 5000 characters', { devotional: 'd'.repeat(5001) }],
        ['a prayer over 1000 characters', { prayerPrompt: 'p'.repeat(1001) }],
        [
          'a reflection question over 1000 characters',
          { reflectionQuestion: 'q'.repeat(1001) },
        ],
        ['an application over 2000 characters', { application: 'a'.repeat(2001) }],
        ['notes over 3000 characters', { notes: 'n'.repeat(3001) }],
        ['a devotional that is not text', { devotional: 5 }],
        ['a reflection question that is not text', { reflectionQuestion: ['x'] }],
      ])('refuses %s', async (_name, fields) => {
        await assertFails(
          dbFor('admin-1')
            .doc('plans/p/days/d1')
            .set({ ...DAY_DOC, ...fields })
        );
      });

      it('accepts the edges of each limit', async () => {
        await assertSucceeds(
          dbFor('admin-1')
            .doc('plans/p/days/d1')
            .set({
              ...DAY_DOC,
              dayNumber: 1000,
              title: 't'.repeat(200),
              scriptureReference: 'p'.repeat(200),
              devotional: 'd'.repeat(5000),
              prayerPrompt: 'p'.repeat(1000),
              reflectionQuestion: 'q'.repeat(1000),
              application: 'a'.repeat(2000),
              notes: 'n'.repeat(3000),
            })
        );
      });

      it('lets neither a host nor a member write or delete a day', async () => {
        await seed(async (db) => db.doc('plans/p/days/d9').set(DAY_DOC));
        await assertFails(dbFor('host-1').doc('plans/p/days/d1').set(DAY_DOC));
        await assertFails(dbFor('member-1').doc('plans/p/days/d1').set(DAY_DOC));
        await assertFails(dbFor('host-1').doc('plans/p/days/d9').delete());
        await assertFails(dbFor('member-1').doc('plans/p/days/d9').delete());
        await assertSucceeds(dbFor('admin-1').doc('plans/p/days/d9').delete());
      });

      it('lets an administrator write a whole plan in ONE batch (the editor saves this way)', async () => {
        // 1 plan + 60 days + 1 removed day. Proves the per-request limit on
        // rules lookups is not exceeded by a large save.
        await seed(async (db) => db.doc('plans/old/days/gone').set(DAY_DOC));
        const db = dbFor('admin-1');
        const batch = db.batch();
        batch.set(db.doc('plans/new'), { ...DRAFT, dayCount: 60 });
        for (let n = 1; n <= 60; n += 1) {
          batch.set(db.doc(`plans/new/days/d${n}`), {
            ...DAY_DOC,
            dayNumber: n,
            title: `Day ${n}`,
          });
        }
        batch.delete(db.doc('plans/old/days/gone'));
        await assertSucceeds(batch.commit());
        const written = await assertSucceeds(
          dbFor('admin-1').collection('plans/new/days').orderBy('dayNumber').get()
        );
        expect(written.size).toBe(60);
      });

      it('refuses the whole batch if one day in it is invalid', async () => {
        const db = dbFor('admin-1');
        const batch = db.batch();
        batch.set(db.doc('plans/new'), { ...DRAFT, dayCount: 2 });
        batch.set(db.doc('plans/new/days/d1'), DAY_DOC);
        batch.set(db.doc('plans/new/days/d2'), { ...DAY_DOC, dayNumber: 0 });
        await assertFails(batch.commit());
        const none = await assertSucceeds(db.collection('plans/new/days').get());
        expect(none.size).toBe(0);
      });
    });

    it('does not let a plan progress document reveal an unpublished plan', async () => {
      // Progress is the member's own; it grants no access to the plan.
      await seedUsers();
      await seed(async (db) => {
        await db.doc('plans/p').set(DRAFT);
        await db
          .doc('users/member-1/planProgress/p')
          .set({ startedAt: new Date(), currentDay: 1, completedDays: [] });
      });
      await assertSucceeds(dbFor('member-1').doc('users/member-1/planProgress/p').get());
      await assertFails(dbFor('member-1').doc('plans/p').get());
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

  /**
   * M6 MEDIA FEED.
   *
   * The rules here carry more weight than most in this file, because the
   * media feed is the one collection a SIGNED-OUT visitor can read, and
   * because a media post is nothing but an external URL -- so "what may be
   * stored as a URL" is a security question rather than a formatting one.
   *
   * Four things are pinned: who can see a post, who can write one, what a
   * post may contain, and that no member can touch another member's
   * interactions.
   */
  describe('M6: the media feed', () => {
    const past = new Date('2026-01-01T00:00:00Z');
    const future = new Date('2099-01-01T00:00:00Z');

    /** A valid post, as the admin form produces one. */
    function post(partial: Record<string, unknown> = {}) {
      return {
        type: 'image',
        mediaUrl: 'https://example.org/photo.jpg',
        caption: 'Sunday worship',
        verseReference: 'John 3:16',
        verseText: null,
        published: true,
        publishAt: past,
        authorName: 'Pastor',
        authorUid: 'admin-1',
        createdAt: past,
        updatedAt: past,
        ...partial,
      };
    }

    async function seedPost(id: string, partial: Record<string, unknown> = {}) {
      await seed(async (db) => db.doc(`media/${id}`).set(post(partial)));
    }

    async function seedRoles() {
      await seed(async (db) => {
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/member-2').set({ role: 'member' });
      });
    }

    describe('who can see a post', () => {
      it('lets a SIGNED-OUT visitor read a published, due post', async () => {
        // The deliberate difference from every other content collection in
        // this file: the media feed is the church's public face.
        await seedPost('m1');
        await assertSucceeds(dbFor(null).doc('media/m1').get());
      });

      it('lets a signed-in member read one too', async () => {
        await seedRoles();
        await seedPost('m1');
        await assertSucceeds(dbFor('member-1').doc('media/m1').get());
      });

      it('hides an UNPUBLISHED post from everyone but an admin', async () => {
        await seedRoles();
        await seedPost('draft', { published: false });
        await assertFails(dbFor(null).doc('media/draft').get());
        await assertFails(dbFor('member-1').doc('media/draft').get());
        await assertSucceeds(dbFor('admin-1').doc('media/draft').get());
      });

      it('hides a SCHEDULED post until its moment arrives', async () => {
        // publishAt is compared to request.time -- the SERVER's clock -- so
        // winding a phone forward does not bring tomorrow's post forward.
        await seedRoles();
        await seedPost('later', { publishAt: future });
        await assertFails(dbFor(null).doc('media/later').get());
        await assertFails(dbFor('member-1').doc('media/later').get());
        await assertSucceeds(dbFor('admin-1').doc('media/later').get());
      });
    });

    describe('who can write one', () => {
      it('lets a content admin create, edit, publish and delete', async () => {
        await seedRoles();
        const db = dbFor('admin-1');
        await assertSucceeds(db.doc('media/new').set(post()));
        await assertSucceeds(db.doc('media/new').set(post({ caption: 'Edited' })));
        await assertSucceeds(db.doc('media/new').set(post({ published: false })));
        await assertSucceeds(db.doc('media/new').delete());
      });

      it('blocks a member, a host and a signed-out visitor', async () => {
        await seedRoles();
        await assertFails(dbFor('member-1').doc('media/new').set(post()));
        // A host runs live streams; media is content, so it is a content
        // admin's job -- same split as announcements and community.
        await assertFails(dbFor('host-1').doc('media/new').set(post()));
        await assertFails(dbFor(null).doc('media/new').set(post()));
      });

      it('blocks a member from editing or unpublishing an existing post', async () => {
        await seedRoles();
        await seedPost('m1');
        await assertFails(dbFor('member-1').doc('media/m1').update({ caption: 'mine' }));
        await assertFails(dbFor('member-1').doc('media/m1').update({ published: false }));
        await assertFails(dbFor('member-1').doc('media/m1').delete());
      });
    });

    describe('what may be stored as a media URL', () => {
      it('refuses anything that is not https', async () => {
        await seedRoles();
        const db = dbFor('admin-1');
        for (const mediaUrl of [
          'http://example.org/photo.jpg',
          'javascript:alert(1)',
          'data:text/html;base64,PHNjcmlwdD4=',
          'file:///etc/passwd',
          'blob:https://example.org/abc',
          'content://media/external/images/1',
          'ftp://example.org/photo.jpg',
          '//example.org/photo.jpg',
          'example.org/photo.jpg',
        ]) {
          await assertFails(db.doc('media/bad').set(post({ mediaUrl })));
        }
      });

      it('refuses an empty, whitespace-only or over-long URL', async () => {
        await seedRoles();
        const db = dbFor('admin-1');
        await assertFails(db.doc('media/bad').set(post({ mediaUrl: '' })));
        await assertFails(db.doc('media/bad').set(post({ mediaUrl: 'https:// ' })));
        await assertFails(
          db.doc('media/bad').set(post({ mediaUrl: `https://e.org/${'x'.repeat(2000)}` }))
        );
      });

      it('refuses a non-string URL', async () => {
        await seedRoles();
        const db = dbFor('admin-1');
        await assertFails(db.doc('media/bad').set(post({ mediaUrl: 42 })));
        await assertFails(db.doc('media/bad').set(post({ mediaUrl: null })));
      });

      it('accepts a real https link, with a query string', async () => {
        await seedRoles();
        const db = dbFor('admin-1');
        await assertSucceeds(
          db.doc('media/ok').set(
            post({ mediaUrl: 'https://cdn.example.org/a/b.jpg?w=800&sig=abc' })
          )
        );
        await assertSucceeds(
          db.doc('media/ok2').set(
            post({ type: 'video', mediaUrl: 'https://www.youtube.com/watch?v=abcdefghijk' })
          )
        );
      });
    });

    describe('what else a post must and must not contain', () => {
      it('refuses a type that is neither image nor video', async () => {
        await seedRoles();
        const db = dbFor('admin-1');
        await assertFails(db.doc('media/bad').set(post({ type: 'audio' })));
        await assertFails(db.doc('media/bad').set(post({ type: '' })));
      });

      it('refuses a post with no publishAt, since the read rule needs one', async () => {
        await seedRoles();
        const db = dbFor('admin-1');
        const withoutPublishAt = post();
        delete (withoutPublishAt as Record<string, unknown>).publishAt;
        await assertFails(db.doc('media/bad').set(withoutPublishAt));
        await assertFails(db.doc('media/bad').set(post({ publishAt: 'tomorrow' })));
      });

      it('refuses a non-boolean published flag', async () => {
        await seedRoles();
        await assertFails(dbFor('admin-1').doc('media/bad').set(post({ published: 'yes' })));
      });

      it('allows a post with no verse at all, and one with a reference but no text', async () => {
        await seedRoles();
        const db = dbFor('admin-1');
        await assertSucceeds(
          db.doc('media/v1').set(post({ verseReference: null, verseText: null }))
        );
        await assertSucceeds(
          db.doc('media/v2').set(post({ verseReference: 'Psalm 23:1', verseText: null }))
        );
      });

      it('caps the caption and the verse text', async () => {
        await seedRoles();
        const db = dbFor('admin-1');
        await assertFails(db.doc('media/bad').set(post({ caption: 'x'.repeat(2001) })));
        await assertFails(db.doc('media/bad').set(post({ verseText: 'x'.repeat(2001) })));
      });
    });

    describe('comments', () => {
      const comment = {
        text: 'Amen',
        authorUid: 'member-1',
        authorName: 'Ruth',
        createdAt: new Date(),
      };

      it('are readable by anyone, including a signed-out visitor', async () => {
        await seedPost('m1');
        await seed(async (db) => db.doc('media/m1/comments/c1').set(comment));
        await assertSucceeds(dbFor(null).doc('media/m1/comments/c1').get());
      });

      it('can be written by a signed-in member, as themselves', async () => {
        await seedRoles();
        await seedPost('m1');
        await assertSucceeds(dbFor('member-1').doc('media/m1/comments/c1').set(comment));
      });

      it('CANNOT be written as somebody else', async () => {
        // The ownership boundary for creation: authorUid must be the caller.
        await seedRoles();
        await seedPost('m1');
        await assertFails(
          dbFor('member-2').doc('media/m1/comments/c1').set(comment)
        );
      });

      it('cannot be written by a signed-out visitor', async () => {
        await seedPost('m1');
        await assertFails(dbFor(null).doc('media/m1/comments/c1').set(comment));
      });

      it('cannot be edited by anyone, including their own author', async () => {
        await seedRoles();
        await seedPost('m1');
        await seed(async (db) => db.doc('media/m1/comments/c1').set(comment));
        await assertFails(
          dbFor('member-1').doc('media/m1/comments/c1').update({ text: 'changed' })
        );
        await assertFails(
          dbFor('admin-1').doc('media/m1/comments/c1').update({ text: 'changed' })
        );
      });

      it('can be deleted by their own author', async () => {
        await seedRoles();
        await seedPost('m1');
        await seed(async (db) => db.doc('media/m1/comments/c1').set(comment));
        await assertSucceeds(dbFor('member-1').doc('media/m1/comments/c1').delete());
      });

      it("cannot be deleted by another member", async () => {
        await seedRoles();
        await seedPost('m1');
        await seed(async (db) => db.doc('media/m1/comments/c1').set(comment));
        await assertFails(dbFor('member-2').doc('media/m1/comments/c1').delete());
      });

      it('CAN be deleted by a content admin -- the moderation this app has', async () => {
        await seedRoles();
        await seedPost('m1');
        await seed(async (db) => db.doc('media/m1/comments/c1').set(comment));
        await assertSucceeds(dbFor('admin-1').doc('media/m1/comments/c1').delete());
      });

      it('refuses an empty or over-long comment', async () => {
        await seedRoles();
        await seedPost('m1');
        const db = dbFor('member-1');
        await assertFails(db.doc('media/m1/comments/c1').set({ ...comment, text: '' }));
        await assertFails(
          db.doc('media/m1/comments/c1').set({ ...comment, text: 'x'.repeat(1001) })
        );
      });
    });

    describe('likes and saves belong to one member and nobody else', () => {
      it('lets a member like, unlike, save and unsave for themselves', async () => {
        await seedRoles();
        const db = dbFor('member-1');
        await assertSucceeds(
          db.doc('users/member-1/mediaLikes/m1').set({ createdAt: new Date() })
        );
        await assertSucceeds(db.doc('users/member-1/mediaLikes/m1').delete());
        await assertSucceeds(
          db.doc('users/member-1/mediaSaves/m1').set({
            type: 'image',
            mediaUrl: 'https://example.org/photo.jpg',
            caption: 'Sunday worship',
            createdAt: new Date(),
          })
        );
        await assertSucceeds(db.doc('users/member-1/mediaSaves/m1').delete());
      });

      it("blocks a member from writing into another member's likes", async () => {
        await seedRoles();
        await assertFails(
          dbFor('member-2').doc('users/member-1/mediaLikes/m1').set({ createdAt: new Date() })
        );
      });

      it("blocks a member from DELETING another member's like", async () => {
        await seedRoles();
        await seed(async (db) =>
          db.doc('users/member-1/mediaLikes/m1').set({ createdAt: new Date() })
        );
        await assertFails(dbFor('member-2').doc('users/member-1/mediaLikes/m1').delete());
      });

      it("blocks a member from READING another member's likes and saves", async () => {
        await seedRoles();
        await seed(async (db) => {
          await db.doc('users/member-1/mediaLikes/m1').set({ createdAt: new Date() });
          await db.doc('users/member-1/mediaSaves/m1').set({ createdAt: new Date() });
        });
        await assertFails(dbFor('member-2').doc('users/member-1/mediaLikes/m1').get());
        await assertFails(dbFor('member-2').doc('users/member-1/mediaSaves/m1').get());
      });

      it("blocks even a super admin from writing into a member's interactions", async () => {
        // Interactions are private to the member. An administrator has no
        // business liking things on somebody's behalf.
        await seed(async (db) => {
          await db.doc('users/super-1').set({ role: 'super_admin' });
          await db.doc('users/member-1').set({ role: 'member' });
        });
        await assertFails(
          dbFor('super-1').doc('users/member-1/mediaLikes/m1').set({ createdAt: new Date() })
        );
      });

      it('blocks a signed-out visitor from liking or saving anything', async () => {
        await assertFails(
          dbFor(null).doc('users/member-1/mediaLikes/m1').set({ createdAt: new Date() })
        );
      });

      it('refuses extra fields smuggled into a like or a save', async () => {
        // A like is a marker, not a place to store things.
        await seedRoles();
        const db = dbFor('member-1');
        await assertFails(
          db.doc('users/member-1/mediaLikes/m1').set({ createdAt: new Date(), role: 'admin' })
        );
        await assertFails(
          db.doc('users/member-1/mediaSaves/m1').set({
            type: 'image',
            mediaUrl: 'https://example.org/p.jpg',
            caption: 'x',
            createdAt: new Date(),
            extra: 'anything',
          })
        );
      });

      it('refuses a save whose copied URL is not https', async () => {
        await seedRoles();
        await assertFails(
          dbFor('member-1').doc('users/member-1/mediaSaves/m1').set({
            type: 'image',
            mediaUrl: 'javascript:alert(1)',
            caption: 'x',
            createdAt: new Date(),
          })
        );
      });
    });
  });


  // ==================================================================
  // M7 -- the member-authored collections, and moderation over them.
  //
  // These are the first collections in this file that MEMBERS write to,
  // which changes what the rules have to prove. The anonymity tests
  // below are the important ones: they check that an anonymous prayer
  // request cannot carry an author, rather than that the app chooses not
  // to render one.
  // ==================================================================
  describe('media_assets (the administrators\' media library)', () => {
    const now = new Date();
    /** A complete, valid library record. */
    const asset = (overrides: Record<string, unknown> = {}) => ({
      kind: 'image',
      source: 'cloudinary',
      category: 'poster',
      title: 'Easter poster',
      altText: 'A cross at sunrise',
      url: 'https://res.cloudinary.com/my-church/image/upload/v1/maranatha/easter.jpg',
      thumbnailUrl: null,
      publicId: 'maranatha/easter',
      format: 'jpg',
      bytes: 123456,
      width: 1600,
      height: 900,
      durationSeconds: null,
      originalFilename: 'easter',
      youtubeId: null,
      createdBy: 'admin-1',
      createdByName: 'Admin One',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });

    async function seedRoles() {
      await seed(async (db) => {
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('users/super-1').set({ role: 'super_admin' });
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('users/member-1').set({ role: 'member' });
      });
    }

    describe('who may read it', () => {
      beforeEach(async () => {
        await seedRoles();
        await seed(async (db) => db.doc('media_assets/a1').set(asset()));
      });

      it('lets a host read it', async () => {
        await assertSucceeds(dbFor('host-1').doc('media_assets/a1').get());
      });
      it('lets a content admin and a super admin read it', async () => {
        await assertSucceeds(dbFor('admin-1').doc('media_assets/a1').get());
        await assertSucceeds(dbFor('super-1').doc('media_assets/a1').get());
      });
      it('refuses an ordinary member', async () => {
        await assertFails(dbFor('member-1').doc('media_assets/a1').get());
      });
      it('refuses someone who is not signed in', async () => {
        await assertFails(dbFor(null).doc('media_assets/a1').get());
      });
      it('refuses a member listing the collection', async () => {
        await assertFails(dbFor('member-1').collection('media_assets').get());
      });
    });

    describe('who may write it', () => {
      beforeEach(seedRoles);

      it('lets a content admin add a Cloudinary image', async () => {
        await assertSucceeds(dbFor('admin-1').doc('media_assets/a1').set(asset()));
      });
      it('lets a super admin add a record', async () => {
        await assertSucceeds(
          dbFor('super-1').doc('media_assets/a2').set(asset({ createdBy: 'super-1' }))
        );
      });
      it('lets a content admin add an audio file with a fractional duration', async () => {
        await assertSucceeds(
          dbFor('admin-1')
            .doc('media_assets/song')
            .set(
              asset({
                kind: 'audio',
                category: 'song',
                altText: '',
                url: 'https://res.cloudinary.com/my-church/video/upload/v1/maranatha/hymn.mp3',
                width: null,
                height: null,
                durationSeconds: 187.4,
                format: 'mp3',
              })
            )
        );
      });
      it('lets a content admin add a YouTube video', async () => {
        await assertSucceeds(
          dbFor('admin-1')
            .doc('media_assets/yt')
            .set(
              asset({
                kind: 'video',
                source: 'youtube',
                category: 'video',
                altText: '',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
                publicId: null,
                format: null,
                bytes: null,
                width: null,
                height: null,
                originalFilename: null,
                youtubeId: 'dQw4w9WgXcQ',
              })
            )
        );
      });
      it('lets a content admin add a plain https link', async () => {
        await assertSucceeds(
          dbFor('admin-1')
            .doc('media_assets/link')
            .set(
              asset({
                source: 'link',
                url: 'https://example.org/poster.png',
                publicId: null,
                format: null,
                bytes: null,
                width: null,
                height: null,
                originalFilename: null,
              })
            )
        );
      });

      it('refuses a host', async () => {
        await assertFails(
          dbFor('host-1').doc('media_assets/a1').set(asset({ createdBy: 'host-1' }))
        );
      });
      it('refuses an ordinary member', async () => {
        await assertFails(
          dbFor('member-1').doc('media_assets/a1').set(asset({ createdBy: 'member-1' }))
        );
      });
      it('refuses someone who is not signed in', async () => {
        await assertFails(dbFor(null).doc('media_assets/a1').set(asset()));
      });
      it('refuses a record that names someone else as its creator', async () => {
        await assertFails(
          dbFor('admin-1').doc('media_assets/a1').set(asset({ createdBy: 'super-1' }))
        );
      });
    });

    describe('what a record must look like', () => {
      beforeEach(seedRoles);
      const write = (overrides: Record<string, unknown>) =>
        dbFor('admin-1').doc('media_assets/x').set(asset(overrides));

      it.each([
        ['an http address', { url: 'http://res.cloudinary.com/x.jpg' }],
        ['a javascript: address', { url: 'javascript:alert(1)' }],
        ['a data: address', { url: 'data:text/html;base64,AAAA' }],
        ['an address with a space in it', { url: 'https://example.org/a b.jpg' }],
        ['an address over 2000 characters', { url: `https://example.org/${'a'.repeat(2000)}` }],
        ['an http thumbnail', { thumbnailUrl: 'http://example.org/t.jpg' }],
        ['an unknown kind', { kind: 'document' }],
        ['an unknown source', { source: 'ftp' }],
        ['an unknown category', { category: 'secret' }],
        ['an empty title', { title: '' }],
        ['a title over 200 characters', { title: 'x'.repeat(201) }],
        ['alt text over 500 characters', { altText: 'x'.repeat(501) }],
        ['a negative size', { bytes: -1 }],
        ['a fractional size', { bytes: 1.5 }],
        ['a size over 100 MB', { bytes: 104857601 }],
        ['a zero width', { width: 0 }],
        ['a negative duration', { durationSeconds: -1 }],
        ['a duration over a day', { durationSeconds: 86401 }],
        ['a malformed YouTube id', { youtubeId: 'short' }],
        ['a non-string creator', { createdBy: 5 }],
        ['a missing creator', { createdBy: '' }],
        ['a creation date that is a string', { createdAt: '2026-01-01' }],
        ['an extra, unknown field', { isFeatured: true }],
        ['an extra field that tries to grant something', { role: 'super_admin' }],
      ])('refuses %s', async (_name, overrides) => {
        await assertFails(write(overrides));
      });

      it('refuses a record with a field missing altogether', async () => {
        const incomplete: Record<string, unknown> = asset();
        delete incomplete.width;
        await assertFails(dbFor('admin-1').doc('media_assets/x').set(incomplete));
      });

      it('refuses a YouTube record that is not a video', async () => {
        await assertFails(
          write({ source: 'youtube', kind: 'image', youtubeId: 'dQw4w9WgXcQ' })
        );
      });
      it('refuses a YouTube record without a video id', async () => {
        await assertFails(write({ source: 'youtube', kind: 'video', youtubeId: null }));
      });
      it('refuses a Cloudinary record of kind video (long video belongs on YouTube)', async () => {
        await assertFails(write({ source: 'cloudinary', kind: 'video' }));
      });
    });

    describe('changing and removing a record', () => {
      beforeEach(async () => {
        await seedRoles();
        await seed(async (db) => db.doc('media_assets/a1').set(asset()));
      });

      it('lets a content admin change the title, description and category', async () => {
        await assertSucceeds(
          dbFor('admin-1').doc('media_assets/a1').update({
            title: 'Easter poster 2027',
            altText: 'Sunrise over the cross',
            category: 'cover',
            updatedAt: new Date(),
          })
        );
      });
      it('does NOT let anyone change the file the record points at', async () => {
        await assertFails(
          dbFor('admin-1')
            .doc('media_assets/a1')
            .update({ url: 'https://example.org/other.jpg', updatedAt: new Date() })
        );
        await assertFails(
          dbFor('super-1')
            .doc('media_assets/a1')
            .update({ kind: 'audio', updatedAt: new Date() })
        );
        await assertFails(
          dbFor('admin-1')
            .doc('media_assets/a1')
            .update({ createdBy: 'admin-1', createdByName: 'Someone', updatedAt: new Date() })
        );
      });
      it('refuses an update that breaks the shape', async () => {
        await assertFails(
          dbFor('admin-1').doc('media_assets/a1').update({ title: '', updatedAt: new Date() })
        );
        await assertFails(
          dbFor('admin-1')
            .doc('media_assets/a1')
            .update({ category: 'nope', updatedAt: new Date() })
        );
      });
      it('refuses a host and a member trying to change a record', async () => {
        await assertFails(
          dbFor('host-1')
            .doc('media_assets/a1')
            .update({ title: 'Hijack', updatedAt: new Date() })
        );
        await assertFails(
          dbFor('member-1')
            .doc('media_assets/a1')
            .update({ title: 'Hijack', updatedAt: new Date() })
        );
      });

      it('lets a content admin or super admin remove a record', async () => {
        await assertSucceeds(dbFor('admin-1').doc('media_assets/a1').delete());
        await seed(async (db) => db.doc('media_assets/a1').set(asset()));
        await assertSucceeds(dbFor('super-1').doc('media_assets/a1').delete());
      });
      it('refuses a host, a member and an anonymous visitor removing a record', async () => {
        await assertFails(dbFor('host-1').doc('media_assets/a1').delete());
        await assertFails(dbFor('member-1').doc('media_assets/a1').delete());
        await assertFails(dbFor(null).doc('media_assets/a1').delete());
      });
    });
  });

  describe('M7 community_messages, prayer_requests and reports', () => {
    async function seedM7Roles() {
      await seed(async (db) => {
        await db.doc('users/super-1').set({ role: 'super_admin' });
        await db.doc('users/admin-1').set({ role: 'content_admin' });
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('users/member-2').set({ role: 'member' });
        await db.doc('users/suspended-1').set({
          role: 'member',
          accountStatus: 'suspended',
        });
      });
    }

    function message(overrides: Record<string, unknown> = {}) {
      return {
        text: 'Good morning church',
        authorUid: 'member-1',
        authorName: 'Member One',
        createdAt: new Date(),
        removed: false,
        ...overrides,
      };
    }

    describe('the group chat', () => {
      it('lets a signed-in member send a message as themselves', async () => {
        await seedM7Roles();
        await assertSucceeds(
          dbFor('member-1').doc('community_messages/c1').set(message())
        );
      });

      it('refuses a message signed with somebody else’s uid', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1')
            .doc('community_messages/c1')
            .set(message({ authorUid: 'member-2' }))
        );
      });

      it('refuses a signed-out sender', async () => {
        await assertFails(
          dbFor(null).doc('community_messages/c1').set(message({ authorUid: 'nobody' }))
        );
      });

      it('refuses a message that arrives already claiming to be removed', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1').doc('community_messages/c1').set(message({ removed: true }))
        );
      });

      it('refuses an empty message and an over-long one', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1').doc('community_messages/c1').set(message({ text: '' }))
        );
        await assertFails(
          dbFor('member-1')
            .doc('community_messages/c2')
            .set(message({ text: 'x'.repeat(2001) }))
        );
      });

      it('lets any signed-in member READ the conversation', async () => {
        await seedM7Roles();
        await seed(async (db) => db.doc('community_messages/c1').set(message()));
        await assertSucceeds(dbFor('member-2').doc('community_messages/c1').get());
      });

      it('does NOT let a signed-out visitor read it', async () => {
        // The deliberate difference from the media feed, which is the
        // church's public face. This is the congregation talking.
        await seed(async (db) => db.doc('community_messages/c1').set(message()));
        await assertFails(dbFor(null).doc('community_messages/c1').get());
      });

      it('lets nobody EDIT a message -- not even its author', async () => {
        await seedM7Roles();
        await seed(async (db) => db.doc('community_messages/c1').set(message()));
        await assertFails(
          dbFor('member-1').doc('community_messages/c1').update({ text: 'rewritten' })
        );
        await assertFails(
          dbFor('admin-1').doc('community_messages/c1').update({ text: 'rewritten' })
        );
      });

      it('lets a content admin flag a message removed, and only those fields', async () => {
        await seedM7Roles();
        await seed(async (db) => db.doc('community_messages/c1').set(message()));
        await assertSucceeds(
          dbFor('admin-1').doc('community_messages/c1').update({
            removed: true,
            removedAt: new Date(),
            removedByUid: 'admin-1',
          })
        );
        await assertFails(
          dbFor('admin-1')
            .doc('community_messages/c1')
            .update({ removed: true, authorName: 'someone else' })
        );
      });

      it('does not let a member remove somebody else’s message', async () => {
        await seedM7Roles();
        await seed(async (db) => db.doc('community_messages/c1').set(message()));
        await assertFails(
          dbFor('member-2').doc('community_messages/c1').update({ removed: true })
        );
      });

      it('lets an author delete their own message, and nobody else’s', async () => {
        await seedM7Roles();
        await seed(async (db) => db.doc('community_messages/c1').set(message()));
        await assertFails(dbFor('member-2').doc('community_messages/c1').delete());
        await assertSucceeds(dbFor('member-1').doc('community_messages/c1').delete());
      });

      it('refuses a SUSPENDED member’s message but not their reading', async () => {
        await seedM7Roles();
        await seed(async (db) => db.doc('community_messages/c1').set(message()));
        await assertFails(
          dbFor('suspended-1')
            .doc('community_messages/c2')
            .set(message({ authorUid: 'suspended-1', authorName: 'Suspended' }))
        );
        // Suspension is about posting, not about cutting somebody off.
        await assertSucceeds(dbFor('suspended-1').doc('community_messages/c1').get());
      });
    });

    describe('the prayer wall, and what anonymity actually means', () => {
      function request(overrides: Record<string, unknown> = {}) {
        return {
          title: 'Please pray',
          body: 'For my family this week.',
          category: 'family',
          anonymous: false,
          authorUid: 'member-1',
          authorName: 'Member One',
          status: 'open',
          createdAt: new Date(),
          updatedAt: new Date(),
          removed: false,
          ...overrides,
        };
      }

      function anonymousRequest(overrides: Record<string, unknown> = {}) {
        return {
          title: 'Please pray',
          body: 'Something I would rather not put my name to.',
          category: 'other',
          anonymous: true,
          status: 'open',
          createdAt: new Date(),
          updatedAt: new Date(),
          removed: false,
          ...overrides,
        };
      }

      it('lets a member post a named request', async () => {
        await seedM7Roles();
        await assertSucceeds(
          dbFor('member-1').doc('prayer_requests/p1').set(request())
        );
      });

      it('lets a member post an anonymous one with no identity at all', async () => {
        await seedM7Roles();
        await assertSucceeds(
          dbFor('member-1').doc('prayer_requests/p1').set(anonymousRequest())
        );
      });

      it('REFUSES an anonymous request that carries the author uid', async () => {
        // This is the whole privacy model in one assertion. Any member can
        // read this collection, so a uid on the document is a uid every
        // member can read, whatever the app chooses to render.
        await seedM7Roles();
        await assertFails(
          dbFor('member-1')
            .doc('prayer_requests/p1')
            .set(anonymousRequest({ authorUid: 'member-1' }))
        );
      });

      it('REFUSES an anonymous request that carries the author name', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1')
            .doc('prayer_requests/p1')
            .set(anonymousRequest({ authorName: 'Member One' }))
        );
      });

      it('refuses a named request attributed to somebody else', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1')
            .doc('prayer_requests/p1')
            .set(request({ authorUid: 'member-2' }))
        );
      });

      it('refuses a request that arrives already answered or already removed', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1').doc('prayer_requests/p1').set(request({ status: 'answered' }))
        );
        await assertFails(
          dbFor('member-1').doc('prayer_requests/p2').set(request({ removed: true }))
        );
      });

      it('refuses a category outside the closed set', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1')
            .doc('prayer_requests/p1')
            .set(request({ category: 'whatever-i-like' }))
        );
      });

      it('refuses a SUSPENDED member’s request', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('suspended-1')
            .doc('prayer_requests/p1')
            .set(request({ authorUid: 'suspended-1', authorName: 'Suspended' }))
        );
      });

      describe('the private author record', () => {
        async function seedAnonymousRequest() {
          await seed(async (db) => {
            await db.doc('prayer_requests/p1').set(anonymousRequest());
            await db
              .doc('prayer_requests/p1/private/author')
              .set({ uid: 'member-1', createdAt: new Date() });
          });
        }

        it('lets the author read it', async () => {
          await seedM7Roles();
          await seedAnonymousRequest();
          await assertSucceeds(
            dbFor('member-1').doc('prayer_requests/p1/private/author').get()
          );
        });

        it('lets a SUPER admin read it -- the documented moderation path', async () => {
          await seedM7Roles();
          await seedAnonymousRequest();
          await assertSucceeds(
            dbFor('super-1').doc('prayer_requests/p1/private/author').get()
          );
        });

        it('does NOT let a content admin read it', async () => {
          // Moderation does not require identity. A content admin can
          // remove an abusive request without learning who wrote it.
          await seedM7Roles();
          await seedAnonymousRequest();
          await assertFails(
            dbFor('admin-1').doc('prayer_requests/p1/private/author').get()
          );
        });

        it('does NOT let another member read it', async () => {
          await seedM7Roles();
          await seedAnonymousRequest();
          await assertFails(
            dbFor('member-2').doc('prayer_requests/p1/private/author').get()
          );
        });

        it('does not let a signed-out visitor read it', async () => {
          await seedAnonymousRequest();
          await assertFails(dbFor(null).doc('prayer_requests/p1/private/author').get());
        });

        it('refuses a member claiming authorship as somebody else', async () => {
          await seedM7Roles();
          await seed(async (db) => db.doc('prayer_requests/p1').set(anonymousRequest()));
          await assertFails(
            dbFor('member-2')
              .doc('prayer_requests/p1/private/author')
              .set({ uid: 'member-1', createdAt: new Date() })
          );
        });

        it('is immutable once written', async () => {
          await seedM7Roles();
          await seedAnonymousRequest();
          await assertFails(
            dbFor('member-1')
              .doc('prayer_requests/p1/private/author')
              .update({ uid: 'member-2' })
          );
        });
      });

      describe('editing and removing', () => {
        async function seedOwned(anonymous: boolean) {
          await seed(async (db) => {
            await db
              .doc('prayer_requests/p1')
              .set(anonymous ? anonymousRequest() : request());
            await db
              .doc('prayer_requests/p1/private/author')
              .set({ uid: 'member-1', createdAt: new Date() });
          });
        }

        it('lets the author reword their own ANONYMOUS request', async () => {
          // Ownership is proved by the private record, which is the only
          // thing that knows -- the public document deliberately does not.
          await seedM7Roles();
          await seedOwned(true);
          await assertSucceeds(
            dbFor('member-1').doc('prayer_requests/p1').update({
              title: 'Please pray',
              body: 'Updated wording.',
              category: 'other',
              status: 'answered',
              updatedAt: new Date(),
            })
          );
        });

        it('does not let another member edit it', async () => {
          await seedM7Roles();
          await seedOwned(true);
          await assertFails(
            dbFor('member-2')
              .doc('prayer_requests/p1')
              .update({ body: 'vandalised', updatedAt: new Date() })
          );
        });

        it('does NOT let the author de-anonymise their own request', async () => {
          // By now other people have responded on the understanding that
          // it was anonymous.
          await seedM7Roles();
          await seedOwned(true);
          await assertFails(
            dbFor('member-1')
              .doc('prayer_requests/p1')
              .update({ anonymous: false, authorName: 'Member One' })
          );
        });

        it('does not let the author flag their own request removed', async () => {
          await seedM7Roles();
          await seedOwned(true);
          await assertFails(
            dbFor('member-1').doc('prayer_requests/p1').update({ removed: true })
          );
        });

        it('lets a content admin flag it removed without learning who wrote it', async () => {
          await seedM7Roles();
          await seedOwned(true);
          await assertSucceeds(
            dbFor('admin-1').doc('prayer_requests/p1').update({
              removed: true,
              removedAt: new Date(),
              removedByUid: 'admin-1',
            })
          );
        });

        it('lets the author delete their own request, and a content admin too', async () => {
          await seedM7Roles();
          await seedOwned(true);
          await assertFails(dbFor('member-2').doc('prayer_requests/p1').delete());
          await assertSucceeds(dbFor('member-1').doc('prayer_requests/p1').delete());
        });

        it('lets nobody edit a request whose private author record is missing', async () => {
          // DENY is the safe direction: a request nobody can prove they
          // own is one only an administrator can remove.
          await seedM7Roles();
          await seed(async (db) => db.doc('prayer_requests/p1').set(anonymousRequest()));
          await assertFails(
            dbFor('member-1')
              .doc('prayer_requests/p1')
              .update({ body: 'changed', updatedAt: new Date() })
          );
        });
      });

      describe('the member’s own index', () => {
        it('is readable and writable only by its owner', async () => {
          await seedM7Roles();
          await assertSucceeds(
            dbFor('member-1')
              .doc('users/member-1/prayerRequests/p1')
              .set({ createdAt: new Date(), anonymous: true })
          );
          await assertFails(
            dbFor('member-2')
              .doc('users/member-1/prayerRequests/p2')
              .set({ createdAt: new Date(), anonymous: true })
          );
          await assertFails(
            dbFor('member-2').doc('users/member-1/prayerRequests/p1').get()
          );
        });

        it('refuses smuggled extra fields', async () => {
          await seedM7Roles();
          await assertFails(
            dbFor('member-1')
              .doc('users/member-1/prayerRequests/p1')
              .set({ createdAt: new Date(), anonymous: true, body: 'the text' })
          );
        });
      });
    });

    describe('reports', () => {
      function report(overrides: Record<string, unknown> = {}) {
        return {
          targetType: 'community_message',
          targetId: 'c1',
          targetParentId: null,
          reason: 'harassment',
          details: 'This was unkind.',
          reporterUid: 'member-1',
          createdAt: new Date(),
          status: 'open',
          ...overrides,
        };
      }

      it('lets a member file a report as themselves', async () => {
        await seedM7Roles();
        await assertSucceeds(dbFor('member-1').doc('reports/r1').set(report()));
      });

      it('refuses a report filed under somebody else’s name', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1').doc('reports/r1').set(report({ reporterUid: 'member-2' }))
        );
      });

      it('refuses a report that arrives already resolved', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1').doc('reports/r1').set(report({ status: 'resolved' }))
        );
        await assertFails(
          dbFor('member-1')
            .doc('reports/r2')
            .set(report({ resolvedByUid: 'member-1', resolvedAt: new Date() }))
        );
      });

      it('refuses a reason outside the closed set', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1').doc('reports/r1').set(report({ reason: 'i-dislike-them' }))
        );
      });

      it('refuses a SUSPENDED member’s report', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('suspended-1')
            .doc('reports/r1')
            .set(report({ reporterUid: 'suspended-1' }))
        );
      });

      it('does NOT let the reporter read their own report back', async () => {
        // A queue a reporter can read is a queue that tells them whether
        // anyone else has reported the same person.
        await seedM7Roles();
        await seed(async (db) => db.doc('reports/r1').set(report()));
        await assertFails(dbFor('member-1').doc('reports/r1').get());
      });

      it('does not let a host read the queue', async () => {
        await seedM7Roles();
        await seed(async (db) => db.doc('reports/r1').set(report()));
        await assertFails(dbFor('host-1').doc('reports/r1').get());
      });

      it('lets a content admin read and resolve one', async () => {
        await seedM7Roles();
        await seed(async (db) => db.doc('reports/r1').set(report()));
        await assertSucceeds(dbFor('admin-1').doc('reports/r1').get());
        await assertSucceeds(
          dbFor('admin-1').doc('reports/r1').update({
            status: 'resolved',
            resolvedByUid: 'admin-1',
            resolvedAt: new Date(),
            resolutionNote: 'Removed the message.',
          })
        );
      });

      it('refuses an administrator recording somebody else as the resolver', async () => {
        await seedM7Roles();
        await seed(async (db) => db.doc('reports/r1').set(report()));
        await assertFails(
          dbFor('admin-1').doc('reports/r1').update({
            status: 'resolved',
            resolvedByUid: 'super-1',
            resolvedAt: new Date(),
          })
        );
      });

      it('does not let a member resolve a report', async () => {
        await seedM7Roles();
        await seed(async (db) => db.doc('reports/r1').set(report()));
        await assertFails(
          dbFor('member-1').doc('reports/r1').update({ status: 'dismissed' })
        );
      });

      it('lets only a super admin delete one', async () => {
        await seedM7Roles();
        await seed(async (db) => db.doc('reports/r1').set(report()));
        await assertFails(dbFor('admin-1').doc('reports/r1').delete());
        await assertSucceeds(dbFor('super-1').doc('reports/r1').delete());
      });

      it('keeps a member’s own report markers private to them', async () => {
        await seedM7Roles();
        await assertSucceeds(
          dbFor('member-1')
            .doc('users/member-1/reportedItems/community_message_c1')
            .set({ createdAt: new Date() })
        );
        await assertFails(
          dbFor('member-2').doc('users/member-1/reportedItems/community_message_c1').get()
        );
      });
    });

    /**
     * SUSPENSION -- the terms, and who may set them.
     *
     * M7 could say only "suspended". M8 says for how long, why and who
     * decided, and the rules now require those terms to be coherent:
     * accountStatus and the suspension map have to agree, a temporary
     * suspension has to carry a future expiry, and a permanent one has
     * to carry none.
     */
    function suspension(overrides: Record<string, unknown> = {}) {
      return {
        kind: 'temporary',
        reason: 'Repeated abusive messages in the church chat',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        byUid: 'super-1',
        byName: 'Pastor',
        ...overrides,
      };
    }

    const PERMANENT = { kind: 'permanent', expiresAt: null };

    describe('account status', () => {
      it('lets a super admin suspend another member, with terms', async () => {
        await seedM7Roles();
        await assertSucceeds(
          dbFor('super-1')
            .doc('users/member-1')
            .update({ accountStatus: 'suspended', suspension: suspension() })
        );
      });

      it('lets a super admin restore access, clearing the terms', async () => {
        await seedM7Roles();
        await assertSucceeds(
          dbFor('super-1')
            .doc('users/member-1')
            .update({ accountStatus: 'active', suspension: null })
        );
      });

      it('lets a super admin suspend permanently, with no expiry', async () => {
        await seedM7Roles();
        await assertSucceeds(
          dbFor('super-1')
            .doc('users/member-1')
            .update({
              accountStatus: 'suspended',
              suspension: suspension(PERMANENT),
            })
        );
      });

      it('does not let a super admin suspend THEMSELVES', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('super-1')
            .doc('users/super-1')
            .update({ accountStatus: 'suspended', suspension: suspension() })
        );
      });

      it('does not let a content admin suspend anyone', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('admin-1')
            .doc('users/member-1')
            .update({ accountStatus: 'suspended', suspension: suspension() })
        );
      });

      it('does not let a member lift their own suspension', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('suspended-1')
            .doc('users/suspended-1')
            .update({ accountStatus: 'active', suspension: null })
        );
      });

      it('refuses a status outside the closed set', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('super-1')
            .doc('users/member-1')
            .update({ accountStatus: 'banned', suspension: suspension() })
        );
      });

      it('does not let one write change both role and account status', async () => {
        // Two different decisions, two different audit entries.
        await seedM7Roles();
        await assertFails(
          dbFor('super-1')
            .doc('users/member-1')
            .update({ role: 'host', accountStatus: 'suspended' })
        );
      });
    });

    describe('the terms of a suspension', () => {
      it('refuses a suspension with no terms at all', async () => {
        // "Suspended" with nothing else is what M7 allowed, and it is
        // exactly what a church administrator cannot act on: no reason,
        // no end, nobody named.
        await seedM7Roles();
        await assertFails(
          dbFor('super-1').doc('users/member-1').update({ accountStatus: 'suspended' })
        );
      });

      it('refuses terms attached to an ACTIVE account', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('super-1')
            .doc('users/member-1')
            .update({ accountStatus: 'active', suspension: suspension() })
        );
      });

      it('refuses a temporary suspension with no expiry', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('super-1')
            .doc('users/member-1')
            .update({
              accountStatus: 'suspended',
              suspension: suspension({ expiresAt: null }),
            })
        );
      });

      it('refuses a temporary suspension that has ALREADY expired', async () => {
        // Accepting one would read as "suspended" in the dashboard
        // while the member carried on writing.
        await seedM7Roles();
        await assertFails(
          dbFor('super-1')
            .doc('users/member-1')
            .update({
              accountStatus: 'suspended',
              suspension: suspension({
                expiresAt: new Date(Date.now() - 60 * 1000),
              }),
            })
        );
      });

      it('refuses a permanent suspension that carries an expiry', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('super-1')
            .doc('users/member-1')
            .update({
              accountStatus: 'suspended',
              suspension: suspension({ kind: 'permanent' }),
            })
        );
      });

      it('refuses a kind nobody defined', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('super-1')
            .doc('users/member-1')
            .update({
              accountStatus: 'suspended',
              suspension: suspension({ kind: 'forever-ish' }),
            })
        );
      });

      it('refuses an attribution naming somebody other than the caller', async () => {
        // An attribution that can name anyone is worse than none: a
        // church would read it as a fact about who acted.
        await seedM7Roles();
        await assertFails(
          dbFor('super-1')
            .doc('users/member-1')
            .update({
              accountStatus: 'suspended',
              suspension: suspension({ byUid: 'admin-1' }),
            })
        );
      });

      it('refuses an unknown field smuggled into the terms', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('super-1')
            .doc('users/member-1')
            .update({
              accountStatus: 'suspended',
              suspension: { ...suspension(), role: 'super_admin' },
            })
        );
      });

      it('refuses a reason long enough to be a payload', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('super-1')
            .doc('users/member-1')
            .update({
              accountStatus: 'suspended',
              suspension: suspension({ reason: 'x'.repeat(501) }),
            })
        );
      });

      it('accepts a suspension with no reason given', async () => {
        // Recording one is good practice, not a requirement -- refusing
        // the write would just mean administrators typing a full stop.
        await seedM7Roles();
        await assertSucceeds(
          dbFor('super-1')
            .doc('users/member-1')
            .update({
              accountStatus: 'suspended',
              suspension: suspension({ reason: null, byName: null }),
            })
        );
      });
    });

    /**
     * ENFORCEMENT -- the half that actually restrains anyone.
     *
     * The tests above are about what may be WRITTEN to the record.
     * These are about what the record then DOES, which is the point of
     * the feature: a suspended member's own writes are refused by the
     * server, on every collection that calls isActiveMember(), whatever
     * client they are using and however many times they restart it.
     */
    describe('what a suspension actually stops', () => {
      /**
       * Writes a member's profile straight past the rules, the way a
       * super admin's write would have left it. `record` null means an
       * ordinary active member; `{}` means a pre-M8 suspension with no
       * terms recorded.
       */
      async function seedSuspended(
        uid: string,
        record: Record<string, unknown> | null
      ) {
        await seed(async (db) => {
          await db.doc(`users/${uid}`).set({
            role: 'member',
            accountStatus: record === null ? 'active' : 'suspended',
            ...(record === null || Object.keys(record).length === 0
              ? {}
              : { suspension: record }),
          });
        });
      }

      const IN_A_WEEK = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const AN_HOUR_AGO = () => new Date(Date.now() - 60 * 60 * 1000);

      function terms(overrides: Record<string, unknown> = {}) {
        return {
          kind: 'temporary',
          reason: 'A pause',
          startedAt: new Date(),
          expiresAt: IN_A_WEEK(),
          byUid: 'super-1',
          byName: 'Pastor',
          ...overrides,
        };
      }

      it('stops a temporarily suspended member posting to the chat', async () => {
        await seedSuspended('paused-1', terms());
        await assertFails(
          dbFor('paused-1')
            .doc('community_messages/c-blocked')
            .set({
              text: 'Let me back in',
              authorUid: 'paused-1',
              authorName: 'Paused',
              createdAt: new Date(),
              removed: false,
            })
        );
      });

      it('stops them filing a prayer request', async () => {
        await seedSuspended('paused-2', terms());
        await assertFails(
          dbFor('paused-2')
            .doc('prayer_requests/pr-blocked')
            .set({
              title: 'Please pray',
              body: 'For me.',
              category: 'other',
              anonymous: false,
              authorUid: 'paused-2',
              authorName: 'Paused',
              status: 'open',
              createdAt: new Date(),
              removed: false,
            })
        );
      });

      it('LETS THEM BACK IN once the expiry has passed, with nothing rewritten', async () => {
        // The whole point of putting the comparison in the rules: no
        // scheduled job flipped anything, and accountStatus still reads
        // 'suspended' on the document.
        await seedSuspended('expired-1', terms({ expiresAt: AN_HOUR_AGO() }));
        await assertSucceeds(
          dbFor('expired-1')
            .doc('community_messages/c-allowed')
            .set({
              text: 'Good to be back',
              authorUid: 'expired-1',
              authorName: 'Back',
              createdAt: new Date(),
              removed: false,
            })
        );
      });

      it('keeps a PERMANENT suspension in force, with no expiry to pass', async () => {
        await seedSuspended('banned-1', terms({ kind: 'permanent', expiresAt: null }));
        await assertFails(
          dbFor('banned-1')
            .doc('community_messages/c-never')
            .set({
              text: 'Hello?',
              authorUid: 'banned-1',
              authorName: 'Banned',
              createdAt: new Date(),
              removed: false,
            })
        );
      });

      it('treats a pre-M8 suspension with no terms as permanent', async () => {
        // Accounts suspended before the terms existed carry only
        // accountStatus. Reading a missing expiry as "expired" would
        // quietly reinstate every one of them on deploy.
        await seedSuspended('legacy-1', {});
        await assertFails(
          dbFor('legacy-1')
            .doc('community_messages/c-legacy')
            .set({
              text: 'Still out',
              authorUid: 'legacy-1',
              authorName: 'Legacy',
              createdAt: new Date(),
              removed: false,
            })
        );
      });

      it('leaves an active member alone', async () => {
        await seedSuspended('fine-1', null);
        await assertSucceeds(
          dbFor('fine-1')
            .doc('community_messages/c-fine')
            .set({
              text: 'Morning all',
              authorUid: 'fine-1',
              authorName: 'Fine',
              createdAt: new Date(),
              removed: false,
            })
        );
      });

      it('still lets a suspended member READ, and read their own terms', async () => {
        // Suspension is about somebody posting, not about cutting them
        // off from scripture or from knowing why they were suspended.
        await seedSuspended('paused-3', terms());
        await assertSucceeds(dbFor('paused-3').doc('users/paused-3').get());
      });
    });

    describe('the M7 profile fields an owner may write', () => {
      it('lets a member record their own provider and last-active stamp', async () => {
        await seedM7Roles();
        await assertSucceeds(
          dbFor('member-1')
            .doc('users/member-1')
            .update({ authProvider: 'google.com', lastActiveAt: new Date() })
        );
      });

      it('refuses a provider value this app does not offer', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1').doc('users/member-1').update({ authProvider: 'facebook.com' })
        );
      });

      it('still refuses a member writing their own accountStatus', async () => {
        await seedM7Roles();
        await assertFails(
          dbFor('member-1').doc('users/member-1').update({ accountStatus: 'active' })
        );
      });
    });
  });

});
