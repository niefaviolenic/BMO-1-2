import { Image } from 'expo-image';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { RobotHeroCardTokens as Tokens } from '@/constants/theme';

export type RobotHeroCardProps = {
  /** Title text for the Joy physical robot card. Defaults to "Connect Your Joy Robot". */
  title?: string;
  /** Subtitle description explaining Joy physical capabilities. Defaults to "Bring your AI assistant into physical reality...". */
  description?: string;
  /** Optional custom icon / artwork override. Defaults to the Joy character SVG artwork. */
  icon?: React.ReactNode;
  /** Custom style overrides for the card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_TITLE = 'Connect Your Joy Robot';
const DEFAULT_DESCRIPTION =
  'Bring your AI assistant into physical reality with expressiveness, voice interaction, & smart notifications.';

export function RobotHeroCard({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  icon,
  style,
  testID = 'robot-hero-card',
}: RobotHeroCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.contentStack}>
        {/* Top Icon Box */}
        <View style={[styles.iconBox, { backgroundColor: theme.backgroundElement }]}>
          {icon ?? (
            <Image
              source={require('@/assets/images/ui/icon-joy-robot.svg')}
              style={styles.iconImage}
              contentFit="contain"
              accessibilityLabel="Joy Robot Character"
            />
          )}
        </View>

        {/* Text Stack */}
        <View style={styles.textStack}>
          <Text style={[styles.title, { color: theme.text }]} testID={`${testID}-title`}>
            {title}
          </Text>
          <Text style={[styles.description, { color: theme.textSecondary }]} testID={`${testID}-description`}>
            {description}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: Tokens.layout.width,
    borderRadius: Tokens.layout.borderRadius,
    borderWidth: Tokens.layout.borderWidth,
    paddingHorizontal: Tokens.layout.paddingHorizontal,
    paddingVertical: Tokens.layout.paddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentStack: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Tokens.layout.innerGap,
    width: '100%',
  },
  iconBox: {
    width: Tokens.layout.iconBoxSize,
    height: Tokens.layout.iconBoxSize,
    borderRadius: Tokens.layout.iconBoxRadius,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: {
    width: Tokens.layout.iconSize,
    height: Tokens.layout.iconSize,
  },
  textStack: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    maxWidth: Tokens.layout.descriptionWidth,
  },
  title: {
    fontSize: Tokens.typography.title.fontSize,
    fontWeight: Tokens.typography.title.fontWeight,
    lineHeight: Tokens.typography.title.lineHeight,
    textAlign: 'center',
  },
  description: {
    fontSize: Tokens.typography.description.fontSize,
    fontWeight: Tokens.typography.description.fontWeight,
    lineHeight: Tokens.typography.description.lineHeight,
    textAlign: 'center',
  },
});
