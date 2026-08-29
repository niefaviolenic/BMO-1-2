import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { apiRequest } from '@/lib/api';

import {
  BUG_REPORT_MAX_BYTES,
  BUG_REPORT_MAX_SCREENSHOTS,
  resolveScreenshotMimeType,
  screenshotUploadFileName,
} from '../domain/bug-report/bug-report';
import type {
  BugReportResult,
  BugReportSubmitInput,
} from '../domain/bug-report/types';

function guessFileName(uri: string): string {
  const withoutQuery = uri.split('?')[0] ?? uri;
  const segment = withoutQuery.split('/').pop();
  return segment && segment.length > 0 ? segment : 'screenshot.png';
}

async function prepareScreenshotPart(
  uri: string,
  index: number,
): Promise<{
  part: Blob;
  fileName: string;
}> {
  const source = new File(uri);
  if (!source.exists || source.size <= 0) {
    throw new Error(`Unable to read screenshot ${index + 1}.`);
  }
  if (source.size > BUG_REPORT_MAX_BYTES) {
    throw new Error(
      `Screenshot ${index + 1} exceeds 5 MB. Choose a smaller image.`,
    );
  }

  const rawName = source.name ?? guessFileName(uri);
  const mime = resolveScreenshotMimeType(rawName, source.type);
  const fileName = screenshotUploadFileName(mime, rawName, index);
  const destination = new File(
    Paths.cache,
    `joy-bug-${Date.now()}-${index}-${fileName}`,
  );
  await source.copy(destination);

  if (!destination.exists || destination.size <= 0) {
    throw new Error(`Unable to prepare screenshot ${index + 1}.`);
  }
  if (destination.size > BUG_REPORT_MAX_BYTES) {
    throw new Error(
      `Screenshot ${index + 1} exceeds 5 MB. Choose a smaller image.`,
    );
  }

  const part =
    destination.type === mime
      ? destination
      : destination.slice(0, destination.size, mime);

  return { part, fileName };
}

export async function submitBugReport(
  input: BugReportSubmitInput,
): Promise<BugReportResult> {
  const form = new FormData();
  form.append('category', input.category ?? 'GENERAL');
  form.append('description', input.description.trim());
  form.append(
    'context',
    input.context ??
      JSON.stringify({
        platform: Platform.OS,
        version: Platform.Version,
      }),
  );
  form.append('includeScreenshot', input.includeScreenshot ? 'true' : 'false');

  if (input.includeScreenshot && input.screenshotUris.length > 0) {
    const uris = input.screenshotUris.slice(0, BUG_REPORT_MAX_SCREENSHOTS);
    const prepared = await Promise.all(
      uris.map((uri, index) => prepareScreenshotPart(uri, index)),
    );
    for (const { part, fileName } of prepared) {
      form.append('screenshots', part, fileName);
    }
  }

  return await apiRequest<BugReportResult>('/support/bug-reports', {
    method: 'POST',
    body: form,
  });
}
