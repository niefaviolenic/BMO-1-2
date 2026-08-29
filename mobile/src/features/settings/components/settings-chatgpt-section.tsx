import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BookOpen, Cable, ChevronRight, FileUser } from 'lucide-react-native';

import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';

export type SettingsChatGPTItem = {
  id: string;
  label: string;
  icon: 'file-user' | 'book-open' | 'cable';
};

export type SettingsChatGPTSectionProps = {
  title?: string;
  items?: SettingsChatGPTItem[];
  onItemPress?: (item: SettingsChatGPTItem) => void;
  onPersonalizationPress?: () => void;
  onMemoryPress?: () => void;
  onPluginsPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_ITEMS: SettingsChatGPTItem[] = [
  { id: 'personalization', label: 'Personalization', icon: 'file-user' },
  { id: 'memory', label: 'Memory', icon: 'book-open' },
  { id: 'plugins', label: 'Plugins', icon: 'cable' },
];

function RowIcon({
  icon,
  size,
  color,
  testID,
}: {
  icon: SettingsChatGPTItem['icon'];
  size: number;
  color: string;
  testID?: string;
}) {
  switch (icon) {
    case 'file-user':
      return <FileUser size={size} color={color} strokeWidth={1.5} testID={testID} />;
    case 'book-open':
      return <BookOpen size={size} color={color} strokeWidth={1.5} testID={testID} />;
    case 'cable':
      return <Cable size={size} color={color} strokeWidth={1.5} testID={testID} />;
    default:
      return null;
  }
}

export function SettingsChatGPTSection({
  title = 'Customize Joy',
  items = DEFAULT_ITEMS,
  onItemPress,
  onPersonalizationPress,
  onMemoryPress,
  onPluginsPress,
  style,
  testID = 'settings-chatgpt-section',
}: SettingsChatGPTSectionProps) {
  const theme = useTheme();

  const handlePress = (item: SettingsChatGPTItem) => {
    if (onItemPress) {
      onItemPress(item);
      return;
    }
    if (item.id === 'personalization' && onPersonalizationPress) {
      onPersonalizationPress();
      return;
    }
    if (item.id === 'memory' && onMemoryPress) {
      onMemoryPress();
      return;
    }
    if (item.id === 'plugins' && onPluginsPress) {
      onPluginsPress();
    }
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {title ? (
        <Text style={[styles.headerText, { color: theme.textMuted }]} testID={`${testID}-header`}>
          {title}
        </Text>
      ) : null}

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
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isFirst = index === 0;

          return (
            <React.Fragment key={item.id}>
              <Pressable
                onPress={() => handlePress(item)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                testID={`${testID}-row-${item.id}`}
                style={({ pressed }) => [
                  styles.row,
                  pressed && [styles.rowPressed, { backgroundColor: theme.cardPressed }],
                  isFirst && styles.rowFirst,
                  isLast && styles.rowLast,
                ]}
              >
                <View style={styles.leftContent}>
                  <RowIcon
                    icon={item.icon}
                    size={SettingsTokens.chatgptSection.iconSize}
                    color={theme.icon}
                    testID={`${testID}-icon-${item.id}`}
                  />
                  <Text style={[styles.labelName, { color: theme.text }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>

                <ChevronRight
                  size={SettingsTokens.chatgptSection.chevronSize}
                  color={theme.textMuted}
                  strokeWidth={1.5}
                />
              </Pressable>

              {!isLast ? <View style={[styles.divider, { backgroundColor: theme.divider }]} /> : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'column',
    gap: SettingsTokens.chatgptSection.gap,
  },
  headerText: {
    fontSize: SettingsTokens.chatgptSection.headerFontSize,
    fontWeight: '400',
    lineHeight: SettingsTokens.chatgptSection.headerLineHeight,
    paddingLeft: SettingsTokens.chatgptSection.headerPaddingLeft,
  },
  card: {
    width: '100%',
    borderRadius: SettingsTokens.chatgptSection.cardRadius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    height: SettingsTokens.chatgptSection.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SettingsTokens.chatgptSection.rowPaddingHorizontal,
  },
  rowFirst: {
    borderTopLeftRadius: SettingsTokens.chatgptSection.cardRadius,
    borderTopRightRadius: SettingsTokens.chatgptSection.cardRadius,
  },
  rowLast: {
    borderBottomLeftRadius: SettingsTokens.chatgptSection.cardRadius,
    borderBottomRightRadius: SettingsTokens.chatgptSection.cardRadius,
  },
  rowPressed: {
    opacity: 0.7,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SettingsTokens.chatgptSection.rowGap,
    flex: 1,
    paddingRight: 12,
  },
  labelName: {
    fontSize: SettingsTokens.chatgptSection.rowFontSize,
    fontWeight: '400',
    lineHeight: SettingsTokens.chatgptSection.rowLineHeight,
    flexShrink: 1,
  },
  divider: {
    height: 1,
    marginLeft: SettingsTokens.chatgptSection.dividerInsetLeft,
  },
});
