import type {
  SubscriptionPlan,
  SubscriptionPlanId,
} from '@/features/settings/domain/subscription/types';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plus',
    title: 'Joy Plus',
    price: 'Rp 1,889juta',
    period: '/ month',
    heroTitle: 'Get Joy Plus',
    featuresTitle: 'Everything in Free, and:',
    features: [
      'Plugin integrations (WhatsApp, Spotify)',
      'Scheduled actions & automated tasks',
      'Personalization & custom instructions',
      'Expanded long-term memory summary',
      'Priority AI response speed',
      'Early access to new features & plugins',
    ],
  },
  {
    id: 'pro',
    title: 'Joy Pro',
    price: 'Rp 3,499juta',
    period: '/ month',
    heroTitle: 'Get Joy Pro',
    featuresTitle: 'Everything in Plus, and:',
    features: [
      'Unlimited active plugin integrations',
      'Unlimited scheduled actions & automations',
      'Frontier AI model with maximum reasoning',
      'Unlimited long-term memory & context',
      'Multi-device & physical robot pairing',
      'Highest priority speed & 24/7 execution',
    ],
  },
];

export const DEFAULT_SUBSCRIPTION_PLAN_ID: SubscriptionPlanId = 'plus';

export const HERO_SUBTITLE = 'Get more of Joy with expanded access';

export function getSubscriptionPlan(
  id: SubscriptionPlanId,
): SubscriptionPlan {
  const plan = SUBSCRIPTION_PLANS.find((item) => item.id === id);
  return plan ?? SUBSCRIPTION_PLANS[0];
}

export function getPricingPlans() {
  return SUBSCRIPTION_PLANS.map(({ id, title, price, period }) => ({
    id,
    title,
    price,
    period,
  }));
}
