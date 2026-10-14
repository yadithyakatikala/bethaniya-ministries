/**
 * The reading-plan manager, end to end: the admin site WRITES a plan, the real
 * security rules decide who may read it, and the phone READS it.
 *
 * Nothing here re-implements anything. The services under test are the
 * application's own source files, loaded unchanged:
 *
 *   admin/src/services/firebase/plans.ts    what the plan manager writes
 *   mobile/src/services/firebase/plans.ts   what the phone asks for and reads
 *
 * Each is wired to the Firestore and Auth emulators through the SAME Firebase
 * SDK copy its own package uses (the two packages ship separate copies, and a
 * Firestore handle from one is not accepted by the other), signed in as a real
 * Auth-emulator user whose role is stored in /users/{uid}. The rules are the
 * committed firestore.rules. So a test that passes here has shown, with no step
 * assumed: an administrator can create a plan, the rules let a member read it
 * exactly when the church meant them to, and the phone's own queries, mappers
 * and library logic show the right content.
 *
 * What it adds to firestore.rules.test.ts (which proves the rules in
 * isolation) is the join between the two applications: that what the admin site
 * writes is what the rules accept AND what the phone's queries are allowed to
 * ask for. The most likely way for this feature to break in production is an
 * admin write the phone cannot read, or a phone query the rules refuse; both
 * are covered here.
 *
 * Needs the Auth and Firestore emulators (see README.md).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

// ---------------------------------------------------------------------------
// The two applications' Firestore handles. Their `./app` modules are replaced
// with getters so a test can choose WHO is acting (an administrator, a host, a
// member) without reloading anything.
// ---------------------------------------------------------------------------
const mockHandles: { admin: unknown; mobile: unknown } = { admin: null, mobile: null };

jest.mock('../../admin/src/services/firebase/app', () => ({
  get db() {
    return mockHandles.admin;
  },
}));
jest.mock('../../admin/src/services/firebase/auditLog', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../mobile/src/services/firebase/app', () => ({
  get db() {
    return mockHandles.mobile;
  },
}));

import {
  PlanConflictError,
  deletePlan,
  duplicatePlan,
  loadPlanForEditing,
  newDayId,
  savePlan,
  setPlanStatus,
  type DayToSave,
  type LoadedPlan,
} from '../../admin/src/services/firebase/plans';
import { blankDay, dayFromDocument } from '../../admin/src/features/plans/planDays';
import {
  detailsForStorage,
  detailsFromPlan,
  emptyDetails,
  type PlanDetailsForm,
} from '../../admin/src/features/plans/planDetails';
import type { PlanStatusChange } from '../../admin/src/features/plans/planStatus';
import {
  markDayComplete,
  startPlan,
  subscribeToAllPlanProgress,
  subscribeToPlanDays,
  subscribeToPublishedPlans,
  type PlanProgress,
  type PublishedPlan,
  type PublishedPlanDay,
} from '../../mobile/src/services/firebase/plans';
import {
  groupPlans,
  withStartedBundledPlans,
} from '../../mobile/src/features/plans/planGroups';
import { SEED_PLANS } from '../../mobile/src/features/plans/seedPlans';

// Same project id as firestore.rules.test.ts (see the note there).
const PROJECT_ID = 'demo-no-project';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

const PASSWORD = 'correct-horse-battery';

// ---------------------------------------------------------------------------
// Loading a package's own copy of the Firebase SDK.
// ---------------------------------------------------------------------------
interface Sdk {
  // The SDK modules are loaded dynamically from another package's tree, so they
  // are untyped here on purpose; the service modules under test are typed.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  app: any;
  auth: any;
  firestore: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

function sdkOf(pkg: 'admin' | 'mobile'): Sdk {
  const from = path.resolve(__dirname, `../../${pkg}/src/services/firebase`);
  const load = (id: string) => require(require.resolve(id, { paths: [from] }));
  return {
    app: load('firebase/app'),
    auth: load('firebase/auth'),
    firestore: load('firebase/firestore'),
  };
}

/** Someone with an account in the Auth emulator and a role in /users/{uid}. */
interface Account {
  pkg: 'admin' | 'mobile';
  name: string;
  role: 'content_admin' | 'host' | 'member';
  email: string;
  uid: string;
}

/** An account signed in on a fresh SDK instance: what the service modules are handed. */
interface Identity extends Account {
  /** The handle the application's service module will use. */
  db: unknown;
  sdk: Sdk;
}

