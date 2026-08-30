import React from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Bluetooth, ExternalLink } from 'lucide-react-native';

import { RobotPairSheetTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BluetoothStatusBannerProps = {
  title?: string;
  subtitle?: string;
  onOpenSettings?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_TITLE = 'Bluetooth & Proximity';
const DEFAULT_SUBTITLE =
  "Ensure your phone's Bluetooth is turned on and your Joy robot is within 5 meters.";

export function BluetoothStatusBanner({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  onOpenSettings,
  style,
  testID = 'bluetooth-status-banner',
}: BluetoothStatusBannerProps) {
  const theme = useTheme();

  const handleOpenSettings = () => {
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      void Linking.openSettings();
    }
  };

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: theme.cardBackgroundSubtle ?? theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: `${theme.linkPrimary}18` },
          ]}
        >
          <Bluetooth size={Tokens.banner.iconSize} color={theme.linkPrimary} />
        </View>
        <View style={styles.textBox}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.actionButton,
          { borderColor: theme.border },
          pressed && { opacity: 0.7 },
        ]}
        onPress={handleOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="Open phone Bluetooth settings"
        testID={`${testID}-settings-btn`}
      >
        <Text style={[styles.actionText, { color: theme.linkPrimary }]}>
          Open Phone Settings
        </Text>
        <ExternalLink size={13} color={theme.linkPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    borderRadius: Tokens.banner.borderRadius,
    borderWidth: 1,
    paddingHorizontal: Tokens.banner.paddingHorizontal,
    paddingVertical: Tokens.banner.paddingVertical,
    gap: Tokens.banner.gap,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBox: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
