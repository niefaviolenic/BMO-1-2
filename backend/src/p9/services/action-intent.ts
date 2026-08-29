import { detectSpotifyIntent, type DetectedSpotifyIntent } from "./spotify-intent.js";
import { detectWhatsAppIntent, type DetectedWhatsAppIntent } from "./whatsapp-intent.js";
import type { DetectedScheduleIntent } from "./schedule-intent.js";

export type UnifiedActionIntent =
  | {
      action: "SEND_WHATSAPP";
      recipient: string;
      message: string;
    }
  | {
      action: "SPOTIFY_CONTROL";
      subAction: "PLAY" | "PAUSE" | "RESUME" | "NEXT" | "PREVIOUS";
      query?: string;
    }
  | {
      action: "CREATE_SCHEDULE";
      prompt: string;
      dueAt: Date;
      exactTime: string;
      date: string;
      frequency: "Once" | "Daily";
      timeLabel: string;
    }
  | {
      action: "NONE";
    };

export function hasActionCue(text: string, contacts?: Array<{ name: string }>): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;

  // Contact name match for WhatsApp
  if (contacts && Array.isArray(contacts) && contacts.length > 0) {
    const lower = trimmed.toLowerCase();
    const matchesContact = contacts.some((c) => {
      const name = c.name?.trim().toLowerCase();
      return name && name.length >= 3 && lower.includes(name);
    });
    if (matchesContact) return true;
  }

  return (
    // WhatsApp cues (slang, typos, verbs, abbreviations)
    /\b(?:w+a+|w+h+a+t+s+a+p+p+|w+a+t+s+a+p+|w+a+s+a+p+|w+a+p+|chat\w*|pesan\w*|dm\w*|japri\w*|pc\w*|inbox\w*|blg\w*|krm\w*|kirim\w*|hubungi\w*|kabari\w*|info\w*|kasih\s+tau\w*|bilang\w*|katakan\w*|salam\w*|sampaikan\w*|titip\w*)\b/i.test(
      trimmed,
    ) ||
    /\b(?:w+h*a+t+s+a+p+\w*|w+a+t+s+a+p+\w*|w+a+s+a+p+\w*|w+h+a+t+s+u+p+\w*)\b/i.test(trimmed) ||
    /\b[wh]{2,}[atsup]{3,}\b/i.test(trimmed) ||
    // Spotify cues (verbs, controls, media words, connectors, artist cues)
    /\b(?:skip\w*|next\w*|ganti\w*|lewat\w*|prev\w*|previous\w*|kembali\w*|ulang\w*|pause\w*|jeda\w*|stop\w*|berhenti\w*|matiin\w*|matikan\w*|play\w*|putar\w*|puter\w*|setel\w*|mainkan\w*|dengerin\w*|dengar\w*|listen\w*|lagu\w*|musik\w*|song\w*|track\w*|album\w*|artist\w*|playlist\w*|spotify\w*|sound\w*|audio\w*|d+a+r+i+|by|feat|ft)\b/i.test(
      trimmed,
    ) ||
    // Schedule cues (reminder/alarm verbs, time/date words, relative time, clock time)
    /\b(?:inget\w*|ingat\w*|jadwal\w*|bangun\w*|alarm\w*|remind\w*|schedule\w*|timer\w*|pasang\w*)\b/i.test(
      trimmed,
    ) ||
    /\b(?:jam\w*|menit\w*|detik\w*|besok\w*|besook\w*|lusa\w*|pagi\w*|siang\w*|sore\w*|malam\w*|subuh\w*|nanti\w*|hour\w*|minute\w*|second\w*)\b/i.test(
      trimmed,
    ) ||
    /\b\d{1,2}[.:]\d{2}\b/.test(trimmed) ||
    /\b\d+\s*(?:m\w*|j\w*|s\w*|menit\w*|jam\w*|detik\w*|lagi\w*)\b/i.test(trimmed)
  );
}

export function detectFastPathActionIntent(text: string): UnifiedActionIntent | null {
  const trimmed = text.trim();
  if (trimmed.length < 2) return null;

  // 1. WhatsApp fast-path regex check
  const whatsAppIntent = detectWhatsAppIntent(trimmed);
  if (whatsAppIntent && whatsAppIntent.recipient && whatsAppIntent.message) {
    return {
      action: "SEND_WHATSAPP",
      recipient: whatsAppIntent.recipient,
      message: whatsAppIntent.message,
    };
  }

  // 2. Spotify fast-path regex check
  const spotifyIntent = detectSpotifyIntent(trimmed);
  if (spotifyIntent) {
    if (spotifyIntent.action === "PLAY") {
      return {
        action: "SPOTIFY_CONTROL",
        subAction: "PLAY",
        query: spotifyIntent.query,
      };
    }
    if (
      spotifyIntent.action === "PAUSE" ||
      spotifyIntent.action === "RESUME" ||
      spotifyIntent.action === "NEXT" ||
      spotifyIntent.action === "PREVIOUS"
    ) {
      return {
        action: "SPOTIFY_CONTROL",
        subAction: spotifyIntent.action,
      };
    }
  }

  return null;
}
