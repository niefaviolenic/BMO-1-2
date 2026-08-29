export interface DetectedWhatsAppIntent {
  recipient: string;
  message: string;
}

const WHATSAPP_PATTERNS = [
  // 1. kirim [pesan/chat] [lewat/di/via/pake] [whatsapp/wa] ke [si] <recipient> [dong/ya] [bilangin/bilang/isinya/katakan/pesan/:] [ke dia] [kalo/kalau/bahwa/:] <message>
  /^(?:joy[\s,]+)?(?:tolong\s+)?(?:coba\s+)?kirim(?:kan)?\s+(?:pesan\s+|chat\s+)?(?:lewat\s+|melalui\s+|via\s+|di\s+|pake\s+|pakai\s+)?(?:whatsapp|wa)\s+(?:ke|kepada)\s+(?:si\s+)?([a-zA-Z0-9_\- ]+?)(?:\s+dong|\s+ya|\s+tolong)?(?:\s+(?:bilangin|bilang|katakan|isinya|isi\s+pesan(?:nya)?|pesan|bahwa|dengan\s+pesan|ucapin|kasih\s+tahu|kasitau))(?:\s+(?:ke\s+dia|kepadanya|sama\s+dia))?(?:\s+(?:kalo|kalau|bahwa))?[\s:]+(.+)$/i,

  // 2. kirim [pesan/chat] ke [si] <recipient> [lewat/di/via wa/whatsapp] [dong/ya] [bilangin/bilang/isinya/:] <message>
  /^(?:joy[\s,]+)?(?:tolong\s+)?(?:coba\s+)?kirim(?:kan)?\s+(?:pesan\s+|chat\s+)?(?:ke|kepada)\s+(?:si\s+)?([a-zA-Z0-9_\- ]+?)\s+(?:lewat|melalui|via|di|pake|pakai)\s+(?:whatsapp|wa)(?:\s+dong|\s+ya|\s+tolong)?(?:\s+(?:bilangin|bilang|katakan|isinya|isi\s+pesan(?:nya)?|pesan|bahwa|dengan\s+pesan|ucapin|kasih\s+tahu|kasitau))?(?:\s+(?:ke\s+dia|kepadanya|sama\s+dia))?(?:\s+(?:kalo|kalau|bahwa))?[\s:]+(.+)$/i,

  // 3. chat / kirim chat ke <recipient> di [whatsapp/wa] bilang <message>
  /^(?:joy[\s,]+)?(?:tolong\s+)?(?:coba\s+)?(?:chat|kirim\s+chat)\s+(?:ke|kepada)?\s*(?:si\s+)?([a-zA-Z0-9_\- ]+?)\s+(?:lewat|melalui|via|di|pake|pakai)\s+(?:whatsapp|wa)(?:\s+dong|\s+ya|\s+tolong)?\s+(?:bilangin|bilang|katakan|isinya|isi\s+pesan(?:nya)?|pesan|bahwa|dengan\s+pesan|ucapin|kasih\s+tahu|kasitau)(?:\s+(?:ke\s+dia|kepadanya|sama\s+dia))?(?:\s+(?:kalo|kalau|bahwa))?[\s:]+(.+)$/i,

  // 4. wa / whatsapp ke [si] <recipient> [dong/ya] bilang/[:/] <message>
  /^(?:joy[\s,]+)?(?:tolong\s+)?(?:coba\s+)?(?:wa|whatsapp)\s+(?:ke|kepada)?\s*(?:si\s+)?([a-zA-Z0-9_\- ]+?)(?:\s+dong|\s+ya|\s+tolong)?\s+(?:bilangin|bilang|katakan|isinya|isi\s+pesan(?:nya)?|pesan|bahwa|dengan\s+pesan|ucapin|kasih\s+tahu|kasitau)(?:\s+(?:ke\s+dia|kepadanya|sama\s+dia))?(?:\s+(?:kalo|kalau|bahwa))?[\s:]+(.+)$/i,
  /^(?:joy[\s,]+)?(?:tolong\s+)?(?:coba\s+)?(?:wa|whatsapp)\s+(?:ke|kepada)?\s*(?:si\s+)?([a-zA-Z0-9_\- ]+?)(?:\s+dong|\s+ya|\s+tolong)?:\s*(.+)$/i,

  // 5. kirim [pesan/chat] [whatsapp/wa] ke [si] <recipient> [dong/ya] : <message>
  /^(?:joy[\s,]+)?(?:tolong\s+)?(?:coba\s+)?kirim(?:kan)?\s+(?:pesan\s+|chat\s+)?(?:whatsapp|wa)\s+(?:ke|kepada)\s+(?:si\s+)?([a-zA-Z0-9_\- ]+?)(?:\s+dong|\s+ya|\s+tolong)?[\s:]+(.+)$/i,

  // 6. English: send [a] whatsapp [message] to <recipient> saying/telling them/that/: <message>
  /^(?:joy[\s,]+)?(?:please\s+)?send\s+(?:a\s+)?whatsapp(?:\s+message|\s+text)?\s+to\s+([a-zA-Z0-9_\- ]+?)\s+(?:saying|telling\s+(?:them|him|her)|that|with\s+message)[\s:]+(.+)$/i,
  /^(?:joy[\s,]+)?(?:please\s+)?send\s+(?:a\s+)?whatsapp(?:\s+message|\s+text)?\s+to\s+([a-zA-Z0-9_\- ]+?)[\s:]+(.+)$/i,

  // 7. English: message / text / tell <recipient> on whatsapp saying/that/: <message>
  /^(?:joy[\s,]+)?(?:please\s+)?(?:message|text|tell|whatsapp)\s+([a-zA-Z0-9_\- ]+?)\s+(?:on|via|through)\s+(?:whatsapp|wa)(?:\s+(?:saying|telling\s+(?:them|him|her)|that))?[\s:]+(.+)$/i,
];

function cleanMessage(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^[\s"'`#*:]+|[\s"'`#*:]+$/g, "");
  cleaned = cleaned.replace(/^(?:kalo|kalau|bahwa|ke dia|kepadanya|sama dia|saying|that)\s+/i, "");
  cleaned = cleaned.replace(/^[\s"'`#*:]+|[\s"'`#*:]+$/g, "");
  return cleaned.trim();
}

function cleanRecipient(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^si\s+/i, "");
  cleaned = cleaned.replace(/\s+dong$/i, "");
  cleaned = cleaned.replace(/\s+ya$/i, "");
  return cleaned.trim();
}

export function detectWhatsAppIntent(text: string): DetectedWhatsAppIntent | null {
  const trimmed = text.trim();
  for (const pattern of WHATSAPP_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1] && match[2]) {
      const recipient = cleanRecipient(match[1]);
      const message = cleanMessage(match[2]);
      if (recipient && message) {
        return { recipient, message };
      }
    }
  }
  return null;
}


export function hasWhatsAppCue(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;

  const hasWhatsAppOrMessagingTerm =
    /\b(?:w+a+|w+h+a+t+s+a+p+p+|w+a+t+s+a+p+|w+a+s+a+p+|w+a+p+|chat\w*|pesan\w*|dm\w*|japri\w*|pc\w*|inbox\w*)\b/i.test(trimmed) ||
    /[wh]{1,4}[atsup]{2,}/i.test(trimmed) ||
    /\b(?:k[ir]{1,3}i?m\w*|send\w*|tulis\w*|sampaikan\w*|kabari\w*|bilang\w*|tell\w*|message\w*)\b/i.test(trimmed);

  return hasWhatsAppOrMessagingTerm;
}
