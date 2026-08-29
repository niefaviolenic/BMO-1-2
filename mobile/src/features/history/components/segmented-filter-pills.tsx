import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/hooks/use-theme";

export type HistoryFilterCategory = "all" | "milestones" | "achievements" | "relapses" | "winrate";

export type FilterOption = {
  id: HistoryFilterCategory;
  label: string;
};

export type SegmentedFilterPillsProps = {
  selectedCategory?: HistoryFilterCategory;
  onSelectCategory?: (category: HistoryFilterCategory) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { id: "all", label: "All Logs" },
  { id: "milestones", label: "Milestones" },
  { id: "achievements", label: "Achievements" },
  { id: "relapses", label: "Relapses" },
  { id: "winrate", label: "Win Rate" },
];

export function SegmentedFilterPills({
  selectedCategory = "all",
  onSelectCategory,
  style,
  testID = "segmented-filter-pills",
}: SegmentedFilterPillsProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, style]} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTER_OPTIONS.map((option) => {
          const isSelected = option.id === selectedCategory;
          return (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.8}
              onPress={() => onSelectCategory?.(option.id)}
              style={[
                styles.pill,
                isSelected
                  ? [styles.pillSelected, { backgroundColor: theme.text }]
                  : [styles.pillUnselected, { backgroundColor: theme.cardBackgroundSubtle }],
              ]}
              testID={`${testID}-pill-${option.id}`}
            >
              <Text
                style={[
                  styles.pillText,
                  isSelected
                    ? [styles.pillTextSelected, { color: theme.background }]
                    : [styles.pillTextUnselected, { color: theme.textSecondary }],
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  scrollContent: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  pillSelected: {
    backgroundColor: "#0F172A",
  },
  pillUnselected: {
    backgroundColor: "#F1F5F9",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  pillTextSelected: {
    color: "#FFFFFF",
  },
  pillTextUnselected: {
    color: "#64748B",
  },
});
