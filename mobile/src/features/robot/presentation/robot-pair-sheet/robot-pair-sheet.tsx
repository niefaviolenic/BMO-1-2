import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bluetooth, Wifi, ChevronRight } from 'lucide-react-native';

import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { RobotScreenTokens as Tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ConnectedSuccessHero } from '@/features/robot/presentation/connected-success-screen/components/connected-success-hero';
import { CameraScanHero } from '@/features/robot/presentation/camera-scan-screen/components/camera-scan-hero';
import { useStepSlideTransition } from '@/hooks/use-step-slide-transition';
import {
  provisioningManager,
  type DiscoveredJoy,
  type DiscoveredWifiNetwork,
  type ProvisioningSessionState,
} from '@/features/robot/data/provisioning-flow';

export type RobotPairStep = 'scan' | 'confirm' | 'wifi' | 'success';

export type RobotPairSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const STEP_ORDER: RobotPairStep[] = ['scan', 'confirm', 'wifi', 'success'];

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
    Tokens.layout.pairSectionWidth,
  );
  const sidePadding = Math.max(
    (windowWidth - sectionWidth) / 2,
    Tokens.layout.pairHorizontalPadding,
  );

  const [session, setSession] = useState<ProvisioningSessionState>(() =>
    provisioningManager.getState(),
  );
  const [currentStep, setCurrentStep] = useState<RobotPairStep>('scan');
  const [wifiPassword, setWifiPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return provisioningManager.subscribe((next) => {
      setSession(next);
      if (next.step === 'waiting_physical_confirm') {
        setCurrentStep('confirm');
      } else if (next.step === 'entering_wifi_password' || next.step === 'scanning_wifi') {
        setCurrentStep('wifi');
      } else if (next.step === 'success') {
        setCurrentStep('success');
      }
    });
  }, []);

  useEffect(() => {
    if (isVisible) {
      provisioningManager.reset();
      setWifiPassword('');
      setCurrentStep('scan');
      void provisioningManager.startScanning();
    } else {
      provisioningManager.reset();
    }
  }, [isVisible]);

  const { activeStep, contentTranslateX } = useStepSlideTransition({
    currentStep,
    getDirection: getStepDirection,
    width: windowWidth,
    duration: Tokens.slide.duration,
  });

  const handleSelectJoy = async (joy: DiscoveredJoy) => {
    try {
      await provisioningManager.selectJoy(joy);
    } catch {
      // Error is tracked in session.error
    }
  };

  const handleConfirmHold = async () => {
    setIsSubmitting(true);
    try {
      await provisioningManager.triggerDemoPhysicalConfirmation();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitWifi = async () => {
    setIsSubmitting(true);
    try {
      await provisioningManager.submitWifiCredentials(wifiPassword);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'confirm') {
      setCurrentStep('scan');
    } else if (currentStep === 'wifi') {
      setCurrentStep('confirm');
    } else {
      onClose();
    }
  };

  const headerTitle =
    activeStep === 'scan'
      ? 'Pair Nearby Joy'
      : activeStep === 'confirm'
      ? 'Physical Confirmation'
      : activeStep === 'wifi'
      ? 'Connect to Wi-Fi'
      : 'Setup Complete';

  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClose}
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
          <Text
            style={[styles.headerTitle, { color: theme.text }]}
            numberOfLines={1}
            testID={`${testID}-title`}
          >
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
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Done"
              testID={`${testID}-done-button`}
            >
              <Text style={[styles.doneButtonText, { color: theme.buttonPrimaryText }]}>
                Done
              </Text>
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
                paddingBottom: activeStep === 'success' ? 88 : Tokens.layout.scrollBottomExtra,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            testID={`${testID}-scroll`}
          >
            {activeStep === 'scan' ? (
              <View style={styles.stepStack} testID={`${testID}-scan-step`}>
                <CameraScanHero
                  title="Discovering Nearby Joy"
                  subtitle="Hold Joy's touch sensor for 5 seconds to open pairing mode."
                  style={{ width: sectionWidth }}
                />

                {session.discoveredJoys.length === 0 ? (
                  <View style={[styles.emptyCard, { width: sectionWidth, borderColor: theme.border }]}>
                    <ActivityIndicator size="small" color={theme.linkPrimary} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      Searching for nearby Joy beacons...
                    </Text>
                  </View>
                ) : (
                  session.discoveredJoys.map((joy) => (
                    <Pressable
                      key={joy.id}
                      style={({ pressed }) => [
                        styles.joyItemRow,
                        { width: sectionWidth, borderColor: theme.border, backgroundColor: theme.cardBackground },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => handleSelectJoy(joy)}
                      accessibilityRole="button"
                      testID={`${testID}-joy-item-${joy.provisioningRef}`}
                    >
                      <View style={styles.joyIconBox}>
                        <Bluetooth size={20} color={theme.linkPrimary} />
                      </View>
                      <View style={styles.joyInfoBox}>
                        <Text style={[styles.joyNameText, { color: theme.text }]}>{joy.name}</Text>
                        <Text style={[styles.joySubText, { color: theme.textSecondary }]}>
                          Signal: {joy.rssi} dBm • Ref: {joy.provisioningRef}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={theme.textSecondary} />
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {activeStep === 'confirm' ? (
              <View style={styles.stepStack} testID={`${testID}-confirm-step`}>
                <CameraScanHero
                  title="Hold Touch to Confirm"
                  subtitle="Hold your Joy's touch sensor for 2 seconds to prove physical presence."
                  style={{ width: sectionWidth }}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.confirmButton,
                    { width: sectionWidth, backgroundColor: theme.buttonPrimaryBackground },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={handleConfirmHold}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  testID={`${testID}-confirm-hold-btn`}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                  ) : (
                    <Text style={[styles.confirmButtonText, { color: theme.buttonPrimaryText }]}>
                      Simulate 2s Touch Hold
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {activeStep === 'wifi' ? (
              <View style={styles.stepStack} testID={`${testID}-wifi-step`}>
                <CameraScanHero
                  title="Select Wi-Fi Network"
                  subtitle="Choose your 2.4 GHz Wi-Fi network detected by Joy."
                  style={{ width: sectionWidth }}
                />

                {session.discoveredNetworks.length === 0 ? (
                  <View style={[styles.emptyCard, { width: sectionWidth, borderColor: theme.border }]}>
                    <ActivityIndicator size="small" color={theme.linkPrimary} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      Joy is scanning for Wi-Fi networks...
                    </Text>
                  </View>
                ) : (
                  <View style={{ width: sectionWidth, gap: 10 }}>
                    {session.discoveredNetworks.map((net) => {
                      const isSelected = session.selectedNetwork?.ssid === net.ssid;
                      return (
                        <Pressable
                          key={net.ssid}
                          style={[
                            styles.wifiItemRow,
                            {
                              borderColor: isSelected ? theme.linkPrimary : theme.border,
                              backgroundColor: isSelected ? theme.cardBackgroundSubtle : theme.cardBackground,
                            },
                          ]}
                          onPress={() => provisioningManager.selectWifiNetwork(net)}
                          accessibilityRole="button"
                          testID={`${testID}-wifi-item-${net.ssid}`}
                        >
                          <Wifi
                            size={18}
                            color={isSelected ? theme.linkPrimary : theme.text}
                          />
                          <Text
                            style={[
                              styles.wifiSsidText,
                              { color: theme.text, fontWeight: isSelected ? '600' : '400' },
                            ]}
                          >
                            {net.ssid}
                          </Text>
                          <Text style={[styles.wifiSecurityText, { color: theme.textSecondary }]}>
                            {net.security}
                          </Text>
                        </Pressable>
                      );
                    })}

                    {session.selectedNetwork ? (
                      <View style={[styles.passwordBox, { borderColor: theme.border }]}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>Wi-Fi Password</Text>
                        <TextInput
                          style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
                          placeholder="Enter Wi-Fi password"
                          placeholderTextColor={theme.textMuted}
                          secureTextEntry
                          value={wifiPassword}
                          onChangeText={setWifiPassword}
                          autoCapitalize="none"
                          testID={`${testID}-wifi-password-input`}
                        />
                        <Pressable
                          style={({ pressed }) => [
                            styles.connectButton,
                            { backgroundColor: theme.buttonPrimaryBackground },
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={handleSubmitWifi}
                          disabled={isSubmitting}
                          accessibilityRole="button"
                          testID={`${testID}-wifi-connect-btn`}
                        >
                          {isSubmitting ? (
                            <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                          ) : (
                            <Text style={[styles.connectButtonText, { color: theme.buttonPrimaryText }]}>
                              Connect Joy
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            ) : null}

            {activeStep === 'success' ? (
              <View style={styles.stepStack} testID={`${testID}-success-step`}>
                <ConnectedSuccessHero
                  title="Joy Connected!"
                  subtitle="Your Joy is paired and online. Bluetooth is no longer needed."
                  style={{ width: sectionWidth }}
                />
              </View>
            ) : null}

            {session.error ? (
              <Text style={styles.errorText} testID={`${testID}-error`}>
                {session.error}
              </Text>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  body: {
    flex: 1,
  },
  slideContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 16,
  },
  stepStack: {
    alignItems: 'center',
    gap: 16,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 14,
  },
  joyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
    gap: 12,
  },
  joyIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joyInfoBox: {
    flex: 1,
  },
  joyNameText: {
    fontSize: 16,
    fontWeight: '600',
  },
  joySubText: {
    fontSize: 13,
    marginTop: 2,
  },
  confirmButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  wifiItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    gap: 10,
  },
  wifiSsidText: {
    flex: 1,
    fontSize: 15,
  },
  wifiSecurityText: {
    fontSize: 12,
  },
  passwordBox: {
    marginTop: 10,
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  connectButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  doneBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 12,
  },
  doneButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonPressed: {
    opacity: 0.8,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
