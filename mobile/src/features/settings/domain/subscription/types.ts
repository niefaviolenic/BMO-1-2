export type SubscriptionPlanId = 'plus' | 'pro';

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  title: string;
  price: string;
  period: string;
  heroTitle: string;
  featuresTitle: string;
  features: string[];
};
