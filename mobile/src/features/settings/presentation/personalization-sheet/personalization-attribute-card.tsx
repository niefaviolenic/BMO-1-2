import React from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';
import { StyleToneRow } from '@/features/settings/components/style-tone-row';
const tokens = SettingsTokens.personalizationSheet;

export type PersonalizationAttributeItem = {
  id: string;
  label: string;
  value: string;
  onPress?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export type PersonalizationAttributeCardProps = {
  items: PersonalizationAttributeItem[];
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PersonalizationAttributeCard({
  items,
  onLayout,
  style,
  testID = 'personalization-attribute-card',
}: PersonalizationAttributeCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.card, { backgroundColor: theme.cardBackground }, style]}
      onLayout={onLayout}
      testID={testID}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <StyleToneRow
            label={item.label}
            value={item.value}
            onPress={item.onPress}
            onLayout={item.onLayout}
            testID={`${testID}-row-${item.id}`}
          />
          {index < items.length - 1 ? (
            <View style={styles.dividerWrapper} testID={`${testID}-divider-${item.id}`}>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            </View>
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: tokens.cardBackground,
    borderRadius: tokens.attributeCardRadius,
    overflow: 'hidden',
  },
  dividerWrapper: {
    width: '100%',
    paddingHorizontal: tokens.dividerInsetHorizontal,
  },
  divider: {
    height: 1,
    backgroundColor: tokens.dividerColor,
  },
});
