import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { ModalBottomSheet } from './modal-bottom-sheet';
import { QuestionCardSheetTokens, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export type QuestionOption = {
  id: string;
  label: string;
};

export type QuestionCardSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  question: string;
  options: QuestionOption[];
  selectedOptionId?: string;
  onSelectOption?: (id: string) => void;
  currentPage?: number;
  totalPages?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onSkip?: () => void;
  customInputPlaceholder?: string;
  customInputValue?: string;
  onChangeCustomInput?: (text: string) => void;
  onCustomInputSubmit?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function QuestionCardSheet({
  isVisible,
  onClose,
  question,
  options,
  selectedOptionId,
  onSelectOption,
  currentPage = 1,
  totalPages = 3,
  onPrevPage,
  onNextPage,
  onSkip,
  customInputPlaceholder = 'Enter the city or neighborhood',
  customInputValue,
  onChangeCustomInput,
  onCustomInputSubmit,
  style,
  testID = 'question-card-sheet',
}: QuestionCardSheetProps) {
  const [localInput, setLocalInput] = useState('');
  const theme = useTheme();

  const inputValue = customInputValue !== undefined ? customInputValue : localInput;
  const handleInputChange = (text: string) => {
    setLocalInput(text);
    onChangeCustomInput?.(text);
  };

  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClose}
      showCloseButton={false}
      disableScrollView={true}
      testID={testID}
    >
      <View style={[styles.card, { backgroundColor: theme.cardBackground }, style]}>
        {/* Header: Pagination & Close */}
        <View style={styles.header}>
          <View style={styles.paginationContainer}>
            <Pressable
              onPress={onPrevPage}
              disabled={!onPrevPage || currentPage <= 1}
              style={({ pressed }) => [styles.chevronButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Previous page"
              testID={`${testID}-prev-button`}
            >
              <Text style={[styles.chevronText, { color: theme.text }, currentPage <= 1 && styles.disabledChevron]}>‹</Text>
            </Pressable>
            <Text style={[styles.paginationText, { color: theme.textMuted }]} testID={`${testID}-pagination`}>
              {currentPage} of {totalPages}
            </Text>
            <Pressable
              onPress={onNextPage}
              disabled={!onNextPage || currentPage >= totalPages}
              style={({ pressed }) => [styles.chevronButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Next page"
              testID={`${testID}-next-button`}
            >
              <Text style={[styles.chevronText, { color: theme.text }, currentPage >= totalPages && styles.disabledChevron]}>›</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
            testID={`${testID}-close-button`}
          >
            <Text style={[styles.closeIcon, { color: theme.textSecondary }]}>✕</Text>
          </Pressable>
        </View>

        {/* Question Title */}
        <Text style={[styles.questionText, { color: theme.text }]} testID={`${testID}-question`}>
          {question}
        </Text>

        {/* Options List */}
        <View style={styles.optionsList} testID={`${testID}-options-list`}>
          {options.map((option, index) => {
            const isSelected = option.id === selectedOptionId;
            return (
              <View key={option.id}>
                <Pressable
                  style={({ pressed }) => [
                    styles.optionRow,
                    isSelected && [styles.selectedOptionRow, { backgroundColor: theme.backgroundSelected }],
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onSelectOption?.(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  testID={`${testID}-option-${option.id}`}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: theme.textSecondary },
                      isSelected && [styles.selectedOptionText, { color: theme.text }],
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
                {index < options.length - 1 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
              </View>
            );
          })}
        </View>

        {/* Footer: Custom Input & Skip Button */}
        <View style={styles.footer}>
          <View style={[styles.inputContainer, { backgroundColor: theme.backgroundElement }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={inputValue}
              onChangeText={handleInputChange}
              placeholder={customInputPlaceholder}
              placeholderTextColor={theme.textMuted}
              onSubmitEditing={onCustomInputSubmit}
              returnKeyType="done"
              accessibilityLabel={customInputPlaceholder}
              testID={`${testID}-custom-input`}
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.skipButton, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
            onPress={onSkip || onClose}
            accessibilityRole="button"
            accessibilityLabel="Skip question"
            testID={`${testID}-skip-button`}
          >
            <Text style={[styles.skipText, { color: theme.textSecondary }]}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: QuestionCardSheetTokens.background,
    borderRadius: QuestionCardSheetTokens.borderRadius,
    paddingVertical: QuestionCardSheetTokens.paddingVertical,
    paddingHorizontal: QuestionCardSheetTokens.paddingHorizontal,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 24,
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevronButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  chevronText: {
    fontSize: 16,
    fontWeight: '600',
    color: QuestionCardSheetTokens.paginationTextColor,
  },
  disabledChevron: {
    opacity: 0.3,
  },
  paginationText: {
    fontSize: 13,
    fontWeight: '500',
    color: QuestionCardSheetTokens.paginationTextColor,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8C8C91',
  },
  questionText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    color: QuestionCardSheetTokens.titleColor,
    marginTop: 4,
    marginBottom: 4,
  },
  optionsList: {
    marginVertical: 4,
  },
  optionRow: {
    height: QuestionCardSheetTokens.optionHeight,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  selectedOptionRow: {
    backgroundColor: '#F5F5F7',
    borderRadius: 8,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '400',
    color: QuestionCardSheetTokens.optionTextColor,
  },
  selectedOptionText: {
    fontWeight: '600',
    color: '#0D0D0D',
  },
  divider: {
    height: 1,
    backgroundColor: QuestionCardSheetTokens.dividerColor,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  inputContainer: {
    flex: 1,
    height: 38,
    borderRadius: QuestionCardSheetTokens.inputRadius,
    backgroundColor: QuestionCardSheetTokens.inputBackground,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: '400',
    color: '#0D0D0D',
    padding: 0,
  },
  skipButton: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: QuestionCardSheetTokens.inputRadius,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
    color: QuestionCardSheetTokens.skipTextColor,
  },
  pressed: {
    opacity: 0.7,
  },
});
