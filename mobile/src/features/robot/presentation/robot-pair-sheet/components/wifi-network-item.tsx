import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Check, Lock, Wifi } from 'lucide-react-native';

import { RobotPairSheetTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiscoveredWifiNetwork } from '@/features/robot/data/provisioning-flow';

export type WifiNetworkItemProps = {
  network: DiscoveredWifiNetwork;
  isSelected: boolean;
  onSelect: (network: DiscoveredWifiNetwork) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function WifiNetworkItem({
  network,
  isSelected,
  onSelect,
  style,
  testID = 'wifi-network-item',
}: WifiNetworkItemProps) {
  const theme = useTheme();
  const isSecured = network.security !== 'OPEN';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: isSelected ? theme.linkPrimary : theme.border,
          backgroundColor: isSelected
            ? theme.cardBackgroundSubtle ?? theme.cardBackground
            : theme.cardBackground,
        },
        pressed && styles.cardPressed,
        style,
      ]}
      onPress={() => onSelect(network)}
      accessibilityRole="button"
      accessibilityLabel={`Select Wi-Fi network ${network.ssid}`}
      testID={testID}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: isSelected
              ? `${theme.linkPrimary}20`
              : theme.cardBackgroundSubtle,
          },
        ]}
      >
        <Wifi
          size={18}
          color={isSelected ? theme.linkPrimary : theme.text}
        />
      </View>

      <View style={styles.infoBox}>
        <Text
          style={[
            styles.ssidText,
            {
              color: theme.text,
              fontWeight: isSelected ? '600' : '400',
            },
          ]}
          numberOfLines={1}
        >
          {network.ssid}
        </Text>

        <View style={styles.securityRow}>
          {isSecured ? (
            <Lock size={11} color={theme.textSecondary} />
          ) : null}
          <Text style={[styles.securityText, { color: theme.textSecondary }]}>
            {network.security}
          </Text>
        </View>
      </View>

      {isSelected ? (
        <View
          style={[
            styles.selectedBadge,
            { backgroundColor: theme.linkPrimary },
          ]}
        >
          <Check size={12} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Tokens.wifiCard.borderRadius,
    borderWidth: 1,
    paddingHorizontal: Tokens.wifiCard.paddingHorizontal,
    paddingVertical: Tokens.wifiCard.paddingVertical,
    gap: Tokens.wifiCard.gap,
  },
  cardPressed: {
    opacity: 0.8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    flex: 1,
    gap: 2,
  },
  ssidText: {
    fontSize: 14,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  securityText: {
    fontSize: 11,
  },
  selectedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
