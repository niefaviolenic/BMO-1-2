import { Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { MemoryItemDto } from '@/features/settings/data/memory-settings-api';

export type WhatJoyRemembersSectionProps = {
  memories: MemoryItemDto[];
  isLoading?: boolean;
  onDeleteMemory?: (id: string) => Promise<void>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function WhatJoyRemembersSection({
  memories,
  isLoading = false,
  onDeleteMemory,
  style,
  testID = 'what-joy-remembers-section',
}: WhatJoyRemembersSectionProps) {
  const theme = useTheme();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeletePress = (item: MemoryItemDto) => {
    Alert.alert(
      'Forget Memory',
      `Are you sure you want Joy to forget this?\n\n"${item.content}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              await onDeleteMemory?.(item.id);
            } catch {
              Alert.alert('Error', 'Unable to delete memory. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.section, style]} testID={testID}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textSecondary }]} testID={`${testID}-title`}>
          WHAT JOY REMEMBERS
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Facts learned from your conversations. Joy uses these to personalize your experience.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox} testID={`${testID}-loading`}>
          <ActivityIndicator size="small" color={theme.text} />
        </View>
      ) : memories.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]} testID={`${testID}-empty`}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No memories recorded yet. As you chat, Joy will automatically remember personal details and preferences.
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer} testID={`${testID}-list`}>
          {memories.map((item) => {
            const isDeleting = deletingId === item.id;
            return (
              <View
                key={item.id}
                style={[
                  styles.memoryCard,
                  { backgroundColor: theme.cardBackground, borderColor: theme.border },
                ]}
                testID={`${testID}-item-${item.id}`}
              >
                <Text style={[styles.memoryContent, { color: theme.text }]}>
                  {item.content}
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.deleteButtonPressed,
                  ]}
                  onPress={() => handleDeletePress(item)}
                  disabled={isDeleting}
                  accessibilityRole="button"
                  accessibilityLabel={`Forget: ${item.content}`}
                  testID={`${testID}-delete-${item.id}`}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color={theme.textMuted} />
                  ) : (
                    <Trash2 size={16} color={theme.textMuted} strokeWidth={2} />
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  header: {
    gap: 4,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  listContainer: {
    gap: 8,
  },
  memoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  memoryContent: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  deleteButton: {
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonPressed: {
    opacity: 0.6,
  },
});
