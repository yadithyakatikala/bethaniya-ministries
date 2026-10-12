import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  findNodeHandle,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { translate, type StringKey } from '../../i18n/strings';
import { AppButton, IconButton, useTheme, useTypographyFor } from '../../theme';
import { useReducedMotion } from '../../theme/motion';
import { useTween } from '../../theme/useTween';
import {
  completeOnboarding,
  updateOwnProfile,
  type UserProfile,
} from '../../services/firebase/userProfile';
import { RESUME_START } from '../opening/engine/chapter';
import { scenePalette } from '../opening/palette';
import { stageMapping } from '../opening/stage';
import { AmbientBand } from './components/AmbientBand';
import { AnswerInput } from './components/AnswerInput';
import { ChapterLayer } from './components/ChapterLayer';
import { ChoiceRow } from './components/ChoiceRow';
import { CountrySheet } from './components/CountrySheet';
import { LanguageToggle } from './components/LanguageToggle';
import { ProgressFish } from './components/ProgressFish';
import { markChapterSeen } from './chapterSeen';
import { countryByIso } from './countries';
import {
  STEP_COUNT,
  emptyForm,
  flowReducer,
  initialFlow,
  isSkippable,
  stepName,
  validateStep,
  type StepNumber,
  type StepProblem,
} from './onboardingFlow';
import { parseAge, onboardingDefaults } from './profileCompleteness';
import { readPhone } from './phone';
import { useKeyboard } from './useKeyboard';

const PORTRAIT = require('../../../assets/brand/maranatha-portrait-crop-512.jpg');

const HEADER_HEIGHT = 44;
const BAND_MARGIN = 5;
/** A heading's hand-set line break is for the eye; a screen reader and a label get one line. */
const oneLine = (text: string): string => text.replace(/\s*\n\s*/g, ' ');

/** The widest the form is ever laid out: a phone-sized column, centred on a tablet. */
const MAX_COLUMN = 480;

/** Each part of the screen rises in turn: when it starts and ends, as fractions of 0.86 s. */
const RISE_PARTS = {
  header: [0, 0.55],
  title: [0.1, 0.65],
  support: [0.17, 0.72],
  input: [0.24, 0.79],
  cta: [0.31, 0.86],
} as const;
type RisePart = keyof typeof RISE_PARTS;
const RISE_SECONDS = 0.86;

/** A smoothstep, as the five stops a native animation can follow. */
const SMOOTH_IN = [0, 0.25, 0.5, 0.75, 1];
const SMOOTH_OUT = [0, 0.15625, 0.5, 0.84375, 1];

/**
 * The questionnaire a member answers once, after their first sign-in.
 *
 * =====================================================================
 * FIVE QUESTIONS, ONE PER SCREEN
 * =====================================================================
 * A name, an age, a phone number (which can be skipped), how they identify,
 * and the language they would like. It follows the opening: the gold
 * wordmark turns back into the fish, the fish carries the wind to a school
 * of its own kind and joins it, and the school settles into a band above
 * the first question. That plays once per device -- a member who comes back
 * to finish gets a two-second version -- and a tap anywhere skips it.
 *
 * =====================================================================
 * IT IS A PROFILE FORM. IT IS NOT A STEP IN AUTHENTICATION.
 * =====================================================================
 * Signing in is finished by the time this appears, and asking for a phone
 * number here has nothing to do with how anyone signs in -- the app's
 * methods are email/password and Google, there is no OTP anywhere in it,
 * and the phone question says so out loud.
 *
 * =====================================================================
 * WHAT IS KEPT, WHERE, AND UNTIL WHEN
 * =====================================================================
 * Every answer lives in memory only (see ./onboardingFlow.ts): going back
 * and forward keeps them all, and nothing is written to the device. They
 * leave in exactly one place -- the last Continue -- as ONE profile update
 * (completeOnboarding), after which the app language is set from the
 * answer. The age is written beside it, best-effort: the age field is newer
 * than some deployed rules, and onboarding must not fail because of it.
 *
 * Nothing is sent anywhere else: no SMS, no code, no analytics.
 *
 * =====================================================================
 * IT DOES NOT TRAP ANYONE
 * =====================================================================
 * There is a "Not now" on every screen, and the phone question has its own
 * "Skip for now". A member who does not want to answer gets into the app,
 * and Profile keeps a row that brings them back here. A failed save shows
 * the error, keeps every answer, and never reports success it did not get.
 *
 * =====================================================================
 * THE LANGUAGE ANSWER SETS THE APP LANGUAGE. ONLY THAT.
 * =====================================================================
 * It goes through PreferencesContext's setAppLanguage, the same setter
 * Settings uses, so the interface changes and the Bible mode and theme are
 * untouched. The EN | తె switch in the header changes the language the
 * QUESTIONS are shown in straight away -- but only this screen's; the rest
 * of the app follows when the answer is saved (or, if the member leaves
 * with "Not now", when they leave -- an explicit switch is not discarded).
 */
