import { describe, expect, it } from "vitest";
import { detectSpotifyIntent } from "../../src/p9/services/spotify-intent.js";

describe("detectSpotifyIntent", () => {
  it("detects play track / song query commands", () => {
    expect(detectSpotifyIntent("Joy putar lagu Bohemian Rhapsody")).toEqual({
      action: "PLAY",
      query: "bohemian rhapsody",
    });
    expect(detectSpotifyIntent("putar lagu Queen - Bohemian Rhapsody")).toEqual({
      action: "PLAY",
      query: "queen - bohemian rhapsody",
    });
    expect(detectSpotifyIntent("play coldplay yellow on spotify")).toEqual({
      action: "PLAY",
      query: "coldplay yellow",
    });
    expect(detectSpotifyIntent("setel musik indonesia raya")).toEqual({
      action: "PLAY",
      query: "indonesia raya",
    });
    expect(detectSpotifyIntent("mainkan lagu Hati-Hati di Jalan")).toEqual({
      action: "PLAY",
      query: "hati-hati di jalan",
    });
  });

  it("detects pause / stop commands", () => {
    expect(detectSpotifyIntent("pause lagu")).toEqual({ action: "PAUSE" });
    expect(detectSpotifyIntent("Joy, jeda musik")).toEqual({ action: "PAUSE" });
    expect(detectSpotifyIntent("stop spotify")).toEqual({ action: "PAUSE" });
    expect(detectSpotifyIntent("matikan musik")).toEqual({ action: "PAUSE" });
  });

  it("detects resume / continue commands", () => {
    expect(detectSpotifyIntent("lanjutkan lagu")).toEqual({ action: "RESUME" });
    expect(detectSpotifyIntent("resume musik")).toEqual({ action: "RESUME" });
    expect(detectSpotifyIntent("play lagi")).toEqual({ action: "RESUME" });
    expect(detectSpotifyIntent("putar lagu")).toEqual({ action: "RESUME" });
  });

  it("detects next / skip commands", () => {
    expect(detectSpotifyIntent("skip lagu")).toEqual({ action: "NEXT" });
    expect(detectSpotifyIntent("next song")).toEqual({ action: "NEXT" });
    expect(detectSpotifyIntent("lagu berikutnya")).toEqual({ action: "NEXT" });
    expect(detectSpotifyIntent("ganti lagu")).toEqual({ action: "NEXT" });
  });

  it("detects previous commands", () => {
    expect(detectSpotifyIntent("lagu sebelumnya")).toEqual({ action: "PREVIOUS" });
    expect(detectSpotifyIntent("previous track")).toEqual({ action: "PREVIOUS" });
    expect(detectSpotifyIntent("putar ulang lagu tadi")).toEqual({ action: "PREVIOUS" });
  });

  it("returns null for non-spotify chat messages", () => {
    expect(detectSpotifyIntent("Halo Joy, apa kabar?")).toBeNull();
    expect(detectSpotifyIntent("Siapa presiden Indonesia sekarang?")).toBeNull();
    expect(detectSpotifyIntent("Ceritakan tentang sejarah musik rock")).toBeNull();
  });
});
