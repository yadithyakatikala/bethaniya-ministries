import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { AppButton } from '../ui/AppButton';
import { Avatar, initialOf } from '../ui/Avatar';
import { Chip } from '../ui/Chip';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Icon } from '../ui/Icon';
import { ICON_NAMES, ICON_SHAPES } from '../ui/iconShapes';
import { IconButton } from '../ui/IconButton';
import { ListGroup, ListRow } from '../ui/ListRow';
import { NoticeBanner } from '../ui/NoticeBanner';
import { SegmentedChoice } from '../ui/SegmentedChoice';
import { Skeleton, SkeletonRows } from '../ui/Skeleton';
import { TextField } from '../ui/TextField';
import { UnderlineTabs } from '../ui/UnderlineTabs';
import { AuthProvider } from '../../context/AuthContext';
import { PreferencesProvider } from '../../context/PreferencesContext';
import {
  darkTokens,
  layout,
  lightTokens,
  MIN_TOUCH_TARGET,
  radii,
  SCRIPTURE_DISPLAY_STEPS,
  scriptureDisplayStyle,
  typographyFor,
} from '../tokens';

jest.mock('../../services/firebase/app');

/**
 * The shared pieces of the approved design system: sizes, the icon set,
 * and the components built from them. What a screenshot cannot tell you:
 * that a target is big enough, that a control still has a name when it is
 * busy, that a state is more than a colour.
 */
afterEach(async () => {
  await cleanup();
});

async function renderThemed(ui: React.ReactElement) {
  return render(
    <AuthProvider>
      <PreferencesProvider>{ui}</PreferencesProvider>
    </AuthProvider>
  );
}

/** Decorative elements are hidden from the accessibility tree, so a query has to ask for them. */
const HIDDEN = { includeHiddenElements: true } as const;

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

