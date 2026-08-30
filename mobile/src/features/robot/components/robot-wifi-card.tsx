import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Wifi, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';
import { RobotTokens } from '@/constants/theme';

export interface RobotWifiCardProps {
  ssid?: string | null;
  status?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function RobotWifiCard({
  ssid = 'Home-WiFi-5G',
  status = 'CONNECTED',
  onPress,
  style,
  testID = 'robot-wifi-card',
}: RobotWifiCardProps) {
  const theme = useTheme();

  const isConnected = status === 'CONNECTED';
  const displaySsid = ssid && ssid.length > 0 ? ssid : 'Not Connected';
  const displayStatus = isConnected
    ? 'Connected'
    : status === 'PENDING' || status === 'APPLYING'
    ? 'Switching...'
    : status === 'ROLLED_BACK'
    ? 'Reverted (Rollback)'
    : 'Offline';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Wi-Fi Network: ${displaySsid}, Status: ${displayStatus}`}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.cardBackgroundSubtle }]}>
        <Wifi size={20} color={isConnected ? theme.accentPrimary : theme.textMuted} strokeWidth={2} />
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {displaySsid}
          </Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isConnected
                  ? 'rgba(34, 197, 94, 0.15)'
                  : status === 'APPLYING' || status === 'PENDING'
                  ? 'rgba(234, 179, 8, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isConnected
                    ? '#22C55E'
                    : status === 'APPLYING' || status === 'PENDING'
                    ? '#EAB308'
                    : '#EF4444',
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color: isConnected
                    ? '#22C55E'
                    : status === 'APPLYING' || status === 'PENDING'
                    ? '#EAB308'
                    : '#EF4444',
                },
              ]}
            >
              {displayStatus}
            </Text>
          </View>
        </View>

        <Text style={[styles.description, { color: theme.textMuted }]}>
          Change Wi-Fi Network (Cloud Remote Switch)
        </Text>
      </View>

      <ChevronRight size={18} color={theme.textMuted} strokeWidth={1.75} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: RobotTokens.optionCard.padding,
    borderRadius: RobotTokens.optionCard.borderRadius,
    borderWidth: 1,
    gap: RobotTokens.optionCard.gap,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
  },
});
