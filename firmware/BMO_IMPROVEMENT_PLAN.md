# BMO Improvement Plan

## Status dan Batasan

Dokumen ini hanya berisi rencana implementasi. Belum ada perubahan source code, build, flash, atau pemeriksaan ZIP.

Scope dikunci hanya pada empat kebutuhan berikut:

1. Tombol volume realtime.
2. Wakeword "Hi Joy" tidak diubah.
3. Sentuhan menampilkan animasi shy dan memainkan suara lokal, baik saat Wi-Fi terhubung maupun terputus.
4. GPIO17 mengganti ekspresi dan memainkan suara lokal, baik online maupun offline.

Selain empat area tersebut, fitur BMO yang sudah ada harus tetap dipertahankan.

## 1. Tombol Volume Realtime

Bagian terkait:

- `esp/main/button.cpp`
- `esp/main/audio.cpp`
- `esp/main/audio.h`

Rencana perubahan:

- GPIO15 tetap digunakan untuk volume naik dan GPIO16 untuk volume turun.
- Satu penekanan valid mengubah volume tepat satu langkah: `+5` atau `-5`.
- Tombol harus dilepas sebelum penekanan berikutnya diterima.
- Menahan tombol tidak mengulang perubahan volume.
- Debounce 30 ms dipertahankan agar satu penekanan tidak terbaca berkali-kali.
- Rentang volume tetap dibatasi pada `0-100`.
- Pemutaran audio lokal dibuat tidak memblokir pembacaan tombol, sehingga volume bisa berubah saat suara sedang berbunyi.
- Semua jalur audio berhenti memaksa volume kembali ke 100. Volume yang dipilih pengguna menjadi volume aktif bersama untuk suara ekspresi, thinking filler, wake acknowledgment, dan respons suara.
- Setelah BMO restart, volume tetap kembali ke nilai awal 100 seperti perilaku yang ada sekarang. Penyimpanan volume permanen tidak ditambahkan karena tidak termasuk permintaan.
- Tidak menambahkan bunyi indikator, overlay, atau tampilan volume baru.

## 2. Sentuhan Menjadi Shy Animation

Bagian terkait:

- `esp/main/button.cpp`
- `esp/main/display.cpp`
- `esp/main/display.h`
- `esp/main/audio.cpp`
- `esp/main/audio.h`

Rencana perubahan:

- Debounce dan mekanisme satu trigger per sentuhan GPIO14 dipertahankan.
- Sentuhan tidak lagi memanggil alur wakeword atau mulai merekam.
- Sentuhan hanya diterima ketika BMO dalam keadaan idle dan tidak sedang menampilkan pairing atau QR.
- Ekspresi shy dibuat sebagai efek sementara dan tidak dimasukkan ke daftar 10 ekspresi GPIO17. Dengan demikian, urutan ekspresi yang sudah ada tidak berubah.
- Animasi berjalan sekitar 5 detik menggunakan beberapa frame ringan, misalnya mata melirik atau berkedip, pipi malu bergerak, dan perubahan kecil pada mulut.
- Animasi berjalan tanpa menghentikan pembacaan tombol.
- Suara shy menggunakan audio lokal ekspresi `CUTE` yang sudah tersedia, yaitu `esp/main/audio_wav/02.wav`.
- Tidak membuat, mengganti, atau mengedit aset audio.
- Satu sentuhan panjang hanya memicu satu kali.
- Sentuhan baru setelah sensor dilepas akan memulai ulang durasi shy dan mengganti suara lokal sebelumnya.
- Setelah sekitar 5 detik, wajah kembali ke ekspresi `HAPPY`.
- Jika "Hi Joy", pairing, QR, atau keadaan non-idle dimulai ketika shy sedang berjalan, shy langsung berhenti agar tidak menimpa fitur tersebut.
- Alur shy tidak melakukan pemeriksaan Wi-Fi, internet, atau backend sehingga tetap bekerja baik saat BMO online maupun offline.

## 3. GPIO17 Bekerja Online dan Offline

Bagian terkait:

- `esp/main/button.cpp`
- `esp/main/display.cpp`
- `esp/main/audio.cpp`

Urutan ekspresi dan audio lokal yang harus dipertahankan:

| Urutan | Ekspresi | Audio lokal |
| ---: | --- | --- |
| 1 | HAPPY | `01.wav` |
| 2 | CUTE | `02.wav` |
| 3 | EXCITED | `03.wav` |
| 4 | SLEEPY | `04.wav` |
| 5 | ANGRY | `05.wav` |
| 6 | SAD | `06.wav` |
| 7 | WINK | `07.wav` |
| 8 | SURPRISED | `08.wav` |
| 9 | LOVE | `09.wav` |
| 10 | CONFUSED | `10.wav` |

