# Production Contract yang Harus Diikuti ESP

Dokumen ini adalah kontrak target yang sudah diverifikasi dari backend production source. Bila ada perbedaan dengan kode ESP, kode ESP yang harus disesuaikan.

## Sumber kebenaran

- Production handoff: `backend-BMO-Blabs/docs/hardware-handoff/DEPLOYMENT-CONFIG.md`
- Hardware contract: `backend-BMO-Blabs/docs/hardware-contract/BMO-MVP-HW-INTERFACE-CONTRACT-v1.0.5.md`
- Upload route: `backend-BMO-Blabs/backend/src/http/voice.route.ts`
- Audio route: `backend-BMO-Blabs/backend/src/http/audio.route.ts`
- WebSocket events: `backend-BMO-Blabs/backend/src/websocket/events.ts`
- WebSocket server: `backend-BMO-Blabs/backend/src/websocket/websocket.server.ts`
- Pipeline: `backend-BMO-Blabs/backend/src/services/voice-pipeline.service.ts`
- WAV validator: `backend-BMO-Blabs/backend/src/utils/wav-validator.ts`
- Production environment rules: `backend-BMO-Blabs/backend/src/config/env.ts`

## Production endpoint

| Fungsi | Nilai wajib |
|---|---|
| Base URL | `https://api.personalbmo.web.id` |
| Health | `GET https://api.personalbmo.web.id/health` |
| WebSocket | `wss://api.personalbmo.web.id/ws` |
| Upload | `POST https://api.personalbmo.web.id/api/v1/voice` |
| Audio | `GET https://api.personalbmo.web.id/audio/<audio-uuid>.mp3` |
| Public port | TCP `443` melalui Caddy |
| Backend origin | `127.0.0.1:3000`, bukan endpoint yang boleh diakses ESP |

ESP tidak boleh memakai `192.168.1.100`, `localhost`, port `3000`, HTTP plaintext, atau WS plaintext untuk production.

## Device authentication

Nilai production:

- `device_id`: `bmo-001`
- `device_token`: diberikan out-of-band oleh operator; tidak ada token valid di repository.

Token yang sama digunakan pada dua tempat:

1. WebSocket JSON pertama setelah connection open:

   ```json
   {"event":"authenticate","device_id":"bmo-001","device_token":"<PRODUCTION_TOKEN>"}
   ```

2. Header upload HTTP:

   ```text
   X-Device-Id: bmo-001
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
X-Device-Id: bmo-001
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

Nilai `reason` hanya: `DOWNLOAD_FAILED`, `DECODE_FAILED`, `PLAYBACK_FAILED`.

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

`request_failed.code` dapat berupa `NO_SPEECH`, `INVALID_AUDIO`, `STT_FAILED`, `HERMES_FAILED`, `TTS_FAILED`, `AUDIO_EXPIRED`, `PIPELINE_TIMEOUT`, atau `INTERNAL_ERROR`.

Backend dapat mengirim `display_status` sebelum atau sesudah HTTP `202` terlihat oleh ESP. Jangan mengandalkan urutan lintas HTTP dan WebSocket; korelasikan semuanya dengan `request_id`.
## Urutan transaksi

1. Wi-Fi tersambung dan waktu valid.
2. ESP membuka `wss://.../ws` dan mengirim `authenticate` dalam 5 detik.
3. ESP menunggu `authenticated`.
4. ESP merekam WAV canonical.
5. ESP mengirim upload HTTP dengan header dan `X-Request-Id`.
6. Backend menerima `202` atau duplicate `200`, lalu memproses asynchronous.
7. Backend mengirim `display_status` (`thinking`) dan kemudian `audio_ready`, atau `request_failed`.
8. ESP GET `audio_url` MP3 (direct atau chunked transfer encoding, 16kHz/24kHz), melewati ID3 header, men-decode via Helix MP3 decoder, lalu playback ke I2S DAC.
9. Setelah playback benar-benar selesai, ESP mengirim `audio_playback_done`.
10. Jika download, decode, atau playback gagal, ESP mengirim event `audio_playback_failed` dengan reason yang tepat.

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