const CONFIG = {
  apiKey: 'demo-api-key',
  authDomain: 'localhost',
  projectId: PROJECT_ID,
  appId: '1:000000000000:web:0000000000000000000000',
};

let testEnv: RulesTestEnvironment;
let appCounter = 0;
const openApps: { delete: () => Promise<void>; terminate: () => Promise<void> }[] = [];

/** Creates the account once; it is signed in again, on a fresh instance, for each test. */
async function createAccount(
  pkg: Account['pkg'],
  name: string,
  role: Account['role']
): Promise<Account> {
  const sdk = sdkOf(pkg);
  const app = sdk.app.initializeApp(CONFIG, `plans-e2e-setup-${pkg}-${name}`);
  const auth = sdk.auth.getAuth(app);
  sdk.auth.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const email = `${name}-${pkg}-${Date.now()}@example.org`;
  const credential = await sdk.auth.createUserWithEmailAndPassword(auth, email, PASSWORD);
  await sdk.app.deleteApp(app);
  return { pkg, name, role, email, uid: credential.user.uid as string };
}

/**
 * Signs an account in on a brand-new SDK instance. Fresh for every test on
 * purpose: a Firestore client keeps what it has read in a local cache, and a
 * listener opened by one test would otherwise be answered first, from the
 * cache, with another test's plans.
 */
async function connect(account: Account): Promise<Identity> {
  const sdk = sdkOf(account.pkg);
  appCounter += 1;
  const app = sdk.app.initializeApp(
    CONFIG,
    `plans-e2e-${account.pkg}-${account.name}-${appCounter}`
  );
  const auth = sdk.auth.getAuth(app);
  sdk.auth.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  await sdk.auth.signInWithEmailAndPassword(auth, account.email, PASSWORD);
  const db = sdk.firestore.getFirestore(app);
  sdk.firestore.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  openApps.push({
    delete: () => sdk.app.deleteApp(app),
    terminate: () => sdk.firestore.terminate(db),
  });
  return { ...account, db, sdk };
}

const accounts = {} as Record<'admin' | 'host' | 'intruder' | 'member', Account>;

let admin: Identity; // content administrator, on the admin site's SDK
let host: Identity; // read-only staff, on the admin site's SDK
let intruder: Identity; // an ordinary member who somehow calls the admin service
let member: Identity; // an ordinary member, on the phone's SDK

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
  accounts.admin = await createAccount('admin', 'admin', 'content_admin');
  accounts.host = await createAccount('admin', 'host', 'host');
  accounts.intruder = await createAccount('admin', 'intruder', 'member');
  accounts.member = await createAccount('mobile', 'member', 'member');
});

afterAll(async () => {
  await testEnv.cleanup();
});

async function seedRoles() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const who of Object.values(accounts)) {
      await db.doc(`users/${who.uid}`).set({ role: who.role, displayName: who.role });
    }
  });
}

beforeEach(async () => {
  await seedRoles();
  [admin, host, intruder, member] = await Promise.all([
    connect(accounts.admin),
    connect(accounts.host),
    connect(accounts.intruder),
    connect(accounts.member),
  ]);
  mockHandles.admin = admin.db;
  mockHandles.mobile = member.db;
});

afterEach(async () => {
  for (const stop of stoppers.splice(0)) stop();
  for (const app of openApps.splice(0)) {
    await app.terminate();
    await app.delete();
  }
  await testEnv.clearFirestore();
});

// ---------------------------------------------------------------------------
// Helpers: acting as someone, writing like the admin site, reading like the phone.
// ---------------------------------------------------------------------------
const actAsAdmin = (who: Identity) => {
  mockHandles.admin = who.db;
};

const stoppers: (() => void)[] = [];

function day(
  id: string,
  title: string,
  passages: string[],
  extra: Partial<DayToSave> = {}
): DayToSave {
  return { ...blankDay(`k-${id}`), id, title, passages, ...extra };
}

const FULL_DAYS = (planId: string): DayToSave[] => [
  day(`${planId}-1`, 'The Lord is my shepherd', ['psalm 23'], {
    devotional: 'Rest in him.\n\nHe leads.',
    reflectionQuestion: 'Where has he led you?',
    application: 'Call a friend this week.',
    prayerPrompt: 'Thank him.',
    notes: 'A psalm of David.',
  }),
  day(`${planId}-2`, 'Out of the depths', ['Psalm 130', 'john 3:16-21']),
];

