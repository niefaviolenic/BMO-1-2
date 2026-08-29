export type GenAlphaBadgeTierId =
  | 'cooked'
  | 'grass'
  | 'mewing'
  | 'sigma'
  | 'rizzler'
  | 'mogger'
  | 'aura'
  | 'gigachad'
  | 'alpha'
  | 'ascended'
  | 'goat';

export interface GenAlphaBadgeTier {
  id: GenAlphaBadgeTierId;
  minDays: number;
  maxDays: number;
  nextTierDays: number | null;
  name: string;
  emoji: string;
  stageLabel: string;
  subtitle: string;
  accentColor: string;
  badgeBgColor: string;
}

export const GEN_ALPHA_BADGE_TIERS: GenAlphaBadgeTier[] = [
  {
    id: 'cooked',
    minDays: 0,
    maxDays: 0,
    nextTierDays: 1,
    name: 'Cooked',
    emoji: '🤡',
    stageLabel: 'DAY 0',
    subtitle: 'Bro is totally cooked. Minus 10,000 aura. Waktunya touch grass!',
    accentColor: '#EF4444',
    badgeBgColor: '#FEF2F2',
  },
  {
    id: 'grass',
    minDays: 1,
    maxDays: 2,
    nextTierDays: 3,
    name: 'Grass',
    emoji: '🌾',
    stageLabel: 'DAY 1 - 2',
    subtitle: 'Baru aja touch grass. Bau rumput & udara segar mulai kerasa.',
    accentColor: '#22C55E',
    badgeBgColor: '#F0FDF4',
  },
  {
    id: 'mewing',
    minDays: 3,
    maxDays: 6,
    nextTierDays: 7,
    name: 'Mewing',
    emoji: '🧏‍♂️',
    stageLabel: 'DAY 3 - 6',
    subtitle: 'Lidah nempel langit-langit. No yap, cuma fokus reset dopamine.',
    accentColor: '#EAB308',
    badgeBgColor: '#FEFCE8',
  },
  {
    id: 'sigma',
    minDays: 7,
    maxDays: 13,
    nextTierDays: 14,
    name: 'Sigma',
    emoji: '🗿',
    stageLabel: 'DAY 7 - 13',
    subtitle: '1 Minggu Lulus! Lone wolf mode aktif, BGM Nightcall makin nyaring.',
    accentColor: '#3B82F6',
    badgeBgColor: '#EFF6FF',
  },
  {
    id: 'rizzler',
    minDays: 14,
    maxDays: 29,
    nextTierDays: 30,
    name: 'Rizzler',
    emoji: '✨',
    stageLabel: 'DAY 14 - 29',
    subtitle: '2 Minggu Clean! Eye contact meluap, unspoken rizz tak tertandingi.',
    accentColor: '#8B5CF6',
    badgeBgColor: '#F5F3FF',
  },
  {
    id: 'mogger',
    minDays: 30,
    maxDays: 59,
    nextTierDays: 60,
    name: 'Mogger',
    emoji: '💪',
    stageLabel: 'DAY 30 - 59',
    subtitle: '1 Bulan Clean! Mogging urusan sepele. Jawline sekeras baja.',
    accentColor: '#F59E0B',
    badgeBgColor: '#FFFBEB',
  },
  {
    id: 'aura',
    minDays: 60,
    maxDays: 89,
    nextTierDays: 90,
    name: 'Aura',
    emoji: '🔮',
    stageLabel: 'DAY 60 - 89',
    subtitle: '2 Bulan Clean! +999,999 Aura unlocked. Pasif aura bikin urge kabur.',
    accentColor: '#06B6D4',
    badgeBgColor: '#ECFEFF',
  },
  {
    id: 'gigachad',
    minDays: 90,
    maxDays: 179,
    nextTierDays: 180,
    name: 'Gigachad',
    emoji: '🪐',
    stageLabel: 'DAY 90 - 179',
    subtitle: '90-Day Reboot Unlocked! Level Ohio udah lewat, disiplin galaksi.',
    accentColor: '#6366F1',
    badgeBgColor: '#EEF2FF',
  },
  {
    id: 'alpha',
    minDays: 180,
    maxDays: 269,
    nextTierDays: 270,
    name: 'Alpha',
    emoji: '🐺',
    stageLabel: 'DAY 180 - 269',
    subtitle: 'Half-Year Milestone! Leader of the pack, pikiran sekuat baja.',
    accentColor: '#A855F7',
    badgeBgColor: '#F5F3FF',
  },
  {
    id: 'ascended',
    minDays: 270,
    maxDays: 364,
    nextTierDays: 365,
    name: 'Ascended',
    emoji: '🌌',
    stageLabel: 'DAY 270 - 364',
    subtitle: '9 Bulan Clean! Entitas kosmik yang tak tersentuh kecanduan.',
    accentColor: '#38BDF8',
    badgeBgColor: '#F0F9FF',
  },
  {
    id: 'goat',
    minDays: 365,
    maxDays: Infinity,
    nextTierDays: null,
    name: 'GOAT',
    emoji: '🐐',
    stageLabel: 'DAY 365+',
    subtitle: '365 Hari Streak! Greatest Of All Time. Absolute peak legend.',
    accentColor: '#EC4899',
    badgeBgColor: '#FDF2F8',
  },
];

export function getGenAlphaBadgeByDays(daysStreak: number): GenAlphaBadgeTier {
  const safeDays = Math.max(0, Math.floor(daysStreak));
  const found = GEN_ALPHA_BADGE_TIERS.find(
    (tier) => safeDays >= tier.minDays && safeDays <= tier.maxDays
  );
  return found ?? GEN_ALPHA_BADGE_TIERS[GEN_ALPHA_BADGE_TIERS.length - 1];
}

export function getNextTier(currentTier: GenAlphaBadgeTier): GenAlphaBadgeTier | null {
  const currentIndex = GEN_ALPHA_BADGE_TIERS.findIndex((t) => t.id === currentTier.id);
  if (currentIndex < 0 || currentIndex >= GEN_ALPHA_BADGE_TIERS.length - 1) {
    return null;
  }
  return GEN_ALPHA_BADGE_TIERS[currentIndex + 1];
}

export interface BadgeProgressInfo {
  currentDays: number;
  targetDays: number;
  progressPercentage: number;
  tierSegmentPercentage: number;
  nextTierName: string | null;
}

export function calculateBadgeProgress(daysStreak: number): BadgeProgressInfo {
  const safeDays = Math.max(0, Math.floor(daysStreak));
  const currentTier = getGenAlphaBadgeByDays(safeDays);
  const nextTier = getNextTier(currentTier);

  if (!nextTier || currentTier.nextTierDays === null) {
    return {
      currentDays: safeDays,
      targetDays: 365,
      progressPercentage: 100,
      tierSegmentPercentage: 100,
      nextTierName: null,
    };
  }

  const targetDays = currentTier.nextTierDays;
  const progressPercentage = Math.min(100, Math.max(0, (safeDays / targetDays) * 100));

  const tierMin = currentTier.minDays;
  const tierMax = targetDays;
  const tierSegmentPercentage =
    tierMax > tierMin
      ? Math.min(100, Math.max(4, ((safeDays - tierMin) / (tierMax - tierMin)) * 100))
      : 100;

  return {
    currentDays: safeDays,
    targetDays,
    progressPercentage,
    tierSegmentPercentage,
    nextTierName: nextTier.name,
  };
}
