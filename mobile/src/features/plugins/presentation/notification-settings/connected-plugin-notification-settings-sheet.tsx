import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { PluginNotificationSettingsSheet } from '@/features/plugins/components/plugin-notification-settings-sheet';
import type { NotificationContact } from '@/features/plugins/components/plugin-notification-settings-sheet';
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
} from '@/features/plugins/domain/whatsapp';
import type { WhatsAppRulePatch } from '@/features/plugins/domain/whatsapp';
import {
  DeviceContactPickerSheet,
} from '@/features/plugins/presentation/notification-settings/components';
export type ConnectedPluginNotificationSettingsSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  pluginTitle?: string;
  connectedPhoneNumber?: string | null;
  accentColor?: string;
  testID?: string;
};

function toPatches(
  allowedContacts: NotificationContact[],
): WhatsAppRulePatch[] {
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

export function ConnectedPluginNotificationSettingsSheet({
  isVisible,
  onClose,
  pluginTitle = 'WhatsApp',
  connectedPhoneNumber,
  accentColor,
  testID = 'plugin-notification-settings-sheet',
}: ConnectedPluginNotificationSettingsSheetProps) {
  const session = useWhatsAppSession();
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const sessionPhoneNumber = session.connection?.phoneNumber;

  const resolvedPhoneNumber = useMemo(() => {
    if (connectedPhoneNumber !== undefined) {
      return connectedPhoneNumber;
    }
    if (sessionPhoneNumber) {
      return formatWhatsAppDisplayNumber(sessionPhoneNumber);
    }
    return null;
  }, [connectedPhoneNumber, sessionPhoneNumber]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    void refreshWhatsAppRules().catch((error) => {
      Alert.alert('Unable to load WhatsApp rules', mapPluginApiError(error));
    });
  }, [isVisible]);

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

  const persist = useCallback(
    async (
      nextContacts: NotificationContact[],
    ) => {
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
    const nextContacts = allowedContacts.filter((contact) => contact.id !== id);
    await persist(nextContacts);
  };

  const handleToggleContactNotification = async (
    id: string,
    notifyVoiceEnabled: boolean,
  ) => {
    const nextContacts = allowedContacts.map((contact) =>
      contact.id === id ? { ...contact, notifyVoiceEnabled } : contact,
    );
    await persist(nextContacts);
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
    <PluginNotificationSettingsSheet
      isVisible={isVisible}
      onClose={onClose}
      pluginTitle={pluginTitle}
      connectedPhoneNumber={resolvedPhoneNumber}
      accentColor={accentColor}
      initialContacts={allowedContacts}
      onToggleContactNotification={(id, notifyVoiceEnabled) => {
        void handleToggleContactNotification(id, notifyVoiceEnabled);
      }}
      onDeleteContact={(id) => {
        void handleDeleteContact(id);
      }}
      onAddContactPress={() => setShowContactPicker(true)}
      overlay={
        <DeviceContactPickerSheet
          isVisible={showContactPicker}
          onClose={() => setShowContactPicker(false)}
          onSelectContact={handleSelectDeviceContact}
          onAddManualNumber={handleAddManualNumber}
          isResolving={isSaving}
          variant="overlay"
          overlayZIndex={200}
          testID={`${testID}-contact-picker-sheet`}
        />
      }
      testID={testID}
    />
  );
}
