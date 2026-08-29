import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { WelcomeTokens } from '@/constants/theme';
import { WelcomeActionsContainer } from '@/features/welcome/presentation/welcome-screen/components/welcome-actions-container';
import { WelcomeContentContainer } from '@/features/welcome/presentation/welcome-screen/components/welcome-content-container';
export type WelcomeScreenProps = {
  onContinue?: () => void;
};

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const handleContinue = useCallback(() => {
    onContinue?.();
  }, [onContinue]);

  const paddingTop = Math.max(insets.top + 32, 64);
  const paddingBottom = Math.max(insets.bottom + 16, 34);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]} testID="welcome-screen">
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop,
            paddingBottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainLayout}>
          <WelcomeContentContainer />
          <WelcomeActionsContainer onContinue={handleContinue} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WelcomeTokens.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: WelcomeTokens.spacing.horizontalPadding,
  },
  mainLayout: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});
