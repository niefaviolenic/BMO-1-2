import { Search, X } from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { DeviceContactPickerTokens as Tokens } from '@/constants/theme';

export interface ContactPickerSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ContactPickerSearchBar({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search contact name or number...',
  style,
  testID = 'contact-picker-search-bar',
}: ContactPickerSearchBarProps) {
  const theme = useTheme();

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <Search
        size={18}
        color={theme.iconMuted ?? theme.textMuted}
        style={styles.searchIcon}
      />
      <TextInput
        style={[styles.input, { color: theme.textTitle }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.inputPlaceholder ?? theme.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search contacts"
        testID={`${testID}-input`}
      />
      {value.length > 0 && (
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          style={styles.clearButton}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          testID={`${testID}-clear-button`}
        >
          <X size={16} color={theme.iconMuted ?? theme.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: Tokens.layout.searchHeight,
    backgroundColor: Tokens.colors.searchBackground,
    borderRadius: Tokens.layout.searchRadius,
    borderWidth: 1,
    borderColor: Tokens.colors.searchBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Tokens.layout.searchPaddingHorizontal,
    gap: Tokens.layout.searchGap,
  },
  searchIcon: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    height: '100%',
    color: Tokens.colors.searchText,
    fontSize: Tokens.typography.searchInput.fontSize,
    fontWeight: Tokens.typography.searchInput.fontWeight,
    lineHeight: Tokens.typography.searchInput.lineHeight,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
