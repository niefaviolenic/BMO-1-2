/**
 * Strips ID3v2 metadata header (and optional ID3v1 footer) from an MP3 buffer.
 * Ensures the buffer contains only pure, raw MP3 frames so that concatenating
 * chunks into a single stream does not inject unexpected ID3 tags at chunk boundaries.
 */
export function stripId3Tags(buffer: Buffer): Buffer {
  let offset = 0;
  while (offset + 10 <= buffer.length) {
    if (
      buffer[offset] === 0x49 && // 'I'
      buffer[offset + 1] === 0x44 && // 'D'
      buffer[offset + 2] === 0x33 // '3'
    ) {
      const flags = buffer[offset + 5] ?? 0;
      const size =
        (((buffer[offset + 6] ?? 0) & 0x7f) << 21) |
        (((buffer[offset + 7] ?? 0) & 0x7f) << 14) |
        (((buffer[offset + 8] ?? 0) & 0x7f) << 7) |
        ((buffer[offset + 9] ?? 0) & 0x7f);
      const hasFooter = (flags & 0x10) !== 0;
      const tagTotal = 10 + size + (hasFooter ? 10 : 0);
      if (offset + tagTotal > buffer.length) {
        return Buffer.alloc(0);
      }
      offset += tagTotal;
    } else {
      break;
    }
  }

  let end = buffer.length;
  if (
    end - offset >= 128 &&
    buffer[end - 128] === 0x54 && // 'T'
    buffer[end - 127] === 0x41 && // 'A'
    buffer[end - 126] === 0x47 // 'G'
  ) {
    end -= 128;
  }

  return offset > 0 || end < buffer.length ? buffer.subarray(offset, end) : buffer;
}
