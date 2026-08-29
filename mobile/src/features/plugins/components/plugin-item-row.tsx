import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronRight, MoreHorizontal, Plus, Trash2 } from 'lucide-react-native';

import { useTheme } from '@/hooks/use-theme';

export type PluginItemRowProps = {
  /** The main title of the plugin (e.g., "Adobe (formerly Photoshop)") */
  title: string;
  /** Short description or category summary of the plugin */
  description: string;
  /** Optional custom React node for the left icon */
  icon?: React.ReactNode;
  /** Background color for the 44x44 icon container. Defaults to `#D91F26` */
  iconBgColor?: string;
  /** Type of action button rendered on the right. Defaults to `'add'` */
  actionType?: 'add' | 'chevron' | 'more' | 'trash' | 'custom' | 'loading';
  /** Optional text for fallback icon (e.g. "Ps", "Fg", "Git") */
  fallbackText?: string;
  /** Custom action icon node when actionType is `'custom'` or custom provided */
  actionIcon?: React.ReactNode;
  /** Whether the action button is in a loading state */
  isLoading?: boolean;
  /** Callback fired when the entire row is pressed */
  onPress?: () => void;
  /** Callback fired specifically when the right action icon is pressed */
  onActionPress?: () => void;
  /** Optional container style override */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing */
  testID?: string;
};

export function PluginItemRow({
  title,
  description,
  icon,
  iconBgColor = '#D91F26',
  actionType = 'add',
  fallbackText,
  actionIcon,
  isLoading = false,
  onPress,
  onActionPress,
  style,
  testID = 'plugin-item-row',
}: PluginItemRowProps) {
  const theme = useTheme();

  const renderLeftIcon = () => {
    if (icon) {
      return icon;
    }
    const initials = fallbackText ?? getInitials(title);
    return (
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <Text style={styles.fallbackIconText}>{initials}</Text>
      </View>
    );
  };

  const renderActionIcon = () => {
    if (isLoading || actionType === 'loading') {
      return (
        <ActivityIndicator
          size="small"
          color={theme.accentPrimary ?? theme.textMuted}
          testID={`${testID}-spinner`}
        />
      );
    }

    if (actionIcon) {
      return actionIcon;
    }

    switch (actionType) {
      case 'add':
        return <Plus size={20} color={theme.icon} strokeWidth={2} />;
      case 'chevron':
        return <ChevronRight size={20} color={theme.textMuted} strokeWidth={2} />;
      case 'more':
        return <MoreHorizontal size={20} color={theme.icon} strokeWidth={2} />;
      case 'trash':
        return <Trash2 size={18} color="#EF4444" strokeWidth={2} />;
      case 'custom':
      default:
        return null;
    }
  };

  const handleActionPress = () => {
    if (onActionPress) {
      onActionPress();
    } else if (onPress) {
      onPress();
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${description}`}
      testID={testID}
    >
      {renderLeftIcon()}

      <View style={styles.infoColumn}>
        <Text style={[styles.titleText, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.descriptionText, { color: theme.textSecondary }]} numberOfLines={1}>
          {description}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.actionContainer,
          pressed && !isLoading && styles.pressed,
        ]}
        disabled={isLoading}
        onPress={handleActionPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`Action for ${title}`}
        testID={`${testID}-action-button`}
      >
        {renderActionIcon()}
      </Pressable>
    </Pressable>
  );
}

function getInitials(title: string): string {
  if (!title) return 'P';
  const clean = title.replace(/\(.*?\)/g, '').trim();
  const words = clean.split(' ').filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return title.substring(0, 2).toUpperCase();
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 362,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallbackIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoColumn: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  descriptionText: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  actionContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
