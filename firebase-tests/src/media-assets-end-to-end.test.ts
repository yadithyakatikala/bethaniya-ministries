/**
 * The media LIBRARY, end to end: the admin site WRITES a library record, and the
 * real security rules decide whether the record is accepted and who may see it.
 *
 * Nothing here re-implements anything. The service under test is the admin
 * site's own source file, loaded unchanged:
 *
 *   admin/src/services/firebase/mediaAssets.ts   builds and writes the records
 *
 * It is wired to the Firestore and Auth emulators through the admin package's
 * own copy of the Firebase SDK, signed in as a real Auth-emulator user whose
 * role is stored in /users/{uid}; the rules are the committed firestore.rules.
 *
 * What it adds to firestore.rules.test.ts (which proves the rules with
 * hand-written documents) is the join between the two: that the document the
 * admin site ACTUALLY builds -- every field, the nulls, the server timestamps,
 * the closed field list -- is one the rules accept, for each way a record gets
 * made (an image, an audio file, a YouTube link, a pasted link). A rules test
 * with a hand-written document cannot notice the day the writer and the rules
 * drift apart; this one can.
 *
 * WHAT IS NOT REAL HERE: Cloudinary. No request is made to it and no account
 * exists. The "uploads" below are the records that a successful upload would
 * hand to the writer -- including replies with odd values -- not the result of
 * sending a file anywhere. (The upload code itself is tested, against a fake
 * XMLHttpRequest, in admin/src/services/media/__tests__/.)
 *
 * Needs the Auth and Firestore emulators (see README.md).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

// The admin site's Firestore handle is replaced with a getter so a test can
// choose WHO is acting (an administrator, a host, a member) without reloading
// anything.
const mockHandles: { admin: unknown } = { admin: null };

jest.mock('../../admin/src/services/firebase/app', () => ({
  get db() {
    return mockHandles.admin;
  },
}));
jest.mock('../../admin/src/services/firebase/auditLog', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));

import { logAdminAction } from '../../admin/src/services/firebase/auditLog';
import {
  assetFromLink,
  assetFromUpload,
  assetFromYouTube,
  createMediaAsset,
  deleteMediaAsset,
  subscribeToMediaAssets,
  updateMediaAsset,
  type MediaAsset,
} from '../../admin/src/services/firebase/mediaAssets';
import { parseYouTubeUrl } from '../../admin/src/services/media/youtube';
import type { UploadedAsset } from '../../admin/src/services/media/types';

// Same project id as firestore.rules.test.ts (see the note there).
const PROJECT_ID = 'demo-no-project';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');
const PASSWORD = 'correct-horse-battery';

interface Sdk {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  app: any;
  auth: any;
  firestore: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** The admin package's own copy of the Firebase SDK (the writer is built against it). */
function adminSdk(): Sdk {
  const from = path.resolve(__dirname, '../../admin/src/services/firebase');
  const load = (id: string) => require(require.resolve(id, { paths: [from] }));
  return {
    app: load('firebase/app'),
    auth: load('firebase/auth'),
    firestore: load('firebase/firestore'),
  };
}

type Role = 'content_admin' | 'host' | 'member';
interface Account {
  name: string;
  role: Role;
  email: string;
  uid: string;
}
interface Identity extends Account {
  db: unknown;
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
const accounts = {} as Record<'admin' | 'host' | 'member', Account>;
let who: Record<'admin' | 'host' | 'member', Identity>;

async function createAccount(name: string, role: Role): Promise<Account> {
  const sdk = adminSdk();
  const app = sdk.app.initializeApp(CONFIG, `media-e2e-setup-${name}`);
  const auth = sdk.auth.getAuth(app);
  sdk.auth.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const email = `${name}-media-${Date.now()}@example.org`;
  const credential = await sdk.auth.createUserWithEmailAndPassword(auth, email, PASSWORD);
  await sdk.app.deleteApp(app);
  return { name, role, email, uid: credential.user.uid as string };
}

/** Signs an account in on a brand-new SDK instance (a fresh connection every time). */
async function connect(account: Account): Promise<Identity> {
  const sdk = adminSdk();
  appCounter += 1;
  const app = sdk.app.initializeApp(CONFIG, `media-e2e-${account.name}-${appCounter}`);
  const auth = sdk.auth.getAuth(app);
  sdk.auth.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  await sdk.auth.signInWithEmailAndPassword(auth, account.email, PASSWORD);
  const db = sdk.firestore.getFirestore(app);
  sdk.firestore.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  openApps.push({
    delete: () => sdk.app.deleteApp(app),
    terminate: () => sdk.firestore.terminate(db),
  });
  return { ...account, db };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
  accounts.admin = await createAccount('admin', 'content_admin');
  accounts.host = await createAccount('host', 'host');
  accounts.member = await createAccount('member', 'member');
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const account of Object.values(accounts)) {
      await db
        .doc(`users/${account.uid}`)
        .set({ role: account.role, displayName: account.name });
    }
  });
  const [admin, host, member] = await Promise.all([
    connect(accounts.admin),
    connect(accounts.host),
    connect(accounts.member),
  ]);
  who = { admin, host, member };
  jest.mocked(logAdminAction).mockClear();
});

