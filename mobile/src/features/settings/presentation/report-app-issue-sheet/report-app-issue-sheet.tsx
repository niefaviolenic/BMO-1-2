import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassCloseButton } from '@/components/ui/liquid-glass-close-button';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { SettingsTokens } from '@/constants/theme';
import { BugReportTextareaCard } from '@/features/settings/components/bug-report-textarea-card';
import { BugReportTogglesCard } from '@/features/settings/components/bug-report-toggles-card';
import { BUG_REPORT_SUPPORT_URLS } from '@/features/settings/data/bug-report/support-urls';
import type { BugReportDraft } from '@/features/settings/domain/bug-report/types';

const sheetTokens = SettingsTokens.sheet;
const tokens = SettingsTokens.reportAppIssueSheet;

const EMPTY_DRAFT: BugReportDraft = {
  description: '',
  includeScreenshot: false,
  screenshotUris: [],
};

export type ReportAppIssueSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  onSend?: (draft: BugReportDraft) => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  initialDraft?: BugReportDraft;
  supportUrl?: string;
  variant?: 'modal' | 'overlay';
  overlayZIndex?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ReportAppIssueSheet({
  isVisible,
  onClose,
  onSend,
  isSubmitting = false,
  errorMessage,
  initialDraft,
  supportUrl = BUG_REPORT_SUPPORT_URLS.supportUrl,
  variant = 'overlay',
  overlayZIndex = SettingsTokens.sheetLayer.report,
  style,
  testID = 'report-app-issue-sheet',
}: ReportAppIssueSheetProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState<BugReportDraft>(initialDraft ?? EMPTY_DRAFT);

  useEffect(() => {
    if (isVisible) {
      setDraft(initialDraft ?? EMPTY_DRAFT);
    }
  }, [isVisible, initialDraft]);

  const canSend = !isSubmitting && draft.description.trim().length > 0;

  const handleContactSupport = useCallback(() => {
    Linking.openURL(supportUrl).catch(() => {});
  }, [supportUrl]);

  const handleAddScreenshot = useCallback(async () => {
    if (draft.screenshotUris.length >= tokens.maxScreenshots) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    const uri = result.assets[0].uri;
    setDraft((prev) => {
      if (prev.screenshotUris.length >= tokens.maxScreenshots) {
        return prev;
      }
      return {
        ...prev,
        screenshotUris: [...prev.screenshotUris, uri],
      };
    });
  }, [draft.screenshotUris.length]);

  const handleRemoveScreenshot = useCallback((index: number) => {
    setDraft((prev) => ({
      ...prev,
      screenshotUris: prev.screenshotUris.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend || isSubmitting) {
      return;
    }
    onSend?.(draft);
    if (isSubmitting === undefined) {
      onClose();
    }
  }, [canSend, draft, isSubmitting, onClose, onSend]);
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
          <View
            style={styles.headerPlaceholder}
            testID={`${testID}-header-spacer`}
          />
          <View style={styles.headerTitleSlot} pointerEvents="none">
            <Text
              style={[styles.headerTitle, { color: theme.textTitle }]}
              numberOfLines={1}
              testID={`${testID}-title`}
            >
              Report app issue
            </Text>
          </View>
          <LiquidGlassCloseButton
            onPress={onClose}
            testID={`${testID}-close-button`}
          />
        </View>
      }
      sheetStyle={styles.sheetBackground}
      testID={testID}
    >
      <View style={[styles.content, style]} testID={`${testID}-content`}>
        {errorMessage ? (
          <Text style={styles.errorText} testID={`${testID}-error-text`}>
            {errorMessage}
          </Text>
        ) : null}

        <BugReportTextareaCard
          value={draft.description}
          onChangeText={(description) =>
            setDraft((prev) => ({ ...prev, description }))
          }
          testID={`${testID}-textarea`}
        />
        <Text style={[styles.disclaimer, { color: theme.textSecondary }]} testID={`${testID}-disclaimer`}>
          Any information you share may be reviewed to help improve Joy. If you
          have additional questions,{' '}
          <Text
            style={[styles.disclaimerLink, { color: theme.linkPrimary }]}
            onPress={handleContactSupport}
            accessibilityRole="link"
            testID={`${testID}-contact-support`}
          >
            contact support
          </Text>
          .
        </Text>

        <BugReportTogglesCard
          includeScreenshot={draft.includeScreenshot}
          onIncludeScreenshotChange={(includeScreenshot) =>
            setDraft((prev) => ({ ...prev, includeScreenshot }))
          }
          screenshots={draft.screenshotUris}
          onAddScreenshot={handleAddScreenshot}
          onRemoveScreenshot={handleRemoveScreenshot}
          maxScreenshots={tokens.maxScreenshots}
          testID={`${testID}-toggles`}
        />

        <View style={styles.spacer} />

        <Pressable
          onPress={handleSend}
          disabled={!canSend || isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !canSend || isSubmitting, busy: isSubmitting }}
          testID={`${testID}-send-button`}
          style={({ pressed }) => [
            styles.sendButton,
            canSend
              ? { backgroundColor: theme.text }
              : styles.sendButtonDisabled,
            pressed && canSend ? styles.sendButtonPressed : null,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator
              size="small"
              color={theme.background}
              testID={`${testID}-spinner`}
            />
          ) : (
            <Text
              style={[
                styles.sendButtonText,
                canSend ? { color: theme.background } : null,
              ]}
              testID={`${testID}-send-label`}
            >
              Send
            </Text>
          )}
        </Pressable>
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
    flexGrow: 1,
    gap: tokens.contentGap,
    paddingTop: tokens.contentPaddingTop,
    paddingBottom: tokens.contentPaddingBottom,
  },
  disclaimer: {
    fontSize: tokens.disclaimerFontSize,
    lineHeight: tokens.disclaimerLineHeight,
    fontWeight: '400',
    color: tokens.disclaimerColor,
  },
  disclaimerLink: {
    color: tokens.disclaimerLinkColor,
  },
  spacer: {
    flexGrow: 1,
    minHeight: 16,
  },
  sendButton: {
    width: '100%',
    height: tokens.sendButtonHeight,
    borderRadius: tokens.sendButtonRadius,
    backgroundColor: tokens.sendButtonBackgroundEnabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: tokens.sendButtonBackgroundDisabled,
  },
  sendButtonPressed: {
    opacity: 0.85,
  },
  sendButtonText: {
    fontSize: tokens.sendButtonFontSize,
    fontWeight: tokens.sendButtonFontWeight,
    color: tokens.sendButtonTextColor,
  },
  errorText: {
    width: '100%',
    fontSize: tokens.errorFontSize,
    lineHeight: tokens.errorLineHeight,
    color: tokens.errorColor,
    paddingHorizontal: 4,
  },
});
