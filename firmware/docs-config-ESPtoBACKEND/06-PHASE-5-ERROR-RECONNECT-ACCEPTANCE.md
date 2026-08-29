# Phase 5 — Error, Reconnect, dan Acceptance Production

Prioritas: **wajib / P1 sebelum sign-off hari ini**. Ini bukan refactor besar; hanya memastikan blocker komunikasi tidak berubah menjadi silent failure atau loop berbahaya.

## Perubahan minimum

### State dan timeout

File: `esp/main/api.cpp`, `esp/main/state.cpp`/`state.h`, `esp/main/main.cpp`.

- Satu device hanya memiliki satu request aktif. Semua event dan response dikorelasikan dengan UUID request.
- Gunakan batas pipeline backend 300 detik; bedakan timeout upload transport, timeout download, dan timeout pipeline.
- Setelah request terminal (`request_failed`, completed, atau playback acknowledgement), bersihkan state aktif dengan aman.
- Jangan melakukan blocking delay panjang di callback WebSocket. Set flag/queue dan proses dari loop/state task yang sudah ada, terutama untuk error tone dan playback.

### Retry policy

- Retry hanya untuk transport/disconnect dan error server yang transient.
- Gunakan backoff terbatas; reset setelah operasi sukses.
- Jangan retry credential `401`, format `413/415/422`, `REQUEST_ID_CONFLICT`, atau audio `410`.
- Retry request upload memakai UUID dan body yang sama.
- Retry download hanya jika URL belum expired; `410` terminal.
- Setelah beberapa kegagalan berturut-turut, kembali ke state idle/error yang dapat dipulihkan dan tampilkan diagnostic tanpa mengunci device.

### Error reason yang benar

- Gagal membuka/menerima file MP3: `DOWNLOAD_FAILED`.
- File diterima tetapi decoder menolak: `DECODE_FAILED`.
- Decoder berhasil tetapi speaker/I2S/playback tidak selesai: `PLAYBACK_FAILED`.
- Backend `request_failed` harus ditampilkan/log berdasarkan `code`; jangan mengubah semua code menjadi satu pesan lokal yang menyembunyikan penyebab.

### Credential dan observability

- Log boleh mencatat host, status HTTP, event, request ID, dan error code; tidak boleh mencatat token atau audio credential.
- Sertakan request ID dalam log supaya satu transaksi dapat ditelusuri di backend dan monitor ESP.
- Catat reason reconnect dan jumlah retry.

## Acceptance matrix

| Skenario | Expected result |
|---|---|
| Boot dari Wi-Fi publik | SNTP valid, WSS production connected, `authenticated` diterima. |
| Token salah | `authentication_failed`/`4003`, berhenti retry credential. |
| DNS/Internet putus sebelum upload | Tidak upload; reconnect dengan backoff, device tetap recoverable. |
| WS putus saat idle | Reconnect + authenticate; tidak ada request baru. Untuk run 2026-08-14: `DEFERRED_TO_GATE_5 / BLOCKED_BY_NETWORK_AUTHORITY`; requirement tetap wajib sebelum sign-off. |
| WS putus saat `thinking` | Setelah reconnect, request ID aktif tetap dikenali dan flow dilanjutkan. |
| HTTP upload `202` | Tunggu event WS; tidak melakukan upload ulang tanpa kebutuhan. |
| HTTP upload `409 WEBSOCKET_NOT_CONNECTED` | Pulihkan WS lalu retry ID/body yang sama. |
| HTTP upload `409 DEVICE_BUSY` | Tidak membuat loop request kedua; tunggu/beri status busy. |
| HTTP upload `401` | Provisioning error yang jelas; tidak retry buta. |
| Pipeline >90 detik tetapi <300 detik | ESP tetap menunggu dan memproses hasil. |
| `request_failed: NO_SPEECH` | Tidak mencoba download audio; kembali ke idle sesuai recoverable flag. |
| `audio_ready` valid | Satu download, playback, lalu `audio_playback_done`. |
| MP3 expired (`410`) | Tidak retry; hasil `AUDIO_EXPIRED`/failure tercatat. |
| Download terpotong | Tidak playback sebagai sukses; `DOWNLOAD_FAILED`. |
| Decode gagal | `DECODE_FAILED`. |
| Playback/I2S gagal | `PLAYBACK_FAILED`. |
| WS putus setelah playback | Pending acknowledgement terkirim setelah re-auth, satu kali. |
| Backend connection replacement | Koneksi lama tidak mengirim event lanjutan; koneksi baru menjadi authoritative. |

## Deferred Step 2 acceptance wajib Gate 5

Skenario idle network loss → recovery → re-authentication tetap wajib sebelum Gate 5 / production sign-off. Status saat ini adalah `DEFERRED_TO_GATE_5` dengan alasan: `Deferred karena operator tidak memiliki wewenang terhadap AP/router; bukan kegagalan firmware.`

Pelaksanaan hanya boleh menggunakan salah satu cara yang tidak menyentuh jaringan: isolasi sinyal ESP secara fisik sementara dengan serial tetap menyala, misalnya RF-shield/enclosure sementara atau memindahkan ESP keluar-masuk jangkauan AP. Disconnect alami yang terjadi saat Step 3 atau Step 4 boleh dipakai sebagai evidence. Jangan melakukan deauthentication, packet injection, perubahan router, atau perubahan backend.

## Bukti yang wajib dikumpulkan

- Commit/working diff hanya berisi perubahan ESP yang terkait plan.
- Build sukses dengan konfigurasi production tanpa token masuk tracked file.
- Serial log boot sampai `authenticated` tanpa credential.
- Satu transcript request ID end-to-end: upload → status → `audio_ready`/failure → playback result.
- Hasil setiap skenario acceptance di atas, minimal status PASS/FAIL dan catatan singkat.
- Waktu pengujian dan firmware build identifier agar hasil dapat direproduksi.

## Pass criteria

Semua P0 dan seluruh skenario acceptance inti (fresh connect, auth, upload, audio, done, reconnect, credential error) PASS. Skenario hardening yang tidak dapat diuji tanpa fault injection boleh dicatat sebagai follow-up, tetapi tidak boleh menutupi blocker P0.

Gate 5 tidak boleh dinyatakan production sign-off sebelum deferred idle network loss → recovery → re-authentication ditutup atau diterima secara eksplisit oleh release authority.
