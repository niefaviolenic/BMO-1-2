# Phase 2 — WebSocket Authentication, Event, Replay, dan Reconnect

Prioritas: **wajib / P0**. Backend mensyaratkan WebSocket authenticated untuk menerima upload.

## Target flow

```text
Wi-Fi + time valid
  → connect wss://api.personalbmo.web.id/ws
  → kirim authenticate dalam ≤ 5 s
  → terima authenticated
  → boleh upload
  → terima display_status / audio_ready / request_failed
  → kirim playback_done atau playback_failed
```

## Perubahan minimum

### Connection dan authentication

File utama: `esp/main/api.cpp`.

- Konfigurasi WebSocket menggunakan URL WSS production dan certificate bundle.
- Pada `WEBSOCKET_EVENT_CONNECTED`, kirim satu JSON `authenticate` sesuai schema; jangan mengirim credential sebagai header/query kecuali kontrak backend mengubahnya.
- Set `ws_connected=true` hanya untuk transport connected dan `ws_authenticated=true` hanya setelah event `authenticated` dengan `status="ok"` dan device ID yang sesuai.
- Terapkan batas tunggu auth 5 detik di sisi ESP. Jika tidak authenticated, tutup/reconnect; jangan upload.
- Pada `authentication_failed`, hentikan retry otomatis sampai credential/provisioning diperbaiki. Reconnect buta tidak menyelesaikan `401/4003`.

### Parse state dan korelasi request

- Parse semua field penting dari `authenticated`: `backend_state` dan `active_request_id`.
- Simpan `active_request_id` sebagai sumber rekonsiliasi setelah boot/reconnect.
- Jika backend replay `thinking`, tandai request itu sebagai aktif dan tunggu `audio_ready`/`request_failed`.
- Jika backend replay `audio_ready`, proses URL untuk request ID tersebut tanpa menganggap event baru.
- Abaikan event audio/status dengan request ID yang tidak dikenal kecuali memang sedang melakukan recovery; jangan memutar audio milik request lain.
- Deduplikasi berdasarkan `request_id`, bukan hanya state lokal `downloading/playing`.

### Event outbound playback

- `audio_playback_done` hanya dikirim setelah decoder/playback selesai dan sukses.
- `audio_playback_failed` harus memakai reason yang tepat: download, decode, atau playback.
- Jika WS terputus saat audio selesai/gagal, simpan event pending per request ID dan kirim setelah re-authenticated.
- Kirim event dengan return value yang diperiksa; bila send gagal, jangan menganggap acknowledgement sudah diterima.

### Proactive Event Family & Playback Arbitration

- Event `proactive_offer`: Backend menawarkan pengiriman audio proaktif dengan field `delivery_id`, `attempt_id`, `offer_receipt`, `expires_at_ms`. Jika ESP dalam state `IDLE` dan tidak sedang merekam/memproses suara, ESP membalas `proactive_offer_accepted`.
- Event `proactive_audio_ready`: Backend mengirimkan URL MP3 proaktif (`delivery_id`, `attempt_id`, `lease_id`, `audio_receipt`, `audio_url`, `expires_at_ms`). ESP memulai streaming MP3 dan memutar audio proaktif.
- Event `proactive_cancel`: Backend dapat membatalkan pengiriman proaktif jika terjadi interupsi user atau kedaluwarsa lease.
- `PlaybackJob` dan `playback_watchdog`: Menjaga isolasi physical speaker, memastikan voice response selalu mendapat prioritas tertinggi di atas proactive audio, dan me-latch stall state jika streaming terputus lebih dari 5 detik.


### QR Code Display Events (`display_qr` & `clear_qr`)

