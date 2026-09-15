import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

const CONFETTI_COLORS = [
  '#FF5E7E',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#007AFF',
  '#AF52DE',
  '#FF2D55',
  '#FF3B30',
  '#5856D6',
  '#FFD700',
];

const CONFETTI_COUNT = 48;

type ParticleConfig = {
  id: number;
  color: string;
  width: number;
  height: number;
  isCircle: boolean;
  targetXOffset: number;
  rotationTarget: number;
  delay: number;
  duration: number;
};

function generateParticles(width: number): ParticleConfig[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    // Spread horizontally across screen width with a bias towards the sides
    const spreadDirection = i % 2 === 0 ? 1 : -1;
    const spreadDistance = (0.15 + Math.random() * 0.35) * width;
    const targetXOffset = spreadDirection * spreadDistance;

    const isCircle = i % 4 === 0;
    const pieceWidth = isCircle ? 7 : 6 + Math.floor(Math.random() * 6);
    const pieceHeight = isCircle ? 7 : 10 + Math.floor(Math.random() * 8);

    return {
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: pieceWidth,
      height: pieceHeight,
      isCircle,
      targetXOffset,
      rotationTarget: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.floor(Math.random() * 720)),
      delay: Math.floor(Math.random() * 1800),
      duration: 2600 + Math.floor(Math.random() * 1200),
    };
  });
}

export type ConfettiCannonProps = {
  testID?: string;
};

export function ConfettiCannon({ testID = 'confetti-cannon' }: ConfettiCannonProps) {
  const { width, height } = useWindowDimensions();
  const particles = useRef(generateParticles(width)).current;
  const animValues = useRef(particles.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = particles.map((p, idx) => {
      const anim = animValues[idx];
      return Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: p.duration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
    });

    Animated.parallel(animations).start();

    return () => {
      animations.forEach((a) => a.stop());
    };
  }, [animValues, particles]);

  const originX = width / 2;

  return (
    <View style={[styles.container, { pointerEvents: 'none' }]} testID={testID}>
      {particles.map((p, idx) => {
        const anim = animValues[idx];

        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-30, height + 40],
        });

        const translateX = anim.interpolate({
          inputRange: [0, 0.2, 0.6, 1],
          outputRange: [0, p.targetXOffset * 0.4, p.targetXOffset * 0.85, p.targetXOffset],
        });

        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.rotationTarget}deg`],
        });

        const opacity = anim.interpolate({
          inputRange: [0, 0.05, 0.8, 1],
          outputRange: [0, 1, 0.95, 0],
        });

        const scale = anim.interpolate({
          inputRange: [0, 0.1, 0.9, 1],
          outputRange: [0.6, 1, 0.9, 0.4],
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                left: originX,
                width: p.width,
                height: p.height,
                backgroundColor: p.color,
                borderRadius: p.isCircle ? p.width / 2 : 2,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }, { scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
});
