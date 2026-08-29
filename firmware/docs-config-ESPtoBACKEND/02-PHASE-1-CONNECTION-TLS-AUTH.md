# Phase 1 — Production Connection, TLS, Waktu, dan Credential

Prioritas: **wajib / P0**. Semua tahap berikutnya bergantung pada gate ini.

## Hasil yang harus dicapai

ESP dapat resolve `api.personalbmo.web.id`, membuka HTTPS/WSS melalui port 443, memvalidasi TLS, dan memiliki waktu yang benar sebelum koneksi dibuat. Credential production tersedia secara aman dan dapat dipakai oleh HTTP maupun WebSocket.

## Perubahan minimum yang harus dikerjakan

### 1. Ganti target endpoint production

File utama: `esp/main/api.cpp`.

- Ganti konstanta lama `192.168.1.100`, port `3000`, `ws://`, dan `http://` dengan host production dari `01-PRODUCTION-CONTRACT.md`.
- Pastikan WS memakai path `/ws` dan upload memakai `/api/v1/voice`.
- Pastikan URL audio dari backend dipakai apa adanya bila absolute; jangan membentuk URL baru ke host LAN.
- Jangan menambahkan token ke URL atau query.

File review: `esp/main/api.h`, `esp/main/main.cpp`, dan seluruh pemanggil API. Pastikan tidak ada default production yang diam-diam kembali ke host lama.

### 2. Aktifkan validasi TLS pada dua client

File utama: `esp/main/api.cpp`; konfigurasi: `esp/sdkconfig` bila build mengubahnya.

- Gunakan certificate bundle yang sudah tersedia di `sdkconfig`.
- Pasang callback certificate bundle pada konfigurasi HTTP client dan WebSocket client (`esp_crt_bundle_attach` atau equivalent yang digunakan SDK project).
- Jangan memakai `skip_cert_common_name_check`, insecure TLS, atau `cert_pem=NULL` tanpa callback trust yang benar.
- Verifikasi SNI/hostname tetap `api.personalbmo.web.id`, bukan IP address.
- Pertahankan komponen `esp_http_client` dan `esp_websocket_client`; jangan mengganti library tanpa kebutuhan.

Temuan audit yang harus ditutup: konfigurasi bundle sudah ada, tetapi belum dipasang ke client. Header managed WebSocket menyatakan `cert_pem=NULL` tanpa `crt_bundle_attach` tidak memvalidasi server.

### 3. Sinkronkan waktu sebelum TLS

File utama: `esp/main/wifi.cpp` atau helper initialization yang memang dipanggil setelah Wi-Fi connected.

- Inisialisasi SNTP setelah mendapat IP.
- Tunggu sampai epoch valid sebelum `api_init()` membuka WSS/HTTP.
- Bila sync gagal, jangan memaksa handshake TLS; tampilkan status dan retry Wi-Fi/NTP dengan backoff.
- Jangan mengubah zona waktu untuk validasi sertifikat; yang penting epoch benar. Zona waktu aplikasi boleh mengikuti konfigurasi device yang sudah ada.

### 4. Inject credential production

File/config yang mungkin terdampak: `esp/main/api.cpp`, build configuration, provisioning/NVS yang sudah tersedia, atau mekanisme secret lokal project.

- `device_id` tetap `joy-001`.
- Token production harus diberikan operator secara out-of-band.
- Simpan token pada mekanisme yang tidak masuk repository dan tidak dicetak ke log.
- Bila implementasi hari ini memakai build-time define lokal, define itu harus berasal dari file untracked/secret build dan bukan literal placeholder di source tracked.
- Jika token belum tersedia, jangan lanjutkan test authentication; catat blocker credential.

## File/function ESP yang terdampak

- `esp/main/api.cpp`: endpoint constants, HTTP client TLS config, WebSocket TLS config, credential loading.
- `esp/main/api.h`: deklarasi bila initialization/status baru diperlukan.
- `esp/main/wifi.cpp`/`wifi.h`: SNTP sync dan readiness flag.
- `esp/main/main.cpp`: urutan `Wi-Fi → time valid → API init/connect` bila saat ini API dimulai terlalu awal.
- `esp/sdkconfig`: hanya jika certificate bundle/HTTPS support belum terbawa build; jangan melakukan perubahan konfigurasi luas.

## Verifikasi dan evidence

### Static gate

- Search source ESP untuk `192.168.1.100`, `localhost`, `127.0.0.1`, `:3000`, `ws://`, dan `http://` pada jalur komunikasi production. Tidak boleh tersisa pada konfigurasi aktif.
- Search source/logging untuk token literal, `secret acak unik`, atau output credential. Tidak boleh ada.
- Pastikan `CONFIG_MBEDTLS_CERTIFICATE_BUNDLE=y`, default CA bundle, dan HTTPS support tetap aktif.

### Network gate

- Dari jaringan yang sama dengan ESP, `GET https://api.personalbmo.web.id/health` harus mendapat HTTP success.
- DNS domain harus resolve ke endpoint publik; ESP tidak boleh mengarah ke origin `127.0.0.1:3000`.
- Monitor boot harus menunjukkan Wi-Fi/IP, SNTP valid, lalu target host/port 443 tanpa membocorkan token.

### TLS gate

- WSS/HTTPS handshake berhasil dengan hostname production.
- Bila certificate validation sengaja diuji terhadap target salah/sertifikat tidak dipercaya, koneksi harus ditolak. Jangan menerima hasil test yang hanya sukses karena verification dimatikan.

### Pass criteria

Gate PASS hanya jika semua ini benar: waktu valid, health reachable, TLS tervalidasi, token tersedia aman, dan tidak ada fallback aktif ke endpoint dev/LAN. Jika gagal, perbaiki fase ini sebelum mengubah flow audio.

