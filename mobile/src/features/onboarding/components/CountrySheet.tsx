import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Sheet, useTheme, useTypographyFor } from '../../../theme';
import type { LanguagePreference } from '../../../services/firebase/userProfile';
import { COUNTRIES } from '../countries';

/**
 * The country-code picker: a sheet, because choosing one is a choice, not
 * a destination. A short curated list in the language of the questions --
 * a code that is not here can still be typed with its own "+".
 */
export function CountrySheet({
  visible,
  selectedIso,
  onSelect,
  onClose,
  language,
  title,
  closeLabel,
}: {
  visible: boolean;
  selectedIso: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
  language: LanguagePreference;
  title: string;
  closeLabel: string;
}) {
  const { colors } = useTheme();
  const type = useTypographyFor(language);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      closeLabel={closeLabel}
      testID="onboarding-country-sheet"
    >
      <View accessibilityRole="radiogroup" accessibilityLabel={title}>
        {COUNTRIES.map((country) => {
          const selected = country.iso === selectedIso;
          return (
            <Pressable
              key={country.iso}
              testID={`onboarding-country-${country.iso}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${country.name[language]}, +${country.dial}`}
              onPress={() => onSelect(country.iso)}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[type.body, styles.name, { color: colors.ink }]}>
                {country.name[language]}
              </Text>
              <Text style={[type.label, { color: colors.inkMuted }]}>
                +{country.dial}
              </Text>
              <View style={styles.tick}>
                {selected ? (
                  <Svg width={18} height={18} viewBox="0 0 14 14">
                    <Path
                      d="M2.5 7.5l3 3 6-7"
                      fill="none"
                      stroke={colors.accent}
                      strokeWidth={2.3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1 },
  tick: { width: 22, alignItems: 'center' },
});
