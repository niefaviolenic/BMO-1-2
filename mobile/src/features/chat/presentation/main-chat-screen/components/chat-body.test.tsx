/* eslint-disable import/no-unresolved */
// @ts-ignore
import Module from 'module';
// @ts-ignore
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessage } from './chat-body';
import { ChatBody } from './chat-body';

type NodeModuleWithRequire = {
  require: (id: string) => unknown;
};

beforeAll(() => {
  const moduleProto = Module.prototype as unknown as NodeModuleWithRequire;
  const originalRequire = moduleProto.require;
  moduleProto.require = function (this: unknown, id: string): unknown {
    if (typeof id === 'string' && id.endsWith('.svg')) {
      return 'mocked-svg';
    }
    return originalRequire.call(this, id);
  };
});

const mockScrollToEnd = vi.fn();
let capturedEffects: (() => void)[] = [];
let cleanupEffects: (() => void)[] = [];
let keyboardListeners: Record<string, (() => void)[]> = {};
const mockKeyboardRemove = vi.fn();

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useRef: vi.fn((initial?: unknown) => {
      if (initial !== undefined && initial !== null) {
        return { current: initial };
      }
      return {
        current: {
          scrollToEnd: mockScrollToEnd,
        },
      };
    }),
    useCallback: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
    useEffect: vi.fn((effect: () => void | (() => void)) => {
      capturedEffects.push(effect);
      const cleanup = effect();
      if (typeof cleanup === 'function') {
        cleanupEffects.push(cleanup);
      }
    }),
  };
});

vi.mock('react-native', () => {
  const MockScrollView = (props: unknown) => ({ type: 'ScrollView', props });
  const MockPressable = (props: unknown) => ({ type: 'Pressable', props });
  const MockText = (props: unknown) => ({ type: 'Text', props });
  const MockView = (props: unknown) => ({ type: 'View', props });

  return {
    Platform: {
      OS: 'ios',
      select: vi.fn((obj: Record<string, unknown>) => obj.ios),
    },
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
      absoluteFill: {},
    },
    Keyboard: {
      dismiss: vi.fn(),
      addListener: vi.fn((event: string, callback: () => void) => {
        if (!keyboardListeners[event]) {
          keyboardListeners[event] = [];
        }
        keyboardListeners[event].push(callback);
        return {
          remove: vi.fn(() => {
            mockKeyboardRemove();
            keyboardListeners[event] = keyboardListeners[event].filter((cb) => cb !== callback);
          }),
        };
      }),
    },
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
    ScrollView: MockScrollView,
  };
});

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#171717',
    textSecondary: '#737373',
  }),
}));

vi.mock('@/features/chat/components/animated-joy-character', () => ({
  AnimatedJoyCharacter: (props: unknown) => ({ type: 'AnimatedJoyCharacter', props }),
}));

vi.mock('@/features/chat/components/joy-thinking-indicator', () => ({
  JoyThinkingIndicator: (props: unknown) => ({ type: 'JoyThinkingIndicator', props }),
}));

vi.mock('@/features/chat/components/message-action-bar', () => ({
  MessageActionBar: (props: unknown) => ({ type: 'MessageActionBar', props }),
}));

vi.mock('@/features/chat/components/prompt-suggestion-item', () => ({
  PromptSuggestionItem: (props: unknown) => ({ type: 'PromptSuggestionItem', props }),
}));

vi.mock('@/features/chat/components/temporary-chat-declaration', () => ({
  TemporaryChatDeclaration: (props: unknown) => ({ type: 'TemporaryChatDeclaration', props }),
}));

vi.mock('@/features/chat/components/user-message-bubble', () => ({
  UserMessageBubble: (props: unknown) => ({ type: 'UserMessageBubble', props }),
}));

