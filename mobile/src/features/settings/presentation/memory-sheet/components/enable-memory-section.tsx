import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';


import { useTheme } from '@/hooks/use-theme';
import { Toggle } from '@/components/ui/toggle';
import { SettingsTokens } from '@/constants/theme';

const tokens = SettingsTokens.memorySheet;

export type EnableMemorySectionProps = {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  onLearnMorePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const CAPTION =
  'Joy remembers details from your chats to personalize responses.';

export function EnableMemorySection({
  value = true,
  onValueChange,
  onLearnMorePress,
  style,
  testID = 'enable-memory-section',
}: EnableMemorySectionProps) {
  const theme = useTheme();

  return (
    <View style={[styles.section, style]} testID={testID}>
      <View
        style={[styles.card, { backgroundColor: theme.cardBackground }]}
        testID={`${testID}-card`}
      >
        <Text
          style={[styles.label, { color: theme.text }]}
          numberOfLines={1}
          testID={`${testID}-label`}
        >
          Enable memory
        </Text>
        <Toggle
          value={value}
          onValueChange={onValueChange}
          testID={`${testID}-toggle`}
        />
      </View>
      <View style={styles.captionFrame}>
        <Text
          style={[styles.caption, { color: theme.textSecondary }]}
          testID={`${testID}-caption`}
        >
          {CAPTION}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    gap: tokens.sectionGap,
  },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.cardBackground,
    borderRadius: tokens.enableCardRadius,
    paddingHorizontal: tokens.enableCardPaddingHorizontal,
    paddingVertical: tokens.enableCardPaddingVertical,
    overflow: 'hidden',
  },
  label: {
    fontSize: tokens.labelFontSize,
    fontWeight: '400',
    color: tokens.labelColor,
  },
  captionFrame: {
    width: '100%',
    paddingHorizontal: tokens.captionPaddingHorizontal,
  },
  caption: {
    fontSize: tokens.captionFontSize,
    fontWeight: '400',
    color: tokens.captionColor,
  },

});
