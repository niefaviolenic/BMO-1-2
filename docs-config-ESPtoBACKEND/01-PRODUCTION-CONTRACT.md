# Production Contract yang Harus Diikuti ESP

Dokumen ini adalah kontrak target yang sudah diverifikasi dari backend production source. Bila ada perbedaan dengan kode ESP, kode ESP yang harus disesuaikan.

## Sumber kebenaran

- Production handoff: `backend-Joy-Blabs/docs/hardware-handoff/DEPLOYMENT-CONFIG.md`
- Hardware contract: `backend-Joy-Blabs/docs/hardware-contract/JOY-MVP-HW-INTERFACE-CONTRACT-v1.0.5.md`
- Upload route: `backend-Joy-Blabs/backend/src/http/voice.route.ts`
- Audio route: `backend-Joy-Blabs/backend/src/http/audio.route.ts`
- WebSocket events: `backend-Joy-Blabs/backend/src/websocket/events.ts`
- WebSocket server: `backend-Joy-Blabs/backend/src/websocket/websocket.server.ts`
- Pipeline: `backend-Joy-Blabs/backend/src/services/voice-pipeline.service.ts`
- WAV validator: `backend-Joy-Blabs/backend/src/utils/wav-validator.ts`
- Production environment rules: `backend-Joy-Blabs/backend/src/config/env.ts`

## Production endpoint

| Fungsi | Nilai wajib | Keterangan |
|---|---|---|
| Base URL | `https://api.personalbmo.web.id` | HTTPS REST Gateway |
| Health | `GET https://api.personalbmo.web.id/health` | Health Check Endpoint |
| Hardware WebSocket | `wss://api.personalbmo.web.id/ws` | Dedicated WSS untuk ESP32-S3 Hardware Client |
| Mobile WebSocket | `wss://api.personalbmo.web.id/api/v1/ws` | Dedicated WSS untuk Joy Mobile App Client |
| Audio Upload | `POST https://api.personalbmo.web.id/api/v1/voice` | Upload Canonical WAV (16kHz 16-bit Mono) |
| Audio Download | `GET https://api.personalbmo.web.id/audio/<audio-uuid>.mp3` | MP3 Streaming (Direct / Chunked) |
| Public port | TCP `443` melalui Caddy | TLS 1.2 / 1.3 |
| Backend origin | `127.0.0.1:3000` (Private) | Bukan endpoint yang boleh diakses langsung |

ESP tidak boleh memakai `192.168.1.100`, `localhost`, port `3000`, HTTP plaintext, atau WS plaintext untuk production.
## Device authentication

Nilai production:

- `device_id`: `joy-001`
- `device_token`: diberikan out-of-band oleh operator; tidak ada token valid di repository.

Token yang sama digunakan pada dua tempat:

1. WebSocket JSON pertama setelah connection open:

   ```json
   {"event":"authenticate","device_id":"joy-001","device_token":"<PRODUCTION_TOKEN>"}
   ```

2. Header upload HTTP:

   ```text
   X-Device-Id: joy-001
   X-Device-Token: <PRODUCTION_TOKEN>
   ```

Token tidak boleh dikirim sebagai query parameter, URL, atau log. WebSocket harus authenticated sebelum ESP melakukan upload.

WebSocket authentication timeout backend adalah 5 detik. Credential salah menghasilkan event `authentication_failed` lalu close code `4003`. Event non-auth sebelum autentikasi ditolak; koneksi dapat ditutup dengan `4001`.

## Upload audio

Request:

```text
POST /api/v1/voice HTTP/1.1
Content-Type: audio/wav
Content-Length: <exact byte count>
X-Device-Id: joy-001
X-Device-Token: <PRODUCTION_TOKEN>
X-Request-Id: <UUIDv4>

<raw canonical WAV bytes>
```

Backend membaca raw body, bukan JSON dan bukan multipart. WAV harus RIFF/WAVE, PCM format `1`, mono, `16000 Hz`, `16 bit`, byte rate `32000`, block align `2`, data tidak kosong, dan durasi maksimal 60 detik. Batas ukuran adalah `3,145,728` byte.
Response normal:

