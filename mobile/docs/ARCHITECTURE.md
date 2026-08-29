# Joy Mobile — Architecture & Design System Specification

> **Version**: 1.0.0  
> **Target Framework**: Expo SDK 57 (React Native 0.86.2, React 19.2.3, Expo Router v4)  
> **Status**: Production Canonical  

---

## 1. Architectural Philosophy

Joy Mobile is engineered using **Clean Architecture** combined with **Atomic Design** and **Feature-Sliced modularity**. The design ensures strict separation of concerns, high testability, easy maintainability, and seamless synchronization with the Joy Backend and ESP32-S3 Hardware Client.

```
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│    (Screens, Bottom Sheets, Molecules, Atoms, Hooks)   │
└──────────────────────────┬─────────────────────────────┘
                           │ (observes & invokes)
┌──────────────────────────▼─────────────────────────────┐
│                      Domain Layer                      │
│   (Entities, Models, Pure Business Logic, Error Maps)  │
└──────────────────────────▲─────────────────────────────┘
                           │ (implements & provides)
┌──────────────────────────┴─────────────────────────────┐
│                       Data Layer                       │
│    (REST API, Mobile WebSocket, SecureStore, Cache)    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure & Layer Responsibilities

```text
src/
├── app/                                 # Expo Router Navigation Roots
│   ├── _layout.tsx                      # Root Provider Shell & Font / Theme Setup
│   └── index.tsx                        # Main Chat & Shell Entry Screen
├── components/                          # Shared Design System
│   └── ui/                              # Reusable Atomic UI Primitives
│       ├── themed-view.tsx              # Theme-aware Container
│       ├── themed-text.tsx              # Token-based Typography Component
│       ├── modal-bottom-sheet.tsx       # Standard Gesture-Driven Bottom Sheet
│       ├── liquid-glass-back-button.tsx # Glassmorphism Back Navigation Button
│       ├── liquid-glass-icon-button.tsx # Glassmorphism Action Icon Button
│       ├── animated-dropdown-overlay.tsx# Dropdown Menu Container
│       ├── dropdown-menu.tsx            # Context Menu List
│       └── ...
├── constants/
│   └── theme.ts                         # Canonical Design Tokens Single Source of Truth
├── features/                            # Feature-Sliced Functional Modules
│   ├── auth/                            # User Registration, Login & Google OAuth
│   │   ├── domain/                      # Auth types, validation, session models
│   │   ├── data/                        # Auth REST API, Google OAuth, SecureStore
│   │   ├── presentation/                # Auth screens, sheets, provider context
│   │   └── components/                  # Feature-specific UI components
│   ├── chat/                            # Realtime AI Chat, TTS Speech, History
│   │   ├── domain/                      # Chat session & message entities
│   │   ├── data/                        # Chat REST API, TTS API, session stores
│   │   ├── presentation/                # MainChatScreen, SidebarShell
│   │   └── components/                  # Chat bubbles, action bar, input composers
│   ├── robot/                           # ESP32 Companion Pairing & Telemetry
│   │   ├── domain/                      # Device models, status mappers
│   │   ├── data/                        # Device API, connection store, telemetry hook
│   │   ├── presentation/                # RobotScreen, RobotPairSheet
│   │   └── components/                  # Robot hero cards, 6-digit code inputs
│   ├── schedules/                       # Proactive Schedules & Execution Tracking
│   │   ├── domain/                      # Schedule models, recurrence rules, formatters
│   │   ├── data/                        # Schedule REST API, schedule store
│   │   ├── presentation/                # SchedulesScreen
│   │   └── components/                  # Schedule cards, recurrence selectors
│   ├── plugins/                         # WhatsApp & Spotify Superpowers
│   │   ├── domain/                      # Plugin models, status enumerations
│   │   ├── data/                        # Plugin API, Spotify API, WhatsApp API
│   │   ├── presentation/                # PluginsScreen, WhatsApp pairing sheets
│   │   └── components/                  # Plugin cards, connection modals
│   ├── notifications/                   # Push Token Registration & Channels
│   │   ├── domain/                      # Notification payloads, permission status
│   │   ├── data/                        # Push token API, notification store
│   │   └── presentation/                # In-app notification hooks
│   └── settings/                        # User Profile, Personalization, Bug Reports
│       ├── domain/                      # Profile & settings models
│       ├── data/                        # Profile API, memory API, bug report API
│       ├── presentation/                # EditProfile, Memory, Upgrade sheets
│       └── components/                  # Setting rows, toggle cards, textareas
├── hooks/                               # Cross-cutting React Hooks
│   ├── use-step-slide-transition.ts     # Multi-step Sheet Slide Animator
│   └── ...
└── lib/
    └── api/                             # Network Infrastructure Layer
        ├── config.ts                    # Base URL & endpoint resolution
        ├── index.ts                     # Generic typed HTTP client (apiRequest)
        ├── mobile-websocket.ts          # Authenticated Mobile WSS Client
        └── request-id.ts                # UUIDv4 Correlation ID Generator
