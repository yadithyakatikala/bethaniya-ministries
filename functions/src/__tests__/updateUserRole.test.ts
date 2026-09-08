/**
 * Real-emulator tests for updateUserRoleHandler. Requires
 * FIRESTORE_EMULATOR_HOST -- run via
 * `firebase emulators:exec --only firestore "npm --prefix functions test"`,
 * same as logAdminAction.test.ts/sendNotification.test.ts.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import {
  updateUserRoleHandler,
  UpdateUserRoleError,
  type UpdateUserRoleInput,
} from '../updateUserRole';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'updateUserRole.test.ts requires FIRESTORE_EMULATOR_HOST -- run it via ' +
      '`firebase emulators:exec --only firestore "npm --prefix functions test"`, ' +
      'not `npm test` directly.'
  );
}

if (getApps().length === 0) {
  initializeApp({ projectId: 'bethaniya-test' });
}

const db = getFirestore();

async function setUser(uid: string, fields: Record<string, unknown>): Promise<void> {
  await db.collection('users').doc(uid).set(fields, { merge: true });
}

describe('updateUserRoleHandler', () => {
  it('rejects an unauthenticated call', async () => {
    const input: UpdateUserRoleInput = { targetUid: 'someone', newRole: 'host' };
    await expect(updateUserRoleHandler(input, undefined)).rejects.toThrow(
      UpdateUserRoleError
    );
    await expect(updateUserRoleHandler(input, undefined)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects a caller with no user profile at all', async () => {
    await expect(
      updateUserRoleHandler(
        { targetUid: 'some-target', newRole: 'host' },
        { uid: 'update-role-no-profile-caller', email: 'x@example.com' }
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it.each(['member', 'host', 'content_admin'])(
    "rejects a caller whose role is '%s' (only super_admin may change roles)",
    async (role) => {
      const callerUid = `update-role-caller-${role}`;
      await setUser(callerUid, { role });
      const targetUid = `update-role-target-for-${role}`;
      await setUser(targetUid, { role: 'member' });

      await expect(
        updateUserRoleHandler(
          { targetUid, newRole: 'content_admin' },
          { uid: callerUid, email: `${role}@example.com` }
        )
      ).rejects.toMatchObject({ code: 'permission-denied' });

      // The target's role must be completely unchanged by the rejected call.
      const targetAfter = await db.collection('users').doc(targetUid).get();
      expect(targetAfter.data()?.role).toBe('member');
    }
  );

  it('rejects an invalid newRole value', async () => {
    const callerUid = 'update-role-caller-bad-role';
    await setUser(callerUid, { role: 'super_admin' });
    const targetUid = 'update-role-target-bad-role';
    await setUser(targetUid, { role: 'member' });

    await expect(
      updateUserRoleHandler(
        { targetUid, newRole: 'owner' },
        { uid: callerUid, email: 'admin@example.com' }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects a missing targetUid', async () => {
    const callerUid = 'update-role-caller-missing-target';
    await setUser(callerUid, { role: 'super_admin' });

    await expect(
      updateUserRoleHandler(
        { newRole: 'host' },
        { uid: callerUid, email: 'admin@example.com' }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects a targetUid that does not exist', async () => {
    const callerUid = 'update-role-caller-missing-doc';
    await setUser(callerUid, { role: 'super_admin' });

    await expect(
      updateUserRoleHandler(
        { targetUid: 'this-uid-was-never-created', newRole: 'host' },
        { uid: callerUid, email: 'admin@example.com' }
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  // --- Self-demotion guard -----------------------------------------------

  it('rejects a Super Admin attempting to change their own role', async () => {
    const callerUid = 'update-role-self-demotion-caller';
    await setUser(callerUid, { role: 'super_admin' });

    await expect(
      updateUserRoleHandler(
        { targetUid: callerUid, newRole: 'content_admin' },
        { uid: callerUid, email: 'admin@example.com' }
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });

    // The caller's own role must be completely unchanged by the rejected call.
    const callerAfter = await db.collection('users').doc(callerUid).get();
    expect(callerAfter.data()?.role).toBe('super_admin');
  });

  it('self-demotion guard cannot be bypassed by a non-super_admin targeting themselves either', async () => {
    const callerUid = 'update-role-self-demotion-non-admin';
    await setUser(callerUid, { role: 'host' });

    // A host targeting themselves should still be rejected -- and rejected
    // as "not authorized" (they're not a super_admin at all), not
    // incidentally accepted because it happens to also be a self-target.
    await expect(
      updateUserRoleHandler(
        { targetUid: callerUid, newRole: 'super_admin' },
        { uid: callerUid, email: 'host@example.com' }
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });

    const callerAfter = await db.collection('users').doc(callerUid).get();
    expect(callerAfter.data()?.role).toBe('host');
  });

  it('does not write an audit_log entry when the self-demotion guard rejects the call', async () => {
    const callerUid = 'update-role-self-demotion-audit-check';
    await setUser(callerUid, { role: 'super_admin' });

    await expect(
      updateUserRoleHandler(
        { targetUid: callerUid, newRole: 'member' },
        { uid: callerUid, email: 'admin@example.com' }
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });

    const snapshot = await db
      .collection('audit_log')
      .where('document_id', '==', callerUid)
      .get();
    expect(snapshot.size).toBe(0);
  });

  // --- Successful change ---------------------------------------------------

  it("accepts a Super Admin changing another user's role, and writes a correctly-shaped audit_log entry", async () => {
    const callerUid = 'update-role-success-caller';
    await setUser(callerUid, { role: 'super_admin' });
    const targetUid = 'update-role-success-target';
    await setUser(targetUid, { role: 'member' });

    const result = await updateUserRoleHandler(
      { targetUid, newRole: 'content_admin' },
      { uid: callerUid, email: 'admin@example.com' }
    );
    expect(result).toEqual({ updated: true, uid: targetUid, role: 'content_admin' });

    const targetAfter = await db.collection('users').doc(targetUid).get();
    expect(targetAfter.data()?.role).toBe('content_admin');

    const snapshot = await db
      .collection('audit_log')
      .where('document_id', '==', targetUid)
      .get();
    expect(snapshot.size).toBe(1);
    const entry = snapshot.docs[0].data();
    expect(entry.admin_id).toBe(callerUid);
    expect(entry.admin_email).toBe('admin@example.com');
    expect(entry.action).toBe('update');
    expect(entry.collection).toBe('users');
    expect(entry.document_id).toBe(targetUid);
    expect(entry.change_summary).toBe("Changed role from 'member' to 'content_admin'");
    expect(entry.details).toEqual({ previousRole: 'member', newRole: 'content_admin' });
    expect(entry.timestamp).toBeDefined();
  });

  it('never trusts a client-supplied admin identity, even if the payload includes one', async () => {
    const callerUid = 'update-role-spoof-test-caller';
    await setUser(callerUid, { role: 'super_admin' });
    const targetUid = 'update-role-spoof-test-target';
    await setUser(targetUid, { role: 'member' });

    const spoofedInput = {
      targetUid,
      newRole: 'host',
      // Not part of UpdateUserRoleInput's type -- simulating a client that
      // sends extra fields anyway, since the wire format is just JSON.
      admin_id: 'someone-else-uid',
      admin_email: 'attacker@example.com',
    };

    await updateUserRoleHandler(spoofedInput, {
      uid: callerUid,
      email: 'real-admin@example.com',
    });

    const snapshot = await db
      .collection('audit_log')
      .where('document_id', '==', targetUid)
      .get();
    expect(snapshot.size).toBe(1);
    const entry = snapshot.docs[0].data();
    expect(entry.admin_id).toBe(callerUid);
    expect(entry.admin_email).toBe('real-admin@example.com');
  });
});
