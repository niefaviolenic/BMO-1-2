import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { RobotScreenTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { claimWithCode, useRobotConnection } from '@/features/robot/data/use-robot-connection';
import { mapPairingApiError } from '@/features/robot/domain/robot-connection';
import { RobotCodeInputCard } from '@/features/robot/components';
import { CameraScanHero } from '@/features/robot/presentation/camera-scan-screen/components/camera-scan-hero';
import { ConnectedSuccessHero } from '@/features/robot/presentation/connected-success-screen/components/connected-success-hero';
import {
  PairingInstructionsCard,
  type PairingStep,
} from '@/features/plugins/presentation/whatsapp-pairing/components/pairing-instructions-card';
import { useStepSlideTransition } from '@/hooks/use-step-slide-transition';

export type RobotPairStep = 'code' | 'success';

export type RobotPairSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const STEP_ORDER: RobotPairStep[] = ['code', 'success'];

const CODE_STEPS: PairingStep[] = [
  {
    step: 1,
    title: 'Locate Code on Joy',
    description: 'Check your Joy Robot face screen for the 6-digit code.',
  },
  {
    step: 2,
    title: 'Type Code Above',
    description: 'Enter each digit into the input boxes.',
  },
  {
    step: 3,
    title: 'Automatic Pairing',
    description: 'Joy connects automatically once all 6 digits are entered.',
  },
];

function getStepDirection(from: RobotPairStep, to: RobotPairStep): number {
  return STEP_ORDER.indexOf(to) - STEP_ORDER.indexOf(from);
}

export function RobotPairSheet({
  isVisible,
  onClose,
  style,
  testID = 'robot-pair-sheet',
}: RobotPairSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const sectionWidth = Math.min(
    windowWidth - Tokens.layout.pairHorizontalPadding * 2,
    Tokens.layout.pairSectionWidth
  );
  const sidePadding = Math.max(
    (windowWidth - sectionWidth) / 2,
    Tokens.layout.pairHorizontalPadding
  );

  const [pairStep, setPairStep] = useState<RobotPairStep>('code');
  const [pairingCode, setPairingCode] = useState('');
  const [pairError, setPairError] = useState<string | null>(null);
  const { isPairing } = useRobotConnection();

  const { activeStep, contentTranslateX } = useStepSlideTransition({
    currentStep: pairStep,
    getDirection: getStepDirection,
    width: windowWidth,
    duration: Tokens.slide.duration,
  });

  useEffect(() => {
    if (!isVisible) {
      setPairStep('code');
      setPairingCode('');
      setPairError(null);
    }
  }, [isVisible]);

  const handleClaim = async (code: string) => {
    setPairError(null);
    try {
      await claimWithCode(code);
      setPairStep('success');
    } catch (error) {
      setPairError(mapPairingApiError(error));
    }
  };

  const handleCodeChange = (next: string) => {
    setPairError(null);
    setPairingCode(next);
    if (next.length === 6 && !isPairing && pairStep === 'code') {
      void handleClaim(next);
    }
  };

  const headerTitle =
    activeStep === 'code' ? 'Enter Pairing Code' : 'Pairing Complete';

  const handleClose = () => {
    onClose();
  };

  const handleBack = () => {
    if (pairStep === 'success') {
      return;
    }
    handleClose();
  };

  const handleDone = () => {
    handleClose();
  };

  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={handleClose}
      showCloseButton={false}
      dragBehavior="resist"
      dismissOnBackdropPress
      dismissOnRequestClose
      disableScrollView
      header={
        <View
          style={[styles.headerRow, { paddingHorizontal: sidePadding }]}
          testID={`${testID}-header`}
        >
          {activeStep === 'success' ? (
            <View style={styles.headerSpacer} />
          ) : (
            <LiquidGlassBackButton
              onPress={handleBack}
              testID={`${testID}-back-button`}
            />
          )}
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} testID={`${testID}-title`}>
            {headerTitle}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      }
      overlay={
        activeStep === 'success' ? (
          <View
            style={[
              styles.doneBar,
              {
                backgroundColor: theme.modalBackground,
                paddingBottom: insets.bottom + 12,
                paddingHorizontal: sidePadding,
              },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.doneButton,
                { backgroundColor: theme.buttonPrimaryBackground, width: sectionWidth },
                pressed && styles.doneButtonPressed,
              ]}
              onPress={handleDone}
              accessibilityRole="button"
              accessibilityLabel="Done"
              testID={`${testID}-done-button`}
            >
              <Text style={[styles.doneButtonText, { color: theme.buttonPrimaryText }]}>Done</Text>
            </Pressable>
          </View>
        ) : null
      }
      sheetStyle={[styles.sheetBackground, { backgroundColor: theme.modalBackground }]}
      testID={testID}
    >
      <View style={[styles.body, style]} testID={`${testID}-content`}>
        <Animated.View
          style={[
            styles.slideContainer,
            { transform: [{ translateX: contentTranslateX }] },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingHorizontal: sidePadding,
                paddingBottom:
                  activeStep === 'success'
                    ? 88
                    : Tokens.layout.scrollBottomExtra,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            testID={`${testID}-scroll`}
          >
            {activeStep === 'code' ? (
              <View style={styles.stepStack} testID={`${testID}-code-step`}>
                <CameraScanHero
                  title="Enter 6-Digit Pairing Code"
                  subtitle="Enter the pairing code shown on your Joy Robot face screen."
                  style={{ width: sectionWidth }}
                />
                <RobotCodeInputCard
                  code={pairingCode}
                  onCodeChange={handleCodeChange}
                  isError={Boolean(pairError)}
                  digitsOnly
                  autoFocus
                  editable={!isPairing}
                  style={{ width: sectionWidth }}
                  testID={`${testID}-code-input`}
                />
                {isPairing ? (
                  <ActivityIndicator color={Tokens.colors.toggleLink} />
                ) : null}
                {pairError ? (
                  <Text style={styles.errorText} testID={`${testID}-code-error`}>
                    {pairError}
                  </Text>
                ) : null}
                <PairingInstructionsCard
                  headerLabel="ENTRY INSTRUCTIONS"
                  steps={CODE_STEPS}
                  style={{ width: sectionWidth }}
                  testID={`${testID}-code-instructions`}
                />
              </View>
            ) : null}

            {activeStep === 'success' ? (
              <View style={styles.successStack} testID={`${testID}-success-step`}>
                <ConnectedSuccessHero style={{ width: sectionWidth }} />
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: Tokens.colors.background,
    paddingHorizontal: 0,
  },
  headerRow: {
    width: '100%',
    height: Tokens.layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Tokens.headerTitle.fontSize,
    fontWeight: Tokens.headerTitle.fontWeight,
    lineHeight: Tokens.headerTitle.lineHeight,
    color: Tokens.colors.toggleLink,
    paddingHorizontal: 8,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  body: {
    flex: 1,
    width: '100%',
  },
  slideContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  stepStack: {
    gap: Tokens.layout.contentGap,
    width: '100%',
  },
  successStack: {
    width: '100%',
    paddingTop: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: Tokens.colors.errorText,
  },
  doneBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    backgroundColor: Tokens.colors.background,
    paddingTop: 8,
  },
  doneButton: {
    height: Tokens.primaryButton.height,
    borderRadius: Tokens.primaryButton.borderRadius,
    backgroundColor: Tokens.colors.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonPressed: {
    opacity: 0.85,
  },
  doneButtonText: {
    fontSize: Tokens.primaryButton.fontSize,
    fontWeight: Tokens.primaryButton.fontWeight,
    color: Tokens.colors.primaryButtonText,
  },
});
