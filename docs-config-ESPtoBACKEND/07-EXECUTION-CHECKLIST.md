# Execution Checklist untuk Agent Implementer

Gunakan checklist ini berurutan. Jangan mengimplementasikan kode sebelum plan ini disetujui; file ini adalah urutan kerja untuk tahap implementasi berikutnya.

## Gate 0 — Persiapan dan batasan

- [ ] Baca `01-PRODUCTION-CONTRACT.md` dan cocokkan dengan source backend yang dirujuk.
- [ ] Pastikan workspace ESP adalah `esp/` dan backend tidak diubah.
- [ ] Dapatkan `DEVICE_TOKEN` production secara out-of-band.
- [ ] Tentukan mekanisme secret lokal/untracked atau provisioning yang sudah digunakan project.
- [ ] Catat board, flash layout, firmware revision, dan jaringan uji.
- [ ] Pastikan tidak ada pekerjaan paralel yang mengubah `api.cpp`, `wifi.cpp`, atau state protocol.

**Gate 0 PASS:** token tersedia aman, scope perubahan jelas, dan environment hardware siap.

## Gate 1 — Connection, TLS, dan waktu

- [ ] Ganti endpoint aktif ke HTTPS/WSS production.
- [ ] Pasang certificate bundle callback pada HTTP dan WebSocket.
- [ ] Tambahkan/aktifkan SNTP readiness sebelum API connect.
- [ ] Build firmware.
- [ ] Flash dan boot ESP pada jaringan publik.
- [ ] Verifikasi health/domain reachability dan serial log waktu valid.

**Gate 1 PASS:** TLS handshake production berhasil; tidak ada endpoint LAN/plaintext aktif.

## Gate 2 — WebSocket authentication

- [x] Kirim JSON `authenticate` dalam 5 detik.
- [x] Validasi event `authenticated` sebelum memberi izin upload.
- [x] Simpan `backend_state` dan `active_request_id`.
- [x] Perbaiki reset flag saat error/close.
- [x] Pastikan implementasi reconnect selalu re-authenticate; runtime idle network-loss acceptance dipindahkan ke Gate 5.

**Gate 2 PASS untuk sequencing:** fresh connect menerima `authenticated`, upload tetap gated, connection replacement suppression dan post-reset authentication PASS, tanpa token bocor. Idle network loss → recovery → re-authentication tidak diklaim sudah diuji dan berstatus `DEFERRED_TO_GATE_5` sebelum production sign-off.

## Gate 3 — Upload

- [x] Pastikan WAV 16 kHz, mono, PCM 16-bit, canonical, durasi ≤60 detik.
- [x] Kirim header device/request ID/content type/content length yang tepat.
- [x] Pastikan full body write dan validasi JSON response.
- [x] Pertahankan ID/body untuk retry.
- [x] Ubah pipeline wait dari 90 detik menjadi maksimum 300 detik.
- [x] Implementasikan error matrix upload.

**Gate 3 PASS:** rekaman uji mendapat `202`/duplicate valid dan backend dapat mengorelasikan request ID.

**Gate 3 historical status 2026-08-14 15:44:** checklist kode, official build, and exact flash PASS, but the first physical capture stopped at `fmt_values` before POST. That historical failure was corrected in `validate_canonical_wav()` and is retained in the progress history.

**Gate 3 latest physical status 2026-08-14 16:11:** `PASS`. One fresh COM7 capture detected wake, recorded and completed silence-based WAV capture, passed canonical WAV validation, generated UUID `727675d7-46d2-424d-ab6f-5c3898f04c96`, wrote `80,940/80,940` bytes, received HTTP `202 processing`, and passed response request-ID/status correlation in the firmware parser. Downstream naturally produced `request_failed` and an error tone due noise classification; Gate 4 remains pending and is not claimed PASS. Sanitized evidence: `serial-step3-corrective-gate3-2026-08-14-sanitized.log`.

## Gate 4 — Event, download, playback

- [ ] Parse `display_status`, `audio_ready`, dan `request_failed`.
- [ ] Cocokkan semua event dengan `request_id`.
- [ ] GET MP3 via HTTPS; cek status, content type, dan content length.
- [ ] Jangan retry HTTP `410`.
- [ ] Bedakan download/decode/playback failure.
- [ ] Kirim `audio_playback_done` hanya setelah playback selesai.
- [ ] Simpan pending result bila WS offline.

**Gate 4 implementation/build status 2026-08-15:** `PASS`. Static review, one official WiFi-revision build, exact artifact flash to ESP32-S3/COM7, and write verification `4/4` passed. Physical acceptance remains `PENDING / RECORDING_NOT_COMPLETING`: the latest fresh authenticated capture detected `Hi Joy` and `Recording started`, but no recording completion/WAV event appeared within 300 seconds. No Step 4 request ID, audio byte count, HTTP audio response, decoder result, playback result, or `audio_playback_done` is claimed. Logs: `serial-step5-gate4-2026-08-15-sanitized.log`; earlier blockers remain recorded in the Step 4 logs.

**Gate 4 PASS:** satu transaksi voice selesai sampai backend menerima outcome playback.

## Gate 5 — Reconnect dan production sign-off

- [ ] Jalankan acceptance matrix pada `06-PHASE-5-ERROR-RECONNECT-ACCEPTANCE.md`.
- [ ] **Wajib:** tutup uji idle network loss → recovery → re-authentication yang berstatus `DEFERRED_TO_GATE_5`; gunakan disconnect alami saat Step 3/4 bila tersedia, atau isolasi sinyal ESP secara fisik dengan serial tetap menyala jika diotorisasi.
- [ ] Uji disconnect saat thinking dan disconnect setelah audio_ready.
- [ ] Uji credential salah tanpa endless retry.
- [ ] Uji request busy, expired audio, truncated download, dan decoder failure jika alat uji memungkinkan.
- [ ] Simpan serial log dan request ID untuk satu transaksi sukses.
- [ ] Review diff: hanya ESP/protocol changes yang diperlukan; tidak ada token/secret.
- [ ] Tandai follow-up non-blocking secara terpisah; jangan memasukkannya ke scope target hari ini.

**Gate 5 PASS:** P0/P1 inti lulus dan ESP dapat berkomunikasi end-to-end secara repeatable.

## Urutan file yang disarankan

1. `esp/main/api.cpp` — endpoint, TLS, auth, WS, upload/download, response/event handling.
2. `esp/main/api.h` — state/result declarations yang diperlukan.
3. `esp/main/wifi.cpp`/`wifi.h` — SNTP readiness.
4. `esp/main/state.cpp`/`state.h` — gate authenticated, active request, pending outcome.
5. `esp/main/audio.cpp`/`audio.h` — return status dan playback error classification.
6. `esp/main/main.cpp` — urutan initialization bila diperlukan.
7. `esp/main/wakeword.cpp`/`wakeword.h` — hanya jika verifikasi WAV gagal.
8. `esp/sdkconfig`/build files — hanya untuk memastikan TLS bundle dan component support.

## Aturan berhenti

- Token belum tersedia: berhenti di Gate 0.
- TLS/hostname verification gagal: berhenti di Gate 1; jangan menguji audio dengan insecure workaround.
- Auth belum PASS: jangan mencoba upload.
- Upload belum dapat dikorelasikan dengan UUID: jangan lanjut playback.
- Backend production error yang tidak berasal dari ESP: kumpulkan response/log dan laporkan; jangan mengubah kontrak backend dari sisi firmware.
