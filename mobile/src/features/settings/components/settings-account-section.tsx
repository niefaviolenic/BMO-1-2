import { Mail } from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';

const tokens = SettingsTokens.accountSection;

export type SettingsAccountSectionProps = {
  title?: string;
  email?: string;
  subscription?: string;
  upgradeLabel?: string;
  onEmailPress?: () => void;
  onSubscriptionPress?: () => void;
  onUpgradePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SettingsAccountSection({
  title = 'Account',
  email = '',
  subscription = 'Free',
  upgradeLabel = 'Upgrade to Joy Plus',
  onEmailPress,
  onSubscriptionPress,
  onUpgradePress,
  style,
  testID = 'settings-account-section',
}: SettingsAccountSectionProps) {
  const theme = useTheme();
  const accentColor = theme.accentPrimary ?? theme.linkPrimary ?? tokens.upgradeColor;

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.headerFrame}>
        <Text style={[styles.headerText, { color: theme.textMuted }]} testID={`${testID}-header`}>
          {title}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        testID={`${testID}-card`}
      >
        <Pressable
          onPress={onEmailPress}
          disabled={!onEmailPress}
          accessibilityRole={onEmailPress ? 'button' : undefined}
          accessibilityLabel={`Email: ${email}`}
          testID={`${testID}-row-email`}
          style={({ pressed }) => [
            styles.row,
            onEmailPress && pressed && [styles.rowPressed, { backgroundColor: theme.cardPressed }],
          ]}
        >
          <Mail
            size={tokens.iconSize}
            color={theme.icon}
            strokeWidth={tokens.iconStrokeWidth}
          />
          <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
            Email
          </Text>
          <Text style={[styles.value, { color: theme.textSecondary }]} numberOfLines={1} testID={`${testID}-email-value`}>
            {email}
          </Text>
        </Pressable>


      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'column',
    gap: tokens.gap,
  },
  headerFrame: {
    paddingLeft: tokens.headerPaddingLeft,
  },
  headerText: {
    fontSize: tokens.headerFontSize,
    fontWeight: '400',
    lineHeight: tokens.headerLineHeight,
  },
  card: {
    width: '100%',
    borderRadius: tokens.cardRadius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    height: tokens.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.rowGap,
    paddingHorizontal: tokens.rowPaddingHorizontal,
  },
  rowPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: tokens.rowFontSize,
    fontWeight: '400',
    lineHeight: tokens.rowLineHeight,
  },
  value: {
    flex: 1,
    textAlign: 'right',
    fontSize: tokens.rowFontSize,
    fontWeight: '400',
    lineHeight: tokens.rowLineHeight,
    paddingLeft: 8,
  },
  upgradeLabel: {
    fontSize: tokens.rowFontSize,
    fontWeight: '400',
    lineHeight: tokens.rowLineHeight,
    color: tokens.upgradeColor,
  },
  divider: {
    height: 1,
    marginLeft: tokens.dividerInsetLeft,
  },
});
