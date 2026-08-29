import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { HeroPmoCard } from "@/features/chat/components/hero-pmo-card";
import { SegmentedFilterPills, type HistoryFilterCategory } from "../components/segmented-filter-pills";
import { WeeklyActivityStrip } from "../components/weekly-activity-strip";

export type HistoryScreenShellProps = {
  initialCategory?: HistoryFilterCategory;
  daysStreak?: number;
  bestStreak?: number;
  winRatePercentage?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function HistoryScreenShell({
  initialCategory = "all",
  daysStreak = 14,
  bestStreak = 21,
  winRatePercentage = 85,
  children,
  style,
  testID = "history-screen-shell",
}: HistoryScreenShellProps) {
  const [activeCategory, setActiveCategory] = useState<HistoryFilterCategory>(initialCategory);
  const theme = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }, style]} testID={testID}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hero Card: Modern Recovery Hero Card (154:3934) */}
        <HeroPmoCard
          mode="recovery-hero"
          daysStreak={daysStreak}
          bestStreak={bestStreak}
          winRatePercentage={winRatePercentage}
          testID={`${testID}-hero-card`}
        />

        {/* Weekly Activity Strip Card (90:3191) */}
        <WeeklyActivityStrip testID={`${testID}-weekly-strip`} />

        {/* Segmented Filter Pills */}
        <SegmentedFilterPills
          selectedCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          testID={`${testID}-filter-pills`}
        />

        {/* Tab Specific Content / Timeline list */}
        <View style={styles.contentContainer} testID={`${testID}-content`}>
          {children ? (
            children
          ) : (
            <View
              style={[
                styles.placeholderBox,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.placeholderTitle, { color: theme.text }]}>
                Showing: {activeCategory.toUpperCase()} History
              </Text>
              <Text style={[styles.placeholderSub, { color: theme.textSecondary }]}>
                Both Modern Recovery Hero Card and Weekly Activity Strip are active across all history views.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  contentContainer: {
    width: "100%",
    gap: 12,
  },
  placeholderBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 20,
    gap: 6,
    alignItems: "center",
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  placeholderSub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
});
