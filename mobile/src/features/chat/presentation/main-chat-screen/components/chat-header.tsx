import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { HeaderActionsButton } from '@/components/ui/header-actions-button';
import { LiquidGlassIconButton } from '@/components/ui/liquid-glass-icon-button';

export type ChatHeaderProps = {
  title?: string;
  isTemporaryChat?: boolean;
  hasMessages?: boolean;
  onMenuPress?: () => void;
  onTemporaryChatPress?: () => void;
  onEditPress?: () => void;
  onMorePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ChatHeader({
  title = 'Chat',
  isTemporaryChat = false,
  hasMessages = false,
  onMenuPress,
  onTemporaryChatPress,
  onEditPress,
  onMorePress,
  style,
  testID = 'chat-header',
}: ChatHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Left Slot: Menu Button */}
      <LiquidGlassIconButton
        onPress={onMenuPress}
        size={40}
        accessibilityLabel="Open menu"
        testID={`${testID}-menu-button`}
      >
        <Image
          source={require('@/assets/images/chat/icon-menu.svg')}
          style={styles.menuIcon}
          tintColor={theme.icon}
          contentFit="contain"
          accessibilityLabel="Menu"
        />
      </LiquidGlassIconButton>

      {/* Center Slot: Title */}
      <View style={styles.titleContainer} testID={`${testID}-title-container`}>
        {!hasMessages && title ? (
          <Text style={[styles.titleText, { color: theme.text }]} testID={`${testID}-title`}>
            {title}
          </Text>
        ) : null}
      </View>

      {/* Right Slot: Temporary Chat Button or Header Actions */}
      <View style={styles.rightSlot}>
        {hasMessages ? (
          <HeaderActionsButton
            onPressEdit={onEditPress}
            onPressMore={onMorePress}
            testID={`${testID}-header-actions`}
          />
        ) : (
          <LiquidGlassIconButton
            onPress={onTemporaryChatPress}
            size={40}
            accessibilityLabel="Temporary Chat"
            testID={`${testID}-temp-chat-button`}
          >
            <View style={styles.tempIconWrapper}>
              <Image
                source={require('@/assets/images/chat/icon-message-dashed.svg')}
                style={styles.tempIcon}
                tintColor={theme.icon}
                contentFit="contain"
                accessibilityLabel="Temporary Chat Icon"
              />
              {isTemporaryChat && (
                <View
                  style={[
                    styles.checkmarkBadge,
                    { backgroundColor: theme.accentPrimary ?? theme.linkPrimary },
                  ]}
                  testID={`${testID}-temp-checkmark`}
                >
                  <View style={styles.checkmarkInner} />
                </View>
              )}
            </View>
          </LiquidGlassIconButton>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    width: '100%',
  },
  menuIcon: {
    width: 20,
    height: 20,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  rightSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempIconWrapper: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  tempIcon: {
    width: 20,
    height: 20,
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});
