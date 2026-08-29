import { API_CONFIG, API_ORIGIN, apiRequest } from '@/lib/api';

export type SynthesizeSpeechResponse = {
  audioUrl: string;
  audioId: string;
};

type RawTtsPayload = {
  audioUrl?: string;
  audio_url?: string;
  audioId?: string;
  audio_id?: string;
  data?: {
    audioUrl?: string;
    audio_url?: string;
    audioId?: string;
    audio_id?: string;
  };
};

function normalizeAudioUrl(rawUrl: string): string {
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('file://')) {
    return rawUrl;
  }
  const base = (API_CONFIG.ORIGIN || API_ORIGIN).replace(/\/$/, '');
  const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return `${base}${path}`;
}

export async function synthesizeSpeech(text: string): Promise<SynthesizeSpeechResponse> {
  const response = await apiRequest<RawTtsPayload>('/tts/synthesize', {
    method: 'POST',
    body: { text },
    auth: true,
  });

  const rawUrl =
    response.audioUrl ??
    response.audio_url ??
    response.data?.audioUrl ??
    response.data?.audio_url ??
    '';

  const audioId =
    response.audioId ??
    response.audio_id ??
    response.data?.audioId ??
    response.data?.audio_id ??
    '';

  if (!rawUrl) {
    throw new Error('TTS response missing audio URL');
  }

  return {
    audioUrl: normalizeAudioUrl(rawUrl),
    audioId,
  };
}
