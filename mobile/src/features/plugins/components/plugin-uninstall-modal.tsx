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
import { PluginUninstallModalTokens } from '@/constants/theme';

export type PluginUninstallModalProps = {
  /** Controls whether the modal is visible. */
  visible: boolean;
  /** Name of the plugin to uninstall. Defaults to "WhatsApp". */
  pluginName?: string;
  /** Callback fired when the "Remove" button is pressed. */
  onConfirm?: () => void;
  /** Callback fired when the backdrop is pressed (cancel intent). */
  onCancel?: () => void;
  /** Disables confirm while uninstall is in flight. */
  isBusy?: boolean;
  /** Custom style overrides for the card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function PluginUninstallModal({
  visible,
  pluginName = 'WhatsApp',
  onConfirm,
  onCancel,
  isBusy = false,
  style,
  testID = 'plugin-uninstall-modal',
}: PluginUninstallModalProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isBusy ? undefined : onCancel}
      statusBarTranslucent
      testID={testID}
    >
      <Pressable
        style={styles.backdrop}
        onPress={isBusy ? undefined : onCancel}
        testID={`${testID}-backdrop`}
        accessibilityLabel="Dismiss"
      >
        {/* Stop propagation so taps inside the card don't close the modal */}
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.modalBackground,
              borderColor: theme.border,
            },
            style,
          ]}
          testID={`${testID}-card`}
          accessibilityViewIsModal
        >
          {/* Title */}
          <Text
            style={[styles.titleText, { color: theme.textTitle }]}
            testID={`${testID}-title`}
          >
            Remove {pluginName}
          </Text>

          {/* Description */}
          <Text
            style={[styles.descriptionText, { color: theme.textSecondary }]}
            testID={`${testID}-description`}
          >
            Removing this plugin also removes its skills from Joy
          </Text>
          {/* Remove Button */}
          <Pressable
            style={({ pressed }) => [
              styles.removeButton,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                borderWidth: 1,
              },
              pressed && styles.removeButtonPressed,
            ]}
            onPress={isBusy ? undefined : onConfirm}
            disabled={isBusy}
            testID={`${testID}-confirm-btn`}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${pluginName}`}
            accessibilityState={{ disabled: isBusy, busy: isBusy }}
          >
            <Text style={styles.removeButtonText}>{isBusy ? 'Removing…' : 'Remove'}</Text>
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
  },
  card: {
    width: PluginUninstallModalTokens.width,
    minHeight: PluginUninstallModalTokens.height,
    backgroundColor: PluginUninstallModalTokens.colors.background,
    borderRadius: PluginUninstallModalTokens.borderRadius,
    padding: PluginUninstallModalTokens.padding,
    gap: PluginUninstallModalTokens.gap,
    shadowColor: PluginUninstallModalTokens.shadowColor,
    shadowOffset: PluginUninstallModalTokens.shadowOffset,
    shadowOpacity: PluginUninstallModalTokens.shadowOpacity,
    shadowRadius: PluginUninstallModalTokens.shadowRadius,
    elevation: PluginUninstallModalTokens.elevation,
  },
  titleText: {
    fontSize: PluginUninstallModalTokens.typography.title.fontSize,
    fontWeight: PluginUninstallModalTokens.typography.title.fontWeight,
    color: PluginUninstallModalTokens.colors.titleText,
    lineHeight: 22,
  },
  descriptionText: {
    fontSize: PluginUninstallModalTokens.typography.description.fontSize,
    fontWeight: PluginUninstallModalTokens.typography.description.fontWeight,
    color: PluginUninstallModalTokens.colors.descriptionText,
    lineHeight: 16,
    flexShrink: 1,
  },
  removeButton: {
    height: PluginUninstallModalTokens.button.height,
    borderRadius: PluginUninstallModalTokens.button.borderRadius,
    backgroundColor: PluginUninstallModalTokens.colors.buttonBackground,
    paddingHorizontal: PluginUninstallModalTokens.button.paddingHorizontal,
    paddingVertical: PluginUninstallModalTokens.button.paddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonPressed: {
    opacity: 0.75,
  },
  removeButtonText: {
    fontSize: PluginUninstallModalTokens.typography.button.fontSize,
    fontWeight: PluginUninstallModalTokens.typography.button.fontWeight,
    color: PluginUninstallModalTokens.colors.buttonText,
  },
});
