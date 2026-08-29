import React from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ExternalLink } from 'lucide-react-native';

import { useTheme } from '@/hooks/use-theme';
import { PluginsTokens } from '@/constants/theme';
export type PluginInfoSectionProps = {
  /** Developer name. Defaults to 'WhatsApp LLC'. */
  developer?: string;
  /** Category name. Defaults to 'Communication'. */
  category?: string;
  /** Version string. Defaults to '2.24.1'. */
  version?: string;
  /** Website URL for external link. */
  websiteUrl?: string;
  /** Privacy policy URL. */
  privacyPolicyUrl?: string;
  /** Terms of service URL. */
  termsOfServiceUrl?: string;
  /** Custom container style overrides. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function PluginInfoSection({
  developer = 'WhatsApp LLC',
  category = 'Communication',
  version = '2.24.1',
  websiteUrl = 'https://www.whatsapp.com',
  privacyPolicyUrl = 'https://www.whatsapp.com/legal/privacy-policy',
  termsOfServiceUrl = 'https://www.whatsapp.com/legal/terms-of-service',
  style,
  testID = 'plugin-info-section',
}: PluginInfoSectionProps) {
  const theme = useTheme();

  const handleOpenUrl = (url?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={[styles.headerText, { color: theme.textTitle }]} testID={`${testID}-header`}>
        Information
      </Text>

      <View style={styles.card} testID={`${testID}-card`}>
        {/* Top Divider under Information header */}
        <View style={[styles.headerDivider, { backgroundColor: theme.divider }]} />

        {/* Developer */}
        <View style={styles.row} testID={`${testID}-developer-row`}>
          <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Developer</Text>
          <View style={styles.rowValueContainer}>
            <Text style={[styles.rowValue, { color: theme.text }]}>{developer}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

        {/* Category */}
        <View style={styles.row} testID={`${testID}-category-row`}>
          <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Category</Text>
          <View style={styles.rowValueContainer}>
            <Text style={[styles.rowValue, { color: theme.text }]}>{category}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

        {/* Website */}
        <View style={styles.row} testID={`${testID}-website-row`}>
          <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Website</Text>
          <View style={styles.rowValueContainer}>
            <Pressable
              onPress={() => handleOpenUrl(websiteUrl)}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="Website link"
              testID={`${testID}-website-btn`}
              style={({ pressed }) => [pressed && styles.iconPressed]}
            >
              <ExternalLink size={14} color={theme.icon} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

        {/* Version */}
        <View style={styles.row} testID={`${testID}-version-row`}>
          <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Version</Text>
          <View style={styles.rowValueContainer}>
            <Text style={[styles.rowValue, { color: theme.text }]}>{version}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

        {/* Privacy Policy */}
        <View style={styles.row} testID={`${testID}-privacy-row`}>
          <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Privacy Policy</Text>
          <View style={styles.rowValueContainer}>
            <Pressable
              onPress={() => handleOpenUrl(privacyPolicyUrl)}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="Privacy policy link"
              testID={`${testID}-privacy-btn`}
              style={({ pressed }) => [pressed && styles.iconPressed]}
            >
              <ExternalLink size={14} color={theme.icon} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

        {/* Terms of Service */}
        <View style={styles.row} testID={`${testID}-terms-row`}>
          <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Terms of Service</Text>
          <View style={styles.rowValueContainer}>
            <Pressable
              onPress={() => handleOpenUrl(termsOfServiceUrl)}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="Terms of service link"
              testID={`${testID}-terms-btn`}
              style={({ pressed }) => [pressed && styles.iconPressed]}
            >
              <ExternalLink size={14} color={theme.icon} />
            </Pressable>
          </View>
        </View>

        {/* Bottom Divider */}
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 354,
    flexDirection: 'column',
    gap: 12,
  },
  headerText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    color: '#0F1729',
  },
  card: {
    width: '100%',
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#E5EAF0',
  },
  row: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconPressed: {
    opacity: 0.6,
  },
  rowLabel: {
    width: 140,
    fontSize: 13,
    fontWeight: '400',
    color: '#808999',
  },
  rowValueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '400',
    color: '#0D0D0D',
  },
  divider: {
    height: 1,
    backgroundColor: '#EBF0F5',
  },
});
