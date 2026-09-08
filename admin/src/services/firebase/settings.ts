/**
 * Firestore data layer for the admin Settings page (Day 13), per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's P0 feature #17 ("Settings --
 * Church name, logo URL, description, Support email, Save button (syncs
 * to mobile app display)") and Day 13's plan ("Admin: Settings page...
 * Save button + confirmation").
 *
 * The document lives at the singleton path /settings/church.
 * firestore.rules' settings/{settingId} rule already existed from Day 3
 * and already matches this feature's RBAC row exactly (Member/Host/
 * Content Admin: Read, Super Admin: Read + write --
 * FINAL_ARCHITECTURE_SPECIFICATION.md's "Database Access Control" table)
 * -- `allow read: if isSignedIn(); allow write: if isSuperAdmin();` --
 * so no rules change is made here.
 *
 * subscribeToChurchSettings uses onSnapshot (not a one-time fetch), same
 * as ./announcements.ts/./dailyVerses.ts/./events.ts/./songs.ts, so the
 * Settings page (and any other admin viewing it) stays current if a
 * Super Admin saves from elsewhere -- unlike ./users.ts's Day 11
 * one-time-fetch choice, which was specific to that page's own list-of-
 * many-documents shape and its own stated reasoning, not a pattern this
 * single-document feature needs to follow.
 *
 * saveChurchSettings uses setDoc(..., { merge: true }) rather than
 * updateDoc, because /settings/church may not exist yet the first time a
 * Super Admin ever saves -- updateDoc would fail on a document that has
 * never been created; merge:true creates it if absent, and to avoid
 * bulldozing any other future settings/{settingId} document. Followed by
 * a logAdminAction call, same pattern as every other admin write module
 * (see ./auditLog.ts and ./announcements.ts's doc comment).
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './app';
import { logAdminAction } from './auditLog';
import type { ChurchSettings, ChurchSettingsFormInput } from '../../types';

const SETTINGS_COLLECTION = 'settings';
const CHURCH_SETTINGS_DOC_ID = 'church';

function toChurchSettings(data: Record<string, unknown>): ChurchSettings {
  return {
    churchName: typeof data.churchName === 'string' ? data.churchName : '',
    logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : '',
    description: typeof data.description === 'string' ? data.description : '',
    supportEmail: typeof data.supportEmail === 'string' ? data.supportEmail : '',
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/**
 * `onNext` receives `null` when the document doesn't exist yet -- no
 * Super Admin has ever saved settings. SettingsPage.tsx renders empty,
 * editable inputs for that case (a Super Admin is creating the document
 * for the first time), exactly as ProfileScreen.tsx does for a
 * signed-in user with no profile fields set yet.
 */
export function subscribeToChurchSettings(
  onNext: (settings: ChurchSettings | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, SETTINGS_COLLECTION, CHURCH_SETTINGS_DOC_ID),
    (snapshot) => onNext(snapshot.exists() ? toChurchSettings(snapshot.data()) : null),
    onError
  );
}

export async function saveChurchSettings(input: ChurchSettingsFormInput): Promise<void> {
  const churchName = input.churchName.trim();
  await setDoc(
    doc(db, SETTINGS_COLLECTION, CHURCH_SETTINGS_DOC_ID),
    {
      churchName,
      logoUrl: input.logoUrl.trim(),
      description: input.description.trim(),
      supportEmail: input.supportEmail.trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await logAdminAction({
    action: 'update',
    collection: 'settings',
    documentId: CHURCH_SETTINGS_DOC_ID,
    changeSummary: `Updated church settings ("${churchName}")`,
  });
}
