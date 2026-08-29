import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type PluginConnectLogosRowProps = {
  /** Optional custom React node for the plugin logo. Defaults to WhatsApp logo. */
  pluginLogo?: React.ReactNode;
  /** Optional custom React node for the Joy logo. Defaults to Joy icon. */
  joyLogo?: React.ReactNode;
  /** Custom container style override. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function PluginConnectLogosRow({
  pluginLogo,
  joyLogo,
  style,
  testID = 'plugin-connect-logos-row',
}: PluginConnectLogosRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View
        style={[
          styles.logoBox,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        testID={`${testID}-joy-box`}
      >
        {joyLogo ?? (
          <Image
            source={require('@/assets/images/auth/joy-icon.svg')}
            style={styles.defaultJoyLogo}
            contentFit="contain"
            accessibilityLabel="Joy Logo"
            testID={`${testID}-joy-logo`}
          />
        )}
      </View>

      <Text style={[styles.connectorDots, { color: theme.textMuted }]} testID={`${testID}-connector-dots`}>
        •••
      </Text>

      <View
        style={[
          styles.logoBox,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        testID={`${testID}-plugin-box`}
      >
        {pluginLogo ?? (
          <Image
            source={require('@/assets/images/plugins/whatsapp-logo.png')}
            style={styles.defaultPluginLogo}
            contentFit="contain"
            accessibilityLabel="Plugin Logo"
            testID={`${testID}-plugin-logo`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  connectorDots: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  defaultJoyLogo: {
    width: 40,
    height: 40,
  },
  defaultPluginLogo: {
    width: 32,
    height: 32,
  },
});
