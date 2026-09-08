/**
 * Real-time listener for the church's public-facing settings document at
 * /settings/church -- the mobile-side half of Day 13's "Settings must
 * sync to the mobile app display" requirement
 * (FINAL_ARCHITECTURE_SPECIFICATION.md's P0 feature #17: "Save button
 * (syncs to mobile app display)"). Written by the admin Settings page
 * (Day 13, see admin/src/features/settings/SettingsPage.tsx and
 * admin/src/services/firebase/settings.ts).
 *
 * firestore.rules' pre-existing settings/{settingId} rule (Day 3)
 * already allows any signed-in user to read this collection
 * (`isSignedIn()`), matching the RBAC table's `settings: Member Read`
 * row -- unchanged here, no rules change needed.
 *
 * `onNext` receives `null` both when the document doesn't exist yet (no
 * Super Admin has ever saved settings) and on any read error --
 * ../../features/auth/HomeScreen.tsx's ChurchBranding, the only current
 * consumer, treats both cases identically: fall back to a sensible
 * default rather than showing a spinner or error message for this
 * low-stakes, decorative header block.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './app';

const SETTINGS_COLLECTION = 'settings';
const CHURCH_SETTINGS_DOC_ID = 'church';

export interface ChurchSettings {
  churchName: string;
  logoUrl: string;
  description: string;
  supportEmail: string;
}

function toChurchSettings(data: Record<string, unknown>): ChurchSettings {
  return {
    churchName: typeof data.churchName === 'string' ? data.churchName : '',
    logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : '',
    description: typeof data.description === 'string' ? data.description : '',
    supportEmail: typeof data.supportEmail === 'string' ? data.supportEmail : '',
  };
}

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
