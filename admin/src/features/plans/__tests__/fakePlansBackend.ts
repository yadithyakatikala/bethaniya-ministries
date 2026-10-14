/**
 * An in-memory stand-in for services/firebase/plans.ts, for the tests of
 * the screens that use it.
 *
 * The real service is tested against a recording Firestore in
 * services/firebase/__tests__/plans.test.ts, and against the real security
 * rules in firebase-tests/. What the SCREENS need to prove is different:
 * that the right thing is asked for, in the right order, and that what comes
 * back is shown. A fake that behaves like the service -- saving a plan makes
 * it loadable, publishing it makes it published, deleting it makes it gone --
 * lets a test walk through a whole workflow (create, publish, unpublish,
 * delete) and read the result off the screen, instead of scripting each
 * answer by hand.
 *
 * Use it from a test like this. `vi.mock` is hoisted above the imports, so
 * the module is mocked with bare `vi.fn()`s and wired up afterwards:
 *
 *   vi.mock('../../../services/firebase/plans', async (importOriginal) => ({
 *     ...(await importOriginal<typeof import('../../../services/firebase/plans')>()),
 *     savePlan: vi.fn(),
 *     ...
 *   }));
 *   import * as plans from '../../../services/firebase/plans';
 *   beforeEach(() => { resetBackend(); installFakePlans(vi.mocked(plans)); });
 *
 * The error classes (PlanIdTakenError and the rest) stay the real ones.
 */
import type { MockedObject } from 'vitest';
import type * as PlansModule from '../../../services/firebase/plans';
import type { LoadedPlan } from '../../../services/firebase/plans';
import type { Plan, PlanDay } from '../../../types';
import { dayForStorage } from '../planDays';
import { comparePlans } from '../../../services/firebase/plans';
import { statusFieldsFor, unchangedStatusFields } from '../planStatus';
import { makeDay, makePlan } from './fixtures';

type MockedPlans = MockedObject<typeof PlansModule>;

/** What Firestore holds, by plan id. */
export const store = new Map<string, LoadedPlan>();

/** Subscribers to the plan list, told after every change like a snapshot listener is. */
const listeners = new Set<() => void>();

function notifyAll(): void {
  for (const listener of listeners) listener();
}

let dayCounter = 0;
let clock = Date.parse('2026-06-01T00:00:00Z');

function tick(): Date {
  // Strictly increasing, so "changed since I loaded it" is always detectable.
  clock += 1000;
  return new Date(clock);
}

function copy<T extends LoadedPlan | Plan>(value: T): T {
  return structuredClone(value);
}

export function resetBackend(): void {
  store.clear();
  listeners.clear();
  dayCounter = 0;
}

/** Puts a plan (and optionally its days) into the fake Firestore. */
export function seedPlan(
  plan: Partial<Plan> = {},
  days?: Partial<PlanDay>[]
): LoadedPlan {
  const made = makePlan({ id: 'seven-days-in-the-psalms', ...plan });
  const dayDocs = (
    days ?? [
      { id: 'day-1', dayNumber: 1, title: 'The Lord is my shepherd' },
      {
        id: 'day-2',
        dayNumber: 2,
        title: 'Out of the depths',
        scriptureReference: 'Psalm 130',
      },
    ]
  ).map((day, index) => makeDay({ dayNumber: index + 1, ...day }));
  const loaded: LoadedPlan = {
    plan: { ...made, dayCount: dayDocs.length },
    days: dayDocs,
  };
  store.set(made.id, loaded);
  return loaded;
}

/** Wires every function of the (mocked) plans service to the fake. */
export function installFakePlans(m: MockedPlans): void {
  m.loadPlanForEditing.mockImplementation(async (id) => {
    const found = store.get(id);
    return found ? copy(found) : null;
  });

  m.loadPlanDocument.mockImplementation(async (id) => {
    const found = store.get(id);
    return found ? copy(found.plan) : null;
  });

  m.planIdExists.mockImplementation(async (id) => store.has(id));

  m.newDayId.mockImplementation((planId) => {
    dayCounter += 1;
    return `${planId}-day-${dayCounter}`;
  });

  m.savePlan.mockImplementation(async (input) => {
    const { mode, planId, details, days, status } = input;
    const existing = store.get(planId);
    if (mode === 'create' && existing) throw new m.PlanIdTakenError(planId);
    if (mode === 'edit' && !existing) throw new m.PlanMissingError(planId);
    if (
      mode === 'edit' &&
      existing &&
      input.loaded &&
      existing.plan.updatedAt?.getTime() !== input.loaded.plan.updatedAt?.getTime()
    ) {
      throw new m.PlanConflictError(planId);
    }
    const fields = status
      ? statusFieldsFor(status)
      : existing
        ? unchangedStatusFields(existing.plan)
        : statusFieldsFor({ to: 'draft' });
    const now = tick();
    store.set(planId, {
      plan: makePlan({
        ...details,
        id: planId,
        subtitle: details.subtitle,
        dayCount: days.length,
        status: fields.status,
        published: fields.published,
        publishAt: fields.publishAt,
        publishedAt:
          fields.status === 'published'
            ? (existing?.plan.publishedAt ?? now)
            : (existing?.plan.publishedAt ?? null),
        createdBy: existing?.plan.createdBy ?? input.uid,
        createdAt: existing?.plan.createdAt ?? now,
        updatedAt: now,
      }),
      days: days.map((day, index) =>
        makeDay({ id: day.id, dayNumber: index + 1, ...dayForStorage(day) })
      ),
    });
    notifyAll();
  });

  m.setPlanStatus.mockImplementation(async (plan, change) => {
    const found = store.get(plan.id);
    if (!found) throw new m.PlanMissingError(plan.id);
    const fields = statusFieldsFor(change);
    store.set(plan.id, {
      days: found.days,
      plan: {
        ...found.plan,
        status: fields.status,
        published: fields.published,
        publishAt: fields.publishAt,
        dayCount: found.days.length,
        updatedAt: tick(),
      },
    });
    notifyAll();
  });

  m.deletePlan.mockImplementation(async (id) => {
    store.delete(id);
    notifyAll();
    return { leftoverDays: 0 };
  });

  m.duplicatePlan.mockImplementation(async ({ sourceId, newId, newTitle, uid }) => {
    const source = store.get(sourceId);
    if (!source) throw new m.PlanMissingError(sourceId);
    if (store.has(newId)) throw new m.PlanIdTakenError(newId);
    const now = tick();
    store.set(newId, {
      plan: {
        ...source.plan,
        id: newId,
        title: newTitle,
        status: 'draft',
        published: false,
        publishAt: null,
        publishedAt: null,
        createdBy: uid,
        createdAt: now,
        updatedAt: now,
      },
      days: source.days.map((day, index) => ({
        ...day,
        id: `${newId}-copy-${index + 1}`,
      })),
    });
    notifyAll();
  });

  m.subscribeToPlans.mockImplementation((onNext) => {
    const push = () =>
      onNext([...store.values()].map((loaded) => copy(loaded.plan)).sort(comparePlans));
    listeners.add(push);
    push();
    return () => {
      listeners.delete(push);
    };
  });
}
