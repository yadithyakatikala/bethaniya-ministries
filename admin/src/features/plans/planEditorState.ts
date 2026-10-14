/**
 * The reading-plan editor's state, as a pure reducer.
 *
 * The whole plan -- its details and every day -- is held here in memory and
 * written together on Save, so what an administrator sees is always the
 * complete, ordered plan, and "unsaved changes" is one flag. The reducer is
 * pure (no ids from the clock or from Math.random) so every edit is
 * testable: day keys come from a counter in the state.
 */
import type { Plan, PlanDay } from '../../types';
import {
  blankDay,
  dayFromDocument,
  duplicateDay,
  indexOfKey,
  moveDay,
  moveDayTo,
  removeDay,
  type DayDraft,
} from './planDays';
import {
  detailsFromPlan,
  emptyDetails,
  slugify,
  type PlanDetailsForm,
} from './planDetails';

export interface EditorState {
  mode: 'create' | 'edit';
  /** The plan's unique id. Chosen once, on create; fixed afterwards. */
  planId: string;
  /** True once the administrator has typed in the id box, so the title stops rewriting it. */
  idEdited: boolean;
  details: PlanDetailsForm;
  days: DayDraft[];
  /** The day open in the drawer, if any. */
  selectedKey: string | null;
  /** Source of the next new day's key. */
  nextKey: number;
  /** Unsaved changes. */
  dirty: boolean;
}

export type EditorAction =
  | { type: 'setDetail'; field: keyof PlanDetailsForm; value: string | null }
  | { type: 'setPlanId'; value: string }
  | { type: 'addDay' }
  | { type: 'addDays'; count: number }
  | { type: 'updateDay'; key: string; patch: Partial<Omit<DayDraft, 'key' | 'id'>> }
  | { type: 'removeDay'; key: string }
  | { type: 'moveDay'; key: string; direction: 'up' | 'down' }
  | { type: 'moveDayTo'; key: string; index: number }
  | { type: 'duplicateDay'; key: string }
  | { type: 'selectDay'; key: string | null }
  | { type: 'loaded'; plan: Plan; days: PlanDay[] };

export function newPlanState(): EditorState {
  return {
    mode: 'create',
    planId: '',
    idEdited: false,
    details: emptyDetails(),
    days: [],
    selectedKey: null,
    nextKey: 1,
    dirty: false,
  };
}

/** The state for a plan that already exists, with its days in order. */
export function loadedPlanState(plan: Plan, days: readonly PlanDay[]): EditorState {
  const ordered = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  return {
    mode: 'edit',
    planId: plan.id,
    idEdited: true,
    details: detailsFromPlan(plan),
    days: ordered.map((day) => dayFromDocument(`saved-${day.id}`, day)),
    selectedKey: null,
    nextKey: 1,
    dirty: false,
  };
}

function takeKey(state: EditorState): [string, number] {
  return [`new-${state.nextKey}`, state.nextKey + 1];
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'setDetail': {
      const details = {
        ...state.details,
        [action.field]: action.value,
      } as PlanDetailsForm;
      // While the administrator has not touched the id, it follows the title.
      const planId =
        state.mode === 'create' && !state.idEdited && action.field === 'title'
          ? slugify(String(action.value ?? ''))
          : state.planId;
      return { ...state, details, planId, dirty: true };
    }

    case 'setPlanId':
      // The id is chosen once; after the plan exists the box is read-only.
      if (state.mode !== 'create') return state;
      return {
        ...state,
        planId: action.value.toLowerCase().replace(/\s+/g, '-'),
        idEdited: true,
        dirty: true,
      };

    case 'addDay': {
      const [key, nextKey] = takeKey(state);
      return {
        ...state,
        days: [...state.days, blankDay(key)],
        selectedKey: key,
        nextKey,
        dirty: true,
      };
    }

    case 'addDays': {
      let nextKey = state.nextKey;
      const added: DayDraft[] = [];
      for (let n = 0; n < action.count; n += 1) {
        added.push(blankDay(`new-${nextKey}`));
        nextKey += 1;
      }
      return { ...state, days: [...state.days, ...added], nextKey, dirty: true };
    }

    case 'updateDay':
      return {
        ...state,
        days: state.days.map((day) =>
          day.key === action.key ? { ...day, ...action.patch } : day
        ),
        dirty: true,
      };

    case 'removeDay':
      return {
        ...state,
        days: removeDay(state.days, action.key),
        selectedKey: state.selectedKey === action.key ? null : state.selectedKey,
        dirty: true,
      };

    case 'moveDay':
      return {
        ...state,
        days: moveDay(state.days, action.key, action.direction),
        dirty: true,
      };

    case 'moveDayTo':
      return {
        ...state,
        days: moveDayTo(state.days, action.key, action.index),
        dirty: true,
      };

    case 'duplicateDay': {
      if (indexOfKey(state.days, action.key) < 0) return state;
      const [key, nextKey] = takeKey(state);
      return {
        ...state,
        days: duplicateDay(state.days, action.key, key),
        selectedKey: key,
        nextKey,
        dirty: true,
      };
    }

    case 'selectDay':
      return { ...state, selectedKey: action.key };

    case 'loaded':
      return loadedPlanState(action.plan, action.days);
  }
}

/** The one-based position of a day, for labels. 0 if the key is unknown. */
export function dayNumberOf(state: EditorState, key: string): number {
  return indexOfKey(state.days, key) + 1;
}
