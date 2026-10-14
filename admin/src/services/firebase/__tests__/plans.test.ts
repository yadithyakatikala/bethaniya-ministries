import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The reading-plan service against a recording stand-in for Firestore.
 *
 * What matters here is WHAT IS WRITTEN AND IN WHAT ORDER, because both are
 * contracts: the plan document goes last, days go in batches no bigger than
 * the rule-lookup budget allows, a failed create cleans up after itself, and
 * a stale editor is refused before anything is written. The same flows run
 * against the real rules, and are read back by the phone's own service, in
 * firebase-tests/src/plans-end-to-end.test.ts.
 */
const h = vi.hoisted(() => {
  class MockTimestamp {
    readonly ms: number;
    constructor(ms: number) {
      this.ms = ms;
    }
    static fromDate(date: Date) {
      return new MockTimestamp(date.getTime());
    }
    toDate() {
      return new Date(this.ms);
    }
    toMillis() {
      return this.ms;
    }
  }

  /** Every write, in order, across batches, transactions and single calls. */
  const log: string[] = [];
  const batches: { ops: string[]; committed: boolean }[] = [];
  const writes: Record<string, unknown>[] = [];
  const txSet = vi.fn();
  const txUpdate = vi.fn();
  const txGet = vi.fn();
  const state = {
    batchFailsAt: -1,
    docs: new Map<string, Record<string, unknown> | null>(),
    collections: new Map<string, { id: string; data: Record<string, unknown> }[]>(),
    nextId: 0,
  };
  return {
    MockTimestamp,
    log,
    batches,
    writes,
    txSet,
    txUpdate,
    txGet,
    state,
    logAdminAction: vi.fn(),
  };
});

vi.mock('../app', () => ({ db: {} }));
vi.mock('../auditLog', () => ({ logAdminAction: h.logAdminAction }));

vi.mock('firebase/firestore', () => {
  const pathOf = (segments: string[]) => segments.join('/');
  return {
    Timestamp: h.MockTimestamp,
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    query: (ref: unknown) => ref,
    collection: (_db: unknown, ...segments: string[]) => ({ path: pathOf(segments) }),
    doc: (target: unknown, ...segments: string[]) => {
      const base = (target as { path?: string }).path;
      const path = base
        ? segments.length > 0
          ? `${base}/${segments.join('/')}`
          : `${base}/auto-${++h.state.nextId}`
        : pathOf(segments);
      return { path, id: path.split('/').pop() };
    },
    getDoc: async (ref: { path: string; id: string }) => {
      const data = h.state.docs.get(ref.path) ?? null;
      return { exists: () => data !== null, data: () => data ?? undefined, id: ref.id };
    },
    getDocs: async (ref: { path: string }) => {
      const rows = h.state.collections.get(ref.path) ?? [];
      return {
        size: rows.length,
        docs: rows.map((row) => ({
          id: row.id,
          data: () => row.data,
          ref: { path: `${ref.path}/${row.id}`, id: row.id },
        })),
      };
    },
    onSnapshot: (ref: { path: string }, next: (snapshot: unknown) => void) => {
      const rows = h.state.collections.get(ref.path) ?? [];
      next({ docs: rows.map((row) => ({ id: row.id, data: () => row.data })) });
      return () => undefined;
    },
    updateDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
      h.log.push(`update ${ref.path}`);
      h.writes.push({ path: ref.path, ...data });
    },
    deleteDoc: async (ref: { path: string }) => {
      h.log.push(`delete ${ref.path}`);
    },
    writeBatch: () => {
      const batch = { ops: [] as string[], committed: false };
      h.batches.push(batch);
      return {
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          batch.ops.push(`set ${ref.path}`);
          h.writes.push({ path: ref.path, ...data });
        },
        delete: (ref: { path: string }) => {
          batch.ops.push(`delete ${ref.path}`);
        },
        commit: async () => {
          if (h.batches.indexOf(batch) === h.state.batchFailsAt) {
            throw new Error('batch failed');
          }
          batch.committed = true;
          h.log.push(`batch ${batch.ops.length}`);
        },
      };
    },
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<void>) => {
      h.log.push('transaction');
      await fn({ get: h.txGet, set: h.txSet, update: h.txUpdate });
    },
  };
});