describe('ChatBody Auto-Scroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEffects = [];
    cleanupEffects = [];
    keyboardListeners = {};
  });

  const triggerKeyboardShow = (event = 'keyboardWillShow') => {
    const listeners = keyboardListeners[event] || [];
    listeners.forEach((cb) => cb());
  };

  it('renders ScrollView with ref, onScroll, scrollEventThrottle, and onContentSizeChange', () => {
    const messages: ChatMessage[] = [
      { id: '1', sender: 'user', text: 'Hello Joy' },
    ];

    const element = ChatBody({
      messages,
      isThinking: false,
      testID: 'chat-body-test',
    });

    expect(element.props.testID).toBe('chat-body-test');
    expect(typeof element.props.onScroll).toBe('function');
    expect(element.props.scrollEventThrottle).toBe(16);
    expect(typeof element.props.onContentSizeChange).toBe('function');
  });

  it('triggers scrollToEnd on mount and when messages are present via useEffect', () => {
    const messages: ChatMessage[] = [
      { id: '1', sender: 'user', text: 'First message' },
      { id: '2', sender: 'assistant', text: 'Hello! How can I help?' },
    ];

    ChatBody({
      messages,
      isThinking: false,
    });

    expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });
  });

  it('triggers scrollToEnd on keyboard show when user is at the bottom', () => {
    const messages: ChatMessage[] = [
      { id: '1', sender: 'user', text: 'Hello' },
    ];

    ChatBody({
      messages,
      isThinking: false,
    });

    mockScrollToEnd.mockClear();

    triggerKeyboardShow('keyboardWillShow');
    expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });
  });

  it('does NOT trigger scrollToEnd on keyboard show when user has scrolled away from bottom', () => {
    const messages: ChatMessage[] = [
      { id: '1', sender: 'user', text: 'Hello' },
      { id: '2', sender: 'assistant', text: 'Hi!' },
    ];

    const element = ChatBody({
      messages,
      isThinking: false,
    });

    // Simulate scroll up (offset 100, measurement 600, contentSize 1000 => 700 < 1000 - 40)
    element.props.onScroll({
      nativeEvent: {
        layoutMeasurement: { height: 600, width: 300 },
        contentOffset: { y: 100, x: 0 },
        contentSize: { height: 1000, width: 300 },
      },
    });

    mockScrollToEnd.mockClear();

    triggerKeyboardShow('keyboardWillShow');
    expect(mockScrollToEnd).not.toHaveBeenCalled();
  });

  it('triggers scrollToEnd on onContentSizeChange only when at the bottom', () => {
    const messages: ChatMessage[] = [
      { id: '1', sender: 'user', text: 'Hello' },
    ];

    const element = ChatBody({
      messages,
      isThinking: false,
    });

    mockScrollToEnd.mockClear();

    // Initially at bottom -> should scroll
    element.props.onContentSizeChange(300, 800);
    expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });

    // Scrolled away -> should not scroll on content size change
    element.props.onScroll({
      nativeEvent: {
        layoutMeasurement: { height: 400, width: 300 },
        contentOffset: { y: 50, x: 0 },
        contentSize: { height: 1000, width: 300 },
      },
    });
    mockScrollToEnd.mockClear();

    element.props.onContentSizeChange(300, 900);
    expect(mockScrollToEnd).not.toHaveBeenCalled();
  });

  it('always scrolls to bottom when user sends a new message even if previously scrolled up', () => {
    const initialMessages: ChatMessage[] = [
      { id: '1', sender: 'assistant', text: 'Previous answer' },
    ];

    const element = ChatBody({
      messages: initialMessages,
      isThinking: false,
    });

    // User scrolled away
    element.props.onScroll({
      nativeEvent: {
        layoutMeasurement: { height: 400, width: 300 },
        contentOffset: { y: 50, x: 0 },
        contentSize: { height: 1000, width: 300 },
      },
    });

    mockScrollToEnd.mockClear();

    // User sends a new message
    const updatedMessages: ChatMessage[] = [
      { id: '1', sender: 'assistant', text: 'Previous answer' },
      { id: '2', sender: 'user', text: 'New question' },
    ];

    ChatBody({
      messages: updatedMessages,
      isThinking: false,
    });

    expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });

    // Now that isAtBottom is reset to true by user message, keyboard show should scroll
    mockScrollToEnd.mockClear();
    triggerKeyboardShow('keyboardWillShow');
    expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });
  });

  it('triggers scrollToEnd when thinking indicator is shown and at bottom', () => {
    const messages: ChatMessage[] = [
      { id: '1', sender: 'user', text: 'Explain quantum computing' },
    ];

    ChatBody({
      messages,
      isThinking: true,
    });

    expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });
  });

  it('cleans up keyboard listener on unmount', () => {
    const messages: ChatMessage[] = [
      { id: '1', sender: 'user', text: 'Hello' },
    ];

    ChatBody({
      messages,
      isThinking: false,
    });

    expect(cleanupEffects.length).toBeGreaterThan(0);
    cleanupEffects.forEach((cleanup) => cleanup());
    expect(mockKeyboardRemove).toHaveBeenCalled();
  });

  it('does not scroll or render ScrollView when there are no messages (empty state)', () => {
    const element = ChatBody({
      messages: [],
      isThinking: false,
      testID: 'chat-body-empty',
    });

    expect(element.props.testID).toBe('chat-body-empty-empty-view');
    expect(mockScrollToEnd).not.toHaveBeenCalled();
  });

  it('renders TemporaryChatDeclaration with balanced header and composer padding when isTemporaryChat is true', () => {
    const element = ChatBody({
      messages: [],
      isThinking: false,
      isTemporaryChat: true,
      headerHeight: 80,
      composerHeight: 88,
      testID: 'chat-body-temp',
    });

    expect(element.props.testID).toBe('chat-body-temp-temporary-view');
    const styleProp = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;

    expect(styleProp.paddingTop).toBe(80);
    expect(styleProp.paddingBottom).toBe(68);
    expect(styleProp.justifyContent).toBe('center');
    expect(styleProp.alignItems).toBe('center');
  });
});

