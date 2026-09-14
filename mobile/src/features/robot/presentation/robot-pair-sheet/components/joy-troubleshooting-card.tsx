import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { HelpCircle, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';

export interface JoyTroubleshootingCardProps {
  onRescan: () => void;
  isScanning?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const TROUBLESHOOT_STEPS = [
  {
    number: 1,
    title: 'Ensure Joy is Powered On',
    desc: 'Verify that the screen or LED ring is glowing. If battery is flat, plug in USB-C.',
  },
  {
    number: 2,
    title: 'Enter Pairing Mode',
    desc: 'Hold the top capacitive sensor for 5 seconds until you see the Bluetooth pairing screen.',
  },
  {
    number: 3,
    title: 'Keep Joy Close',
    desc: 'Keep Joy within 3 meters (10 feet) of your smartphone during pairing.',
  },
];

export function JoyTroubleshootingCard({
  onRescan,
  isScanning = false,
  style,
  testID = 'joy-troubleshooting-card',
}: JoyTroubleshootingCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.border,
          backgroundColor: theme.cardBackground,
        },
        style,
      ]}
      testID={testID}
      accessibilityLabel="Troubleshooting guide for Joy pairing"
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.iconWrapper, { backgroundColor: theme.cardBackgroundSubtle }]}>
          <HelpCircle size={16} color={theme.textMuted} />
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Can&apos;t find your Joy Robot?
        </Text>
      </View>

      {/* Steps list */}
      <View style={styles.stepsContainer}>
        {TROUBLESHOOT_STEPS.map((step) => (
          <View key={step.number} style={styles.stepItem}>
            <View
              style={[
                styles.stepBadge,
                { backgroundColor: theme.cardBackgroundSubtle },
              ]}
            >
              <Text style={[styles.stepNumber, { color: theme.textSecondary }]}>
                {step.number}
              </Text>
            </View>
            <View style={styles.stepTextContent}>
              <Text style={[styles.stepTitle, { color: theme.text }]}>
                {step.title}
              </Text>
              <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>
                {step.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Action button */}
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.rescanButton,
            {
              backgroundColor: theme.buttonPrimaryBackground,
            },
            pressed && { opacity: 0.8 },
          ]}
          onPress={onRescan}
          accessibilityRole="button"
          accessibilityLabel={isScanning ? 'Refreshing scan...' : 'Scan again for nearby Joy beacons'}
          testID={`${testID}-rescan-btn`}
        >
          <RefreshCw
            size={14}
            color={theme.buttonPrimaryText}
            style={isScanning ? styles.rotatingIcon : undefined}
          />
          <Text style={[styles.rescanButtonText, { color: theme.buttonPrimaryText }]}>
            {isScanning ? 'Scanning... (Tap to refresh)' : 'Scan Again'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  stepsContainer: {
    gap: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
  stepTextContent: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  stepDesc: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  rescanButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  rescanButtonText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  rotatingIcon: {
    opacity: 0.8,
  },
});
