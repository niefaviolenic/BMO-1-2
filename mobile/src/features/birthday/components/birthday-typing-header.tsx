import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const PREFIX = 'Happy Birthday ';
const PHRASES = [
  'Happy Birthday Devira',
  'Happy Birthday Devira 🎉',
  'Happy Birthday Devira 💖',
];
const TYPING_SPEED = 110;
const DELETING_SPEED = 60;
const PAUSE_AT_END = 1800;
const PAUSE_AT_START = 400;

export type BirthdayTypingHeaderProps = {
  delayMs?: number;
  testID?: string;
};

export function BirthdayTypingHeader({
  delayMs = 400,
  testID = 'birthday-typing-header',
}: BirthdayTypingHeaderProps) {
  const theme = useTheme();
  const [hasStarted, setHasStarted] = useState(false);
  const [isTypingStarted, setIsTypingStarted] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initial delay before starting
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasStarted(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  // Entrance spring animation for the circle dot
  useEffect(() => {
    if (hasStarted) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 140,
      }).start(({ finished }) => {
        if (finished) {
          setIsTypingStarted(true);
        }
      });
    }
  }, [hasStarted, scaleAnim]);

  // Continuous subtle pulse/breathing animation for the circle
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [pulseAnim]);

  const currentPhrase = PHRASES[phraseIndex];

  // Typewriter effect
  useEffect(() => {
    if (!isTypingStarted) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!isDeleting && displayText.length < currentPhrase.length) {
      timer = setTimeout(() => {
        setDisplayText(currentPhrase.slice(0, displayText.length + 1));
      }, TYPING_SPEED);
    } else if (!isDeleting && displayText.length === currentPhrase.length) {
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, PAUSE_AT_END);
    } else if (isDeleting && displayText.length > PREFIX.length) {
      timer = setTimeout(() => {
        setDisplayText(currentPhrase.slice(0, displayText.length - 1));
      }, DELETING_SPEED);
    } else if (isDeleting && displayText.length === PREFIX.length) {
      timer = setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
        setIsDeleting(false);
      }, PAUSE_AT_START);
    }

    return () => clearTimeout(timer);
  }, [isTypingStarted, displayText, isDeleting, currentPhrase]);

  const combinedScale = Animated.multiply(scaleAnim, pulseAnim);

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[styles.text, { color: theme.textTitle }]} testID={`${testID}-text`}>
        {displayText}
      </Text>
      <Animated.View
        style={[
          styles.dotContainer,
          {
            transform: [{ scale: combinedScale }],
          },
        ]}
        testID={`${testID}-dot`}
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
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },
  text: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  dotContainer: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 22,
    height: 22,
  },
});