- `202`: `{ "request_id": "<same UUID>", "status": "processing" }`
- `200` duplicate request/body: `{ "request_id": "<same UUID>", "status": "processing|audio_ready|completed|failed|expired", "duplicate": true, ... }`

Request ID wajib UUID v4 dan harus dipertahankan ketika request yang sama diulang. Jangan membuat ID baru untuk retry transport; idempotency backend bergantung pada ID dan body yang sama.

## WebSocket inbound dari ESP

| Event | Payload wajib | Keterangan |
|---|---|---|
| `authenticate` | `event`, `device_id`, `device_token` | Handshake autentikasi awal (maksimal 5 detik setelah connect) |
| `pairing_mode_request` | `event` | Meminta backend menginisiasi flow pairing 6-digit |
| `audio_playback_done` | `event`, `request_id` UUIDv4 | Konfirmasi playback MP3 telah tuntas diputar ke speaker |
| `audio_playback_failed` | `event`, `request_id`, `reason` | Notifikasi kegagalan download/decode/playback |
| `proactive_offer_accepted` | `event`, `delivery_id`, `attempt_id`, `offer_receipt` | Konfirmasi ESP siap menerima & memutar audio proaktif dari backend |

Nilai `reason` untuk `audio_playback_failed`: `DOWNLOAD_FAILED`, `DECODE_FAILED`, `PLAYBACK_FAILED`.

## WebSocket outbound dari backend

| Event | Arti dan field | Keterangan |
|---|---|---|
| `authenticated` | `status="ok"`, `device_id`, `backend_state` (`idle\|thinking\|audio_ready`), `active_request_id` (string atau null) | Konfirmasi auth sukses; replay state aktif jika ada |
| `authentication_failed` | `error="INVALID_DEVICE_CREDENTIALS"` | Autentikasi gagal; koneksi ditutup dengan close code 4003 |
| `connection_replaced` | `reason="NEW_CONNECTION_ESTABLISHED"` | Sesi digantikan oleh koneksi baru; hentikan koneksi lama |
| `pairing_code` | `code` (string 6-digit), `expires_at` (ISO timestamp) | Kode pairing yang ditampilkan pada LCD device |
| `pairing_completed` | `status="ok"` | Pairing berhasil diselesaikan oleh user |
| `display_status` | `request_id`, `status="thinking"`, opsional `transcript` / `user_transcript` | Notifikasi backend sedang memproses audio (STT / LLM) |
| `audio_ready` | `request_id`, `audio_url`, `format="mp3"`, `expires_in_seconds`, opsional `transcript`, `response_text` | URL MP3 siap diunduh dan diputar oleh ESP |
| `request_failed` | `request_id`, `code`, `recoverable=true` | Transaksi gagal di backend |
| `proactive_offer` | `delivery_id`, `attempt_id`, `offer_receipt`, `expires_at_ms` | Penawaran backend untuk pengiriman audio proaktif (jadwal/peringatan) |
| `proactive_audio_ready` | `delivery_id`, `attempt_id`, `lease_id`, `audio_receipt`, `audio_url`, `expires_at_ms` | Stream audio proaktif siap diunduh dan diputar ke speaker |
| `proactive_cancel` | `delivery_id`, `attempt_id`, `lease_id` | Pembatalan pemutaran audio proaktif yang sedang berjalan |

`request_failed.code` dapat berupa `NO_SPEECH`, `INVALID_AUDIO`, `STT_FAILED`, `HERMES_FAILED`, `TTS_FAILED`, `AUDIO_EXPIRED`, `PIPELINE_TIMEOUT`, atau `INTERNAL_ERROR`.

Backend dapat mengirim `display_status` sebelum atau sesudah HTTP `202` terlihat oleh ESP. Jangan mengandalkan urutan lintas HTTP dan WebSocket; korelasikan semuanya dengan `request_id`.

### Backend Voice Pipeline & Hermes Streaming

