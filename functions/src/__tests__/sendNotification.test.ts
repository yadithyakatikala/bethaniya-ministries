/**
 * Real-emulator tests for sendNotificationHandler. Requires
 * FIRESTORE_EMULATOR_HOST -- run via
 * `firebase emulators:exec --only firestore "npm --prefix functions test"`,
 * same as logAdminAction.test.ts/createUserProfile.test.ts.
 *
 * The Firestore emulator's /users collection is shared, cumulative state
 * across every functions test file run in the same `emulators:exec`
 * session (see logAdminAction.test.ts's own afterEach comment) -- so the
 * recipient-count tests below never assert an absolute count. Each reads
 * a baseline count immediately before adding its own known, uniquely-uid'd
 * users, then asserts the count increased by exactly that many -- correct
 * regardless of what any other test file already left in /users.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import {
  sendNotificationHandler,
  SendNotificationError,
  type SendNotificationInput,
} from '../sendNotification';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'sendNotification.test.ts requires FIRESTORE_EMULATOR_HOST -- run it via ' +
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

async function totalUserCount(): Promise<number> {
  return (await db.collection('users').count().get()).data().count;
}

async function adminUserCount(): Promise<number> {
  return (
    await db
      .collection('users')
      .where('role', 'in', ['host', 'content_admin', 'super_admin'])
      .count()
      .get()
  ).data().count;
}

const validInput: SendNotificationInput = {
  title: 'Sunday Service Reminder',
  message: 'Join us this Sunday at 10am for worship.',
  recipientGroup: 'all_members',
};

describe('sendNotificationHandler', () => {
  it('rejects an unauthenticated call', async () => {
    await expect(sendNotificationHandler(validInput, undefined)).rejects.toThrow(
      SendNotificationError
    );
    await expect(sendNotificationHandler(validInput, undefined)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects a caller with no user profile at all', async () => {
    await expect(
      sendNotificationHandler(validInput, {
        uid: 'send-notif-no-profile-user',
        email: 'x@example.com',
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it("rejects a caller whose role is 'member'", async () => {
    await setUserRole('send-notif-member-user-1', 'member');
    await expect(
      sendNotificationHandler(validInput, {
        uid: 'send-notif-member-user-1',
        email: 'member@example.com',
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it.each(['host', 'content_admin', 'super_admin'])(
    'accepts a caller with role %s and writes a correctly-shaped notifications_log entry',
    async (role) => {
      const uid = `send-notif-admin-user-${role}`;
      await setUserRole(uid, role);

      const result = await sendNotificationHandler(
        { ...validInput, title: `Title from ${role}` },
        { uid, email: `${role}@example.com` }
      );
      expect(result.sent).toBe(true);
      expect(typeof result.recipientCount).toBe('number');

      const snapshot = await db
        .collection('notifications_log')
        .where('sent_by', '==', uid)
        .get();
      expect(snapshot.size).toBe(1);
      const entry = snapshot.docs[0].data();
      expect(entry.sent_by).toBe(uid);
      expect(entry.sent_by_email).toBe(`${role}@example.com`);
      expect(entry.title).toBe(`Title from ${role}`);
      expect(entry.message).toBe(validInput.message);
      expect(entry.image_url).toBeNull();
      expect(entry.recipient_group).toBe('all_members');
      expect(entry.recipient_count).toBe(result.recipientCount);
      expect(entry.timestamp).toBeDefined();
    }
  );

  it('rejects an invalid recipientGroup value', async () => {
    const uid = 'send-notif-bad-recipient-group';
    await setUserRole(uid, 'super_admin');
    await expect(
      sendNotificationHandler(
        { ...validInput, recipientGroup: 'everyone_including_pets' },
        { uid, email: 'a@example.com' }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects a missing/empty title', async () => {
    const uid = 'send-notif-bad-title';
    await setUserRole(uid, 'super_admin');
    await expect(
      sendNotificationHandler(
        { ...validInput, title: '   ' },
        { uid, email: 'a@example.com' }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects a title over the max length (200 chars)', async () => {
    const uid = 'send-notif-title-too-long';
    await setUserRole(uid, 'super_admin');
    await expect(
      sendNotificationHandler(
        { ...validInput, title: 'x'.repeat(201) },
        { uid, email: 'a@example.com' }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects a missing/empty message', async () => {
    const uid = 'send-notif-bad-message';
    await setUserRole(uid, 'super_admin');
    await expect(
      sendNotificationHandler(
        { ...validInput, message: '' },
        { uid, email: 'a@example.com' }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects a message over the max length (1000 chars)', async () => {
    const uid = 'send-notif-message-too-long';
    await setUserRole(uid, 'super_admin');
    await expect(
      sendNotificationHandler(
        { ...validInput, message: 'x'.repeat(1001) },
        { uid, email: 'a@example.com' }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('accepts an omitted imageUrl and stores it as null', async () => {
    const uid = 'send-notif-no-image';
    await setUserRole(uid, 'super_admin');
    await sendNotificationHandler(
      { ...validInput, title: 'No image test' },
      { uid, email: 'a@example.com' }
    );
    const snapshot = await db
      .collection('notifications_log')
      .where('sent_by', '==', uid)
      .get();
    expect(snapshot.docs[0].data().image_url).toBeNull();
  });

  it('accepts a provided imageUrl and stores it', async () => {
    const uid = 'send-notif-with-image';
    await setUserRole(uid, 'super_admin');
    await sendNotificationHandler(
      {
        ...validInput,
        title: 'With image test',
        imageUrl: 'https://example.com/banner.jpg',
      },
      { uid, email: 'a@example.com' }
    );
    const snapshot = await db
      .collection('notifications_log')
      .where('sent_by', '==', uid)
      .get();
    expect(snapshot.docs[0].data().image_url).toBe('https://example.com/banner.jpg');
  });

  it('never trusts a client-supplied sent_by/sent_by_email, even if the payload includes them', async () => {
    const uid = 'send-notif-spoof-test';
    await setUserRole(uid, 'super_admin');

    const spoofedInput = {
      ...validInput,
      title: 'Spoof test notification',
      // Not part of SendNotificationInput's type -- simulating a client
      // that sends extra fields anyway, since the wire format is just JSON.
      sent_by: 'someone-else-uid',
      sent_by_email: 'attacker@example.com',
    };

    await sendNotificationHandler(spoofedInput, {
      uid,
      email: 'real-admin@example.com',
    });

    const snapshot = await db
      .collection('notifications_log')
      .where('title', '==', 'Spoof test notification')
      .get();
    expect(snapshot.size).toBe(1);
    const entry = snapshot.docs[0].data();
    expect(entry.sent_by).toBe(uid);
    expect(entry.sent_by_email).toBe('real-admin@example.com');
  });

  describe('recipient counting', () => {
    it("'all_members' counts every /users document (delta-based, since /users is shared cumulative test state)", async () => {
      const before = await totalUserCount();
      await setUserRole('send-notif-count-all-1', 'member');
      await setUserRole('send-notif-count-all-2', 'host');
      await setUserRole('send-notif-count-all-3', 'content_admin');

      const senderUid = 'send-notif-count-all-sender';
      await setUserRole(senderUid, 'super_admin');
      const after = await totalUserCount();

      const result = await sendNotificationHandler(
        { ...validInput, title: 'Count all members test', recipientGroup: 'all_members' },
        { uid: senderUid, email: 'a@example.com' }
      );
      expect(result.recipientCount).toBe(after);
      expect(after).toBe(before + 4);
    });

    it("'admins_only' counts only host/content_admin/super_admin documents (delta-based)", async () => {
      const before = await adminUserCount();
      await setUserRole('send-notif-count-admins-member', 'member');
      await setUserRole('send-notif-count-admins-host', 'host');
      await setUserRole('send-notif-count-admins-content', 'content_admin');

      const senderUid = 'send-notif-count-admins-sender';
      await setUserRole(senderUid, 'super_admin');
      const after = await adminUserCount();
      // 3 new admin-role docs (host, content_admin, and the sender itself,
      // super_admin) -- the member doc above does not count.
      expect(after).toBe(before + 3);

      const result = await sendNotificationHandler(
        { ...validInput, title: 'Count admins only test', recipientGroup: 'admins_only' },
        { uid: senderUid, email: 'a@example.com' }
      );
      expect(result.recipientCount).toBe(after);
    });
  });
});
