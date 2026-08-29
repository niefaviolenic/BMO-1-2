import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { AnimatedDropdownOverlay } from '@/components/ui/animated-dropdown-overlay';
import { HeaderSaveButton } from '@/components/ui/header-save-button';
import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { SettingsTokens } from '@/constants/theme';
import { OccupationCardContainer } from '@/features/settings/components/occupation-card-container';
import {
  PersonalizationPickerDropdown,
  formatOptionLabel,
} from '@/features/settings/components/personalization-picker-dropdown';
import { StyleToneRow } from '@/features/settings/components/style-tone-row';

import { FastAnswersSection } from './fast-answers-section';
import { PersonalizationAttributeCard } from './personalization-attribute-card';
const sheetTokens = SettingsTokens.sheet;
const tokens = SettingsTokens.personalizationSheet;

export type PersonalizationFormValues = {
  baseStyleTone: string;
  warmth: string;
  enthusiasm: string;
  headerAndLists: string;
  emoji: string;
  fastAnswers: boolean;
  customInstructions: string;
};

export type PersonalizationSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  onSave?: (values: PersonalizationFormValues) => void | Promise<void>;
  initialValues?: Partial<PersonalizationFormValues>;
  saving?: boolean;
  errorMessage?: string | null;
  onBaseStyleTonePress?: () => void;
  onWarmthPress?: () => void;
  onEnthusiasmPress?: () => void;
  onHeaderAndListsPress?: () => void;
  onEmojiPress?: () => void;
  variant?: 'modal' | 'overlay';
  overlayZIndex?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_VALUES: PersonalizationFormValues = {
  baseStyleTone: 'default',
  warmth: 'default',
  enthusiasm: 'default',
  headerAndLists: 'default',
  emoji: 'default',
  fastAnswers: false,
  customInstructions: '',
};

const TONE_OPTIONS = ['default', 'casual', 'cynical'] as const;
const INTENSITY_OPTIONS = ['default', 'more', 'less'] as const;

type ActiveDropdown = {
  field: keyof PersonalizationFormValues;
  options: readonly string[];
  y: number;
} | null;
const CUSTOM_INSTRUCTIONS_PLACEHOLDER =
  "Share anything else you'd like Joy to cons...";

