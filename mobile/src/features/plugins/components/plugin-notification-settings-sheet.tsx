import { Ellipsis, Sparkles } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { LiquidGlassIconButton } from '@/components/ui/liquid-glass-icon-button';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { SearchInput } from '@/components/ui/search-input';
import { PluginNotificationSettingsSheetTokens } from '@/constants/theme';
import {
  AddAllowedContactRow,
  AllowedContactRow,
} from '@/features/plugins/presentation/notification-settings/components';

export { PluginNotificationSettingsSheetTokens };
export type AIContextContact = {
  id: string;
  name: string;
  phoneNumber: string;
  avatarColor: string;
  kind?: 'DM' | 'GROUP';
  notifyVoiceEnabled?: boolean;
  isAIContextEnabled?: boolean;
};

export type NotificationContact = AIContextContact;

export type PluginNotificationSettingsSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  pluginTitle?: string;
  connectedPhoneNumber?: string | null;
  accentColor?: string;
  searchPlaceholder?: string;
  onMorePress?: () => void;
  onAddContactPress?: () => void;
  onToggleContactNotification?: (id: string, notifyVoiceEnabled: boolean) => void;
  onDeleteContact?: (id: string) => void;
  initialContacts?: NotificationContact[];
  overlay?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
const EMPTY_CONTACTS: NotificationContact[] = [];