Backend memproses suara menggunakan arsitektur real-time streaming pipeline:
1. **STT Transcribe**: Mengonversi WAV masukan menjadi teks (~350ms).
2. **Hermes Streaming LLM**: Membuka koneksi SSE stream (`stream: true`) ke endpoint Hermes (`POST /v1/chat/completions`), dengan Time-To-First-Token (TTFT) ~450ms.
3. **SentenceSplitter**: Mem-buffer token LLM yang masuk secara inkremental, menghapus tag internal/thinking (`<think>...</think>`), dan membagi teks berdasarkan batas kalimat/klausa (`.`, `!`, `?`, `\n`, `,`, `;`, `:`).
4. **Pipelined TTS Synthesis**: Kalimat pertama langsung dikirim ke service TTS secara terpipanisasi tanpa menunggu LLM menyelesaikan seluruh respons.
5. **Early `audio_ready` & Chunked MP3 Streaming**: Begitu chunk audio MP3 pertama dihasilkan oleh TTS dan ditulis ke `LiveAudioStream`, backend seketika mengirimkan WebSocket event `audio_ready` ke ESP32.
6. **Time-To-First-Audio (TTFA)**: Latensi dari selesai upload sampai `audio_ready` terpangkas menjadi **~1.7 detik**.

> **Penting**: Seluruh optimasi pipeline streaming ini **100% kompatibel** dengan kontrak ESP32 yang sudah ada. ESP32 tetap menerima event `audio_ready` standar, melakukan HTTP GET ke `audio_url` dengan dukungan Chunked Transfer Encoding (`Transfer-Encoding: chunked`), men-decode stream MP3 via Helix MP3 Decoder secara bertahap, dan mengirim `audio_playback_done` saat tuntas.
## Fitur Akustik & Audio UX Firmware

1. **Non-Blocking Wake Acknowledgment Cue**:
   - Begitu WakeNet mendeteksi wake word *"Hi Joy"*, task background Core 0 (`wake_ack_worker_task`) seketika memainkan `wake_ack.wav` ($\le 600\text{ ms}$, 16kHz 16-bit Mono PCM) atau fallback dual-tone earcon (659 Hz $\to$ 880 Hz) melalui amplifier MAX98357A.
   - Microphone capture task (`wakeword_listener_task`) tidak terblokir (0ms blocking delay).

2. **Seamless Single-Breath Wake Word**:
   - Rolling circular pre-roll buffer sebesar 8192 sampel (~512ms pada 16kHz mono) aktif selama state `IDLE`.
   - Saat wake word terdeteksi, pre-roll buffer langsung dikomit ke `record_buffer` sehingga kata perintah lanjutan (misal *"Hi Joy jam berapa sekarang"*) tidak terpotong sama sekali.

3. **Dynamic Thinking Filler Voice Speech (Zero Dead-Air Latency Masking)**:
   - Begitu upload WAV diterima oleh backend (`202 Accepted` / `JOY_UPLOAD_ACCEPTED`), firmware seketika memutar salah satu dari 5 audio clip filler berpikir secara dinamis/acak (`thinking_01.wav` .. `thinking_05.wav`) melalui speaker.
   - Menghilangkan keheningan canggung (*dead air*) selama backend memproses STT, Hermes LLM, dan TTS synthesis.

4. **Shared Playback Job Architecture (`PlaybackJob`)**:
   - Abstraksi `PlaybackJob` di `playback.cpp` mengatur hak kepemilikan speaker DAC tunggal (arbitrasi eksklusif).
   - Memberikan prioritas utama pada Voice Playback dan mengisolasi Proactive Delivery dari konflik pemutaran suara.

5. **Voice Capture Reservation (`voice_capture_reservation.cpp/.h`)**:
   - Mengelola status reservasi mikrofon lokal (`IDLE`, `REQUESTING`, `RESERVED`, `EXPIRED`, `REJECTED`) dengan UUID request, lease ID, dan batas waktu lease.
   - Mencegah backend memulai pemutaran proaktif saat mikrofon sedang aktif merekam suara pengguna.