afterEach(async () => {
  for (const app of openApps.splice(0)) {
    await app.terminate();
    await app.delete();
  }
  await testEnv.clearFirestore();
});

/** Makes the next service call act as this person. */
function actAs(identity: Identity) {
  mockHandles.admin = identity.db;
}

/** The library as the screen sees it: one read, then stop listening. */
function readLibrary(): Promise<MediaAsset[]> {
  return new Promise((resolve, reject) => {
    const stop = subscribeToMediaAssets(
      (assets) => {
        stop();
        resolve(assets);
      },
      (error) => {
        stop();
        reject(error);
      }
    );
  });
}

const authorOf = (identity: Identity) => ({
  uid: identity.uid,
  name: `${identity.name} (test)`,
});

const DETAILS = {
  title: 'Easter poster',
  altText: 'A cross at sunrise',
  category: 'poster' as const,
};

// ---------------------------------------------------------------------------
// What a successful upload hands to the writer. NOT the result of a real upload.
// ---------------------------------------------------------------------------
const IMAGE_UPLOAD: UploadedAsset = {
  url: 'https://res.cloudinary.com/my-church/image/upload/v1700000000/maranatha/images/easter_k3j2h1.jpg',
  publicId: 'maranatha/images/easter_k3j2h1',
  resourceType: 'image',
  kind: 'image',
  format: 'jpg',
  bytes: 482_113,
  width: 1600,
  height: 900,
  durationSeconds: null,
  originalFilename: 'Easter-Poster_final',
};

const AUDIO_UPLOAD: UploadedAsset = {
  url: 'https://res.cloudinary.com/my-church/video/upload/v1700000000/maranatha/audio/hymn_ab12cd.mp3',
  publicId: 'maranatha/audio/hymn_ab12cd',
  resourceType: 'video',
  kind: 'audio',
  format: 'mp3',
  bytes: 4_200_000,
  width: null,
  height: null,
  durationSeconds: 187.4,
  originalFilename: 'Amazing-Grace',
};

