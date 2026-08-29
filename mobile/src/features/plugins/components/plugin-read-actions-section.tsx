import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PluginsTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ReadActionItem = {
  id: string;
  name: string;
};

export type PluginReadActionsSectionProps = {
  /** List of read-only actions/permissions this plugin can perform. */
  actions?: ReadActionItem[];
  /** Callback fired when an action row is pressed. */
  onActionPress?: (id: string) => void;
  /** Custom style overrides for the section container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_ACTIONS: ReadActionItem[] = [
  { id: 'check-linked-status', name: 'Check linked status' },
  { id: 'fetch-notifications', name: 'Fetch notifications' },
  { id: 'sync-messages', name: 'Sync messages' },
];

export function PluginReadActionsSection({
  actions = DEFAULT_ACTIONS,
  onActionPress,
  style,
  testID = 'plugin-read-actions-section',
}: PluginReadActionsSectionProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={[styles.headerText, { color: theme.textMuted }]} testID={`${testID}-header`}>
        Read actions
      </Text>

      <View
        style={[styles.card, { backgroundColor: theme.cardBackground }]}
        testID={`${testID}-card`}
      >
        {actions.map((action, index) => {
          const isLast = index === actions.length - 1;

          return (
            <React.Fragment key={action.id}>
              <Pressable
                onPress={() => onActionPress?.(action.id)}
                accessibilityRole="button"
                accessibilityLabel={action.name}
                testID={`${testID}-item-${action.id}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text
                  style={[styles.actionName, { color: theme.text }]}
                  numberOfLines={1}
                  testID={`${testID}-item-${action.id}-name`}
                >
                  {action.name}
                </Text>

                <ChevronRight
                  size={16}
                  color={theme.textSecondary}
                  testID={`${testID}-item-${action.id}-chevron`}
                />
              </Pressable>

              {!isLast && (
                <View
                  style={[styles.divider, { backgroundColor: theme.divider }]}
                  testID={`${testID}-divider-${index}`}
                />
              )}
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
    maxWidth: PluginsTokens.readActionsSection.width,
    flexDirection: 'column',
    gap: 6,
  },
  headerText: {
    fontSize: PluginsTokens.readActionsSection.headerFontSize,
    fontWeight: '400',
    lineHeight: PluginsTokens.readActionsSection.headerLineHeight,
  },
  card: {
    borderRadius: PluginsTokens.readActionsSection.cardRadius,
    overflow: 'hidden',
  },
  row: {
    height: PluginsTokens.readActionsSection.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PluginsTokens.readActionsSection.rowPaddingHorizontal,
  },
  rowPressed: {
    opacity: 0.7,
  },
  actionName: {
    fontSize: PluginsTokens.readActionsSection.rowFontSize,
    fontWeight: '400',
    lineHeight: PluginsTokens.readActionsSection.rowLineHeight,
    flex: 1,
    paddingRight: 12,
  },
  divider: {
    height: 1,
    marginLeft: PluginsTokens.readActionsSection.dividerInsetLeft,
  },
});
