import type * as Audio from 'expo-audio';
import { requireOptionalNativeModule } from 'expo';
import type * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { synthesizeSpeech } from '@/features/chat/data/tts-api';

export type UseMessageSpeechResult = {
  speakingMessageId: string | null;
  loadingSpeechMessageId: string | null;
  toggleSpeakMessage: (messageId: string, text: string) => Promise<void>;
  stopSpeech: () => void;
  isAvailable: boolean;
};
export function isNativeModuleAvailable(moduleName: string): boolean {
  if (Platform.OS === 'web') {
    return true;
  }
  try {
    return requireOptionalNativeModule(moduleName) !== null;
  } catch {
    return false;
  }
}

let cachedExpoAudio: typeof Audio | null | undefined = undefined;

export function getExpoAudio(): typeof Audio | null {
  if (cachedExpoAudio !== undefined) {
    return cachedExpoAudio;
  }
  if (!isNativeModuleAvailable('ExpoAudio')) {
    cachedExpoAudio = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedExpoAudio = require('expo-audio') as typeof Audio;
  } catch {
    cachedExpoAudio = null;
  }
  return cachedExpoAudio;
}

export function sanitizeTextForSpeech(text: string): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 2000);
}
let cachedExpoSpeech: typeof Speech | null | undefined = undefined;

export function getExpoSpeech(): typeof Speech | null {
  if (cachedExpoSpeech !== undefined) {
    return cachedExpoSpeech;
  }
  if (!isNativeModuleAvailable('ExpoSpeech')) {
    cachedExpoSpeech = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedExpoSpeech = require('expo-speech') as typeof Speech;
  } catch {
    cachedExpoSpeech = null;
  }
  return cachedExpoSpeech;
}

export function _resetExpoModuleCache(): void {
  cachedExpoAudio = undefined;
  cachedExpoSpeech = undefined;
}

/**
 * Configures iOS & Android audio session so playback works reliably even when
 * the device is in silent/ringer-off mode on iPhone (AVAudioSessionCategoryPlayback).
 */
async function configureAudioSession(): Promise<void> {
  try {
    const audio = getExpoAudio();
    if (typeof audio?.setAudioModeAsync === 'function') {
      await audio.setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
        allowsRecording: false,
      });
    }
  } catch {
    // Ignore configuration failure in unsupported environments
  }
}

