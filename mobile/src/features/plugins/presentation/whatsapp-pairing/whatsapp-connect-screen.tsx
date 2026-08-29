import { useRouter } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Linking,
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
import { useRobotConnection } from '@/features/robot/data/use-robot-connection';
import {
  confirmWhatsAppPairing,
  dismissWhatsAppSessionQr,
  getWhatsAppSessionState,
  hydrateWhatsAppSession,
  startWhatsAppConnect,
  stopWhatsAppConnectPolling,
} from '@/features/plugins/data/whatsapp-session-store';
import { mapPluginApiError } from '@/features/plugins/domain/plugin';
import {
  isWhatsAppConnected,
  secondsUntilExpiry,
  toWhatsAppLinkedDevicesUrl,
} from '@/features/plugins/domain/whatsapp';
import {
  ActiveJoyCapabilitiesCard,
  PairingInstructionsCard,
  PairingSuccessHero,
  QRCodeDisplayBox,
  QRPairingHero,
  type PairingStep,
} from '@/features/plugins/presentation/whatsapp-pairing/components';
import { useStepSlideTransition } from '@/hooks/use-step-slide-transition';

export type StepState = 'qr' | 'success';

export type WhatsAppConnectScreenProps = {
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const STEP_ORDER: StepState[] = ['qr', 'success'];


function getStepDirection(from: StepState, to: StepState): number {
  return STEP_ORDER.indexOf(to) - STEP_ORDER.indexOf(from);
}

function headerTitle(step: StepState): string {
  if (step === 'success') {
    return 'WhatsApp Integration';
  }
  return 'Link WhatsApp';
}

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
  const robotConnection = useRobotConnection();
  const [pairingStep, setPairingStep] = useState<StepState>('qr');
  const [isConfirming, setIsConfirming] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isRobotOnline =
    robotConnection.status === 'connected' &&
    Boolean(robotConnection.device?.online);
  const robotName = robotConnection.device?.name ?? 'Joy Robot';

  const qrSteps = useMemo<PairingStep[]>(() => {
    return [
      {
        step: 1,
        title: 'Tap Link in WhatsApp',
        description:
          'Opens Linked Devices with the same pairing data as the QR.',
      },
      {
        step: 2,
        title: 'Confirm the link',
        description: 'Approve Joy as a linked device in WhatsApp.',
      },
      isRobotOnline
        ? {
            step: 3,
            title: 'Scan the QR on Joy Robot',
            description:
              "If WhatsApp is on this phone, point your WhatsApp Linked Devices camera at your Joy Robot's screen.",
          }
        : {
            step: 3,
            title: 'Or scan the QR',
            description:
              'If WhatsApp is on another phone, scan the code above.',
          },
    ];
  }, [isRobotOnline]);
  const { activeStep, contentTranslateX } = useStepSlideTransition({
    currentStep: pairingStep,
    getDirection: getStepDirection,
    width: windowWidth,
    duration: Tokens.slide.duration,
  });

  useEffect(() => {
    void (async () => {
      await hydrateWhatsAppSession().catch(() => undefined);
      if (isWhatsAppConnected(getWhatsAppSessionState().connection?.status)) {
        setPairingStep('success');
        return;
      }
      try {
        await startWhatsAppConnect();
      } catch (error) {
        Alert.alert('Unable to connect WhatsApp', mapPluginApiError(error));
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
          } else if (pairingStep === 'qr') {
            const currentQr = getWhatsAppSessionState().qr;
            const isCurrentQrActive =
              Boolean(currentQr?.qr) &&
              (currentQr?.expiresAt ? (secondsUntilExpiry(currentQr.expiresAt) ?? 0) : 0) > 0;
            if (!isCurrentQrActive) {
              await startWhatsAppConnect(undefined, { forceReset: true }).catch(() => undefined);
            }
          }
        })();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [pairingStep]);
  useEffect(() => {
    if (isWhatsAppConnected(session.connection?.status)) {
      stopWhatsAppConnectPolling();
      setPairingStep('success');
    }
  }, [session.connection?.status]);

  useEffect(() => {
    if (pairingStep !== 'qr') {
      return;
    }
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pairingStep]);
  const expiresInSeconds = useMemo(
    () => (nowMs ? secondsUntilExpiry(session.qr?.expiresAt ?? null) ?? 0 : 0),
    [nowMs, session.qr?.expiresAt],
  );
  const isQrExpired = useMemo(() => {
    if (!session.qr?.qr) return false;
    return expiresInSeconds <= 0;
  }, [expiresInSeconds, session.qr?.qr]);

  useEffect(() => {
    if (isQrExpired) {
      stopWhatsAppConnectPolling();
    }
  }, [isQrExpired]);

  const linkedDevicesUrl = useMemo(
    () => (isQrExpired ? null : toWhatsAppLinkedDevicesUrl(session.qr?.qr ?? null)),
    [isQrExpired, session.qr?.qr],
  );

  const handleRefreshQr = async () => {
    try {
      await startWhatsAppConnect(undefined, { forceReset: true });
    } catch (error) {
      Alert.alert('Unable to refresh WhatsApp QR', mapPluginApiError(error));
    }
  };
  const handleDismiss = () => {
    stopWhatsAppConnectPolling();
    if (!isWhatsAppConnected(getWhatsAppSessionState().connection?.status)) {
      void dismissWhatsAppSessionQr().catch(() => undefined);
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/plugin-detail');
  };

  const handleOpenWhatsApp = async () => {
    if (!linkedDevicesUrl) {
      Alert.alert(
        'WhatsApp is not ready',
        'Wait for the link to appear, then try again.',
      );
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(linkedDevicesUrl);
      if (!canOpen) {
        Alert.alert(
          'WhatsApp is not available',
          'Install WhatsApp on this phone, or scan the QR from another device.',
        );
        return;
      }
      await Linking.openURL(linkedDevicesUrl);
    } catch {
      Alert.alert(
        'Unable to open WhatsApp',
        'Scan the QR code in Linked Devices instead.',
      );
    }
  };

  const handleScanned = async () => {
    setIsConfirming(true);
    try {
      const connection = await confirmWhatsAppPairing();
      if (isWhatsAppConnected(connection.status)) {
        setPairingStep('success');
        return;
      }
      Alert.alert(
        'Still waiting',
        'Scan the QR code in WhatsApp Linked Devices, then try again.',
      );
    } catch (error) {
      Alert.alert('Unable to confirm WhatsApp', mapPluginApiError(error));
    } finally {
      setIsConfirming(false);
    }
  };

  const showBackButton = activeStep !== 'success';
  const contentGap =
    activeStep === 'success'
      ? Tokens.layout.contentGapSuccess
      : Tokens.layout.contentGapPairing;
  const paddingTop = Math.max(insets.top, 16);
  const paddingBottom = Math.max(insets.bottom, 16);

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
                    Tokens.primaryButton.height +
                    Tokens.primaryButton.gap,
                  gap: contentGap,
                },
              ]}
              style={styles.scrollView}
              keyboardShouldPersistTaps="handled"
              testID={`${testID}-scroll-view`}
            >
              {activeStep === 'qr' ? (
                <>
                  <QRPairingHero
                    style={{ width: sectionWidth }}
                    testID={`${testID}-qr-hero`}
                  />
                  <QRCodeDisplayBox
                    qrValue={session.qr?.qr ?? null}
                    expiresInSeconds={expiresInSeconds}
                    isExpired={isQrExpired}
                    isRefreshing={session.isConnecting}
                    onRefresh={handleRefreshQr}
                    waitingLabel={
                      session.isConnecting
                        ? 'Requesting WhatsApp QR…'
                        : 'Waiting for WhatsApp QR…'
                    }
                    robotSync={{ online: isRobotOnline, name: robotName }}
                    style={{ width: sectionWidth }}
                    testID={`${testID}-qr-box`}
                  />
                  <PairingInstructionsCard
                    steps={qrSteps}
                    style={{ width: sectionWidth }}
                    testID={`${testID}-qr-instructions`}
                  />
                </>
              ) : null}

              {activeStep === 'success' ? (
                <>
                  <PairingSuccessHero
                    phoneNumber="WhatsApp"
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
          {activeStep === 'qr' ? (
            <View style={[styles.ctaStack, { width: sectionWidth }]}>
              {isQrExpired ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.buttonPrimaryBackground },
                    (pressed || session.isConnecting) && styles.primaryButtonPressed,
                  ]}
                  onPress={() => {
                    void handleRefreshQr();
                  }}
                  disabled={session.isConnecting}
                  accessibilityRole="button"
                  accessibilityLabel="Reload QR Code"
                  testID={`${testID}-reload-qr-cta-button`}
                >
                  {session.isConnecting ? (
                    <View style={styles.buttonLoadingRow}>
                      <ActivityIndicator
                        size="small"
                        color={theme.buttonPrimaryText}
                        testID={`${testID}-cta-spinner`}
                      />
                      <Text style={[styles.primaryButtonText, { color: theme.buttonPrimaryText }]}>Requesting QR…</Text>
                    </View>
                  ) : (
                    <View style={styles.buttonLoadingRow}>
                      <RefreshCw size={14} color={theme.buttonPrimaryText} />
                      <Text style={[styles.primaryButtonText, { color: theme.buttonPrimaryText }]}>Reload QR Code</Text>
                    </View>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.buttonPrimaryBackground },
                    (pressed || !linkedDevicesUrl || session.isConnecting) &&
                      styles.primaryButtonPressed,
                  ]}
                  onPress={() => {
                    void handleOpenWhatsApp();
                  }}
                  disabled={!linkedDevicesUrl || session.isConnecting}
                  accessibilityRole="button"
                  accessibilityLabel="Link device in WhatsApp"
                  testID={`${testID}-open-whatsapp-cta-button`}
                >
                  {!linkedDevicesUrl || session.isConnecting ? (
                    <View style={styles.buttonLoadingRow}>
                      <ActivityIndicator
                        size="small"
                        color={theme.buttonPrimaryText}
                        testID={`${testID}-cta-spinner`}
                      />
                      <Text style={[styles.primaryButtonText, { color: theme.buttonPrimaryText }]}>
                        {session.isConnecting ? 'Requesting QR…' : 'Preparing link…'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: theme.buttonPrimaryText }]}>Link Device in WhatsApp</Text>
                  )}
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (pressed || isConfirming) && styles.secondaryButtonPressed,
                ]}
                onPress={() => {
                  void handleScanned();
                }}
                disabled={isConfirming}
                accessibilityRole="button"
                accessibilityLabel="I've linked the device"
                testID={`${testID}-scanned-qr-cta-button`}
              >
                {isConfirming ? (
                  <View style={styles.buttonLoadingRow}>
                    <ActivityIndicator
                      size="small"
                      color={theme.text}
                      testID={`${testID}-confirming-spinner`}
                    />
                    <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>Confirming…</Text>
                  </View>
                ) : (
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>I&apos;ve Linked the Device</Text>
                )}
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
