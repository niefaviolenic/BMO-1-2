import { Image } from 'expo-image';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ProfileHeaderTokens } from '@/constants/theme';

export type ProfileHeaderBlockProps = {
  /** User's display name. Defaults to "Rangga Hadi Putra". */
  name?: string;
  /** Avatar image source (URI string or require image module). Defaults to default avatar asset. */
  avatarSource?: string | number;
  /** Callback fired when the edit badge or avatar wrapper is pressed. */
  onEditPress?: () => void;
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
  /** Test identifier. Defaults to "profile-header-block". */
  testID?: string;
};

export function ProfileHeaderBlock({
  name = 'Rangga Hadi Putra',
  avatarSource,
  onEditPress,
  style,
  testID = 'profile-header-block',
}: ProfileHeaderBlockProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Avatar Container with Edit Badge */}
      <View style={styles.avatarWrapper}>
        <UserAvatar
          avatarUrl={avatarSource}
          name={name}
          size={ProfileHeaderTokens.avatarSize}
          testID={`${testID}-avatar`}
        />

        {/* Edit Pencil Badge Button */}
        <Pressable
          onPress={onEditPress}
          accessibilityRole="button"
          accessibilityLabel="Edit Profile Picture"
          hitSlop={6}
          style={({ pressed }) => [
            styles.editBadge,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
            pressed && styles.pressed,
          ]}
          testID={`${testID}-edit-badge`}
        >
          <Image
            source={require('@/assets/images/ui/icon-edit.svg')}
            style={styles.pencilIcon}
            tintColor={theme.icon}
            contentFit="contain"
            accessibilityLabel="Edit Icon"
          />
        </Pressable>
      </View>

      {/* User Display Name */}
      <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1} testID={`${testID}-name`}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: ProfileHeaderTokens.width,
    alignItems: 'center',
    gap: ProfileHeaderTokens.gap,
    paddingTop: 12,
  },
  avatarWrapper: {
    position: 'relative',
    width: ProfileHeaderTokens.avatarSize,
    height: ProfileHeaderTokens.avatarSize,
  },
  pressed: {
    opacity: 0.8,
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: ProfileHeaderTokens.badgeSize,
    height: ProfileHeaderTokens.badgeSize,
    borderRadius: ProfileHeaderTokens.badgeRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  pencilIcon: {
    width: ProfileHeaderTokens.pencilIconSize,
    height: ProfileHeaderTokens.pencilIconSize,
  },
  nameText: {
    fontSize: ProfileHeaderTokens.nameFontSize,
    fontWeight: '600',
    lineHeight: ProfileHeaderTokens.nameLineHeight,
    textAlign: 'center',
  },
});