describe('sizes, by job', () => {
  it('states each measure once, as the approved system gives it', () => {
    expect(layout).toMatchObject({
      screenMargin: 20,
      section: 32,
      group: 16,
      tight: 8,
      rowTwoLines: 64,
      rowOneLine: 56,
      button: 48,
      buttonCompact: 40,
      textButton: 44,
      iconButton: 44,
      field: 48,
      chip: 36,
      hit: 44,
    });
    expect(radii).toMatchObject({ control: 12, card: 16, sheet: 22, pill: 999 });
  });

  it('never makes a target smaller than the minimum', () => {
    for (const key of ['textButton', 'iconButton', 'hit'] as const) {
      expect(layout[key]).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
    // A chip and a compact button are visually smaller; they get hit areas.
    expect(layout.chip + 8).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(layout.buttonCompact + 4).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });
});

describe('the new type roles', () => {
  it('sets the button label at 15/20 and the field help at 13/18', () => {
    const en = typographyFor('en');
    expect(en.button).toMatchObject({ fontSize: 15, lineHeight: 20 });
    expect(en.label).toMatchObject({ fontSize: 14, lineHeight: 18 });
    expect(en.help).toMatchObject({ fontSize: 13, lineHeight: 18 });
  });

  it('sets the wordmark in the English serif in BOTH languages: it is a Latin word', () => {
    expect(typographyFor('en').wordmark).toMatchObject({ fontSize: 19, lineHeight: 24 });
    expect(typographyFor('te').wordmark.fontFamily).toBe(
      typographyFor('en').wordmark.fontFamily
    );
  });
});

describe('the Home verse, in three steps by length', () => {
  const text = (length: number) => 'a'.repeat(length);

  it('is 28/40 up to 80 characters, 24/36 up to 160 and 21/32 beyond', () => {
    expect(SCRIPTURE_DISPLAY_STEPS.map((s) => [s.size, s.line])).toEqual([
      [28, 40],
      [24, 36],
      [21, 32],
    ]);
    expect(scriptureDisplayStyle('en', text(1))).toMatchObject({
      fontSize: 28,
      lineHeight: 40,
    });
    expect(scriptureDisplayStyle('en', text(80))).toMatchObject({ fontSize: 28 });
    expect(scriptureDisplayStyle('en', text(81))).toMatchObject({
      fontSize: 24,
      lineHeight: 36,
    });
    expect(scriptureDisplayStyle('en', text(160))).toMatchObject({ fontSize: 24 });
    expect(scriptureDisplayStyle('en', text(161))).toMatchObject({
      fontSize: 21,
      lineHeight: 32,
    });
    expect(scriptureDisplayStyle('en', text(2000))).toMatchObject({ fontSize: 21 });
  });

  it('is two points smaller in Telugu, with 12% more leading', () => {
    expect(scriptureDisplayStyle('te', text(10))).toMatchObject({
      fontSize: 26,
      lineHeight: 45,
    });
    expect(scriptureDisplayStyle('te', text(100))).toMatchObject({
      fontSize: 22,
      lineHeight: 40,
    });
    expect(scriptureDisplayStyle('te', text(300))).toMatchObject({
      fontSize: 19,
      lineHeight: 36,
    });
  });

  it('counts what the reader sees, not UTF-16 units, and ignores surrounding space', () => {
    // 80 Telugu letters with their vowel signs are more than 80 code units.
    const verse = 'క'.repeat(80);
    expect(scriptureDisplayStyle('te', `  ${verse}  `)).toMatchObject({ fontSize: 26 });
  });

  it("takes the serif of the verse's own script", () => {
    expect(scriptureDisplayStyle('en', 'x').fontFamily).toBe('NotoSerif-Regular');
    expect(scriptureDisplayStyle('te', 'x').fontFamily).toBe('NotoSerifTelugu-Regular');
  });
});

describe('the icon set', () => {
  it('has forty-nine glyphs, each made of at least one shape', () => {
    expect(ICON_NAMES).toHaveLength(49);
    for (const name of ICON_NAMES) expect(ICON_SHAPES[name].length).toBeGreaterThan(0);
  });

  it('has every glyph the five tabs and the shared components need', () => {
    for (const name of [
      'home',
      'bible',
      'prayer',
      'people',
      'you',
      'bell',
      'sliders',
      'chev',
      'back',
      'close',
      'search',
      'share',
      'copy',
      'check',
      'plus',
      'lock',
    ] as const) {
      expect(ICON_NAMES).toContain(name);
    }
  });

  it('keeps every circle and rectangle on the 24-point grid', () => {
    for (const name of ICON_NAMES) {
      for (const shape of ICON_SHAPES[name]) {
        if (shape.t === 'circle') {
          expect(shape.cx - shape.r).toBeGreaterThanOrEqual(0);
          expect(shape.cx + shape.r).toBeLessThanOrEqual(24);
          expect(shape.cy - shape.r).toBeGreaterThanOrEqual(0);
          expect(shape.cy + shape.r).toBeLessThanOrEqual(24);
        }
        if (shape.t === 'rect') {
          expect(shape.x).toBeGreaterThanOrEqual(0);
          expect(shape.y).toBeGreaterThanOrEqual(0);
          expect(shape.x + shape.w).toBeLessThanOrEqual(24);
          expect(shape.y + shape.h).toBeLessThanOrEqual(24);
        }
      }
    }
  });

  it('draws any glyph, hidden from a screen reader: it carries no words', async () => {
    const { getByTestId } = await renderThemed(
      <Icon name="home" size={28} color="#8F5A26" testID="icon" />
    );
    const node = getByTestId('icon', HIDDEN);
    expect(node.props.accessibilityElementsHidden).toBe(true);
    expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('takes the colour it is given, and the primary ink when it is given none', async () => {
    const gold = await renderThemed(<Icon name="home" color="#8F5A26" />);
    const goldJson = JSON.stringify(gold.toJSON());
    await gold.unmount();
    const plain = await renderThemed(<Icon name="home" />);
    expect(JSON.stringify(plain.toJSON())).not.toBe(goldJson);
  });

  it('renders every glyph without error', async () => {
    const { toJSON } = await renderThemed(
      <>
        {ICON_NAMES.map((name) => (
          <Icon key={name} name={name} size={20} />
        ))}
      </>
    );
    expect(toJSON()).toBeTruthy();
  });
});

describe('AppButton, as the approved system draws it', () => {
  it('is a pill, 48 high, with the 15/20 label', async () => {
    const { getByTestId, getByText } = await renderThemed(
      <AppButton title="Continue" testID="btn" />
    );
    const style = flat(getByTestId('btn'));
    expect(style.borderRadius).toBe(999);
    expect(style.minHeight).toBe(48);
    expect(flat(getByText('Continue'))).toMatchObject({ fontSize: 15, lineHeight: 20 });
  });

  it('has a compact size: 40 high, a 14/18 label, and a 44 touch target', async () => {
    const { getByTestId, getByText } = await renderThemed(
      <AppButton title="Share" compact testID="btn" />
    );
    expect(flat(getByTestId('btn')).minHeight).toBe(40);
    expect(flat(getByText('Share'))).toMatchObject({ fontSize: 14, lineHeight: 18 });
    expect(getByTestId('btn').props.hitSlop).toEqual({ top: 2, bottom: 2 });
  });

  it('sets a text button in gold ink, 44 high', async () => {
    const { getByTestId, getByText } = await renderThemed(
      <AppButton title="See all" variant="text" testID="btn" />
    );
    expect(flat(getByTestId('btn')).minHeight).toBe(44);
    expect(flat(getByText('See all')).color).toBe(lightTokens.accent);
  });

  it('keeps its width while it spins: the label stays in the layout, unseen', async () => {
    const { getByText } = await renderThemed(
      <AppButton title="Save changes" loading testID="btn" />
    );
    const label = getByText('Save changes', { includeHiddenElements: true });
    expect(flat(label).opacity).toBe(0);
    expect(label.props.accessibilityElementsHidden).toBe(true);
  });

  it('keeps its spoken name while it spins', async () => {
    const { getByTestId } = await renderThemed(
      <AppButton title="Sign in" loading testID="btn" />
    );
    expect(getByTestId('btn').props.accessibilityLabel).toBe('Sign in');
    expect(getByTestId('btn').props.accessibilityState).toMatchObject({ busy: true });
  });

  it('can end in an arrow', async () => {
    const { getByText } = await renderThemed(
      <AppButton title="Read the chapter" trailingIcon="arrow" />
    );
    expect(getByText('Read the chapter')).toBeTruthy();
  });
});

describe('IconButton, round', () => {
  it('is a 44 pill in all three looks, and only `outlined` has a ring', async () => {
    const { getByTestId } = await renderThemed(
      <>
        {(['plain', 'outlined', 'tinted'] as const).map((variant) => (
          <IconButton
            key={variant}
            variant={variant}
            testID={variant}
            accessibilityLabel={variant}
            onPress={jest.fn()}
          >
            <Text>x</Text>
          </IconButton>
        ))}
      </>
    );
    for (const variant of ['plain', 'outlined', 'tinted']) {
      expect(flat(getByTestId(variant))).toMatchObject({
        width: 44,
        height: 44,
        borderRadius: 999,
      });
    }
    expect(flat(getByTestId('outlined')).borderWidth).toBe(1);
    expect(flat(getByTestId('plain')).borderWidth).toBe(0);
    expect(flat(getByTestId('tinted')).backgroundColor).toBe(lightTokens.surfaceRaised);
  });
});

describe('Chip', () => {
  it('is a 36 pill with a 44 hit area, chosen in ink and never in gold', async () => {
    const { getByTestId } = await renderThemed(
      <>
        <Chip label="Healing" selected onPress={jest.fn()} testID="on" />
        <Chip label="Family" onPress={jest.fn()} testID="off" />
      </>
    );
    expect(flat(getByTestId('on'))).toMatchObject({
      minHeight: 36,
      borderRadius: 999,
      backgroundColor: lightTokens.primary,
    });
    expect(flat(getByTestId('off')).backgroundColor).toBe(lightTokens.surface);
    expect(getByTestId('on').props.hitSlop).toEqual({ top: 4, bottom: 4 });
    expect(getByTestId('on').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('off').props.accessibilityState.selected).toBe(false);
    expect(JSON.stringify(getByTestId('on').props.style)).not.toContain(
      lightTokens.accent
    );
  });

  it('reports a press, and is plain text when there is nothing to press', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await renderThemed(
      <>
        <Chip label="Healing" onPress={onPress} testID="live" />
        <Chip label="Healing" testID="static" />
      </>
    );
    await fireEvent.press(getByTestId('live'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(getByTestId('static').props.accessibilityRole).toBe('text');
  });
});

describe('SegmentedChoice, as a pill track', () => {
  const three = [
    { value: 'a', label: 'Light' },
    { value: 'b', label: 'Dark' },
    { value: 'c', label: 'System' },
  ];

  it('is a pill track in the secondary ground, with the chosen option a surface thumb', async () => {
    const { getByTestId } = await renderThemed(
      <SegmentedChoice testID="pick" options={three} selected="b" onSelect={jest.fn()} />
    );
    expect(flat(getByTestId('pick'))).toMatchObject({
      borderRadius: 999,
      backgroundColor: lightTokens.surfaceRaised,
    });
    expect(flat(getByTestId('pick-b'))).toMatchObject({
      backgroundColor: lightTokens.surface,
      borderColor: lightTokens.border,
    });
    expect(flat(getByTestId('pick-a')).backgroundColor).toBe('transparent');
  });

  it('turns into a group of chips past three options, still a radiogroup', async () => {
    const many = [...three, { value: 'd', label: 'Sepia' }];
    const onSelect = jest.fn();
    const { getByTestId } = await renderThemed(
      <SegmentedChoice testID="pick" options={many} selected="d" onSelect={onSelect} />
    );
    expect(getByTestId('pick').props.accessibilityRole).toBe('radiogroup');
    expect(flat(getByTestId('pick-d')).backgroundColor).toBe(lightTokens.primary);
    expect(flat(getByTestId('pick-a')).backgroundColor).toBe(lightTokens.surface);
    expect(flat(getByTestId('pick-a')).minHeight as number).toBeGreaterThanOrEqual(44);
    await fireEvent.press(getByTestId('pick-a'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });
});

describe('TextField, as the approved system draws it', () => {
  it('is 48 high, and 96 when it is multi-line', async () => {
    const { getByTestId } = await renderThemed(
      <>
        <TextField label="Name" testID="one" />
        <TextField label="Details" multiline testID="many" />
      </>
    );
    expect(flat(getByTestId('one')).minHeight).toBe(48);
    expect(flat(getByTestId('many')).minHeight).toBe(96);
    expect(flat(getByTestId('one')).borderRadius).toBe(12);
  });

  it('sets its help and error sentences at 13/18', async () => {
    const { getByText } = await renderThemed(
      <>
        <TextField label="Email" helpText="We never share it." />
        <TextField label="Age" error="Please enter a number." />
      </>
    );
    expect(flat(getByText('We never share it.'))).toMatchObject({
      fontSize: 13,
      lineHeight: 18,
    });
    expect(flat(getByText('Please enter a number.'))).toMatchObject({
      fontSize: 13,
      color: lightTokens.danger,
    });
  });

  it('names a Show / Hide action in words and reports whether the text is shown', async () => {
    const onToggle = jest.fn();
    const { getByTestId, getByText, rerender } = await renderThemed(
      <TextField
        label="Password"
        testID="pw"
        secureTextEntry
        toggle={{ shown: false, onToggle, showLabel: 'Show', hideLabel: 'Hide' }}
      />
    );
    expect(getByText('Show')).toBeTruthy();
    expect(getByTestId('pw-toggle').props.accessibilityLabel).toBe('Show');
    expect(getByTestId('pw-toggle').props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(getByTestId('pw-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    await rerender(
      <AuthProvider>
        <PreferencesProvider>
          <TextField
            label="Password"
            testID="pw"
            toggle={{ shown: true, onToggle, showLabel: 'Show', hideLabel: 'Hide' }}
          />
        </PreferencesProvider>
      </AuthProvider>
    );
    expect(getByTestId('pw-toggle').props.accessibilityLabel).toBe('Hide');
    expect(getByTestId('pw-toggle').props.accessibilityState.expanded).toBe(true);
  });
});

describe('ConfirmDialog', () => {
  const base = {
    visible: true,
    title: 'Log out?',
    message: 'You will need to sign in again to use your journal and notes.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Log out',
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
    testID: 'dlg',
  };
  beforeEach(() => jest.clearAllMocks());

  it('says what is being decided, and offers Cancel then the action', async () => {
    const { getByText, getByTestId } = await renderThemed(<ConfirmDialog {...base} />);
    expect(getByText('Log out?')).toBeTruthy();
    expect(getByText(base.message)).toBeTruthy();
    await fireEvent.press(getByTestId('dlg-cancel'));
    expect(base.onCancel).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByTestId('dlg-confirm'));
    expect(base.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('is cancelled by the backdrop and by the back gesture', async () => {
    const { getByTestId } = await renderThemed(<ConfirmDialog {...base} />);
    await fireEvent.press(getByTestId('dlg-backdrop'));
    expect(base.onCancel).toHaveBeenCalledTimes(1);
    // The platform's back gesture reaches the Modal's onRequestClose.
    getByTestId('dlg').parent!.props.onRequestClose();
    expect(base.onCancel).toHaveBeenCalledTimes(2);
  });

  it('uses the error fill only when the step really is destructive', async () => {
    const { getByTestId, rerender } = await renderThemed(<ConfirmDialog {...base} />);
    expect(flat(getByTestId('dlg-confirm')).backgroundColor).toBe(lightTokens.primary);
    await rerender(
      <AuthProvider>
        <PreferencesProvider>
          <ConfirmDialog {...base} destructive />
        </PreferencesProvider>
      </AuthProvider>
    );
    expect(flat(getByTestId('dlg-confirm')).backgroundColor).toBe(lightTokens.danger);
  });

  it('puts Cancel first and the action second side by side when the labels are short', async () => {
    const { getByTestId } = await renderThemed(<ConfirmDialog {...base} />);
    const names = getByTestId('dlg-cancel').parent!.children.map((c) =>
      typeof c === 'string' ? c : c.props.testID
    );
    expect(names).toEqual(['dlg-cancel', 'dlg-confirm']);
  });

  it('stacks the buttons, action first, when the labels are long (Telugu)', async () => {
    const { getByTestId } = await renderThemed(
      <ConfirmDialog
        {...base}
        cancelLabel="రద్దు చేయండి"
        confirmLabel="లాగ్ అవుట్ అవ్వండి"
      />
    );
    const cancel = getByTestId('dlg-cancel');
    const confirm = getByTestId('dlg-confirm');
    // the stack's children: the action's button first, then Cancel
    const names = cancel.parent!.children.map((c) =>
      typeof c === 'string' ? c : c.props.testID
    );
    expect(names).toEqual(['dlg-confirm', 'dlg-cancel']);
    expect(flat(confirm).alignSelf).toBe('stretch');
  });

  it('ignores both buttons and the backdrop while it is working', async () => {
    const { getByTestId } = await renderThemed(<ConfirmDialog {...base} loading />);
    await fireEvent.press(getByTestId('dlg-backdrop'));
    await fireEvent.press(getByTestId('dlg-cancel'));
    await fireEvent.press(getByTestId('dlg-confirm'));
    expect(base.onCancel).not.toHaveBeenCalled();
    expect(base.onConfirm).not.toHaveBeenCalled();
  });

  it('renders nothing while it is not visible', async () => {
    const { queryByText } = await renderThemed(
      <ConfirmDialog {...base} visible={false} />
    );
    expect(queryByText('Log out?')).toBeNull();
  });
});

describe('EmptyState variants', () => {
  it('draws a card as a dashed box, an inline one without a box', async () => {
    const { getByTestId } = await renderThemed(
      <>
        <EmptyState title="Nothing yet" message="Soon." testID="card" />
        <EmptyState
          title="No Prophet Verse today"
          message="Check back."
          variant="inline"
          testID="inline"
        />
      </>
    );
    expect(flat(getByTestId('card'))).toMatchObject({ borderStyle: 'dashed' });
    expect(flat(getByTestId('inline')).borderWidth).toBeUndefined();
  });

  it('puts a quiet mark above a full-screen one, and only there', async () => {
    const { getByTestId, queryByTestId } = await renderThemed(
      <>
        <EmptyState
          title="Nothing saved"
          message="Saved items appear here."
          variant="screen"
          mark={<Text testID="mark">fish</Text>}
        />
        <EmptyState
          title="Elsewhere"
          message="No mark in a card."
          mark={<Text testID="stray">fish</Text>}
        />
      </>
    );
    expect(getByTestId('mark')).toBeTruthy();
    expect(queryByTestId('stray')).toBeNull();
  });
});

describe('ErrorState, with a first line', () => {
  it('says what happened in bold and how to fix it under it', async () => {
    const { getByText } = await renderThemed(
      <ErrorState
        title="We could not load this"
        message="Check your connection and try again."
      />
    );
    expect(flat(getByText('We could not load this')).fontSize).toBe(15);
    expect(getByText('Check your connection and try again.')).toBeTruthy();
  });
});

describe('Skeleton', () => {
  it('is decorative, and the group says it is busy', async () => {
    const { getByTestId } = await renderThemed(
      <SkeletonRows count={3} label="Loading requests" testID="rows" />
    );
    expect(getByTestId('rows').props.accessibilityRole).toBe('progressbar');
    expect(getByTestId('rows').props.accessibilityLabel).toBe('Loading requests');
    expect(getByTestId('rows').props.accessibilityState).toMatchObject({ busy: true });
  });

  it('is a block in the secondary ground', async () => {
    const { getByTestId } = await renderThemed(
      <Skeleton width={120} height={16} testID="block" />
    );
    expect(flat(getByTestId('block', HIDDEN))).toMatchObject({
      width: 120,
      height: 16,
      backgroundColor: lightTokens.surfaceRaised,
    });
    expect(getByTestId('block', HIDDEN).props.accessibilityElementsHidden).toBe(true);
  });
});

describe('ListRow', () => {
  it('is 56 high for one line and 64 for two, with 12 above and below', async () => {
    const { getByTestId } = await renderThemed(
      <>
        <ListRow title="Language" testID="one" onPress={jest.fn()} />
        <ListRow
          title="Prayer requests"
          subtitle="Ask the church to pray"
          testID="two"
          onPress={jest.fn()}
        />
      </>
    );
    const body = (id: string) => flat(getByTestId(id).children[0] as never);
    expect(body('one')).toMatchObject({ minHeight: 56, paddingVertical: 12 });
    expect(body('two')).toMatchObject({ minHeight: 64, paddingVertical: 12 });
  });

  it('is one button whose spoken name joins the title, the value and the subtitle', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await renderThemed(
      <ListRow
        title="Theme"
        value="System"
        subtitle="Follows your phone"
        onPress={onPress}
        testID="row"
      />
    );
    expect(getByTestId('row').props.accessibilityRole).toBe('button');
    expect(getByTestId('row').props.accessibilityLabel).toBe(
      'Theme, System, Follows your phone'
    );
    await fireEvent.press(getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not a button when nothing happens on press', async () => {
    const { getByTestId } = await renderThemed(
      <ListRow title="Version" value="1.0.0" testID="row" />
    );
    expect(getByTestId('row').props.accessibilityRole).toBeUndefined();
    expect(getByTestId('row').props.accessibilityLabel).toBe('Version, 1.0.0');
  });

  it('shows a chevron only on a row that opens something, and not beside your own trailing node', async () => {
    const { toJSON } = await renderThemed(
      <ListRow title="Notifications" trailing={<Text>switch</Text>} onPress={jest.fn()} />
    );
    expect(JSON.stringify(toJSON())).not.toContain('M9.4 5.6');
  });

  it('draws no chevron on a destructive row: "Log out" does not open anything', async () => {
    const { toJSON } = await renderThemed(
      <ListRow title="Log out" destructive onPress={jest.fn()} />
    );
    expect(JSON.stringify(toJSON())).not.toContain('M9.4 5.6');
  });

  it('sets a destructive title in the error colour', async () => {
    const { getByText } = await renderThemed(
      <ListRow title="Log out" destructive onPress={jest.fn()} />
    );
    expect(flat(getByText('Log out')).color).toBe(lightTokens.danger);
  });

  it('draws a hairline between rows, none above the first or below the last', async () => {
    const { getByTestId } = await renderThemed(
      <ListGroup testID="group">
        <ListRow title="One" onPress={jest.fn()} />
        <ListRow title="Two" onPress={jest.fn()} />
        <ListRow title="Three" onPress={jest.fn()} />
      </ListGroup>
    );
    const wrappers = getByTestId('group').children as unknown as {
      props: { style?: unknown };
    }[];
    expect(wrappers).toHaveLength(3);
    expect(flat(wrappers[0]).borderTopWidth).toBeUndefined();
    expect(flat(wrappers[1]).borderTopWidth).toBe(1);
    expect(flat(wrappers[2]).borderTopWidth).toBe(1);
  });
});

describe('UnderlineTabs', () => {
  const tabs = [
    { value: 'requests', label: 'Requests' },
    { value: 'journal', label: 'My journal' },
  ];

  it('is a tablist of tabs, one selected, marked by ink and an underline', async () => {
    const { getByTestId } = await renderThemed(
      <UnderlineTabs testID="tabs" tabs={tabs} selected="journal" onSelect={jest.fn()} />
    );
    expect(getByTestId('tabs').props.accessibilityRole).toBe('tablist');
    const on = getByTestId('tabs-journal');
    const off = getByTestId('tabs-requests');
    expect(on.props.accessibilityRole).toBe('tab');
    expect(on.props.accessibilityState.selected).toBe(true);
    expect(off.props.accessibilityState.selected).toBe(false);
    expect(flat(on).borderBottomColor).toBe(lightTokens.ink);
    expect(flat(on).borderBottomWidth).toBe(2);
    expect(flat(off).borderBottomColor).toBe('transparent');
    // gold is not used here
    expect(JSON.stringify(on.props.style)).not.toContain(lightTokens.accent);
  });

  it('keeps every tab at 44 and reports the choice', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await renderThemed(
      <UnderlineTabs testID="tabs" tabs={tabs} selected="requests" onSelect={onSelect} />
    );
    for (const tab of tabs) {
      expect(
        flat(getByTestId(`tabs-${tab.value}`)).minHeight as number
      ).toBeGreaterThanOrEqual(44);
    }
    await fireEvent.press(getByTestId('tabs-journal'));
    expect(onSelect).toHaveBeenCalledWith('journal');
  });

  it('sits at its own width, left to right, 24 apart: not stretched across the screen', async () => {
    const { getByTestId } = await renderThemed(
      <UnderlineTabs testID="tabs" tabs={tabs} selected="requests" onSelect={jest.fn()} />
    );
    expect(flat(getByTestId('tabs'))).toMatchObject({
      flexDirection: 'row',
      gap: 24,
      borderBottomWidth: 1,
    });
    for (const tab of tabs) {
      const style = flat(getByTestId(`tabs-${tab.value}`));
      // No flex: 1, no centring -- a tab is as wide as its word (and at least 44).
      expect(style.flex).toBeUndefined();
      expect(style.flexGrow).toBeUndefined();
      expect(style.alignItems).toBeUndefined();
      expect(style.minWidth).toBe(44);
      expect(style).toMatchObject({ paddingTop: 10, paddingBottom: 12 });
    }
  });

  it('lets a finger reach 8 points into the gap beside each tab', async () => {
    const { getByTestId } = await renderThemed(
      <UnderlineTabs testID="tabs" tabs={tabs} selected="requests" onSelect={jest.fn()} />
    );
    expect(getByTestId('tabs-journal').props.hitSlop).toEqual({ left: 8, right: 8 });
  });

  it('sets every label at the same size, heavier when chosen, so choosing one moves nothing', async () => {
    const { getByText } = await renderThemed(
      <UnderlineTabs testID="tabs" tabs={tabs} selected="journal" onSelect={jest.fn()} />
    );
    const on = flat(getByText('My journal'));
    const off = flat(getByText('Requests'));
    expect(on.fontSize).toBe(off.fontSize);
    expect(on.lineHeight).toBe(off.lineHeight);
    expect(on.fontWeight).toBe('600');
    expect(off.fontWeight).toBe('500');
    expect(on.color).toBe(lightTokens.ink);
    expect(off.color).toBe(lightTokens.inkMuted);
  });

  it('lets a long label wrap inside its tab rather than push the other off the screen', async () => {
    const { getByTestId } = await renderThemed(
      <UnderlineTabs
        testID="tabs"
        tabs={[
          { value: 'a', label: 'ఆదివారం ఆరాధన మరియు సమాజ సమావేశం గురించి ప్రకటనలు' },
          { value: 'b', label: 'Chat' },
        ]}
        selected="a"
        onSelect={jest.fn()}
      />
    );
    expect(flat(getByTestId('tabs-a')).flexShrink).toBe(1);
  });
});

describe('Avatar and the first letter of a name', () => {
  it('takes a Latin initial in capitals', () => {
    expect(initialOf('daniel')).toBe('D');
    expect(initialOf('  ruth anand')).toBe('R');
  });

  it('keeps the vowel sign that makes a Telugu letter a syllable', () => {
    expect(initialOf('రూత్')).toBe('రూ');
    expect(initialOf('మీనా')).toBe('మీ');
  });

  it('never gives nothing', () => {
    expect(initialOf('')).toBe('?');
    expect(initialOf(null)).toBe('?');
    expect(initialOf(undefined)).toBe('?');
    expect(initialOf('123')).toBe('1');
  });

  it('is a decorative disc unless it is given a label', async () => {
    const { getByTestId } = await renderThemed(
      <>
        <Avatar name="Ruth" size={96} testID="plain" />
        <Avatar name="Ruth" label="Your profile" testID="named" />
      </>
    );
    expect(getByTestId('plain', HIDDEN).props.accessibilityElementsHidden).toBe(true);
    expect(getByTestId('named').props.accessibilityLabel).toBe('Your profile');
    expect(flat(getByTestId('plain', HIDDEN))).toMatchObject({
      width: 96,
      height: 96,
      borderRadius: 48,
    });
  });
});

describe('NoticeBanner', () => {
  it('has three tints, each with a border of its own colour and a live region', async () => {
    const { getByTestId } = await renderThemed(
      <>
        <NoticeBanner tone="neutral" message="One." testID="n" />
        <NoticeBanner tone="warning" message="Two." testID="w" />
        <NoticeBanner tone="danger" message="Three." testID="d" />
      </>
    );
    expect(flat(getByTestId('w'))).toMatchObject({
      backgroundColor: lightTokens.warningTint,
      borderColor: lightTokens.warning,
    });
    expect(flat(getByTestId('d'))).toMatchObject({
      backgroundColor: lightTokens.dangerTint,
      borderColor: lightTokens.danger,
    });
    expect(flat(getByTestId('n')).backgroundColor).toBe(lightTokens.surfaceRaised);
    expect(getByTestId('d').props.accessibilityLiveRegion).toBe('polite');
  });

  it('offers its one action', async () => {
    const onAction = jest.fn();
    const { getByText } = await renderThemed(
      <NoticeBanner
        message="Paused."
        actionLabel="Contact the church"
        onAction={onAction}
      />
    );
    await fireEvent.press(getByText('Contact the church'));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('the dark palette keeps the same surface', () => {
  it('has a raised ground, an ink and a disabled pair in both', () => {
    for (const tokens of [lightTokens, darkTokens]) {
      expect(tokens.surfaceRaised).toBeTruthy();
      expect(tokens.ink).toBeTruthy();
      expect(tokens.disabledSurface).toBeTruthy();
    }
  });
});
