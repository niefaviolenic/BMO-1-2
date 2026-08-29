import assert from 'node:assert/strict';

import {
  BUG_REPORT_MAX_BYTES,
  BUG_REPORT_MAX_SCREENSHOTS,
  isAcceptedScreenshotMimeType,
  mapBugReportApiError,
  normalizeScreenshotMimeType,
  resolveScreenshotMimeType,
  screenshotExtensionForMime,
  screenshotUploadFileName,
} from '../src/features/settings/domain/bug-report/bug-report.ts';
import { ApiError } from '../src/lib/api/types.ts';

// 1. Constants
assert.equal(BUG_REPORT_MAX_BYTES, 5242880);
assert.equal(BUG_REPORT_MAX_SCREENSHOTS, 5);

// 2. MIME type normalization
assert.equal(normalizeScreenshotMimeType('IMAGE/JPEG'), 'image/jpeg');
assert.equal(normalizeScreenshotMimeType('image/jpg'), 'image/jpeg');
assert.equal(normalizeScreenshotMimeType('image/pjpeg'), 'image/jpeg');
assert.equal(normalizeScreenshotMimeType('image/x-png'), 'image/png');
assert.equal(normalizeScreenshotMimeType('image/png'), 'image/png');
assert.equal(normalizeScreenshotMimeType('image/webp'), 'image/webp');
assert.equal(normalizeScreenshotMimeType(''), undefined);
assert.equal(normalizeScreenshotMimeType(null), undefined);

// 3. Accepted MIME types
assert.equal(isAcceptedScreenshotMimeType('image/jpeg'), true);
assert.equal(isAcceptedScreenshotMimeType('image/png'), true);
assert.equal(isAcceptedScreenshotMimeType('image/webp'), true);
assert.equal(isAcceptedScreenshotMimeType('image/gif'), false);
assert.equal(isAcceptedScreenshotMimeType('application/pdf'), false);

// 4. Extensions
assert.equal(screenshotExtensionForMime('image/png'), 'png');
assert.equal(screenshotExtensionForMime('image/webp'), 'webp');
assert.equal(screenshotExtensionForMime('image/jpeg'), 'jpg');

// 5. File name resolution & sanitization
assert.equal(
  resolveScreenshotMimeType('screenshot.PNG', 'image/png'),
  'image/png',
);
assert.equal(resolveScreenshotMimeType('screenshot.webp'), 'image/webp');
assert.equal(resolveScreenshotMimeType('photo.jpg'), 'image/jpeg');
assert.throws(() => resolveScreenshotMimeType('doc.pdf'), /Use a JPEG, PNG, or WebP screenshot/);

assert.equal(
  screenshotUploadFileName('image/png', 'my/crazy:screenshot.png', 0),
  'my_crazy_screenshot.png',
);
assert.equal(
  screenshotUploadFileName('image/jpeg', undefined, 1),
  'screenshot_2.jpg',
);

// 6. Error mappings
assert.equal(
  mapBugReportApiError(new Error('Custom error message')),
  'Custom error message',
);
assert.equal(
  mapBugReportApiError(
    new ApiError('INVALID_INPUT', 400, 'Invalid bug report attachment'),
  ),
  'One of your screenshots could not be used. Try a JPEG, PNG, or WebP under 5 MB.',
);
assert.equal(
  mapBugReportApiError(new ApiError('RATE_LIMITED', 429)),
  'Too many submissions. Try again later.',
);
assert.equal(
  mapBugReportApiError(new ApiError('REQUEST_TIMEOUT', 408)),
  'The report took too long to upload. Try smaller screenshots.',
);
assert.equal(
  mapBugReportApiError(new ApiError('SERVICE_UNAVAILABLE', 503)),
  'Bug reporting is currently unavailable. Try again in a moment.',
);
assert.equal(
  mapBugReportApiError(new TypeError('Random')),
  'Random',
);

console.log('✅ All bug report domain tests passed successfully!');
