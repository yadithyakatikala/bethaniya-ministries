import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamilies, useTheme } from '../../../theme';
import type { LanguagePreference } from '../../../services/firebase/userProfile';

/**
 * EN | తె -- the app starts in English, but the language question is the
 * LAST of the five. Somebody who reads Telugu should not have to wade
 * through four questions in a language they did not choose to find the
 * switch, so it is in the header from the first screen.
 *
 * It changes the language the QUESTIONS are shown in and the one saved at
 * the end; nothing else about the app moves until then.
 */
export function LanguageToggle({
  language,
  onChange,
  label,
}: {
  language: LanguagePreference;
  onChange: (next: LanguagePreference) => void;
  label: string;
}) {
  const { colors } = useTheme();
  const options: {
    value: LanguagePreference;
    text: string;
    name: string;
    size: number;
  }[] = [
    { value: 'en', text: 'EN', name: 'English', size: 12 },
    { value: 'te', text: 'తె', name: 'తెలుగు', size: 14 },
  ];
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.pill, { borderColor: colors.borderStrong }]}
      testID="onboarding-lang"
    >
      {options.map((option) => {
        const active = option.value === language;
        return (
          <Pressable
            key={option.value}
            testID={`onboarding-lang-${option.value}`}
            accessibilityRole="radio"
            accessibilityLabel={option.name}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            // The pill is 32 high; the touch target is not.
            hitSlop={{ top: 6, bottom: 6 }}
            style={[
              styles.option,
              { backgroundColor: active ? colors.primaryTint : 'transparent' },
            ]}
          >
            <Text
              style={{
                fontFamily: fontFamilies.interfaceSemiBold,
                fontSize: option.size,
                lineHeight: 18,
                color: active ? colors.ink : colors.inkMuted,
              }}
            >
              {option.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    marginLeft: 4,
  },
  option: {
    minWidth: 44,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