```

---

## 3. State Management Strategy

Joy Mobile employs lightweight, reactive in-memory stores with observer patterns and encrypted persistent storage:

### A. Encrypted Token & Session Persistence (`SecureStore`)
- User credentials, JWT access tokens, and refresh tokens are stored in hardware-encrypted storage using `expo-secure-store`.
- Automatically restored upon app boot to maintain persistent user sessions.

### B. In-Memory Reactive Stores
- Lightweight stores manage state subscriptions without heavy boilerplate:
  - `ChatSessionStore`: Active chat session, message list, pagination cursor, and streaming tokens.
  - `RobotConnectionStore`: Current paired device, connection status, WiFi RSSI, battery, and telemetry.
  - `ScheduleStore`: Schedules list, status filters, and active recurrence edits.
  - `NotificationStore`: Unread badges, notification history, and permission state.
  - `PluginCatalogStore`: Installed superpower plugins, connection statuses, and WhatsApp session state.

### C. State Synchronization via WebSocket
- Real-time updates from the backend WebSocket (`/api/v1/ws`) directly mutate the respective stores, triggering instant React re-renders via `useSyncExternalStore` or React `useState`/`useEffect` hooks.

---

## 4. Design System & Tokens (`src/constants/theme.ts`)

All UI styling is strictly governed by design tokens. Direct hardcoding of hex colors, pixel margins, font sizes, or z-indices in component files is strictly prohibited.

### A. Color Palette & Theming
```typescript
export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
    cardBackground: '#F4F4F5',
    border: '#E4E4E7',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
    cardBackground: '#1E2022',
    border: '#272A2D',
  },
};
```

### B. Standard Spacing Scale
```typescript
export const Spacing = {
  half: 4,
  one: 8,
  two: 16,
  three: 24,
  four: 32,
  five: 40,
  six: 48,
};
```

### C. Typography Tokens
- **Font Families**: Standard system sans-serif with strict cross-platform fallbacks.
- **Sizes**: `xs (12px)`, `sm (14px)`, `base (16px)`, `lg (18px)`, `xl (20px)`, `2xl (24px)`, `3xl (30px)`.
- **Weights**: `regular (400)`, `medium (500)`, `semibold (600)`, `bold (700)`.

### D. Layering & Elevation
Centralized z-index layers prevent modal clashing and dropdown clipping:
- `base: 0`
- `dropdown: 100`
- `modalBackdrop: 500`
- `bottomSheet: 1000`
- `topOverlay: 2000`

---

## 5. Network & Communication Infrastructure

### A. Unified REST API Client (`src/lib/api/index.ts`)
- **Base URL Resolution**: Resolves from `EXPO_PUBLIC_API_BASE_URL` with fallback to `https://api.personalbmo.web.id`.
- **Automatic Auth Token Injection**: Injects `Authorization: Bearer <accessToken>` headers automatically on authenticated endpoints.
- **Automatic Token Refresh**: Automatically intercepts `401 Unauthorized` responses, triggers `/auth/refresh` using the stored refresh token, and retries the original request.
- **Correlation ID**: Generates and attaches `X-Request-Id: UUIDv4` on every HTTP mutation for distributed end-to-end tracing.
- **Typed Errors**: Automatically parses API error payloads (`{ error: { code, message } }`) into strongly typed `ApiError` exceptions.

### B. Dedicated Mobile WebSocket Client (`src/lib/api/mobile-websocket.ts`)
- Connects to dedicated mobile endpoint `wss://api.personalbmo.web.id/api/v1/ws`.
- Authenticates upon connection open with `{"event":"authenticate", "accessToken":"<JWT>"}`.
- Reconnects automatically with exponential backoff and jitter upon network drops.
- Event multiplexer dispatches incoming events (`chat_message`, `device_status`, `schedule_status`, `whatsapp_notification`) to registered store handlers.

---

## 6. Audio & Speech Synthesis Architecture

```
User Action / Message Ready
        │
        ▼
  useMessageSpeech Hook
        │
        ├──▶ Check Local Audio Cache (FileSystem.cacheDirectory)
        │       │
        │       ├── [Cache Hit] ──▶ Play via Expo Audio Player
        │       │
        │       └── [Cache Miss] ──▶ POST /api/v1/tts/synthesize
        │                                  │
        │                                  ▼
        │                            Normalize Audio URL
        │                                  │
        │                                  ▼
        │                            Stream / Play MP3
        │                                  │
        │                                  ▼
        │                            Cache to Disk
        │
        └──▶ Fallback (if offline/failed) ──▶ Expo Speech (Native OS TTS)
```

1. **Joy TTS API**: High-quality neural voice synthesized on backend (`POST /api/v1/tts/synthesize`).
2. **Audio URL Normalization**: Dynamically transforms relative `/audio/<id>.mp3` paths into fully qualified HTTPS URLs based on `API_ORIGIN`.
3. **Low-Latency Streaming**: Streams and buffers MP3 audio for immediate playback via `@expo/ui` / `expo-audio`.
4. **Resilient Fallback**: Gracefully falls back to offline device OS text-to-speech (`expo-speech`) if backend TTS is unreachable.

---

## 7. Quality & Verification Standards

- **TypeScript Strictness**: `strict: true` in `tsconfig.json`, no `any` types in domain/data contracts.
- **Figma Code Connect**: UI components mapped to Figma component definitions via `@figma/code-connect`.
- **E2E Visual Verification**: Maestro UI automation test suites located in `.maestro/`.
