export interface DetectedScheduleIntent {
  prompt: string;
  dueAt: Date;
  frequency: "Once" | "Daily";
  exactTime: string; // "HH:mm"
  date: string;      // "YYYY-MM-DD"
  timeLabel: string;
}

export function hasScheduleCue(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;

  return (
    // Reminder / schedule / alarm action verbs & typos/elongations
    /\b(?:ingetin|ingatkan|inget\w+|ingat\w+|jadwal\w*|bangun\w*|kabari\w*|kabarin\w*|alarm\w*|remind\w*|schedule\w*|timer\w*|setel\w*|pasang\w*)\b/i.test(trimmed) ||
    // Time & date indicators & elongations (e.g. jam, jamm, menit, meenit, besoook, lusa, pagi, pagiii, sore, malam)
    /\b(?:jam\w*|menit\w*|detik\w*|besok\w*|besook\w*|lusa\w*|pagi\w*|siang\w*|sore\w*|malam\w*|subuh\w*|nanti\w*|lagi\w*|hour\w*|minute\w*|tomorrow\w*|tonight\w*)\b/i.test(trimmed) ||
    // Clock time patterns (e.g. 08:30, 8.30)
    /\b\d{1,2}[.:]\d{2}\b/.test(trimmed) ||
    // Digits followed by relative duration (e.g. 1m, 2 jam, 5menit)
    /\b\d+\s*(?:m\w*|j\w*|s\w*|menit\w*|jam\w*|detik\w*|lagi\w*)\b/i.test(trimmed)
  );
}