6. **Playback Watchdog (`playback_watchdog.cpp/.h`)**:
   - Melacak metrik pemutaran secara realtime menggunakan atomics (`http_bytes_received`, `mp3_frames_decoded`, `pcm_frames_written`).
   - Menggunakan ambang batas stall `kPlaybackStallUs = 5.000.000 µs` (5 detik). Jika aliran stream audio terhenti atau tersendat tanpa progress selama 5 detik, watchdog mengunci status `PlaybackTerminalReason::STALLED` dan membatalkan stream secara aman.
## Urutan transaksi

1. Wi-Fi tersambung dan waktu valid (SNTP).
2. ESP membuka `wss://.../ws` dan mengirim `authenticate` dalam 5 detik.
3. ESP menunggu `authenticated`.
4. ESP mendeteksi wake word *"Hi Joy"* -> memutar wake ack cue secara non-blocking dan mengaktifkan rekaman dengan rolling pre-roll buffer (~512ms).
5. ESP merekam WAV canonical (16kHz 16-bit Mono).
6. ESP mengirim upload HTTP dengan header `X-Device-Id`, `X-Device-Token`, dan `X-Request-Id`.
7. Backend menerima `202 Accepted` -> ESP langsung memutar dynamic thinking filler clip secara lokal.
8. Backend memproses via Hermes Streaming SSE + SentenceSplitter + Pipelined TTS -> mengirim `display_status` (`thinking`) lalu `audio_ready`.
9. ESP GET `audio_url` MP3 (direct atau chunked transfer encoding, 16kHz/24kHz), melewati ID3 header, men-decode via Helix MP3 decoder, lalu playback ke I2S DAC.
10. Setelah playback benar-benar selesai, ESP mengirim `audio_playback_done`.
11. Jika download, decode, atau playback gagal, ESP mengirim event `audio_playback_failed` dengan reason yang tepat (`DOWNLOAD_FAILED`, `DECODE_FAILED`, `PLAYBACK_FAILED`).
## Timeout, heartbeat, dan lifecycle

- WebSocket auth: 5 detik.
- Backend WebSocket native ping: setiap 60 detik; terminate setelah 2 pong terlewat.
- Total voice pipeline: 300 detik.
- MP3 tersedia sekitar 300 detik dan dihapus setelah selesai/expired.
- Audio expired: HTTP `410` dengan `AUDIO_EXPIRED`; ini terminal untuk request tersebut, bukan retry download.

ESP boleh memakai backoff reconnect, tetapi harus re-authenticate setiap koneksi baru. Setelah authenticate, backend dapat replay state aktif: `thinking` melalui `display_status` atau `audio_ready` melalui `audio_ready`.

## Error matrix minimum

| HTTP/event | Tindakan ESP |
|---|---|
| `202` | Simpan request aktif; tunggu event WS. |
| `200 duplicate` | Parse status; lanjutkan state yang sesuai, jangan upload body baru. |
| `409 WEBSOCKET_NOT_CONNECTED` | Pulihkan WSS/auth, ulangi body yang sama dengan request ID yang sama. |
| `409 DEVICE_BUSY` | Jangan membuat request kedua; tunggu request aktif selesai atau tampilkan busy. |
| `409 REQUEST_ID_CONFLICT` | Terminal; jangan retry dengan ID yang sama dan body berbeda. |
| `401 INVALID_DEVICE_CREDENTIALS` | Hentikan retry; periksa provisioning token. |
| `413`, `415`, `422` | Terminal untuk rekaman; perbaiki/diagnosis format, bukan retry buta. |
| HTTP `5xx` atau transport timeout | Retry terbatas dengan body dan request ID sama. |
| WS `request_failed` | Hentikan transaksi sesuai code; jangan download audio. |
| Audio HTTP `410` | Kirim/rekam `AUDIO_EXPIRED` sesuai flow, jangan retry URL lama. |

## TLS dan security

TLS terminasi di Caddy pada domain publik. ESP wajib memvalidasi sertifikat untuk `api.personalbmo.web.id` menggunakan certificate bundle/CA yang tersedia; jangan memakai insecure mode atau mematikan hostname verification. Jam device harus benar melalui SNTP sebelum handshake TLS. Credential tidak boleh masuk commit, binary log, URL, atau query.

