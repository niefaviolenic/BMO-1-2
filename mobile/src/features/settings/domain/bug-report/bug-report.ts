import { isApiError } from '../../../../lib/api/types';

/** Matches backend P9 bug report attachment limit (5_242_880 bytes). */
export const BUG_REPORT_MAX_BYTES = 5_242_880;

/** Matches backend P9 maximum screenshot count. */
export const BUG_REPORT_MAX_SCREENSHOTS = 5;

export const ACCEPTED_BUG_REPORT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AcceptedBugReportMimeType =
  (typeof ACCEPTED_BUG_REPORT_MIME_TYPES)[number];

export function normalizeScreenshotMimeType(
  value?: string | null,
): string | undefined {
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

export function isAcceptedScreenshotMimeType(
  mime: string | undefined,
): mime is AcceptedBugReportMimeType {
  return (
    mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp'
  );
}

export function screenshotExtensionForMime(
  mime: AcceptedBugReportMimeType,
): string {
  if (mime === 'image/png') {
    return 'png';
  }
  if (mime === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
}

export function resolveScreenshotMimeType(
  fileName: string,
  ...candidates: Array<string | undefined>
): AcceptedBugReportMimeType {
  for (const candidate of candidates) {
    const normalized = normalizeScreenshotMimeType(candidate);
    if (isAcceptedScreenshotMimeType(normalized)) {
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

  throw new Error('Use a JPEG, PNG, or WebP screenshot.');
}

export function screenshotUploadFileName(
  mime: AcceptedBugReportMimeType,
  rawName?: string,
  index?: number,
): string {
  const extension = screenshotExtensionForMime(mime);
  const defaultPrefix =
    typeof index === 'number' ? `screenshot_${index + 1}` : 'screenshot';
  const base = (rawName ?? defaultPrefix).replace(/[^a-zA-Z0-9._-]/g, '_');
  const withoutExt = base.replace(/\.[^.]+$/, '');
  const safe = (withoutExt.length > 0 ? withoutExt : defaultPrefix).slice(0, 40);
  return `${safe}.${extension}`;
}

export function mapBugReportApiError(error: unknown): string {
  if (error instanceof Error && !isApiError(error) && error.message) {
    return error.message;
  }

  if (isApiError(error)) {
    if (error.code === 'INVALID_INPUT') {
      if (
        error.message === 'Invalid bug report attachment' ||
        error.message?.includes('screenshot')
      ) {
        return 'One of your screenshots could not be used. Try a JPEG, PNG, or WebP under 5 MB.';
      }
      return error.message || 'Please provide a valid description.';
    }
    if (error.code === 'RATE_LIMITED') {
      return 'Too many submissions. Try again later.';
    }
    if (error.code === 'REQUEST_TIMEOUT') {
      return 'The report took too long to upload. Try smaller screenshots.';
    }
    if (error.code === 'SERVICE_UNAVAILABLE') {
      return 'Bug reporting is currently unavailable. Try again in a moment.';
    }
    if (error.code === 'NETWORK_ERROR') {
      return error.message;
    }
    return error.message || 'Unable to send bug report. Try again.';
  }

  return 'Unable to send bug report. Try again.';
}
