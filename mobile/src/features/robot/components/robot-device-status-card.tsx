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
import { RobotDeviceStatusCardTokens as Tokens } from '@/constants/theme';

export type RobotDeviceStatusCardProps = {
  /** Name of the physical robot device. Defaults to "Joy Robot". */
  name?: string;
  /** Current connection status indicator text. Defaults to "Paired & Ready". */
  status?: string;
  /** Optional custom avatar source override. Defaults to Joy character icon artwork. */
  avatarSource?: any;
  /** Custom style overrides for the card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_NAME = 'Joy Robot';
const DEFAULT_STATUS = 'Paired & Ready';

export function RobotDeviceStatusCard({
  name = DEFAULT_NAME,
  status = DEFAULT_STATUS,
  avatarSource,
  style,
  testID = 'robot-device-status-card',
}: RobotDeviceStatusCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.leftSection}>
        <View style={[styles.avatarBox, { backgroundColor: theme.backgroundElement }]}>
          <Image
            source={avatarSource ?? require('@/assets/images/ui/icon-joy-robot.svg')}
            style={styles.avatarImage}
            contentFit="contain"
            accessibilityLabel={`${name} avatar`}
          />
        </View>
        <Text style={[styles.nameText, { color: theme.text }]} testID={`${testID}-name`}>
          {name}
        </Text>
      </View>

      <View style={styles.statusPill}>
        <Text style={styles.statusText} testID={`${testID}-status`}>
          {status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    maxWidth: Tokens.layout.width,
    height: Tokens.layout.height,
    borderRadius: Tokens.layout.borderRadius,
    borderWidth: Tokens.layout.borderWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Tokens.layout.paddingHorizontal,
    paddingVertical: Tokens.layout.paddingVertical,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Tokens.layout.gap,
    flex: 1,
    minWidth: 0,
  },
  avatarBox: {
    width: Tokens.layout.avatarSize,
    height: Tokens.layout.avatarSize,
    borderRadius: Tokens.layout.avatarRadius,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: Tokens.layout.avatarSize - 8,
    height: Tokens.layout.avatarSize - 8,
  },
  nameText: {
    fontSize: Tokens.typography.title.fontSize,
    fontWeight: Tokens.typography.title.fontWeight,
    lineHeight: Tokens.typography.title.lineHeight,
    flexShrink: 1,
  },
  statusPill: {
    backgroundColor: Tokens.colors.statusPillBackground,
    paddingHorizontal: Tokens.layout.statusPillPaddingHorizontal,
    borderRadius: Tokens.layout.statusPillRadius,
    height: Tokens.layout.statusPillHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: Tokens.typography.statusPill.fontSize,
    fontWeight: Tokens.typography.statusPill.fontWeight,
    lineHeight: Tokens.typography.statusPill.lineHeight,
    color: Tokens.colors.statusPillText,
  },
});
