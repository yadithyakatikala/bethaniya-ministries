// Fakes for the browser: just enough of Firebase and the native modules for the app's REAL screens,
// contexts and services to run in Chromium (through react-native-web) against seeded data.
//
// This is test scaffolding for visual QA, not part of the app. The fake Firestore is an in-memory
// document store with real-time listeners and the subset of the query API the app uses; the fake
// Auth holds one signed-in member. Nothing reaches a network.
export const FAKE_FIRESTORE = String.raw`
type Data = Record<string, any>;
const store = new Map<string, Data>();
const listeners = new Set<() => void>();
let autoId = 0;
const notify = () => listeners.forEach((l) => l());

export class Timestamp {
  constructor(public seconds: number, public nanoseconds = 0) {}
  static fromMillis(ms: number) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static fromDate(d: Date) { return Timestamp.fromMillis(d.getTime()); }
  static now() { return Timestamp.fromMillis(Date.now()); }
  toMillis() { return this.seconds * 1000 + this.nanoseconds / 1e6; }
  toDate() { return new Date(this.toMillis()); }
  valueOf() { return String(this.toMillis()); }
}
const SERVER_TS = { __sentinel: 'serverTimestamp' };
export const serverTimestamp = () => SERVER_TS;
export const increment = (n: number) => ({ __sentinel: 'increment', n });
export const arrayUnion = (...v: any[]) => ({ __sentinel: 'arrayUnion', v });
export const arrayRemove = (...v: any[]) => ({ __sentinel: 'arrayRemove', v });
export const deleteField = () => ({ __sentinel: 'deleteField' });

export type Firestore = object;
export const getFirestore = () => ({});
export const connectFirestoreEmulator = () => {};

interface Ref { type: 'doc' | 'collection'; path: string; id: string; parent?: Ref }
const seg = (path: string) => path.split('/').filter(Boolean);
export function collection(base: any, ...segments: string[]): Ref {
  const path = (base && base.path ? [base.path, ...segments] : segments).join('/');
  return { type: 'collection', path, id: seg(path).pop()! };
}
export function doc(base: any, ...segments: string[]): Ref {
  if (base && base.type === 'collection' && segments.length === 0) {
    const id = 'auto' + ++autoId;
    return { type: 'doc', path: base.path + '/' + id, id };
  }
  const path = (base && base.path ? [base.path, ...segments] : segments).join('/');
  return { type: 'doc', path, id: seg(path).pop()! };
}
export const where = (field: string, op: string, value: any) => ({ k: 'where', field, op, value });
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => ({ k: 'orderBy', field, dir });
export const limit = (n: number) => ({ k: 'limit', n });
export const startAfter = (...values: any[]) => ({ k: 'startAfter', values });
export function query(coll: any, ...constraints: any[]) {
  return { type: 'query', path: coll.path, constraints };
}

const getField = (data: Data, field: string) =>
  field.split('.').reduce((v: any, k) => (v == null ? undefined : v[k]), data);
const comparable = (v: any) => (v instanceof Timestamp ? v.toMillis() : v instanceof Date ? v.getTime() : v);
const cmp = (a: any, b: any) => {
  a = comparable(a); b = comparable(b);
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return a < b ? -1 : 1;
};
const matches = (data: Data, c: any) => {
  const v = comparable(getField(data, c.field));
  const t = Array.isArray(c.value) ? c.value.map(comparable) : comparable(c.value);
  switch (c.op) {
    case '==': return v === t;
    case '!=': return v !== t;
    case '<': return v < t;
    case '<=': return v <= t;
    case '>': return v > t;
    case '>=': return v >= t;
    case 'in': return Array.isArray(t) && t.includes(v);
    case 'not-in': return Array.isArray(t) && !t.includes(v);
    case 'array-contains': return Array.isArray(getField(data, c.field)) && getField(data, c.field).map(comparable).includes(t);
    case 'array-contains-any': return Array.isArray(getField(data, c.field)) && getField(data, c.field).some((x: any) => t.includes(comparable(x)));
    default: return true;
  }
};

class DocSnap {
  constructor(public ref: Ref, private d: Data | undefined) {}
  get id() { return this.ref.id; }
  exists() { return this.d !== undefined; }
  data() { return this.d === undefined ? undefined : clone(this.d); }
  get(field: string) { return this.d === undefined ? undefined : getField(this.d, field); }
}
class QuerySnap {
  constructor(public docs: DocSnap[]) {}
  get size() { return this.docs.length; }
  get empty() { return this.docs.length === 0; }
  forEach(fn: (d: DocSnap) => void) { this.docs.forEach(fn); }
  docChanges() { return this.docs.map((d) => ({ type: 'added', doc: d })); }
}
function clone(v: any): any {
  if (v instanceof Timestamp) return new Timestamp(v.seconds, v.nanoseconds);
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
  return v;
}
function run(q: any): QuerySnap {
  const parts = seg(q.path);
  let rows = [...store.entries()]
    .filter(([p]) => { const s = seg(p); return s.length === parts.length + 1 && p.startsWith(q.path + '/'); })
    .map(([p, d]) => ({ ref: { type: 'doc', path: p, id: seg(p).pop()! } as Ref, d }));
  const constraints = q.constraints ?? [];
  for (const c of constraints) if (c.k === 'where') rows = rows.filter((r) => matches(r.d, c));
  const orders = constraints.filter((c: any) => c.k === 'orderBy');
  rows.sort((x, y) => {
    for (const o of orders) {
      const r = cmp(getField(x.d, o.field), getField(y.d, o.field));
      if (r) return o.dir === 'desc' ? -r : r;
    }
    return 0;
  });
  const after = constraints.find((c: any) => c.k === 'startAfter');
  if (after) {
    const snapshot = after.values[0];
    const i = rows.findIndex((r) => r.ref.path === (snapshot.ref ? snapshot.ref.path : ''));
    if (i >= 0) rows = rows.slice(i + 1);
  }
  const lim = constraints.find((c: any) => c.k === 'limit');
  if (lim) rows = rows.slice(0, lim.n);
  return new QuerySnap(rows.map((r) => new DocSnap(r.ref, r.d)));
}
const signature = (s: any) =>
  s instanceof QuerySnap ? JSON.stringify(s.docs.map((d) => [d.ref.path, d.data()])) : JSON.stringify(s.exists() ? s.data() : null);
function snapshotOf(target: any): any {
  if (target.type === 'doc') return new DocSnap(target, store.get(target.path));
  return run(target.type === 'collection' ? { ...target, constraints: [] } : target);
}

export function onSnapshot(target: any, onNext: (s: any) => void, onError?: (e: unknown) => void) {
  let last = '';
  let alive = true;
  const emit = () => {
    if (!alive) return;
    try {
      const snap = snapshotOf(target);
      const sig = signature(snap);
      if (sig === last) return;
      last = sig;
      onNext(snap);
    } catch (e) { onError?.(e); }
  };
  listeners.add(emit);
  Promise.resolve().then(emit);
  return () => { alive = false; listeners.delete(emit); };
}
export const getDoc = async (ref: Ref) => new DocSnap(ref, store.get(ref.path));
export const getDocs = async (target: any) => snapshotOf(target);

function resolveValues(existing: Data | undefined, patch: Data, merge: boolean): Data {
  const next: Data = merge && existing ? clone(existing) : {};
  for (const [key, raw] of Object.entries(patch)) {
    const parts = key.split('.');
    let cur: any = next;
    for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = cur[parts[i]] ?? {}; cur = cur[parts[i]]; }
    const last = parts[parts.length - 1];
    if (raw && raw.__sentinel === 'serverTimestamp') cur[last] = Timestamp.now();
    else if (raw && raw.__sentinel === 'increment') cur[last] = (cur[last] ?? 0) + raw.n;
    else if (raw && raw.__sentinel === 'arrayUnion') cur[last] = [...new Set([...(cur[last] ?? []), ...raw.v])];
    else if (raw && raw.__sentinel === 'arrayRemove') cur[last] = (cur[last] ?? []).filter((x: any) => !raw.v.includes(x));
    else if (raw && raw.__sentinel === 'deleteField') delete cur[last];
    else cur[last] = clone(raw);
  }
  return next;
}
export async function setDoc(ref: Ref, data: Data, options?: { merge?: boolean }) {
  store.set(ref.path, resolveValues(store.get(ref.path), data, Boolean(options?.merge)));
  notify();
}
export async function updateDoc(ref: Ref, data: Data) {
  const existing = store.get(ref.path);
  if (!existing) throw Object.assign(new Error('No document to update: ' + ref.path), { code: 'not-found' });
  store.set(ref.path, resolveValues(existing, data, true));
  notify();
}
export async function addDoc(coll: Ref, data: Data) {
  const ref = doc(coll);
  store.set(ref.path, resolveValues(undefined, data, false));
  notify();
  return ref;
}
export async function deleteDoc(ref: Ref) { store.delete(ref.path); notify(); }
export function writeBatch() {
  const ops: (() => void)[] = [];
  const batch = {
    set: (ref: Ref, data: Data, o?: any) => { ops.push(() => store.set(ref.path, resolveValues(store.get(ref.path), data, Boolean(o?.merge)))); return batch; },
    update: (ref: Ref, data: Data) => { ops.push(() => store.set(ref.path, resolveValues(store.get(ref.path), data, true))); return batch; },
    delete: (ref: Ref) => { ops.push(() => { store.delete(ref.path); }); return batch; },
    commit: async () => { ops.forEach((f) => f()); notify(); },
  };
  return batch;
}
export async function runTransaction(_db: unknown, fn: (tx: any) => Promise<any>) {
  const tx = {
    get: async (ref: Ref) => new DocSnap(ref, store.get(ref.path)),
    set: (ref: Ref, data: Data, o?: any) => { store.set(ref.path, resolveValues(store.get(ref.path), data, Boolean(o?.merge))); return tx; },
    update: (ref: Ref, data: Data) => { store.set(ref.path, resolveValues(store.get(ref.path), data, true)); return tx; },
    delete: (ref: Ref) => { store.delete(ref.path); return tx; },
  };
  const result = await fn(tx);
  notify();
  return result;
}

/** Test scaffolding: seed documents, outside the app's own API. */
export function __seed(documents: Record<string, Data>) {
  for (const [path, data] of Object.entries(documents)) store.set(path, resolveValues(undefined, data, false));
  notify();
}
export function __dump() { return Object.fromEntries(store.entries()); }
(globalThis as any).__fs = { seed: __seed, dump: __dump, Timestamp };
`;

