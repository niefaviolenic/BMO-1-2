export type DetectedSpotifyIntent =
  | { action: "PLAY"; query: string }
  | { action: "RESUME" }
  | { action: "PAUSE" }
  | { action: "NEXT" }
  | { action: "PREVIOUS" }
  | null;

export function detectSpotifyIntent(text: string): DetectedSpotifyIntent {
  const normalized = text.trim().toLowerCase();

  // Next / Skip patterns
  if (
    /^(?:joy[\s,]+)?(?:skip|next|ganti|lewatkan|lewati)\s+(?:lagu|musik|song|track)?\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?(?:lagu|musik|song|track)\s+(?:selanjutnya|berikutnya|next)\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?(?:next|skip)\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?(?:putar|mainkan)\s+(?:lagu|musik)?\s*(?:berikutnya|selanjutnya)\s*$/i.test(normalized)
  ) {
    return { action: "NEXT" };
  }

  // Previous / Back patterns
  if (
    /^(?:joy[\s,]+)?(?:previous|prev|kembali|ulang)\s+(?:lagu|musik|song|track)?\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?(?:lagu|musik|song|track)\s+(?:sebelumnya|kemarin|tadi)\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?(?:previous|prev)\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?(?:putar|mainkan)?\s*(?:ulang\s+)?(?:lagu|musik)?\s*(?:sebelumnya|tadi)\s*$/i.test(normalized)
  ) {
    return { action: "PREVIOUS" };
  }

  // Pause / Stop playback patterns
  if (
    /^(?:joy[\s,]+)?(?:pause|jeda|stop|berhenti|hentikan|matiin|matikan)\s+(?:lagu|musik|spotify|lagunya|pemutaran)?\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?(?:pause|jeda|stop)\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?(?:pause|stop)\s+(?:the\s+)?(?:music|song|playback|spotify)\s*$/i.test(normalized)
  ) {
    return { action: "PAUSE" };
  }

  // Resume / Continue playback patterns
  if (
    /^(?:joy[\s,]+)?(?:resume|lanjutkan|terus|mainkan lagi|play lagi)\s+(?:lagu|musik|spotify|lagunya|pemutaran)?\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?(?:lanjutkan|resume)\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?(?:resume|continue)\s+(?:the\s+)?(?:music|song|playback|spotify)\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?play\s+(?:the\s+)?(?:music|playback|spotify)\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?(?:putar|mainkan|play)\s+(?:lagunya|lagu|musik)\s*$/i.test(normalized) ||
    /^(?:joy[\s,]+)?play\s+lagi\s*$/i.test(normalized)
  ) {
    return { action: "RESUME" };
  }

  // Play specific track / artist / query patterns
  const playPatterns = [
    /^(?:joy[\s,]+)?(?:tolong\s+)?(?:putar(?:kan)?|setel(?:kan)?|mainkan|play)\s+(?:lagu|musik|song|track|lagunya|musik dari|lagu dari|album)?\s*[:\-]?\s*(.+?)(?:\s+(?:di|pada|pake|pakai|in|on|lewat)\s+spotify)?$/i,
    /^(?:joy[\s,]+)?(?:play|listen to)\s+(.+?)(?:\s+on\s+spotify)?$/i,
  ];

  for (const pattern of playPatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      let query = match[1].trim();
      query = query.replace(/\s+(?:di|pada|pake|pakai|in|on|lewat)\s+spotify$/i, "").trim();
      if (
        !query ||
        query === "lagu" ||
        query === "musik" ||
        query === "lagunya" ||
        query === "music" ||
        query === "song" ||
        query === "spotify" ||
        query === "lagi"
      ) {
        return { action: "RESUME" };
      }
      return { action: "PLAY", query };
    }
  }

  return null;
}
