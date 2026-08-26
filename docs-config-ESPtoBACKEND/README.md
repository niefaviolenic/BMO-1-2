# Implementation Plan: ESP → Backend Production

Status: planning only. Dokumen ini tidak mengubah firmware atau backend.

## Tujuan

Membawa firmware ESP yang ada ke kondisi dapat:

1. tersambung ke `https://api.personalbmo.web.id` melalui HTTPS dan `wss://api.personalbmo.web.id/ws`;
2. melakukan autentikasi device dan protokol pairing 6-digit sesuai kontrak backend;
3. mengirim WAV canonical (16kHz, 16-bit, Mono) untuk diproses;
4. menerima event status, transkripsi STT, teks AI, dan URL streaming MP3 (16/24kHz);
5. mengunduh (chunked/direct stream), men-decode native via Helix, memutar, lalu mengirim konfirmasi playback ke backend;
6. pulih dari disconnect/reconnect tanpa membuat request atau playback menjadi tidak konsisten.
Target operasional adalah koneksi dan satu siklus voice end-to-end berhasil hari ini. Backend production tetap menjadi source of truth; tidak ada perubahan backend dalam plan ini.

## Dokumen dalam plan

| Dokumen | Isi |
|---|---|
| `00-PROGRESS.md` | Tracker status yang wajib diperbarui agent selama implementasi. |
| `01-PRODUCTION-CONTRACT.md` | Kontrak backend yang sudah diverifikasi dari source dan handoff production. |
| `02-PHASE-1-CONNECTION-TLS-AUTH.md` | Target production, DNS, HTTPS/WSS, TLS certificate bundle, waktu device, dan credential. |
| `03-PHASE-2-WEBSOCKET.md` | Handshake, event, replay state, heartbeat, reconnect, dan replacement connection. |
| `04-PHASE-3-AUDIO-UPLOAD.md` | WAV, header, request ID, response upload, timeout, retry, dan error mapping. |
| `05-PHASE-4-AUDIO-DOWNLOAD-PLAYBACK.md` | Download MP3, expiry, decoder/playback, dan playback acknowledgement. |
| `06-PHASE-5-ERROR-RECONNECT-ACCEPTANCE.md` | Error handling minimum dan skenario acceptance production. |
| `07-EXECUTION-CHECKLIST.md` | Urutan kerja agent, gate, bukti yang harus dikumpulkan, dan definisi selesai. |

## Hasil audit yang menjadi dasar

ESP belum siap direct-connect ke production. Blocker saat ini adalah:

- firmware masih menunjuk ke `192.168.1.100:3000`, `http://`, dan `ws://`;
- token di source masih placeholder dan token production belum tersedia di repository;
- TLS verification dan sinkronisasi waktu belum diaktifkan pada WebSocket/HTTP;
- flow WebSocket belum merespons seluruh kontrak production, terutama `active_request_id`, replay state, dan hasil playback;
- timeout pipeline ESP 90 detik lebih pendek dari batas backend 300 detik;
- klasifikasi retry masih mencampur error fatal, `AUDIO_EXPIRED`, dan transport failure;
- download belum memvalidasi body selesai/metadata audio secara memadai;
- alasan `audio_playback_failed` belum dipetakan ke `DOWNLOAD_FAILED`, `DECODE_FAILED`, atau `PLAYBACK_FAILED`.

Rujukan temuan dan file terdampak sudah diketahui dari audit sebelumnya; implementer menggunakan dokumen kontrak di `01` sebagai acuan, bukan menebak dari firmware lama.

## Urutan eksekusi wajib

Ada **6 step wajib** termasuk preflight. Dari jumlah tersebut, Step 1–5 adalah fase perubahan teknis firmware.

0. **Preflight + credential** — siapkan token production secara aman, board, jaringan, dan scope perubahan.
1. **Production connection + TLS + waktu device** — tanpa ini semua test berikutnya tidak valid.
2. **WebSocket authentication, state/event, dan reconnect** — upload tidak boleh dicoba sebelum `authenticated` diterima.
3. **HTTP audio upload** — kirim WAV canonical dengan request ID yang dapat diulang secara idempotent.
4. **Response/event → download MP3 → playback** — selesaikan satu transaksi end-to-end.
5. **Error, retry, reconnect, dan acceptance production** — lakukan sebelum menyatakan firmware siap.

Jangan melanjutkan ke gate berikutnya bila gate sebelumnya gagal. Bila token production belum diberikan secara out-of-band, pekerjaan berhenti di gate credential; jangan membuat token contoh atau memasukkannya ke Git.

## Batasan perubahan

Termasuk: perubahan minimum pada `esp/main/api.cpp`, `api.h`, `audio.cpp`/`audio.h`, `wifi.cpp`/`wifi.h`, `state.cpp`/`state.h`, dan konfigurasi build bila diperlukan untuk TLS.

Tidak termasuk: perubahan backend, refactor arsitektur besar, redesign state machine, fitur UI baru, provisioning portal, optimasi audio yang tidak diperlukan untuk koneksi, dan hardening di luar error path yang menghalangi komunikasi.

## Definition of Done

Plan ini dianggap berhasil diimplementasikan bila satu ESP fisik dengan `device_id=joy-001` dapat, dari jaringan publik:

- membuka WSS dan menerima `authenticated` dengan `backend_state` yang valid;
- mengelola siklus pairing (`pairing_code`, `pairing_completed`) atau autentikasi langsung;
- merekam/mengirim WAV canonical (16kHz 16-bit Mono) dan menerima HTTP `202` atau duplicate `200` yang valid;
- menerima `display_status` (termasuk transcript STT) lalu `audio_ready` (termasuk response text LLM) untuk request yang sama;
- mengunduh `audio/mpeg` (direct/chunked), men-decode via Helix MP3 decoder, memutar sampai selesai, dan mengirim `audio_playback_done`;
- kembali authenticated setelah disconnect dan tidak mengirim credential di URL/query/log;
- melewati checklist acceptance pada `07-EXECUTION-CHECKLIST.md` serta 83/83 Python contract tests.
