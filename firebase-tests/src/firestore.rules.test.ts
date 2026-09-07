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

    it('blocks a member from writing songs', async () => {
      await seed(async (db) => db.doc('users/member-1').set({ role: 'member' }));
      await assertFails(dbFor('member-1').doc('songs/s1').set({ published: true }));
    });
  });

  describe('events (host field-restricted update)', () => {
    it('blocks a host from creating an event', async () => {
      await seed(async (db) => db.doc('users/host-1').set({ role: 'host' }));
      await assertFails(
        dbFor('host-1')
          .doc('events/e1')
          .set({ published: true, title: 'x', isLive: false })
      );
    });

    it('allows a host to update only isLive/youtubeUrl on an existing event', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db.doc('events/e1').set({
          published: true,
          title: 'Sunday Service',
          isLive: false,
          youtubeUrl: '',
        });
      });
      await assertSucceeds(
        dbFor('host-1')
          .doc('events/e1')
          .update({ isLive: true, youtubeUrl: 'https://youtu.be/x' })
      );
    });

    it('blocks a host from updating other event fields (e.g. title)', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db
          .doc('events/e1')
          .set({ published: true, title: 'Sunday Service', isLive: false });
      });
      await assertFails(dbFor('host-1').doc('events/e1').update({ title: 'Renamed' }));
    });

    it('blocks a host from updating title even when isLive is also included', async () => {
      await seed(async (db) => {
        await db.doc('users/host-1').set({ role: 'host' });
        await db
          .doc('events/e1')
          .set({ published: true, title: 'Sunday Service', isLive: false });
      });
      await assertFails(
        dbFor('host-1').doc('events/e1').update({ isLive: true, title: 'Renamed' })
      );
    });

    it('allows a content_admin to create and fully edit events', async () => {
      await seed(async (db) => db.doc('users/admin-1').set({ role: 'content_admin' }));
      await assertSucceeds(
        dbFor('admin-1')
          .doc('events/e2')
          .set({ published: true, title: 'x', isLive: false })
      );
      await assertSucceeds(
        dbFor('admin-1').doc('events/e2').update({ title: 'Renamed' })
      );
    });

    it('blocks a member from reading an unpublished event', async () => {
      await seed(async (db) => {
        await db.doc('users/member-1').set({ role: 'member' });
        await db.doc('events/e1').set({ published: false, title: 'x' });
      });
      await assertFails(dbFor('member-1').doc('events/e1').get());
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
});