export function OnboardingScreen({
  profile,
  chapterSeen,
  onDone,
  onSkip,
}: {
  /** The member's current profile, for prefilling. `null` when the
   *  document has not been created yet. */
  profile: UserProfile | null;
  /** Whether this device has played the chapter before: it decides between
   *  the full story and the two-second version. `null` while that is still
   *  being read, and the first frame is held until it is known. */
  chapterSeen: boolean | null;
  onDone: () => void;
  onSkip: () => void;
}) {
  const { user } = useAuth();
  const { appLanguage, setAppLanguage } = usePreferences();
  const { colors, gold, radii } = useTheme();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const keyboard = useKeyboard();

  // ---- the answers: in memory, from the first moment to the last Continue ----
  const defaults = onboardingDefaults({
    profile,
    authDisplayName: user?.displayName,
    authPhoneNumber: user?.phoneNumber,
    appLanguage,
  });
  const [flow, dispatch] = useReducer(flowReducer, undefined, () =>
    initialFlow({
      ...emptyForm(defaults.preferredLanguage),
      name: defaults.fullName,
      age: defaults.age,
      countryIso: defaults.countryIso,
      phone: defaults.nationalPhone,
      gender: defaults.gender,
    })
  );
  const { step, form, showProblem } = flow;
  const language = form.language;
  /** What the app was showing when this screen opened, to tell if the member switched. */
  const [initialLanguage] = useState(defaults.preferredLanguage);

  const tr = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) =>
      translate(language, key, vars),
    [language]
  );
  const type = useTypographyFor(language);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);

  // ---- the chapter: a full-screen story that hands over to the band ----
  const startAt = chapterSeen === null ? null : chapterSeen ? RESUME_START : 0;
  const [chapterDone, setChapterDone] = useState(false);
  const chapterActive = !reducedMotion && !chapterDone;

  const [rise] = useState(() => new Animated.Value(0));
  /** True once the first question has finished rising, so it can take touches. */
  const [formUp, setFormUp] = useState(false);
  const startRise = useCallback(() => {
    Animated.timing(rise, {
      toValue: 1,
      duration: RISE_SECONDS * 1000,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setFormUp(true);
    });
  }, [rise]);

  const finishChapter = useCallback(() => {
    // Whether it ended or was skipped, the question is there in full.
    rise.stopAnimation();
    rise.setValue(1);
    setChapterDone(true);
    void markChapterSeen();
  }, [rise]);

  // With reduced motion there is no chapter: the form simply fades in.
  useEffect(() => {
    if (!reducedMotion) return undefined;
    const fade = Animated.timing(rise, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [reducedMotion, rise]);

  const partStyle = useCallback(
    (part: RisePart) => {
      const [from, to] = RISE_PARTS[part];
      const span = to - from;
      const input = SMOOTH_IN.map((p) => from + span * p);
      return {
        opacity: rise.interpolate({
          inputRange: reducedMotion ? [0, 1] : input,
          outputRange: reducedMotion ? [0, 1] : SMOOTH_OUT,
          extrapolate: 'clamp',
        }),
        transform: [
          {
            translateY: reducedMotion
              ? 0
              : rise.interpolate({
                  inputRange: input,
                  outputRange: SMOOTH_OUT.map((p) => (1 - p) * 14),
                  extrapolate: 'clamp',
                }),
          },
        ],
      };
    },
    [reducedMotion, rise]
  );

  // ---- layout ----
  const column = Math.min(width, MAX_COLUMN);
  const bandTop = insets.top + HEADER_HEIGHT + BAND_MARGIN;
  const mapping = useMemo(
    () => stageMapping(width, height, bandTop),
    [width, height, bandTop]
  );
  const palette = useMemo(() => scenePalette(colors, gold), [colors, gold]);
  // The keyboard tucks the school into a strip, and the question moves up.
  const compact = useTween(keyboard.visible ? 1 : 0, reducedMotion ? 0 : 350);
  const tight = keyboard.visible && height - keyboard.height < 400;
  const bandHeight = Math.round(150 * (column / 390) * (1 - compact) + 44 * compact);

  // ---- moving between questions ----
  const titleRef = useRef<Text>(null);
  useEffect(() => {
    // Tell a screen reader the question changed, so it reads the new one.
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [step]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 1 && !saving) {
        dispatch({ type: 'back' });
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [step, saving]);

  const problem: StepProblem | null = showProblem ? validateStep(step, form) : null;

  function problemText(p: StepProblem | null): string | null {
    switch (p) {
      case null:
        return null;
      case 'nameEmpty':
      case 'nameTooLong':
        return tr('onboarding.fullNameError');
      case 'ageInvalid':
        return tr('onboarding.ageError');
      case 'phoneTooShort':
        return countryByIso(form.countryIso).dial === '91' &&
          !form.phone.trim().startsWith('+')
          ? tr('onboarding.phoneErrorIndia')
          : tr('onboarding.phoneErrorShort');
      case 'phoneTooLong':
        return countryByIso(form.countryIso).dial === '91' &&
          !form.phone.trim().startsWith('+')
          ? tr('onboarding.phoneErrorIndia')
          : tr('onboarding.phoneErrorLong');
      case 'phoneEmpty':
      case 'phoneInvalid':
        return tr('onboarding.phoneError');
      case 'genderMissing':
        return tr('onboarding.genderError');
    }
  }

  /** The last Continue: validate everything, then write once. */
  async function submit() {
    setSaveError(null);
    // The five answers were each checked as they were left; check again, in
    // order, so a form that somehow reached here incomplete goes back to the
    // question that is missing instead of saving half a profile.
    for (let s = 1; s <= STEP_COUNT; s++) {
      if (s === 3 && form.phone.trim() === '') continue; // the skipped question
      if (validateStep(s as StepNumber, form) !== null) {
        dispatch({ type: 'goto', step: s as StepNumber, showProblem: true });
        return;
      }
    }
    if (!user) return;

    const age = parseAge(form.age);
    const phone =
      form.phone.trim() === ''
        ? null
        : readPhone(form.phone, countryByIso(form.countryIso)).e164;

    setSaving(true);
    try {
      // Written beside the completion, not inside it: the age field is newer
      // than some deployed rules, and a rejection must not stop onboarding.
      if (age !== null) {
        void updateOwnProfile(user.uid, { age }).catch((error) =>
          console.warn('[onboarding] could not save the age (not fatal):', error)
        );
      }
      await completeOnboarding(user.uid, {
        fullName: form.name.trim(),
        ...(phone ? { phoneNumber: phone } : {}),
        gender: form.gender!,
        preferredLanguage: language,
      });
      // AFTER the profile write succeeded, not before: this setter also
      // writes to the profile, and running it first would leave the app in a
      // language the member chose on a form that then failed.
      await setAppLanguage(language);
      onDone();
    } catch (error) {
      console.warn('[onboarding] could not save the profile:', error);
      setSaveError(tr('onboarding.saveFailed'));
      // Deliberately NOT calling onDone(). Nothing was saved, so pretending
      // otherwise would lose every answer on this screen.
    } finally {
      setSaving(false);
    }
  }

  async function notNow() {
    // Somebody who switched to Telugu and then left should not land in English.
    if (language !== initialLanguage) {
      try {
        await setAppLanguage(language);
      } catch (error) {
        console.warn('[onboarding] could not apply the language (not fatal):', error);
      }
    }
    onSkip();
  }

  const onContinue = () => {
    if (step === STEP_COUNT) void submit();
    else dispatch({ type: 'next' });
  };

  const name = stepName(step);
  const questionKey = `onboarding.q${step}` as StringKey;
  const supportKey = `onboarding.s${step}` as StringKey;

  const titleStyle = [
    type.display,
    // Telugu does not take the heading's tight tracking.
    language === 'te' ? { letterSpacing: 0 } : null,
    { color: colors.ink },
  ];

  const country = countryByIso(form.countryIso);

  return (
    <View
      style={[styles.root, { backgroundColor: colors.paper }]}
      testID="onboarding-screen"
    >
      {chapterActive ? (
        <ChapterLayer
          startAt={startAt}
          palette={palette}
          portrait={PORTRAIT}
          mapping={mapping}
          skipLabel={tr('onboarding.chapterSkip')}
          skipHint={tr('onboarding.chapterSkipHint')}
          onFormStart={startRise}
          onDone={finishChapter}
        />
      ) : null}

      {/* The form is the topmost layer and fills the screen, so until it has
          risen it must let touches fall through to the chapter's skip target
          beneath it -- and must not answer a tap on a button nobody can see yet. */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior="padding"
        pointerEvents={chapterActive && !formUp ? 'none' : 'auto'}
        testID="onboarding-form"
      >
        <View style={[styles.fill, { paddingTop: insets.top, alignItems: 'center' }]}>
          <View style={[styles.fill, { width: column }]}>
            {/* ---- header: back, progress, language ---- */}
            <Animated.View style={[styles.header, partStyle('header')]}>
              <View style={styles.back}>
                {step > 1 ? (
                  <IconButton
                    testID="onboarding-back"
                    accessibilityLabel={tr('common.back')}
                    onPress={() => dispatch({ type: 'back' })}
                    disabled={saving}
                  >
                    <Svg width={24} height={24} viewBox="0 0 24 24">
                      <Path
                        d="M15 5l-7 7 7 7"
                        fill="none"
                        stroke={colors.ink}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </IconButton>
                ) : null}
              </View>
              <View
                style={styles.progress}
                accessibilityRole="progressbar"
                accessibilityLabel={tr('onboarding.stepOf', {
                  n: step,
                  total: STEP_COUNT,
                })}
                accessibilityValue={{ min: 1, max: STEP_COUNT, now: step }}
                testID="onboarding-progress"
              >
                <ProgressFish step={step} />
              </View>
              {step < STEP_COUNT ? (
                <LanguageToggle
                  language={language}
                  onChange={(next) =>
                    dispatch({ type: 'edit', patch: { language: next } })
                  }
                  label={tr('onboarding.interfaceLanguage')}
                />
              ) : (
                <View style={styles.togglePlaceholder} />
              )}
            </Animated.View>

            {/* ---- the school: a slim band, never over the form ---- */}
            <View style={{ marginTop: BAND_MARGIN, height: bandHeight }}>
              {!chapterActive ? (
                <AmbientBand
                  palette={palette}
                  width={column}
                  compact={compact}
                  still={reducedMotion}
                />
              ) : null}
            </View>

            {/* ---- the question ---- */}
            <ScrollView
              style={styles.fill}
              contentContainerStyle={[styles.body, { paddingTop: 22 - 12 * compact }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={partStyle('title')}>
                <Text
                  ref={titleRef}
                  accessibilityRole="header"
                  style={titleStyle}
                  testID="onboarding-title"
                >
                  {tr(questionKey)}
                </Text>
              </Animated.View>
              {tight ? null : (
                <Animated.View style={partStyle('support')}>
                  <Text
                    style={[type.body, styles.support, { color: colors.inkMuted }]}
                    testID="onboarding-support"
                  >
                    {tr(supportKey)}
                  </Text>
                </Animated.View>
              )}

              <Animated.View
                style={[{ marginTop: 26 - 14 * compact }, partStyle('input')]}
              >
                {name === 'name' ? (
                  <AnswerInput
                    key="name"
                    testID="onboarding-full-name"
                    value={form.name}
                    onChangeText={(next) =>
                      dispatch({ type: 'edit', patch: { name: next } })
                    }
                    placeholder={tr('onboarding.fullNamePlaceholder')}
                    accessibilityLabel={oneLine(tr('onboarding.q1'))}
                    language={language}
                    error={problemText(problem)}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    onSubmitEditing={onContinue}
                    maxLength={200}
                  />
                ) : null}

                {name === 'age' ? (
                  <AnswerInput
                    key="age"
                    testID="onboarding-age"
                    variant="age"
                    value={form.age}
                    onChangeText={(next) =>
                      dispatch({ type: 'edit', patch: { age: next } })
                    }
                    placeholder={tr('onboarding.agePlaceholder')}
                    unit={tr('onboarding.ageUnit')}
                    accessibilityLabel={oneLine(tr('onboarding.q2'))}
                    language={language}
                    error={problemText(problem)}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={3}
                    returnKeyType="done"
                    autoFocus
                    onSubmitEditing={onContinue}
                  />
                ) : null}

                {name === 'phone' ? (
                  <View style={styles.phoneRow}>
                    <Pressable
                      testID="onboarding-country"
                      accessibilityRole="button"
                      accessibilityLabel={tr('onboarding.countryLabel', {
                        name: country.name[language],
                        dial: country.dial,
                      })}
                      accessibilityHint={tr('onboarding.country')}
                      onPress={() => setCountryOpen(true)}
                      style={({ pressed }) => [
                        styles.countryChip,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surfaceRaised,
                          borderRadius: radii.control,
                          opacity: pressed ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[type.bodyLarge, { color: colors.ink, fontWeight: '600' }]}
                      >
                        +{country.dial}
                      </Text>
                      <Svg width={16} height={16} viewBox="0 0 16 16">
                        <Path
                          d="M4 6l4 4 4-4"
                          fill="none"
                          stroke={colors.inkMuted}
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </Pressable>
                    <View style={styles.phoneField}>
                      <AnswerInput
                        key="phone"
                        testID="onboarding-phone"
                        value={form.phone}
                        onChangeText={(next) =>
                          dispatch({ type: 'edit', patch: { phone: next } })
                        }
                        placeholder={tr('onboarding.phonePlaceholder')}
                        accessibilityLabel={oneLine(tr('onboarding.q3'))}
                        language={language}
                        error={problemText(problem)}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                        returnKeyType="done"
                        autoFocus
                        onSubmitEditing={onContinue}
                      />
                    </View>
                  </View>
                ) : null}

                {name === 'gender' ? (
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel={oneLine(tr('onboarding.q4'))}
                    style={styles.choices}
                  >
                    <ChoiceRow
                      testID="onboarding-gender-male"
                      label={tr('onboarding.genderMale')}
                      selected={form.gender === 'male'}
                      // Nothing is preselected until the member chooses: a
                      // default would silently record an answer they never gave.
                      onPress={() =>
                        dispatch({ type: 'edit', patch: { gender: 'male' } })
                      }
                      language={language}
                      hasError={problem === 'genderMissing'}
                    />
                    <ChoiceRow
                      testID="onboarding-gender-female"
                      label={tr('onboarding.genderFemale')}
                      selected={form.gender === 'female'}
                      onPress={() =>
                        dispatch({ type: 'edit', patch: { gender: 'female' } })
                      }
                      language={language}
                      hasError={problem === 'genderMissing'}
                    />
                    {problem === 'genderMissing' ? (
                      <Text
                        testID="onboarding-gender-error"
                        accessibilityRole="alert"
                        accessibilityLiveRegion="polite"
                        style={[type.bodySmall, { color: colors.danger }]}
                      >
                        {tr('onboarding.genderError')}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {name === 'language' ? (
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel={oneLine(tr('onboarding.q5'))}
                    style={styles.choices}
                  >
                    <ChoiceRow
                      testID="onboarding-language-en"
                      // Each language is named in its own script, whichever
                      // language the questions are in: the row's face is the
                      // language's own, and a Telugu rendering of "English"
                      // set in Noto Serif (Latin only) would fall to the system face.
                      label={translate('en', 'settings.languageEnglish')}
                      sublabel={tr('onboarding.languageEnglishSub')}
                      selected={language === 'en'}
                      onPress={() =>
                        dispatch({ type: 'edit', patch: { language: 'en' } })
                      }
                      language="en"
                    />
                    <ChoiceRow
                      testID="onboarding-language-te"
                      label={translate('te', 'settings.languageTelugu')}
                      sublabel={tr('onboarding.languageTeluguSub')}
                      selected={language === 'te'}
                      onPress={() =>
                        dispatch({ type: 'edit', patch: { language: 'te' } })
                      }
                      language="te"
                    />
                  </View>
                ) : null}
              </Animated.View>
            </ScrollView>

            {/* ---- actions: always reachable, floating above the keyboard ---- */}
            <Animated.View
              style={[
                styles.cta,
                { paddingBottom: keyboard.visible ? 10 : Math.max(insets.bottom, 8) + 8 },
                partStyle('cta'),
              ]}
            >
              {saveError ? (
                <View
                  testID="onboarding-error"
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.notice,
                    {
                      backgroundColor: colors.dangerTint,
                      borderColor: colors.danger,
                      borderRadius: radii.control,
                    },
                  ]}
                >
                  <Text style={[type.body, { color: colors.ink }]}>{saveError}</Text>
                </View>
              ) : null}
              <AppButton
                testID={step === STEP_COUNT ? 'onboarding-submit' : 'onboarding-continue'}
                title={tr('onboarding.submit')}
                onPress={onContinue}
                loading={saving}
                // Continue wakes up when the answer is complete. Until then it looks
                // asleep but still answers a press -- with what is missing.
                muted={validateStep(step, form) !== null}
                fullWidth
              />
              {/* With the keyboard up the quiet link steps aside; closing it brings it back. */}
              {keyboard.visible ? null : isSkippable(step) ? (
                <AppButton
                  testID="onboarding-skip-phone"
                  title={tr('onboarding.skipQuestion')}
                  variant="text"
                  onPress={() => dispatch({ type: 'skipPhone' })}
                  disabled={saving}
                  fullWidth
                />
              ) : (
                <AppButton
                  testID="onboarding-skip"
                  title={tr('onboarding.skip')}
                  variant="text"
                  onPress={() => void notNow()}
                  disabled={saving}
                  fullWidth
                />
              )}
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <CountrySheet
        visible={countryOpen}
        selectedIso={form.countryIso}
        onSelect={(iso) => {
          dispatch({ type: 'edit', patch: { countryIso: iso } });
          setCountryOpen(false);
        }}
        onClose={() => setCountryOpen(false)}
        language={language}
        title={tr('onboarding.country')}
        closeLabel={tr('common.close')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 8,
    gap: 6,
  },
  back: { width: 44, height: 44 },
  progress: { flex: 1, minWidth: 0, height: 44, justifyContent: 'center' },
  togglePlaceholder: { width: 4 },
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  support: { marginTop: 10 },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  countryChip: {
    height: 48,
    minWidth: 44,
    borderWidth: 1,
    marginBottom: 6,
    paddingLeft: 14,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneField: { flex: 1, minWidth: 0 },
  choices: { gap: 12 },
  cta: { paddingHorizontal: 20, paddingTop: 8, gap: 2 },
  notice: { borderWidth: 1.5, padding: 12, marginBottom: 10 },
});
