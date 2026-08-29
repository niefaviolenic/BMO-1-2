import { useCallback, useEffect, useRef } from 'react';
import { AnimatedJoyCharacter } from '@/features/chat/components/animated-joy-character';
import { JoyThinkingIndicator } from '@/features/chat/components/joy-thinking-indicator';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { MessageActionBar } from '@/features/chat/components/message-action-bar';
import { PromptSuggestionItem } from '@/features/chat/components/prompt-suggestion-item';
import { TemporaryChatDeclaration } from '@/features/chat/components/temporary-chat-declaration';
import { UserMessageBubble } from '@/features/chat/components/user-message-bubble';
export type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sourceDeviceId?: string | null;
};

export type ChatBodyProps = {
  messages?: ChatMessage[];
  isThinking?: boolean;
  isTemporaryChat?: boolean;
  dislikedMessageIds?: ReadonlySet<string>;
  speakingMessageId?: string | null;
  loadingSpeechMessageId?: string | null;
  onCopyMessage?: (message: ChatMessage) => void;
  onSpeakMessage?: (message: ChatMessage) => void;
  onShareMessage?: (message: ChatMessage) => void;
  onThumbsDownMessage?: (message: ChatMessage) => void;
  onPromptSelect?: (prompt: string) => void;
  headerHeight?: number;
  composerHeight?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ChatBody({
  messages = [],
  isThinking = false,
  isTemporaryChat = false,
  dislikedMessageIds,
  speakingMessageId,
  loadingSpeechMessageId,
  onCopyMessage,
  onSpeakMessage,
  onShareMessage,
  onThumbsDownMessage,
  onPromptSelect,
  headerHeight = 0,
  composerHeight = 0,
  style,
  testID = 'chat-body',
}: ChatBodyProps) {
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const isAtBottomRef = useRef(true);
  const hasMessages = messages.length > 0;
  const lastMessage = messages[messages.length - 1];
  const showThinking = isThinking && lastMessage?.sender !== 'assistant';

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const threshold = 40;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
    isAtBottomRef.current = isBottom;
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (isAtBottomRef.current) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      if (isAtBottomRef.current) {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!hasMessages) return;
    if (lastMessage?.sender === 'user') {
      isAtBottomRef.current = true;
      scrollViewRef.current?.scrollToEnd({ animated: true });
    } else if (isAtBottomRef.current) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length, showThinking, hasMessages, lastMessage?.sender]);
  if (hasMessages) {
    return (
      <ScrollView
        ref={scrollViewRef}
        style={[styles.container, style]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + 16, paddingBottom: composerHeight + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={handleContentSizeChange}
        testID={testID}
      >
        {messages.map((msg, index) => {
          if (msg.sender === 'user') {
            return (
              <View key={msg.id} style={styles.userBubbleWrapper}>
                <UserMessageBubble
                  message={msg.text}
                  sourceDeviceId={msg.sourceDeviceId}
                  testID={`${testID}-user-msg-${index}`}
                />
              </View>
            );
          }

          return (
            <View key={msg.id} style={styles.assistantResponseWrapper}>
              <Text style={[styles.assistantText, { color: theme.text }]} testID={`${testID}-assistant-text-${index}`}>
                {msg.text}
              </Text>
              <MessageActionBar
                onCopy={() => onCopyMessage?.(msg)}
                onSpeak={() => onSpeakMessage?.(msg)}
                onShare={() => onShareMessage?.(msg)}
                onThumbsDown={() => onThumbsDownMessage?.(msg)}
                thumbsDownSelected={dislikedMessageIds?.has(msg.id) === true}
                isSpeaking={speakingMessageId === msg.id}
                isLoadingSpeech={loadingSpeechMessageId === msg.id}
                testID={`${testID}-action-bar-${index}`}
              />
            </View>
          );
        })}
        {showThinking ? (
          <View style={styles.assistantResponseWrapper} testID={`${testID}-thinking`}>
            <JoyThinkingIndicator testID={`${testID}-thinking-indicator`} />
          </View>
        ) : null}
      </ScrollView>
    );
  }

  if (isTemporaryChat) {
    const bottomOffset = composerHeight > 68 ? 68 : composerHeight;
    return (
      <Pressable
        style={[
          styles.emptyContainer,
          styles.temporaryContainer,
          {
            paddingTop: headerHeight,
            paddingBottom: bottomOffset,
          },
          style,
        ]}
        onPress={Keyboard.dismiss}
        accessible={false}
        testID={`${testID}-temporary-view`}
      >
        <TemporaryChatDeclaration testID={`${testID}-temp-declaration`} />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[
        styles.emptyContainer,
        { paddingBottom: Math.max(composerHeight - 4, 16) },
        style,
      ]}
      onPress={Keyboard.dismiss}
      accessible={false}
      testID={`${testID}-empty-view`}
    >
      {/* Center Character Spacer & Avatar */}
      <View style={styles.centerHero} pointerEvents="none">
        <View style={styles.joyAvatarWrapper} testID={`${testID}-joy-character`}>
          <AnimatedJoyCharacter size={72} testID={`${testID}-joy-character`} />
        </View>
      </View>

      {/* Prompts at bottom above composer */}
      <View style={styles.promptsContainer} testID={`${testID}-prompts-container`}>
        <PromptSuggestionItem
          label="Brainstorm ideas"
          icon={require('@/assets/images/chat/sparkle-icon.svg')}
          onPress={() => onPromptSelect?.('Brainstorm ideas')}
          testID={`${testID}-prompt-brainstorm`}
        />
        <PromptSuggestionItem
          label="Explain a concept"
          icon={require('@/assets/images/chat/icon-book-open.svg')}
          onPress={() => onPromptSelect?.('Explain a concept')}
          testID={`${testID}-prompt-explain`}
        />
        <PromptSuggestionItem
          label="Look something up"
          icon={require('@/assets/images/chat/icon-globe.svg')}
          onPress={() => onPromptSelect?.('Look something up')}
          testID={`${testID}-prompt-lookup`}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingVertical: 16,
    gap: 16,
  },
 emptyContainer: {
   flex: 1,
   width: '100%',
   justifyContent: 'flex-end',
   paddingBottom: 16,
   position: 'relative',
 },
 temporaryContainer: {
   justifyContent: 'center',
   alignItems: 'center',
   paddingBottom: 0,
 },
 centerHero: {
   ...StyleSheet.absoluteFill,
   justifyContent: 'center',
   alignItems: 'center',
 },
  joyAvatarWrapper: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joyAvatar: {
    width: 72,
    height: 72,
  },
  promptsContainer: {
    gap: 4,
    width: '100%',
  },
  userBubbleWrapper: {
    alignSelf: 'flex-end',
    marginVertical: 4,
    maxWidth: '85%',
  },
  assistantResponseWrapper: {
    marginVertical: 8,
    gap: 8,
    width: '100%',
  },
  assistantText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: '#171717',
  },
});