interface WriteOptions {
  title?: string;
  order?: number;
  coverImageUrl?: string | null;
  days?: DayToSave[];
  status?: PlanStatusChange | null;
  language?: 'en' | 'te';
  subtitle?: string;
  author?: string;
  estimatedMinutes?: string;
}

/** What the admin site's Save does for a new plan. Returns the plan id. */
async function createPlan(planId: string, options: WriteOptions = {}): Promise<string> {
  const details = detailsForStorage({
    ...emptyDetails(),
    title: options.title ?? 'Seven Days in the Psalms',
    subtitle: options.subtitle ?? 'Rest for the weary',
    description: 'A week of psalms.',
    coverImageUrl:
      options.coverImageUrl === undefined
        ? 'https://res.cloudinary.com/my-church/image/upload/v1/cover.jpg'
        : options.coverImageUrl,
    language: options.language ?? 'en',
    estimatedMinutes: options.estimatedMinutes ?? '12',
    author: options.author ?? 'Pastor Samuel',
    order: String(options.order ?? 1),
  });
  await savePlan({
    mode: 'create',
    planId,
    details,
    days: options.days ?? FULL_DAYS(planId),
    loaded: null,
    status: options.status === undefined ? { to: 'published' } : options.status,
    uid: admin.uid,
  });
  return planId;
}

async function waitFor<T>(
  read: () => T | undefined | false,
  label: string,
  timeoutMs = 15_000
): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() - started > timeoutMs)
      throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

/** The phone's library, as it would be shown, kept up to date as Firestore changes. */
function openLibrary(options: Parameters<typeof subscribeToPublishedPlans>[2] = {}) {
  let latest: PublishedPlan[] | null = null;
  const errors: unknown[] = [];
  const stop = subscribeToPublishedPlans(
    (plans) => {
      latest = plans;
    },
    (error) => errors.push(error),
    options
  );
  stoppers.push(stop);
  return {
    errors,
    get now() {
      return latest;
    },
    ids: () => (latest as PublishedPlan[] | null)?.map((plan) => plan.id) ?? null,
    until: (ok: (plans: PublishedPlan[]) => boolean, label: string) =>
      waitFor(() => (latest && ok(latest) ? latest : undefined), label),
  };
}

const STARTER_IDS = SEED_PLANS.map((seed) => seed.id);

const sameIds = (plans: PublishedPlan[], ids: string[]) =>
  plans.length === ids.length && plans.every((plan, index) => plan.id === ids[index]);

/** A published plan the church keeps, so "the library has no church plan" is never the case. */
async function publishSentinel() {
  await createPlan('sentinel', {
    title: 'Sentinel',
    order: 99,
    days: [day('sentinel-1', 'One', ['John 1'])],
  });
}

/** Asks the way the phone's day screens do, and waits for the first answer or refusal. */
async function askForDays(planId: string) {
  const answer: { days: PublishedPlanDay[] | null; error: { code?: string } | null } = {
    days: null,
    error: null,
  };
  const stop = subscribeToPlanDays(
    planId,
    (days) => {
      answer.days = days;
    },
    (error) => {
      answer.error = error as { code?: string };
    }
  );
  stoppers.push(stop);
  await waitFor(
    () => answer.days !== null || answer.error !== null,
    `an answer for ${planId}`
  );
  return answer;
}

/** The days of a plan, as the phone reads them. */
async function phoneDays(planId: string): Promise<PublishedPlanDay[]> {
  return (await askForDays(planId)).days ?? [];
}

/** What the phone's day screens are told when the rules refuse them. */
async function phoneDaysError(planId: string): Promise<{ code?: string } | null> {
  return (await askForDays(planId)).error;
}

/**
 * What the admin site's Save does to a plan that exists: every day is sent back
 * as it was loaded (so none is rewritten), with the changes applied.
 */
async function editPlan(
  planId: string,
  changes: {
    details?: Partial<PlanDetailsForm>;
    addDays?: DayToSave[];
    status?: PlanStatusChange | null;
  } = {}
) {
  const loaded = (await loadPlanForEditing(planId))!;
  await savePlan({
    mode: 'edit',
    planId,
    details: detailsForStorage({ ...detailsFromPlan(loaded.plan), ...changes.details }),
    days: [
      ...loaded.days.map((d) => ({ ...dayFromDocument(`k-${d.id}`, d), id: d.id })),
      ...(changes.addDays ?? []),
    ],
    loaded,
    status: changes.status ?? null,
    uid: admin.uid,
  });
}

