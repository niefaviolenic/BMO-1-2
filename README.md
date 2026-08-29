# Joy Flat Monorepo

Monorepo terpadu untuk ekosistem **Joy Companion Robot**, menyatukan aplikasi mobile, server backend, dan firmware perangkat keras ESP32 dalam satu git repository tunggal berstruktur flat.

---

## Repository Structure

```text
joy/
├── mobile/       # Aplikasi mobile (Expo / React Native)
├── backend/      # Server API, WebSocket & Voice Pipeline (Express 5, Prisma)
├── firmware/     # Firmware robot ESP32 (ESP-IDF / C++)
├── .gitignore    # Global git ignore multi-stack
└── README.md     # Panduan monorepo
```

Arsitektur menggunakan pola **flat umbrella monorepo** tanpa root `package.json` atau workspace lockfile bersama, menjaga independensi penuh dari toolchain masing-masing komponen.

---

## Subsystems

### 1. Mobile (`mobile/`)
Aplikasi pendamping robot berbasis **Expo React Native** dengan TypeScript.
- **Stack**: Expo SDK 53, React Native, React Navigation / Expo Router, Lucide Icons, Maestro E2E.
- **Menjalankan lokal**:
  ```bash
  cd mobile
  pnpm install
  pnpm dev
  ```
- **Android / iOS**:
  ```bash
  pnpm android   # Menjalankan di Android emulator / device
  pnpm ios       # Menjalankan di iOS simulator
  ```

### 2. Backend (`backend/`)
Server backend utama untuk autentikasi, manajemen state perangkat, integrasi AI, dan pipeline suara real-time via WebSocket.
- **Stack**: Node.js, Express 5, Prisma ORM (PostgreSQL), WebSocket, Vitest.
- **Menjalankan lokal**:
  ```bash
  cd backend
  pnpm install
  pnpm db:generate   # Generate Prisma client
  pnpm dev           # Menjalankan development server
  ```
- **Testing**:
  ```bash
  pnpm test          # Menjalankan unit & integration tests
  ```

### 3. Firmware (`firmware/`)
Firmware tertanam untuk robot Joy berbasis mikroprosesor **ESP32-S3 / ESP32** menggunakan framework ESP-IDF.
- **Stack**: ESP-IDF v5.x, C/C++, FreeRTOS, I2S Audio, WebSocket Client.
- **Kompilasi dan Flash**:
  ```bash
  cd firmware/esp
  idf.py set-target esp32s3
  idf.py build
  idf.py -p /dev/ttyUSB0 flash monitor
  ```

---

## Environment Configuration

Setiap subsystem mengelola file konfigurasi `.env` secara mandiri:
- `mobile/.env.example` $\rightarrow$ `mobile/.env`
- `backend/.env.example` $\rightarrow$ `backend/.env`
- `firmware/.env.example` $\rightarrow$ `firmware/.env`

---

## Git Workflow & Conventions

- Semua commit dilakukan dari root repository `/Users/ranggabiner/binerlabs/joy`.
- Format pesan commit mengikuti Conventional Commits:
  - `feat(mobile): ...`
  - `feat(backend): ...`
  - `feat(firmware): ...`
  - `fix(backend): ...`
  - `chore: ...`
