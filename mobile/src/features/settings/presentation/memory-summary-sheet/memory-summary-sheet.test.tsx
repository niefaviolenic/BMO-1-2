/* eslint-disable import/no-unresolved */
// @ts-ignore
import Module from 'module';
// @ts-ignore
import React from 'react';
import type * as ReactType from 'react';
// @ts-ignore
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { MemorySummarySheet } from './memory-summary-sheet';

type NodeModuleWithRequire = {
  require: (id: string) => unknown;
};

beforeAll(() => {
  const moduleProto = Module.prototype as unknown as NodeModuleWithRequire;
  const originalRequire = moduleProto.require;
  moduleProto.require = function (this: unknown, id: string): unknown {
    if (typeof id === 'string' && (id.includes('.png') || id.includes('.svg'))) {
      return 'mocked-asset';
    }
    return originalRequire.call(this, id);
  };
});
type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  [key: string]: unknown;
};
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof ReactType>('react');
  return {
    ...actual,
    useState: vi.fn((initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      vi.fn(),
    ]),
    useEffect: vi.fn((effect: () => void | (() => void)) => {
      effect();
    }),
  };
});

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
    absoluteFill: {},
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));

vi.mock('@/components/ui/modal-bottom-sheet', () => ({
  ModalBottomSheet: (props: MockComponentProps) => ({
    type: 'ModalBottomSheet',
    props,
  }),
}));

vi.mock('@/components/ui/liquid-glass-back-button', () => ({
  LiquidGlassBackButton: (props: MockComponentProps) => ({
    type: 'LiquidGlassBackButton',
    props,
  }),
}));

vi.mock('@/components/ui/liquid-glass-icon-button', () => ({
  LiquidGlassIconButton: (props: MockComponentProps) => ({
    type: 'LiquidGlassIconButton',
    props,
  }),
}));

vi.mock('lucide-react-native', () => ({
  RotateCw: (props: MockComponentProps) => ({
    type: 'RotateCw',
    props,
  }),
}));

vi.mock('@/components/ui/dot-matrix-pattern', () => ({
  DotMatrixPattern: (props: MockComponentProps) => ({
    type: 'DotMatrixPattern',
    props,
  }),
}));

vi.mock('./components/memory-generating-title', () => ({
  MemoryGeneratingTitle: (props: MockComponentProps) => ({
    type: 'MemoryGeneratingTitle',
    props,
  }),
}));

vi.mock('./components/memory-summary-composer', () => ({
  MemorySummaryComposer: (props: MockComponentProps) => ({
    type: 'MemorySummaryComposer',
    props,
  }),
}));

vi.mock('./components/memory-summary-content', () => ({
  MemorySummaryContent: (props: MockComponentProps) => ({
    type: 'MemorySummaryContent',
    props,
  }),
}));

describe('MemorySummarySheet', () => {
  it('renders regenerate button in header and triggers onRegenerate on press', () => {
    const handleRegenerate = vi.fn();
    const handleClose = vi.fn();

    const element = MemorySummarySheet({
      isVisible: true,
      onClose: handleClose,
      onRegenerate: handleRegenerate,
      status: 'generated',
      sections: [{ id: '1', title: 'Work', body: 'Software developer' }],
    }) as unknown as {
      type: unknown;
      props: {
        header: {
          props: {
            children: {
              type: unknown;
              props: {
                testID?: string;
                onPress?: () => void;
              };
            }[];
          };
        };
      };
    };

    expect(element.props).toBeDefined();

    const headerChildren = element.props.header.props.children;
    const regenerateButton = headerChildren.find(
      (child) => child?.props?.testID === 'memory-summary-sheet-regenerate-button'
    );
    expect(regenerateButton).toBeDefined();

    // Press the regenerate button
    regenerateButton?.props?.onPress?.();
    expect(handleRegenerate).toHaveBeenCalledTimes(1);
  });

  it('disables regenerate button when status is generating', () => {
    const handleRegenerate = vi.fn();
    const handleClose = vi.fn();

    const element = MemorySummarySheet({
      isVisible: true,
      onClose: handleClose,
      onRegenerate: handleRegenerate,
      status: 'generating',
    }) as unknown as {
      type: unknown;
      props: {
        header: {
          props: {
            children: {
              type: unknown;
              props: {
                testID?: string;
                onPress?: () => void;
              };
            }[];
          };
        };
      };
    };

    const headerChildren = element.props.header.props.children;
    const regenerateButton = headerChildren.find(
      (child) => child?.props?.testID === 'memory-summary-sheet-regenerate-button'
    );
    expect(regenerateButton).toBeDefined();
    expect(regenerateButton?.props?.onPress).toBeUndefined();
  });
});
