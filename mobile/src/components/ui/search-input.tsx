import { Image } from 'expo-image';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ChatSearchTokens, PluginsTokens } from '@/constants/theme';

export type SearchInputProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  variant?: 'default' | 'pill' | 'white' | 'muted';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search',
  onClear,
  variant = 'default',
  style,
  testID = 'search-input',
  ...rest
}: SearchInputProps) {
  const theme = useTheme();
  const handleClear = () => {
    onChangeText?.('');
    onClear?.();
  };

  const hasValue = Boolean(value && value.length > 0);
  const isWhitePill = variant === 'pill' || variant === 'white';
  const isMutedPill = variant === 'muted';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundElement },
        isWhitePill && [styles.whitePillContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }],
        isMutedPill && [styles.mutedPillContainer, { backgroundColor: theme.backgroundElement }],
        style,
      ]}
      testID={testID}
    >
      <Image
        source={require('@/assets/images/ui/icon-search.svg')}
        style={styles.searchIcon}
        contentFit="contain"
        tintColor={theme.textMuted}
        accessibilityLabel="Search"
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          { color: theme.text },
          isMutedPill && styles.mutedInput,
        ]}
        accessibilityLabel={placeholder}
        testID={`${testID}-text-input`}
        {...rest}
      />
      {hasValue ? (
        <Pressable
          onPress={handleClear}
          style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          testID={`${testID}-clear-button`}
        >
          <Image
            source={require('@/assets/images/ui/icon-clear.svg')}
            style={styles.clearIcon}
            contentFit="contain"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    width: '100%',
    maxWidth: 362,
    borderRadius: PluginsTokens.borderRadius.input,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whitePillContainer: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  mutedPillContainer: {
    flex: 1,
    maxWidth: undefined,
    height: ChatSearchTokens.sizes.bottomBarHeight,
    borderRadius: ChatSearchTokens.borderRadius.pill,
    paddingHorizontal: 16,
  },
  searchIcon: {
    width: 20,
    height: 20,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  mutedInput: {
    height: ChatSearchTokens.sizes.bottomBarHeight,
    fontSize: ChatSearchTokens.typography.input.fontSize,
    lineHeight: ChatSearchTokens.typography.input.lineHeight,
  },
  clearButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  clearIcon: {
    width: 16,
    height: 16,
  },
});
