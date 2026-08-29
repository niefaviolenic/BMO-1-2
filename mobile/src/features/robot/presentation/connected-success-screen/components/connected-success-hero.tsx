import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ConnectedSuccessHeroTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { RobotDeviceStatusCard } from '@/features/robot/components';
export type ConnectedSuccessHeroProps = {
  /** Heading title. Defaults to "Joy Robot Connected!". */
  title?: string;
  /** Subtitle description text shown below title. */
  subtitle?: string;
  /** Physical robot device name. Defaults to "Joy Robot". */
  deviceName?: string;
  /** Connection status indicator text. Defaults to "Paired & Ready". */
  deviceStatus?: string;
  /** Optional custom avatar source override for the device card. */
  deviceAvatarSource?: any;
  /** Custom style overrides for the outer container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_TITLE = 'Joy Robot Connected!';
const DEFAULT_SUBTITLE =
  'Your Joy Robot device is successfully connected and ready to interact, speak, and deliver smart notifications.';
const DEFAULT_DEVICE_NAME = 'Joy Robot';
const DEFAULT_DEVICE_STATUS = 'Paired & Ready';

/**
 * ConnectedSuccessHero
 *
 * Hero block displayed on Step 3 - Connected Success screen during Joy Robot pairing.
 * Features a green success checkmark badge icon, bold title, descriptive subtitle,
 * and a device status card at the bottom.
 *
 * Width 354 · Height ~480
 */
export function ConnectedSuccessHero({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  deviceName = DEFAULT_DEVICE_NAME,
  deviceStatus = DEFAULT_DEVICE_STATUS,
  deviceAvatarSource,
  style,
  testID = 'connected-success-hero',
}: ConnectedSuccessHeroProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Success Checkmark Badge */}
      <View style={styles.outerRing} testID={`${testID}-outer-ring`}>
        <View style={styles.innerCircle} testID={`${testID}-inner-circle`}>
          <Text style={styles.checkmark} testID={`${testID}-checkmark`}>
            ✓
          </Text>
        </View>
      </View>

      {/* Heading Title */}
      <Text
        style={[styles.title, { color: theme.text }]}
        numberOfLines={2}
        testID={`${testID}-title`}
      >
        {title}
      </Text>

      {/* Subtitle Description */}
      <Text
        style={[styles.subtitle, { color: theme.textSecondary }]}
        testID={`${testID}-subtitle`}
      >
        {subtitle}
      </Text>
      {/* Device Status Card */}
      <View style={styles.cardWrapper} testID={`${testID}-card-wrapper`}>
        <RobotDeviceStatusCard
          name={deviceName}
          status={deviceStatus}
          avatarSource={deviceAvatarSource}
          testID={`${testID}-device-status-card`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: Tokens.layout.width,
    alignItems: 'center',
  },
  outerRing: {
    width: Tokens.layout.outerRingSize,
    height: Tokens.layout.outerRingSize,
    borderRadius: Tokens.layout.outerRingRadius,
    backgroundColor: Tokens.colors.outerRingBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Tokens.layout.marginTopIcon,
  },
  innerCircle: {
    width: Tokens.layout.innerCircleSize,
    height: Tokens.layout.innerCircleSize,
    borderRadius: Tokens.layout.innerCircleRadius,
    backgroundColor: Tokens.colors.innerCircleBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: Tokens.typography.checkmark.fontSize,
    fontWeight: Tokens.typography.checkmark.fontWeight,
    lineHeight: Tokens.typography.checkmark.lineHeight,
    color: Tokens.colors.checkmarkColor,
    textAlign: 'center',
  },
  title: {
    marginTop: Tokens.layout.gapIconToTitle,
    fontSize: Tokens.typography.title.fontSize,
    fontWeight: Tokens.typography.title.fontWeight,
    lineHeight: Tokens.typography.title.lineHeight,
    color: Tokens.colors.title,
    textAlign: 'center',
    width: '100%',
  },
  subtitle: {
    marginTop: Tokens.layout.gapTitleToSubtitle,
    fontSize: Tokens.typography.subtitle.fontSize,
    fontWeight: Tokens.typography.subtitle.fontWeight,
    lineHeight: Tokens.typography.subtitle.lineHeight,
    color: Tokens.colors.subtitle,
    textAlign: 'center',
    maxWidth: Tokens.layout.subtitleMaxWidth,
    width: '100%',
  },
  cardWrapper: {
    marginTop: Tokens.layout.gapSubtitleToCard,
    width: '100%',
  },
});