export function PersonalizationSheet({
  isVisible,
  onClose,
  onSave,
  initialValues,
  saving = false,
  errorMessage,
  onBaseStyleTonePress,
  onWarmthPress,
  onEnthusiasmPress,
  onHeaderAndListsPress,
  onEmojiPress,
  variant = 'overlay',
  overlayZIndex = SettingsTokens.sheetLayer.personalization,
  style,
  testID = 'personalization-sheet',
}: PersonalizationSheetProps) {
  const theme = useTheme();
  const [values, setValues] = useState<PersonalizationFormValues>({
    ...DEFAULT_VALUES,
    ...initialValues,
  });
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);
  const lastActiveDropdownRef = useRef<ActiveDropdown>(null);
  const scrollOffsetRef = useRef(0);
  if (activeDropdown !== null) {
    lastActiveDropdownRef.current = activeDropdown;
  }

  const renderedDropdown = activeDropdown ?? lastActiveDropdownRef.current;
  const [rowPositions, setRowPositions] = useState({
    baseStyleTone: 142,
    warmth: 208,
    enthusiasm: 259,
    headerAndLists: 310,
    emoji: 361,
  });

  useEffect(() => {
    if (!isVisible) {
      setActiveDropdown(null);
      lastActiveDropdownRef.current = null;
      return;
    }
    setValues({
      ...DEFAULT_VALUES,
      ...initialValues,
    });
    // Sync draft when the sheet opens or server values arrive.
  }, [isVisible, initialValues]);

  const handleSave = async () => {
    if (saving) return;
    if (!onSave) {
      onClose();
      return;
    }
    await onSave(values);
  };

  const handleSelectOption = (option: string) => {
    const targetDropdown = activeDropdown ?? lastActiveDropdownRef.current;
    if (!targetDropdown) return;
    const field = targetDropdown.field;
    setValues((prev) => ({
      ...prev,
      [field]: option,
    }));
    setActiveDropdown(null);
  };

  const handleBaseCardLayout = (event: LayoutChangeEvent) => {
    const layout = event.nativeEvent.layout;
    const headerOffset =
      tokens.headerPaddingTop + 40 + tokens.headerPaddingBottom;
    const y = headerOffset + layout.y + layout.height + 4;
    setRowPositions((prev) => ({ ...prev, baseStyleTone: y }));
  };

  const handleAttributeCardLayout = (event: LayoutChangeEvent) => {
    const layout = event.nativeEvent.layout;
    const headerOffset =
      tokens.headerPaddingTop + 40 + tokens.headerPaddingBottom;
    const cardTop = headerOffset + layout.y;
    const rowHeight = SettingsTokens.styleToneRow.height;
    const dividerHeight = 1;
    const step = rowHeight + dividerHeight;

    setRowPositions((prev) => ({
      ...prev,
      warmth: cardTop + rowHeight + 4,
      enthusiasm: cardTop + step + rowHeight + 4,
      headerAndLists: cardTop + step * 2 + rowHeight + 4,
      emoji: cardTop + step * 3 + rowHeight + 4,
    }));
  };

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      setActiveDropdown(null);
    },
    [],
  );

  const handleScrollBeginDrag = useCallback(() => {
    setActiveDropdown(null);
  }, []);

  const handleBaseStyleTonePress = () => {
    if (onBaseStyleTonePress) {
      onBaseStyleTonePress();
      return;
    }
    setActiveDropdown({
      field: 'baseStyleTone',
      options: TONE_OPTIONS,
      y: rowPositions.baseStyleTone - scrollOffsetRef.current,
    });
  };

  const handleWarmthPress = () => {
    if (onWarmthPress) {
      onWarmthPress();
      return;
    }
    setActiveDropdown({
      field: 'warmth',
      options: INTENSITY_OPTIONS,
      y: rowPositions.warmth - scrollOffsetRef.current,
    });
  };

  const handleEnthusiasmPress = () => {
    if (onEnthusiasmPress) {
      onEnthusiasmPress();
      return;
    }
    setActiveDropdown({
      field: 'enthusiasm',
      options: INTENSITY_OPTIONS,
      y: rowPositions.enthusiasm - scrollOffsetRef.current,
    });
  };

  const handleHeaderAndListsPress = () => {
    if (onHeaderAndListsPress) {
      onHeaderAndListsPress();
      return;
    }
    setActiveDropdown({
      field: 'headerAndLists',
      options: INTENSITY_OPTIONS,
      y: rowPositions.headerAndLists - scrollOffsetRef.current,
    });
  };

  const handleEmojiPress = () => {
    if (onEmojiPress) {
      onEmojiPress();
      return;
    }
    setActiveDropdown({
      field: 'emoji',
      options: INTENSITY_OPTIONS,
      y: rowPositions.emoji - scrollOffsetRef.current,
    });
  };

  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClose}
      onScroll={handleScroll}
      onScrollBeginDrag={handleScrollBeginDrag}
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
              Personalization
            </Text>
          </View>
          <HeaderSaveButton
            label="Save"
            onPress={handleSave}
            disabled={saving}
            loading={saving}
            testID={`${testID}-save-button`}
          />
        </View>
      }
      sheetStyle={styles.sheetBackground}
      overlay={
        <AnimatedDropdownOverlay
          isOpen={activeDropdown !== null}
          onClose={() => setActiveDropdown(null)}
          backdropStyle={styles.dropdownBackdrop}
          containerStyle={[
            styles.dropdownContainer,
            {
              top:
                activeDropdown?.y ??
                lastActiveDropdownRef.current?.y ??
                142,
              right: 16,
            },
          ]}
          testID={`${testID}-dropdown-overlay`}
        >
          {renderedDropdown ? (
            <PersonalizationPickerDropdown
              options={renderedDropdown.options}
              selectedOption={String(values[renderedDropdown.field])}
              onSelectOption={handleSelectOption}
              testID={`${testID}-picker-dropdown`}
            />
          ) : null}
        </AnimatedDropdownOverlay>
      }
      testID={testID}
    >
      <View style={[styles.content, style]} testID={`${testID}-content`}>
        {errorMessage ? (
          <Text style={styles.errorText} testID={`${testID}-error-text`}>
            {errorMessage}
          </Text>
        ) : null}
        <View
          style={[styles.baseCard, { backgroundColor: theme.cardBackground }]}
          onLayout={handleBaseCardLayout}
          testID={`${testID}-base-card`}
        >
          <StyleToneRow
            label="Base style and tone"
            value={formatOptionLabel(values.baseStyleTone)}
            onPress={handleBaseStyleTonePress}
            testID={`${testID}-base-style`}
          />
        </View>

        <PersonalizationAttributeCard
          onLayout={handleAttributeCardLayout}
          items={[
            {
              id: 'warmth',
              label: 'Warmth',
              value: formatOptionLabel(values.warmth),
              onPress: handleWarmthPress,
            },
            {
              id: 'enthusiasm',
              label: 'Enthusiasm',
              value: formatOptionLabel(values.enthusiasm),
              onPress: handleEnthusiasmPress,
            },
            {
              id: 'header-and-lists',
              label: 'Header and lists',
              value: formatOptionLabel(values.headerAndLists),
              onPress: handleHeaderAndListsPress,
            },
            {
              id: 'emoji',
              label: 'Emoji',
              value: formatOptionLabel(values.emoji),
              onPress: handleEmojiPress,
            },
          ]}
          testID={`${testID}-attributes`}
        />
        <FastAnswersSection
          value={values.fastAnswers}
          onValueChange={(fastAnswers) =>
            setValues((prev) => ({ ...prev, fastAnswers }))
          }
          testID={`${testID}-fast-answers`}
        />

        <View style={styles.customSection} testID={`${testID}-custom-section`}>
          <View style={styles.sectionTitleFrame}>
            <Text
              style={[styles.sectionTitle, { color: theme.textSecondary }]}
              testID={`${testID}-custom-title`}
            >
              Custom instructions
            </Text>
          </View>
          <OccupationCardContainer
            value={values.customInstructions}
            onChangeText={(customInstructions) =>
              setValues((prev) => ({ ...prev, customInstructions }))
            }
            placeholder={CUSTOM_INSTRUCTIONS_PLACEHOLDER}
            placeholderTextColor={tokens.customInstructionsPlaceholderColor}
            style={styles.customInput}
            testID={`${testID}-custom-instructions`}
          />
        </View>
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
  errorText: {
    width: '100%',
    fontSize: tokens.captionFontSize,
    color: tokens.errorColor,
    paddingHorizontal: tokens.captionPaddingHorizontal,
  },
  baseCard: {
    width: '100%',
    backgroundColor: tokens.cardBackground,
    borderRadius: tokens.baseCardRadius,
    overflow: 'hidden',
  },
  customSection: {
    width: '100%',
    gap: tokens.sectionTitleGap,
  },
  sectionTitleFrame: {
    width: '100%',
    paddingLeft: tokens.sectionTitlePaddingLeft,
  },
  sectionTitle: {
    fontSize: tokens.sectionTitleFontSize,
    fontWeight: '400',
    color: tokens.sectionTitleColor,
  },
  customInput: {
    borderWidth: 0,
    maxWidth: '100%',
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdownContainer: {
    position: 'absolute',
    padding: 0,
    zIndex: 1000,
  },
});
