/* eslint-disable import/no-unresolved */
// @ts-ignore
import Module from 'module';
// @ts-ignore
import React from 'react';
// @ts-ignore
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { MainChatScreen } from './main-chat-screen';
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

const mockPinSession = vi.fn();
const mockUnpinSession = vi.fn();
const mockDeleteSession = vi.fn();
const mockStartNew = vi.fn();
const mockSendMessage = vi.fn();

let mockState = {
  activeSessionId: 'session-123',
  isPinned: false,
  messages: [{ id: 'msg-1', sender: 'user' as const, text: 'Halo Joy' }],
};

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
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

vi.mock('expo-clipboard', () => ({
  setStringAsync: vi.fn(),
}));

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: (props: MockComponentProps) => ({ type: 'StatusBar', props }),
}));

vi.mock('@/features/chat/data/use-chat-session', () => ({
  useChatSession: () => ({
    activeSessionId: mockState.activeSessionId,
    messages: mockState.messages,
    isThinking: false,
    isSending: false,
    isTemporary: false,
    feedbackByMessageId: {},
    pinnedSessionIds: mockState.isPinned && mockState.activeSessionId ? [mockState.activeSessionId] : [],
    sendMessage: mockSendMessage,
    startNew: mockStartNew,
    setTemporary: vi.fn(),
    deleteSession: mockDeleteSession,
    dislikeMessage: vi.fn(),
    isSessionPinned: (id: string) => (id === mockState.activeSessionId ? mockState.isPinned : false),
    pinSession: mockPinSession,
    unpinSession: mockUnpinSession,
  }),
}));

vi.mock('@/features/chat/presentation/sidebar-shell', () => ({
  useSidebarShell: () => ({
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    registerActions: vi.fn(() => vi.fn()),
  }),
}));

vi.mock('@/features/chat/presentation/hooks/use-message-speech', () => ({
  useMessageSpeech: () => ({
    speakingMessageId: null,
    loadingSpeechMessageId: null,
    toggleSpeakMessage: vi.fn(),
    stopSpeech: vi.fn(),
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: vi.fn(),
  },
  KeyboardAvoidingView: (props: MockComponentProps) => ({ type: 'KeyboardAvoidingView', props }),
  Platform: {
    OS: 'ios',
    select: vi.fn((dict: Record<string, unknown>) => dict.ios ?? dict.default),
  },
  Share: {
    share: vi.fn(),
  },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  View: (props: MockComponentProps) => ({ type: 'View', props }),
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
}));

vi.mock('@/components/ui/animated-dropdown-overlay', () => ({
  AnimatedDropdownOverlay: (props: MockComponentProps) => ({
    type: 'AnimatedDropdownOverlay',
    props,
  }),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: (props: MockComponentProps) => ({
    type: 'DropdownMenu',
    props,
  }),
}));

vi.mock('@/components/ui/chat-composer', () => ({
  ChatComposer: (props: MockComponentProps) => ({ type: 'ChatComposer', props }),
}));

vi.mock('@/components/ui/bottom-white-fade-overlay', () => ({
  BottomWhiteFadeOverlay: (props: MockComponentProps) => ({
    type: 'BottomWhiteFadeOverlay',
    props,
  }),
}));

vi.mock('@/components/ui/top-white-fade-overlay', () => ({
  TopWhiteFadeOverlay: (props: MockComponentProps) => ({
    type: 'TopWhiteFadeOverlay',
    props,
  }),
}));

vi.mock('@/features/chat/presentation/main-chat-screen/components/chat-body', () => ({
  ChatBody: (props: MockComponentProps) => ({ type: 'ChatBody', props }),
}));

vi.mock('@/features/chat/presentation/main-chat-screen/components/chat-header', () => ({
  ChatHeader: (props: MockComponentProps) => ({ type: 'ChatHeader', props }),
}));


function findElement(node: unknown, predicate: (el: { type?: unknown; props?: Record<string, unknown> }) => boolean): { type?: unknown; props?: Record<string, unknown> } | null {
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

describe('MainChatScreen Dropdown Menu', () => {
  it('renders chat header and dropdown menu overlay with pin and delete options', () => {
    mockState.isPinned = false;
    const tree = MainChatScreen({});
    expect(tree).toBeDefined();

    const dropdownOverlay = findElement(tree, (el) => typeof el.type === 'function' && el.type.name === 'AnimatedDropdownOverlay');
    expect(dropdownOverlay).toBeDefined();

    const dropdownMenu = dropdownOverlay?.props?.children as {
      type?: unknown;
      props?: {
        items: {
          id: string;
          label: string;
          iconName?: string;
          isDestructive?: boolean;
          showDivider?: boolean;
          onPress: () => void;
        }[];
      };
    };
    expect(dropdownMenu).toBeDefined();
    expect(dropdownMenu.props?.items).toHaveLength(2);
    expect(dropdownMenu.props?.items[0].id).toBe('pin');
    expect(dropdownMenu.props?.items[0].label).toBe('Pin chat');
    expect(dropdownMenu.props?.items[0].iconName).toBe('pin');

    expect(dropdownMenu.props?.items[1].id).toBe('delete');
    expect(dropdownMenu.props?.items[1].label).toBe('Delete chat');
    expect(dropdownMenu.props?.items[1].iconName).toBe('trash-2');
    expect(dropdownMenu.props?.items[1].isDestructive).toBe(true);
    expect(dropdownMenu.props?.items[1].showDivider).toBe(true);
  });

  it('renders Unpin chat when session is already pinned', () => {
    mockState.isPinned = true;
    const tree = MainChatScreen({});

    const dropdownOverlay = findElement(tree, (el) => typeof el.type === 'function' && el.type.name === 'AnimatedDropdownOverlay');
    const dropdownMenu = dropdownOverlay?.props?.children as {
      props?: {
        items: {
          id: string;
          label: string;
          iconName?: string;
        }[];
      };
    };
    expect(dropdownMenu.props?.items[0].label).toBe('Unpin chat');
    expect(dropdownMenu.props?.items[0].iconName).toBe('pin-off');
  });
});