/** Whether a document exists, asked past the rules, so a refused write can be shown to have left nothing behind. */
async function existsUnchecked(docPath: string): Promise<boolean> {
  let exists = false;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    exists = (await ctx.firestore().doc(docPath).get()).exists;
  });
  return exists;
}

const memberFs = () => member.sdk.firestore;
const memberDoc = (...segments: string[]) => memberFs().doc(member.db, ...segments);

// ---------------------------------------------------------------------------

describe('a plan the administrator publishes', () => {
  it('reaches the phone with everything the administrator wrote, day by day', async () => {
    await createPlan('e2e-psalms');
    const library = openLibrary();
    await library.until(
      (plans) => plans.some((plan) => plan.id === 'e2e-psalms'),
      'the new plan'
    );

    const plan = library.now!.find((p) => p.id === 'e2e-psalms')!;
    expect(plan).toEqual({
      id: 'e2e-psalms',
      title: 'Seven Days in the Psalms',
      subtitle: 'Rest for the weary',
      description: 'A week of psalms.',
      category: 'Devotional',
      coverImageUrl: 'https://res.cloudinary.com/my-church/image/upload/v1/cover.jpg',
      dayCount: 2,
      language: 'en',
      estimatedMinutes: 12,
      author: 'Pastor Samuel',
      order: 1,
    });

    const days = await phoneDays('e2e-psalms');
    expect(days.map((d) => d.dayNumber)).toEqual([1, 2]);
    expect(days[0]).toMatchObject({
      title: 'The Lord is my shepherd',
      // Written the one canonical way, whatever was typed.
      scriptureReference: 'Psalm 23',
      devotional: 'Rest in him.\n\nHe leads.',
      reflectionQuestion: 'Where has he led you?',
      application: 'Call a friend this week.',
      prayerPrompt: 'Thank him.',
      notes: 'A psalm of David.',
    });
    // Several passages are stored together; the first is where the phone opens the Bible.
    expect(days[1]).toMatchObject({
      title: 'Out of the depths',
      scriptureReference: 'Psalm 130; John 3:16-21',
      reflectionQuestion: '',
      application: '',
      notes: '',
    });
  });

  it('shows a plan with no cover and none of the optional text without trouble', async () => {
    await createPlan('bare', {
      coverImageUrl: null,
      subtitle: '',
      author: '',
      estimatedMinutes: '',
      days: [day('bare-1', 'Just a reading', ['Genesis 1'])],
    });
    const library = openLibrary();
    await library.until((plans) => plans.some((p) => p.id === 'bare'), 'the plan');
    expect(library.now!.find((p) => p.id === 'bare')).toMatchObject({
      coverImageUrl: null,
      subtitle: '',
      author: '',
      estimatedMinutes: null,
      dayCount: 1,
    });
    const days = await phoneDays('bare');
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ devotional: '', prayerPrompt: '', notes: '' });
  });

  it('is in the language the administrator chose', async () => {
    await createPlan('te-plan', {
      title: 'కీర్తనలలో ఏడు రోజులు',
      language: 'te',
      days: [day('te-1', 'కీర్తన 23', ['కీర్తనలు 23'])],
    });
    const library = openLibrary();
    await library.until(
      (plans) => plans.some((p) => p.id === 'te-plan'),
      'the Telugu plan'
    );
    expect(library.now!.find((p) => p.id === 'te-plan')!.language).toBe('te');
  });

  it('is shown in the church’s order, with the plan lacking an order first as order 0', async () => {
    await createPlan('b-second', { title: 'B', order: 2 });
    await createPlan('a-first', { title: 'A', order: 1 });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('plans/z-no-order').set({
        title: 'No order',
        description: 'Written before the manager.',
        category: 'Gospels',
        coverImageUrl: null,
        dayCount: 0,
        published: true,
      });
    });
    const library = openLibrary();
    await library.until((plans) => plans.length === 3, 'three plans');
    expect(library.ids()).toEqual(['z-no-order', 'a-first', 'b-second']);
  });

  it('is saved correctly when it is long: many days, in order, written in batches', async () => {
    const days = Array.from({ length: 25 }, (_, n) =>
      day(`long-${String(n + 1).padStart(2, '0')}`, `Day ${n + 1}`, ['Psalm 23'])
    );
    await createPlan('long-plan', { days, status: null });
    const loaded = await loadPlanForEditing('long-plan');
    expect(loaded!.plan).toMatchObject({
      dayCount: 25,
      status: 'draft',
      published: false,
    });
    expect(loaded!.days.map((d) => d.dayNumber)).toEqual(days.map((_, n) => n + 1));
    expect(loaded!.days.map((d) => d.title)).toEqual(days.map((_, n) => `Day ${n + 1}`));
  });
});

