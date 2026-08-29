/* eslint-disable import/no-unresolved */
// @ts-ignore
import { describe, expect, it } from 'vitest';

import { memorySummarySectionsFromContent } from './summary';

describe('memorySummarySectionsFromContent', () => {
  it('returns empty array for empty or null content', () => {
    expect(memorySummarySectionsFromContent(null)).toEqual([]);
    expect(memorySummarySectionsFromContent(undefined)).toEqual([]);
    expect(memorySummarySectionsFromContent('')).toEqual([]);
    expect(memorySummarySectionsFromContent('   ')).toEqual([]);
  });

  it('wraps plain text into an Overview section when no ## headers exist', () => {
    const content = 'User enjoys coding and building hardware devices.';
    expect(memorySummarySectionsFromContent(content)).toEqual([
      {
        id: 'overview',
        title: 'Overview',
        body: content,
      },
    ]);
  });

  it('parses structured markdown sections into distinct memory sections with slugs', () => {
    const content = `## Profile & Identity
User is Rangga, a software engineer.

## Work & Projects
Currently building Joy AI companion on mobile and hardware.

## Preferences & Interests
Loves robotics and physical computing.`;

    expect(memorySummarySectionsFromContent(content)).toEqual([
      {
        id: 'profile-identity',
        title: 'Profile & Identity',
        body: 'User is Rangga, a software engineer.',
      },
      {
        id: 'work-projects',
        title: 'Work & Projects',
        body: 'Currently building Joy AI companion on mobile and hardware.',
      },
      {
        id: 'preferences-interests',
        title: 'Preferences & Interests',
        body: 'Loves robotics and physical computing.',
      },
    ]);
  });
});
