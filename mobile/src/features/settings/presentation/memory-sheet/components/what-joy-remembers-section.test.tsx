/* eslint-disable import/no-unresolved */
// @ts-ignore
import React from 'react';
// @ts-ignore
vi.mock('react', async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    useRef: vi.fn((initial?: unknown) => ({ current: initial })),
    useCallback: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
    useMemo: vi.fn((factory: () => unknown) => factory()),
    useState: vi.fn((initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      vi.fn(),
    ]),
    useEffect: vi.fn((effect: () => void | (() => void)) => {
      effect();
    }),
  };
});

import { describe, expect, it, vi } from 'vitest';
import { Alert } from 'react-native';

import type { MemoryItemDto } from '@/features/settings/data/memory-settings-api';
import { WhatJoyRemembersSection } from './what-joy-remembers-section';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  [key: string]: unknown;
};

vi.mock('react-native', () => ({
  ActivityIndicator: (props: MockComponentProps) => ({ type: 'ActivityIndicator', props }),
  Alert: { alert: vi.fn() },
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('lucide-react-native', () => ({
  Trash2: (props: MockComponentProps) => ({ type: 'Trash2', props }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#000000',
    textSecondary: '#666666',
    textMuted: '#999999',
    cardBackground: '#FAFAFA',
    border: '#E0E0E0',
  }),
}));

function findElement(
  node: unknown,
  predicate: (el: { type?: unknown; props?: Record<string, unknown> }) => boolean,
): { type?: unknown; props?: Record<string, unknown> } | null {
  if (!node || typeof node !== 'object') return null;
  const el = node as { type?: unknown; props?: Record<string, unknown> & { children?: unknown } };
  if (predicate(el)) return el;
  const children = Array.isArray(el.props?.children)
    ? el.props.children
    : el.props?.children
      ? [el.props.children]
      : [];
  for (const child of children) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

const mockMemories: MemoryItemDto[] = [
  {
    id: 'mem-1',
    topic: 'name',
    category: 'identity',
    content: 'Nama user adalah Fadillah',
    importance: 8,
    source: 'conversation',
    createdAt: '2026-09-13T09:00:00.000Z',
    updatedAt: '2026-09-13T09:00:00.000Z',
  },
  {
    id: 'mem-2',
    topic: 'relationship',
    category: 'contact',
    content: 'Has contact/relationship named kak rieka',
    importance: 6,
    source: 'conversation',
    createdAt: '2026-09-13T09:05:00.000Z',
    updatedAt: '2026-09-13T09:05:00.000Z',
  },
];

describe('WhatJoyRemembersSection', () => {
  it('renders empty state when memories list is empty', () => {
    const element = WhatJoyRemembersSection({
      memories: [],
      testID: 'memories-section',
    });

    const emptyView = findElement(element, (el) => el.props?.testID === 'memories-section-empty');
    expect(emptyView).toBeDefined();
  });

  it('renders loading indicator when isLoading is true', () => {
    const element = WhatJoyRemembersSection({
      memories: [],
      isLoading: true,
      testID: 'memories-section',
    });

    const loadingView = findElement(element, (el) => el.props?.testID === 'memories-section-loading');
    expect(loadingView).toBeDefined();
  });

  it('renders memory items and triggers alert on delete', () => {
    const onDeleteMock = vi.fn();
    const element = WhatJoyRemembersSection({
      memories: mockMemories,
      onDeleteMemory: onDeleteMock,
      testID: 'memories-section',
    });

    const item1 = findElement(element, (el) => el.props?.testID === 'memories-section-item-mem-1');
    expect(item1).toBeDefined();

    const deleteBtn = findElement(element, (el) => el.props?.testID === 'memories-section-delete-mem-1');
    expect(deleteBtn).toBeDefined();

    deleteBtn?.props?.onPress();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Forget Memory',
      expect.stringContaining('Nama user adalah Fadillah'),
      expect.any(Array),
    );
  });
});
