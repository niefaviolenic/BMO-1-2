/* eslint-disable import/no-unresolved */
// @ts-ignore
import Module from 'module';
// @ts-ignore
import React from 'react';
// @ts-ignore
import { describe, expect, it, vi } from 'vitest';
import { KeyboardAvoidingView } from 'react-native';
import { SchedulesScreen } from './schedules-screen';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    platformOS: 'android',
  },
}));
type NodeModuleWithRequire = {
  require: (id: string) => unknown;
};

const moduleProto = Module.prototype as unknown as NodeModuleWithRequire;
const originalRequire = moduleProto.require;
moduleProto.require = function (this: unknown, id: string): unknown {
  if (typeof id === 'string' && (id.includes('.png') || id.includes('.svg') || id.includes('@/assets'))) {
    return 'mocked-asset';
  }
  return originalRequire.call(this, id);
};

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  [key: string]: unknown;
};

vi.mock('react', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react');
  return {
    ...actual,
    useState: vi.fn((initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      vi.fn(),
    ]),
    useEffect: vi.fn((effect: () => void | (() => void)) => {
      effect();
    }),
    useCallback: vi.fn((fn: unknown) => fn),
    useMemo: vi.fn((fn: () => unknown) => fn()),
    useRef: vi.fn((initial: unknown) => ({ current: initial })),
  };
});

vi.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => callback(),
}));

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('@/lib/api', () => ({
  isApiError: vi.fn().mockReturnValue(false),
  apiRequest: vi.fn(),
  subscribeMobileWebSocket: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: vi.fn(),
  },
  KeyboardAvoidingView: (props: MockComponentProps) => ({ type: 'KeyboardAvoidingView', props }),
  Platform: {
    get OS() {
      return mockState.platformOS;
    },
    select: vi.fn((dict: Record<string, unknown>) => dict[mockState.platformOS] ?? dict.default),
  },
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
  ScrollView: (props: MockComponentProps) => ({ type: 'ScrollView', props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
    absoluteFill: {},
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('@/components/ui/animated-dropdown-overlay', () => ({
  AnimatedDropdownOverlay: (props: MockComponentProps) => ({
    type: 'AnimatedDropdownOverlay',
    props,
  }),
}));

vi.mock('@/components/ui/bottom-white-fade-overlay', () => ({
  BottomWhiteFadeOverlay: (props: MockComponentProps) => ({
    type: 'BottomWhiteFadeOverlay',
    props,
  }),
}));

vi.mock('@/components/ui/chat-composer', () => ({
  ChatComposer: (props: MockComponentProps) => ({ type: 'ChatComposer', props }),
}));

vi.mock('@/components/ui/filter-icon-button', () => ({
  FilterIconButton: (props: MockComponentProps) => ({ type: 'FilterIconButton', props }),
}));

vi.mock('@/components/ui/liquid-glass-icon-button', () => ({
  LiquidGlassIconButton: (props: MockComponentProps) => ({ type: 'LiquidGlassIconButton', props }),
}));

vi.mock('@/features/chat/presentation/sidebar-shell', () => ({
  useSidebarShell: () => ({
    open: vi.fn(),
    close: vi.fn(),
    navigate: vi.fn(),
    registerActions: vi.fn(() => vi.fn()),
  }),
}));
vi.mock('lucide-react-native', () => ({
  Plus: (props: MockComponentProps) => ({ type: 'Plus', props }),
  Check: (props: MockComponentProps) => ({ type: 'Check', props }),
}));


vi.mock('@/features/schedules/components', () => ({
  DEFAULT_HYDRATION_PROMPT: 'Hydration prompt',
  DEFAULT_MORNING_PROMPT: 'Morning prompt',
  ScheduleCompletedCard: (props: MockComponentProps) => ({ type: 'ScheduleCompletedCard', props }),
  ScheduleContextMenu: (props: MockComponentProps) => ({ type: 'ScheduleContextMenu', props }),
  ScheduleFilterDropdown: (props: MockComponentProps) => ({ type: 'ScheduleFilterDropdown', props }),
  ScheduleHydrationCard: (props: MockComponentProps) => ({ type: 'ScheduleHydrationCard', props }),
  ScheduleMonitoringCard: (props: MockComponentProps) => ({ type: 'ScheduleMonitoringCard', props }),
  ScheduleMorningCard: (props: MockComponentProps) => ({ type: 'ScheduleMorningCard', props }),
  SchedulePausedCard: (props: MockComponentProps) => ({ type: 'SchedulePausedCard', props }),
  ScheduleWeeklyCard: (props: MockComponentProps) => ({ type: 'ScheduleWeeklyCard', props }),
  ScheduleFormSheet: (props: MockComponentProps) => ({ type: 'ScheduleFormSheet', props }),
}));

vi.mock('@/features/schedules/data/use-schedules', () => ({
  useSchedules: () => ({
    cards: [],
    hasSchedules: false,
    scheduleCount: 0,
    isLoading: false,
    isMutating: false,
    load: vi.fn().mockResolvedValue(undefined),
    createFromPrompt: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    rawScheduleById: vi.fn().mockReturnValue(null),
    cardById: vi.fn(),
    getContextMenuVariant: vi.fn(),
  }),
}));

function findElement(
  node: unknown,
  predicate: (el: { type?: unknown; props?: Record<string, unknown> }) => boolean
): { type?: unknown; props?: Record<string, unknown> } | null {
  if (!node || typeof node !== 'object') return null;
  const el = node as { type?: unknown; props?: Record<string, unknown> & { children?: unknown } };
  if (predicate(el)) {
    return el;
  }
  if (Array.isArray(el.props?.children)) {
    for (const child of el.props.children) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  } else if (el.props?.children) {
    return findElement(el.props.children, predicate);
  }
  return null;
}

describe('SchedulesScreen Keyboard Behavior', () => {
  it('renders KeyboardAvoidingView with height behavior on Android', () => {
    mockState.platformOS = 'android';
    const tree = SchedulesScreen({});
    expect(tree).toBeDefined();

    const keyboardView = findElement(
      tree,
      (el) => el.props?.behavior === 'height' || el.props?.behavior === 'padding'
    );
    expect(keyboardView).toBeDefined();
    expect(keyboardView?.props?.behavior).toBe('height');
  });

  it('renders KeyboardAvoidingView with padding behavior on iOS', () => {
    mockState.platformOS = 'ios';
    const tree = SchedulesScreen({});
    expect(tree).toBeDefined();

    const keyboardView = findElement(
      tree,
      (el) => el.props?.behavior === 'height' || el.props?.behavior === 'padding'
    );
    expect(keyboardView).toBeDefined();
    expect(keyboardView?.props?.behavior).toBe('padding');
  });

  it('renders New Schedule button and ScheduleFormSheet in the tree', () => {
    const tree = SchedulesScreen({ testID: 'schedules-screen' });
    const newButton = findElement(tree, (el) => el.props?.testID === 'schedules-screen-new-schedule-button');
    expect(newButton).toBeDefined();

    const createSheet = findElement(tree, (el) => el.props?.testID === 'schedules-screen-create-sheet');
    expect(createSheet).toBeDefined();
    expect(createSheet?.props?.isVisible).toBe(false);

    const editSheet = findElement(tree, (el) => el.props?.testID === 'schedules-screen-edit-sheet');
    expect(editSheet).toBeDefined();
    expect(editSheet?.props?.isVisible).toBe(false);
  });
});
