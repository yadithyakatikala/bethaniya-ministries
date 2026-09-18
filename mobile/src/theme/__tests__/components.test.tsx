import React from 'react';
import { StyleSheet, View } from 'react-native';
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { AppButton } from '../ui/AppButton';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/IconButton';
import { SegmentedChoice } from '../ui/SegmentedChoice';
import { TextField } from '../ui/TextField';
import { LoadingState } from '../ui/LoadingState';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import { SectionHeader } from '../ui/SectionHeader';
import { AuthProvider } from '../../context/AuthContext';
import { PreferencesProvider } from '../../context/PreferencesContext';
import { darkTokens, lightTokens, MIN_TOUCH_TARGET } from '../tokens';

jest.mock('../../services/firebase/app');

/**
 * The component foundation's behaviour.
 *
 * These assert the things a visual review cannot see: that a control is
 * actually big enough to hit, that a disabled control is still readable,
 * that an icon-only button says something to a screen reader, and that
 * selection is carried by more than colour. Every one of them
 * corresponds to a real defect the M3 audit found.
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

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

describe('AppButton', () => {
  it('never renders below the 44dp minimum, in any variant', async () => {
    // One tree with all four, rather than four renders: re-rendering
    // repeatedly inside a single test is what the library's own cleanup
    // does not expect.
    const { getByTestId } = await renderThemed(
      <>
        <AppButton title="Continue" variant="primary" testID="btn-primary" />
        <AppButton title="Continue" variant="secondary" testID="btn-secondary" />
        <AppButton title="Continue" variant="destructive" testID="btn-destructive" />
        <AppButton title="Continue" variant="text" testID="btn-text" />
      </>
    );
    for (const variant of ['primary', 'secondary', 'destructive', 'text'] as const) {
      expect(
        flat(getByTestId(`btn-${variant}`)).minHeight as number
      ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
  });

  it('paints a disabled button with the disabled tokens, not a faded fill', async () => {
    // The V1 button dropped the whole control to opacity 0.5, which took
    // its label under 3:1 and made "disabled" indistinguishable from
    // "loading". See ../tokens.ts.
    const { getByTestId } = await renderThemed(
      <AppButton title="Save" disabled testID="btn" />
    );
    const style = flat(getByTestId('btn'));
    expect(style.backgroundColor).toBe(lightTokens.disabledSurface);
    expect(style.opacity).toBe(1);
  });

  it('reports disabled and busy to a screen reader', async () => {
    const { getByTestId } = await renderThemed(
      <AppButton title="Save" loading testID="btn" />
    );
    expect(getByTestId('btn').props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true,
    });
  });

  it('does not fire while loading', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await renderThemed(
      <AppButton title="Save" loading onPress={onPress} testID="btn" />
    );
    await fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('wraps a long label to two lines rather than clipping it', async () => {
    // Telugu button labels run up to twice their English length.
    const { getByText } = await renderThemed(
      <AppButton title="కార్యక్రమాలను చూడండి" testID="btn" />
    );
    expect(getByText('కార్యక్రమాలను చూడండి').props.numberOfLines).toBe(2);
  });
});

describe('IconButton', () => {
  it('is exactly a 44dp square', async () => {
    const { getByTestId } = await renderThemed(
      <IconButton testID="icon" accessibilityLabel="Back" onPress={jest.fn()}>
        <View />
      </IconButton>
    );
    const style = flat(getByTestId('icon'));
    expect(style.width).toBe(MIN_TOUCH_TARGET);
    expect(style.height).toBe(MIN_TOUCH_TARGET);
  });

  it('always carries a label, because the glyph carries no text', async () => {
    const { getByTestId } = await renderThemed(
      <IconButton testID="icon" accessibilityLabel="Go back" onPress={jest.fn()}>
        <View />
      </IconButton>
    );
    expect(getByTestId('icon').props.accessibilityLabel).toBe('Go back');
    expect(getByTestId('icon').props.accessibilityRole).toBe('button');
  });
});

describe('Badge', () => {
  it('gives each status its own colours', async () => {
    const variants = [
      'success',
      'warning',
      'error',
      'info',
      'featured',
      'neutral',
    ] as const;
    const { getByTestId } = await renderThemed(
      <>
        {variants.map((variant) => (
          <Badge
            key={variant}
            label={variant}
            variant={variant}
            testID={`badge-${variant}`}
          />
        ))}
      </>
    );
    const backgrounds = variants.map((variant) =>
      String(flat(getByTestId(`badge-${variant}`)).backgroundColor)
    );
    // Before M3, warning and featured resolved to the same two colours.
    expect(new Set(backgrounds).size).toBe(variants.length);
  });

  it('marks LIVE with a dot as well as a colour', async () => {
    const { getByTestId } = await renderThemed(
      <>
        <Badge label="LIVE NOW" variant="live" testID="badge-live" />
        <Badge label="Draft" variant="neutral" testID="badge-neutral" />
      </>
    );
    // The live pill contains the dot plus the label; every other variant
    // has only the label.
    expect(getByTestId('badge-live').children.length).toBeGreaterThan(
      getByTestId('badge-neutral').children.length
    );
  });

  it('keeps a long translated label inside the pill', async () => {
    const { getByText } = await renderThemed(
      <Badge label="ఈ అధ్యాయం ఈ అనువాదంలో లేదు." variant="warning" />
    );
    expect(getByText('ఈ అధ్యాయం ఈ అనువాదంలో లేదు.').props.numberOfLines).toBe(1);
  });
});

describe('SegmentedChoice', () => {
  const options = [
    { value: 'a', label: 'English' },
    { value: 'b', label: 'తెలుగు' },
    { value: 'c', label: 'ఇంగ్లీష్ + తెలుగు' },
  ];

  it('announces itself as a radiogroup of radios', async () => {
    const { getByTestId } = await renderThemed(
      <SegmentedChoice
        testID="pick"
        options={options}
        selected="a"
        onSelect={jest.fn()}
      />
    );
    expect(getByTestId('pick').props.accessibilityRole).toBe('radiogroup');
    expect(getByTestId('pick-a').props.accessibilityRole).toBe('radio');
  });

  it('marks exactly one option selected', async () => {
    const { getByTestId } = await renderThemed(
      <SegmentedChoice
        testID="pick"
        options={options}
        selected="b"
        onSelect={jest.fn()}
      />
    );
    const states = options.map(
      (o) => getByTestId(`pick-${o.value}`).props.accessibilityState.selected
    );
    expect(states.filter(Boolean)).toHaveLength(1);
    expect(getByTestId('pick-b').props.accessibilityState.selected).toBe(true);
  });

  it('shows selection by border weight as well as by colour', async () => {
    // Colour-only selection is unusable for a colour-blind reader, which
    // is why the brief asks for more than one signal.
    const { getByTestId } = await renderThemed(
      <SegmentedChoice
        testID="pick"
        options={options}
        selected="a"
        onSelect={jest.fn()}
      />
    );
    const selected = flat(getByTestId('pick-a'));
    const unselected = flat(getByTestId('pick-b'));
    expect(selected.borderWidth as number).toBeGreaterThan(
      unselected.borderWidth as number
    );
    expect(selected.backgroundColor).not.toBe(unselected.backgroundColor);
  });

  it('keeps every option at 44dp, and wraps rather than shrinking Telugu', async () => {
    const { getByTestId } = await renderThemed(
      <SegmentedChoice
        testID="pick"
        options={options}
        selected="a"
        onSelect={jest.fn()}
      />
    );
    for (const option of options) {
      expect(
        flat(getByTestId(`pick-${option.value}`)).minHeight as number
      ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
    expect(flat(getByTestId('pick')).flexWrap).toBe('wrap');
  });

  it('reports the chosen value', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await renderThemed(
      <SegmentedChoice testID="pick" options={options} selected="a" onSelect={onSelect} />
    );
    await fireEvent.press(getByTestId('pick-c'));
    expect(onSelect).toHaveBeenCalledWith('c');
  });
});

describe('TextField', () => {
  it('names itself to a screen reader from its visible label', async () => {
    // Two of the three inputs this replaced relied on the placeholder as
    // the label, which a screen reader does not read as one.
    const { getByTestId } = await renderThemed(
      <TextField label="Display name" testID="field" />
    );
    expect(getByTestId('field').props.accessibilityLabel).toBe('Display name');
  });

  it('meets the 44dp minimum', async () => {
    const { getByTestId } = await renderThemed(
      <TextField label="Email" testID="field" />
    );
    expect(flat(getByTestId('field')).minHeight as number).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET
    );
  });

  it('uses the placeholder token, not a faded body colour', async () => {
    const { getByTestId } = await renderThemed(
      <TextField label="Email" placeholder="you@example.com" testID="field" />
    );
    expect(getByTestId('field').props.placeholderTextColor).toBe(lightTokens.inkSubtle);
  });

  it('shows an error as text AND as a border, never colour alone', async () => {
    const { getByTestId, getByText } = await renderThemed(
      <TextField label="Email" error="That is not an email address." testID="field" />
    );
    expect(getByText('That is not an email address.')).toBeTruthy();
    const style = flat(getByTestId('field'));
    expect(style.borderColor).toBe(lightTokens.danger);
    expect(style.borderWidth).toBe(1.5);
    expect(getByTestId('field').props['aria-invalid']).toBe(true);
  });

  it('reads as disabled when it is not editable', async () => {
    const { getByTestId } = await renderThemed(
      <TextField label="Email" editable={false} testID="field" />
    );
    expect(getByTestId('field').props.accessibilityState.disabled).toBe(true);
    expect(flat(getByTestId('field')).backgroundColor).toBe(lightTokens.disabledSurface);
  });
});

describe('LoadingState', () => {
  it('announces that the screen is busy', async () => {
    // Ten screens spun a bare ActivityIndicator, so a screen reader read
    // a loading screen as an empty one.
    const { getByTestId } = await renderThemed(
      <LoadingState testID="loading" label="Loading…" />
    );
    const node = getByTestId('loading');
    expect(node.props.accessibilityRole).toBe('progressbar');
    expect(node.props.accessibilityLabel).toBe('Loading…');
    expect(node.props.accessibilityState).toMatchObject({ busy: true });
  });
});

describe('ErrorState', () => {
  it('offers a retry and calls it', async () => {
    const onRetry = jest.fn();
    const { getByText } = await renderThemed(
      <ErrorState message="Could not load." retryLabel="Try again" onRetry={onRetry} />
    );
    await fireEvent.press(getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('announces itself when it replaces a spinner', async () => {
    const { getByTestId } = await renderThemed(
      <ErrorState message="Could not load." testID="err" />
    );
    expect(getByTestId('err').props.accessibilityLiveRegion).toBe('polite');
  });

  it('renders without a retry when there is nothing to retry', async () => {
    const { queryByText } = await renderThemed(<ErrorState message="Not found." />);
    expect(queryByText('Try again')).toBeNull();
  });
});

describe('EmptyState', () => {
  it('can offer the action that would fill it', async () => {
    const onAction = jest.fn();
    const { getByText } = await renderThemed(
      <EmptyState
        title="No prayers yet"
        message="Add the first one."
        actionLabel="Add a prayer"
        onAction={onAction}
      />
    );
    await fireEvent.press(getByText('Add a prayer'));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('SectionHeader', () => {
  it('marks its title as a heading', async () => {
    const { getByText } = await renderThemed(<SectionHeader title="Upcoming" />);
    expect(getByText('Upcoming').props.accessibilityRole).toBe('header');
  });

  it('gives its action a real 44dp target, not a hitSlop', async () => {
    // hitSlop widens where a tap registers but not where a screen reader
    // or a switch-control user finds the element.
    const { getByText } = await renderThemed(
      <SectionHeader title="Upcoming" actionLabel="See all" onAction={jest.fn()} />
    );
    // The label's parent is the AppButton, which owns the target.
    const button = getByText('See all').parent;
    expect(flat(button as never).minHeight as number).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET
    );
  });

  it('lets a long Telugu title shrink instead of pushing the action away', async () => {
    const { getByText } = await renderThemed(
      <SectionHeader
        title="రాబోయే కార్యక్రమాలు"
        actionLabel="అన్నీ చూడండి"
        onAction={jest.fn()}
      />
    );
    expect(flat(getByText('రాబోయే కార్యక్రమాలు')).flexShrink).toBe(1);
  });
});

describe('both palettes expose the same token surface', () => {
  it('has no token defined in one palette and missing from the other', async () => {
    expect(Object.keys(lightTokens).sort()).toEqual(Object.keys(darkTokens).sort());
  });
});
