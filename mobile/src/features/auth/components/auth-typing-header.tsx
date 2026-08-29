import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { AuthTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
const PREFIX = 'Let’s ';
const PHRASES = ['Let’s talk', 'Let’s chat', 'Let’s think', 'Let’s explore'];
const TYPING_SPEED = 120; // ms per char
const DELETING_SPEED = 60; // ms per char
const PAUSE_AT_END = 1500; // ms to pause when full
const PAUSE_AT_START = 500; // ms to pause when empty

export type AuthTypingHeaderProps = {
  delayMs?: number;
};

export function AuthTypingHeader({ delayMs = 1000 }: AuthTypingHeaderProps) {
  const theme = useTheme();
  const [hasStarted, setHasStarted] = useState(false);
  const [isTypingStarted, setIsTypingStarted] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasStarted(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  useEffect(() => {
    if (hasStarted) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 140,
      }).start(({ finished }) => {
        if (finished) {
          setIsTypingStarted(true);
        }
      });
    }
  }, [hasStarted, scaleAnim]);

  const currentPhrase = PHRASES[phraseIndex];

  useEffect(() => {
    if (!isTypingStarted) return;

    let timer: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayText.length < currentPhrase.length) {
      // Typing next character
      timer = setTimeout(() => {
        setDisplayText(currentPhrase.slice(0, displayText.length + 1));
      }, TYPING_SPEED);
    } else if (!isDeleting && displayText.length === currentPhrase.length) {
      // Reached full text, wait before deleting
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, PAUSE_AT_END);
    } else if (isDeleting && displayText.length > PREFIX.length) {
      // Deleting character down to PREFIX ("Let’s ")
      timer = setTimeout(() => {
        setDisplayText(currentPhrase.slice(0, displayText.length - 1));
      }, DELETING_SPEED);
    } else if (isDeleting && displayText.length === PREFIX.length) {
      // Reached PREFIX ("Let’s "), switch to next phrase and wait before typing again
      timer = setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
        setIsDeleting(false);
      }, PAUSE_AT_START);
    }

    return () => clearTimeout(timer);
  }, [isTypingStarted, displayText, isDeleting, currentPhrase]);

  return (
    <View style={styles.container} testID="auth-typing-header">
      <Text style={[styles.text, { color: theme.textTitle }]} testID="auth-typing-text">
        {displayText}
      </Text>
      <Animated.View
        style={[
          styles.dotContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
        testID="auth-typing-dot"
      >
        <Image
          source={require('@/assets/images/auth/dot.svg')}
          style={styles.dot}
          contentFit="contain"
          tintColor={theme.textTitle}
          accessibilityLabel="Typing indicator"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AuthTokens.spacing.headerGap,
  },
  text: {
    color: AuthTokens.colors.textPrimary,
    fontSize: AuthTokens.typography.headerTitle.fontSize,
    fontWeight: AuthTokens.typography.headerTitle.fontWeight,
    lineHeight: AuthTokens.typography.headerTitle.lineHeight,
    letterSpacing: AuthTokens.typography.headerTitle.letterSpacing,
  },
  dotContainer: {
    width: AuthTokens.spacing.dotSize,
    height: AuthTokens.spacing.dotSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: AuthTokens.spacing.dotSize,
    height: AuthTokens.spacing.dotSize,
  },
});
