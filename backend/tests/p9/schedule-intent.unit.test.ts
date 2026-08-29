import { describe, expect, it } from "vitest";
import { hasScheduleCue } from "../../src/p9/services/schedule-intent.js";

describe("hasScheduleCue", () => {
  it("identifies reminder and alarm action keywords and typos", () => {
    expect(hasScheduleCue("ingetin saya besok")).toBe(true);
    expect(hasScheduleCue("ingatkan untuk minum obat")).toBe(true);
    expect(hasScheduleCue("inget ya nanti beli susu")).toBe(true);
    expect(hasScheduleCue("jadwalkan meeting penting")).toBe(true);
    expect(hasScheduleCue("bangunin saya jam 5 subuh")).toBe(true);
    expect(hasScheduleCue("kabarin kalau sudah sampai")).toBe(true);
    expect(hasScheduleCue("kabari aku nanti sore")).toBe(true);
    expect(hasScheduleCue("setel alarm untuk besok")).toBe(true);
    expect(hasScheduleCue("pasang jadwal kerja")).toBe(true);
    expect(hasScheduleCue("remind me to call mom")).toBe(true);
    expect(hasScheduleCue("schedule a sync")).toBe(true);
    expect(hasScheduleCue("timer 5 menit")).toBe(true);
  });

  it("identifies time and duration indicators and relative terms", () => {
    expect(hasScheduleCue("besok pagi jam 7")).toBe(true);
    expect(hasScheduleCue("besook bangun pagi")).toBe(true);
    expect(hasScheduleCue("lusa ada acara")).toBe(true);
    expect(hasScheduleCue("nanti malam ada live")).toBe(true);
    expect(hasScheduleCue("nanti sore makan es krim")).toBe(true);
    expect(hasScheduleCue("3 jam lagi mulai")).toBe(true);
    expect(hasScheduleCue("5 menit lagi berangkat")).toBe(true);
    expect(hasScheduleCue("1mmenit lagi minum obat")).toBe(true);
    expect(hasScheduleCue("30 detik lagi")).toBe(true);
  });

  it("identifies clock time patterns (HH:mm and H.mm)", () => {
    expect(hasScheduleCue("call jam 08:30")).toBe(true);
    expect(hasScheduleCue("meeting jam 8.45")).toBe(true);
    expect(hasScheduleCue("alarm 06:00")).toBe(true);
  });

  it("identifies elongated keywords like 'ingetin gw 1mmeeeeenit lagi'", () => {
    expect(hasScheduleCue("ingetin gw 1mmeeeeenit lagi buat baca quran al waqiah")).toBe(true);
    expect(hasScheduleCue("ingetttt 10 menit lagi ya")).toBe(true);
    expect(hasScheduleCue("ingatkanlah saya besok subuh")).toBe(true);
  });

  it("returns false for bare 'ingat' memory and conversational phrases", () => {
    expect(hasScheduleCue("Ingat ini: PIN ATM saya 1234")).toBe(false);
    expect(hasScheduleCue("Ingat ya nama teman saya Budi")).toBe(false);
    expect(hasScheduleCue("kamu ingat tidak?")).toBe(false);
    expect(hasScheduleCue("ingat baik-baik ya")).toBe(false);
    expect(hasScheduleCue("tolong ingat kunci di atas meja")).toBe(false);
  });

  it("returns false for non-schedule conversational messages", () => {
    expect(hasScheduleCue("halo joy apa kabar")).toBe(false);
    expect(hasScheduleCue("siapa presiden pertama indonesia")).toBe(false);
    expect(hasScheduleCue("ceritakan dongeng tentang kancil")).toBe(false);
    expect(hasScheduleCue("bagaimana cuaca hari ini")).toBe(false);
    expect(hasScheduleCue("terima kasih banyak")).toBe(false);
  });

  it("returns false for empty or short text (< 3 chars)", () => {
    expect(hasScheduleCue("")).toBe(false);
    expect(hasScheduleCue("  ")).toBe(false);
    expect(hasScheduleCue("hi")).toBe(false);
    expect(hasScheduleCue("ok")).toBe(false);
  });
});
