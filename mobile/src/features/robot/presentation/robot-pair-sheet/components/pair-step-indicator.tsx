import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { RobotPairSheetTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RobotPairStep } from '../robot-pair-sheet';

export type PairStepIndicatorProps = {
  currentStep: RobotPairStep;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const STEPS: RobotPairStep[] = ['scan', 'confirm', 'wifi', 'success'];

export function PairStepIndicator({
  currentStep,
  style,
  testID = 'pair-step-indicator',
}: PairStepIndicatorProps) {
  const theme = useTheme();
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <View style={[styles.container, style]} testID={testID} accessibilityRole="progressbar">
      {STEPS.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        const width = isActive
          ? Tokens.stepIndicator.activeWidth
          : Tokens.stepIndicator.inactiveWidth;

        return (
          <View
            key={step}
            style={[
              styles.pill,
              {
                width,
                backgroundColor: isActive
                  ? theme.linkPrimary
                  : isCompleted
                  ? theme.text
                  : theme.border,
                opacity: isActive || isCompleted ? 1 : 0.4,
              },
            ]}
            testID={`${testID}-step-${step}`}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Tokens.stepIndicator.gap,
    paddingVertical: 8,
  },
  pill: {
    height: Tokens.stepIndicator.height,
    borderRadius: Tokens.stepIndicator.borderRadius,
  },
});
