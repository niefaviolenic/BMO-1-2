import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  ScrollView as GestureScrollView,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassBackButton } from './liquid-glass-back-button';
import { LiquidGlassCloseButton } from './liquid-glass-close-button';
import { AuthTokens } from '@/constants/theme';
/**
 * Sheet drag modes:
 * - `none` — no drag (fully locked sheets)
 * - `resist` — pull-down rubberbands then springs back (auth login/signup, settings)
 * - `dismiss` — can drag far enough to close
 */
export type ModalBottomSheetDragBehavior = 'none' | 'resist' | 'dismiss';

export type ModalBottomSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  onBackPress?: () => void;
  showBackButton?: boolean;
  children: React.ReactNode;
  header?: React.ReactNode;
  overlay?: React.ReactNode;
  testID?: string;
  showCloseButton?: boolean;
  closeButtonTestID?: string;
  backButtonTestID?: string;
  requireCloseConfirmation?: boolean;
  closeConfirmationTitle?: string;
  closeConfirmationMessage?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  /**
   * Drag interaction mode. Defaults to `resist` (auth-style).
   * Prefer this over `enableDragToClose`.
   */
  dragBehavior?: ModalBottomSheetDragBehavior;
  /**
   * @deprecated Use `dragBehavior="dismiss"` instead.
   * When true, resolves to `dismiss`. When false/omitted and `dragBehavior` omitted, keeps default `resist`.
   */
  enableDragToClose?: boolean;
  /** When false, tapping the dimmed backdrop does not dismiss the sheet. Defaults to true. */
  dismissOnBackdropPress?: boolean;
  /** When false, Android back / request close does not dismiss the sheet. Defaults to true. */
  dismissOnRequestClose?: boolean;
  disableScrollView?: boolean;
  fitContent?: boolean;
  sheetStyle?: StyleProp<ViewStyle>;
  /**
   * When true, sheet appears at rest without the slide-up enter animation.
   * Use for nested drill-down sheets stacked over an already-open parent sheet.
   */
  skipEnterAnimation?: boolean;
  /**
   * `modal` — RN Modal window (auth). `overlay` — same tree as host screen so
   * content behind the sheet stays visible while dragging. Use overlay to stack
   * sheets; iOS cannot present sibling RN Modals.
   */
  variant?: 'modal' | 'overlay';
  overlayColor?: string;
  /** zIndex/elevation for `overlay` hosts. Raise for stacked sheets. */
  overlayZIndex?: number;
  /** Optional scroll callback when the internal scroll view scrolls */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Optional callback when the user begins dragging/scrolling */
  onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