Rencana perubahan:

- Debounce, urutan 10 ekspresi, dan pasangan audio yang sudah ada dipertahankan.
- Pemeriksaan yang mengabaikan GPIO17 ketika backend online dihilangkan.
- Tombol tidak bergantung pada Wi-Fi, alamat IP, internet, atau autentikasi backend.
- GPIO17 tetap hanya aktif ketika BMO idle dan tidak sedang menampilkan pairing atau QR.
- Setiap penekanan lengkap mengganti ekspresi tepat satu kali.
- Permintaan ekspresi terbaru menggantikan suara ekspresi lokal yang masih berjalan.
- Semua audio tetap dimainkan dari aset lokal dan tidak diambil dari internet.

## 4. Perlindungan Wakeword "Hi Joy"

Bagian yang tidak boleh diubah:

- `esp/main/wakeword.cpp`
- `esp/main/wakeword.h`
- Model wakeword "Hi Joy"
- Konfigurasi mikrofon
- Pre-roll audio
- Deteksi diam
- Alur recording dan upload suara

Perubahan pada sentuhan hanya menghentikan pemanggilan `wakeword_task()` dari GPIO14. Deteksi suara "Hi Joy" tetap menggunakan alurnya saat ini.

Jika "Hi Joy" terdeteksi ketika animasi shy atau audio ekspresi lokal sedang berjalan, efek lokal harus berhenti dan tidak boleh menghalangi alur wakeword.

## 5. Fitur dan File di Luar Scope

Tidak direncanakan perubahan pada:

- Wi-Fi dan kredensial.
- Backend, API, dan WebSocket.
- Pairing dan QR.
- Thinking, speaking, error, dan proactive message.
- Pin dan wiring.
- Sepuluh gambar ekspresi yang sudah ada.
- Semua file WAV yang sudah tersedia.
- Partition table dan konfigurasi board.
- File ZIP apa pun.

Dokumentasi atau fitur tambahan di luar kebutuhan ini tidak ditambahkan tanpa persetujuan baru.

## 6. Prioritas Interaksi

Urutan prioritas yang direncanakan:

1. Pairing, QR, wakeword, recording, thinking, speaking, dan error memiliki prioritas tertinggi.
2. GPIO17 dan sentuhan shy hanya aktif ketika BMO idle.
3. Jika GPIO17 ditekan ketika shy berjalan, shy berhenti dan ekspresi GPIO17 menjadi tampilan terbaru.
4. Jika sentuhan baru terjadi ketika audio ekspresi lokal berjalan, efek shy menjadi permintaan terbaru.
5. Tombol volume selalu dapat digunakan, termasuk ketika audio sedang dimainkan.

## 7. Rencana Pengujian

### Tombol volume

- Satu tekan GPIO15 menghasilkan satu kenaikan volume.
- Satu tekan GPIO16 menghasilkan satu penurunan volume.
- Menahan tombol tidak mengulang volume.
- Dua atau tiga penekanan menghasilkan dua atau tiga perubahan.
- Volume tidak melewati 0 atau 100.
- Volume berubah secara audible ketika audio sedang berjalan.
- Suara berikutnya tidak mengatur volume kembali ke 100.

### Sentuhan shy

- Satu sentuhan stabil hanya memicu satu kali.
- Sentuhan tidak memulai recording dan tidak memanggil alur wakeword.
- Shy menampilkan animasi bergerak sekitar 5 detik.
- Audio `CUTE` lokal dimainkan baik saat Wi-Fi terhubung maupun terputus.
- Setelah selesai, ekspresi kembali ke `HAPPY`.
- Pairing, QR, atau perubahan dari idle menghentikan shy dengan aman.

### GPIO17

- Setiap tekan mengganti satu ekspresi sesuai urutan lama.
- Ekspresi membungkus kembali setelah `CONFUSED`.
- Audio tetap sesuai dengan ekspresi yang dipilih.
- Tombol bekerja saat Wi-Fi terhubung.
- Tombol bekerja saat Wi-Fi terputus.
- Pairing dan QR tetap tidak dapat ditimpa.

### Perlindungan fitur lama

- Source dan model wakeword tidak berubah.
- Seluruh tes kontrak "Hi Joy" tetap lulus.
- Alur recording, thinking, speaking, dan backend tetap seperti baseline.
- Seluruh tes firmware yang sudah ada dijalankan untuk mendeteksi regresi.

## 8. Tahapan Persetujuan

1. Dokumen plan disetujui.
2. Coding dan pengeditan source hanya dimulai setelah ada perintah terpisah.
3. Pengujian source dilakukan setelah implementasi mendapat izin.
4. Build hanya dilakukan setelah ada izin build.
5. Flash hanya dilakukan setelah ada izin flash dan target perangkat sudah dipastikan.
