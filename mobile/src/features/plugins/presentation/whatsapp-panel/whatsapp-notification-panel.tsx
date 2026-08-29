import { Sparkles } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SearchInput } from '@/components/ui/search-input';
import { PluginNotificationSettingsSheetTokens } from '@/constants/theme';
import { useWhatsAppSession } from '@/features/plugins/data/use-whatsapp-session';
import {
  addWhatsAppContact,
  refreshWhatsAppRules,
  saveWhatsAppRules,
} from '@/features/plugins/data/whatsapp-session-store';
import type { DeviceContact } from '@/features/plugins/domain/device-contacts';
import { mapPluginApiError } from '@/features/plugins/domain/plugin';
import {
  conversationAvatarColor,
  formatWhatsAppDisplayNumber,
  type WhatsAppRulePatch,
} from '@/features/plugins/domain/whatsapp';
import {
  AddAllowedContactRow,
  AllowedContactRow,
  DeviceContactPickerSheet,
} from '@/features/plugins/presentation/notification-settings/components';
import { useTheme } from '@/hooks/use-theme';

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

export interface WhatsAppNotificationPanelProps {
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
  testID?: string;
}

function toPatches(allowedContacts: NotificationContact[]): WhatsAppRulePatch[] {
  if (allowedContacts.length === 0) {
    return [{ scope: 'ALL', enabled: false, speakOnDevice: false }];
  }

  return allowedContacts.map((contact) => ({
    scope: contact.kind === 'GROUP' ? 'GROUP' : 'CONTACT',
    conversationId: contact.id,
    enabled: true,
    speakOnDevice: Boolean(contact.notifyVoiceEnabled),
  }));
}

