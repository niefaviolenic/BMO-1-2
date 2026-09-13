import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Check, Copy, RefreshCw } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type AppStateStatus,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { WhatsAppConnectScreenTokens as Tokens } from '@/constants/theme';
import { useWhatsAppSession } from '@/features/plugins/data/use-whatsapp-session';
import {
  getWhatsAppSessionState,
  hydrateWhatsAppSession,
  startWhatsAppConnect,
  stopWhatsAppConnectPolling,
} from '@/features/plugins/data/whatsapp-session-store';
import { mapPluginApiError } from '@/features/plugins/domain/plugin';
import {
  formatWhatsAppDisplayNumber,
  isWhatsAppConnected,
  secondsUntilExpiry,
  toWhatsAppE164,
} from '@/features/plugins/domain/whatsapp';
import {
  ActiveJoyCapabilitiesCard,
  PairingCodeDisplayBox,
  PairingCodeHero,
  PairingInstructionsCard,
  PairingPhoneHero,
  PairingSuccessHero,
  PhoneNumberInputCard,
  type PairingStep,
} from '@/features/plugins/presentation/whatsapp-pairing/components';
import { useStepSlideTransition } from '@/hooks/use-step-slide-transition';

export type StepState = 'phone' | 'code' | 'success';

export type WhatsAppConnectScreenProps = {
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const STEP_ORDER: StepState[] = ['phone', 'code', 'success'];

function getStepDirection(from: StepState, to: StepState): number {
  return STEP_ORDER.indexOf(to) - STEP_ORDER.indexOf(from);
}

function headerTitle(step: StepState): string {
  if (step === 'success') {
    return 'WhatsApp Integration';
  }
  if (step === 'code') {
    return 'Pairing Code';
  }
  return 'Link WhatsApp';
}

const PHONE_STEPS: PairingStep[] = [
  {
    step: 1,
    title: 'Enter phone number',
    description: 'Provide the number registered with your WhatsApp account.',
  },
  {
    step: 2,
    title: 'Get 8-digit pairing code',
    description: 'Joy generates a secure code to link with your WhatsApp.',
  },
  {
    step: 3,
    title: 'Enter code in WhatsApp',
    description: 'Link in Settings > Linked Devices > Link with phone number.',
  },
];

const CODE_STEPS: PairingStep[] = [
  {
    step: 1,
    title: 'Open WhatsApp',
    description: 'Go to Settings > Linked Devices on your phone.',
  },
  {
    step: 2,
    title: 'Tap Link a Device',
    description: "Choose 'Link with phone number instead'.",
  },
  {
    step: 3,
    title: 'Enter the 8-digit code',
    description: 'Type or paste the code above to finish linking.',
  },
];

export function WhatsAppConnectScreen({
  style,
  testID = 'whatsapp-connect-screen',
}: WhatsAppConnectScreenProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const sectionWidth = Math.min(
    windowWidth - Tokens.layout.horizontalPadding * 2,
    Tokens.layout.sectionWidth,
  );
  const sidePadding = Math.max(
    (windowWidth - sectionWidth) / 2,
    Tokens.layout.horizontalPadding,
  );

  const session = useWhatsAppSession();
  const [pairingStep, setPairingStep] = useState<StepState>(() => {
    if (isWhatsAppConnected(session.connection?.status)) {
      return 'success';
    }
    if (session.pairing?.code) {
      return 'code';
    }
    return 'phone';
  });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const { activeStep, contentTranslateX } = useStepSlideTransition({
    currentStep: pairingStep,
    getDirection: getStepDirection,
    width: windowWidth,
    duration: Tokens.slide.duration,
  });

  const isPhoneValid = useMemo(() => {
    const digits = phoneNumber.replace(/\D/gu, '');
    const national = digits.startsWith('0') ? digits.slice(1) : digits;
    return national.length >= 8 && national.length <= 13;
  }, [phoneNumber]);

  const e164Phone = useMemo(() => {
    if (!isPhoneValid) return null;
    try {
      return toWhatsAppE164(phoneNumber, '62');
    } catch {
      return null;
    }
  }, [isPhoneValid, phoneNumber]);

  useEffect(() => {
    void (async () => {
      await hydrateWhatsAppSession().catch(() => undefined);
      const state = getWhatsAppSessionState();
      if (isWhatsAppConnected(state.connection?.status)) {
        setPairingStep('success');
        return;
      }
      if (state.pairing?.code) {
        const remaining = secondsUntilExpiry(state.pairing.expiresAt);
        if (remaining && remaining > 0) {
          setPairingStep('code');
        }
      }
    })();
    return () => {
      stopWhatsAppConnectPolling();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        void (async () => {
          await hydrateWhatsAppSession().catch(() => undefined);
          const currentStatus = getWhatsAppSessionState().connection?.status;
          if (isWhatsAppConnected(currentStatus)) {
            stopWhatsAppConnectPolling();
            setPairingStep('success');
          }
        })();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isWhatsAppConnected(session.connection?.status)) {
      stopWhatsAppConnectPolling();
      setPairingStep('success');
    }
  }, [session.connection?.status]);

  useEffect(() => {
    if (pairingStep !== 'code') {
      return;
    }
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pairingStep]);

  const expiresInSeconds = useMemo(
    () => (nowMs ? secondsUntilExpiry(session.pairing?.expiresAt ?? null) ?? 0 : 0),
    [nowMs, session.pairing?.expiresAt],
  );
  const isCodeExpired = useMemo(() => {
    if (!session.pairing?.code) return false;
    return expiresInSeconds <= 0;
  }, [expiresInSeconds, session.pairing?.code]);

  useEffect(() => {
    if (isCodeExpired) {
      stopWhatsAppConnectPolling();
    }
  }, [isCodeExpired]);

  const handleRequestCode = async () => {
    if (!isPhoneValid || !e164Phone) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid WhatsApp phone number (8–13 digits).');
      return;
    }
    try {
      const result = await startWhatsAppConnect(e164Phone, { forceReset: true });
      if (result.pairing?.code) {
        setPairingStep('code');
      }
    } catch (error) {
      Alert.alert('Unable to generate pairing code', mapPluginApiError(error));
    }
  };

  const handleCopyCode = async () => {
    const code = session.pairing?.code;
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleChangePhoneNumber = () => {
    stopWhatsAppConnectPolling();
    setPairingStep('phone');
  };

  const handleDismiss = () => {
    if (pairingStep === 'code') {
      handleChangePhoneNumber();
      return;
    }
    stopWhatsAppConnectPolling();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/plugin-detail');
  };

  const showBackButton = activeStep !== 'success';
  const contentGap =
    activeStep === 'success'
      ? Tokens.layout.contentGapSuccess
      : Tokens.layout.contentGapPairing;
  const paddingTop = Math.max(insets.top, 16);
  const paddingBottom = Math.max(insets.bottom, 16);

  const displayPhone = formatWhatsAppDisplayNumber(phoneNumber || undefined);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, style]} testID={testID}>
      <View style={[styles.screen, { backgroundColor: theme.background, paddingTop }]}>
        <View
          style={[styles.headerBar, { width: sectionWidth }]}
          testID={`${testID}-header`}
        >
          {showBackButton ? (
            <LiquidGlassBackButton
              onPress={handleDismiss}
              testID={`${testID}-back-btn`}
            />
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {headerTitle(activeStep)}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.slideViewport}>
          <Animated.View
            style={[
              styles.slideTrack,
              { transform: [{ translateX: contentTranslateX }] },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.scrollContent,
                {
                  paddingLeft: sidePadding,
                  paddingRight: sidePadding,
                  paddingBottom:
                    paddingBottom +
                    Tokens.layout.scrollBottomExtra +
                    Tokens.primaryButton.height * 2 +
                    Tokens.primaryButton.gap * 2,
                  gap: contentGap,
                },
              ]}
              style={styles.scrollView}
              keyboardShouldPersistTaps="handled"
              testID={`${testID}-scroll-view`}
            >
              {activeStep === 'phone' ? (
                <>
                  <PairingPhoneHero
                    style={{ width: sectionWidth }}
                    testID={`${testID}-phone-hero`}
                  />
                  <PhoneNumberInputCard
                    countryCode="+62"
                    phoneNumber={phoneNumber}
                    onChangePhoneNumber={setPhoneNumber}
                    style={{ width: sectionWidth }}
                    testID={`${testID}-phone-input`}
                  />
                  <PairingInstructionsCard
                    steps={PHONE_STEPS}
                    style={{ width: sectionWidth }}
                    testID={`${testID}-phone-instructions`}
                  />
                </>
              ) : null}

              {activeStep === 'code' ? (
                <>
                  <PairingCodeHero
                    style={{ width: sectionWidth }}
                    testID={`${testID}-code-hero`}
                  />
                  <PairingCodeDisplayBox
                    code={session.pairing?.code ?? undefined}
                    expiresInSeconds={expiresInSeconds}
                    onCopy={handleCopyCode}
                    style={{ width: sectionWidth }}
                    testID={`${testID}-code-box`}
                  />
                  <PairingInstructionsCard
                    steps={CODE_STEPS}
                    style={{ width: sectionWidth }}
                    testID={`${testID}-code-instructions`}
                  />
                </>
              ) : null}

              {activeStep === 'success' ? (
                <>
                  <PairingSuccessHero
                    phoneNumber={displayPhone || 'WhatsApp'}
                    style={{ width: sectionWidth }}
                    testID={`${testID}-success-hero`}
                  />
                  <ActiveJoyCapabilitiesCard
                    style={{ width: sectionWidth }}
                    testID={`${testID}-capabilities`}
                  />
                </>
              ) : null}
            </ScrollView>
          </Animated.View>
        </View>

        <View
          style={[
            styles.floatingActionContainer,
            {
              backgroundColor: theme.background,
              paddingBottom: Math.max(
                insets.bottom,
                Tokens.layout.floatingPaddingBottomMin,
              ),
            },
          ]}
          testID={`${testID}-floating-cta`}
        >
          {activeStep === 'phone' ? (
            <View style={[styles.ctaStack, { width: sectionWidth }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.buttonPrimaryBackground },
                  (pressed || !isPhoneValid || session.isConnecting) && styles.primaryButtonPressed,
                ]}
                onPress={() => {
                  void handleRequestCode();
                }}
                disabled={!isPhoneValid || session.isConnecting}
                accessibilityRole="button"
                accessibilityLabel="Get Pairing Code"
                testID={`${testID}-get-code-cta-button`}
              >
                {session.isConnecting ? (
                  <View style={styles.buttonLoadingRow}>
                    <ActivityIndicator
                      size="small"
                      color={theme.buttonPrimaryText}
                      testID={`${testID}-cta-spinner`}
                    />
                    <Text style={[styles.primaryButtonText, { color: theme.buttonPrimaryText }]}>
                      Requesting Code…
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.primaryButtonText, { color: theme.buttonPrimaryText }]}>
                    Get Pairing Code
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {activeStep === 'code' ? (
            <View style={[styles.ctaStack, { width: sectionWidth }]}>
              {isCodeExpired ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.buttonPrimaryBackground },
                    (pressed || session.isConnecting) && styles.primaryButtonPressed,
                  ]}
                  onPress={() => {
                    void handleRequestCode();
                  }}
                  disabled={session.isConnecting}
                  accessibilityRole="button"
                  accessibilityLabel="Request New Code"
                  testID={`${testID}-reload-code-cta-button`}
                >
                  {session.isConnecting ? (
                    <View style={styles.buttonLoadingRow}>
                      <ActivityIndicator
                        size="small"
                        color={theme.buttonPrimaryText}
                        testID={`${testID}-cta-spinner`}
                      />
                      <Text style={[styles.primaryButtonText, { color: theme.buttonPrimaryText }]}>
                        Requesting Code…
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.buttonLoadingRow}>
                      <RefreshCw size={14} color={theme.buttonPrimaryText} />
                      <Text style={[styles.primaryButtonText, { color: theme.buttonPrimaryText }]}>
                        Request New Code
                      </Text>
                    </View>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.buttonPrimaryBackground },
                    pressed && styles.primaryButtonPressed,
                  ]}
                  onPress={() => {
                    void handleCopyCode();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Copy pairing code"
                  testID={`${testID}-copy-code-cta-button`}
                >
                  <View style={styles.buttonLoadingRow}>
                    {isCopied ? (
                      <Check size={16} color={theme.buttonPrimaryText} />
                    ) : (
                      <Copy size={16} color={theme.buttonPrimaryText} />
                    )}
                    <Text style={[styles.primaryButtonText, { color: theme.buttonPrimaryText }]}>
                      {isCopied ? 'Code Copied!' : 'Copy Pairing Code'}
                    </Text>
                  </View>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={handleChangePhoneNumber}
                accessibilityRole="button"
                accessibilityLabel="Change Phone Number"
                testID={`${testID}-change-phone-cta-button`}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                  Change Phone Number
                </Text>
              </Pressable>
            </View>
          ) : null}

          {activeStep === 'success' ? (
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.buttonPrimaryBackground, width: sectionWidth },
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel="Done"
              testID={`${testID}-done-cta-button`}
            >
              <Text style={[styles.primaryButtonText, { color: theme.buttonPrimaryText }]}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Tokens.colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: Tokens.colors.background,
    alignItems: 'center',
  },
  headerBar: {
    height: Tokens.layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Tokens.layout.headerMarginBottom,
  },
  headerTitle: {
    flex: 1,
    fontSize: Tokens.headerTitle.fontSize,
    fontWeight: Tokens.headerTitle.fontWeight,
    color: Tokens.colors.headerTitle,
    textAlign: 'center',
    paddingHorizontal: Tokens.headerTitle.paddingHorizontal,
  },
  headerSpacer: {
    width: Tokens.layout.headerButtonSize,
    height: Tokens.layout.headerButtonSize,
  },
  slideViewport: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  slideTrack: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
  },
  floatingActionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Tokens.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Tokens.layout.floatingPaddingTop,
  },
  ctaStack: {
    gap: Tokens.primaryButton.gap,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    height: Tokens.primaryButton.height,
    borderRadius: Tokens.primaryButton.borderRadius,
    backgroundColor: Tokens.colors.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Tokens.primaryButton.shadowColor,
    shadowOffset: Tokens.primaryButton.shadowOffset,
    shadowOpacity: Tokens.primaryButton.shadowOpacity,
    shadowRadius: Tokens.primaryButton.shadowRadius,
    elevation: Tokens.primaryButton.elevation,
  },
  primaryButtonPressed: {
    opacity: Tokens.primaryButton.pressedOpacity,
  },
  primaryButtonText: {
    fontSize: Tokens.primaryButton.fontSize,
    fontWeight: Tokens.primaryButton.fontWeight,
    color: Tokens.colors.primaryButtonText,
  },
  secondaryButton: {
    width: '100%',
    height: Tokens.primaryButton.height,
    borderRadius: Tokens.primaryButton.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonPressed: {
    opacity: Tokens.toggleLink.pressedOpacity,
  },
  secondaryButtonText: {
    fontSize: Tokens.toggleLink.fontSize,
    fontWeight: Tokens.toggleLink.fontWeight,
    color: Tokens.colors.toggleLink,
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