describe('the starter plans', () => {
  it('are what the phone shows until the church publishes one, and then step aside', async () => {
    const library = openLibrary();
    await library.until((plans) => sameIds(plans, STARTER_IDS), 'the starter plans');

    await createPlan('church-plan');
    await library.until(
      (plans) => plans.some((p) => p.id === 'church-plan'),
      'the church’s plan'
    );
    expect(library.ids()).toEqual(['church-plan']);
  });

  it('stay in the list of a member who had begun one, and are not offered to anyone else', async () => {
    const starter = STARTER_IDS[0]!;
    await startPlan(member.uid, starter);
    await markDayComplete(member.uid, starter, 1, 1, []);

    await createPlan('church-plan');
    const library = openLibrary();
    await library.until(
      (plans) => plans.some((p) => p.id === 'church-plan'),
      'the church’s plan'
    );

    let progress: Record<string, PlanProgress> | null = null;
    const stop = subscribeToAllPlanProgress(
      member.uid,
      (all) => {
        progress = all;
      },
      () => undefined
    );
    stoppers.push(stop);
    await waitFor(() => progress && progress[starter], 'the member’s progress');

    const groups = groupPlans(
      withStartedBundledPlans(library.now!, progress!),
      progress!
    );
    expect(groups.my.map((p) => p.id)).toEqual([starter]);
    expect(groups.find.map((p) => p.id)).toEqual(['church-plan']);
    // And its days are still there to read: the phone carries them.
    const days = await phoneDays(starter);
    expect(days.length).toBe(SEED_PLANS[0]!.days.length);
  });
});