describe('adding to the library', () => {
  it.each([
    ['an image upload', IMAGE_UPLOAD, DETAILS],
    ['an audio upload', AUDIO_UPLOAD, { ...DETAILS, category: 'song' as const }],
    [
      // Cloudinary files audio under "video" and may describe it as 0 x 0 pixels.
      'an audio upload described as 0 x 0 pixels',
      { ...AUDIO_UPLOAD, width: 0, height: 0 },
      { ...DETAILS, category: 'song' as const },
    ],
    [
      'an upload whose reported details are outside anything a record can hold',
      {
        ...IMAGE_UPLOAD,
        publicId: 'p'.repeat(301),
        format: 'f'.repeat(21),
        bytes: 2_000_000_000,
        width: 40_000,
        height: 40_000,
        originalFilename: 'n'.repeat(301),
      },
      DETAILS,
    ],
    [
      'an upload with no details reported at all',
      {
        ...IMAGE_UPLOAD,
        format: null,
        bytes: null,
        width: null,
        height: null,
        originalFilename: null,
      },
      { title: '', altText: '', category: 'general' as const },
    ],
  ])(
    'is accepted by the rules for %s, and reads back',
    async (_name, upload, details) => {
      actAs(who.admin);
      const id = await createMediaAsset(
        assetFromUpload(upload, details),
        authorOf(who.admin)
      );

      const library = await readLibrary();
      expect(library).toHaveLength(1);
      expect(library[0]).toMatchObject({
        id,
        kind: upload.kind,
        source: 'cloudinary',
        url: upload.url,
        createdBy: who.admin.uid,
        createdByName: `${who.admin.name} (test)`,
      });
      expect(library[0]!.createdAt).toBeInstanceOf(Date);
      expect(library[0]!.title.length).toBeGreaterThan(0);
      expect(logAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          collection: 'media_assets',
          documentId: id,
        })
      );
    }
  );

  it('records a value Cloudinary reported out of range as "not known", not as a refusal', async () => {
    actAs(who.admin);
    await createMediaAsset(
      assetFromUpload(
        {
          ...IMAGE_UPLOAD,
          publicId: 'p'.repeat(301),
          bytes: 2_000_000_000,
          width: 0,
          height: 40_000,
        },
        DETAILS
      ),
      authorOf(who.admin)
    );
    const [record] = await readLibrary();
    expect(record).toMatchObject({
      publicId: null,
      bytes: null,
      width: null,
      height: null,
      // The rest of what it said is kept.
      url: IMAGE_UPLOAD.url,
      format: 'jpg',
    });
  });

  it('records a YouTube video from the address an administrator pasted', async () => {
    const parsed = parseYouTubeUrl('http://youtu.be/dQw4w9WgXcQ?si=share-tracking');
    expect(parsed).not.toBeNull();
    actAs(who.admin);
    await createMediaAsset(
      assetFromYouTube(parsed!, {
        title: 'Sunday service',
        altText: '',
        category: 'video',
      }),
      authorOf(who.admin)
    );
    const [record] = await readLibrary();
    expect(record).toMatchObject({
      kind: 'video',
      source: 'youtube',
      // The canonical address is stored, never what was pasted.
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publicId: null,
    });
  });

  it.each([
    ['an image', 'image', 'https://example.org/poster.png'],
    ['an audio file', 'audio', 'https://example.org/hymn.mp3'],
    ['a video', 'video', 'https://example.org/clip.mp4'],
  ] as const)('records a pasted link to %s', async (_name, kind, url) => {
    actAs(who.admin);
    await createMediaAsset(
      assetFromLink(`  ${url}  `, kind, { ...DETAILS, category: 'general' }),
      authorOf(who.admin)
    );
    const [record] = await readLibrary();
    expect(record).toMatchObject({ kind, source: 'link', url });
  });
});

describe('changing and removing a record', () => {
  it('relabels it, and removes only the record', async () => {
    actAs(who.admin);
    const id = await createMediaAsset(
      assetFromUpload(IMAGE_UPLOAD, DETAILS),
      authorOf(who.admin)
    );

    await updateMediaAsset(id, {
      title: 'Easter poster 2027',
      altText: 'Sunrise over the cross',
      category: 'cover',
    });
    const [relabelled] = await readLibrary();
    expect(relabelled).toMatchObject({
      title: 'Easter poster 2027',
      altText: 'Sunrise over the cross',
      category: 'cover',
      // The file the record points at is untouched.
      url: IMAGE_UPLOAD.url,
      publicId: IMAGE_UPLOAD.publicId,
    });

    await deleteMediaAsset(id, 'Easter poster 2027');
    expect(await readLibrary()).toEqual([]);
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        collection: 'media_assets',
        documentId: id,
      })
    );
  });
});

describe('who is turned away', () => {
  it('lets a host look at the library but not add to it', async () => {
    actAs(who.admin);
    await createMediaAsset(assetFromUpload(IMAGE_UPLOAD, DETAILS), authorOf(who.admin));

    actAs(who.host);
    expect(await readLibrary()).toHaveLength(1);
    await expect(
      createMediaAsset(assetFromUpload(AUDIO_UPLOAD, DETAILS), authorOf(who.host))
    ).rejects.toMatchObject({ code: 'permission-denied' });

    actAs(who.admin);
    expect(await readLibrary()).toHaveLength(1);
  });

  it('lets an ordinary member neither look nor add', async () => {
    actAs(who.admin);
    await createMediaAsset(assetFromUpload(IMAGE_UPLOAD, DETAILS), authorOf(who.admin));

    actAs(who.member);
    await expect(readLibrary()).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      createMediaAsset(assetFromUpload(AUDIO_UPLOAD, DETAILS), authorOf(who.member))
    ).rejects.toMatchObject({ code: 'permission-denied' });

    actAs(who.admin);
    expect(await readLibrary()).toHaveLength(1);
  });

  it('does not let a record claim somebody else made it', async () => {
    actAs(who.admin);
    await expect(
      createMediaAsset(assetFromUpload(IMAGE_UPLOAD, DETAILS), {
        uid: who.host.uid,
        name: 'Somebody else',
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await readLibrary()).toEqual([]);
  });
});
