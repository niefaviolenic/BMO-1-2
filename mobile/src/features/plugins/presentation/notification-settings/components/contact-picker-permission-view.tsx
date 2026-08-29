import { Users } from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { DeviceContactPickerTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export interface ContactPickerPermissionViewProps {
  isDenied?: boolean;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
  onManualInputPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ContactPickerPermissionView({
  isDenied = false,
  onRequestPermission,
  onOpenSettings,
  onManualInputPress,
  style,
  testID = 'contact-picker-permission-view',
}: ContactPickerPermissionViewProps) {
  const theme = useTheme();
  const accentColor = theme.accentPrimary ?? theme.linkPrimary;

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={[styles.iconCircle, { backgroundColor: `${accentColor}1A` }]}>
        <Users size={32} color={accentColor} />
      </View>
      <Text style={[styles.titleText, { color: theme.textTitle }]}>Contact Access Needed</Text>

      <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>
        Allow Joy to access your contacts to easily choose who can trigger Joy Robot voice and animations.
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: accentColor },
          pressed && styles.buttonPressed,
        ]}
        onPress={isDenied ? onOpenSettings : onRequestPermission}
        accessibilityRole="button"
        testID={`${testID}-action-button`}
      >
        <Text style={styles.primaryButtonText}>
          {isDenied ? 'Open Settings' : 'Allow Access'}
        </Text>
      </Pressable>

      {onManualInputPress && (
        <Pressable
          style={styles.manualButton}
          onPress={onManualInputPress}
          accessibilityRole="button"
          testID={`${testID}-manual-button`}
        >
          <Text style={[styles.manualButtonText, { color: accentColor }]}>Enter phone number manually</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '600',
    color: Tokens.colors.nameText,
    textAlign: 'center',
  },
  descriptionText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: Tokens.colors.phoneText,
    textAlign: 'center',
    maxWidth: 280,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  manualButton: {
    marginTop: 8,
    padding: 8,
  },
  manualButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
