import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  StyleSheet,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ChatSearchTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { SearchScreen } from './search-screen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type SearchModalProps = {
  isVisible: boolean;
  onClose: () => void;
  testID?: string;
};

/**
 * Full-screen search overlay (RN Modal) — same window layering as settings.
 * Covers the whole UI while open; drawer state underneath is left untouched
 * so closing search restores the previous sidebar open/closed state.
 *
 * Slide: enter from right, exit to right.
 */
export function SearchModal({
  isVisible,
  onClose,
  testID = 'search-modal',
}: SearchModalProps) {
  const theme = useTheme();
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [modalVisible, setModalVisible] = useState(isVisible);
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (isVisible) {
      isClosingRef.current = false;
      setModalVisible(true);
      translateX.setValue(SCREEN_WIDTH);

      Animated.timing(translateX, {
        toValue: 0,
        duration: ChatSearchTokens.animation.enterDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    if (modalVisible && !isClosingRef.current) {
      isClosingRef.current = true;
      Keyboard.dismiss();

      Animated.timing(translateX, {
        toValue: SCREEN_WIDTH,
        duration: ChatSearchTokens.animation.exitDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setModalVisible(false);
        } else {
          translateX.setValue(SCREEN_WIDTH);
          setModalVisible(false);
        }
      });
    }
  }, [isVisible, modalVisible, translateX]);

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      testID={testID}
    >
      {/* RNGH root required inside Modal — Close button uses GestureDetector. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          style={[
            styles.surface,
            { backgroundColor: theme.background },
            { transform: [{ translateX }] },
          ]}
          testID={`${testID}-surface`}
        >
          <SearchScreen onClose={onClose} testID={`${testID}-screen`} />
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  surface: {
    flex: 1,
  },
});
