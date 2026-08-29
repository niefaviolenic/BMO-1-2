import { describe, expect, it } from "vitest";
import { stripId3Tags } from "../src/utils/id3-stripper.js";

describe("stripId3Tags", () => {
  it("leaves clean MP3 frame buffer untouched", () => {
    const rawMp3 = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x11, 0x22, 0x33]);
    const result = stripId3Tags(rawMp3);
    expect(result).toEqual(rawMp3);
  });

  it("strips ID3v2.3/ID3v2.4 header with synchsafe integer size", () => {
    // ID3v2.4 header: ID3, version 4, revision 0, flags 0, synchsafe size 35 bytes (0x23)
    const header = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x23]);
    const payload = Buffer.alloc(35, 0xaa);
    const mp3Frames = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0xaa, 0xbb]);
    const combined = Buffer.concat([header, payload, mp3Frames]);

    expect(combined.length).toBe(10 + 35 + 6);
    const result = stripId3Tags(combined);
    expect(result).toEqual(mp3Frames);
  });

  it("strips ID3v2 tag with footer (flag 0x10 set)", () => {
    // ID3v2.4 with footer: flags = 0x10, size = 10 bytes -> total = 10 (header) + 10 (payload) + 10 (footer) = 30 bytes
    const header = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x10, 0x00, 0x00, 0x00, 0x0a]);
    const payloadAndFooter = Buffer.alloc(20, 0x55);
    const mp3Frames = Buffer.from([0xff, 0xfb, 0x11, 0x22]);
    const combined = Buffer.concat([header, payloadAndFooter, mp3Frames]);

    const result = stripId3Tags(combined);
    expect(result).toEqual(mp3Frames);
  });

  it("strips multiple consecutive ID3 tags", () => {
    const tag1Header = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05]);
    const tag1Payload = Buffer.alloc(5, 0x11);
    const tag2Header = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08]);
    const tag2Payload = Buffer.alloc(8, 0x22);
    const mp3Frames = Buffer.from([0xff, 0xf3, 0x44, 0x55]);
    const combined = Buffer.concat([tag1Header, tag1Payload, tag2Header, tag2Payload, mp3Frames]);

    const result = stripId3Tags(combined);
    expect(result).toEqual(mp3Frames);
  });

  it("strips ID3v1 128-byte footer at end of buffer", () => {
    const mp3Frames = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
    const id3v1 = Buffer.alloc(128, 0x00);
    id3v1[0] = 0x54; // 'T'
    id3v1[1] = 0x41; // 'A'
    id3v1[2] = 0x47; // 'G'
    const combined = Buffer.concat([mp3Frames, id3v1]);

    const result = stripId3Tags(combined);
    expect(result).toEqual(mp3Frames);
  });

  it("returns empty buffer when entire buffer is an incomplete/truncated ID3 tag", () => {
    const header = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00]); // 128 bytes size
    const partial = Buffer.concat([header, Buffer.alloc(20)]);
    const result = stripId3Tags(partial);
    expect(result.length).toBe(0);
  });
});