export function ModalBottomSheet({
  isVisible,
  onClose,
  onBackPress,
  showBackButton = false,
  children,
  testID = 'modal-bottom-sheet',
  showCloseButton = true,
  closeButtonTestID = 'modal-sheet-close-button',
  backButtonTestID = 'modal-sheet-back-button',
  requireCloseConfirmation = false,
  closeConfirmationTitle = 'Leave Verification?',
  closeConfirmationMessage = 'Are you sure you want to leave verification?',
  confirmButtonText = 'Leave',
  cancelButtonText = 'Cancel',
  dragBehavior,
  enableDragToClose,
  dismissOnBackdropPress = true,
  dismissOnRequestClose = true,
  disableScrollView = false,
  fitContent = false,
  sheetStyle,
  header,
  overlay,
  skipEnterAnimation = false,
  variant = 'modal',
  overlayColor,
  overlayZIndex = 100,
  onScroll,
  onScrollBeginDrag,
}: ModalBottomSheetProps) {
  const theme = useTheme();
  const resolvedDragBehavior = useMemo<ModalBottomSheetDragBehavior>(() => {
    if (dragBehavior) return dragBehavior;
    if (enableDragToClose === true) return 'dismiss';
    // Legacy default: auth sheets pull with resistance, do not dismiss.
    return 'resist';
  }, [dragBehavior, enableDragToClose]);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(800)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dialogScale = useRef(new Animated.Value(0.85)).current;
  const dialogOpacity = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(isVisible);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [isScrollAtTop, setIsScrollAtTop] = useState(true);
  const isClosingRef = useRef(false);
  const scrollOffsetRef = useRef(0);
  const dragBehaviorRef = useRef(resolvedDragBehavior);
  dragBehaviorRef.current = resolvedDragBehavior;

  useEffect(() => {
    if (isVisible) {
      isClosingRef.current = false;
      setShowCloseConfirmation(false);
      setIsScrollAtTop(true);
      scrollOffsetRef.current = 0;
      setModalVisible(true);

      if (skipEnterAnimation) {
        translateY.setValue(0);
        opacity.setValue(1);
        return;
      }

      translateY.setValue(800);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalVisible && !isClosingRef.current) {
      animateClose(false);
    }
  }, [isVisible, skipEnterAnimation]);

  const animateClose = (triggerOnClose = true) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Keyboard.dismiss();

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 800,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setModalVisible(false);
        if (triggerOnClose) {
          onClose();
        }
      }
    });
  };

  const handleDismiss = () => {
    if (requireCloseConfirmation) {
      Keyboard.dismiss();
      setShowCloseConfirmation(true);
      dialogScale.setValue(0.85);
      dialogOpacity.setValue(0);

      Animated.parallel([
        Animated.spring(dialogScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 8,
        }),
        Animated.timing(dialogOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    animateClose(true);
  };

  const animateCloseConfirmation = (onComplete?: () => void) => {
    Animated.parallel([
      Animated.timing(dialogScale, {
        toValue: 0.85,
        duration: 140,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(dialogOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowCloseConfirmation(false);
        onComplete?.();
      }
    });
  };

  const handleConfirmClose = () => {
    animateCloseConfirmation(() => {
      animateClose(true);
    });
  };

  const handleCancelClose = () => {
    animateCloseConfirmation();
  };

  const handleDismissRef = useRef(handleDismiss);
  handleDismissRef.current = handleDismiss;
  useEffect(() => {
    if (variant !== 'overlay' || !modalVisible) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dismissOnRequestClose) {
        handleDismissRef.current();
      }
      return true;
    });
    return () => subscription.remove();
  }, [dismissOnRequestClose, modalVisible, variant]);


  const springSheetHome = () => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 75,
      friction: 10,
    }).start();
  };

  const onSheetGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const behavior = dragBehaviorRef.current;
    const dy = event.nativeEvent.translationY;
    if (behavior === 'none' || dy <= 0) return;

    if (behavior === 'dismiss') {
      translateY.setValue(dy);
      return;
    }

    // resist: dampened rubberband, max ~120px
    translateY.setValue(Math.min(dy * 0.35, 120));
  };

  const onSheetHandlerStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.oldState !== State.ACTIVE) return;

    const behavior = dragBehaviorRef.current;
    if (behavior === 'none') return;

    const { translationY, velocityY } = event.nativeEvent;
    if (behavior === 'dismiss' && (translationY > 80 || velocityY > 900)) {
      handleDismissRef.current();
      return;
    }

    springSheetHome();
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = offsetY;
    const atTop = offsetY <= 2;
    setIsScrollAtTop((prev) => (prev === atTop ? prev : atTop));
    onScroll?.(event);
  };

  const paddingBottom = Math.max(insets.bottom + 16, AuthTokens.spacing.sheetPaddingBottom);
  const marginTop = insets.top;
  const canDragSheet =
    resolvedDragBehavior !== 'none' && (disableScrollView || isScrollAtTop);

  const body = (
    <GestureHandlerRootView style={styles.overlayContainer}>
      {/* Backdrop overlay */}
      <Animated.View
        style={[
          styles.backdrop,
          { opacity },
          overlayColor ? { backgroundColor: overlayColor } : null,
        ]}
      >
        <Pressable
          style={styles.backdropPressable}
          onPress={dismissOnBackdropPress ? handleDismiss : undefined}
          accessibilityRole={dismissOnBackdropPress ? 'button' : undefined}
          accessibilityLabel={dismissOnBackdropPress ? 'Close sheet' : undefined}
          testID="auth-email-back-button"
        />
      </Animated.View>

        {/* Pan wraps entire sheet: resist rubberband drag from header/body, without dismissing */}
        <PanGestureHandler
          enabled={canDragSheet}
          activeOffsetY={8}
          failOffsetY={-8}
          failOffsetX={[-36, 36]}
          onGestureEvent={onSheetGestureEvent}
          onHandlerStateChange={onSheetHandlerStateChange}
        >
          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: theme.sheetBackground },
              fitContent && styles.fitContentSheet,
              {
                marginTop: fitContent ? undefined : marginTop,
                paddingBottom,
                transform: [{ translateY }],
              },
              sheetStyle,
            ]}
            testID={`${testID}-container`}
          >
            {header ? (
              header
            ) : showCloseButton ? (
              <View style={styles.headerBar}>
                {showBackButton && onBackPress ? (
                  <LiquidGlassBackButton onPress={onBackPress} testID={backButtonTestID} />
                ) : (
                  <View style={styles.headerPlaceholder} />
                )}
                <LiquidGlassCloseButton onPress={handleDismiss} testID={closeButtonTestID} />
              </View>
            ) : null}

            <View
              style={[styles.sheetTouchable, fitContent && styles.fitContentTouchable]}
            >
              {disableScrollView ? (
                <Pressable
                  style={[
                    styles.disableScrollViewContent,
                    fitContent && styles.fitContentDisableScroll,
                  ]}
                  onPress={Keyboard.dismiss}
                >
                  {children}
                </Pressable>
              ) : (
                <GestureScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  bounces={false}
                  nestedScrollEnabled
                  scrollEventThrottle={16}
                  onScroll={handleScroll}
                  onScrollBeginDrag={onScrollBeginDrag}
                >
                  {children}
                </GestureScrollView>
              )}
            </View>

            {overlay}
          </Animated.View>
        </PanGestureHandler>

        {showCloseConfirmation && (
          <Animated.View
            style={[styles.dialogOverlay, { opacity: dialogOpacity }]}
            testID="close-confirmation-modal"
          >
            <Pressable style={styles.dialogBackdrop} onPress={handleCancelClose} />
            <Animated.View
              style={[
                styles.dialogCard,
                {
                  backgroundColor: theme.modalBackground,
                  transform: [{ scale: dialogScale }],
                },
              ]}
            >
              <Text style={[styles.dialogTitle, { color: theme.text }]} testID="close-confirmation-title">
                {closeConfirmationTitle}
              </Text>
              <Text style={[styles.dialogMessage, { color: theme.textSecondary }]} testID="close-confirmation-message">
                {closeConfirmationMessage}
              </Text>
              <View style={styles.dialogActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.dialogCancelButton,
                    { borderColor: theme.border },
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleCancelClose}
                  accessibilityRole="button"
                  accessibilityLabel={cancelButtonText}
                  testID="close-confirmation-cancel-button"
                >
                  <Text style={[styles.dialogCancelButtonText, { color: theme.text }]}>{cancelButtonText}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.dialogConfirmButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleConfirmClose}
                  accessibilityRole="button"
                  accessibilityLabel={confirmButtonText}
                  testID="close-confirmation-confirm-button"
                >
                  <Text style={styles.dialogConfirmButtonText}>{confirmButtonText}</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        )}
    </GestureHandlerRootView>
  );

  if (variant === 'overlay') {
    if (!modalVisible) return null;
    return (
      <Animated.View
        style={[
          styles.overlayHost,
          {
            zIndex: overlayZIndex,
            elevation: overlayZIndex,
          },
        ]}
        testID={testID}
      >
        {body}
      </Animated.View>
    );
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={dismissOnRequestClose ? handleDismiss : () => {}}
      testID={testID}
    >
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayHost: {
    ...StyleSheet.absoluteFill,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdropPressable: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    backgroundColor: AuthTokens.colors.emailSheetBackground,
    borderTopLeftRadius: AuthTokens.spacing.sheetRadius,
    borderTopRightRadius: AuthTokens.spacing.sheetRadius,
    paddingTop: 16,
    paddingHorizontal: AuthTokens.spacing.sheetPaddingHorizontal,
    elevation: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  fitContentSheet: {
    flex: 0,
    maxHeight: '85%',
  },
  sheetTouchable: {
    flex: 1,
  },
  fitContentTouchable: {
    flex: 0,
  },
  disableScrollViewContent: {
    flex: 1,
  },
  fitContentDisableScroll: {
    flex: 0,
  },
  headerBar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  dialogOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    zIndex: 999,
  },
  dialogBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  dialogCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: AuthTokens.colors.emailSheetBackground,
    borderRadius: 20,
    padding: 24,
    elevation: 32,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    alignItems: "center",
    gap: 12,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    color: AuthTokens.colors.textPrimary,
    textAlign: "center",
  },
  dialogMessage: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    color: AuthTokens.colors.emailSheetSubtitle,
    textAlign: "center",
  },
  dialogActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },
  dialogCancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AuthTokens.colors.emailInputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogCancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: AuthTokens.colors.textPrimary,
  },
  dialogConfirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: AuthTokens.colors.continueButtonBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogConfirmButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: AuthTokens.colors.continueButtonText,
  },
  buttonPressed: {
    opacity: 0.82,
  },
});