describe('what the phone is never given', () => {
  it('a draft, by the library or by asking for it directly', async () => {
    await createPlan('hidden-draft', { status: null });
    await publishSentinel();
    const library = openLibrary();
    // Once the sentinel shows, the server has answered with everything the member may see.
    await library.until(
      (plans) => plans.some((p) => p.id === 'sentinel'),
      'the sentinel'
    );
    expect(library.ids()).not.toContain('hidden-draft');

    await expect(
      memberFs().getDoc(memberDoc('plans', 'hidden-draft'))
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect((await phoneDaysError('hidden-draft'))?.code).toBe('permission-denied');
  });

  it('an archived plan', async () => {
    await createPlan('shelved');
    const loaded = (await loadPlanForEditing('shelved'))!;
    await setPlanStatus(loaded.plan, { to: 'archived' });
    await publishSentinel();

    const library = openLibrary();
    await library.until(
      (plans) => plans.some((p) => p.id === 'sentinel'),
      'the sentinel'
    );
    expect(library.ids()).not.toContain('shelved');
    await expect(memberFs().getDoc(memberDoc('plans', 'shelved'))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('a plan that has been taken back, from a library that already had it open', async () => {
    await createPlan('withdrawn');
    await publishSentinel();
    const library = openLibrary();
    await library.until((plans) => plans.some((p) => p.id === 'withdrawn'), 'the plan');

    const loaded = (await loadPlanForEditing('withdrawn'))!;
    await setPlanStatus(loaded.plan, { to: 'draft' });
    await library.until(
      (plans) => !plans.some((p) => p.id === 'withdrawn'),
      'the plan to go'
    );
    expect(library.ids()).toContain('sentinel');
  });

  it('a draft, until it is published', async () => {
    await createPlan('late', { status: null });
    await publishSentinel();
    const library = openLibrary();
    await library.until(
      (plans) => plans.some((p) => p.id === 'sentinel'),
      'the sentinel'
    );
    expect(library.ids()).not.toContain('late');

    const loaded = (await loadPlanForEditing('late'))!;
    await setPlanStatus(loaded.plan, { to: 'published' });
    await library.until(
      (plans) => plans.some((p) => p.id === 'late'),
      'the plan to appear'
    );
    expect((await phoneDays('late')).length).toBe(2);
  });
});

describe('a scheduled plan', () => {
  const inFuture = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);

  it('stays hidden until its time, including from a direct request', async () => {
    await createPlan('tomorrow', { status: { to: 'scheduled', publishAt: inFuture() } });
    await publishSentinel();
    const library = openLibrary();
    await library.until(
      (plans) => plans.some((p) => p.id === 'sentinel'),
      'the sentinel'
    );
    expect(library.ids()).not.toContain('tomorrow');
    await expect(memberFs().getDoc(memberDoc('plans', 'tomorrow'))).rejects.toMatchObject(
      {
        code: 'permission-denied',
      }
    );
    expect((await phoneDaysError('tomorrow'))?.code).toBe('permission-denied');
  });

  it('opens by itself once its time has come, with no one publishing it', async () => {
    await createPlan('due', { status: { to: 'scheduled', publishAt: minutesAgo(5) } });
    await publishSentinel();
    const library = openLibrary();
    await library.until((plans) => plans.some((p) => p.id === 'due'), 'the due plan');
    expect(library.errors).toEqual([]);
    expect((await phoneDays('due')).length).toBe(2);
    // The stored plan is still `scheduled`: there is no server job to flip it.
    const stored = (await loadPlanForEditing('due'))!;
    expect(stored.plan).toMatchObject({ status: 'scheduled', published: false });
  });

  it('opens on a phone whose clock is a couple of minutes fast, after one refused attempt', async () => {
    // The retry reaches back ten minutes from the phone's own clock (which is two
    // fast), so a plan due fifteen minutes ago is inside it.
    await createPlan('due-fast', {
      status: { to: 'scheduled', publishAt: minutesAgo(15) },
    });
    await publishSentinel();
    const library = openLibrary({ now: () => new Date(Date.now() + 2 * 60 * 1000) });
    await library.until(
      (plans) => plans.some((p) => p.id === 'due-fast'),
      'the due plan'
    );
    expect(library.errors).toEqual([]);
  });

  it('is simply not shown, and nothing breaks, on a phone whose clock is far ahead', async () => {
    await createPlan('due-far', {
      status: { to: 'scheduled', publishAt: minutesAgo(5) },
    });
    await publishSentinel();
    const library = openLibrary({ now: () => new Date(Date.now() + 3 * 60 * 60 * 1000) });
    await library.until(
      (plans) => plans.some((p) => p.id === 'sentinel'),
      'the sentinel'
    );
    // Give the second, refused query time to have failed.
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(library.ids()).not.toContain('due-far');
    expect(library.ids()).toContain('sentinel');
    expect(library.errors).toEqual([]);
  });

  it('opens once it is moved to a time that has passed', async () => {
    await createPlan('moving', { status: { to: 'scheduled', publishAt: inFuture() } });
    await publishSentinel();
    const library = openLibrary();
    await library.until(
      (plans) => plans.some((p) => p.id === 'sentinel'),
      'the sentinel'
    );
    expect(library.ids()).not.toContain('moving');

    // The admin site's Publish dialog never offers a past time; the service
    // writes whatever it is given, and the rules are what keep it honest.
    await editPlan('moving', { status: { to: 'scheduled', publishAt: minutesAgo(10) } });
    // The second query asks again every five minutes, so open a fresh library to see it.
    const fresh = openLibrary();
    await fresh.until(
      (plans) => plans.some((p) => p.id === 'moving'),
      'the plan, now due'
    );
  });

  it('is hidden again when it is unpublished back to a draft', async () => {
    await createPlan('pulled', {
      status: { to: 'scheduled', publishAt: minutesAgo(10) },
    });
    await publishSentinel();
    const before = openLibrary();
    await before.until((plans) => plans.some((p) => p.id === 'pulled'), 'the due plan');

    const loaded = (await loadPlanForEditing('pulled'))!;
    await setPlanStatus(loaded.plan, { to: 'draft' });
    const after = openLibrary();
    await after.until((plans) => plans.some((p) => p.id === 'sentinel'), 'the sentinel');
    expect(after.ids()).not.toContain('pulled');
    await expect(memberFs().getDoc(memberDoc('plans', 'pulled'))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });
});

describe('a member’s place in a plan', () => {
  async function memberProgress(planId: string) {
    const snapshot = await memberFs().getDoc(
      memberDoc('users', member.uid, 'planProgress', planId)
    );
    return snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null;
  }

  it('survives the plan being edited, unpublished and published again', async () => {
    await createPlan('keeps-place');
    await startPlan(member.uid, 'keeps-place');
    await markDayComplete(member.uid, 'keeps-place', 1, 1, []);
    const before = await memberProgress('keeps-place');
    expect(before).toMatchObject({ currentDay: 2, completedDays: [1] });

    // Edit: new title and order, a third day at the end.
    await editPlan('keeps-place', {
      details: { title: 'Seven Days in the Psalms (revised)', order: '5' },
      addDays: [day('keeps-place-3', 'A new last day', ['Psalm 150'])],
    });

    // Unpublish, then publish again.
    let loaded = (await loadPlanForEditing('keeps-place'))!;
    await setPlanStatus(loaded.plan, { to: 'draft' });
    loaded = (await loadPlanForEditing('keeps-place'))!;
    await setPlanStatus(loaded.plan, { to: 'published' });

    const library = openLibrary();
    await library.until((plans) => plans.some((p) => p.id === 'keeps-place'), 'the plan');
    expect(library.now!.find((p) => p.id === 'keeps-place')).toMatchObject({
      title: 'Seven Days in the Psalms (revised)',
      dayCount: 3,
      order: 5,
    });
    expect((await phoneDays('keeps-place')).map((d) => d.title)).toEqual([
      'The Lord is my shepherd',
      'Out of the depths',
      'A new last day',
    ]);
    // Same plan id, same day ids for the unchanged days, same progress.
    expect(await memberProgress('keeps-place')).toMatchObject({
      currentDay: 2,
      completedDays: [1],
    });
  });

  it('is not erased when the church deletes the plan', async () => {
    await createPlan('deleted-plan');
    await startPlan(member.uid, 'deleted-plan');
    await deletePlan('deleted-plan', 'Seven Days in the Psalms');
    expect(await loadPlanForEditing('deleted-plan')).toBeNull();
    expect(await memberProgress('deleted-plan')).toMatchObject({ currentDay: 1 });
    await publishSentinel();
    const library = openLibrary();
    await library.until(
      (plans) => plans.some((p) => p.id === 'sentinel'),
      'the sentinel'
    );
    expect(library.ids()).not.toContain('deleted-plan');
  });

  it('can be written by the member who owns it and by no one else', async () => {
    await createPlan('mine');
    await startPlan(member.uid, 'mine');
    await expect(
      memberFs().setDoc(memberDoc('users', 'someone-else', 'planProgress', 'mine'), {
        currentDay: 1,
        completedDays: [],
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('plans written before the plan manager', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('plans/legacy-with-order').set({
        title: 'Legacy plan',
        description: 'Seeded long ago.',
        category: 'Gospels',
        coverImageUrl: null,
        dayCount: 1,
        order: 2,
        published: true,
      });
      await db.doc('plans/legacy-with-order/days/day-1').set({
        dayNumber: 1,
        title: 'An orderly account',
        scriptureReference: 'Luke 1:1-25',
        devotional: 'Old words.',
        prayerPrompt: 'Old prayer.',
      });
      await db.doc('plans/legacy-no-order').set({
        title: 'Legacy plan with no order',
        description: 'Seeded long ago.',
        category: 'Gospels',
        coverImageUrl: null,
        dayCount: 1,
        published: true,
      });
      await db.doc('plans/legacy-no-order/days/day-1').set({
        dayNumber: 1,
        title: 'Day one',
        scriptureReference: 'Luke 2',
        devotional: '',
        prayerPrompt: '',
      });
    });
  });

  it('reach the phone, including the one that has no order', async () => {
    const library = openLibrary();
    await library.until((plans) => plans.length === 2, 'both legacy plans');
    expect(library.ids()).toEqual(['legacy-no-order', 'legacy-with-order']);
    expect(library.now![1]).toMatchObject({
      subtitle: '',
      language: null,
      estimatedMinutes: null,
      author: '',
      order: 2,
    });
    const days = await phoneDays('legacy-with-order');
    expect(days[0]).toMatchObject({
      title: 'An orderly account',
      devotional: 'Old words.',
      prayerPrompt: 'Old prayer.',
      reflectionQuestion: '',
      application: '',
      notes: '',
    });
  });

  it('open in the plan manager as published, and are saved without being unpublished or reset', async () => {
    const loaded = (await loadPlanForEditing('legacy-with-order'))!;
    expect(loaded.plan).toMatchObject({ status: null, published: true, language: null });

    await editPlan('legacy-with-order', { details: { title: 'Legacy plan, retitled' } });

    const saved = (await loadPlanForEditing('legacy-with-order'))!;
    expect(saved.plan).toMatchObject({
      title: 'Legacy plan, retitled',
      status: 'published',
      published: true,
      dayCount: 1,
    });
    // Its day kept its id and its words.
    expect(saved.days.map((d) => [d.id, d.devotional])).toEqual([
      ['day-1', 'Old words.'],
    ]);
    const library = openLibrary();
    await library.until(
      (plans) => plans.some((p) => p.title === 'Legacy plan, retitled'),
      'the retitled plan'
    );
  });
});

describe('who may change a plan', () => {
  const draft = (who: Identity) => {
    actAsAdmin(who);
    return savePlan({
      mode: 'create',
      planId: 'not-allowed',
      details: detailsForStorage({
        ...emptyDetails(),
        title: 'Nope',
        description: 'No.',
      }),
      days: [],
      loaded: null,
      status: null,
      uid: who.uid,
    });
  };

  it('is a content administrator, not a host', async () => {
    await expect(draft(host)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await existsUnchecked('plans/not-allowed')).toBe(false);
  });

  it('is not an ordinary member who reaches the admin service some other way', async () => {
    await expect(draft(intruder)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('is a host who can read every plan, drafts included, but publish or delete none', async () => {
    await createPlan('staff-view', { status: null });
    actAsAdmin(host);
    const loaded = await loadPlanForEditing('staff-view');
    expect(loaded?.plan.title).toBe('Seven Days in the Psalms');
    expect(loaded?.days).toHaveLength(2);
    await expect(setPlanStatus(loaded!.plan, { to: 'published' })).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(deletePlan('staff-view', 'x')).rejects.toBeTruthy();
    actAsAdmin(admin);
    expect((await loadPlanForEditing('staff-view'))!.plan.published).toBe(false);
  });

  it('cannot make a plan live without a description and a day, even if the screen is bypassed', async () => {
    await expect(
      savePlan({
        mode: 'create',
        planId: 'empty-live',
        details: detailsForStorage({
          ...emptyDetails(),
          title: 'Empty',
          description: '',
        }),
        days: [],
        loaded: null,
        status: { to: 'published' },
        uid: admin.uid,
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await loadPlanForEditing('empty-live')).toBeNull();
  });
});

describe('saving safely', () => {
  it('refuses a save from a screen that has gone stale, and keeps the other person’s work', async () => {
    await createPlan('shared');
    const mine = (await loadPlanForEditing('shared'))!;
    const theirs = (await loadPlanForEditing('shared'))!;

    const edit = (loaded: LoadedPlan, title: string) =>
      savePlan({
        mode: 'edit',
        planId: 'shared',
        details: detailsForStorage({
          ...emptyDetails(),
          title,
          description: loaded.plan.description,
        }),
        days: loaded.days.map((d) => day(d.id, d.title, [d.scriptureReference])),
        loaded,
        status: null,
        uid: admin.uid,
      });

    await edit(theirs, 'Their title');
    await expect(edit(mine, 'My title')).rejects.toBeInstanceOf(PlanConflictError);
    expect((await loadPlanForEditing('shared'))!.plan.title).toBe('Their title');
  });

  it('copies a plan as a draft nobody but staff can see', async () => {
    await createPlan('original');
    const copy = 'original-copy';
    await duplicatePlan({
      sourceId: 'original',
      newId: copy,
      newTitle: 'Seven Days, again',
      uid: admin.uid,
    });
    const loaded = (await loadPlanForEditing(copy))!;
    expect(loaded.plan).toMatchObject({
      title: 'Seven Days, again',
      status: 'draft',
      published: false,
      dayCount: 2,
    });
    expect(loaded.days.map((d) => d.title)).toEqual([
      'The Lord is my shepherd',
      'Out of the depths',
    ]);
    await publishSentinel();
    const library = openLibrary();
    await library.until(
      (plans) => plans.some((p) => p.id === 'sentinel'),
      'the sentinel'
    );
    expect(library.ids()).toContain('original');
    expect(library.ids()).not.toContain(copy);
  });

  it('gives a new day an id that cannot collide with another', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newDayId('some-plan')));
    expect(ids.size).toBe(50);
  });
});
