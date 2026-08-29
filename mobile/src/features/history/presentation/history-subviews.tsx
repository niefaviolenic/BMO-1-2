import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { HistoryScreenShell } from "./history-screen-shell";

export function HistoryMainView() {
  const theme = useTheme();
  return (
    <HistoryScreenShell initialCategory="all">
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>📜 Activity Logs (All)</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Day 14: Completed daily check-in & mindfulness exercise</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Day 10: Unlocked 10 Days Clean Achievement</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Day 8: Relapse log recorded & urge reflection saved</Text>
      </View>
    </HistoryScreenShell>
  );
}

export function HistoryMilestonesView() {
  const theme = useTheme();
  return (
    <HistoryScreenShell initialCategory="milestones">
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>🚩 Milestones History</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Day 14: 2 Weeks Clean Milestone</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Day 7: 1 Week Sigma Streak</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Day 3: 3 Days Mewing Reset</Text>
      </View>
    </HistoryScreenShell>
  );
}

export function HistoryAchievementsView() {
  const theme = useTheme();
  return (
    <HistoryScreenShell initialCategory="achievements">
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>🏆 Achievements History</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Rizzler Badge Unlocked (Day 14)</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Sigma Badge Unlocked (Day 7)</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• First Touch Grass Badge Unlocked (Day 1)</Text>
      </View>
    </HistoryScreenShell>
  );
}

export function HistoryRelapsesView() {
  const theme = useTheme();
  return (
    <HistoryScreenShell initialCategory="relapses">
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>⚠️ Relapses History</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Day 8: Late night urge trigger - Reflected & restarted streak</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Total relapses this month: 1</Text>
      </View>
    </HistoryScreenShell>
  );
}

export function HistoryWinRateView() {
  const theme = useTheme();
  return (
    <HistoryScreenShell initialCategory="winrate">
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>📈 Win Rate Analytics</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Current Win Rate: 85%</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• 18 Clean Days out of 21 Total Days</Text>
        <Text style={[styles.cardText, { color: theme.textSecondary }]}>• Current Streak: 14 Days Clean</Text>
      </View>
    </HistoryScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  cardText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
});
