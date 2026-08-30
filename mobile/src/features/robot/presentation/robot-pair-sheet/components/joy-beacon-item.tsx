import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Bluetooth, ChevronRight, Signal } from 'lucide-react-native';

import { RobotPairSheetTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiscoveredJoy } from '@/features/robot/data/provisioning-flow';

export type JoyBeaconItemProps = {
  joy: DiscoveredJoy;
  onPress: (joy: DiscoveredJoy) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function JoyBeaconItem({
  joy,
  onPress,
  style,
  testID = 'joy-beacon-item',
}: JoyBeaconItemProps) {
  const theme = useTheme();

  const getSignalLabel = (rssi: number) => {
    if (rssi >= -50) return 'Very Strong Signal';
    if (rssi >= -65) return 'Good Signal';
    if (rssi >= -80) return 'Moderate Signal';
    return 'Weak Signal';
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: theme.border,
          backgroundColor: theme.cardBackground,
        },
        pressed && styles.cardPressed,
        style,
      ]}
      onPress={() => onPress(joy)}
      accessibilityRole="button"
      accessibilityLabel={`Connect to ${joy.name}`}
      testID={testID}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: `${theme.linkPrimary}18` },
        ]}
      >
        <Bluetooth size={20} color={theme.linkPrimary} />
      </View>

      <View style={styles.infoBox}>
        <View style={styles.nameRow}>
          <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
            {joy.name}
          </Text>
          <View
            style={[
              styles.refBadge,
              { backgroundColor: theme.surfaceSubtle ?? `${theme.text}0C` },
            ]}
          >
            <Text style={[styles.refText, { color: theme.textSecondary }]}>
              {joy.provisioningRef}
            </Text>
          </View>
        </View>

        <View style={styles.signalRow}>
          <Signal size={12} color={theme.linkPrimary} />
          <Text style={[styles.subText, { color: theme.textSecondary }]}>
            {getSignalLabel(joy.rssi)} • {joy.rssi} dBm
          </Text>
        </View>
      </View>

      <ChevronRight size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Tokens.beaconCard.borderRadius,
    borderWidth: 1,
    padding: Tokens.beaconCard.padding,
    gap: Tokens.beaconCard.gap,
  },
  cardPressed: {
    opacity: 0.8,
  },
  iconBox: {
    width: Tokens.beaconCard.iconBoxSize,
    height: Tokens.beaconCard.iconBoxSize,
    borderRadius: Tokens.beaconCard.iconBoxRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
  },
  refBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  refText: {
    fontSize: 11,
    fontWeight: '500',
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subText: {
    fontSize: 12,
  },
});
