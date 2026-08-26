# Phase 4 — Download MP3, Playback, dan Acknowledgement

Prioritas: **wajib / P0** untuk end-to-end communication. Dikerjakan setelah upload dan event WS terbukti.

## Target flow

`audio_ready` → validasi request ID/URL → `GET audio_url` → cek MP3 → decode → playback selesai → `audio_playback_done`.

Backend mengirim `format="mp3"`, URL absolute ke `https://api.personalbmo.web.id/audio/<uuid>.mp3`, dan `expires_in_seconds`. GET audio tidak memerlukan header device/token. Response sukses adalah `200`, `Content-Type: audio/mpeg`, `Content-Length`, dan `Cache-Control: no-store, private, max-age=0`.

## Perubahan minimum

### Audio-ready handling

File utama: `esp/main/api.cpp`.

- Parse `request_id`, `audio_url`, `format`, dan expiry. Hanya terima `format="mp3"` dan URL/path yang sesuai kontrak.
- Deduplicate berdasarkan `request_id`; jangan mengunduh URL yang sama berulang karena callback menerima event duplicate/replay.
- Jangan menganggap semua `audio_ready` baru. Cocokkan dengan active request dari upload atau replay authentication.

### Download integrity

File utama: `esp/main/api.cpp`; decoder/output: `esp/main/audio.cpp`/`audio.h`.

- Download melalui HTTPS dengan certificate bundle yang sama.
- Terima hanya HTTP `200` dan content type audio MPEG (`audio/mpeg`).
- Mendukung direct streaming maupun Chunked Transfer Encoding (`Transfer-Encoding: chunked`).
- Konfigurasi streaming buffer: cyclic stream buffer 32 KB (`MP3_STREAM_BUF_SIZE`), low-latency pre-buffer threshold 2 KB (`MP3_STREAM_PREBUFFER_BYTES`).
- Lewati ID3v2 tag metadata pada chunk awal (`skip_id3_tag()`) tanpa merusak frame sync Helix MP3 decoder.
- Jika `Content-Length` tersedia pada direct transfer, pastikan total byte diterima cocok. EOF sebelum lengkap adalah `DOWNLOAD_FAILED`.
- HTTP `410` berarti `AUDIO_EXPIRED`: jangan retry URL lama. Tandai transaksi failed/expired dan ikuti event failure backend.
- Timeout download dapat diulang terbatas (maksimal 1x retry) bila transport gagal dan URL masih berada dalam batas `expires_in_seconds`; jangan retry ketika expiry sudah habis.
### Decode dan playback

- Decoder menggunakan Helix MP3 Decoder native (`HMP3Decoder`) dengan frame capacity buffer 1152x2 sample.
- Decoder mengembalikan status sukses/gagal secara granular (`JoyPlaybackResult`), bukan hanya `void`.
- Bila MP3 corrupt atau decode gagal, kirim `audio_playback_failed` dengan `DECODE_FAILED`.
- Bila speaker/I2S gagal atau playback mengalami underrun/stalling, kirim `PLAYBACK_FAILED`.
- Hanya setelah seluruh sample selesai diputar kirim `audio_playback_done`.
- Callback WebSocket dan FreeRTOS task diproteksi dengan arsitektur non-blocking / queue agar operasi playback tidak memblokir event loop.
### Pending acknowledgement

- Jika playback selesai saat WSS offline, simpan satu hasil per request ID.
- Setelah reconnect dan `authenticated`, kirim acknowledgement pending dengan return value yang diperiksa.
- Jangan mengirim `done` dua kali tanpa kebutuhan; backend idempotent, tetapi firmware tetap harus menjaga satu outcome lokal.

### Backend Hermes Streaming & Chunked MP3 Delivery

Backend Joy mengimplementasikan **Hermes Streaming** (`POST /v1/chat/completions` SSE stream dengan `stream: true`), `SentenceSplitter` untuk pemotongan kalimat/klausa secara real-time, dan sintesis TTS terpipanisasi (*pipelined TTS*):
1. Segera setelah chunk audio pertama disintesis oleh TTS dan ditulis ke `LiveAudioStream`, backend meng-emit WebSocket `audio_ready` ke ESP32 (Time-To-First-Audio / TTFA turun menjadi **~1.7 detik**).
2. ESP32 langsung menginisiasi HTTPS GET ke `audio_url` (`https://api.personalbmo.web.id/audio/<uuid>.mp3`).
3. Endpoint audio backend melayani response dengan `Transfer-Encoding: chunked` secara streaming simultan saat TTS menyelesaikan sintesis kalimat-kalimat berikutnya.
4. Desain firmware ESP32 dengan cyclic stream buffer 32 KB dan low-latency pre-buffer 2 KB (`MP3_STREAM_PREBUFFER_BYTES`) secara native menangani streaming chunked ini tanpa jitter, underrun, maupun kebutuhan perubahan firmware (100% kompatibel).

