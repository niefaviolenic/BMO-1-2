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
import { ConnectedRobotHeroCardTokens as Tokens } from '@/constants/theme';

export type ConnectedRobotHeroCardProps = {
  /** Main title header for the connected robot card. Defaults to "Joy Robot Connected!". */
  title?: string;
  /** Primary status indicator text. Defaults to "Online". */
  status?: string;
  /** Battery level indicator text or value (e.g. "85%" or 85). Defaults to "85%". */
  batteryLevel?: string | number;
  /** Connection / WiFi status indicator text. Defaults to "WiFi Active". */
  wifiStatus?: string;
  /** Description text describing synchronization state. Defaults to "Your Joy physical robot is synchronized & ready to interact, speak, and deliver smart notifications." */
  description?: string;
  /** Optional custom icon / avatar element override. Defaults to the Joy character SVG. */
  icon?: React.ReactNode;
  /** Whether to show the status badge pill (Offline/Online, Battery, WiFi). Defaults to false. */
  showStatusBadge?: boolean;
  /** Custom style overrides for the card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_TITLE = 'Joy Robot Connected!';
const DEFAULT_STATUS = 'Online';
const DEFAULT_BATTERY = '85%';
const DEFAULT_WIFI = 'WiFi Active';
const DEFAULT_DESCRIPTION =
  'Your Joy physical robot is synchronized & ready to interact, speak, and deliver smart notifications.';

export function ConnectedRobotHeroCard({
  title = DEFAULT_TITLE,
  status = DEFAULT_STATUS,
  batteryLevel = DEFAULT_BATTERY,
  wifiStatus = DEFAULT_WIFI,
  description = DEFAULT_DESCRIPTION,
  icon,
  showStatusBadge = false,
  style,
  testID = 'connected-robot-hero-card',
}: ConnectedRobotHeroCardProps) {
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

          {showStatusBadge ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.statusDot} />
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                {`${status} • ${batteryLevel} • ${wifiStatus}`}
              </Text>
            </View>
          ) : null}

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
    gap: Tokens.layout.gap,
    width: '100%',
  },
  iconBox: {
    width: Tokens.layout.avatarBoxSize,
    height: Tokens.layout.avatarBoxSize,
    borderRadius: Tokens.layout.avatarBoxRadius,
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
    gap: 6,
    width: '100%',
  },
  title: {
    fontSize: Tokens.typography.title.fontSize,
    fontWeight: Tokens.typography.title.fontWeight,
    lineHeight: Tokens.typography.title.lineHeight,
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Tokens.layout.badgeGap,
    paddingHorizontal: Tokens.layout.badgePaddingHorizontal,
    paddingVertical: Tokens.layout.badgePaddingVertical,
    borderRadius: Tokens.layout.badgeRadius,
    marginTop: 2,
  },
  statusDot: {
    width: Tokens.layout.pulseOuterSize,
    height: Tokens.layout.pulseOuterSize,
    borderRadius: Tokens.layout.pulseOuterRadius,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: Tokens.typography.statusText.fontSize,
    fontWeight: Tokens.typography.statusText.fontWeight,
    lineHeight: Tokens.typography.statusText.lineHeight,
  },
  description: {
    fontSize: Tokens.typography.description.fontSize,
    fontWeight: Tokens.typography.description.fontWeight,
    lineHeight: Tokens.typography.description.lineHeight,
    textAlign: 'center',
  },
});
