import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { COUNTRIES, Country } from '@/constants/countries';
import { AuthTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export type CountryPickerContentProps = {
  selectedCountry: Country;
  onSelectCountry: (country: Country) => void;
};

export function CountryPickerContent({
  selectedCountry,
  onSelectCountry,
}: CountryPickerContentProps) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const filteredCountries = COUNTRIES.filter((country) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      country.name.toLowerCase().includes(query) ||
      country.dialCode.includes(query) ||
      country.code.toLowerCase().includes(query)
    );
  });

  return (
    <View style={styles.contentColumn}>
      {/* Header Title */}
      <View style={styles.headerGroup}>
        <Text style={[styles.titleText, { color: theme.text }]} testID="country-picker-title">
          Select Country
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.inputBackground,
              borderColor: theme.inputBorder,
              color: theme.inputText,
            },
          ]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search country or code..."
          placeholderTextColor={theme.inputPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search country"
          testID="country-search-input"
        />
      </View>

      {/* Country List */}
      <FlatList
        data={filteredCountries}
        keyExtractor={(item) => item.code}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.flatList}
        renderItem={({ item }) => {
          const isSelected = item.code === selectedCountry.code;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.countryRow,
                isSelected && [styles.selectedRow, { backgroundColor: theme.backgroundSelected }],
                pressed && styles.pressedRow,
              ]}
              onPress={() => onSelectCountry(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name} ${item.dialCode}`}
              testID={`country-item-${item.code}`}
            >
              <Text style={styles.flagText}>{item.flag}</Text>
              <Text style={[styles.countryNameText, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.dialCodeText, { color: theme.textSecondary }]}>{item.dialCode}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No countries found</Text>
          </View>
        }
      />
    </View>
  );
}

export type CountryPickerModalProps = {
  isVisible: boolean;
  selectedCountry: Country;
  onSelectCountry: (country: Country) => void;
  onClose: () => void;
};

export function CountryPickerModal({
  isVisible,
  selectedCountry,
  onSelectCountry,
  onClose,
}: CountryPickerModalProps) {
  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClose}
      enableDragToClose={true}
      disableScrollView={true}
      testID="country-picker-modal"
      closeButtonTestID="country-picker-close-button"
    >
      <CountryPickerContent
        selectedCountry={selectedCountry}
        onSelectCountry={(country) => {
          onSelectCountry(country);
          onClose();
        }}
      />
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  contentColumn: {
    flex: 1,
    gap: 16,
  },
  headerGroup: {
    alignItems: 'center',
  },
  titleText: {
    color: AuthTokens.colors.emailSheetTitle,
    fontSize: AuthTokens.typography.sheetTitle.fontSize,
    fontWeight: AuthTokens.typography.sheetTitle.fontWeight,
    lineHeight: AuthTokens.typography.sheetTitle.lineHeight,
    textAlign: 'center',
  },
  searchContainer: {
    marginBottom: 4,
  },
  searchInput: {
    height: 48,
    backgroundColor: AuthTokens.colors.emailInputBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AuthTokens.colors.emailInputBorder,
    paddingHorizontal: 16,
    fontSize: AuthTokens.typography.inputText.fontSize,
    color: AuthTokens.colors.emailInputText,
  },
  flatList: {
    flex: 1,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  selectedRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  pressedRow: {
    opacity: 0.7,
  },
  flagText: {
    fontSize: 22,
  },
  countryNameText: {
    flex: 1,
    fontSize: AuthTokens.typography.inputText.fontSize,
    fontWeight: '400',
    color: AuthTokens.colors.emailInputText,
  },
  dialCodeText: {
    fontSize: AuthTokens.typography.inputText.fontSize,
    fontWeight: '600',
    color: AuthTokens.colors.emailSheetSubtitle,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: AuthTokens.typography.inputText.fontSize,
    color: AuthTokens.colors.emailSheetSubtitle,
  },
});
