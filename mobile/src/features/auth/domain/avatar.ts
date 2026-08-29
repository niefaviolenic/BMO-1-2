import { AvatarTokens } from '@/constants/theme';

/**
 * Extracts a 2-character initials string from a user's display name or username.
 *
 * Rules:
 * - Multi-word names (e.g. "Rangga Hadi Putra"): First letter of first word + first letter of last word -> "RP"
 * - Two-word names (e.g. "Jane Doe"): "JD"
 * - Single-word names (e.g. "Rangga"): First two letters -> "RA" (or single letter if 1 char)
 * - Empty / null / whitespace: returns fallback (default 'U')
 *
 * @param name User's full name, display name, or username
 * @param fallback Fallback string when name is empty (default 'U')
 * @returns 1-2 uppercase characters
 */
export function getInitials(
  name?: string | null,
  fallback: string = AvatarTokens.fallbackInitial,
): string {
  if (!name) {
    return fallback;
  }

  // Remove surrounding whitespace and collapse multi-space/separator sequences
  const cleaned = name.trim();
  if (!cleaned) {
    return fallback;
  }

  // Split by whitespace or common separators (e.g., dot, underscore, hyphen if no space)
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);

  if (words.length >= 2) {
    const firstChar = words[0].charAt(0);
    const lastChar = words[words.length - 1].charAt(0);
    const result = `${firstChar}${lastChar}`.toUpperCase();
    return result || fallback;
  }

  const singleWord = words[0];
  // If single word has at least 2 characters, take first 2; otherwise take first 1
  const result = singleWord.slice(0, 2).toUpperCase();
  return result || fallback;
}

/**
 * Deterministically generates a consistent background color for a given seed (name, user id, email).
 *
 * Uses polynomial hash algorithm modulo the palette size to ensure stability across re-renders
 * and consistent visual branding for the same user.
 *
 * @param seed Seed string (e.g. user ID, name, email)
 * @param palette Optional custom color palette (defaults to AvatarTokens.palette)
 * @returns Hex color string
 */
export function getAvatarColor(
  seed?: string | null,
  palette: readonly string[] = AvatarTokens.palette,
): string {
  if (!seed || !seed.trim() || palette.length === 0) {
    return palette[0] ?? AvatarTokens.palette[0];
  }

  const normalized = seed.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash + normalized.charCodeAt(index) * (index + 1) * 31) % palette.length;
  }

  return palette[Math.abs(hash) % palette.length] ?? palette[0];
}
