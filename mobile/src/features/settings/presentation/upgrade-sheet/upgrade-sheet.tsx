import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { SettingsTokens } from '@/constants/theme';
import { PricingCardsRow } from '@/features/settings/components/pricing-cards-row';
import { UpgradeProCtaFooter } from '@/features/settings/components/upgrade-pro-cta-footer';
import { UpgradeProFeaturesSection } from '@/features/settings/components/upgrade-pro-features-section';
import { UpgradeProHero } from '@/features/settings/components/upgrade-pro-hero';
import {
  DEFAULT_SUBSCRIPTION_PLAN_ID,
  getPricingPlans,
  getSubscriptionPlan,
  HERO_SUBTITLE,
} from '@/features/settings/data/subscription/dummy-plans';
import type { SubscriptionPlanId } from '@/features/settings/domain/subscription/types';

const sheetTokens = SettingsTokens.sheet;
const tokens = SettingsTokens.upgradeSheet;

export type UpgradeSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  initialPlanId?: SubscriptionPlanId;
  onUpgradePress?: (planId: SubscriptionPlanId) => void;
  variant?: 'modal' | 'overlay';
  overlayZIndex?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function UpgradeSheet({
  isVisible,
  onClose,
  initialPlanId = DEFAULT_SUBSCRIPTION_PLAN_ID,
  onUpgradePress,
  variant = 'overlay',
  overlayZIndex = SettingsTokens.sheetLayer.upgrade,
  style,
  testID = 'upgrade-sheet',
}: UpgradeSheetProps) {
  const [selectedPlanId, setSelectedPlanId] =
    useState<SubscriptionPlanId>(initialPlanId);

  useEffect(() => {
    if (!isVisible) return;
    setSelectedPlanId(initialPlanId);
  }, [isVisible, initialPlanId]);

  const selectedPlan = useMemo(
    () => getSubscriptionPlan(selectedPlanId),
    [selectedPlanId],
  );

  const pricingPlans = useMemo(() => getPricingPlans(), []);

  const handleSelectPlan = (planId: string) => {
    if (planId === 'plus' || planId === 'pro') {
      setSelectedPlanId(planId);
    }
  };

  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClose}
      variant={variant}
      overlayZIndex={overlayZIndex}
      showCloseButton
      dragBehavior="resist"
      dismissOnBackdropPress={false}
      dismissOnRequestClose={false}
      disableScrollView
      sheetStyle={styles.sheetBackground}
      closeButtonTestID={`${testID}-close-button`}
      testID={testID}
    >
      <View style={[styles.root, style]} testID={`${testID}-content`}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          testID={`${testID}-scroll`}
        >
          <UpgradeProHero
            title={selectedPlan.heroTitle}
            subtitle={HERO_SUBTITLE}
            testID={`${testID}-hero`}
          />

          <PricingCardsRow
            plans={pricingPlans}
            selectedPlanId={selectedPlanId}
            onSelectPlan={handleSelectPlan}
            testID={`${testID}-pricing`}
          />

          <UpgradeProFeaturesSection
            title={selectedPlan.featuresTitle}
            features={selectedPlan.features}
            testID={`${testID}-features`}
          />
        </ScrollView>

        <UpgradeProCtaFooter
          onUpgradePress={() => onUpgradePress?.(selectedPlanId)}
          style={styles.ctaFooter}
          testID={`${testID}-cta`}
        />
      </View>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: sheetTokens.borderTopRadius,
    borderTopRightRadius: sheetTokens.borderTopRadius,
    paddingHorizontal: tokens.contentPaddingHorizontal,
  },
  root: {
    flex: 1,
    width: '100%',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    gap: tokens.contentGap,
    paddingTop: tokens.scrollPaddingTop,
    paddingBottom: tokens.scrollPaddingBottom,
    alignItems: 'center',
  },
  ctaFooter: {
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
});
