import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { DeviceContactPickerTokens as Tokens } from '@/constants/theme';
import type { DeviceContact } from '@/features/plugins/domain/device-contacts';

export interface DeviceContactItemRowProps {
  contact: DeviceContact;
  onPress: (contact: DeviceContact) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function DeviceContactItemRow({
  contact,
  onPress,
  style,
  testID = 'device-contact-item-row',
}: DeviceContactItemRowProps) {
  const theme = useTheme();
  const initial = contact.name ? contact.name.charAt(0).toUpperCase() : 'C';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: theme.cardBackground },
        pressed && styles.pressed,
        style,
      ]}
      onPress={() => onPress(contact)}
      accessibilityRole="button"
      accessibilityLabel={`${contact.name}, ${contact.phoneNumber}`}
      testID={testID}
    >
      <View style={styles.leftGroup}>
        <View
          style={[styles.avatar, { backgroundColor: contact.avatarColor }]}
          testID={`${testID}-avatar`}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.textColumn}>
          <Text
            style={[styles.nameText, { color: theme.textTitle }]}
            numberOfLines={1}
            testID={`${testID}-name`}
          >
            {contact.name}
          </Text>
          <Text
            style={[styles.phoneText, { color: theme.textSecondary }]}
            numberOfLines={1}
            testID={`${testID}-phone`}
          >
            {contact.phoneNumber}
          </Text>
        </View>
      </View>

      <ChevronRight size={16} color={theme.iconMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: Tokens.layout.rowHeight,
    paddingHorizontal: Tokens.layout.rowPaddingHorizontal,
    paddingVertical: 10,
    backgroundColor: Tokens.colors.cardBackground,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: Tokens.layout.avatarSize,
    height: Tokens.layout.avatarSize,
    borderRadius: Tokens.layout.avatarRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Tokens.colors.avatarText,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  nameText: {
    fontSize: Tokens.typography.nameText.fontSize,
    fontWeight: Tokens.typography.nameText.fontWeight,
    lineHeight: Tokens.typography.nameText.lineHeight,
    color: Tokens.colors.nameText,
  },
  phoneText: {
    fontSize: Tokens.typography.phoneText.fontSize,
    fontWeight: Tokens.typography.phoneText.fontWeight,
    lineHeight: Tokens.typography.phoneText.lineHeight,
    color: Tokens.colors.phoneText,
  },
});
