import { Image } from 'expo-image';
import { Send } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { Toggle } from '@/components/ui/toggle';
import { NotificationPluginsSheetTokens as Tokens } from '@/constants/theme';
import { RobotNotificationsSection } from '@/features/plugins/presentation/notification-settings/components/robot-notifications-section';

export type ChannelPluginItem = {
  id: 'whatsapp' | 'telegram' | string;
  title: string;
  description: string;
  connectedPhoneNumber?: string | null;
  isConnected?: boolean;
  isEnabled?: boolean;
  connectButtonText?: string;
};

export type NotificationPluginItem = ChannelPluginItem;

export type NotificationPluginsSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  title?: string;
  plugins?: ChannelPluginItem[];
  onPluginPress?: (id: string) => void;
  onTogglePlugin?: (id: string, isEnabled: boolean) => void;
  onConnectPlugin?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const DEFAULT_NOTIFICATION_PLUGINS: ChannelPluginItem[] = [
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    description: 'Receive task updates and daily reminders from Joy via WhatsApp',
    connectedPhoneNumber: null,
    isConnected: false,
    isEnabled: false,
    connectButtonText: 'Connect WhatsApp',
  },
  {
    id: 'telegram',
    title: 'Telegram',
    description: 'Receive instant notifications directly in your Telegram',
    connectedPhoneNumber: null,
    isConnected: false,
    isEnabled: false,
    connectButtonText: 'Connect Telegram',
  },
];

function PluginRowIcon({ id, backgroundColor }: { id: string; backgroundColor: string }) {
  if (id === 'telegram') {
    return (
      <View
        style={[styles.iconBox, styles.telegramIconBox]}
        testID="notification-plugin-icon-telegram"
      >
        <Send size={18} color="#FFFFFF" strokeWidth={2} style={styles.telegramSendIcon} />
      </View>
    );
  }

  return (
    <View style={[styles.iconBox, styles.whatsappIconBox, { backgroundColor }]}>
      <Image
        source={require('@/assets/images/plugins/whatsapp-logo.png')}
        style={styles.whatsappLogo}
        contentFit="contain"
        accessibilityLabel="WhatsApp"
      />
    </View>
  );
}

