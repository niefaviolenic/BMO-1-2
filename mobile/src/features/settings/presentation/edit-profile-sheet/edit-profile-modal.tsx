import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditProfilePopupTokens as Tokens } from '@/constants/theme';
import { mapAccountApiError } from '@/features/settings/domain/account/profile';

import {
  EditProfilePopup,
  type EditProfilePopupProps,
} from './components/edit-profile-popup';

export type EditProfileSavePayload = {
  name: string;
  username: string;
  avatarUri?: string;
};

export type EditProfileModalProps = {
  /** Controls whether the modal is visible. */
  visible: boolean;
  /** Initial display name. */
  name?: string;
  /** Initial username. */
  username?: string;
  /** Initial avatar URI (remote or local file). */
  avatarUri?: string;
  /** Fired when the user confirms Save profile. Throw to keep the modal open. */
  onSave?: (payload: EditProfileSavePayload) => void | Promise<void>;
  /** Fired when Cancel or backdrop is pressed. */
  onCancel?: () => void;
  /** Custom style overrides for the popup card. */
  style?: StyleProp<ViewStyle>;
  /**
   * `modal` — RN Modal window. `overlay` — same tree as host screen for stacked sheets on iOS.
   */
  variant?: 'modal' | 'overlay';
  /** zIndex/elevation for `overlay` hosts. */
  overlayZIndex?: number;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function EditProfileModal({
  visible,
  name = '',
  username = '',
  avatarUri,
  onSave,
  onCancel,
  style,
  variant = 'overlay',
  overlayZIndex = 200,
  testID = 'edit-profile-modal',
}: EditProfileModalProps) {
  const insets = useSafeAreaInsets();
  const [draftName, setDraftName] = useState(name);
  const [draftUsername, setDraftUsername] = useState(username);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(visible);
  const isClosingRef = useRef(false);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const popupScale = useRef(
    new Animated.Value(Tokens.animation.enterScaleFrom),
  ).current;
  const popupOpacity = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    isClosingRef.current = false;
    backdropOpacity.setValue(0);
    popupScale.setValue(Tokens.animation.enterScaleFrom);
    popupOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: Tokens.animation.backdropDuration,
        useNativeDriver: true,
      }),
      Animated.spring(popupScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: Tokens.animation.springTension,
        friction: Tokens.animation.springFriction,
      }),
      Animated.timing(popupOpacity, {
        toValue: 1,
        duration: Tokens.animation.enterDuration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, popupOpacity, popupScale]);

  const animateOut = useCallback(
    (onFinished?: () => void) => {
      if (isClosingRef.current) {
        return;
      }
      isClosingRef.current = true;

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: Tokens.animation.exitDuration,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(popupScale, {
          toValue: Tokens.animation.enterScaleFrom,
          duration: Tokens.animation.exitDuration,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(popupOpacity, {
          toValue: 0,
          duration: Tokens.animation.exitDuration,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setModalVisible(false);
          onFinished?.();
        }
      });
    },
    [backdropOpacity, popupOpacity, popupScale],
  );


  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      animateIn();
      return;
    }

    if (!isClosingRef.current) {
      animateOut();
    }
  }, [visible, animateIn, animateOut]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setDraftName(name);
    setDraftUsername(username);
    setErrorMessage(null);
    setIsSaving(false);
  }, [visible, name, username, avatarUri]);

  const handleRequestClose = useCallback(() => {
    Keyboard.dismiss();
    if (isClosingRef.current) {
      return;
    }
    animateOut(() => {
      onCancel?.();
    });
  }, [animateOut, onCancel]);

  const handleRequestCloseRef = useRef(handleRequestClose);
  handleRequestCloseRef.current = handleRequestClose;

  useEffect(() => {
    if (variant !== 'overlay' || !modalVisible) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleRequestCloseRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [modalVisible, variant]);

  const handleSave = useCallback(async () => {
    if (isClosingRef.current || isSaving) {
      return;
    }

    Keyboard.dismiss();
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await onSave?.({
        name: draftName.trim(),
        username: draftUsername.trim(),
      });
    } catch (error) {
      setErrorMessage(mapAccountApiError(error));
    } finally {
      setIsSaving(false);
    }
  }, [
    draftName,
    draftUsername,
    isSaving,
    onSave,
  ]);

  const popupProps: EditProfilePopupProps = {
    name: draftName,
    username: draftUsername,

    onNameChange: setDraftName,
    onUsernameChange: setDraftUsername,
    errorMessage,
    isSaving,

    onSave: handleSave,
    onCancel: handleRequestClose,
    style,
    testID: `${testID}-popup`,
  };

  // Figma parent places card at y≈560 on ~1077pt frame → bottom-docked, not centered.
  const bottomPadding = Math.max(insets.bottom, Tokens.bottomInset);

  const body = (
    <Animated.View
      style={[styles.backdrop, { opacity: backdropOpacity }]}
      testID={`${testID}-backdrop-layer`}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        <Pressable
          style={[styles.backdropPressable, { paddingBottom: bottomPadding }]}
          onPress={handleRequestClose}
          testID={`${testID}-backdrop`}
          accessibilityLabel="Dismiss"
        >
          <Pressable
            style={styles.cardHitbox}
            testID={`${testID}-card`}
            accessibilityViewIsModal
          >
            <Animated.View
              style={{
                opacity: popupOpacity,
                transform: [{ scale: popupScale }],
              }}
            >
              <EditProfilePopup {...popupProps} />
            </Animated.View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Animated.View>
  );

  if (variant === 'overlay') {
    if (!modalVisible) {
      return null;
    }
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
      animationType="none"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
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
  backdrop: {
    flex: 1,
    backgroundColor: Tokens.colors.backdrop,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  backdropPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Tokens.horizontalInset,
  },
  cardHitbox: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
  },
});
