import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { SettingsTokens } from '@/constants/theme';
import type { AboutInfo } from '@/features/settings/domain/about/types';
import { AboutLinksCard } from './components';
const sheetTokens = SettingsTokens.sheet;
const tokens = SettingsTokens.aboutSheet;

export type AboutSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  aboutInfo?: AboutInfo;
  onTermsPress?: () => void;
  onPrivacyPress?: () => void;
  variant?: 'modal' | 'overlay';
  overlayZIndex?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function AboutSheet({
  isVisible,
  onClose,
  aboutInfo,
  onTermsPress,
  onPrivacyPress,
  variant = 'overlay',
  overlayZIndex = SettingsTokens.sheetLayer.about,
  style,
  testID = 'about-sheet',
}: AboutSheetProps) {
  const theme = useTheme();
  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClose}
      variant={variant}
      overlayZIndex={overlayZIndex}
      showCloseButton={false}
      dragBehavior="resist"
      dismissOnBackdropPress={false}
      dismissOnRequestClose={false}
      header={
        <View style={styles.headerRow} testID={`${testID}-header`}>
          <LiquidGlassBackButton
            onPress={onClose}
            testID={`${testID}-back-button`}
          />
          <View style={styles.headerTitleSlot} pointerEvents="none">
            <Text
              style={[styles.headerTitle, { color: theme.textTitle }]}
              numberOfLines={1}
              testID={`${testID}-title`}
            >
              About
            </Text>
          </View>
          <View
            style={styles.headerPlaceholder}
            testID={`${testID}-header-spacer`}
          />
        </View>
      }
      sheetStyle={styles.sheetBackground}
      testID={testID}
    >
      <View style={[styles.content, style]} testID={`${testID}-content`}>
        <AboutLinksCard
          aboutInfo={aboutInfo}
          onTermsPress={onTermsPress}
          onPrivacyPress={onPrivacyPress}
          testID={`${testID}-links`}
        />
      </View>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: sheetTokens.borderTopRadius,
    borderTopRightRadius: sheetTokens.borderTopRadius,
    paddingTop: tokens.headerPaddingTop,
    paddingHorizontal: sheetTokens.contentPaddingHorizontal,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.headerPaddingBottom,
    minHeight: tokens.headerButtonSize,
  },
  headerTitleSlot: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: tokens.headerTitleFontSize,
    fontWeight: '700',
    color: tokens.headerTitleColor,
  },
  headerPlaceholder: {
    width: tokens.headerButtonSize,
    height: tokens.headerButtonSize,
  },
  content: {
    width: '100%',
    paddingTop: tokens.contentPaddingTop,
    paddingBottom: tokens.contentPaddingBottom,
  },
});
