const DEFAULT_API_ORIGIN = 'https://api.personalbmo.web.id';

export const API_ORIGIN = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_ORIGIN
).replace(/\/$/, '');

export const API_V1_BASE_URL = `${API_ORIGIN}/api/v1`;

export const API_CONFIG = {
  ORIGIN: API_ORIGIN,
  BASE_URL: API_V1_BASE_URL,
} as const;

