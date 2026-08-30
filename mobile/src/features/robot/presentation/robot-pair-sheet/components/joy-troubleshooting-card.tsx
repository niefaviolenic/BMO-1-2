import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { HelpCircle, RefreshCw, Sparkles } from 'lucide-react-native';

import { RobotPairSheetTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type JoyTroubleshootingCardProps = {
  onRescan: () => void;
  onSimulateDemo?: () => void;
  isScanning?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const TROUBLESHOOT_STEPS = [
  {
    number: '1',
    title: 'Turn On Joy Robot',
    desc: "Make sure Joy's indicator light is on and the robot is powered.",
  },
  {
    number: '2',
    title: 'Open Pairing Mode',
    desc: "Hold Joy's touch sensor for 5 seconds until the light pulses blue.",
  },
  {
    number: '3',
    title: 'Ensure Phone Bluetooth is On',
    desc: "Your phone's Bluetooth must be enabled and not in battery saver mode.",
  },
];

export function JoyTroubleshootingCard({
  onRescan,
  onSimulateDemo,
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
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: `${theme.linkPrimary}15` },
          ]}
        >
          <HelpCircle size={18} color={theme.linkPrimary} />
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Joy Not Found Yet?
        </Text>
      </View>

      <View style={styles.stepsContainer}>
        {TROUBLESHOOT_STEPS.map((step) => (
          <View key={step.number} style={styles.stepItem}>
            <View
              style={[
                styles.stepBadge,
                { backgroundColor: theme.surfaceSubtle ?? `${theme.text}10` },
              ]}
            >
              <Text style={[styles.stepNumber, { color: theme.text }]}>
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
          disabled={isScanning}
          accessibilityRole="button"
          accessibilityLabel="Scan again for nearby Joy beacons"
          testID={`${testID}-rescan-btn`}
        >
          <RefreshCw
            size={14}
            color={theme.buttonPrimaryText}
            style={isScanning ? styles.rotatingIcon : undefined}
          />
          <Text style={[styles.rescanButtonText, { color: theme.buttonPrimaryText }]}>
            {isScanning ? 'Scanning...' : 'Scan Again'}
          </Text>
        </Pressable>

        {onSimulateDemo ? (
          <Pressable
            style={({ pressed }) => [
              styles.demoButton,
              {
                borderColor: theme.border,
                backgroundColor: theme.cardBackgroundSubtle ?? theme.cardBackground,
              },
              pressed && { opacity: 0.7 },
            ]}
            onPress={onSimulateDemo}
            accessibilityRole="button"
            accessibilityLabel="Simulate Joy Demo"
            testID={`${testID}-demo-btn`}
          >
            <Sparkles size={14} color={theme.linkPrimary} />
            <Text style={[styles.demoButtonText, { color: theme.text }]}>
              Simulate Joy Demo
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: Tokens.troubleshooting.borderRadius,
    borderWidth: 1,
    padding: Tokens.troubleshooting.padding,
    gap: Tokens.troubleshooting.gap,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  stepsContainer: {
    gap: 10,
    paddingTop: 4,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepBadge: {
    width: Tokens.troubleshooting.badgeSize,
    height: Tokens.troubleshooting.badgeSize,
    borderRadius: Tokens.troubleshooting.badgeRadius,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepTextContent: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  rescanButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  demoButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  rotatingIcon: {
    opacity: 0.8,
  },
});