export function PluginNotificationSettingsSheet({
  isVisible,
  onClose,
  pluginTitle = 'WhatsApp',
  connectedPhoneNumber,
  accentColor,
  searchPlaceholder = 'Search contacts or groups...',
  onMorePress,
  onAddContactPress,
  onToggleContactNotification,
  onDeleteContact,
  initialContacts = EMPTY_CONTACTS,
  overlay,
  style,
  testID = 'plugin-notification-settings-sheet',
}: PluginNotificationSettingsSheetProps) {
  const theme = useTheme();
  const resolvedAccentColor =
    accentColor ?? theme.accentPrimary ?? theme.linkPrimary;
  const [contacts, setContacts] = useState<NotificationContact[]>(initialContacts);
  const [searchQuery, setSearchQuery] = useState('');


  useEffect(() => {
    if (!isVisible) {
      setSearchQuery('');
      return;
    }
    setContacts(initialContacts);
  }, [initialContacts, isVisible]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredContacts = useMemo(() => {
    if (!trimmedQuery) {
      return contacts;
    }
    return contacts.filter((contact) => {
      const nameMatch = contact.name.toLowerCase().includes(trimmedQuery);
      const phoneMatch = contact.phoneNumber
        ? contact.phoneNumber.toLowerCase().includes(trimmedQuery)
        : false;
      return nameMatch || phoneMatch;
    });
  }, [contacts, trimmedQuery]);

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((contact) => contact.id !== id));
    onDeleteContact?.(id);
  };

  const handleToggleContactVoice = (id: string, notifyVoiceEnabled: boolean) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === id ? { ...contact, notifyVoiceEnabled } : contact,
      ),
    );
    onToggleContactNotification?.(id, notifyVoiceEnabled);
  };
  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClose}
      showCloseButton={false}
      dragBehavior="resist"
      dismissOnBackdropPress
      dismissOnRequestClose
      overlay={overlay}
      header={
        <View style={styles.headerRow} testID={`${testID}-header`}>
          <LiquidGlassBackButton
            onPress={onClose}
            testID={`${testID}-back-button`}
          />

          <Text style={[styles.headerTitle, { color: theme.textTitle }]} numberOfLines={1} testID={`${testID}-title`}>
            {pluginTitle}
          </Text>

          <LiquidGlassIconButton
            onPress={onMorePress}
            accessibilityLabel="More options"
            testID={`${testID}-more-button`}
          >
            <Ellipsis size={20} color={theme.icon} />
          </LiquidGlassIconButton>
        </View>
      }
      sheetStyle={styles.sheetBackground}
      testID={testID}
    >
      <View style={[styles.container, style]} testID={`${testID}-content`}>
        {connectedPhoneNumber ? (
          <View style={styles.section} testID={`${testID}-account-section`}>
            <View
              style={[
                styles.accountBannerCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                },
              ]}
              testID={`${testID}-account-card`}
            >
              <View style={styles.accountBannerHeaderRow}>
                <View
                  style={[
                    styles.accountBadge,
                    {
                      backgroundColor: `${resolvedAccentColor}1A`,
                      borderColor: `${resolvedAccentColor}33`,
                    },
                  ]}
                  testID={`${testID}-account-badge`}
                >
                  <Text
                    style={[styles.accountBadgeText, { color: resolvedAccentColor }]}
                    testID={`${testID}-account-badge-text`}
                  >
                    {connectedPhoneNumber}
                  </Text>
                </View>
                <Text style={[styles.accountStatusActiveText, { color: resolvedAccentColor }]}>
                  Connected
                </Text>
              </View>
              <Text style={[styles.accountBannerSubtitle, { color: theme.textSecondary }]}>
                Joy uses this primary number for daily task briefings, autonomous task updates, and proactive reminders.
              </Text>
            </View>
          </View>
        ) : null}

        {contacts.length > 0 || searchQuery.length > 0 ? (
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={searchPlaceholder}
            onClear={() => setSearchQuery('')}
            variant="white"
            style={styles.searchInput}
            testID={`${testID}-search-input`}
          />
        ) : null}
        <View style={styles.section} testID={`${testID}-contacts-section`}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CONTACTS & AI CONTEXT</Text>
          <View
            style={[
              styles.contactsCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
            testID={`${testID}-contacts-card`}
          >
            {contacts.length === 0 ? (
              <View style={styles.emptyContactsContainer} testID={`${testID}-empty-contacts`}>
                <Text style={[styles.emptyContactsTitle, { color: theme.text }]}>No contacts added yet</Text>
                <Text style={[styles.emptyContactsSubtitle, { color: theme.textSecondary }]}>
                  Add contacts so Joy knows who they are for WhatsApp voice commands and announces their messages.
                </Text>
              </View>
            ) : filteredContacts.length === 0 ? (
              <View style={styles.emptySearchContainer} testID={`${testID}-empty-search`}>
                <Text style={[styles.emptyContactsTitle, { color: theme.text }]}>No matching contacts</Text>
                <Text style={[styles.emptyContactsSubtitle, { color: theme.textSecondary }]}>
                  No contacts or groups match &ldquo;{searchQuery.trim()}&rdquo;.
                </Text>
              </View>
            ) : (
              filteredContacts.map((contact, index) => (
                <React.Fragment key={contact.id}>
                  <AllowedContactRow
                    name={contact.name}
                    phoneNumber={contact.phoneNumber}
                    avatarColor={contact.avatarColor}
                    accentColor={resolvedAccentColor}
                    notifyVoiceEnabled={Boolean(contact.notifyVoiceEnabled)}
                    onToggleNotifyVoice={(voiceEnabled) =>
                      handleToggleContactVoice(contact.id, voiceEnabled)
                    }
                    onDelete={() => handleDeleteContact(contact.id)}
                    style={styles.contactRow}
                    testID={`${testID}-contact-${contact.id}`}
                  />
                  {index < filteredContacts.length - 1 ? (
                    <View style={styles.dividerWrapper}>
                      <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                    </View>
                  ) : null}
                </React.Fragment>
              ))
            )}
            <AddAllowedContactRow
              label="Add Contact"
              onPress={onAddContactPress}
              style={styles.contactRow}
              testID={`${testID}-add-contact`}
            />
          </View>

          <View style={styles.infoCaptionRow} testID={`${testID}-info-caption`}>
            <Sparkles size={13} color={theme.textSecondary} style={styles.infoCaptionIcon} />
            <Text style={[styles.infoCaptionText, { color: theme.textSecondary }]}>
              Joy uses these contacts as AI context for voice commands and messages. Tap the bell icon to toggle Joy Robot voice announcements.
            </Text>
          </View>
        </View>
      </View>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: PluginNotificationSettingsSheetTokens.layout.sheetRadius,
    borderTopRightRadius: PluginNotificationSettingsSheetTokens.layout.sheetRadius,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  container: {
    alignItems: 'stretch',
    gap: PluginNotificationSettingsSheetTokens.layout.contentGap,
    paddingBottom: 24,
  },
  searchInput: {
    width: '100%',
    maxWidth: '100%',
  },
  headerRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PluginNotificationSettingsSheetTokens.colors.headerTitle,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    gap: PluginNotificationSettingsSheetTokens.layout.sectionGap,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: PluginNotificationSettingsSheetTokens.colors.sectionTitle,
    paddingLeft: PluginNotificationSettingsSheetTokens.layout.sectionTitlePaddingLeft,
  },
  accountBannerCard: {
    width: '100%',
    borderRadius: PluginNotificationSettingsSheetTokens.layout.accountBannerRadius,
    borderWidth: 1,
    padding: PluginNotificationSettingsSheetTokens.layout.accountBannerPadding,
    gap: PluginNotificationSettingsSheetTokens.layout.accountBannerGap,
  },
  accountBannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountBadge: {
    paddingHorizontal: PluginNotificationSettingsSheetTokens.layout.badgePaddingHorizontal,
    paddingVertical: PluginNotificationSettingsSheetTokens.layout.badgePaddingVertical,
    backgroundColor: PluginNotificationSettingsSheetTokens.colors.accountBadgeBackground,
    borderColor: PluginNotificationSettingsSheetTokens.colors.accountBadgeBorder,
    borderWidth: 1,
    borderRadius: PluginNotificationSettingsSheetTokens.layout.badgeRadius,
  },
  accountBadgeText: {
    fontSize: PluginNotificationSettingsSheetTokens.typography.accountBadge.fontSize,
    fontWeight: PluginNotificationSettingsSheetTokens.typography.accountBadge.fontWeight,
    lineHeight: PluginNotificationSettingsSheetTokens.typography.accountBadge.lineHeight,
    color: PluginNotificationSettingsSheetTokens.colors.accountBadgeText,
  },
  accountStatusActiveText: {
    fontSize: 12,
    fontWeight: '600',
  },
  accountBannerSubtitle: {
    fontSize: PluginNotificationSettingsSheetTokens.typography.accountBannerSubtitle.fontSize,
    fontWeight: PluginNotificationSettingsSheetTokens.typography.accountBannerSubtitle.fontWeight,
    lineHeight: PluginNotificationSettingsSheetTokens.typography.accountBannerSubtitle.lineHeight,
  },
  contactsCard: {
    width: '100%',
    borderRadius: PluginNotificationSettingsSheetTokens.layout.cardRadius,
    borderWidth: 1,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  contactRow: {
    width: '100%',
  },
  emptyContactsContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptySearchContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyContactsTitle: {
    fontSize: PluginNotificationSettingsSheetTokens.typography.emptyTitle.fontSize,
    fontWeight: PluginNotificationSettingsSheetTokens.typography.emptyTitle.fontWeight,
    color: PluginNotificationSettingsSheetTokens.colors.emptyTitle,
  },
  emptyContactsSubtitle: {
    fontSize: PluginNotificationSettingsSheetTokens.typography.emptySubtitle.fontSize,
    fontWeight: PluginNotificationSettingsSheetTokens.typography.emptySubtitle.fontWeight,
    color: PluginNotificationSettingsSheetTokens.colors.emptySubtitle,
    textAlign: 'center',
    maxWidth: 260,
  },
  dividerWrapper: {
    paddingLeft: 64,
  },
  divider: {
    height: 1,
    backgroundColor: PluginNotificationSettingsSheetTokens.colors.divider,
  },
  infoCaptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  infoCaptionIcon: {
    marginTop: 2,
  },
  infoCaptionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
});
