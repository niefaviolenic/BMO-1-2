import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import {
  calculateBadgeProgress,
  getGenAlphaBadgeByDays,
  type GenAlphaBadgeTierId,
} from "../domain/streak-badge";
export type HeroPmoCardProps = {
  /** Streak days count. Drives dynamic badge & animated progress bar calculations. */
  daysStreak?: number;
  /** Best streak record count (e.g., 21). Defaults to 21 or max of daysStreak. */
  bestStreak?: number;
  /** Win rate percentage (e.g., 85). */
  winRatePercentage?: number;
  /** Optional subtext banner overriding default calculation. */
  subtextBanner?: string;
  /** Card view mode: "recovery-hero" (default matching node-id=154:3934) or "milestone-badge". */
  mode?: "recovery-hero" | "milestone-badge";
  /** Explicit tier override if provided. */
  tierOverride?: GenAlphaBadgeTierId;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function HeroPmoCard({
  daysStreak = 14,
  bestStreak = 21,
  winRatePercentage = 85,
  subtextBanner,
  mode = "recovery-hero",
  tierOverride,
  style,
  testID = "hero-pmo-card",
}: HeroPmoCardProps) {
  const theme = useTheme();
  const activeTier = tierOverride
    ? getGenAlphaBadgeByDays(daysStreak)
    : getGenAlphaBadgeByDays(daysStreak);

  const progressInfo = calculateBadgeProgress(daysStreak);
  const animatedProgress = useRef(new Animated.Value(progressInfo.progressPercentage)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progressInfo.progressPercentage,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [daysStreak, progressInfo.progressPercentage, animatedProgress]);

  const animatedWidth = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ["4%", "100%"],
  });

  if (mode === "recovery-hero") {
    const effectiveBest = Math.max(bestStreak, daysStreak);
    const defaultBannerText = `${winRatePercentage}% win rate over ${effectiveBest} days! Keep your momentum going!`;
    const bannerText = subtextBanner ?? defaultBannerText;

    return (
      <View
        style={[
          styles.cardContainer,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
          styles.recoveryHeroPadding,
          style,
        ]}
        testID={testID}
      >
        {/* Streak Header Row */}
        <View style={styles.streakHeaderRow} testID={`${testID}-header-row`}>
          {/* Left Metric Group */}
          <View style={styles.metricGroup} testID={`${testID}-metric-group`}>
            <Text
              style={[styles.bigStreakNumber, { color: theme.text }]}
              testID={`${testID}-days-clean-num`}
            >
              {daysStreak}
            </Text>
            <View style={styles.streakMetaStack}>
              <View style={styles.daysCleanBadge}>
                <Text style={styles.daysCleanBadgeText}>DAYS CLEAN</Text>
              </View>
              <Text style={[styles.currentStreakSubtext, { color: theme.textSecondary }]}>
                Current streak
              </Text>
            </View>
          </View>

          {/* Right Stats Stack */}
          <View style={styles.rightStatsStack} testID={`${testID}-right-stats`}>
            <View style={styles.metricRow}>
              <Text style={[styles.statValueText, { color: theme.text }]}>{effectiveBest}</Text>
              <View
                style={[
                  styles.statBadge,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[styles.statBadgeText, { color: theme.textSecondary }]}>BEST STREAK</Text>
              </View>
            </View>
            <View style={styles.metricRow}>
              <Text style={[styles.statValueText, { color: theme.text }]}>{winRatePercentage}%</Text>
              <View
                style={[
                  styles.statBadge,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[styles.statBadgeText, { color: theme.textSecondary }]}>WIN RATE</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Subtext Banner */}
        <View
          style={[
            styles.subtextBannerBox,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
          testID={`${testID}-banner`}
        >
          <Text style={[styles.subtextBannerText, { color: theme.textSecondary }]}>
            {bannerText}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      {/* Header Tag Row */}
      <View style={styles.headerTagRow}>
        <View
          style={[
            styles.currentStagePill,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
          testID={`${testID}-stage-pill`}
        >
          <Text style={styles.currentStageText}>✨ CURRENT STAGE</Text>
        </View>
        <View
          style={[styles.dayCapsuleTag, { backgroundColor: activeTier.accentColor }]}
          testID={`${testID}-day-tag`}
        >
          <Text style={styles.dayCapsuleText}>{activeTier.stageLabel}</Text>
        </View>
      </View>

      {/* Main Body Row */}
      <View style={styles.mainBodyRow}>
        <View
          style={[styles.avatarBox, { backgroundColor: `${activeTier.accentColor}26` }]}
          testID={`${testID}-avatar-box`}
        >
          <Text style={styles.avatarEmoji}>{activeTier.emoji}</Text>
        </View>

        <View style={styles.textContentCol}>
          <Text style={[styles.titleText, { color: theme.text }]} testID={`${testID}-title`}>
            {activeTier.name} Badge
          </Text>
          <Text
            style={[styles.subtitleText, { color: theme.textSecondary }]}
            numberOfLines={3}
            testID={`${testID}-subtitle`}
          >
            {activeTier.subtitle}
          </Text>
        </View>
      </View>

      {/* Next Milestone Footer */}
      <View style={styles.footerContainer} testID={`${testID}-footer`}>
        <View style={styles.milestoneRow}>
          <Text
            style={[styles.nextTierText, { color: theme.textSecondary }]}
            testID={`${testID}-next-tier`}
          >
            {progressInfo.nextTierName
              ? `Next Tier: ${progressInfo.nextTierName} (${activeTier.nextTierDays ? `Day ${activeTier.nextTierDays}` : ""})`
              : "Max Tier Unlocked"}
          </Text>
          <Text
            style={[styles.progressValueText, { color: theme.text }]}
            testID={`${testID}-progress-value`}
          >
            {progressInfo.currentDays} / {progressInfo.targetDays} Days
          </Text>
        </View>

        {/* Dynamic Animated Progress Bar Track */}
        <View
          style={[styles.progressTrack, { backgroundColor: theme.backgroundElement }]}
          testID={`${testID}-progress-track`}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: animatedWidth,
                backgroundColor: activeTier.accentColor,
              },
            ]}
            testID={`${testID}-progress-fill`}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  recoveryHeroPadding: {
    padding: 18,
  },
  headerTagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  currentStagePill: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  currentStageText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  dayCapsuleTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  dayCapsuleText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  mainBodyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    width: "100%",
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarEmoji: {
    fontSize: 26,
  },
  textContentCol: {
    flex: 1,
    gap: 4,
  },
  titleText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitleText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    color: "#64748B",
  },
  footerContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  nextTierText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  progressValueText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  progressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  streakHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  metricGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bigStreakNumber: {
    fontSize: 36,
    fontWeight: "700",
    color: "#0F172A",
  },
  streakMetaStack: {
    flexDirection: "column",
    gap: 2,
    alignItems: "flex-start",
  },
  daysCleanBadge: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  daysCleanBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  currentStreakSubtext: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
  },
  rightStatsStack: {
    alignItems: "flex-end",
    gap: 4,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statValueText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475469",
  },
  statBadge: {
    backgroundColor: "#F0F2F5",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#47556A",
  },
  subtextBannerBox: {
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#E3E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    width: "100%",
  },
  subtextBannerText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#475469",
    lineHeight: 16,
  },
});