import {
  PlanConflictError,
  PlanIdTakenError,
  PlanMissingError,
  WRITES_PER_BATCH,
  comparePlans,
  deletePlan,
  duplicatePlan,
  loadPlanForEditing,
  savePlan,
  setPlanStatus,
  subscribeToPlans,
  toPlan,
  toPlanDay,
  type DayToSave,
  type LoadedPlan,
  type SavePlanInput,
} from '../plans';
import { blankDay } from '../../../features/plans/planDays';
import { emptyDetails, detailsForStorage } from '../../../features/plans/planDetails';
import { makeDay, makePlan } from '../../../features/plans/__tests__/fixtures';

const T = h.MockTimestamp;
const UPDATED = new Date('2026-01-02T00:00:00Z');

function day(id: string, title = id, overrides: Partial<DayToSave> = {}): DayToSave {
  return { ...blankDay(`k-${id}`), id, title, passages: ['Psalm 23'], ...overrides };
}

const DETAILS = detailsForStorage({
  ...emptyDetails(),
  title: 'Seven Days',
  description: 'A week.',
});

function input(overrides: Partial<SavePlanInput> = {}): SavePlanInput {
  return {
    mode: 'create',
    planId: 'seven-days',
    details: DETAILS,
    days: [day('a'), day('b')],
    loaded: null,
    status: null,
    uid: 'admin-1',
    ...overrides,
  };
}

/** A plan already in Firestore, so the editor can be "loaded" from it. */
function stored(
  planOverrides: Partial<Parameters<typeof makePlan>[0]> = {},
  days = [makeDay({ id: 'a', dayNumber: 1 }), makeDay({ id: 'b', dayNumber: 2, title: 'Second' })]
): LoadedPlan {
  const plan = makePlan({ id: 'seven-days', updatedAt: UPDATED, ...planOverrides });
  h.state.docs.set('plans/seven-days', {
    updatedAt: new T(UPDATED.getTime()),
    publishedAt: plan.publishedAt ? new T(plan.publishedAt.getTime()) : null,
  });
  h.state.collections.set(
    'plans/seven-days/days',
    days.map((d) => ({ id: d.id, data: {} }))
  );
  return { plan, days };
}

beforeEach(() => {
  h.log.length = 0;
  h.batches.length = 0;
  h.writes.length = 0;
  h.state.docs.clear();
  h.state.collections.clear();
  h.state.batchFailsAt = -1;
  h.state.nextId = 0;
  h.txSet.mockReset();
  h.txUpdate.mockReset();
  h.txGet.mockReset();
  h.txGet.mockImplementation(async (ref: { path: string }) => {
    const data = h.state.docs.get(ref.path) ?? null;
    return { exists: () => data !== null, data: () => data ?? undefined };
  });
  h.logAdminAction.mockReset();
});

