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
import { ChevronRight } from 'lucide-react-native';

import { PluginsTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PluginActiveRowProps = {
  /** Main plugin title. Defaults to "WhatsApp". */
  title?: string;
  /** Subtitle or connection details. Defaults to "Messaging & physical device alerts". */
  description?: string;
  /** Connection status type. Defaults to 'active'. */
  status?: 'active' | 'inactive' | 'paused';
  /** Optional custom label for the status badge (e.g. "Active"). */
  statusLabel?: string;
  /** Optional custom React node for the left icon. Defaults to WhatsApp SVG logo. */
  icon?: React.ReactNode;
  /** Optional remote or local image URL for logo. */
  iconUrl?: string;
  /** Background color for icon container box. Defaults to '#FFFFFF'. */
  iconBgColor?: string;
  /** Whether to display the right chevron arrow. Defaults to true. */
  showChevron?: boolean;
  /** Whether to show active indicator badge/dot next to title. Defaults to false. */
  showStatusBadge?: boolean;
  /** Callback fired when row is pressed. */
  onPress?: () => void;
  /** Callback fired when right action button is pressed. */
  onActionPress?: () => void;
  /** Style override for the root container. */
  style?: StyleProp<ViewStyle>;
  /** Test identifier for testing. */
  testID?: string;
};

export function PluginActiveRow({
  title = 'WhatsApp',
  description = 'Messaging & physical device alerts',
  status = 'active',
  statusLabel = 'Active',
  icon,
  iconUrl,
  iconBgColor = '#FFFFFF',
  showChevron = true,
  showStatusBadge = false,
  onPress,
  onActionPress,
  style,
  testID = 'plugin-active-row',
}: PluginActiveRowProps) {
  const theme = useTheme();

  const handleActionPress = () => {
    if (onActionPress) {
      onActionPress();
    } else if (onPress) {
      onPress();
    }
  };

  const ContainerComponent = onPress ? Pressable : View;

  return (
    <ContainerComponent
      style={({ pressed }: { pressed?: boolean }) => [
        styles.container,
        { backgroundColor: theme.cardBackground },
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${description}`}
    >
      {/* Left Content */}
      <View style={styles.leftContent} testID={`${testID}-left-content`}>
        {/* Icon Box */}
        <View
          style={[styles.iconBox, { backgroundColor: iconBgColor }]}
          testID={`${testID}-icon-box`}
        >
          {icon ? (
            icon
          ) : iconUrl ? (
            <Image
              source={{ uri: iconUrl }}
              style={styles.logoImage}
              contentFit="contain"
              accessibilityLabel={`${title} logo`}
            />
          ) : (
            <Image
              source={require('@/assets/images/plugins/whatsapp-logo.png')}
              style={styles.logoImage}
              contentFit="contain"
              accessibilityLabel={`${title} logo`}
            />
          )}
        </View>

        {/* Text Stack */}
        <View style={styles.textStack} testID={`${testID}-text-stack`}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.titleText, { color: theme.text }]}
              numberOfLines={1}
              testID={`${testID}-title`}
            >
              {title}
            </Text>
            {showStatusBadge && (
              <View
                style={[
                  styles.badge,
                  status === 'active' && styles.badgeActive,
                  status === 'paused' && styles.badgePaused,
                  status === 'inactive' && styles.badgeInactive,
                ]}
                testID={`${testID}-status-badge`}
              >
                <View
                  style={[
                    styles.badgeDot,
                    status === 'active' && styles.badgeDotActive,
                    status === 'paused' && styles.badgeDotPaused,
                    status === 'inactive' && styles.badgeDotInactive,
                  ]}
                />
                <Text
                  style={[
                    styles.badgeText,
                    status === 'active' && styles.badgeTextActive,
                    status === 'paused' && styles.badgeTextPaused,
                    status === 'inactive' && styles.badgeTextInactive,
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.descriptionText, { color: theme.textSecondary }]}
            numberOfLines={1}
            testID={`${testID}-description`}
          >
            {description}
          </Text>
        </View>
      </View>

      {/* Right Content */}
      {showChevron && (
        <Pressable
          onPress={handleActionPress}
          hitSlop={8}
          style={styles.rightContent}
          testID={`${testID}-action-btn`}
          accessibilityLabel="Plugin settings"
        >
          <ChevronRight size={16} color={theme.textSecondary} />
        </Pressable>
      )}
    </ContainerComponent>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 370,
    maxWidth: '100%',
    height: 64,
    backgroundColor: PluginsTokens.colors.cardBackground,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
  leftContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 36,
    height: 36,
  },
  textStack: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F1729',
    lineHeight: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: PluginsTokens.borderRadius.badge,
  },
  badgeActive: {
    backgroundColor: PluginsTokens.colors.badgeGreenBackground,
  },
  badgePaused: {
    backgroundColor: PluginsTokens.colors.badgeTimerBackground,
  },
  badgeInactive: {
    backgroundColor: '#F3F4F6',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeDotActive: {
    backgroundColor: PluginsTokens.colors.badgeGreenText,
  },
  badgeDotPaused: {
    backgroundColor: PluginsTokens.colors.badgeTimerText,
  },
  badgeDotInactive: {
    backgroundColor: '#9CA3AF',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  badgeTextActive: {
    color: PluginsTokens.colors.badgeGreenText,
  },
  badgeTextPaused: {
    color: PluginsTokens.colors.badgeTimerText,
  },
  badgeTextInactive: {
    color: '#6B7280',
  },
  descriptionText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#80808C',
    lineHeight: 16,
  },
  rightContent: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
