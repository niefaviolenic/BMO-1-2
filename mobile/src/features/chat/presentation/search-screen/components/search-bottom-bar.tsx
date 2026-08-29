import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassCloseButton } from '@/components/ui/liquid-glass-close-button';
import { SearchInput } from '@/components/ui/search-input';
import { ChatSearchTokens } from '@/constants/theme';

export type SearchBottomBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  autoFocus?: boolean;
  testID?: string;
};

export function SearchBottomBar({
  value,
  onChangeText,
  onClose,
  autoFocus = true,
  testID = 'search-bottom-bar',
}: SearchBottomBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingBottom: Math.max(insets.bottom, ChatSearchTokens.spacing.bottomBarPadding),
        },
      ]}
      testID={testID}
    >
      <SearchInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search"
        variant="muted"
        autoFocus={autoFocus}
        returnKeyType="search"
        testID={`${testID}-input`}
      />
      <LiquidGlassCloseButton
        onPress={onClose}
        size={ChatSearchTokens.sizes.closeButton}
        testID={`${testID}-close`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ChatSearchTokens.spacing.bottomBarGap,
    paddingHorizontal: ChatSearchTokens.spacing.paddingHorizontal,
    paddingTop: ChatSearchTokens.spacing.bottomBarPadding,
  },
});