- Event `display_qr`: Backend/WhatsApp bridge mengirim event dengan payload string `qr` dan ISO timestamp `expires_at`. ESP32 segera meng-generate matrix QR code via `qrcodegen` dan menampilkannya di LCD 320x240 (`display_set_qr_code()`). Selama QR code ditampilkan, touch sensor dan wakeword di-guard agar tidak menginterupsi scan kamera.
- Event `clear_qr`: Backend mengirim event `clear_qr` ketika WhatsApp bridge telah terhubung (pairing confirmed) atau sesi QR dibatalkan/expired. ESP32 membersihkan layer QR code (`display_clear_qr_code()`) dan kembali ke tampilan ekspresi normal `JoyState::IDLE`.
### Heartbeat dan reconnect

- Backend mengirim native ping tiap 60 detik dan menutup setelah dua pong hilang. Pastikan library WebSocket membalas native ping/pong; jangan menggantinya dengan event JSON yang tidak ada di kontrak.
- Pertahankan backoff reconnect yang sudah ada, tetapi reset backoff setelah koneksi dan authentication sukses.
- Setelah setiap reconnect, ulangi authenticate dan tunggu `authenticated` sebelum mengirim pending upload/playback event.
- Tangani `connection_replaced` dengan berhenti memakai koneksi lama; koneksi baru menjadi satu-satunya kanal.
- Pada WS error/close, reset seluruh flag transport/auth secara konsisten. Jangan hanya menghapus flag backend tetapi tetap menganggap `ws_connected=true`.
## File/function ESP yang terdampak

- `esp/main/api.cpp`: WebSocket setup, `WEBSOCKET_EVENT_CONNECTED`, event parser, `ws_send_text`, reconnect monitor, pending event.
- `esp/main/api.h`: status/auth/request ID API bila diperlukan.
- `esp/main/state.cpp`/`state.h`: gating upload pada authenticated dan state recovery.
- `esp/main/main.cpp`: urutan start API setelah Wi-Fi/time readiness.

## Verifikasi

1. Koneksi fresh menerima `authenticated` dengan `device_id=joy-001`, `backend_state=idle`, dan `active_request_id=null`.
2. Credential salah menghasilkan `authentication_failed`/close `4003`; ESP tidak masuk loop upload.
3. WS diputus saat idle; ESP reconnect, re-authenticate, dan kembali ready.
4. WS diputus saat backend state `thinking`; setelah reconnect ESP menerima/reconcile `display_status` atau state aktif yang sesuai.
5. WS diputus setelah `audio_ready`; setelah reconnect ESP dapat melanjutkan download/playback atau mengirim pending result sesuai request ID.
6. Koneksi kedua untuk device yang sama menghasilkan `connection_replaced` pada koneksi lama; ESP tidak membuat dua transaksi aktif.
7. Setelah 60+ detik koneksi idle, native ping/pong tidak menyebabkan disconnect.

### Pass criteria

ESP hanya menganggap siap upload setelah event `authenticated`. Reconnect selalu re-authenticate, state aktif tidak hilang, dan tidak ada event credential di URL/query/log.

## Acceptance classification — 2026-08-14

Implementasi Step 2 dinyatakan `PASS` dan Gate 2 dinyatakan `PASS` untuk melanjutkan ke Step 3 berdasarkan evidence fresh authentication, upload gating, native heartbeat, `connection_replaced` suppression, post-reset authentication, static review reconnect/re-authenticate, satu official build, dan satu flash exact artifact.

Idle network loss → recovery → re-authentication tetap merupakan requirement firmware dan acceptance wajib, tetapi status pelaksanaannya saat ini:

`DEFERRED_TO_GATE_5 / BLOCKED_BY_NETWORK_AUTHORITY`

Alasan penundaan: `Deferred karena operator tidak memiliki wewenang terhadap AP/router; bukan kegagalan firmware.` Pengujian ini tidak diklaim sudah dilakukan dan wajib ditutup sebelum production sign-off Gate 5. Jika disconnect alami terjadi selama Step 3 atau Step 4, gunakan kesempatan itu untuk mengumpulkan evidence dan menutup deferred test lebih awal. Pengujian lokal yang diizinkan hanya isolasi sinyal ESP secara fisik dengan ESP dan serial tetap menyala; tidak boleh ada deauthentication, packet injection, perubahan router, atau perubahan backend.
