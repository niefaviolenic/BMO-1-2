import { Plus, UserPlus } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { LiquidGlassIconButton } from '@/components/ui/liquid-glass-icon-button';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { DeviceContactPickerTokens as Tokens } from '@/constants/theme';
import { useDeviceContacts } from '@/features/plugins/data/use-device-contacts';
import {
  filterDeviceContacts,
  normalizePhoneNumber,
  type DeviceContact,
} from '@/features/plugins/domain/device-contacts';

import { ContactPickerPermissionView } from './contact-picker-permission-view';
import { ContactPickerSearchBar } from './contact-picker-search-bar';
import { DeviceContactItemRow } from './device-contact-item-row';

export interface DeviceContactPickerSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectContact: (contact: DeviceContact) => void;
  onAddManualNumber?: (number: string, name?: string) => Promise<void> | void;
  isResolving?: boolean;
  variant?: 'modal' | 'overlay';
  overlayZIndex?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function DeviceContactPickerSheet({
  isVisible,
  onClose,
  onSelectContact,
  onAddManualNumber,
  isResolving = false,
  variant = 'modal',
  overlayZIndex = 150,
  style,
  testID = 'device-contact-picker-sheet',
}: DeviceContactPickerSheetProps) {
  const theme = useTheme();
  const {
    contacts,
    status,
    isLoading,
    loadContacts,
    requestPermission,
    openSettings,
  } = useDeviceContacts();

  const [searchQuery, setSearchQuery] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  useEffect(() => {
    if (isVisible) {
      void loadContacts();
      setSearchQuery('');
      setShowManualInput(false);
      setManualName('');
      setManualPhone('');
    }
  }, [isVisible, loadContacts]);

  const filteredContacts = useMemo(() => {
    return filterDeviceContacts(contacts, searchQuery);
  }, [contacts, searchQuery]);

  const trimmedQuery = searchQuery.trim();
  const digitsInQuery = trimmedQuery.replace(/\D/g, '');
  const showQuickAddOption =
    digitsInQuery.length >= 4 &&
    !filteredContacts.some(
      (contact) =>
        contact.normalizedPhoneNumber.replace(/\D/g, '') === digitsInQuery,
    );

  const handleQuickAdd = () => {
    const normalized = normalizePhoneNumber(trimmedQuery);
    if (!normalized) return;
    const contact: DeviceContact = {
      id: normalized,
      name: trimmedQuery,
      phoneNumber: trimmedQuery,
      normalizedPhoneNumber: normalized,
      phoneNumbers: [{ number: trimmedQuery, normalizedNumber: normalized }],
      avatarColor: '#4D99E5',
    };
    onSelectContact(contact);
  };

  const handleManualSubmit = () => {
    const trimmedP = manualPhone.trim();
    if (!trimmedP) return;
    const normalized = normalizePhoneNumber(trimmedP);
    if (!normalized) return;

    const name = manualName.trim() || trimmedP;
    if (onAddManualNumber) {
      void onAddManualNumber(normalized, name);
    } else {
      const contact: DeviceContact = {
        id: normalized,
        name,
        phoneNumber: trimmedP,
        normalizedPhoneNumber: normalized,
        phoneNumbers: [{ number: trimmedP, normalizedNumber: normalized }],
        avatarColor: '#4D99E5',
      };
      onSelectContact(contact);
    }
  };

  const renderContent = () => {
    if (showManualInput) {
      const isSubmitDisabled = !manualPhone.trim() || isResolving;
      return (
        <View style={styles.manualFormWrapper} testID={`${testID}-manual-form`}>
          <View style={styles.manualFormSection}>
            <Text style={[styles.manualFormSectionTitle, { color: theme.textSecondary }]}>Enter Contact Details</Text>
            <View
              style={[
                styles.manualFormCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Name (Optional)</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.inputText,
                    },
                  ]}
                  value={manualName}
                  onChangeText={setManualName}
                  placeholder="e.g. Mama / Boss"
                  placeholderTextColor={theme.inputPlaceholder ?? theme.textMuted}
                  autoCapitalize="words"
                  testID={`${testID}-manual-name-input`}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>WhatsApp Phone Number</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.inputText,
                    },
                  ]}
                  value={manualPhone}
                  onChangeText={setManualPhone}
                  placeholder="e.g. 08123456789 or +62..."
                  placeholderTextColor={theme.inputPlaceholder ?? theme.textMuted}
                  keyboardType="phone-pad"
                  autoFocus
                  testID={`${testID}-manual-phone-input`}
                />
              </View>
            </View>
          </View>

          <View style={styles.manualFormActions}>
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: theme.buttonPrimaryBackground },
                isSubmitDisabled && styles.submitButtonDisabled,
                pressed && !isSubmitDisabled && styles.submitButtonPressed,
              ]}
              onPress={handleManualSubmit}
              disabled={isSubmitDisabled}
              accessibilityRole="button"
              accessibilityLabel="Add Contact"
              testID={`${testID}-manual-submit-button`}
            >
              {isResolving ? (
                <ActivityIndicator
                  size="small"
                  color={theme.buttonPrimaryText}
                  testID={`${testID}-manual-submit-spinner`}
                />
              ) : (
                <Text style={[styles.submitButtonText, { color: theme.buttonPrimaryText }]}>Add Contact</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
              ]}
              onPress={() => setShowManualInput(false)}
              accessibilityRole="button"
              accessibilityLabel="Back to Contacts"
              testID={`${testID}-manual-cancel-button`}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Back to Contacts</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (status === 'denied') {
      return (
        <ContactPickerPermissionView
          isDenied={true}
          onRequestPermission={requestPermission}
          onOpenSettings={openSettings}
          onManualInputPress={() => setShowManualInput(true)}
          testID={`${testID}-permission-denied`}
        />
      );
    }

    if (isLoading && contacts.length === 0) {
      return (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.accentPrimary ?? theme.linkPrimary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading contacts...</Text>
        </View>
      );
    }

    return (
      <View style={styles.listWrapper}>
        <View style={styles.searchContainer}>
          <ContactPickerSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={() => setSearchQuery('')}
            testID={`${testID}-search-bar`}
          />
        </View>

        {showQuickAddOption && (
          <Pressable
            style={[
              styles.quickAddRow,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
            onPress={handleQuickAdd}
            accessibilityRole="button"
            testID={`${testID}-quick-add-button`}
          >
            <View style={[styles.quickAddIconBox, { backgroundColor: theme.backgroundElement }]}>
              <Plus size={18} color={theme.accentPrimary ?? theme.linkPrimary} />
            </View>
            <View style={styles.quickAddTextColumn}>
              <Text style={[styles.quickAddTitle, { color: theme.accentPrimary ?? theme.linkPrimary }]} numberOfLines={1}>
                Add &quot;{trimmedQuery}&quot;
              </Text>
              <Text style={[styles.quickAddSubtitle, { color: theme.textSecondary }]}>
                Add custom WhatsApp number
              </Text>
            </View>
          </Pressable>
        )}

        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => `${item.id}-${item.normalizedPhoneNumber}`}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          ItemSeparatorComponent={() => (
            <View style={[styles.dividerWrapper, { backgroundColor: theme.cardBackground }]}>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            </View>
          )}
          renderItem={({ item }) => (
            <DeviceContactItemRow
              contact={item}
              onPress={onSelectContact}
              testID={`${testID}-contact-${item.id}`}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer} testID={`${testID}-empty-state`}>
              <Text style={[styles.emptyTitle, { color: theme.textTitle }]}>
                {searchQuery ? 'No contacts match your search' : 'No contacts found'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {searchQuery
                  ? 'Try searching with a different name or number'
                  : 'Your phonebook appears to be empty or has no numbers'}
              </Text>
              <Pressable
                style={styles.emptyManualButton}
                onPress={() => setShowManualInput(true)}
                accessibilityRole="button"
              >
                <Text style={[styles.emptyManualButtonText, { color: theme.accentPrimary ?? theme.linkPrimary }]}>
                  + Enter number manually
                </Text>
              </Pressable>
            </View>
          }
          style={[
            styles.flatList,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          contentContainerStyle={styles.flatListContent}
        />
      </View>
    );
  };

  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClose}
      showCloseButton={false}
      dragBehavior="resist"
      disableScrollView={true}
      dismissOnBackdropPress
      dismissOnRequestClose
      variant={variant}
      overlayZIndex={overlayZIndex}
      header={
        <View style={styles.headerRow} testID={`${testID}-header`}>
          <LiquidGlassBackButton
            onPress={showManualInput ? () => setShowManualInput(false) : onClose}
            testID={`${testID}-back-button`}
          />

          <Text style={[styles.headerTitle, { color: theme.textTitle }]} numberOfLines={1} testID={`${testID}-title`}>
            {showManualInput ? 'Add Number' : 'Select Contact'}
          </Text>

          <LiquidGlassIconButton
            onPress={() => setShowManualInput((prev) => !prev)}
            accessibilityLabel={showManualInput ? 'Contact List' : 'Add Manual'}
            testID={`${testID}-toggle-manual-button`}
          >
            <UserPlus size={18} color={theme.icon} />
          </LiquidGlassIconButton>
        </View>
      }
      sheetStyle={styles.sheetBackground}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, style]}
      >
        {renderContent()}
      </KeyboardAvoidingView>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: Tokens.layout.sheetRadius,
    borderTopRightRadius: Tokens.layout.sheetRadius,
    paddingTop: 16,
    paddingHorizontal: 16,
    height: '90%',
    maxHeight: '90%',
  },
  container: {
    flex: 1,
    paddingBottom: 16,
  },
  headerRow: {
    height: Tokens.layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: Tokens.typography.headerTitle.fontSize,
    fontWeight: Tokens.typography.headerTitle.fontWeight,
    lineHeight: Tokens.typography.headerTitle.lineHeight,
    color: Tokens.colors.headerTitle,
    textAlign: 'center',
  },
  listWrapper: {
    flex: 1,
  },
  searchContainer: {
    marginBottom: 12,
  },
  flatList: {
    flex: 1,
    backgroundColor: Tokens.colors.cardBackground,
    borderRadius: Tokens.layout.cardRadius,
    borderWidth: Tokens.layout.cardBorderWidth,
    borderColor: Tokens.colors.cardBorder,
    overflow: 'hidden',
  },
  flatListContent: {
    flexGrow: 1,
  },
  dividerWrapper: {
    paddingLeft: 64,
    backgroundColor: Tokens.colors.cardBackground,
  },
  divider: {
    height: 1,
    backgroundColor: Tokens.colors.divider,
  },
  quickAddRow: {
    backgroundColor: Tokens.colors.cardBackground,
    borderRadius: Tokens.layout.cardRadius,
    borderWidth: 1,
    borderColor: Tokens.colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 10,
  },
  quickAddIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddTextColumn: {
    flex: 1,
    gap: 2,
  },
  quickAddTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Tokens.colors.primaryActionText,
  },
  quickAddSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: Tokens.colors.phoneText,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: Tokens.colors.phoneText,
  },
  emptyContainer: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Tokens.colors.nameText,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: Tokens.colors.phoneText,
    textAlign: 'center',
  },
  emptyManualButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  emptyManualButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Tokens.colors.primaryActionText,
  },
  manualFormWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  manualFormSection: {
    gap: Tokens.layout.sectionGap,
  },
  manualFormSectionTitle: {
    fontSize: Tokens.typography.sectionTitle.fontSize,
    fontWeight: Tokens.typography.sectionTitle.fontWeight,
    lineHeight: Tokens.typography.sectionTitle.lineHeight,
    letterSpacing: Tokens.typography.sectionTitle.letterSpacing,
    color: Tokens.colors.sectionTitle,
    paddingLeft: Tokens.layout.sectionTitlePaddingLeft,
    textTransform: 'uppercase',
  },
  manualFormCard: {
    backgroundColor: Tokens.colors.cardBackground,
    borderRadius: Tokens.layout.cardRadius,
    borderWidth: Tokens.layout.cardBorderWidth,
    borderColor: Tokens.colors.cardBorder,
    padding: Tokens.layout.formCardPadding,
    gap: Tokens.layout.formCardGap,
  },
  inputGroup: {
    gap: Tokens.layout.inputGroupGap,
  },
  inputLabel: {
    fontSize: Tokens.typography.inputLabel.fontSize,
    fontWeight: Tokens.typography.inputLabel.fontWeight,
    lineHeight: Tokens.typography.inputLabel.lineHeight,
    color: Tokens.colors.phoneText,
  },
  formInput: {
    height: Tokens.layout.inputHeight,
    backgroundColor: Tokens.colors.inputBackground,
    borderWidth: 1,
    borderColor: Tokens.colors.inputBorder,
    borderRadius: Tokens.layout.inputRadius,
    paddingHorizontal: Tokens.layout.inputPaddingHorizontal,
    fontSize: Tokens.typography.formInput.fontSize,
    color: Tokens.colors.nameText,
  },
  manualFormActions: {
    alignItems: 'center',
    gap: Tokens.layout.formActionsGap,
    marginTop: 'auto',
    paddingTop: 16,
  },
  submitButton: {
    width: '100%',
    height: Tokens.layout.primaryButtonHeight,
    backgroundColor: Tokens.colors.primaryButtonBackground,
    borderRadius: Tokens.layout.primaryButtonRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonText: {
    color: Tokens.colors.primaryButtonText,
    fontSize: Tokens.typography.primaryButton.fontSize,
    fontWeight: Tokens.typography.primaryButton.fontWeight,
    lineHeight: Tokens.typography.primaryButton.lineHeight,
  },
  cancelButton: {
    paddingVertical: Tokens.layout.cancelButtonPaddingVertical,
    paddingHorizontal: Tokens.layout.cancelButtonPaddingHorizontal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonPressed: {
    opacity: 0.7,
  },
  cancelButtonText: {
    fontSize: Tokens.typography.cancelButton.fontSize,
    fontWeight: Tokens.typography.cancelButton.fontWeight,
    lineHeight: Tokens.typography.cancelButton.lineHeight,
    color: Tokens.colors.cancelButtonText,
  },
});