export const FAKE_AUTH = String.raw`
type Listener = (user: any) => void;
const listeners = new Set<Listener>();
let current: any = null;
export const getAuth = () => authObject;
export const initializeAuth = () => authObject;
export const getReactNativePersistence = () => ({});
export const connectAuthEmulator = () => {};
const authObject: any = { get currentUser() { return current; } };
export type User = any;
export type UserCredential = any;
export type Auth = any;
export type Persistence = any;
const emit = () => listeners.forEach((l) => l(current));
export function onAuthStateChanged(_auth: unknown, next: Listener) {
  listeners.add(next);
  Promise.resolve().then(() => next(current));
  return () => listeners.delete(next);
}
export async function signOut() { current = null; emit(); }
export async function signInWithEmailAndPassword(_a: unknown, email: string) {
  // A scenario that wants the sign-in screen's error banner types this address.
  if (email === 'wrong@example.com') throw Object.assign(new Error('wrong credentials'), { code: 'auth/invalid-credential' });
  current = { uid: 'qa-member', email, displayName: 'Ruth Anand', phoneNumber: null, emailVerified: true,
    getIdToken: async () => 'token', reload: async () => {} };
  emit();
  return { user: current };
}
export const createUserWithEmailAndPassword = signInWithEmailAndPassword;
export async function sendEmailVerification() {}
export async function sendPasswordResetEmail() {}
export async function updateProfile(user: any, patch: any) { Object.assign(user, patch); emit(); }
export async function signInWithCredential() { return signInWithEmailAndPassword(null, 'google@example.com'); }
export class GoogleAuthProvider { static credential() { return {}; } }
export class OAuthProvider { constructor(public id: string) {} credential() { return {}; } }
/** Test scaffolding: sign a member in or out, outside the app's own API. */
(globalThis as any).__auth = {
  signIn(user: any) { current = { emailVerified: true, phoneNumber: null, getIdToken: async () => 'token', reload: async () => {}, ...user }; emit(); },
  signOut() { current = null; emit(); },
};
`;

