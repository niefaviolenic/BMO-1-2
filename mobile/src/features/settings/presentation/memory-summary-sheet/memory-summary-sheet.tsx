import { RotateCw } from 'lucide-react-native';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { DotMatrixPattern } from '@/components/ui/dot-matrix-pattern';
import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { LiquidGlassIconButton } from '@/components/ui/liquid-glass-icon-button';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { MemorySummarySheetTokens, SettingsTokens } from '@/constants/theme';
import type {
  MemorySummarySection,
  MemorySummaryStatus,
} from '@/features/settings/domain/memory/types';

import { MemoryGeneratingTitle } from './components/memory-generating-title';
import { MemorySummaryComposer } from './components/memory-summary-composer';
import { MemorySummaryContent } from './components/memory-summary-content';

const tokens = MemorySummarySheetTokens;
const sheetTokens = SettingsTokens.sheet;

export type MemorySummarySheetProps = {
  isVisible: boolean;
  onClose: () => void;
  onMorePress?: () => void;
  onRegenerate?: () => void;
  onComposerSubmit?: (text: string) => void;
  sections?: MemorySummarySection[];
  status?: MemorySummaryStatus;
  subtitle?: string;
  variant?: 'modal' | 'overlay';
  overlayZIndex?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function subtitleForStatus(status: MemorySummaryStatus, subtitle?: string): string {
  if (subtitle) {
    return subtitle;
  }
  if (status === 'generating') {
    return 'Generating';
  }
  if (status === 'failed') {
    return 'Failed';
  }
  return 'Updated just now';
}

export function MemorySummarySheet({
  isVisible,
  onClose,
  onMorePress,
  onRegenerate,
  onComposerSubmit,
  sections = [],
  status = 'generating',
  subtitle,
  variant = 'overlay',
  overlayZIndex = SettingsTokens.sheetLayer.nested,
  style,
  testID = 'memory-summary-sheet',
}: MemorySummarySheetProps) {
  const theme = useTheme();
  const isGenerating = status === 'generating';
  const resolvedSubtitle = subtitleForStatus(status, subtitle);
  const showComposer = !isGenerating;
  const handleRegenerate = onRegenerate ?? onMorePress;

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
      overlay={
        showComposer ? (
          <MemorySummaryComposer
            onSubmit={onComposerSubmit}
            testID={`${testID}-composer`}
          />
        ) : undefined
      }
      header={
        <View style={styles.headerRow} testID={`${testID}-header`}>
          <LiquidGlassBackButton
            onPress={onClose}
            testID={`${testID}-back-button`}
          />
          <View style={styles.headerTitleSlot} pointerEvents="none">
            <MemoryGeneratingTitle
              subtitle={resolvedSubtitle}
              testID={`${testID}-title`}
            />
          </View>
          <LiquidGlassIconButton
            onPress={isGenerating ? undefined : handleRegenerate}
            accessibilityLabel="Regenerate summary"
            testID={`${testID}-regenerate-button`}
            style={isGenerating ? styles.regenerateButtonDisabled : undefined}
          >
            <RotateCw
              size={tokens.regenerateButtonIconSize}
              color={theme.icon}
              strokeWidth={1.75}
            />
          </LiquidGlassIconButton>
        </View>
      }
      sheetStyle={styles.sheetBackground}
      testID={testID}
    >
      <View style={[styles.content, style]} testID={`${testID}-content`}>
        {isGenerating ? (
          <View
            style={styles.generatingCanvas}
            testID={`${testID}-generating`}
          >
            <DotMatrixPattern
              animated
              style={styles.dotMatrix}
              testID={`${testID}-dot-matrix`}
            />
          </View>
        ) : sections.length === 0 ? (
          <Text style={styles.emptyText} testID={`${testID}-empty`}>
            {status === 'failed'
              ? 'Unable to generate a memory summary. Try again from the menu.'
              : 'No memories to summarize yet.'}
          </Text>
        ) : (
          <MemorySummaryContent
            sections={sections}
            testID={`${testID}-sections`}
          />
        )}
      </View>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: tokens.borderTopRadius,
    borderTopRightRadius: tokens.borderTopRadius,
    paddingTop: tokens.headerPaddingTop,
    paddingHorizontal: sheetTokens.contentPaddingHorizontal,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.headerPaddingBottom,
    minHeight: 40,
  },
  headerTitleSlot: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regenerateButtonDisabled: {
    opacity: tokens.flashMinOpacity,
  },
  content: {
    width: '100%',
    flexGrow: 1,
    paddingTop: tokens.contentPaddingTop,
    paddingBottom: tokens.contentPaddingBottom,
    paddingHorizontal: 4,
  },
  generatingCanvas: {
    width: '100%',
    alignItems: 'center',
    paddingTop: tokens.generatingCanvasPaddingTop,
    overflow: 'hidden',
  },
  dotMatrix: {
    maxWidth: '100%',
  },
  emptyText: {
    paddingTop: tokens.emptyStatePaddingTop,
    fontSize: tokens.sectionBodyFont.fontSize,
    fontWeight: tokens.sectionBodyFont.fontWeight,
    color: tokens.titleColumn.subtitleFont.color,
    textAlign: 'center',
  },
});
