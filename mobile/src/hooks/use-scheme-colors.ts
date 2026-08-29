import { useMemo } from 'react';

import {
  Colors,
  SidebarTokens,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ColorSchemeName = 'light' | 'dark';

export function resolveColorScheme(scheme: string | null | undefined): ColorSchemeName {
  return scheme === 'dark' ? 'dark' : 'light';
}

export function useSchemeColors() {
  const scheme = resolveColorScheme(useColorScheme());

  return useMemo(
    () => ({
      scheme,
      colors: Colors[scheme],
      sidebar: SidebarTokens.colors[scheme],
    }),
    [scheme],
  );
}
