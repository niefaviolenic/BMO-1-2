import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { SettingsTokens } from '@/constants/theme';
export type PricingPlan = {
  /** Unique ID for the plan (e.g. "plus", "pro", "monthly", "yearly"). */
  id: string;
  /** Name of the plan (e.g. "Joy Plus", "Joy Pro", "Monthly"). */
  title: string;
  /** Display price string (e.g. "Rp 1,889juta", "$19.99"). */
  price: string;
  /** Billing period / subtitle (e.g. "/ month", "/ year"). */
  period: string;
  /** Optional savings/promo badge text (e.g. "Save 20%"). */
  badgeText?: string;
};

export type PricingCardsRowProps = {
  /** List of pricing plans to display. Defaults to Joy Plus & Joy Pro. */
  plans?: PricingPlan[];
  /** Currently selected plan ID. Defaults to "plus". */
  selectedPlanId?: string;
  /** Callback fired when a plan card is selected. */
  onSelectPlan?: (planId: string) => void;
  /** Custom container style overrides. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export const DEFAULT_PRICING_PLANS: PricingPlan[] = [
  {
    id: 'plus',
    title: 'Joy Plus',
    price: 'Rp 1,889juta',
    period: '/ month',
  },
  {
    id: 'pro',
    title: 'Joy Pro',
    price: 'Rp 3,499juta',
    period: '/ month',
  },
];

export function PricingCardsRow({
  plans = DEFAULT_PRICING_PLANS,
  selectedPlanId = 'plus',
  onSelectPlan,
  style,
  testID = 'pricing-cards-row',
}: PricingCardsRowProps) {
  const theme = useTheme();
  const accentColor = theme.accentPrimary ?? theme.linkPrimary;
  return (
    <View style={[styles.container, style]} testID={testID}>
      {plans.map((plan) => {
        const isSelected = plan.id === selectedPlanId;

        return (
          <Pressable
            key={plan.id}
            onPress={() => onSelectPlan?.(plan.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${plan.title}, ${plan.price} ${plan.period}${
              plan.badgeText ? `, ${plan.badgeText}` : ''
            }`}
            testID={`${testID}-card-${plan.id}`}
            style={({ pressed }) => [
              styles.card,
              isSelected
                ? [
                    styles.selectedCard,
                    {
                      backgroundColor: theme.backgroundSelected,
                      borderColor: theme.linkPrimary,
                    },
                  ]
                : [
                    styles.unselectedCard,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ],
              pressed && styles.cardPressed,
            ]}
          >
            {plan.badgeText ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: `${accentColor}20` },
                ]}
                testID={`${testID}-card-${plan.id}-badge`}
              >
                <Text style={[styles.badgeText, { color: accentColor }]}>{plan.badgeText}</Text>
              </View>
            ) : null}

            <Text
              style={[styles.title, { color: theme.text }]}
              numberOfLines={1}
              testID={`${testID}-card-${plan.id}-title`}
            >
              {plan.title}
            </Text>

            <Text
              style={[styles.price, { color: theme.text }]}
              numberOfLines={1}
              testID={`${testID}-card-${plan.id}-price`}
            >
              {plan.price}
            </Text>

            <Text
              style={[styles.period, { color: theme.textSecondary }]}
              numberOfLines={1}
              testID={`${testID}-card-${plan.id}-period`}
            >
              {plan.period}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const tokens = SettingsTokens.pricingCardsRow;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: tokens.width,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.gap,
  },
  card: {
    flex: 1,
    height: tokens.height,
    borderRadius: tokens.cardRadius,
    padding: tokens.cardPadding,
    justifyContent: 'center',
    gap: tokens.cardGap,
    position: 'relative',
  },
  selectedCard: {
    backgroundColor: tokens.colors.selectedBackground,
    borderColor: tokens.colors.selectedBorder,
    borderWidth: 1.5,
  },
  unselectedCard: {
    backgroundColor: tokens.colors.unselectedBackground,
    borderColor: tokens.colors.unselectedBorder,
    borderWidth: 1,
  },
  cardPressed: {
    opacity: 0.85,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: tokens.colors.badgeBackground,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: tokens.typography.badge.fontSize,
    fontWeight: '600',
    lineHeight: tokens.typography.badge.lineHeight,
    color: tokens.colors.badgeText,
  },
  title: {
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
    lineHeight: tokens.typography.title.lineHeight,
    color: tokens.colors.titleText,
  },
  price: {
    fontSize: tokens.typography.price.fontSize,
    fontWeight: '500',
    lineHeight: tokens.typography.price.lineHeight,
    color: tokens.colors.priceText,
  },
  period: {
    fontSize: tokens.typography.period.fontSize,
    fontWeight: '400',
    lineHeight: tokens.typography.period.lineHeight,
    color: tokens.colors.periodText,
  },
});
