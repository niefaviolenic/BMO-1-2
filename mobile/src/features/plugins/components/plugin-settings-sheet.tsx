import { Ellipsis } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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
import { AnimatedDropdownOverlay } from '@/components/ui/animated-dropdown-overlay';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PluginConnectedAccountCard } from './plugin-connected-account-card';
import { PluginPermissionsCard } from './plugin-permissions-card';
import { PluginReadActionsSection, type ReadActionItem } from './plugin-read-actions-section';
import { PluginSkillsSection, type SkillItem } from './plugin-skills-section';

export type PluginSettingsSheetProps = {
  /** Whether the settings sheet is visible */
  isVisible: boolean;
  /** Callback fired when sheet is closed */
  onClose: () => void;
  /** Title/Name of the plugin (e.g. "WhatsApp") */
  pluginTitle?: string;
  /** Account connection status description (e.g. "Connected to +62 812-3456-7890") */
  pluginSubtitle?: string;
  /** Remote URL for plugin logo */
  logoUrl?: string;
  /** Custom React node for plugin logo */
  pluginLogo?: React.ReactNode;
  /** Current permissions setting label (e.g. "Allow low-risk") */
  permissionsValue?: string;
  /** List of skills for the plugin */
  skills?: SkillItem[];
  /** List of read actions for the plugin */
  readActions?: ReadActionItem[];
  /** Callback fired when permissions card is pressed */
  onPermissionsPress?: () => void;
  /** Callback fired when a skill item is pressed */
  onSkillPress?: (id: string) => void;
  /** Callback fired when a read action item is pressed */
  onReadActionPress?: (id: string) => void;
  /** Callback fired when the top-right more button is pressed */
  onMorePress?: () => void;
  /** Callback fired when Reconnect is pressed in dropdown */
  onReconnectPress?: () => void;
  /** Callback fired when Uninstall is pressed in dropdown */
  onUninstallPress?: () => void;
  /** Custom items for dropdown menu */
  dropdownItems?: DropdownMenuItem[];
  /** Custom container style override */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing */
  testID?: string;
};

const DEFAULT_SHEET_SKILLS: SkillItem[] = [
  { id: 'whatsapp-send-messages', name: 'whatsapp-send-messages' },
  { id: 'whatsapp-read-chat', name: 'whatsapp-read-chat' },
  { id: 'whatsapp-voice-notes', name: 'whatsapp-voice-notes' },
  { id: 'whatsapp-send-media', name: 'whatsapp-send-media' },
];

const DEFAULT_READ_ACTIONS: ReadActionItem[] = [
  { id: 'check-linked-status', name: 'Check linked status' },
  { id: 'fetch-notifications', name: 'Fetch notifications' },
  { id: 'sync-messages', name: 'Sync messages' },
];

export function PluginSettingsSheet({
  isVisible,
  onClose,
  pluginTitle = 'WhatsApp',
  pluginSubtitle = 'Connected',
  logoUrl,
  pluginLogo,
  permissionsValue = 'Allow low-risk',
  skills = DEFAULT_SHEET_SKILLS,
  readActions = DEFAULT_READ_ACTIONS,
  onPermissionsPress,
  onSkillPress,
  onReadActionPress,
  onMorePress,
  onReconnectPress,
  onUninstallPress,
  dropdownItems,
  style,
  testID = 'plugin-settings-sheet',
}: PluginSettingsSheetProps) {
  const theme = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setIsDropdownOpen(false);
    }
  }, [isVisible]);

  const defaultDropdownItems: DropdownMenuItem[] = [
    {
      id: 'reconnect',
      label: 'Reconnect',
      iconName: 'refresh-cw',
      onPress: () => {
        setIsDropdownOpen(false);
        onReconnectPress?.();
      },
    },
    {
      id: 'uninstall',
      label: 'Uninstall',
      iconName: 'circle-minus',
      isDestructive: true,
      showDivider: true,
      onPress: () => {
        setIsDropdownOpen(false);
        if (onUninstallPress) {
          onUninstallPress();
        } else if (onMorePress) {
          onMorePress();
        }
      },
    },
  ];

  const menuItems = dropdownItems ?? defaultDropdownItems;

  const handleCloseSheet = () => {
    setIsDropdownOpen(false);
    onClose();
  };

  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={handleCloseSheet}
      onScroll={() => setIsDropdownOpen(false)}
      onScrollBeginDrag={() => setIsDropdownOpen(false)}
      showCloseButton={false}
      dragBehavior="resist"
      dismissOnBackdropPress={false}
      dismissOnRequestClose={false}
      header={
       <View style={styles.headerRow} testID={`${testID}-header`}>
         <LiquidGlassBackButton
           onPress={handleCloseSheet}
           testID={`${testID}-back-button`}
         />

         <Text style={[styles.headerTitle, { color: theme.textTitle }]} numberOfLines={1} testID={`${testID}-title`}>
           {pluginTitle}
         </Text>

         <LiquidGlassIconButton
           onPress={() => setIsDropdownOpen((prev) => !prev)}
           accessibilityLabel="More options"
           testID={`${testID}-more-button`}
         >
           <Ellipsis size={20} color={theme.icon} />
         </LiquidGlassIconButton>
       </View>
     }
    overlay={
      <AnimatedDropdownOverlay
        isOpen={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
        backdropStyle={styles.dropdownBackdrop}
        containerStyle={styles.dropdownWrapper}
        testID={`${testID}-dropdown-overlay`}
      >
        <DropdownMenu items={menuItems} testID={`${testID}-dropdown-menu`} />
      </AnimatedDropdownOverlay>
    }
     sheetStyle={styles.sheetBackground}
     testID={testID}
   >
     <View style={[styles.container, style]} testID={`${testID}-content`}>

       {/* Connected Account Card */}
        <PluginConnectedAccountCard
          title={pluginTitle}
          subtitle={pluginSubtitle}
          logoUrl={logoUrl}
          logoComponent={pluginLogo}
          testID={`${testID}-connected-card`}
        />

        {/* Permissions Card */}
        <PluginPermissionsCard
          value={permissionsValue}
          onPress={onPermissionsPress}
          testID={`${testID}-permissions-card`}
        />

        {/* Skills Section */}
        <PluginSkillsSection
          skills={skills}
          variant="card"
          onSkillPress={onSkillPress}
          testID={`${testID}-skills-section`}
        />

        {/* Read Actions Section */}
        <PluginReadActionsSection
          actions={readActions}
          onActionPress={onReadActionPress}
          testID={`${testID}-read-actions-section`}
        />
      </View>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  container: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 24,
  },
 headerRow: {
   width: '100%',
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   marginBottom: 12,
   overflow: 'visible',
   zIndex: 100,
   elevation: 100,
   position: 'relative',
 },
 dropdownBackdrop: {
   position: 'absolute',
   top: 0,
   left: 0,
   right: 0,
   bottom: 0,
   zIndex: 999,
 },
  dropdownWrapper: {
    position: 'absolute',
    top: 52,
    right: 0,
    padding: 16,
    zIndex: 1000,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F1729',
    textAlign: 'center',
  },
});
