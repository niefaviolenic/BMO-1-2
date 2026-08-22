# Phase 3 — HTTP Audio Upload dan Response Handling

Prioritas: **wajib / P0**. Tahap ini dilakukan setelah WSS/authentication PASS.

## Target request

ESP mengirim raw WAV canonical ke `POST https://api.personalbmo.web.id/api/v1/voice` dengan:

- `Content-Type: audio/wav`;
- `Content-Length` sama persis dengan jumlah byte body;
- `X-Device-Id` dan `X-Device-Token`;
- `X-Request-Id` UUID v4;
- body tidak dibungkus JSON, multipart, base64, atau metadata tambahan.

Rekaman yang dihasilkan `wakeword.cpp` sudah sesuai kandidat format: PCM mono 16 kHz 16-bit dengan header WAV 44 byte. Implementer tetap harus memverifikasi byte header dan ukuran aktual sebelum upload.

## Perubahan minimum

### Request construction

File utama: `esp/main/api.cpp`, dengan sumber rekaman di `esp/main/wakeword.cpp` bila hasil verifikasi menemukan header/ukuran salah.

- Jangan upload sebelum `ws_authenticated=true`.
- Buat satu UUID v4 per transaksi baru dan simpan bersama buffer WAV.
- Saat retry request yang sama, gunakan UUID dan body yang sama.
- Pastikan `esp_http_client_open(client, wav_byte_size)` benar-benar menghasilkan `Content-Length` aktual; validasi nilai return.
- Tulis body sampai seluruh `wav_byte_size` terkirim; short write harus dianggap gagal, bukan sukses parsial.
- Validasi response body JSON untuk `request_id` dan `status`, bukan hanya status HTTP.
- Naikkan timeout pipeline/wait dari 90 detik ke batas backend 300 detik (`TOTAL_PIPELINE_TIMEOUT_MS=300000`). Timeout upload transport dapat tetap lebih pendek, tetapi HTTP/WS wait tidak boleh mematikan transaksi di detik 90.

### Response classification

Implementasikan matrix ini pada fungsi upload/request handling:

| Kondisi | Tindakan |
|---|---|
| `202 processing` | Simpan request aktif; jangan mengirim ulang tanpa alasan transport. Tunggu WS. |
| `200 duplicate` | Parse status. Jika sudah `audio_ready`, lanjutkan download; jika completed/failed, reconcile tanpa request baru. |
| `409 WEBSOCKET_NOT_CONNECTED` | Jangan buang WAV. Pulihkan WSS/auth lalu retry body + request ID yang sama. |
| `409 DEVICE_BUSY` | Jangan retry loop. Pertahankan/selesaikan request aktif; request baru baru boleh setelah backend idle. |
| `409 REQUEST_ID_CONFLICT` | Terminal dan diagnostic; jangan gunakan ID tersebut dengan body lain. |
| `401` | Terminal provisioning error; jangan retry buta. |
| `413/415/422` | Terminal recording/format error; simpan diagnosis. |
| `5xx`, timeout, atau koneksi putus sebelum response | Retry terbatas dengan ID/body sama dan backoff. Hentikan setelah batas yang ditentukan. |

Jangan memetakan semua `4xx` menjadi `INVALID_AUDIO`; mapping tersebut mengaburkan credential, busy, dan koneksi WS.

### Menjaga buffer

- Buffer WAV tidak boleh dibebaskan ketika precheck gagal, WS reconnect, atau HTTP transport retry masih mungkin.
- Setelah response terminal dan/atau playback flow selesai, baru lepaskan buffer.
- Bila RAM tidak cukup untuk menahan buffer selama reconnect, ubah urutan agar ESP memastikan WSS authenticated sebelum mulai merekam; jangan melakukan refactor storage besar untuk target hari ini.

## File/function ESP yang terdampak

- `esp/main/api.cpp`: upload URL, header, body write, response parse, status mapping, timeout, retry.
- `esp/main/api.h`: request result/status atau request ID state.
- `esp/main/state.cpp`/`state.h`: active request lifecycle dan gate authenticated.
- `esp/main/wakeword.cpp`/`wakeword.h`: hanya bila verifikasi WAV menemukan mismatch.

## Verifikasi

