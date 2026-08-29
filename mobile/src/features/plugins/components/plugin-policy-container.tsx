import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { PluginsTokens } from '@/constants/theme';
export type PolicyItem = {
  id: string;
  title?: string;
  text: string;
};

export type PluginPolicyContainerProps = {
  /** Optional array of policy items to display. Defaults to the 3 standard Joy data privacy policies. */
  policies?: PolicyItem[];
  /** Custom container style override. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export const DEFAULT_POLICIES: PolicyItem[] = [
  {
    id: '1',
    title: "You're in control",
    text: "Joy always respects your training data preferences, and is limited to permissions you've explicitly set.",
  },
  {
    id: '2',
    title: 'Apps may introduce elevated risk',
    text: 'Joy is built to protect your data, but attackers may attempt to use Joy to access your data in the app, or use the app to attempt to access your data in Joy.',
  },
  {
    id: '3',
    title: 'Data shared with this app',
    text: 'By adding this app, you allow it to access: (1) basic information typically shared when you visit a website, such as your IP address and approximate location (learn more), and (2) a summary of your recent context and intent within Joy. Our policies require that apps only access relevant content to respond to your requests. This data will be used as described in the app Terms of Use and Privacy Notice.',
  },
];

export function PluginPolicyContainer({
  policies = DEFAULT_POLICIES,
  style,
  testID = 'plugin-policy-container',
}: PluginPolicyContainerProps) {
  const theme = useTheme();

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
      {policies.map((item, index) => {
        const isDefaultPolicy3 = item.id === '3' && item.title === 'Data shared with this app';

        return (
          <View key={item.id ?? `policy-${index}`} style={styles.policyBlock}>
            {isDefaultPolicy3 ? (
              <Text style={[styles.policyText, { color: theme.textSecondary }]}>
                <Text style={[styles.titleText, { color: theme.textTitle }]}>Data shared with this app </Text>
                By adding this app, you allow it to access: (1) basic information typically shared when you visit a website, such as your IP address and approximate location (
                <Text style={[styles.linkText, { color: theme.linkPrimary }]}>learn more</Text>
                ), and (2) a summary of your recent context and intent within Joy. Our policies require that apps only access relevant content to respond to your requests. This data will be used as described in the app{' '}
                <Text style={[styles.linkText, { color: theme.linkPrimary }]}>Terms of Use</Text>
                {' and '}
                <Text style={[styles.linkText, { color: theme.linkPrimary }]}>Privacy Notice</Text>.
              </Text>
            ) : (
              <Text style={[styles.policyText, { color: theme.textSecondary }]}>
                {item.title ? <Text style={[styles.titleText, { color: theme.textTitle }]}>{item.title} </Text> : null}
                {item.text}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 362,
    paddingVertical: PluginsTokens.policyContainer.paddingVertical,
    paddingHorizontal: PluginsTokens.policyContainer.paddingHorizontal,
    gap: PluginsTokens.policyContainer.gap,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
  },
  policyBlock: {
    width: '100%',
  },
  policyText: {
    fontSize: PluginsTokens.policyContainer.fontSize,
    lineHeight: 18,
    color: '#737A8C',
    fontWeight: '400',
  },
  titleText: {
    fontSize: PluginsTokens.policyContainer.fontSize,
    lineHeight: 18,
    color: '#0D0D0D',
    fontWeight: '700',
  },
  linkText: {
    fontSize: PluginsTokens.policyContainer.fontSize,
    lineHeight: 18,
    color: '#0D0D0D',
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
});
