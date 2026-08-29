import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { HeaderSaveButton } from '@/components/ui/header-save-button';
import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { SettingsTokens } from '@/constants/theme';
import {
  EMPTY_MEMORY_SETTINGS,
  MEMORY_FIELD_PLACEHOLDERS,
} from '@/features/settings/data/memory/dummy-memory';
import type { MemorySettings } from '@/features/settings/domain/memory/types';

import {
  EnableMemorySection,
  MemorySummaryRow,
  MemoryTextField,
} from './components';

const sheetTokens = SettingsTokens.sheet;
const tokens = SettingsTokens.memorySheet;

export type MemorySheetProps = {
  isVisible: boolean;
  onClose: () => void;
  onSave?: (values: MemorySettings) => void | Promise<void>;
  onMemorySummaryPress?: () => void;
  onLearnMorePress?: () => void;
  onCustomInstructionsPress?: () => void;
  initialValues?: Partial<MemorySettings>;
  variant?: 'modal' | 'overlay';
  overlayZIndex?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function MemorySheet({
  isVisible,
  onClose,
  onSave,
  onMemorySummaryPress,
  onLearnMorePress,
  onCustomInstructionsPress,
  initialValues,
  variant = 'overlay',
  overlayZIndex = SettingsTokens.sheetLayer.memory,
  style,
  testID = 'memory-sheet',
}: MemorySheetProps) {
  const theme = useTheme();
  const [values, setValues] = useState<MemorySettings>({
    ...EMPTY_MEMORY_SETTINGS,
    ...initialValues,
  });

  useEffect(() => {
    if (!isVisible) return;
    setValues({
      ...EMPTY_MEMORY_SETTINGS,
      ...initialValues,
    });
  }, [
    isVisible,
    initialValues?.enableMemory,
    initialValues?.nickname,
    initialValues?.occupation,
    initialValues?.moreAboutYou,
  ]);

  const handleSave = async () => {
    try {
      await onSave?.(values);
      onClose();
    } catch {
      // Parent already surfaced the error.
    }
  };

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
              Memory
            </Text>
          </View>
          <HeaderSaveButton
            label="Save"
            onPress={handleSave}
            testID={`${testID}-save-button`}
          />
        </View>
      }
      sheetStyle={styles.sheetBackground}
      testID={testID}
    >
      <View style={[styles.content, style]} testID={`${testID}-content`}>
        <EnableMemorySection
          value={values.enableMemory}
          onValueChange={(enableMemory) =>
            setValues((prev) => ({ ...prev, enableMemory }))
          }
          onLearnMorePress={onLearnMorePress}
          testID={`${testID}-enable`}
        />

        <MemorySummaryRow
          onPress={onMemorySummaryPress}
          onCustomInstructionsPress={onCustomInstructionsPress}
          testID={`${testID}-summary-row`}
        />

        <MemoryTextField
          label="Your nickname"
          value={values.nickname}
          onChangeText={(nickname) =>
            setValues((prev) => ({ ...prev, nickname }))
          }
          testID={`${testID}-nickname`}
        />

        <MemoryTextField
          label="Your occupation"
          value={values.occupation}
          onChangeText={(occupation) =>
            setValues((prev) => ({ ...prev, occupation }))
          }
          placeholder={MEMORY_FIELD_PLACEHOLDERS.occupation}
          testID={`${testID}-occupation`}
        />

        <MemoryTextField
          label="More about you"
          value={values.moreAboutYou}
          onChangeText={(moreAboutYou) =>
            setValues((prev) => ({ ...prev, moreAboutYou }))
          }
          placeholder={MEMORY_FIELD_PLACEHOLDERS.moreAboutYou}
          testID={`${testID}-more-about-you`}
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
    minHeight: 40,
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
  content: {
    width: '100%',
    gap: tokens.contentGap,
    paddingTop: tokens.contentPaddingTop,
    paddingBottom: tokens.contentPaddingBottom,
  },
});
