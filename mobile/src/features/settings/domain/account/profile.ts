import { isApiError } from '@/lib/api';

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

/** Matches backend P9 `avatarMaxBytes` (5_242_880). */
export const AVATAR_MAX_BYTES = 5_242_880;

export const ACCEPTED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AcceptedAvatarMimeType = (typeof ACCEPTED_AVATAR_MIME_TYPES)[number];

export function normalizeUsername(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase();
}

export function isLocalAvatarUri(uri: string | undefined): boolean {
  if (!uri) {
    return false;
  }
  return !/^https?:\/\//i.test(uri);
}

export function normalizeAvatarMimeType(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const mime = value.trim().toLowerCase();
  if (mime === 'image/jpg' || mime === 'image/pjpeg') {
    return 'image/jpeg';
  }
  if (mime === 'image/x-png') {
    return 'image/png';
  }
  return mime.length > 0 ? mime : undefined;
}

export function isAcceptedAvatarMimeType(
  mime: string | undefined,
): mime is AcceptedAvatarMimeType {
  return (
    mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp'
  );
}

export function avatarExtensionForMime(mime: AcceptedAvatarMimeType): string {
  if (mime === 'image/png') {
    return 'png';
  }
  if (mime === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
}

export function resolveAvatarMimeType(
  fileName: string,
  ...candidates: Array<string | undefined>
): AcceptedAvatarMimeType {
  for (const candidate of candidates) {
    const normalized = normalizeAvatarMimeType(candidate);
    if (isAcceptedAvatarMimeType(normalized)) {
      return normalized;
    }
  }

  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  throw new Error('Use a JPEG, PNG, or WebP photo.');
}

export function avatarUploadFileName(
  mime: AcceptedAvatarMimeType,
  rawName?: string,
): string {
  const extension = avatarExtensionForMime(mime);
  const base = (rawName ?? 'avatar').replace(/[^a-zA-Z0-9._-]/g, '_');
  const withoutExt = base.replace(/\.[^.]+$/, '');
  const safe = (withoutExt.length > 0 ? withoutExt : 'avatar').slice(0, 40);
  return `${safe}.${extension}`;
}

export function mapAccountApiError(error: unknown): string {
  if (error instanceof Error && !isApiError(error) && error.message) {
    return error.message;
  }

  if (isApiError(error)) {
    if (error.code === 'CONFLICT') {
      return 'Username unavailable';
    }
    if (error.code === 'INVALID_INPUT') {
      if (
        error.message === 'Invalid avatar image' ||
        error.message === 'Avatar file is required' ||
        error.message === 'INVALID_INPUT'
      ) {
        return 'That photo could not be used. Try a JPEG, PNG, or WebP under 5 MB.';
      }
      return 'That value is not valid.';
    }
    if (error.code === 'RATE_LIMITED') {
      return 'Too many attempts. Try again later.';
    }
    if (error.code === 'REQUEST_TIMEOUT') {
      return 'The photo took too long to upload. Try a smaller image.';
    }
    if (error.code === 'SERVICE_UNAVAILABLE') {
      return 'Avatar upload is busy. Try again in a moment.';
    }
    if (error.code === 'NETWORK_ERROR') {
      return error.message;
    }
    return error.message || 'Unable to save. Try again.';
  }

  return 'Unable to save. Try again.';
}