describe('reading a plan from Firestore', () => {
  it('maps every field, and reads missing ones as empty', () => {
    expect(
      toPlan('p', {
        title: 'T',
        subtitle: 'S',
        description: 'D',
        category: 'C',
        coverImageUrl: 'https://x/y.jpg',
        language: 'te',
        estimatedMinutes: 12,
        author: 'A',
        dayCount: 3,
        order: 2,
        published: true,
        status: 'published',
        publishAt: new T(1000),
        publishedAt: new T(2000),
        createdBy: 'u',
        createdAt: new T(3000),
        updatedAt: new T(4000),
      })
    ).toEqual({
      id: 'p',
      title: 'T',
      subtitle: 'S',
      description: 'D',
      category: 'C',
      coverImageUrl: 'https://x/y.jpg',
      language: 'te',
      estimatedMinutes: 12,
      author: 'A',
      dayCount: 3,
      order: 2,
      published: true,
      status: 'published',
      publishAt: new Date(1000),
      publishedAt: new Date(2000),
      createdBy: 'u',
      createdAt: new Date(3000),
      updatedAt: new Date(4000),
    });
  });

  it('reads a plan written before the manager as one with no status, language or author', () => {
    expect(
      toPlan('old', { title: 'Old', description: 'D', category: 'C', dayCount: 7, order: 1, published: true })
    ).toMatchObject({
      status: null,
      language: null,
      estimatedMinutes: null,
      author: '',
      subtitle: '',
      publishAt: null,
      createdBy: null,
      published: true,
    });
  });

  it('ignores values of the wrong type or outside the vocabulary', () => {
    expect(
      toPlan('p', { status: 'live', language: 'fr', estimatedMinutes: 'ten', coverImageUrl: 4 })
    ).toMatchObject({ status: null, language: null, estimatedMinutes: null, coverImageUrl: null });
  });

  it('maps a day and reads its optional text as empty', () => {
    expect(toPlanDay('d', { dayNumber: 2, title: 'T', scriptureReference: 'Psalm 23' })).toMatchObject({
      id: 'd',
      dayNumber: 2,
      devotional: '',
      reflectionQuestion: '',
      prayerPrompt: '',
      application: '',
      notes: '',
    });
  });

  it('orders plans by their number, then their title', () => {
    const plans = [
      makePlan({ id: 'c', title: 'B', order: 2 }),
      makePlan({ id: 'b', title: 'B', order: 1 }),
      makePlan({ id: 'a', title: 'A', order: 1 }),
    ];
    expect(plans.sort(comparePlans).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('lists every plan in library order, including one with no order field', () => {
    h.state.collections.set('plans', [
      { id: 'second', data: { title: 'Second', order: 2 } },
      { id: 'none', data: { title: 'Zebra' } },
      { id: 'first', data: { title: 'First', order: 1 } },
    ]);
    let ids: string[] = [];
    subscribeToPlans(
      (plans) => (ids = plans.map((p) => p.id)),
      () => undefined
    );
    // `order` defaults to 0 for a plan that has none, so it is not silently dropped.
    expect(ids).toEqual(['none', 'first', 'second']);
  });

  it('loads a plan with its days in order, or null if there is none', async () => {
    expect(await loadPlanForEditing('missing')).toBeNull();
    h.state.docs.set('plans/p', { title: 'P' });
    h.state.collections.set('plans/p/days', [
      { id: 'late', data: { dayNumber: 2, title: 'Two' } },
      { id: 'early', data: { dayNumber: 1, title: 'One' } },
    ]);
    const loaded = await loadPlanForEditing('p');
    expect(loaded?.plan.id).toBe('p');
    expect(loaded?.days.map((d) => d.id)).toEqual(['early', 'late']);
  });
});

describe('creating a plan', () => {
  it('writes the days first, in batches no larger than the rule-lookup budget, and the plan LAST', async () => {
    const days = Array.from({ length: 25 }, (_, n) => day(`d${n}`));
    await savePlan(input({ days }));

    expect(WRITES_PER_BATCH).toBe(10);
    expect(h.batches.map((b) => b.ops.length)).toEqual([10, 10, 5]);
    expect(h.log).toEqual(['batch 10', 'batch 10', 'batch 5', 'transaction']);
    expect(h.txSet).toHaveBeenCalledTimes(1);
    expect(h.txUpdate).not.toHaveBeenCalled();
  });

  it('numbers days by position and stores them as given', async () => {
    await savePlan(
      input({ days: [day('a', 'First', { passages: ['psalm 23'] }), day('b', 'Second')] })
    );
    const first = h.writes.find((w) => w.path === 'plans/seven-days/days/a');
    const second = h.writes.find((w) => w.path === 'plans/seven-days/days/b');
    expect(first).toMatchObject({
      dayNumber: 1,
      title: 'First',
      scriptureReference: 'Psalm 23',
      createdAt: 'SERVER_TIMESTAMP',
    });
    expect(second).toMatchObject({ dayNumber: 2, title: 'Second' });
  });

  it('writes a new plan as an unpublished draft with the real day count and its author', async () => {
    await savePlan(input());
    const [ref, body] = h.txSet.mock.calls[0]!;
    expect(ref.path).toBe('plans/seven-days');
    expect(body).toMatchObject({
      title: 'Seven Days',
      description: 'A week.',
      dayCount: 2,
      status: 'draft',
      published: false,
      publishAt: null,
      publishedAt: null,
      createdBy: 'admin-1',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
      language: 'en',
      estimatedMinutes: null,
    });
  });

  it('can create and publish in one save', async () => {
    await savePlan(input({ status: { to: 'published' } }));
    expect(h.txSet.mock.calls[0]![1]).toMatchObject({
      status: 'published',
      published: true,
      publishedAt: 'SERVER_TIMESTAMP',
    });
    expect(h.logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'publish', collection: 'plans', documentId: 'seven-days' })
    );
  });

  it('refuses an id that is taken, before writing anything', async () => {
    h.state.docs.set('plans/seven-days', { title: 'Existing' });
    await expect(savePlan(input())).rejects.toBeInstanceOf(PlanIdTakenError);
    expect(h.log).toEqual([]);
  });

  it('refuses if someone takes the id while the days are being written', async () => {
    // The pre-check passes; by the time the plan is written the id exists.
    h.txGet.mockImplementation(async () => ({ exists: () => true, data: () => ({}) }));
    await expect(savePlan(input())).rejects.toBeInstanceOf(PlanIdTakenError);
    expect(h.txSet).not.toHaveBeenCalled();
  });

  it('cleans up the days it wrote if a batch fails, and never writes the plan', async () => {
    h.state.batchFailsAt = 1;
    const days = Array.from({ length: 25 }, (_, n) => day(`d${n}`));
    await expect(savePlan(input({ days }))).rejects.toThrow('batch failed');

    expect(h.txSet).not.toHaveBeenCalled();
    const deleted = h.batches
      .flatMap((b) => b.ops)
      .filter((op) => op.startsWith('delete plans/seven-days/days/'));
    // Everything it set is removed again.
    expect(deleted).toHaveLength(25);
    expect(h.logAdminAction).not.toHaveBeenCalled();
  });

  it('logs the creation with the number of days', async () => {
    await savePlan(input());
    expect(h.logAdminAction).toHaveBeenCalledWith({
      action: 'create',
      collection: 'plans',
      documentId: 'seven-days',
      changeSummary: 'Created plan "Seven Days" (2 days)',
    });
  });
});

describe('editing a plan', () => {
  const edit = (loaded: LoadedPlan, overrides: Partial<SavePlanInput> = {}) =>
    input({
      mode: 'edit',
      loaded,
      days: [
        day('a', 'The Lord is my shepherd', {
          passages: ['Psalm 23'],
          devotional: 'Rest.',
          reflectionQuestion: 'Where has he led you?',
          prayerPrompt: 'Thank him.',
          application: 'Call a friend.',
          notes: 'A psalm of David.',
        }),
        day('b', 'Second', { devotional: 'Rest.', reflectionQuestion: 'Where has he led you?', prayerPrompt: 'Thank him.', application: 'Call a friend.', notes: 'A psalm of David.' }),
      ],
      ...overrides,
    });

  it('writes only the days that changed', async () => {
    const loaded = stored();
    await savePlan(edit(loaded));
    // Both days match what was loaded, so nothing is written to the days...
    expect(h.batches).toHaveLength(0);
    // ...and the plan is still updated, last.
    expect(h.log).toEqual(['transaction']);
    expect(h.txUpdate).toHaveBeenCalledTimes(1);
  });

  it('rewrites a day whose text changed, and leaves the other alone', async () => {
    const loaded = stored();
    await savePlan(
      edit(loaded, {
        days: [
          day('a', 'The Lord is my shepherd', {
            devotional: 'CHANGED',
            reflectionQuestion: 'Where has he led you?',
            prayerPrompt: 'Thank him.',
            application: 'Call a friend.',
            notes: 'A psalm of David.',
          }),
          day('b', 'Second', { devotional: 'Rest.', reflectionQuestion: 'Where has he led you?', prayerPrompt: 'Thank him.', application: 'Call a friend.', notes: 'A psalm of David.' }),
        ],
      })
    );
    expect(h.batches.map((b) => b.ops)).toEqual([['set plans/seven-days/days/a']]);
    expect(h.writes[0]).toMatchObject({ devotional: 'CHANGED', updatedAt: 'SERVER_TIMESTAMP' });
    // An existing day keeps its createdAt.
    expect(h.writes[0]).not.toHaveProperty('createdAt');
  });

  it('renumbers days that moved, and deletes days that were removed', async () => {
    const loaded = stored({}, [
      makeDay({ id: 'a', dayNumber: 1 }),
      makeDay({ id: 'b', dayNumber: 2, title: 'Second' }),
      makeDay({ id: 'c', dayNumber: 3, title: 'Third' }),
    ]);
    // Day 'b' is removed, 'c' becomes day 2.
    await savePlan(
      edit(loaded, {
        days: [
          day('a', 'The Lord is my shepherd', { devotional: 'Rest.', reflectionQuestion: 'Where has he led you?', prayerPrompt: 'Thank him.', application: 'Call a friend.', notes: 'A psalm of David.' }),
          day('c', 'Third', { devotional: 'Rest.', reflectionQuestion: 'Where has he led you?', prayerPrompt: 'Thank him.', application: 'Call a friend.', notes: 'A psalm of David.' }),
        ],
      })
    );
    const ops = h.batches.flatMap((b) => b.ops);
    expect(ops).toContain('set plans/seven-days/days/c');
    expect(ops).toContain('delete plans/seven-days/days/b');
    expect(ops).not.toContain('set plans/seven-days/days/a');
    expect(h.writes.find((w) => w.path === 'plans/seven-days/days/c')).toMatchObject({
      dayNumber: 2,
    });
    expect(h.txUpdate.mock.calls[0]![1]).toMatchObject({ dayCount: 2 });
  });

  it('refuses when the plan changed after the editor loaded it, writing nothing', async () => {
    const loaded = stored();
    h.state.docs.set('plans/seven-days', { updatedAt: new T(UPDATED.getTime() + 5000) });
    await expect(savePlan(edit(loaded))).rejects.toBeInstanceOf(PlanConflictError);
    expect(h.log).toEqual([]);
  });

  it('refuses when someone saves between the days and the plan, and writes no plan', async () => {
    const loaded = stored();
    h.txGet.mockImplementation(async () => ({
      exists: () => true,
      data: () => ({ updatedAt: new T(UPDATED.getTime() + 9000) }),
    }));
    await expect(savePlan(edit(loaded))).rejects.toBeInstanceOf(PlanConflictError);
    expect(h.txUpdate).not.toHaveBeenCalled();
  });

  it('refuses a plan that has been deleted', async () => {
    const loaded = stored();
    h.state.docs.delete('plans/seven-days');
    await expect(savePlan(edit(loaded))).rejects.toBeInstanceOf(PlanMissingError);
  });

  it('refuses to edit without having loaded the plan', async () => {
    stored();
    await expect(savePlan(input({ mode: 'edit', loaded: null }))).rejects.toBeInstanceOf(
      PlanConflictError
    );
  });

  it('keeps the status when asked to change nothing, and records the status an old plan implied', async () => {
    const loaded = stored({ status: null, published: true });
    await savePlan(edit(loaded));
    expect(h.txUpdate.mock.calls[0]![1]).toMatchObject({
      status: 'published',
      published: true,
      publishAt: null,
    });
    // It was already live and nothing was published just now.
    expect(h.txUpdate.mock.calls[0]![1]).not.toHaveProperty('publishedAt');
  });

  it('keeps a scheduled plan scheduled for the same moment', async () => {
    const at = new Date('2026-07-01T06:00:00Z');
    const loaded = stored({ status: 'scheduled', published: false, publishAt: at });
    await savePlan(edit(loaded));
    expect(h.txUpdate.mock.calls[0]![1]).toMatchObject({
      status: 'scheduled',
      published: false,
      publishAt: new T(at.getTime()),
    });
  });

  it('publishes: published true, status published, and the first-published time recorded once', async () => {
    const loaded = stored({ status: 'draft', published: false });
    await savePlan(edit(loaded, { status: { to: 'published' } }));
    expect(h.txUpdate.mock.calls[0]![1]).toMatchObject({
      status: 'published',
      published: true,
      publishAt: null,
      publishedAt: 'SERVER_TIMESTAMP',
    });
  });

  it('does not overwrite the time it was first published when published again', async () => {
    const first = new Date('2026-03-01T00:00:00Z');
    const loaded = stored({ status: 'draft', published: false, publishedAt: first });
    await savePlan(edit(loaded, { status: { to: 'published' } }));
    expect(h.txUpdate.mock.calls[0]![1]).not.toHaveProperty('publishedAt');
  });

  it('schedules for a moment, as a timestamp, leaving the plan unpublished', async () => {
    const at = new Date('2026-09-01T06:00:00Z');
    const loaded = stored({ status: 'draft', published: false });
    await savePlan(edit(loaded, { status: { to: 'scheduled', publishAt: at } }));
    expect(h.txUpdate.mock.calls[0]![1]).toMatchObject({
      status: 'scheduled',
      published: false,
      publishAt: new T(at.getTime()),
    });
    expect(h.logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        changeSummary: expect.stringContaining('Scheduled plan "Seven Days"'),
      })
    );
  });

  it('logs an update as an update, and unpublishing as an unpublish', async () => {
    await savePlan(edit(stored({ status: 'draft', published: false })));
    expect(h.logAdminAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'update', changeSummary: 'Updated plan "Seven Days" (2 days)' })
    );

    await savePlan(
      edit(stored({ status: 'published', published: true }), { status: { to: 'draft' } })
    );
    expect(h.logAdminAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'unpublish', changeSummary: 'Unpublished plan "Seven Days"' })
    );
  });
});

