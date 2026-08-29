import { Image } from 'expo-image';
import { Cable } from 'lucide-react-native';
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidGlassIconButton } from '@/components/ui/liquid-glass-icon-button';
import { SidebarTokens } from '@/constants/theme';
import { useSchemeColors } from '@/hooks/use-scheme-colors';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SidebarTokens.width, SCREEN_WIDTH * 0.75);

export type RecentChatItem = {
  id: string;
  title: string;
};

export type SidebarDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectNav?: (route: string) => void;
  onSelectPinned?: (sessionId: string) => void;
  onSelectRecent?: (sessionId: string) => void;
  pinned?: RecentChatItem[];
  recents?: RecentChatItem[];
  onNewChat?: () => void;
  onPinChat?: (sessionId: string) => void;
  onUnpinChat?: (sessionId: string) => void;
  onDeleteRecent?: (sessionId: string) => void;
  onSettingsPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SidebarDrawer({
  isOpen: _isOpen,
  onClose: _onClose,
  onSelectNav,
  onSelectPinned,
  onSelectRecent,
  pinned = [],
  recents = [],
  onNewChat,
  onPinChat,
  onUnpinChat,
  onDeleteRecent,
  onSettingsPress,
  style,
  testID = 'sidebar-drawer',
}: SidebarDrawerProps) {
  const theme = useTheme();
  const colors = useSchemeColors();
  const insets = useSafeAreaInsets();
  const paddingTop = Math.max(insets.top, SidebarTokens.safeArea.minTop);
  const paddingBottom = Math.max(insets.bottom, SidebarTokens.safeArea.minBottom);

  const styles = useThemedStyles(colors, (c) => ({
    drawer: {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      bottom: 0,
      width: DRAWER_WIDTH,
      height: '100%' as const,
      paddingHorizontal: SidebarTokens.paddingHorizontal,
      justifyContent: 'space-between' as const,
      zIndex: SidebarTokens.zIndex.drawer,
      backgroundColor: c.sidebar.background,
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      height: SidebarTokens.header.height,
      marginBottom: SidebarTokens.header.marginBottom,
    },
    headerTitle: {
      fontSize: SidebarTokens.header.titleFontSize,
      fontWeight: SidebarTokens.header.titleFontWeight,
      color: c.sidebar.title,
    },
    searchIcon: {
      width: SidebarTokens.iconSize.nav,
      height: SidebarTokens.iconSize.nav,
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    navContainer: {
      gap: SidebarTokens.nav.gap,
      marginBottom: SidebarTokens.nav.marginBottom,
    },
    navRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: SidebarTokens.nav.itemGap,
    },
    navIcon: {
      width: SidebarTokens.iconSize.nav,
      height: SidebarTokens.iconSize.nav,
    },
    navText: {
      fontSize: SidebarTokens.nav.fontSize,
      fontWeight: SidebarTokens.nav.fontWeight,
      color: c.sidebar.nav,
    },
    sectionHeader: {
      fontSize: SidebarTokens.section.fontSize,
      fontWeight: SidebarTokens.section.fontWeight,
      marginBottom: SidebarTokens.section.marginBottom,
      color: c.sidebar.section,
    },
    recentsHeader: {
      marginTop: 0,
    },
    pinnedContainer: {
      gap: 14,
      marginBottom: SidebarTokens.pinned.marginBottom,
    },
    pinnedRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: SidebarTokens.pinned.itemGap,
    },
    pinnedIcon: {
      width: SidebarTokens.iconSize.nav,
      height: SidebarTokens.iconSize.nav,
    },
    pinnedText: {
      fontSize: SidebarTokens.pinned.fontSize,
      fontWeight: SidebarTokens.pinned.fontWeight,
      flex: 1,
      color: c.sidebar.recent,
    },
    recentsContainer: {
      gap: SidebarTokens.recents.gap,
    },
    recentText: {
      fontSize: SidebarTokens.recents.fontSize,
      fontWeight: SidebarTokens.recents.fontWeight,
      color: c.sidebar.recent,
    },
    pressed: {
      opacity: 0.6,
    },
    chatButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.96 }],
    },
    bottomBar: {
      position: 'absolute' as const,
      left: SidebarTokens.paddingHorizontal,
      right: SidebarTokens.paddingHorizontal,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      backgroundColor: 'transparent',
      zIndex: 10,
    },
    chatButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: SidebarTokens.chatButton.gap,
      backgroundColor: SidebarTokens.chatButton.background,
      width: SidebarTokens.chatButton.width,
      height: SidebarTokens.chatButton.height,
      borderRadius: SidebarTokens.chatButton.radius,
      shadowColor: SidebarTokens.chatButton.shadowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 2,
    },
    chatButtonIcon: {
      width: SidebarTokens.iconSize.chat,
      height: SidebarTokens.iconSize.chat,
    },
    chatButtonText: {
      fontSize: SidebarTokens.chatButton.fontSize,
      fontWeight: SidebarTokens.chatButton.fontWeight,
      color: c.sidebar.chatButtonText,
    },
    settingsIcon: {
      width: SidebarTokens.iconSize.settings,
      height: SidebarTokens.iconSize.settings,
    },
  }));

  return (
    <View
      style={[
        styles.drawer,
        { paddingTop },
        style,
      ]}
      testID={`${testID}-content`}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID={`${testID}-title`}>
          Joy
        </Text>
        <LiquidGlassIconButton
          onPress={() => onSelectNav?.('search')}
          size={SidebarTokens.searchButton.size}
          accessibilityLabel="Search"
          testID={`${testID}-search-button`}
        >
          <Image
            source={require('@/assets/images/ui/icon-search.svg')}
            style={styles.searchIcon}
            contentFit="contain"
            tintColor={colors.colors.icon}
            accessibilityLabel="Search"
          />
        </LiquidGlassIconButton>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: paddingBottom + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.navContainer}>
          <Pressable
            style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
            onPress={() => onSelectNav?.('robot')}
            testID={`${testID}-nav-robot`}
          >
            <Image
              source={require('@/assets/images/ui/icon-joy-robot.svg')}
              style={styles.navIcon}
              contentFit="contain"
            />
            <Text style={styles.navText}>Joy Robot</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
            onPress={() => onSelectNav?.('scheduled')}
            testID={`${testID}-nav-scheduled`}
          >
            <Image
              source={require('@/assets/images/ui/icon-clock.svg')}
              style={styles.navIcon}
              tintColor={colors.colors.icon}
              contentFit="contain"
            />
            <Text style={styles.navText}>Scheduled</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
            onPress={() => onSelectNav?.('plugins')}
            testID={`${testID}-nav-plugins`}
          >
            <Cable
              size={SidebarTokens.iconSize.nav}
              color={colors.colors.icon}
              strokeWidth={1.5}
            />
            <Text style={styles.navText}>Plugins</Text>
          </Pressable>
        </View>

        {pinned.length > 0 ? (
          <>
            <Text style={styles.sectionHeader}>Pinned</Text>
            <View style={styles.pinnedContainer}>
              {pinned.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.pinnedRow, pressed && styles.pressed]}
                  onPress={() => onSelectPinned?.(item.id)}
                  onLongPress={() => {
                    Alert.alert(
                      'Pinned chat',
                      `“${item.title}”`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Unpin chat',
                          onPress: () => onUnpinChat?.(item.id),
                        },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => onDeleteRecent?.(item.id),
                        },
                      ],
                    );
                  }}
                  delayLongPress={350}
                  testID={`${testID}-pinned-item-${index}`}
                >
                  <Image
                    source={require('@/assets/images/ui/icon-message-circle.svg')}
                    style={styles.pinnedIcon}
                    tintColor={colors.colors.iconMuted}
                    contentFit="contain"
                  />
                  <Text style={styles.pinnedText} numberOfLines={1}>
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionHeader, styles.recentsHeader]}>Recents</Text>
        <View style={styles.recentsContainer}>
          {recents.map((item, index) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => onSelectRecent?.(item.id)}
              onLongPress={() => {
                Alert.alert(
                  'Chat options',
                  `“${item.title}”`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Pin chat',
                      onPress: () => onPinChat?.(item.id),
                    },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => onDeleteRecent?.(item.id),
                    },
                  ],
                );
              }}
              delayLongPress={350}
              testID={`${testID}-recent-item-${index}`}
            >
              <Text style={styles.recentText} numberOfLines={1}>
                {item.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { bottom: paddingBottom }]}>
        <Pressable
          style={({ pressed }) => [
            styles.chatButton,
            {
              backgroundColor: theme.accentPrimary ?? theme.linkPrimary,
              shadowColor: theme.accentPrimary ?? theme.linkPrimary,
            },
            pressed && styles.chatButtonPressed,
          ]}
          onPress={() => onNewChat?.()}
          accessibilityRole="button"
          accessibilityLabel="New Chat"
          testID={`${testID}-new-chat-button`}
        >
          <Image
            source={require('@/assets/images/ui/icon-edit.svg')}
            style={styles.chatButtonIcon}
            contentFit="contain"
            tintColor="#FFFFFF"
          />
          <Text style={styles.chatButtonText}>Chat</Text>
        </Pressable>

        <LiquidGlassIconButton
          onPress={() => {
            onSettingsPress?.();
          }}
          size={SidebarTokens.settingsButton.size}
          accessibilityLabel="Settings"
          testID={`${testID}-settings-button`}
        >
          <Image
            source={require('@/assets/images/ui/icon-settings.svg')}
            style={styles.settingsIcon}
            contentFit="contain"
            tintColor={colors.colors.icon}
            accessibilityLabel="Settings"
          />
        </LiquidGlassIconButton>
      </View>
    </View>
  );
}
