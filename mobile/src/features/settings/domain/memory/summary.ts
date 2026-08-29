import type { MemorySummarySection } from './types';

const OVERVIEW_TITLE = 'Overview';

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug;
}

export function memorySummarySectionsFromContent(
  content: string | null | undefined,
): MemorySummarySection[] {
  const trimmed = content?.trim() ?? '';
  if (!trimmed) {
    return [];
  }

  if (!trimmed.startsWith('## ')) {
    return [
      {
        id: 'overview',
        title: OVERVIEW_TITLE,
        body: trimmed,
      },
    ];
  }

  return trimmed
    .split(/^## /m)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const newline = part.indexOf('\n');
      const title = (newline === -1 ? part : part.slice(0, newline)).trim() || OVERVIEW_TITLE;
      const body = (newline === -1 ? '' : part.slice(newline + 1)).trim();
      return {
        id: slugify(title) || `section-${index}`,
        title,
        body,
      };
    });
}