export function useMessageSpeech(): UseMessageSpeechResult {
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [loadingSpeechMessageId, setLoadingSpeechMessageId] = useState<string | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const activeAudioPlayerRef = useRef<{
    player: Audio.AudioPlayer;
    subscription?: { remove: () => void } | null;
  } | null>(null);

  // Initialize audio session mode on mount so iOS AVAudioSessionCategoryPlayback is ready
  useEffect(() => {
    void configureAudioSession();
  }, []);

  const stopSpeech = useCallback(() => {
    activeRequestIdRef.current += 1;

    // 1. Teardown active audio player
    if (activeAudioPlayerRef.current) {
      const { player, subscription } = activeAudioPlayerRef.current;
      activeAudioPlayerRef.current = null;
      try {
        subscription?.remove();
        player.pause();
        player.remove();
      } catch {
        // Ignore teardown errors
      }
    }

    // 2. Stop active client-side speech
    try {
      const speech = getExpoSpeech();
      if (typeof speech?.stop === 'function') {
        void speech.stop().catch(() => {});
      }
    } catch {
      // Ignore stop errors
    }

    setSpeakingMessageId(null);
    setLoadingSpeechMessageId(null);
  }, []);

  const toggleSpeakMessage = useCallback(
    async (messageId: string, text: string) => {
      if (speakingMessageId === messageId || loadingSpeechMessageId === messageId) {
        stopSpeech();
        return;
      }

      stopSpeech();

      const requestId = ++activeRequestIdRef.current;
      setLoadingSpeechMessageId(messageId);

      const cleanText = sanitizeTextForSpeech(text) || text.trim();
      if (!cleanText) {
        setLoadingSpeechMessageId(null);
        return;
      }

      try {
        // Helper for client-side TTS fallback with expo-speech
        const playWithSpeechFallback = async (): Promise<boolean> => {
          const speech = getExpoSpeech();
          if (typeof speech?.speak !== 'function') return false;

          await configureAudioSession();

          try {
            speech.speak(cleanText, {
              language: 'id-ID',
              volume: 1.0,
              rate: 1.0,
              pitch: 1.0,
              onStart: () => {
                if (activeRequestIdRef.current === requestId) {
                  setSpeakingMessageId(messageId);
                  setLoadingSpeechMessageId(null);
                }
              },
              onDone: () => {
                if (activeRequestIdRef.current === requestId) {
                  setSpeakingMessageId((current) => (current === messageId ? null : current));
                  setLoadingSpeechMessageId((current) => (current === messageId ? null : current));
                }
              },
              onStopped: () => {
                if (activeRequestIdRef.current === requestId) {
                  setSpeakingMessageId((current) => (current === messageId ? null : current));
                  setLoadingSpeechMessageId((current) => (current === messageId ? null : current));
                }
              },
              onError: () => {
                if (activeRequestIdRef.current === requestId) {
                  setSpeakingMessageId((current) => (current === messageId ? null : current));
                  setLoadingSpeechMessageId((current) => (current === messageId ? null : current));
                }
              },
            });
            return true;
          } catch {
            return false;
          }
        };

        // Strategy 1: Attempt server TTS + expo-audio player (with 15s timeout)
        const audio = getExpoAudio();
        if (typeof audio?.createAudioPlayer === 'function') {
          try {
            const ttsPromise = synthesizeSpeech(cleanText);
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Server TTS timeout')), 15000),
            );
            const { audioUrl } = await Promise.race([ttsPromise, timeoutPromise]);

            if (activeRequestIdRef.current !== requestId) {
              return;
            }

            await configureAudioSession();

            if (activeRequestIdRef.current !== requestId) {
              return;
            }

            const player = audio.createAudioPlayer({ uri: audioUrl });
            player.volume = 1.0;

            const subscription = player.addListener(
              'playbackStatusUpdate',
              (status: Audio.AudioStatus) => {
                const isFinished =
                  status.didJustFinish ||
                  status.playbackState === 'ended' ||
                  status.playbackState === 'failed' ||
                  status.playbackState === 'error' ||
                  Boolean(status.error);

                if (isFinished) {
                  if (activeRequestIdRef.current === requestId) {
                    setSpeakingMessageId((current) => (current === messageId ? null : current));
                    setLoadingSpeechMessageId((current) => (current === messageId ? null : current));
                  }
                  if (activeAudioPlayerRef.current?.player === player) {
                    try {
                      player.remove();
                    } catch {
                      // Ignore removal error
                    }
                    activeAudioPlayerRef.current = null;
                  }
                }
              },
            );

            activeAudioPlayerRef.current = { player, subscription };
            player.play();

            if (activeRequestIdRef.current === requestId) {
              setSpeakingMessageId(messageId);
              setLoadingSpeechMessageId(null);
            }
            return;
          } catch (error) {
            // Server TTS or audio playback failed; gracefully fall back to client-side expo-speech
            console.warn('[useMessageSpeech] Server TTS failed or timed out, falling back to expo-speech:', error);
          }
        }

        // Strategy 2: Client-side expo-speech fallback
        if (activeRequestIdRef.current === requestId) {
          const speechStarted = await playWithSpeechFallback();
          if (!speechStarted && activeRequestIdRef.current === requestId) {
            setLoadingSpeechMessageId(null);
            setSpeakingMessageId(null);
          }
        }
      } catch (error) {
        if (activeRequestIdRef.current === requestId) {
          setSpeakingMessageId(null);
          setLoadingSpeechMessageId(null);
        }
        throw error;
      }
    },
    [speakingMessageId, loadingSpeechMessageId, stopSpeech],
  );

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  const isAvailable = Boolean(getExpoAudio() || getExpoSpeech());

  return {
    speakingMessageId,
    loadingSpeechMessageId,
    toggleSpeakMessage,
    stopSpeech,
    isAvailable,
  };
}