export function WhatsAppNotificationPanel({
  style,
  accentColor,
  testID = 'whatsapp-notification-panel',
}: WhatsAppNotificationPanelProps) {
  const theme = useTheme();
  const session = useWhatsAppSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mutatingContactId, setMutatingContactId] = useState<string | null>(null);
  const [mutatingAction, setMutatingAction] = useState<'delete' | 'toggle' | null>(null);
  const resolvedAccentColor =
    accentColor ?? theme.accentPrimary ?? theme.linkPrimary ?? '#25D366';

  const sessionPhoneNumber = session.connection?.phoneNumber
    ? formatWhatsAppDisplayNumber(session.connection.phoneNumber)
    : null;

  useEffect(() => {
    void refreshWhatsAppRules().catch((error) => {
      Alert.alert('Unable to load WhatsApp rules', mapPluginApiError(error));
    });
  }, []);

  const allowedContacts = useMemo<NotificationContact[]>(() => {
    const ruleByConversation = new Map(
      session.rules
        .filter((rule) => rule.conversationId)
        .map((rule) => [rule.conversationId as string, rule]),
    );

    return session.conversations.map((conversation) => {
      const rule = ruleByConversation.get(conversation.id);
      return {
        id: conversation.id,
        name: conversation.displayName,
        phoneNumber: conversation.type === 'GROUP' ? 'Group' : 'Contact',
        avatarColor: conversationAvatarColor(conversation.id),
        kind: conversation.type,
        notifyVoiceEnabled: rule ? rule.speakOnDevice && rule.enabled : false,
      };
    });
  }, [session.conversations, session.rules]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredContacts = useMemo(() => {
    if (!trimmedQuery) {
      return allowedContacts;
    }
    return allowedContacts.filter((contact) => {
      const nameMatch = contact.name.toLowerCase().includes(trimmedQuery);
      const phoneMatch = contact.phoneNumber
        ? contact.phoneNumber.toLowerCase().includes(trimmedQuery)
        : false;
      return nameMatch || phoneMatch;
    });
  }, [allowedContacts, trimmedQuery]);

  const persist = useCallback(
    async (nextContacts: NotificationContact[]) => {
      if (isSaving) {
        return;
      }
      setIsSaving(true);
      try {
        await saveWhatsAppRules(toPatches(nextContacts));
      } catch (error) {
        Alert.alert('Unable to save WhatsApp rules', mapPluginApiError(error));
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving],
  );

  const handleDeleteContact = async (id: string) => {
    if (mutatingContactId || isSaving) {
      return;
    }
    setMutatingContactId(id);
    setMutatingAction('delete');
    try {
      const nextContacts = allowedContacts.filter((contact) => contact.id !== id);
      await persist(nextContacts);
    } finally {
      setMutatingContactId(null);
      setMutatingAction(null);
    }
  };

  const handleToggleContactNotification = async (
    id: string,
    notifyVoiceEnabled: boolean,
  ) => {
    if (mutatingContactId || isSaving) {
      return;
    }
    setMutatingContactId(id);
    setMutatingAction('toggle');
    try {
      const nextContacts = allowedContacts.map((contact) =>
        contact.id === id ? { ...contact, notifyVoiceEnabled } : contact,
      );
      await persist(nextContacts);
    } finally {
      setMutatingContactId(null);
      setMutatingAction(null);
    }
  };
  const handleSelectDeviceContact = async (contact: DeviceContact) => {
    try {
      setIsSaving(true);
      const targetNumber = contact.normalizedPhoneNumber || contact.phoneNumber;
      const conversation = await addWhatsAppContact(targetNumber, contact.name);
      setShowContactPicker(false);

      const nextContacts: NotificationContact[] = [
        {
          id: conversation.id,
          name: conversation.displayName || contact.name,
          phoneNumber: conversation.type === 'GROUP' ? 'Group' : 'Contact',
          avatarColor: conversationAvatarColor(conversation.id),
          kind: conversation.type,
          notifyVoiceEnabled: false,
        },
        ...allowedContacts.filter((item) => item.id !== conversation.id),
      ];

      await persist(nextContacts);
    } catch (error) {
      Alert.alert('Unable to add contact', mapPluginApiError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddManualNumber = async (phoneNumber: string, name?: string) => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      return;
    }
    try {
      setIsSaving(true);
      const conversation = await addWhatsAppContact(trimmed, name);
      setShowContactPicker(false);

      const nextContacts: NotificationContact[] = [
        {
          id: conversation.id,
          name: conversation.displayName || name || trimmed,
          phoneNumber: conversation.type === 'GROUP' ? 'Group' : 'Contact',
          avatarColor: conversationAvatarColor(conversation.id),
          kind: conversation.type,
          notifyVoiceEnabled: false,
        },
        ...allowedContacts.filter((item) => item.id !== conversation.id),
      ];

      await persist(nextContacts);
    } catch (error) {
      Alert.alert('Unable to add contact', mapPluginApiError(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {session.isLoadingRules && !sessionPhoneNumber ? (
        <View style={styles.section} testID={`${testID}-account-loading-section`}>
          <View
            style={[
              styles.accountBannerCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 16,
              },
            ]}
            testID={`${testID}-account-card-loading`}
          >
            <ActivityIndicator size="small" color={resolvedAccentColor} testID={`${testID}-account-spinner`} />
          </View>
        </View>
      ) : sessionPhoneNumber ? (
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
                  {sessionPhoneNumber}
                </Text>
              </View>
              <Text
                style={[
                  styles.accountStatusActiveText,
                  { color: resolvedAccentColor },
                ]}
                testID={`${testID}-account-status`}
              >
                Connected
              </Text>
            </View>
            <Text
              style={[styles.accountBannerSubtitle, { color: theme.textSecondary }]}
              testID={`${testID}-account-subtitle`}
            >
              Joy uses this primary number for daily task briefings, autonomous task updates, and proactive reminders.
            </Text>
          </View>
        </View>
      ) : null}

      {allowedContacts.length > 0 || searchQuery.length > 0 ? (
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search contacts or groups..."
          onClear={() => setSearchQuery('')}
          variant="white"
          style={styles.searchInput}
          testID={`${testID}-search-input`}
        />
      ) : null}

      <View style={styles.section} testID={`${testID}-contacts-section`}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          CONTACTS & AI CONTEXT
        </Text>
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
          {session.isLoadingRules && allowedContacts.length === 0 ? (
            <View style={styles.loadingContactsContainer} testID={`${testID}-loading-contacts`}>
              <ActivityIndicator size="small" color={resolvedAccentColor} testID={`${testID}-contacts-spinner`} />
              <Text style={[styles.loadingContactsText, { color: theme.textSecondary }]}>
                Loading contacts & AI context...
              </Text>
            </View>
          ) : allowedContacts.length === 0 ? (
            <View style={styles.emptyContactsContainer} testID={`${testID}-empty-contacts`}>
              <Text style={[styles.emptyContactsTitle, { color: theme.text }]}>
                No contacts added yet
              </Text>
              <Text style={[styles.emptyContactsSubtitle, { color: theme.textSecondary }]}>
                Add contacts so Joy knows who they are for WhatsApp voice commands and announces their messages.
              </Text>
            </View>
          ) : filteredContacts.length === 0 ? (
            <View style={styles.emptySearchContainer} testID={`${testID}-empty-search`}>
              <Text style={[styles.emptyContactsTitle, { color: theme.text }]}>
                No matching contacts
              </Text>
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
                  isTogglingNotifyVoice={
                    mutatingContactId === contact.id && mutatingAction === 'toggle'
                  }
                  isDeleting={
                    mutatingContactId === contact.id && mutatingAction === 'delete'
                  }
                  onToggleNotifyVoice={(voiceEnabled) => {
                    void handleToggleContactNotification(contact.id, voiceEnabled);
                  }}
                  onDelete={() => {
                    void handleDeleteContact(contact.id);
                  }}
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
            onPress={() => setShowContactPicker(true)}
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

      <DeviceContactPickerSheet
        isVisible={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        onSelectContact={(contact) => {
          void handleSelectDeviceContact(contact);
        }}
        onAddManualNumber={(phoneNumber, name) => {
          void handleAddManualNumber(phoneNumber, name);
        }}
        testID={`${testID}-device-contact-picker`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'stretch',
    gap: PluginNotificationSettingsSheetTokens.layout.contentGap,
    paddingBottom: 24,
  },
  section: {
    width: '100%',
    gap: PluginNotificationSettingsSheetTokens.layout.sectionGap,
  },
  sectionTitle: {
    fontSize: PluginNotificationSettingsSheetTokens.typography.sectionTitle.fontSize,
    fontWeight: PluginNotificationSettingsSheetTokens.typography.sectionTitle.fontWeight,
    paddingLeft: PluginNotificationSettingsSheetTokens.layout.sectionTitlePaddingLeft,
    letterSpacing: 0.8,
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
    borderWidth: 1,
    borderRadius: PluginNotificationSettingsSheetTokens.layout.badgeRadius,
  },
  accountBadgeText: {
    fontSize: PluginNotificationSettingsSheetTokens.typography.accountBadge.fontSize,
    fontWeight: PluginNotificationSettingsSheetTokens.typography.accountBadge.fontWeight,
    lineHeight: PluginNotificationSettingsSheetTokens.typography.accountBadge.lineHeight,
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
  searchInput: {
    width: '100%',
    maxWidth: '100%',
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
  loadingContactsContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingContactsText: {
    fontSize: PluginNotificationSettingsSheetTokens.typography.emptySubtitle.fontSize,
    fontWeight: PluginNotificationSettingsSheetTokens.typography.emptySubtitle.fontWeight,
    textAlign: 'center',
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
  },
  emptyContactsSubtitle: {
    fontSize: PluginNotificationSettingsSheetTokens.typography.emptySubtitle.fontSize,
    fontWeight: PluginNotificationSettingsSheetTokens.typography.emptySubtitle.fontWeight,
    textAlign: 'center',
    maxWidth: 260,
  },
  dividerWrapper: {
    paddingLeft: 64,
  },
  divider: {
    height: 1,
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
    fontSize: PluginNotificationSettingsSheetTokens.typography.infoCaption.fontSize,
    fontWeight: PluginNotificationSettingsSheetTokens.typography.infoCaption.fontWeight,
    lineHeight: PluginNotificationSettingsSheetTokens.typography.infoCaption.lineHeight,
  },
});