export const FAKE_FIREBASE_APP = String.raw`
const apps: any[] = [];
export type FirebaseApp = any;
export const getApps = () => apps;
export const initializeApp = (config: any) => { const a = { options: config }; apps.push(a); return a; };
export const getApp = () => apps[0];
`;

export const FAKE_FIREBASE_STORAGE = String.raw`
export type FirebaseStorage = any;
export const getStorage = () => ({});
export const connectStorageEmulator = () => {};
export const ref = (_s: unknown, path: string) => ({ path });
export const uploadBytes = async () => { throw new Error('Storage is not available on the free plan'); };
export const getDownloadURL = async () => '';
export const deleteObject = async () => {};
`;

// Native modules with no browser equivalent. Each exports only what the app imports.
export const NATIVE_STUBS = {
  'expo-notifications': String.raw`
export const setNotificationHandler = () => {};
export const getPermissionsAsync = async () => ({ status: 'undetermined', granted: false, canAskAgain: true });
export const requestPermissionsAsync = async () => ({ status: 'denied', granted: false, canAskAgain: false });
export const addNotificationResponseReceivedListener = () => ({ remove() {} });
export const addNotificationReceivedListener = () => ({ remove() {} });
export const addPushTokenListener = () => ({ remove() {} });
export const getExpoPushTokenAsync = async () => ({ data: 'ExponentPushToken[qa]' });
export const getDevicePushTokenAsync = async () => ({ data: 'qa' });
export const setNotificationChannelAsync = async () => {};
export const getLastNotificationResponseAsync = async () => null;
export const getLastNotificationResponse = () => null;
export const scheduleNotificationAsync = async () => 'id';
export const cancelAllScheduledNotificationsAsync = async () => {};
export const setBadgeCountAsync = async () => true;
export const AndroidImportance = { DEFAULT: 3, HIGH: 4, MAX: 5, LOW: 2, MIN: 1, NONE: 0 };
export const AndroidNotificationVisibility = { PUBLIC: 1, PRIVATE: 0, SECRET: -1 };
export const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';
export type Notification = any;
export type NotificationResponse = any;
export type Subscription = { remove(): void };
`,
  'expo-clipboard': String.raw`
export const setStringAsync = async (text: string) => { (globalThis as any).__clipboard = text; return true; };
export const getStringAsync = async () => (globalThis as any).__clipboard ?? '';
`,
  'expo-splash-screen': String.raw`
export const preventAutoHideAsync = async () => true;
export const hideAsync = async () => {};
export const setOptions = () => {};
`,
  'expo-audio': String.raw`
export const setAudioModeAsync = async () => {};
export const useAudioPlayer = () => ({ play() {}, pause() {}, seekTo: async () => {}, remove() {}, playing: false, currentTime: 0, duration: 0 });
export const useAudioPlayerStatus = () => ({ playing: false, currentTime: 0, duration: 0, isLoaded: true, didJustFinish: false });
export const createAudioPlayer = () => ({ play() {}, pause() {}, remove() {}, addListener: () => ({ remove() {} }) });
export type AudioPlayer = any;
export type AudioStatus = any;
`,
  'react-native-webview': String.raw`
import * as React from 'react';
import { View } from 'react-native';
export const WebView = (props: any) => <View testID={props.testID ?? 'webview'} style={[{ backgroundColor: '#222' }, props.style]} />;
export default WebView;
`,
  'react-native-webview/lib/WebViewTypes': String.raw`export type WebViewMessageEvent = any; export type WebViewNavigation = any;`,
  'expo-image-picker': String.raw`
export const launchImageLibraryAsync = async () => ({ canceled: true, assets: null });
export const requestMediaLibraryPermissionsAsync = async () => ({ granted: false });
export const MediaTypeOptions = { Images: 'Images' };
`,
  'expo-status-bar': String.raw`
export const StatusBar = () => null;
`,
  'expo-crypto': String.raw`
export const randomUUID = () => 'uuid-' + Math.random().toString(16).slice(2);
export const getRandomBytes = (n: number) => new Uint8Array(n);
export const digestStringAsync = async () => 'digest';
export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };
`,
  'expo-auth-session/providers/google': String.raw`
export const useAuthRequest = () => [null, null, async () => ({ type: 'dismiss' })];
export const useIdTokenAuthRequest = useAuthRequest;
`,
  'expo-apple-authentication': String.raw`
export const isAvailableAsync = async () => false;
export const signInAsync = async () => { throw new Error('unavailable'); };
export const AppleAuthenticationScope = { FULL_NAME: 0, EMAIL: 1 };
export const AppleAuthenticationButton = () => null;
export const AppleAuthenticationButtonType = { SIGN_IN: 0, CONTINUE: 1 };
export const AppleAuthenticationButtonStyle = { BLACK: 2, WHITE: 0, WHITE_OUTLINE: 1 };
`,
  'expo-font': String.raw`
export const loadAsync = async () => undefined;
export const isLoaded = () => true;
`,
};
