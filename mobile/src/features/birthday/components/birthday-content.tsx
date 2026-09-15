import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { WelcomeTokens } from '@/constants/theme';
import { WelcomeInfoRow } from '@/features/welcome/components/welcome-info-row';

const iconSparkle = require('@/assets/images/welcome/icon-sparkle.svg');
const iconBook = require('@/assets/images/welcome/icon-book.svg');
const iconGlobe = require('@/assets/images/welcome/icon-globe.svg');

export type BirthdayContentProps = {
  testID?: string;
};

export function BirthdayContent({ testID = 'birthday-content' }: BirthdayContentProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.headerGroup} testID={`${testID}-header-group`}>
        <Text style={[styles.title, { color: theme.textTitle }]} testID={`${testID}-title`}>
          Happy Birthday Devira
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]} testID={`${testID}-subtitle`}>
          Hari ini hari spesial kamu! Joy hadir khusus buat nemenin kamu, dengerin cerita kamu, dan bikin hari-harimu selalu bahagia.
        </Text>
      </View>
      <View style={styles.infoContainer} testID={`${testID}-info-container`}>
        <WelcomeInfoRow
          icon={iconSparkle}
          title="Hari Spesial Devira"
          description="Semoga di usia yang baru ini kamu selalu sehat, bahagia, dan semua impian indahmu terwujud."
          testID={`${testID}-info-special-day`}
        />
        <WelcomeInfoRow
          icon={iconBook}
          title="Joy Selalu Menemanimu"
          description="Kapan pun kamu butuh teman ngobrol, bantuan kegiatan, atau mendengarkan musik, Joy selalu ada buat kamu."
          testID={`${testID}-info-companion`}
        />
        <WelcomeInfoRow
          icon={iconGlobe}
          title="Kado Penuh Cinta"
          description="Dibuat khusus untukmu agar setiap hari terasa lebih hangat, menyenangkan, dan penuh senyuman."
          testID={`${testID}-info-love-gift`}
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
