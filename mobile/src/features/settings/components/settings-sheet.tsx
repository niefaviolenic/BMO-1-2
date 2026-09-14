import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useRouter } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { AnimatedDropdownOverlay } from '@/components/ui/animated-dropdown-overlay';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { SettingsTokens } from '@/constants/theme';
import { useOptionalAuthSession } from '@/features/auth/presentation/auth-session-provider';
import { updateProfile } from '@/features/settings/data/profile-api';
import {
  normalizeUsername,
  USERNAME_PATTERN,
} from '@/features/settings/domain/account/profile';
import type { ProfilePatchInput } from '@/features/settings/domain/account/types';
import {
  EditProfileModal,
  type EditProfileSavePayload,
} from '../presentation/edit-profile-sheet';
import { useAppearance } from '../presentation/use-appearance';
import { useAccentColor } from '../presentation/use-accent-color';
import { type AppearanceMode, type AccentColorMode } from '../domain/theme/types';
import { AppearancePickerDropdown } from './appearance-picker-dropdown';
import { AccentColorPickerDropdown } from './accent-color-picker-dropdown';
import { ProfileHeaderBlock } from './profile-header-block';
import { SettingsAccountSection } from './settings-account-section';
import { SettingsChatGPTSection } from './settings-chatgpt-section';
import { SettingsHelpSection } from './settings-help-section';
import { SettingsLogoutCard } from './settings-logout-card';
import { SettingsThemeSection } from './settings-theme-section';

const HEADER_BAR_OFFSET = 64;

const sheetTokens = SettingsTokens.sheet;