export function NotificationPluginsSheet({
  isVisible,
  onClose,
  title = 'Notifications & AI Context',
  plugins = DEFAULT_NOTIFICATION_PLUGINS,
  onPluginPress,
  onTogglePlugin,
  onConnectPlugin,
  style,
  testID = 'notification-plugins-sheet',
}: NotificationPluginsSheetProps) {
  const theme = useTheme();
  const [localToggles, setLocalToggles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    plugins.forEach((p) => {
      initial[p.id] = p.isEnabled ?? Boolean(p.isConnected);
    });
    return initial;
  });

  const handleToggle = (id: string, val: boolean) => {
    setLocalToggles((prev) => ({ ...prev, [id]: val }));
    onTogglePlugin?.(id, val);
  };

  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClose}
      showCloseButton={false}
      dragBehavior="resist"
      dismissOnBackdropPress
      dismissOnRequestClose
      header={
        <View style={styles.headerRow} testID={`${testID}-header`}>
          <LiquidGlassBackButton
            onPress={onClose}
            testID={`${testID}-back-button`}
          />

          <Text style={[styles.headerTitle, { color: theme.textTitle }]} numberOfLines={1} testID={`${testID}-title`}>
            {title}
          </Text>

          <View style={styles.headerPlaceholder} testID={`${testID}-header-placeholder`} />
        </View>
      }
      sheetStyle={styles.sheetBackground}
      testID={testID}
    >
      <View style={[styles.container, style]} testID={`${testID}-content`}>
        <View style={styles.headerSpacer} />

        <RobotNotificationsSection testID={`${testID}-physical-section`} />

        <View style={styles.section} testID={`${testID}-supported-section`}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]} testID={`${testID}-supported-title`}>
            Notification Channels & AI Context
          </Text>

          <View style={[styles.pluginsCard, { backgroundColor: theme.cardBackground }]} testID={`${testID}-plugins-list`}>
            {plugins.map((plugin, index) => {
              const isToggleActive = localToggles[plugin.id] ?? Boolean(plugin.isEnabled);

              return (
                <View key={plugin.id}>
                  {index > 0 ? (
                    <View style={styles.dividerWrapper}>
                      <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                    </View>
                  ) : null}
                  <Pressable
                    style={({ pressed }) => [styles.pluginRow, pressed && styles.pressed]}
                    onPress={() => onPluginPress?.(plugin.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${plugin.title}: ${plugin.description}`}
                    testID={`${testID}-plugin-${plugin.id}`}
                  >
                    <View style={styles.pluginLeft}>
                      <PluginRowIcon id={plugin.id} backgroundColor={theme.cardBackground} />
                      <View style={styles.pluginTextStack}>
                        <View style={styles.titleRow}>
                          <Text style={[styles.pluginTitle, { color: theme.textTitle }]}>{plugin.title}</Text>
                        </View>
                        <Text style={[styles.pluginDescription, { color: theme.textSecondary }]}>{plugin.description}</Text>

                        {plugin.connectedPhoneNumber ? (
                          <View style={styles.phoneBadge}>
                            <Text style={styles.phoneBadgeText}>{plugin.connectedPhoneNumber}</Text>
                          </View>
                        ) : null}

                        {!plugin.isConnected && plugin.connectButtonText ? (
                          <Pressable
                            style={({ pressed }) => [
                              styles.connectButton,
                              pressed && styles.connectButtonPressed,
                            ]}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              onConnectPlugin?.(plugin.id);
                              onPluginPress?.(plugin.id);
                            }}
                            accessibilityRole="button"
                            testID={`${testID}-connect-button-${plugin.id}`}
                          >
                            <Text style={styles.connectButtonText}>{plugin.connectButtonText}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.toggleWrapper} testID={`${testID}-toggle-wrapper-${plugin.id}`}>
                      <Toggle
                        value={isToggleActive}
                        onValueChange={(val) => handleToggle(plugin.id, val)}
                        testID={`${testID}-toggle-${plugin.id}`}
                      />
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {},
  container: {
    width: '100%',
    gap: Tokens.layout.contentGap,
    paddingBottom: Tokens.layout.paddingBottom,
  },
  headerRow: {
    width: '100%',
    height: Tokens.layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Tokens.typography.headerTitle.fontSize,
    fontWeight: Tokens.typography.headerTitle.fontWeight,
    color: Tokens.colors.headerTitle,
    paddingHorizontal: 8,
  },
  headerPlaceholder: {
    width: Tokens.layout.headerHeight,
    height: Tokens.layout.headerHeight,
  },
  headerSpacer: {
    height: Tokens.layout.headerSpacer,
  },
  section: {
    width: '100%',
    gap: Tokens.layout.sectionGap,
  },
  sectionTitle: {
    fontSize: Tokens.typography.sectionTitle.fontSize,
    fontWeight: Tokens.typography.sectionTitle.fontWeight,
    lineHeight: Tokens.typography.sectionTitle.lineHeight,
    color: Tokens.colors.sectionTitle,
  },
  pluginsCard: {
    width: '100%',
    backgroundColor: Tokens.colors.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: Tokens.layout.pluginListPaddingVertical,
  },
  pluginRow: {
    width: '100%',
    minHeight: Tokens.layout.pluginRowHeight,
    paddingHorizontal: Tokens.layout.horizontalPadding,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.72,
  },
  pluginLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Tokens.layout.rowGap,
    flex: 1,
    paddingRight: 8,
  },
  pluginTextStack: {
    flex: 1,
    gap: Tokens.layout.textGap,
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pluginTitle: {
    fontSize: Tokens.typography.rowTitle.fontSize,
    fontWeight: Tokens.typography.rowTitle.fontWeight,
    lineHeight: Tokens.typography.rowTitle.lineHeight,
    color: Tokens.colors.rowTitle,
  },
  pluginDescription: {
    fontSize: Tokens.typography.rowDescription.fontSize,
    fontWeight: Tokens.typography.rowDescription.fontWeight,
    lineHeight: Tokens.typography.rowDescription.lineHeight,
    color: Tokens.colors.rowDescription,
  },
  phoneBadge: {
    marginTop: 4,
    paddingHorizontal: Tokens.layout.badgePaddingHorizontal,
    paddingVertical: Tokens.layout.badgePaddingVertical,
    backgroundColor: Tokens.colors.phoneBadgeBackground,
    borderColor: Tokens.colors.phoneBadgeBorder,
    borderWidth: 1,
    borderRadius: Tokens.layout.badgeRadius,
  },
  phoneBadgeText: {
    fontSize: Tokens.typography.phoneBadge.fontSize,
    fontWeight: Tokens.typography.phoneBadge.fontWeight,
    lineHeight: Tokens.typography.phoneBadge.lineHeight,
    color: Tokens.colors.phoneBadgeText,
  },
  connectButton: {
    marginTop: 6,
    height: Tokens.layout.actionButtonHeight,
    paddingHorizontal: Tokens.layout.actionButtonPaddingHorizontal,
    borderRadius: Tokens.layout.actionButtonRadius,
    borderWidth: 1,
    borderColor: Tokens.colors.actionButtonBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonPressed: {
    opacity: 0.7,
  },
  connectButtonText: {
    fontSize: Tokens.typography.actionButton.fontSize,
    fontWeight: Tokens.typography.actionButton.fontWeight,
    lineHeight: Tokens.typography.actionButton.lineHeight,
    color: Tokens.colors.actionButtonText,
  },
  toggleWrapper: {
    marginLeft: 8,
  },
  iconBox: {
    width: Tokens.layout.iconBoxSize,
    height: Tokens.layout.iconBoxSize,
    borderRadius: Tokens.layout.iconBoxRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappIconBox: {
    borderRadius: Tokens.layout.whatsappIconBoxRadius,
    backgroundColor: Tokens.colors.cardBackground,
  },
  whatsappLogo: {
    width: Tokens.layout.logoSize,
    height: Tokens.layout.logoSize,
  },
  telegramIconBox: {
    borderRadius: Tokens.layout.telegramIconBoxRadius,
    backgroundColor: Tokens.colors.telegramIconBackground,
  },
  telegramSendIcon: {
    transform: [{ rotate: '0deg' }],
  },
  dividerWrapper: {
    paddingLeft: Tokens.layout.dividerInsetLeft,
    paddingRight: Tokens.layout.horizontalPadding,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Tokens.colors.divider,
  },
});
