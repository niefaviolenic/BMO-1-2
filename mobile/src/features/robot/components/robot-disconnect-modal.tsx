import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { RobotDisconnectModalTokens as Tokens } from '@/constants/theme';

export type RobotDisconnectModalProps = {
  /** Controls whether the modal is visible. */
  visible: boolean;
  /** Callback fired when the Disconnect button is pressed. */
  onConfirm?: () => void;
  /** Callback fired when the backdrop is pressed (cancel intent). */
  onCancel?: () => void;
  /** Custom style overrides for the card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function RobotDisconnectModal({
  visible,
  onConfirm,
  onCancel,
  style,
  testID = 'robot-disconnect-modal',
}: RobotDisconnectModalProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      testID={testID}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        testID={`${testID}-backdrop`}
      >
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
            style,
          ]}
          onPress={(e) => e.stopPropagation()}
          testID={`${testID}-card`}
        >
          <Text style={[styles.titleText, { color: theme.text }]} testID={`${testID}-title`}>
            Disconnect Joy Robot
          </Text>

          <Text style={[styles.descriptionText, { color: theme.textSecondary }]} testID={`${testID}-description`}>
            Are you sure you want to disconnect from this device?
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.disconnectButton,
              pressed && styles.disconnectButtonPressed,
            ]}
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel="Disconnect"
            testID={`${testID}-confirm-button`}
          >
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: Tokens.width,
    minHeight: Tokens.minHeight,
    borderRadius: Tokens.borderRadius,
    borderWidth: 1,
    padding: Tokens.padding,
    alignItems: 'center',
    gap: Tokens.gap,
    shadowColor: Tokens.shadowColor,
    shadowOffset: Tokens.shadowOffset,
    shadowOpacity: Tokens.shadowOpacity,
    shadowRadius: Tokens.shadowRadius,
    elevation: Tokens.elevation,
  },
  titleText: {
    fontSize: Tokens.typography.title.fontSize,
    fontWeight: Tokens.typography.title.fontWeight,
    lineHeight: Tokens.typography.title.lineHeight,
    textAlign: 'center',
  },
  descriptionText: {
    fontSize: Tokens.typography.description.fontSize,
    fontWeight: Tokens.typography.description.fontWeight,
    lineHeight: Tokens.typography.description.lineHeight,
    textAlign: 'center',
  },
  disconnectButton: {
    width: '100%',
    height: 44,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectButtonPressed: {
    opacity: 0.75,
  },
  disconnectButtonText: {
    fontSize: Tokens.typography.button.fontSize,
    fontWeight: Tokens.typography.button.fontWeight,
    color: '#FFFFFF',
  },
});
