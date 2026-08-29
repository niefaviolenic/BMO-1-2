import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { WelcomeTokens } from '@/constants/theme';
import { WelcomeInfoRow } from '@/features/welcome/components/welcome-info-row';
const iconSparkle = require('@/assets/images/welcome/icon-sparkle.svg');
const iconBook = require('@/assets/images/welcome/icon-book.svg');
const iconGlobe = require('@/assets/images/welcome/icon-globe.svg');

export function WelcomeContentContainer() {
  const theme = useTheme();

  return (
    <View style={styles.container} testID="welcome-content-container">
      <View style={styles.headerGroup} testID="welcome-header-group">
        <Text style={[styles.title, { color: theme.textTitle }]} testID="welcome-title">
          Welcome to Joy
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]} testID="welcome-subtitle">
          Joy is your personal AI companion, ready to chat, help with everyday tasks, and stay connected to your Joy device.
        </Text>
      </View>
      <View style={styles.infoContainer} testID="welcome-info-container">
        <WelcomeInfoRow
          icon={iconSparkle}
          title="Joy can make mistakes"
          description="Joy may occasionally provide inaccurate or incomplete information. Double-check anything important."
          testID="welcome-info-row-mistakes"
        />
        <WelcomeInfoRow
          icon={iconBook}
          title="Learns and adapts with you"
          description="The more you chat and interact, the better Joy learns your habits to assist you with daily tasks."
          testID="welcome-info-row-learns"
        />
        <WelcomeInfoRow
          icon={iconGlobe}
          title="You’re always in control"
          description="Manage your connected Joy, integrations, notifications, and app preferences anytime from Settings."
          testID="welcome-info-row-control"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: WelcomeTokens.spacing.contentGap,
    alignSelf: 'stretch',
  },
  headerGroup: {
    gap: WelcomeTokens.spacing.headerGap,
    alignSelf: 'stretch',
  },
  title: {
    color: WelcomeTokens.colors.textPrimary,
    fontSize: WelcomeTokens.typography.headerTitle.fontSize,
    fontWeight: WelcomeTokens.typography.headerTitle.fontWeight,
    lineHeight: WelcomeTokens.typography.headerTitle.lineHeight,
  },
  subtitle: {
    color: WelcomeTokens.colors.textSecondary,
    fontSize: WelcomeTokens.typography.headerSubtitle.fontSize,
    fontWeight: WelcomeTokens.typography.headerSubtitle.fontWeight,
    lineHeight: WelcomeTokens.typography.headerSubtitle.lineHeight,
  },
  infoContainer: {
    gap: WelcomeTokens.spacing.infoContainerGap,
    alignSelf: 'stretch',
  },
});