describe('changing only the status', () => {
  const plan = {
    id: 'seven-days',
    title: 'Seven Days',
    status: 'draft' as const,
    published: false,
    publishAt: null,
  };

  beforeEach(() => {
    h.state.docs.set('plans/seven-days', { updatedAt: new T(1) });
    h.state.collections.set('plans/seven-days/days', [
      { id: 'a', data: {} },
      { id: 'b', data: {} },
      { id: 'c', data: {} },
    ]);
  });

  it('publishes with the REAL number of days, not a remembered one', async () => {
    await setPlanStatus(plan, { to: 'published' });
    expect(h.writes[0]).toMatchObject({
      path: 'plans/seven-days',
      status: 'published',
      published: true,
      publishAt: null,
      dayCount: 3,
      publishedAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    });
    expect(h.logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'publish', changeSummary: 'Published plan "Seven Days" (3 days)' })
    );
  });

  it.each([
    [{ to: 'draft' }, 'published', 'unpublish'],
    [{ to: 'archived' }, 'published', 'unpublish'],
    [{ to: 'archived' }, 'draft', 'update'],
    [{ to: 'draft' }, 'archived', 'update'],
  ] as const)('writes %o over a %s plan and logs it as %s', async (change, from, action) => {
    await setPlanStatus(
      { ...plan, status: from, published: from === 'published' },
      change as never
    );
    expect(h.logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action }));
  });

  it('refuses a plan that has gone', async () => {
    h.state.docs.delete('plans/seven-days');
    await expect(setPlanStatus(plan, { to: 'published' })).rejects.toBeInstanceOf(PlanMissingError);
  });
});

