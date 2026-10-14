import { describe, expect, it } from 'vitest';
import {
  dayNumberOf,
  editorReducer,
  loadedPlanState,
  newPlanState,
  type EditorAction,
  type EditorState,
} from '../planEditorState';
import { makeDay, makePlan } from './fixtures';

function run(state: EditorState, ...actions: EditorAction[]): EditorState {
  return actions.reduce(editorReducer, state);
}

const titles = (state: EditorState) => state.days.map((day) => day.title);

describe('a new plan', () => {
  it('starts empty, clean and in create mode', () => {
    const state = newPlanState();
    expect(state).toMatchObject({ mode: 'create', planId: '', days: [], dirty: false });
    expect(state.details.title).toBe('');
  });

  it('makes its id from the title until the id is typed in', () => {
    let state = run(newPlanState(), {
      type: 'setDetail',
      field: 'title',
      value: 'Seven Days in the Psalms',
    });
    expect(state.planId).toBe('seven-days-in-the-psalms');
    state = run(state, {
      type: 'setDetail',
      field: 'title',
      value: 'Seven Days in Psalms',
    });
    expect(state.planId).toBe('seven-days-in-psalms');

    state = run(state, { type: 'setPlanId', value: 'psalms-week' });
    expect(state).toMatchObject({ planId: 'psalms-week', idEdited: true });
    // Once typed, the id no longer follows the title.
    state = run(state, {
      type: 'setDetail',
      field: 'title',
      value: 'Something else entirely',
    });
    expect(state.planId).toBe('psalms-week');
  });

  it('turns spaces and capitals in a typed id into a valid one', () => {
    const state = run(newPlanState(), { type: 'setPlanId', value: 'My New  Plan' });
    expect(state.planId).toBe('my-new-plan');
  });

  it('marks itself changed by any edit', () => {
    expect(
      run(newPlanState(), { type: 'setDetail', field: 'subtitle', value: 'x' }).dirty
    ).toBe(true);
    expect(run(newPlanState(), { type: 'addDay' }).dirty).toBe(true);
  });
});

describe('an existing plan', () => {
  const plan = makePlan();
  const days = [
    makeDay({ id: 'b', dayNumber: 2, title: 'Second', scriptureReference: 'Psalm 24' }),
    makeDay({ id: 'a', dayNumber: 1, title: 'First' }),
  ];

  it('opens with its days in order, clean, with its id fixed', () => {
    const state = loadedPlanState(plan, days);
    expect(state).toMatchObject({ mode: 'edit', planId: plan.id, dirty: false });
    expect(titles(state)).toEqual(['First', 'Second']);
    expect(state.days.map((day) => day.id)).toEqual(['a', 'b']);
  });

  it('keeps the id when the title changes, and refuses to retype it', () => {
    let state = loadedPlanState(plan, days);
    state = run(
      state,
      { type: 'setDetail', field: 'title', value: 'A different title' },
      { type: 'setPlanId', value: 'something-else' }
    );
    expect(state.planId).toBe(plan.id);
    expect(state.details.title).toBe('A different title');
  });

  it('can be replaced by a fresh load, clearing the changed flag', () => {
    let state = loadedPlanState(plan, days);
    state = run(state, { type: 'addDay' });
    expect(state.dirty).toBe(true);
    state = run(state, { type: 'loaded', plan, days });
    expect(state.dirty).toBe(false);
    expect(state.days).toHaveLength(2);
  });
});

describe('editing the days', () => {
  const start = () =>
    run(newPlanState(), { type: 'addDay' }, { type: 'addDay' }, { type: 'addDay' });

  it('adds days at the end, selecting the new one', () => {
    const state = start();
    expect(state.days).toHaveLength(3);
    expect(state.selectedKey).toBe(state.days[2]!.key);
  });

  it('gives every day its own key, even after removals', () => {
    let state = start();
    const first = state.days[0]!.key;
    state = run(state, { type: 'removeDay', key: first }, { type: 'addDay' });
    const keys = state.days.map((day) => day.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain(first);
  });

  it('adds several blank days at once', () => {
    const state = run(newPlanState(), { type: 'addDays', count: 5 });
    expect(state.days).toHaveLength(5);
    expect(new Set(state.days.map((day) => day.key)).size).toBe(5);
    expect(state.selectedKey).toBeNull();
  });

  it('edits one day without touching the others', () => {
    let state = start();
    const [a, b] = state.days;
    state = run(state, { type: 'updateDay', key: a!.key, patch: { title: 'Alpha' } });
    expect(titles(state)).toEqual(['Alpha', '', '']);
    expect(state.days[1]).toBe(b);
  });

  it('numbers days by position, so reordering renumbers them', () => {
    let state = start();
    state = run(
      state,
      { type: 'updateDay', key: state.days[0]!.key, patch: { title: 'A' } },
      { type: 'updateDay', key: state.days[1]!.key, patch: { title: 'B' } },
      { type: 'updateDay', key: state.days[2]!.key, patch: { title: 'C' } }
    );
    const c = state.days[2]!.key;
    expect(dayNumberOf(state, c)).toBe(3);
    state = run(state, { type: 'moveDay', key: c, direction: 'up' });
    expect(titles(state)).toEqual(['A', 'C', 'B']);
    expect(dayNumberOf(state, c)).toBe(2);
    state = run(state, { type: 'moveDayTo', key: c, index: 0 });
    expect(titles(state)).toEqual(['C', 'A', 'B']);
    expect(dayNumberOf(state, 'nope')).toBe(0);
  });

  it('copies a day, selects the copy, and leaves the original saved id out of it', () => {
    let state = loadedPlanState(makePlan(), [
      makeDay({ id: 'saved', title: 'Original' }),
    ]);
    const key = state.days[0]!.key;
    state = run(state, { type: 'duplicateDay', key });
    expect(titles(state)).toEqual(['Original', 'Original (copy)']);
    expect(state.days[1]!.id).toBeNull();
    expect(state.selectedKey).toBe(state.days[1]!.key);
    expect(state.dirty).toBe(true);
  });

  it('ignores a copy of a day that is not there', () => {
    const state = start();
    expect(run(state, { type: 'duplicateDay', key: 'nope' })).toBe(state);
  });

  it('closes the drawer when the open day is removed', () => {
    let state = start();
    const open = state.selectedKey!;
    state = run(state, { type: 'removeDay', key: open });
    expect(state.selectedKey).toBeNull();
    expect(state.days).toHaveLength(2);
  });

  it('keeps the drawer open when a different day is removed', () => {
    let state = start();
    const open = state.selectedKey!;
    state = run(state, { type: 'removeDay', key: state.days[0]!.key });
    expect(state.selectedKey).toBe(open);
  });

  it('opens and closes a day without counting as a change', () => {
    const clean = loadedPlanState(makePlan(), [makeDay()]);
    const opened = run(clean, { type: 'selectDay', key: clean.days[0]!.key });
    expect(opened.selectedKey).toBe(clean.days[0]!.key);
    expect(opened.dirty).toBe(false);
    expect(run(opened, { type: 'selectDay', key: null }).selectedKey).toBeNull();
  });
});