1. Satu rekaman 1–5 detik mendapat `202` dan `request_id` sama.
2. Backend menerima header device dan request ID; body lolos canonical WAV validator.
3. Delay pipeline lebih dari 90 detik tidak membuat ESP menyatakan timeout sebelum batas 300 detik.
4. Simulasi/observasi `409 WEBSOCKET_NOT_CONNECTED` membuktikan retry memakai ID dan body yang sama.
5. Upload dengan credential salah berhenti pada `401`, tidak membuat reconnect/upload loop tanpa akhir.
6. Dua upload berurutan ketika request pertama aktif tidak membuat request kedua tanpa penanganan `DEVICE_BUSY`.
7. Re-send request ID dan body yang sama menghasilkan duplicate response yang dapat direkonsiliasi.

### Pass criteria

HTTP upload sukses atau ditangani sesuai matrix tanpa kehilangan rekaman, tanpa duplicate request yang tidak perlu, dan tanpa menunggu pipeline hanya 90 detik.

## Historical implementation and execution status - 2026-08-14

Implementation static review: `PASS`. The change is limited to `esp/main/api.cpp`; `api.h` and the canonical WAV generator in `wakeword.cpp/.h` were not changed. Local WAV validation, full body write, bounded response parsing, UUID/status correlation, typed response classification, same-ID/body retry, terminal cleanup, and the 300-second pipeline timeout are implemented. Evidence: `docs-config-ESPtoBACKEND/step3-static-review-2026-08-14-sanitized.log`.

Official ESP-IDF build: `PASS`, exit code `0`; source fingerprint remained unchanged; `build/all_bmo.bin` and `build/all_bmo.elf` were regenerated and passed size/hash/timestamp checks. Exact artifact flash to verified ESP32-S3/COM7: `PASS`, exit code `0`, four write-hash verifications. Evidence: `build-step3-official-2026-08-14-sanitized.log`, `flash-step3-2026-08-14-sanitized.log`.

Gate 3 runtime acceptance is `READY_FOR_VERIFY`, not yet `PASS`. The bounded serial capture observed microphone peak lines only and did not capture wake detection or an upload transaction. The required evidence remains one 1-5 second operator-triggered recording with local WAV validation, exact byte write count, matching request ID, and valid `202` or duplicate `200` response. No backend, router, credential, build, or flash change is required for the pending capture.

## Historical physical Gate 3 acceptance - 2026-08-14 15:44:53 +07:00

Sanitized COM7 capture was active before the operator test. Wake detection, recording start, silence-based recording completion, and WAV header creation were observed twice. The resulting bodies were 80,940 bytes (`40,448` samples) and 142,380 bytes (`71,168` samples).

Both recordings were rejected locally with `Local WAV validation failed reason=fmt_values` before HTTP POST. Request ID: not generated/observed. Bytes written: `0`. HTTP status: not observed. Response request-ID match: not applicable. No `audio_ready`, download, or playback occurred. Gate 3 is `FAIL` on local firmware validation evidence; no source/build/flash/backend/router action was taken during or after the physical test. Evidence: `docs-config-ESPtoBACKEND/serial-step3-gate3-2026-08-14-sanitized.log`.

## Latest corrective physical Gate 3 acceptance - 2026-08-14 16:11:00 +07:00

The corrected `validate_canonical_wav()` uses the canonical 16-byte `fmt ` payload offsets and never reads beyond `fmt+15`. Static review passed, followed by exactly one corrective official build and one exact-artifact flash; no second build, Ninja, or backend/router action was performed.

Fresh COM7 evidence:

- Wake word and recording lifecycle passed: `Hi Joy detected`, recording started, then ended on silence; WAV body was `80,940` bytes (`40,448` samples).
- Metadata passed: format `1`, mono `1`, sample rate `16000`, byte rate `32000`, block align `2`, bits `16`.
- Local WAV validation: `PASS`.
- UUID/request ID: `727675d7-46d2-424d-ab6f-5c3898f04c96`.
- Full body write: `80,940/80,940` bytes.
- HTTP response: `202`, accepted `processing`, response body length `75` bytes. Response `request_id` equality and `status=processing` were enforced by the firmware parser before the acceptance log; response request-ID match: `PASS` without printing the response body or ID separately.
- Downstream occurred naturally as `request_failed` and an error tone due noise classification. Gate 4 remains pending; no `audio_ready`, download, or playback PASS is claimed.

Gate 3: `PASS`. Sanitized evidence: `docs-config-ESPtoBACKEND/serial-step3-corrective-gate3-2026-08-14-sanitized.log`.
