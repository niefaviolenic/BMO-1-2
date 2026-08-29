import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SidebarTokens } from '@/constants/theme';
import { AnimatedDropdownOverlay } from '@/components/ui/animated-dropdown-overlay';
import { ChatComposer } from '@/components/ui/chat-composer';
import { BottomWhiteFadeOverlay } from '@/components/ui/bottom-white-fade-overlay';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { TopWhiteFadeOverlay } from '@/components/ui/top-white-fade-overlay';
import { useChatSession } from '@/features/chat/data/use-chat-session';
import { ChatBody } from '@/features/chat/presentation/main-chat-screen/components/chat-body';
import { ChatHeader } from '@/features/chat/presentation/main-chat-screen/components/chat-header';
import { useSidebarShell } from '@/features/chat/presentation/sidebar-shell';
import { useMessageSpeech } from '@/features/chat/presentation/hooks/use-message-speech';
export type MainChatScreenProps = {
  initialTemporary?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function MainChatScreen({
  initialTemporary = false,
  style,
  testID = 'main-chat-screen',
}: MainChatScreenProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { open, close, registerActions, isOpen } = useSidebarShell();
  const {
    activeSessionId,
    messages,
    isThinking,
    isSending,
    isTemporary: isTemporaryChat,
    feedbackByMessageId,
    pinnedSessionIds,
    sendMessage,
    startNew,
    setTemporary,
    deleteSession,
    dislikeMessage,
    pinSession,
    unpinSession,
  } = useChatSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const {
    speakingMessageId,
    loadingSpeechMessageId,
    toggleSpeakMessage,
    stopSpeech,
  } = useMessageSpeech();
  const [inputValue, setInputValue] = useState<string>('');
  useFocusEffect(
    useCallback(() => {
      return registerActions(
        {
          onNewChat: () => {
            startNew(false);
            close();
          },
        },
        'chat'
      );
    }, [registerActions, close, startNew])
  );

  const handleSendMessage = useCallback(
    (textToSend?: string) => {
      const text = (textToSend ?? inputValue).trim();
      if (!text || isThinking || isSending) return;

      setInputValue('');
      void sendMessage(text).catch(() => {
        setInputValue((current) => current || text);
      });
    },
    [inputValue, isSending, isThinking, sendMessage]
  );

  const handlePromptSelect = useCallback(
    (promptText: string) => {
      handleSendMessage(promptText);
    },
    [handleSendMessage]
  );

  const handleClearMessages = useCallback(() => {
    stopSpeech();
    startNew(false);
  }, [startNew, stopSpeech]);

  const handleToggleTemporaryChat = useCallback(() => {
    setTemporary(!isTemporaryChat);
  }, [isTemporaryChat, setTemporary]);
  useEffect(() => {
    if (messages.length === 0) {
      setIsDropdownOpen(false);
    }
  }, [messages.length]);

  const isPinned = Boolean(activeSessionId && pinnedSessionIds.includes(activeSessionId));
  const handleTogglePin = useCallback(() => {
    setIsDropdownOpen(false);
    if (!activeSessionId) return;
    if (isPinned) {
      void unpinSession(activeSessionId);
    } else {
      void pinSession(activeSessionId);
    }
  }, [activeSessionId, isPinned, pinSession, unpinSession]);

  const handleDeleteChat = useCallback(() => {
    setIsDropdownOpen(false);
    Alert.alert(
      'Delete chat',
      'Are you sure you want to delete this chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (activeSessionId) {
              void deleteSession(activeSessionId);
            } else {
              handleClearMessages();
            }
          },
        },
      ],
    );
  }, [activeSessionId, deleteSession, handleClearMessages]);

  const dropdownMenuItems: DropdownMenuItem[] = useMemo(
    () => [
      {
        id: 'pin',
        label: isPinned ? 'Unpin chat' : 'Pin chat',
        iconName: isPinned ? 'pin-off' : 'pin',
        onPress: handleTogglePin,
      },
      {
        id: 'delete',
        label: 'Delete chat',
        iconName: 'trash-2',
        isDestructive: true,
        showDivider: true,
        onPress: handleDeleteChat,
      },
    ],
    [handleDeleteChat, handleTogglePin, isPinned],
  );
  const dislikedMessageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [messageId, rating] of Object.entries(feedbackByMessageId)) {
      if (rating === 'negative') {
        ids.add(messageId);
      }
    }
    return ids;
  }, [feedbackByMessageId]);

  const handleCopyMessage = useCallback(async (message: { text: string }) => {
    try {
      await Clipboard.setStringAsync(message.text);
    } catch {
      Alert.alert('Unable to copy', 'Try again.');
    }
  }, []);

  const handleShareMessage = useCallback(async (message: { text: string }) => {
    try {
      await Share.share({ message: message.text });
    } catch {
      Alert.alert('Unable to share', 'Try again.');
    }
  }, []);

  const handleThumbsDownMessage = useCallback(
    (message: { id: string }) => {
      void dislikeMessage(message.id).catch(() => {
        Alert.alert('Unable to send feedback', 'Try again.');
      });
    },
    [dislikeMessage],
  );

  const handleSpeakMessage = useCallback(
    (message: { id: string; text: string }) => {
      void toggleSpeakMessage(message.id, message.text).catch(() => {
        Alert.alert('Unable to play audio', 'Try again.');
      });
    },
    [toggleSpeakMessage],
  );

  const paddingTop = Math.max(insets.top, 20);
  const paddingBottom = Math.max(insets.bottom, 20);
  const composerHeight = 68 + paddingBottom;

  return (
    <View style={[styles.screen, style]} testID={testID}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.mainLayout, { paddingBottom }]}>
          <ChatBody
            messages={messages}
            isThinking={isThinking}
            isTemporaryChat={isTemporaryChat}
            dislikedMessageIds={dislikedMessageIds}
            speakingMessageId={speakingMessageId}
            loadingSpeechMessageId={loadingSpeechMessageId}
            onCopyMessage={handleCopyMessage}
            onSpeakMessage={handleSpeakMessage}
            onShareMessage={handleShareMessage}
            onThumbsDownMessage={handleThumbsDownMessage}
            onPromptSelect={handlePromptSelect}
            headerHeight={paddingTop + 56}
            composerHeight={composerHeight}
            testID={`${testID}-body`}
          />

          <TopWhiteFadeOverlay
            height={paddingTop + 76}
            color={isOpen && colorScheme === 'dark' ? SidebarTokens.colors.dark.surface : undefined}
            testID={`${testID}-top-fade-overlay`}
          />

          <View style={[styles.headerOverlay, { paddingTop }]} pointerEvents="box-none">
            <ChatHeader
              title="Chat"
              isTemporaryChat={isTemporaryChat}
              hasMessages={messages.length > 0}
              onMenuPress={open}
              onTemporaryChatPress={handleToggleTemporaryChat}
              onEditPress={handleClearMessages}
              onMorePress={() => {
                setIsDropdownOpen((prev) => !prev);
              }}
              testID={`${testID}-header`}
            />
          </View>
          <AnimatedDropdownOverlay
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            backdropStyle={styles.dropdownBackdrop}
            containerStyle={[
              styles.dropdownWrapper,
              {
                top: paddingTop + 56 + 6,
                right: 20,
              },
            ]}
            testID={`${testID}-dropdown-overlay`}
          >
            <DropdownMenu items={dropdownMenuItems} testID={`${testID}-dropdown-menu`} />
          </AnimatedDropdownOverlay>


          <BottomWhiteFadeOverlay
            height={composerHeight}
            color={isOpen && colorScheme === 'dark' ? SidebarTokens.colors.dark.surface : undefined}
            testID={`${testID}-bottom-fade-overlay`}
          />

          <View style={[styles.composerOverlay, { paddingBottom }]} pointerEvents="box-none">
            <ChatComposer
              value={inputValue}
              onChangeText={setInputValue}
              onSubmit={() => handleSendMessage()}
              placeholder="Ask Joy"
              sendDisabled={isThinking || isSending}
              testID={`${testID}-composer`}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardContainer: {
    flex: 1,
  },
  mainLayout: {
    flex: 1,
    paddingHorizontal: 20,
    position: 'relative',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  dropdownBackdrop: {
    backgroundColor: 'transparent',
  },
  dropdownWrapper: {
    position: 'absolute',
    right: 20,
    padding: 0,
    zIndex: 1000,
  },
  composerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    zIndex: 10,
    paddingTop: 12,
  },
});
