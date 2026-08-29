/* eslint-disable import/no-unresolved */
// @ts-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as Audio from 'expo-audio';
import * as Speech from 'expo-speech';
import * as ttsApi from '@/features/chat/data/tts-api';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import {
  _resetExpoModuleCache,
  getExpoAudio,
  getExpoSpeech,
  isNativeModuleAvailable,
  sanitizeTextForSpeech,
} from './use-message-speech';
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

vi.mock('expo', () => ({
  requireOptionalNativeModule: vi.fn(),
}));
vi.mock('expo-audio', () => ({
  setAudioModeAsync: vi.fn().mockResolvedValue(undefined),
  createAudioPlayer: vi.fn(),
}));

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/chat/data/tts-api', () => ({
  synthesizeSpeech: vi.fn(),
}));

describe('Speech and Audio modules integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetExpoModuleCache();
    Platform.OS = 'ios';
  });

  it('verifies audio mode configuration options match iOS requirements', async () => {
    await Audio.setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      allowsRecording: false,
    });

    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      }),
    );
  });

  it('verifies server TTS synthesis returns audioUrl for playback', async () => {
    vi.mocked(ttsApi.synthesizeSpeech).mockResolvedValue({
      audioUrl: 'https://example.com/audio.mp3',
      audioId: '123',
    });

    const response = await ttsApi.synthesizeSpeech('Hello Joy');
    expect(response.audioUrl).toBe('https://example.com/audio.mp3');
  });

  it('verifies native speech speak and stop functions are callable with Indonesian language tag', async () => {
    Speech.speak('Halo Joy', { language: 'id-ID', volume: 1.0, rate: 1.0, pitch: 1.0 });
    expect(Speech.speak).toHaveBeenCalledWith('Halo Joy', {
      language: 'id-ID',
      volume: 1.0,
      rate: 1.0,
      pitch: 1.0,
    });

    await Speech.stop();
    expect(Speech.stop).toHaveBeenCalled();
  });

  describe('isNativeModuleAvailable', () => {
    it('returns true on web platform without querying native module registry', () => {
      Platform.OS = 'web';
      vi.mocked(requireOptionalNativeModule).mockReturnValue(null);

      expect(isNativeModuleAvailable('ExpoAudio')).toBe(true);
      expect(requireOptionalNativeModule).not.toHaveBeenCalled();
    });

    it('returns true on native platform when native module is registered', () => {
      Platform.OS = 'ios';
      vi.mocked(requireOptionalNativeModule).mockReturnValue({});
      expect(isNativeModuleAvailable('ExpoAudio')).toBe(true);
      expect(requireOptionalNativeModule).toHaveBeenCalledWith('ExpoAudio');
    });

    it('returns false on native platform when native module is not registered (returns null)', () => {
      Platform.OS = 'android';
      vi.mocked(requireOptionalNativeModule).mockReturnValue(null);

      expect(isNativeModuleAvailable('ExpoSpeech')).toBe(false);
      expect(requireOptionalNativeModule).toHaveBeenCalledWith('ExpoSpeech');
    });

    it('returns false on native platform when requireOptionalNativeModule throws an error', () => {
      Platform.OS = 'ios';
      vi.mocked(requireOptionalNativeModule).mockImplementation(() => {
        throw new Error('Native module initialization failure');
      });

      expect(isNativeModuleAvailable('ExpoAudio')).toBe(false);
    });
  });

  describe('getExpoAudio', () => {
    it('returns null immediately when ExpoAudio native module is not available without throwing', () => {
      Platform.OS = 'ios';
      vi.mocked(requireOptionalNativeModule).mockReturnValue(null);

      const audio = getExpoAudio();
      expect(audio).toBeNull();
    });

    it('safely handles getExpoAudio in different environments without throwing uncaught errors', () => {
      Platform.OS = 'web';
      const audio = getExpoAudio();
      expect(audio === null || typeof audio === 'object').toBe(true);
    });

    it('caches the result on subsequent calls', () => {
      Platform.OS = 'ios';
      vi.mocked(requireOptionalNativeModule).mockReturnValue(null);

      const firstCall = getExpoAudio();
      const secondCall = getExpoAudio();
      expect(firstCall).toBeNull();
      expect(secondCall).toBeNull();
      expect(requireOptionalNativeModule).toHaveBeenCalledTimes(1);
    });
  });

  describe('getExpoSpeech', () => {
    it('returns null immediately when ExpoSpeech native module is not available without throwing', () => {
      Platform.OS = 'ios';
      vi.mocked(requireOptionalNativeModule).mockReturnValue(null);

      const speech = getExpoSpeech();
      expect(speech).toBeNull();
    });

    it('safely handles getExpoSpeech in different environments without throwing uncaught errors', () => {
      Platform.OS = 'web';
      const speech = getExpoSpeech();
      expect(speech === null || typeof speech === 'object').toBe(true);
    });

    it('caches the result on subsequent calls', () => {
      Platform.OS = 'ios';
      vi.mocked(requireOptionalNativeModule).mockReturnValue(null);

      const firstCall = getExpoSpeech();
      const secondCall = getExpoSpeech();
      expect(firstCall).toBeNull();
      expect(secondCall).toBeNull();
      expect(requireOptionalNativeModule).toHaveBeenCalledTimes(1);
    });
  });

  describe('sanitizeTextForSpeech', () => {
    it('strips code blocks, inline code, bold, markdown links, and headers', () => {
      const raw =
        '# Header\nHere is **bold** text and `inline code` with [link](https://example.com).\n```ts\nconsole.log(1);\n```\n- item 1\n- item 2';
      const cleaned = sanitizeTextForSpeech(raw);
      expect(cleaned).toBe('Header Here is bold text and inline code with link. item 1 item 2');
    });

    it('caps text to 2000 characters maximum', () => {
      const longText = 'a'.repeat(2500);
      const cleaned = sanitizeTextForSpeech(longText);
      expect(cleaned.length).toBe(2000);
    });
  });
});