export type SettingsSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  name?: string;
  avatarSource?: string | number;
  email?: string;
  subscription?: string;
  appearanceValue?: string;
  accentColorLabel?: string;
  accentColorDot?: string;
  onEditPress?: () => void;
  onPersonalizationPress?: () => void;
  onMemoryPress?: () => void;
  onPluginsPress?: () => void;
  onEmailPress?: () => void;
  onSubscriptionPress?: () => void;
  onUpgradePress?: () => void;
  onAppearancePress?: () => void;
  onAccentColorPress?: () => void;
  onReportPress?: () => void;
  onAboutPress?: () => void;
  onLogoutPress?: () => void;
  variant?: 'modal' | 'overlay';
  overlayZIndex?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SettingsSheet({
  isVisible,
  onClose,
  name,
  avatarSource,
  email,
  subscription = 'Free',
  appearanceValue,
  accentColorLabel,
  accentColorDot,
  onEditPress,
  onPersonalizationPress,
  onMemoryPress,
  onPluginsPress,
  onEmailPress,
  onSubscriptionPress,
  onUpgradePress,
  onAppearancePress,
  onAccentColorPress,
  onReportPress,
  onAboutPress,
  onLogoutPress,
  variant = 'overlay',
  overlayZIndex = SettingsTokens.sheetLayer.settings,
  style,
  testID = 'settings-sheet',
}: SettingsSheetProps) {
  const theme = useTheme();
  const router = useRouter();
  const auth = useOptionalAuthSession();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileName, setProfileName] = useState(name ?? '');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileAvatarUri, setProfileAvatarUri] = useState<string | undefined>(
    typeof avatarSource === 'string' ? avatarSource : undefined,
  );
  const { appearance, appearanceLabel, setAppearance } = useAppearance();
  const {
    accent,
    accentLabel,
    accentDot: hookAccentDot,
    setAccent,
  } = useAccentColor();
  const sheetHostRef = useRef<View>(null);
  const [showAppearanceDropdown, setShowAppearanceDropdown] = useState(false);
  const [showAccentDropdown, setShowAccentDropdown] = useState(false);
  const [themeSectionY, setThemeSectionY] = useState(480);
  const [dropdownTop, setDropdownTop] = useState<number | null>(null);
  const [accentDropdownTop, setAccentDropdownTop] = useState<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const resolvedAppearanceValue = appearanceValue ?? appearanceLabel;
  const resolvedAccentColorLabel = accentColorLabel ?? accentLabel;
  const resolvedAccentColorDot = accentColorDot ?? hookAccentDot;

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      setShowAppearanceDropdown(false);
      setShowAccentDropdown(false);
    },
    [],
  );

  const handleScrollBeginDrag = useCallback(() => {
    setShowAppearanceDropdown(false);
    setShowAccentDropdown(false);
  }, []);

  const handleAppearancePress = useCallback(
    (_anchor?: { y: number; height: number }) => {
      if (onAppearancePress) {
        onAppearancePress();
        return;
      }
      setShowAccentDropdown(false);
      const calculatedTop =
        HEADER_BAR_OFFSET +
        themeSectionY +
        SettingsTokens.themeSection.headerLineHeight +
        SettingsTokens.themeSection.gap +
        SettingsTokens.themeSection.rowHeight +
        SettingsTokens.appearanceDropdown.topGap -
        scrollOffsetRef.current;

      setDropdownTop(calculatedTop);
      setShowAppearanceDropdown(true);
    },
    [onAppearancePress, themeSectionY],
  );

  const handleAccentColorPress = useCallback(
    (_anchor?: { y: number; height: number }) => {
      if (onAccentColorPress) {
        onAccentColorPress();
        return;
      }
      setShowAppearanceDropdown(false);
      const calculatedTop =
        HEADER_BAR_OFFSET +
        themeSectionY +
        SettingsTokens.themeSection.headerLineHeight +
        SettingsTokens.themeSection.gap +
        SettingsTokens.themeSection.rowHeight +
        1 +
        SettingsTokens.themeSection.rowHeight +
        SettingsTokens.accentDropdown.topGap -
        scrollOffsetRef.current;

      setAccentDropdownTop(calculatedTop);
      setShowAccentDropdown(true);
    },
    [onAccentColorPress, themeSectionY],
  );

  const handleSelectAppearance = useCallback(
    async (mode: AppearanceMode) => {
      await setAppearance(mode);
      setShowAppearanceDropdown(false);
    },
    [setAppearance],
  );

  const handleSelectAccent = useCallback(
    async (mode: AccentColorMode) => {
      await setAccent(mode);
      setShowAccentDropdown(false);
    },
    [setAccent],
  );

  const handleThemeSectionLayout = useCallback((event: LayoutChangeEvent) => {
    setThemeSectionY(event.nativeEvent.layout.y);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      setShowEditProfile(false);
      setShowAppearanceDropdown(false);
      setShowAccentDropdown(false);
    }
  }, [isVisible]);

  useEffect(() => {
    setProfileName(name ?? '');
  }, [name]);

  useEffect(() => {
    if (!auth?.user) {
      return;
    }
    setProfileName(auth.user.displayName ?? auth.user.username ?? name ?? '');
    setProfileUsername(auth.user.username ?? '');
    if (auth.user.avatarUrl) {
      setProfileAvatarUri(auth.user.avatarUrl);
    }
  }, [auth?.user, name]);

  useEffect(() => {
    if (avatarSource !== undefined) {
      setProfileAvatarUri(typeof avatarSource === 'string' ? avatarSource : undefined);
    }
  }, [avatarSource]);

  const handleEditPress = useCallback(() => {
    if (onEditPress) {
      onEditPress();
      return;
    }
    setShowEditProfile(true);
  }, [onEditPress]);

  const handleEditCancel = useCallback(() => {
    setShowEditProfile(false);
  }, []);

  const handleEditSave = useCallback(
    async (payload: EditProfileSavePayload) => {
      const trimmedName = payload.name.trim();
      const rawUsername = payload.username.trim();
      const normalizedUser = normalizeUsername(rawUsername);
      const isNameChanged = trimmedName !== profileName.trim();
      const isUsernameChanged = Boolean(rawUsername && normalizedUser !== profileUsername);
      const hasChanges = isNameChanged || isUsernameChanged;
      if (!hasChanges) {
        setShowEditProfile(false);
        return;
      }

      const patch: ProfilePatchInput = {};
      if (isNameChanged) {
        patch.displayName = trimmedName;
      }
      if (isUsernameChanged) {
        if (!USERNAME_PATTERN.test(normalizedUser)) {
          throw new Error('Username may only contain letters, numbers, underscores, or periods (3-30 chars)');
        }
        patch.username = normalizedUser;
      }



      if (Object.keys(patch).length > 0) {
        const updated = await updateProfile(patch);
        if (updated.displayName !== undefined) {
          setProfileName(updated.displayName ?? '');
        }
        if (updated.username !== undefined) {
          setProfileUsername(updated.username ?? '');
        }
        if (updated.avatarUrl !== undefined) {
          setProfileAvatarUri(updated.avatarUrl ?? undefined);
        }
      }

      setShowEditProfile(false);
    },
    [profileName, profileUsername],
  );

  const handleLogout = useCallback(() => {
    if (onLogoutPress) {
      onLogoutPress();
      return;
    }
    if (auth?.logout) {
      void auth.logout();
      onClose();
      router.replace('/auth');
    }
  }, [auth, onClose, onLogoutPress, router]);

  const resolvedName = profileName || name || auth?.user?.displayName || auth?.user?.username || 'Joy User';
  const resolvedEmail = email || auth?.user?.email || '';
  const resolvedAvatarSource = profileAvatarUri ?? avatarSource;

  return (
    <>
      <ModalBottomSheet
        isVisible={isVisible}
        onClose={onClose}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        variant={variant}
        overlayZIndex={overlayZIndex}
        showCloseButton
        dragBehavior="resist"
        dismissOnBackdropPress={false}
        dismissOnRequestClose={false}
        sheetStyle={[styles.sheetBackground, { backgroundColor: theme.sheetBackground }]}
        closeButtonTestID={`${testID}-close-button`}
        overlay={
          <>
            <AnimatedDropdownOverlay
              isOpen={showAppearanceDropdown}
              onClose={() => setShowAppearanceDropdown(false)}
              backdropStyle={styles.dropdownBackdrop}
              containerStyle={[
                styles.dropdownContainer,
                {
                  top:
                    dropdownTop ??
                    HEADER_BAR_OFFSET +
                      themeSectionY +
                      SettingsTokens.themeSection.headerLineHeight +
                      SettingsTokens.themeSection.gap +
                      SettingsTokens.themeSection.rowHeight +
                      SettingsTokens.appearanceDropdown.topGap,
                  right: SettingsTokens.appearanceDropdown.rightOffset,
                },
              ]}
              testID={`${testID}-appearance-dropdown-overlay`}
            >
              <AppearancePickerDropdown
                selectedAppearance={appearance}
                onSelectAppearance={handleSelectAppearance}
                testID={`${testID}-appearance-picker`}
              />
            </AnimatedDropdownOverlay>

            <AnimatedDropdownOverlay
              isOpen={showAccentDropdown}
              onClose={() => setShowAccentDropdown(false)}
              backdropStyle={styles.dropdownBackdrop}
              containerStyle={[
                styles.dropdownContainer,
                {
                  top:
                    accentDropdownTop ??
                    HEADER_BAR_OFFSET +
                      themeSectionY +
                      SettingsTokens.themeSection.headerLineHeight +
                      SettingsTokens.themeSection.gap +
                      SettingsTokens.themeSection.rowHeight +
                      1 +
                      SettingsTokens.themeSection.rowHeight +
                      SettingsTokens.accentDropdown.topGap,
                  right: SettingsTokens.accentDropdown.rightOffset,
                },
              ]}
              testID={`${testID}-accent-dropdown-overlay`}
            >
              <AccentColorPickerDropdown
                selectedAccent={accent}
                onSelectAccent={handleSelectAccent}
                testID={`${testID}-accent-picker`}
              />
            </AnimatedDropdownOverlay>
          </>
        }
        testID={testID}
      >
        <View
          ref={sheetHostRef}
          collapsable={false}
          style={[styles.content, style]}
          testID={`${testID}-content`}
        >
          <ProfileHeaderBlock
            name={resolvedName}
            avatarSource={resolvedAvatarSource}
            onEditPress={handleEditPress}
            testID={`${testID}-profile`}
          />

          <SettingsChatGPTSection
            onPersonalizationPress={onPersonalizationPress}
            onMemoryPress={onMemoryPress}
            onPluginsPress={onPluginsPress}
            testID={`${testID}-customize`}
          />

          <SettingsAccountSection
            email={resolvedEmail}
            subscription={subscription}
            onEmailPress={onEmailPress}
            onSubscriptionPress={onSubscriptionPress}
            onUpgradePress={onUpgradePress}
            testID={`${testID}-account`}
          />

          <SettingsThemeSection
            appearanceValue={resolvedAppearanceValue}
            accentColorLabel={resolvedAccentColorLabel}
            accentColorDot={resolvedAccentColorDot}
            onAppearancePress={handleAppearancePress}
            onAccentColorPress={handleAccentColorPress}
            onLayout={handleThemeSectionLayout}
            testID={`${testID}-theme`}
          />

          <SettingsHelpSection
            onReportPress={onReportPress}
            onAboutPress={onAboutPress}
            testID={`${testID}-help`}
          />

          <SettingsLogoutCard
            onPress={handleLogout}
            testID={`${testID}-logout`}
          />
        </View>
      </ModalBottomSheet>

      <EditProfileModal
        visible={isVisible && showEditProfile}
        name={profileName}
        username={profileUsername}
        avatarUri={profileAvatarUri ?? (typeof auth?.user?.avatarUrl === 'string' ? auth.user.avatarUrl : undefined)}
        onSave={handleEditSave}
        onCancel={handleEditCancel}
        variant={variant}
        overlayZIndex={SettingsTokens.sheetLayer.modal}
        testID={`${testID}-edit-profile`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: sheetTokens.borderTopRadius,
    borderTopRightRadius: sheetTokens.borderTopRadius,
    paddingHorizontal: sheetTokens.contentPaddingHorizontal,
  },
  content: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    gap: sheetTokens.contentGap,
    paddingBottom: sheetTokens.contentPaddingBottom,
  },
  dropdownBackdrop: {
    backgroundColor: 'transparent',
  },
  dropdownContainer: {
    position: 'absolute',
    padding: 0,
    zIndex: 999,
    elevation: 999,
  },
});