describe('duplicating a plan', () => {
  beforeEach(() => {
    h.state.docs.set('plans/source', { title: 'Source', category: 'Topical' });
    h.state.collections.set(
      'plans/source/days',
      Array.from({ length: 12 }, (_, n) => ({
        id: `s${n}`,
        data: { dayNumber: n + 1, title: `Day ${n + 1}`, scriptureReference: 'Psalm 23' },
      }))
    );
  });

  it('copies the days, then the plan last, as a draft owned by the copier', async () => {
    await duplicatePlan({ sourceId: 'source', newId: 'source-copy', newTitle: ' Source copy ', uid: 'admin-2' });

    expect(h.batches.map((b) => b.ops.length)).toEqual([10, 2]);
    expect(h.log.at(-1)).toBe('transaction');
    const [ref, body] = h.txSet.mock.calls[0]!;
    expect(ref.path).toBe('plans/source-copy');
    expect(body).toMatchObject({
      title: 'Source copy',
      category: 'Topical',
      dayCount: 12,
      status: 'draft',
      published: false,
      publishAt: null,
      publishedAt: null,
      createdBy: 'admin-2',
    });
    const copied = h.writes.filter((w) => String(w.path).startsWith('plans/source-copy/days/'));
    expect(copied).toHaveLength(12);
    expect(copied.map((w) => w.dayNumber)).toEqual(Array.from({ length: 12 }, (_, n) => n + 1));
  });

  it('refuses a missing source, and an id already in use', async () => {
    await expect(
      duplicatePlan({ sourceId: 'nope', newId: 'x-copy', newTitle: 'X', uid: 'u' })
    ).rejects.toBeInstanceOf(PlanMissingError);

    h.state.docs.set('plans/taken', { title: 'Taken' });
    await expect(
      duplicatePlan({ sourceId: 'source', newId: 'taken', newTitle: 'X', uid: 'u' })
    ).rejects.toBeInstanceOf(PlanIdTakenError);
    expect(h.batches).toHaveLength(0);
  });

  it('removes the copied days if the copy cannot be completed', async () => {
    h.state.batchFailsAt = 1;
    await expect(
      duplicatePlan({ sourceId: 'source', newId: 'source-copy', newTitle: 'X', uid: 'u' })
    ).rejects.toThrow('batch failed');
    expect(h.txSet).not.toHaveBeenCalled();
    const deleted = h.batches.flatMap((b) => b.ops).filter((op) => op.startsWith('delete '));
    expect(deleted.length).toBeGreaterThan(0);
  });
});

describe('deleting a plan', () => {
  beforeEach(() => {
    h.state.docs.set('plans/p', { title: 'P' });
    h.state.collections.set(
      'plans/p/days',
      Array.from({ length: 23 }, (_, n) => ({ id: `d${n}`, data: {} }))
    );
  });

  it('removes the plan FIRST so members lose it at once, then every day in small batches', async () => {
    const result = await deletePlan('p', 'Plan P');
    expect(h.log[0]).toBe('delete plans/p');
    expect(h.batches.map((b) => b.ops.length)).toEqual([10, 10, 3]);
    expect(result).toEqual({ leftoverDays: 0 });
    expect(h.logAdminAction).toHaveBeenCalledWith({
      action: 'delete',
      collection: 'plans',
      documentId: 'p',
      changeSummary: 'Deleted plan "Plan P" and its 23 days',
    });
  });

  it('says how many days could not be removed instead of hiding it', async () => {
    h.state.batchFailsAt = 0;
    const result = await deletePlan('p', 'Plan P');
    expect(result).toEqual({ leftoverDays: 23 });
    // The plan itself is gone either way.
    expect(h.log[0]).toBe('delete plans/p');
  });
});
