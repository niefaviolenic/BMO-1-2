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
import { Eye, EyeOff, RefreshCw } from 'lucide-react-native';

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
  type ProvisioningSessionState,
} from '@/features/robot/data/provisioning-flow';
import { hydrateDevices } from '@/features/robot/data/robot-connection-store';
import {
  PairStepIndicator,
  BluetoothStatusBanner,
  JoyTroubleshootingCard,
  JoyBeaconItem,
  WifiNetworkItem,
  PairErrorCard,
} from './components';

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

  const [session, setSession] = useState<ProvisioningSessionState>(() =>
    provisioningManager.getState(),
  );
  const [currentStep, setCurrentStep] = useState<RobotPairStep>('scan');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      } else if (next.step === 'scanning' || next.step === 'idle') {
        setCurrentStep('scan');
      }
    });
  }, []);

  const { activeStep, contentTranslateX, reset: resetSlide } = useStepSlideTransition({
    currentStep,
    getDirection: getStepDirection,
    width: windowWidth,
    duration: Tokens.slide.duration,
  });

  useEffect(() => {
    if (isVisible) {
      provisioningManager.reset();
      setWifiSsid('');
      setWifiPassword('');
      setShowPassword(false);
      setCurrentStep('scan');
      resetSlide?.('scan');
      void provisioningManager.startScanning();
    } else {
      provisioningManager.reset();
      setCurrentStep('scan');
      resetSlide?.('scan');
    }
  }, [isVisible]);
  const handleSelectJoy = async (joy: DiscoveredJoy) => {
    try {
      await provisioningManager.selectJoy(joy);
    } catch {
      // Error is tracked in session.error
    }
  };



  const handleSubmitWifi = async (manualSsid?: string) => {
    const targetSsid = manualSsid || session.selectedNetwork?.ssid || wifiSsid.trim();
    if (!targetSsid) return;
    setIsSubmitting(true);
    try {
      await provisioningManager.submitWifiCredentials(wifiPassword, targetSsid);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleRescan = () => {
    void provisioningManager.restartScanning();
  };

  const handleRefreshWifi = () => {
    provisioningManager.requestDeviceWifiScan();
  };

  const handleClearError = () => {
    provisioningManager.clearError();
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
        <View style={styles.headerColumn} testID={`${testID}-header`}>
          <View style={styles.headerRow}>
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
          <PairStepIndicator
            currentStep={activeStep}
            testID={`${testID}-step-indicator`}
          />
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
              },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.doneButton,
                { backgroundColor: theme.buttonPrimaryBackground },
                pressed && styles.doneButtonPressed,
              ]}
              onPress={() => {
                void hydrateDevices();
                onClose();
              }}
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
                paddingBottom: activeStep === 'success' ? 88 : Tokens.layout.scrollBottomExtra,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            testID={`${testID}-scroll`}
          >
            {session.error ? (
              <PairErrorCard
                message={session.error}
                onDismiss={handleClearError}
                onRetry={
                  activeStep === 'scan'
                    ? handleRescan
                    : activeStep === 'wifi'
                    ? handleSubmitWifi
                    : undefined
                }
                style={styles.errorBannerSpacing}
                testID={`${testID}-error`}
              />
            ) : null}

            {activeStep === 'scan' ? (
              <View style={styles.stepStack} testID={`${testID}-scan-step`}>
                <BluetoothStatusBanner
                  testID={`${testID}-bluetooth-banner`}
                />

                <CameraScanHero
                  title="Discovering Nearby Joy"
                  subtitle="Hold Joy's touch sensor for 5 seconds to open pairing mode."
                  style={styles.fullWidth}
                />

                {session.discoveredJoys.length === 0 ? (
                  <View
                    style={[
                      styles.emptyCard,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.cardBackgroundSubtle ?? theme.cardBackground,
                      },
                    ]}
                    testID={`${testID}-scanning-box`}
                  >
                    <ActivityIndicator size="small" color={theme.linkPrimary} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      Searching for nearby Joy beacons...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.joyListContainer}>
                    {session.discoveredJoys.map((joy) => (
                      <JoyBeaconItem
                        key={joy.id}
                        joy={joy}
                        onPress={handleSelectJoy}
                        testID={`${testID}-joy-item-${joy.provisioningRef}`}
                      />
                    ))}
                  </View>
                )}

                <JoyTroubleshootingCard
                  onRescan={handleRescan}
                  isScanning={session.isScanning}
                  testID={`${testID}-troubleshooting-card`}
                />
              </View>
            ) : null}

            {activeStep === 'confirm' ? (
              <View style={styles.stepStack} testID={`${testID}-confirm-step`}>
                <CameraScanHero
                  title="Hold Touch to Confirm"
                  subtitle="Touch and hold your Joy's top capacitive sensor for 2 seconds to prove physical presence."
                  style={styles.fullWidth}
                />

                <View
                  style={[
                    styles.emptyCard,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.cardBackgroundSubtle ?? theme.cardBackground,
                      paddingVertical: 24,
                      gap: 12,
                    },
                  ]}
                  testID={`${testID}-waiting-touch-indicator`}
                >
                  <ActivityIndicator size="small" color={theme.linkPrimary} />
                  <Text style={[styles.emptyText, { color: theme.text, fontWeight: '600' }]}>
                    Waiting for 2s touch on Joy Robot...
                  </Text>
                  <Text style={[styles.emptyText, { color: theme.textSecondary, textAlign: 'center', paddingHorizontal: 20 }]}>
                    The physical robot will automatically verify and advance setup once touched.
                  </Text>
                </View>
              </View>
            ) : null}

            {activeStep === 'wifi' ? (
              <View style={styles.stepStack} testID={`${testID}-wifi-step`}>
                <CameraScanHero
                  title="Connect to Wi-Fi"
                  subtitle="Enter your 2.4 GHz Wi-Fi network credentials for Joy."
                  style={styles.fullWidth}
                />

                {session.discoveredNetworks.length === 0 ? (
                  <View style={styles.wifiContainer}>
                    <View
                      style={[
                        styles.passwordBox,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.cardBackground,
                        },
                      ]}
                    >
                      <Text style={[styles.inputLabel, { color: theme.text }]}>
                        Wi-Fi Network Credentials
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            color: theme.text,
                            borderColor: theme.border,
                            backgroundColor: theme.cardBackgroundSubtle ?? theme.cardBackground,
                            marginBottom: 12,
                          },
                        ]}
                        placeholder="Wi-Fi Network Name (SSID)"
                        placeholderTextColor={theme.textMuted}
                        value={wifiSsid}
                        onChangeText={setWifiSsid}
                        autoCapitalize="none"
                        autoCorrect={false}
                        testID={`${testID}-wifi-ssid-input`}
                      />
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={[
                            styles.textInput,
                            {
                              color: theme.text,
                              borderColor: theme.border,
                              backgroundColor: theme.cardBackgroundSubtle ?? theme.cardBackground,
                            },
                          ]}
                          placeholder="Wi-Fi Password"
                          placeholderTextColor={theme.textMuted}
                          secureTextEntry={!showPassword}
                          value={wifiPassword}
                          onChangeText={setWifiPassword}
                          autoCapitalize="none"
                          autoCorrect={false}
                          testID={`${testID}-wifi-manual-password-input`}
                        />
                        <Pressable
                          style={styles.eyeButton}
                          onPress={() => setShowPassword((prev) => !prev)}
                          accessibilityRole="button"
                          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                          testID={`${testID}-toggle-manual-password-visibility`}
                        >
                          {showPassword ? (
                            <EyeOff size={18} color={theme.textSecondary} />
                          ) : (
                            <Eye size={18} color={theme.textSecondary} />
                          )}
                        </Pressable>
                      </View>

                      <Pressable
                        style={({ pressed }) => [
                          styles.connectButton,
                          {
                            backgroundColor:
                              wifiSsid.trim().length > 0
                                ? theme.buttonPrimaryBackground
                                : theme.border,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => handleSubmitWifi(wifiSsid.trim())}
                        disabled={isSubmitting || wifiSsid.trim().length === 0}
                        accessibilityRole="button"
                        testID={`${testID}-wifi-manual-connect-btn`}
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
                  </View>
                ) : (
                  <View style={styles.wifiContainer}>
                    <View style={styles.wifiHeaderRow}>
                      <Text style={[styles.wifiListTitle, { color: theme.textSecondary }]}>
                        Available Networks ({session.discoveredNetworks.length})
                      </Text>
                      <Pressable
                        style={styles.refreshWifiButton}
                        onPress={handleRefreshWifi}
                        accessibilityRole="button"
                        testID={`${testID}-refresh-wifi-btn`}
                      >
                        <RefreshCw size={12} color={theme.linkPrimary} />
                        <Text style={[styles.refreshWifiText, { color: theme.linkPrimary }]}>
                          Refresh
                        </Text>
                      </Pressable>
                    </View>

                    {session.discoveredNetworks.map((net) => (
                      <WifiNetworkItem
                        key={net.ssid}
                        network={net}
                        isSelected={session.selectedNetwork?.ssid === net.ssid}
                        onSelect={(n) => provisioningManager.selectWifiNetwork(n)}
                        testID={`${testID}-wifi-item-${net.ssid}`}
                      />
                    ))}

                    {session.selectedNetwork ? (
                      <View
                        style={[
                          styles.passwordBox,
                          {
                            borderColor: theme.border,
                            backgroundColor: theme.cardBackground,
                          },
                        ]}
                      >
                        <Text style={[styles.inputLabel, { color: theme.text }]}>
                          Password for {session.selectedNetwork.ssid}
                        </Text>
                        <View style={styles.inputWrapper}>
                          <TextInput
                            style={[
                              styles.textInput,
                              {
                                color: theme.text,
                                borderColor: theme.border,
                                backgroundColor: theme.cardBackgroundSubtle ?? theme.cardBackground,
                              },
                            ]}
                            placeholder="Enter Wi-Fi password"
                            placeholderTextColor={theme.textMuted}
                            secureTextEntry={!showPassword}
                            value={wifiPassword}
                            onChangeText={setWifiPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            testID={`${testID}-wifi-password-input`}
                          />
                          <Pressable
                            style={styles.eyeButton}
                            onPress={() => setShowPassword((prev) => !prev)}
                            accessibilityRole="button"
                            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                            testID={`${testID}-toggle-password-visibility`}
                          >
                            {showPassword ? (
                              <EyeOff size={18} color={theme.textSecondary} />
                            ) : (
                              <Eye size={18} color={theme.textSecondary} />
                            )}
                          </Pressable>
                        </View>

                        <Pressable
                          style={({ pressed }) => [
                            styles.connectButton,
                            { backgroundColor: theme.buttonPrimaryBackground },
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() => handleSubmitWifi()}
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
                  style={styles.fullWidth}
                />
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerColumn: {
    width: '100%',
    paddingBottom: 8,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
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
    paddingTop: 8,
  },
  errorBannerSpacing: {
    marginBottom: 12,
  },
  stepStack: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  fullWidth: {
    width: '100%',
  },
  emptyCard: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    borderWidth: 1,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 14,
  },
  joyListContainer: {
    width: '100%',
    gap: 10,
  },
  confirmButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  wifiContainer: {
    width: '100%',
    gap: 10,
  },
  wifiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  wifiListTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refreshWifiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  refreshWifiText: {
    fontSize: 12,
    fontWeight: '600',
  },
  passwordBox: {
    width: '100%',
    marginTop: 6,
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 44,
    fontSize: 15,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  connectButton: {
    height: 48,
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
    left: 24,
    right: 24,
    alignItems: 'center',
    paddingTop: 12,
  },
  doneButton: {
    width: '100%',
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
});
