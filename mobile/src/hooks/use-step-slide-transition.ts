import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

export type UseStepSlideTransitionOptions<T> = {
  currentStep: T;
  /** Positive = forward (slide left). Negative = back (slide right). */
  getDirection: (from: T, to: T) => number;
  width: number;
  duration?: number;
};

/**
 * Horizontal slide transition between in-screen steps.
 * Forward slides content left; back slides content right.
 */
export function useStepSlideTransition<T>({
  currentStep,
  getDirection,
  width,
  duration = 280,
}: UseStepSlideTransitionOptions<T>) {
  const [activeStep, setActiveStep] = useState<T>(currentStep);
  const translateX = useRef(new Animated.Value(0)).current;
  const currentAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const generationRef = useRef(0);
  const widthRef = useRef(width);
  const getDirectionRef = useRef(getDirection);
  const activeStepRef = useRef(activeStep);

  widthRef.current = width;
  getDirectionRef.current = getDirection;
  activeStepRef.current = activeStep;

  useEffect(() => {
    const generation = ++generationRef.current;

    if (currentAnimationRef.current) {
      currentAnimationRef.current.stop();
      currentAnimationRef.current = null;
    }

    // Interrupted mid-slide and returned to the visible step — snap home.
    if (currentStep === activeStepRef.current) {
      translateX.setValue(0);
      return;
    }

    const direction =
      Math.sign(getDirectionRef.current(activeStepRef.current, currentStep)) ||
      1;
    const travel = widthRef.current;

    const slideOut = Animated.timing(translateX, {
      toValue: -direction * travel,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    currentAnimationRef.current = slideOut;

    slideOut.start(({ finished }) => {
      if (!finished || generation !== generationRef.current) return;

      setActiveStep(currentStep);
      translateX.setValue(direction * travel);

      const slideIn = Animated.timing(translateX, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

      currentAnimationRef.current = slideIn;
      slideIn.start(({ finished: inFinished }) => {
        if (generation !== generationRef.current) return;
        if (inFinished) {
          currentAnimationRef.current = null;
        }
      });
    });
  }, [currentStep, duration, translateX]);

  return {
    activeStep,
    contentTranslateX: translateX,
  };
}
