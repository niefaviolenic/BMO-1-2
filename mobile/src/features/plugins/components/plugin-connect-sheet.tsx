import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { AuthTokens } from '@/constants/theme';
import { PluginConnectLogosRow } from './plugin-connect-logos-row';
import { PluginPolicyContainer } from './plugin-policy-container';
export type PluginConnectSheetProps = {
  /** Whether the connect sheet is visible */
  isVisible: boolean;
  /** Callback fired when sheet is closed */
  onClose: () => void;
  /** Callback fired when user presses setup connection button */
  onConnect?: () => void;
  /** Title/Name of the plugin (e.g. "WhatsApp", "Adobe") */
  pluginTitle?: string;
  /** Optional custom React node for plugin logo */
  pluginLogo?: React.ReactNode;
  /** Custom container style override */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing */
  testID?: string;
};

export function PluginConnectSheet({
  isVisible,
  onClose,
  onConnect,
  pluginTitle = 'WhatsApp',
  pluginLogo,
  style,
  testID = 'plugin-connect-sheet',
}: PluginConnectSheetProps) {
  const theme = useTheme();

  const handleSetupConnection = () => {
    onConnect?.();
    onClose();
  };

  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClose}
      testID={testID}
      closeButtonTestID={`${testID}-close-button`}
      disableScrollView
      fitContent
    >
      <View style={[styles.container, style]} testID={`${testID}-content`}>
        {/* Top Logos Row */}
        <View style={styles.logosWrapper} testID={`${testID}-logos-wrapper`}>
          <PluginConnectLogosRow pluginLogo={pluginLogo} testID={`${testID}-logos-row`} />
        </View>

        {/* Title */}
        <View style={styles.titleWrapper} testID={`${testID}-title-wrapper`}>
          <Text style={[styles.titleText, { color: theme.textTitle }]} testID={`${testID}-title`}>
            Connect {pluginTitle}
          </Text>
        </View>

        {/* Policy Section */}
        <View style={styles.policyWrapper} testID={`${testID}-policy-wrapper`}>
          <PluginPolicyContainer testID={`${testID}-policy-container`} />
        </View>

        {/* Action Container with Full-Width Divider & Primary Button */}
        <View style={styles.actionContainer} testID={`${testID}-action-container`}>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} testID={`${testID}-divider`} />
          <View style={styles.buttonWrapper}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.text },
                pressed && styles.buttonPressed,
              ]}
              onPress={handleSetupConnection}
              accessibilityRole="button"
              accessibilityLabel={`Setup ${pluginTitle} Connection`}
              testID={`${testID}-setup-button`}
            >
              <Text style={[styles.primaryButtonText, { color: theme.background }]} testID={`${testID}-setup-button-text`}>
                Setup {pluginTitle} Connection
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  logosWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D0D0D',
    textAlign: 'center',
    lineHeight: 24,
  },
  policyWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  actionContainer: {
    width: '100%',
    gap: 16,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5EBF0',
    marginHorizontal: -AuthTokens.spacing.sheetPaddingHorizontal,
  },
  buttonWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    height: 52,
    borderRadius: 999,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
