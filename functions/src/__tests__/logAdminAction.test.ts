/**
 * Real-emulator tests for logAdminActionHandler. Requires FIRESTORE_EMULATOR_HOST
 * -- run via `firebase emulators:exec --only firestore "npm --prefix functions test"`,
 * same as createUserProfile.test.ts.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import {
  logAdminActionHandler,
  AdminActionError,
  type LogAdminActionInput,
} from '../logAdminAction';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'logAdminAction.test.ts requires FIRESTORE_EMULATOR_HOST -- run it via ' +
      '`firebase emulators:exec --only firestore "npm --prefix functions test"`, ' +
      'not `npm test` directly.'
  );
}

if (getApps().length === 0) {
  initializeApp({ projectId: 'bethaniya-test' });
}

const db = getFirestore();

async function setUserRole(uid: string, role: string | null): Promise<void> {
  if (role === null) return;
  await db.collection('users').doc(uid).set({ role });
}

const validInput: LogAdminActionInput = {
  action: 'publish',
  collection: 'announcements',
  documentId: 'announcement-1',
  changeSummary: "Published announcement 'Sunday Sermon'",
};

describe('logAdminActionHandler', () => {
  afterEach(async () => {
    // Firestore emulator state isn't reset between tests in this project's
    // harness (same approach as createUserProfile.test.ts) -- each test uses
    // its own unique uid/doc ids instead.
  });

  it('rejects an unauthenticated call', async () => {
    await expect(logAdminActionHandler(validInput, undefined)).rejects.toThrow(
      AdminActionError
    );
    await expect(logAdminActionHandler(validInput, undefined)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects a caller with no user profile at all', async () => {
    await expect(
      logAdminActionHandler(validInput, {
        uid: 'no-profile-user',
        email: 'x@example.com',
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it("rejects a caller whose role is 'member'", async () => {
    await setUserRole('member-user-1', 'member');
    await expect(
      logAdminActionHandler(validInput, {
        uid: 'member-user-1',
        email: 'member@example.com',
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it.each(['host', 'content_admin', 'super_admin'])(
    'accepts a caller with role %s and writes a correctly-shaped audit_log entry',
    async (role) => {
      const uid = `admin-user-${role}`;
      await setUserRole(uid, role);

      const result = await logAdminActionHandler(validInput, {
        uid,
        email: `${role}@example.com`,
      });
      expect(result).toEqual({ logged: true });

      const snapshot = await db
        .collection('audit_log')
        .where('admin_id', '==', uid)
        .get();
      expect(snapshot.size).toBe(1);
      const entry = snapshot.docs[0].data();
      expect(entry.admin_id).toBe(uid);
      expect(entry.admin_email).toBe(`${role}@example.com`);
      expect(entry.action).toBe('publish');
      expect(entry.collection).toBe('announcements');
      expect(entry.document_id).toBe('announcement-1');
      expect(entry.change_summary).toBe("Published announcement 'Sunday Sermon'");
      expect(entry.timestamp).toBeDefined();
    }
  );

  it('never trusts a client-supplied admin_id/admin_email, even if the payload includes them', async () => {
    const uid = 'admin-user-spoof-test';
    await setUserRole(uid, 'super_admin');

    const spoofedInput = {
      ...validInput,
      documentId: 'announcement-spoof-test',
      // Not part of LogAdminActionInput's type -- simulating a client that
      // sends extra fields anyway, since the wire format is just JSON.
      admin_id: 'someone-else-uid',
      admin_email: 'attacker@example.com',
    };

    await logAdminActionHandler(spoofedInput, { uid, email: 'real-admin@example.com' });

    const snapshot = await db
      .collection('audit_log')
      .where('document_id', '==', 'announcement-spoof-test')
      .get();
    expect(snapshot.size).toBe(1);
    const entry = snapshot.docs[0].data();
    expect(entry.admin_id).toBe(uid);
    expect(entry.admin_email).toBe('real-admin@example.com');
  });

  it('rejects an invalid action value', async () => {
    const uid = 'admin-user-bad-action';
    await setUserRole(uid, 'super_admin');
    await expect(
      logAdminActionHandler(
        { ...validInput, action: 'destroy_everything' },
        { uid, email: 'a@example.com' }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects an unknown collection value', async () => {
    const uid = 'admin-user-bad-collection';
    await setUserRole(uid, 'super_admin');
    await expect(
      logAdminActionHandler(
        { ...validInput, collection: 'not_a_real_collection' },
        { uid, email: 'a@example.com' }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects a missing changeSummary', async () => {
    const uid = 'admin-user-bad-summary';
    await setUserRole(uid, 'super_admin');
    const withoutSummary = {
      action: validInput.action,
      collection: validInput.collection,
      documentId: validInput.documentId,
    };
    await expect(
      logAdminActionHandler(withoutSummary, { uid, email: 'a@example.com' })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('accepts an optional details object and stores it', async () => {
    const uid = 'admin-user-with-details';
    await setUserRole(uid, 'super_admin');
    await logAdminActionHandler(
      {
        ...validInput,
        documentId: 'announcement-with-details',
        details: { old_data: { published: false }, new_data: { published: true } },
      },
      { uid, email: 'a@example.com' }
    );

    const snapshot = await db
      .collection('audit_log')
      .where('document_id', '==', 'announcement-with-details')
      .get();
    expect(snapshot.size).toBe(1);
    expect(snapshot.docs[0].data().details).toEqual({
      old_data: { published: false },
      new_data: { published: true },
    });
  });
});
