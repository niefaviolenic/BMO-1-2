import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { BottomWhiteFadeOverlay } from '@/components/ui/bottom-white-fade-overlay';
import { ChatComposer } from '@/components/ui/chat-composer';
import { MemorySummarySheetTokens } from '@/constants/theme';
const tokens = MemorySummarySheetTokens;
const COMPOSER_MIN_HEIGHT = 52;

export type MemorySummaryComposerProps = {
  onSubmit?: (text: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function MemorySummaryComposer({
  onSubmit,
  style,
  testID = 'memory-summary-composer',
}: MemorySummaryComposerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const paddingBottom = Math.max(insets.bottom, 12);
  const composerBlockHeight = COMPOSER_MIN_HEIGHT + paddingBottom;
  // Keep SVG fade above the bar — react-native-svg can paint over siblings on Android.
  const fadeHeight = Math.max(
    tokens.composerFadeHeight - COMPOSER_MIN_HEIGHT,
    90
  );

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit?.(trimmed);
    setValue('');
  };

  return (
    <View style={[styles.root, style]} pointerEvents="box-none" testID={testID}>
      <BottomWhiteFadeOverlay
        height={fadeHeight}
        style={[styles.fade, { bottom: composerBlockHeight }]}
        testID={`${testID}-fade`}
      />
      <View
        style={[
          styles.composerRow,
          {
            paddingBottom,
            paddingHorizontal: tokens.composerOverlayPaddingHorizontal,
            backgroundColor: theme.composerBackground,
          },
        ]}
        pointerEvents="box-none"
      >
        <ChatComposer
          value={value}
          onChangeText={setValue}
          onSubmit={handleSubmit}
          placeholder="Add or update"
          testID={`${testID}-input`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  fade: {
    zIndex: 0,
    elevation: 0,
  },
  composerRow: {
    zIndex: 1,
  },
});
