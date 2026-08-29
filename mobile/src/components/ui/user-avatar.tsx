import { Image } from 'expo-image';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { AvatarTokens, ProfileHeaderTokens } from '@/constants/theme';
import { getAvatarColor, getInitials } from '@/features/auth/domain/avatar';

export type UserAvatarProps = {
  /** User's display name or username (used for initials and deterministic color). */
  name?: string | null;
  /** Avatar image URL string or require image module. If null/undefined/empty, shows initials. */
  avatarUrl?: string | number | null;
  /** Diameter of the circular avatar in dp/pt. Defaults to ProfileHeaderTokens.avatarSize (80). */
  size?: number;
  /** Border radius of the avatar container. Defaults to size / 2 (circular). */
  radius?: number;
  /** Font size for the initials text. Defaults to size * 0.38. */
  fontSize?: number;
  /** Font weight for the initials text. Defaults to AvatarTokens.fontWeight ('600'). */
  fontWeight?: TextStyle['fontWeight'];
  /** Background color override for the initials circle. Defaults to getAvatarColor(name). */
  backgroundColor?: string;
  /** Text color for the initials text. Defaults to AvatarTokens.textColor (#FFFFFF). */
  textColor?: string;
  /** Style override for the outer avatar circle container. */
  style?: StyleProp<ViewStyle>;
  /** Style override for the image element. */
  imageStyle?: StyleProp<ImageStyle>;
  /** Test identifier. Defaults to 'user-avatar'. */
  testID?: string;
  /** Accessibility label for screen readers. */
  accessibilityLabel?: string;
};

/**
 * Atomic Design Atom: UserAvatar
 *
 * Renders a user's uploaded avatar image, or falls back to a 2-character initials
 * avatar with a deterministic background color based on the user's name.
 */
export function UserAvatar({
  name,
  avatarUrl,
  size = ProfileHeaderTokens.avatarSize,
  radius = size / 2,
  fontSize = Math.round(size * 0.38),
  fontWeight = AvatarTokens.fontWeight,
  backgroundColor,
  textColor = AvatarTokens.textColor,
  style,
  imageStyle,
  testID = 'user-avatar',
  accessibilityLabel,
}: UserAvatarProps) {
  const hasRemoteImage = typeof avatarUrl === 'string' && avatarUrl.trim().length > 0;
  const hasLocalModule = typeof avatarUrl === 'number';
  const hasImage = hasRemoteImage || hasLocalModule;

  const imageSource = hasRemoteImage ? { uri: avatarUrl } : hasLocalModule ? avatarUrl : null;

  const initials = getInitials(name);
  const resolvedBgColor = backgroundColor ?? getAvatarColor(name);
  const resolvedLabel = accessibilityLabel ?? (name ? `${name} avatar` : 'User avatar');

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: hasImage ? 'transparent' : resolvedBgColor,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={resolvedLabel}
    >
      {hasImage && imageSource ? (
        <Image
          source={imageSource}
          style={[styles.image, { borderRadius: radius }, imageStyle]}
          contentFit="cover"
          accessibilityLabel={resolvedLabel}
          testID={`${testID}-image`}
        />
      ) : (
        <Text
          style={[
            styles.initialsText,
            {
              fontSize,
              fontWeight,
              color: textColor,
            },
          ]}
          numberOfLines={1}
          testID={`${testID}-initials`}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initialsText: {
    textAlign: 'center',
    includeFontPadding: false,
    letterSpacing: 0.5,
  },
});
