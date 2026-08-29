import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

export type UseStepFadeTransitionOptions<T> = {
  currentStep: T;
  noneStep?: T;
  fadeOutDuration?: number;
  fadeInDuration?: number;
};

/**
 * Reusable hook to handle smooth 2-phase fade out and fade in transitions
 * (fading out active step completely, switching step, fading in new step)
 * between sheet/modal steps across any flow in the application.
 */
export function useStepFadeTransition<T>({
  currentStep,
  noneStep = "none" as unknown as T,
  fadeOutDuration = 120,
  fadeInDuration = 150,
}: UseStepFadeTransitionOptions<T>) {
  const [activeStep, setActiveStep] = useState<T>(currentStep);
  const transitionAnim = useRef(new Animated.Value(1)).current;
  const currentAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (currentStep === activeStep) return;

    if (currentAnimationRef.current) {
      currentAnimationRef.current.stop();
      currentAnimationRef.current = null;
    }

    if (activeStep !== noneStep && currentStep !== noneStep) {
      // Phase 1: Fade out active step (including Continue button) to 0
      const fadeOut = Animated.timing(transitionAnim, {
        toValue: 0,
        duration: fadeOutDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

      // Phase 2: Fade in new step (including Continue button) to 1
      const fadeIn = Animated.timing(transitionAnim, {
        toValue: 1,
        duration: fadeInDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

      currentAnimationRef.current = fadeOut;

      fadeOut.start(({ finished }) => {
        if (finished) {
          setActiveStep(currentStep);

          currentAnimationRef.current = fadeIn;
          fadeIn.start(({ finished: inFinished }) => {
            if (inFinished) {
              currentAnimationRef.current = null;
            }
          });
        }
      });
    } else {
      setActiveStep(currentStep);
      transitionAnim.setValue(1);
    }
  }, [currentStep, activeStep, noneStep, fadeOutDuration, fadeInDuration, transitionAnim]);

  return {
    activeStep,
    contentOpacity: transitionAnim,
  };
}
