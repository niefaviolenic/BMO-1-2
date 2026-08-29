import { Bell, BellOff, Trash2 } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
export interface AllowedContactRowProps {
  name: string;
  phoneNumber: string;
  avatarText?: string;
  avatarColor?: string;
  accentColor?: string;
  notifyVoiceEnabled?: boolean;
  isTogglingNotifyVoice?: boolean;
  isDeleting?: boolean;
  onToggleNotifyVoice?: (enabled: boolean) => void;
  onDelete?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}
export const AllowedContactRowTokens = {
  layout: {
    width: 370,
    height: 52,
    paddingHorizontal: 16,
    avatarSize: 34,
    iconSize: 18,
    actionButtonPadding: 6,
  },
  colors: {
    background: '#FFFFFF',
    avatarBg: '#F1F5F9',
    avatarText: '#FFFFFF',
    nameText: '#0F1729',
    phoneText: '#80808C',
    bellActive: '#007AFF',
    bellActiveBg: 'rgba(0, 122, 255, 0.1)',
    bellInactive: '#80808C',
    trashIcon: '#80808C',
    trashIconPressed: '#E5484D',
  },
} as const;

export function AllowedContactRow({
  name = 'Adik',
  phoneNumber = '+62 857-1234-5678',
  avatarText,
  avatarColor,
  accentColor,
  notifyVoiceEnabled = false,
  isTogglingNotifyVoice = false,
  isDeleting = false,
  onToggleNotifyVoice,
  onDelete,
  style,
  testID = 'allowed-contact-row',
}: AllowedContactRowProps) {
  const theme = useTheme();
  const initial = avatarText || (name ? name.charAt(0).toUpperCase() : 'C');
  const activeAccent =
    accentColor ??
    theme.accentPrimary ??
    theme.linkPrimary ??
    AllowedContactRowTokens.colors.bellActive;
  const activeBg = `${activeAccent}1A`;
  const isActionDisabled = isTogglingNotifyVoice || isDeleting;
  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground }, style]} testID={testID}>
      <View style={styles.leftGroup}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: avatarColor ?? AllowedContactRowTokens.colors.avatarBg },
          ]}
          testID={`${testID}-avatar`}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.textColumn}>
          <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1} testID={`${testID}-name`}>
            {name}
          </Text>
          <Text style={[styles.phoneText, { color: theme.textSecondary }]} numberOfLines={1} testID={`${testID}-phone`}>
            {phoneNumber}
          </Text>
        </View>
      </View>
      <View style={styles.actionsGroup}>
        <Pressable
          onPress={() => onToggleNotifyVoice?.(!notifyVoiceEnabled)}
          disabled={isActionDisabled}
          style={({ pressed }) => [
            styles.actionButton,
            notifyVoiceEnabled && { backgroundColor: activeBg },
            pressed && !isActionDisabled && styles.actionButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            notifyVoiceEnabled
              ? `Mute voice alerts for ${name}`
              : `Enable voice alerts for ${name}`
          }
          testID={`${testID}-bell-button`}
        >
          {isTogglingNotifyVoice ? (
            <ActivityIndicator
              size="small"
              color={notifyVoiceEnabled ? activeAccent : AllowedContactRowTokens.colors.bellInactive}
              testID={`${testID}-bell-spinner`}
            />
          ) : notifyVoiceEnabled ? (
            <Bell
              size={AllowedContactRowTokens.layout.iconSize}
              color={activeAccent}
            />
          ) : (
            <BellOff
              size={AllowedContactRowTokens.layout.iconSize}
              color={AllowedContactRowTokens.colors.bellInactive}
            />
          )}
        </Pressable>

        <Pressable
          onPress={onDelete}
          disabled={isActionDisabled}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && !isActionDisabled && styles.deleteButtonPressed,
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name} from allowed contacts`}
          testID={`${testID}-delete-button`}
        >
          {isDeleting ? (
            <ActivityIndicator
              size="small"
              color={AllowedContactRowTokens.colors.trashIcon}
              testID={`${testID}-delete-spinner`}
            />
          ) : ({ pressed }) => (
            <Trash2
              size={AllowedContactRowTokens.layout.iconSize}
              color={
                pressed
                  ? AllowedContactRowTokens.colors.trashIconPressed
                  : AllowedContactRowTokens.colors.trashIcon
              }
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: AllowedContactRowTokens.layout.width,
    maxWidth: '100%',
    height: AllowedContactRowTokens.layout.height,
    backgroundColor: AllowedContactRowTokens.colors.background,
    paddingHorizontal: AllowedContactRowTokens.layout.paddingHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: AllowedContactRowTokens.layout.avatarSize,
    height: AllowedContactRowTokens.layout.avatarSize,
    borderRadius: AllowedContactRowTokens.layout.avatarSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: AllowedContactRowTokens.colors.avatarText,
  },
  textColumn: {
    flex: 1,
    gap: 1,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '600',
    color: AllowedContactRowTokens.colors.nameText,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '400',
    color: AllowedContactRowTokens.colors.phoneText,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: AllowedContactRowTokens.layout.actionButtonPadding,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  actionButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  bellActiveButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
  },
  deleteButtonPressed: {
    backgroundColor: 'rgba(229, 72, 77, 0.1)',
  },
});