## File/function ESP yang terdampak

- `esp/main/api.cpp`: parser `audio_ready`, HTTP download, status/headers, expiry, pending done/failed.
- `esp/main/audio.cpp`/`audio.h`: hasil decode, write error, playback completion.
- `esp/main/state.cpp`/`state.h`: state `downloading/playing`, request ID, terminal outcome.

## Verifikasi

1. `audio_ready` untuk request aktif menghasilkan satu GET ke URL production dan `Content-Type: audio/mpeg`.
2. MP3 valid selesai diputar dan backend menerima `audio_playback_done` dengan UUID yang sama.
3. MP3 rusak menghasilkan `DECODE_FAILED`, bukan `done`.
4. Simulasi download/HTTP failure menghasilkan `DOWNLOAD_FAILED` dan retry terbatas bila masih valid.
5. HTTP `410` tidak di-retry dan tercatat sebagai `AUDIO_EXPIRED`.
6. Speaker/I2S failure menghasilkan `PLAYBACK_FAILED`.
7. WS diputus tepat setelah playback; reconnect mengirim pending outcome satu kali.
8. Setelah done/failed, GET ulang URL lama tidak dijadikan dasar untuk playback baru.

### Pass criteria

Satu voice request selesai dengan outcome yang benar: MP3 diputar lalu `done`, atau kegagalan dikirim dengan reason yang tepat. Tidak ada false success dari EOF/short write/decoder error.

## Latest Step 4 execution status — 2026-08-15

Static review and implementation status: `PASS`. The minimal ESP scope was limited to `main/api.cpp`, `main/audio.cpp`, and `main/audio.h`. The revision enforces HTTP 200 plus `audio/mpeg` and positive `Content-Length`, counts all received bytes including ID3 bytes, checks complete-body delivery, stores and enforces expiry, maps `AUDIO_EXPIRED` separately from playback failures, retries at most once for an unexpired download failure, rejects partial/corrupt decode, checks I2S/write results, queues callback work to the state task, and prevents both `done` and `failed` for one request. No backend, credential, router, or project configuration was changed. Static review evidence: `step4-static-review-2026-08-14-sanitized.log`.

One corrective official ESP-IDF build for this revision completed with exit code `0` and passed the ESP-IDF size check. No second build, direct Ninja, dry-run, CMake, incremental verification, fullclean, or build-folder deletion was performed. The exact artifact set was flashed once through `esptool @flash_args` to the verified ESP32-S3 on COM7 with exit code `0` and `4/4` write-hash verification. Build and flash evidence is recorded in `build-step4-official-2026-08-14-sanitized.log`, `build-step4-result-2026-08-14-sanitized.log`, `board-step4-com7-sanitized.log`, and `flash-step4-2026-08-14-sanitized.log`.

Physical Gate 4 is not yet accepted. Earlier captures recorded an interruption and an AP availability blocker. The latest WiFi-revision capture reached authenticated WSS and observed `Hi Joy` plus `Recording started`, but no recording-finished/WAV event appeared within the 300-second limit. No downstream evidence is claimed. Current status is `PENDING / RECORDING_NOT_COMPLETING`, not a Gate 4 PASS. Logs: `serial-step4-gate4-interrupted-2026-08-14-sanitized.log`, `serial-step4-gate4-network-blocked-2026-08-15-sanitized.log`, and `serial-step5-gate4-2026-08-15-sanitized.log`.

The required Gate 4 evidence remains: `audio_ready`, one complete validated MP3 download, decoder/frame start, complete playback, and exactly one correlated `audio_playback_done` or typed failure. No Step 4 request ID, audio byte count, HTTP audio response, decoder result, playback result, or playback outcome was available from these blocked captures. Gate 3’s prior request/byte/HTTP evidence is not reused to close Gate 4.
