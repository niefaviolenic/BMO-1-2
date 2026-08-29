# Joy Mobile — REST API & WebSocket Protocol Specification

> **Base URL**: `https://api.personalbmo.web.id/api/v1`  
> **Mobile WebSocket URL**: `wss://api.personalbmo.web.id/api/v1/ws`  
> **Status**: Production Canonical Specification  

---

## 1. Global Request & Response Conventions

### A. HTTP Headers
All authenticated REST requests from Joy Mobile must include the following headers:

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: application/json
X-Request-Id: <UUIDv4>
```

### B. Standard Error Response Schema
When a request fails, the API returns a standard JSON error envelope:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Human readable explanation of the error",
    "details": {}
  }
}
```

---

## 2. Authentication API (`/auth`)

### A. Register New Account
- **Endpoint**: `POST /auth/register`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "displayName": "Jane Doe",
    "dateOfBirth": "1998-05-20",
    "clientDeviceId": "optional-device-uuid"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "session": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "expiresIn": 3600
    },
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "displayName": "Jane Doe",
      "username": "janedoe",
      "avatarUrl": null
    }
  }
  ```

### B. Account Login
- **Endpoint**: `POST /auth/login`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "clientDeviceId": "optional-device-uuid"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "session": { "accessToken": "...", "refreshToken": "...", "expiresIn": 3600 },
    "user": { "id": "...", "email": "...", "displayName": "..." }
  }
  ```

### C. Google OAuth Login
- **Endpoint**: `POST /auth/google`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "idToken": "google-oauth-id-token",
    "clientDeviceId": "optional-device-uuid"
  }
  ```
- **Response `200 OK`**: Session and user object.

### D. Refresh Session Token
- **Endpoint**: `POST /auth/refresh`
- **Auth Required**: No (uses refresh token)
- **Request Body**:
  ```json
  { "refreshToken": "eyJhbGciOi..." }
  ```
- **Response `200 OK`**:
  ```json
  {
    "session": {
      "accessToken": "new-jwt-access-token",
      "refreshToken": "new-jwt-refresh-token",
      "expiresIn": 3600
    }
  }
  ```

### E. Logout
- **Endpoint**: `POST /auth/logout` (Current session) | `POST /auth/logout-all` (All devices)
- **Auth Required**: Yes
- **Response `200 OK`**: `{ "ok": true }`

---

## 3. Conversational AI Chat API (`/chat`)

### A. List Chat Sessions
- **Endpoint**: `GET /chat/sessions`
- **Auth Required**: Yes
- **Response `200 OK`**:
  ```json
  {
    "sessions": [
      {
        "id": "session-uuid",
        "title": "Discussion about Quantum Computing",
        "temporary": false,
        "pinned": false,
        "createdAt": "2026-08-20T10:00:00Z",
        "updatedAt": "2026-08-20T10:05:00Z"
      }
    ]
  }
  ```

### B. Create Chat Session
- **Endpoint**: `POST /chat/sessions`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  { "temporary": false }
  ```
- **Response `201 Created`**: Session object.

### C. List Messages in Session
- **Endpoint**: `GET /chat/sessions/:sessionId/messages?cursor=<cursor>&limit=20`
- **Auth Required**: Yes
- **Response `200 OK`**:
  ```json
  {
    "messages": [
      {
        "id": "msg-uuid",
        "sessionId": "session-uuid",
        "sender": "user",
        "text": "Halo Joy, bagaimana cuaca hari ini?",
        "sourceDeviceId": null,
        "createdAt": "2026-08-20T10:00:00Z"
      },
      {
        "id": "msg-uuid-2",
        "sessionId": "session-uuid",
        "sender": "assistant",
        "text": "Hari ini cerah berawan dengan suhu 28°C!",
        "sourceDeviceId": null,
        "createdAt": "2026-08-20T10:00:02Z"
      }
    ],
    "nextCursor": "cursor-string-or-null"
  }
  ```

### D. Send Message
- **Endpoint**: `POST /chat/sessions/:sessionId/messages`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "idempotencyKey": "uuid-v4-string",
    "text": "Ceritakan lelucon lucu dong!",
    "speakOnDevice": false
  }
  ```
- **Response `202 Accepted`**:
  ```json
  {
    "id": "msg-uuid",
    "sessionId": "session-uuid",
    "status": "processing"
  }
  ```

### E. Message Feedback
- **Endpoint**: `POST /chat/messages/:messageId/feedback`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "rating": "positive",
    "reason": "Very helpful and accurate answer"
  }
  ```
- **Response `200 OK`**: Feedback confirmation record.

---

## 4. Text-to-Speech (TTS) API (`/tts`)

### A. Synthesize Speech Audio
- **Endpoint**: `POST /tts/synthesize`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  { "text": "Halo! Aku Joy, asisten AI pribadimu." }
  ```
- **Response `200 OK`**:
  ```json
  {
    "audioUrl": "https://api.personalbmo.web.id/audio/a1b2c3d4-e5f6-7890.mp3",
    "audioId": "a1b2c3d4-e5f6-7890"
  }
  ```
  *(Note: Audio files are ephemeral public MP3 streams with TTL = 300s)*

---

## 5. Robot Companion Management API (`/devices`)

### A. Claim / Pair Robot via 6-Digit PIN
- **Endpoint**: `POST /devices/claim`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  { "code": "123564" }
  ```
- **Response `200 OK`**:
  ```json
  {
    "device": {
      "id": "joy-001",
      "name": "Joy Robot",
      "status": "ONLINE",
      "lastSeenAt": "2026-08-27T08:30:00Z"
    }
  }
  ```

### B. List User Paired Devices
- **Endpoint**: `GET /devices`
- **Auth Required**: Yes
- **Response `200 OK`**: List of claimed devices.

### C. Unpair / Disconnect Robot
- **Endpoint**: `DELETE /devices/:deviceId`
- **Auth Required**: Yes
- **Response `200 OK`**: `{ "ok": true }`

### D. Get Device Telemetry & WiFi
- **Endpoint**: `GET /devices/:deviceId/telemetry` | `GET /devices/:deviceId/wifi`
- **Auth Required**: Yes
- **Response `200 OK`**:
  ```json
  {
    "telemetry": {
      "online": true,
      "batteryPercent": 85,
      "cpuFreqMhz": 240,
      "freeHeapBytes": 184520,
      "lastSeenAt": "2026-08-27T08:30:00Z"
    }
  }
  ```

---

## 6. Proactive Schedules API (`/schedules`)

### A. List Schedules
- **Endpoint**: `GET /schedules`
- **Auth Required**: Yes
- **Response `200 OK`**:
  ```json
  {
    "schedules": [
      {
        "id": "sched-uuid",
        "prompt": "Ingatkan aku minum vitamin dan air putih",
        "status": "ACTIVE",
        "frequency": "Daily",
        "timeOfDay": "Morning",
        "deliveryTargets": ["MOBILE", "DEVICE"],
        "nextRunAt": "2026-08-28T08:00:00Z",
        "version": 1
      }
    ]
  }
  ```

### B. Create Schedule
- **Endpoint**: `POST /schedules`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "prompt": "Ingatkan briefing tim engineering",
    "frequency": "Daily",
    "every": 1,
    "timeOfDay": "Morning",
    "deliveryTargets": ["MOBILE"]
  }
  ```
- **Response `201 Created`**: Schedule object.

### C. Pause / Resume / Cancel Schedule
- **Endpoints**:
  - `POST /schedules/:id/pause`
  - `POST /schedules/:id/resume`
  - `DELETE /schedules/:id`
- **Request Body**: `{ "version": 1 }` (Optimistic lock version)

---

## 7. Superpower Plugins API (`/plugins`)

### A. List Plugin Catalog
- **Endpoint**: `GET /plugins`
- **Auth Required**: Yes
- **Response `200 OK`**: Catalog of plugins (`whatsapp`, `spotify`) with `status`: `CONNECTED`, `DISCONNECTED`, `PENDING`.

### B. WhatsApp Hermes Endpoints
- `POST /plugins/whatsapp/start` — Initializes WhatsApp Web bridge, returns QR string & 8-digit pairing code.
- `GET /plugins/whatsapp/status` — Checks WhatsApp bridge health and connection state.
- `GET /plugins/whatsapp/contacts` — Fetches allowed contact list for notifications.
- `POST /plugins/whatsapp/disconnect` — Unlinks WhatsApp session.

### C. Spotify Endpoints
- `POST /plugins/spotify/auth-url` — Generates Spotify OAuth link.
- `GET /plugins/spotify/status` — Checks Spotify connection state.
- `GET /plugins/spotify/player` — Current playing track info.
- `POST /plugins/spotify/play`, `POST /plugins/spotify/pause`, `POST /plugins/spotify/next`, `POST /plugins/spotify/previous` — Playback controls.

---

## 8. Mobile WebSocket Specification (`wss://.../api/v1/ws`)

### A. Connection & Handshake
1. Client connects via TLS: `wss://api.personalbmo.web.id/api/v1/ws`.
2. First frame sent within 5 seconds:
   ```json
   {
     "event": "authenticate",
     "accessToken": "<JWT_ACCESS_TOKEN>"
   }
   ```
3. Backend responds:
   ```json
   {
     "event": "authenticated",
     "status": "ok"
   }
   ```

### B. Inbound Events to Mobile

| Event Name | Key Fields | Description |
|---|---|---|
| `chat_thinking` | `sessionId`, `messageId` | Assistant has begun processing a response |
| `chat_message` | `sessionId`, `message: { id, sender, text, createdAt }` | Inbound chat message stream chunk or completion |
| `chat_title_updated` | `sessionId`, `title` | Auto-generated title for a conversation |
| `device_status` | `deviceId`, `online`, `wifi: { connected, rssi }`, `battery: { supported, percent }` | Real-time physical robot telemetry |
| `voice_processing_status` | `deviceId`, `requestId`, `status: ("thinking"\|"audio_ready"\|"completed"\|"failed")` | Real-time robot voice pipeline progress |
| `schedule_status` | `scheduleId`, `runId`, `status`, `statusLabel` | Real-time schedule trigger & execution |
| `integration_status` | `integration: ("whatsapp"\|"spotify")`, `status` | Plugin connection state change |
| `whatsapp_notification` | `conversationId`, `displayName`, `conversationType`, `receivedAt` | Urgent WhatsApp message forward |
| `notification` | `id`, `type`, `title`, `body`, `createdAt` | General system / app notification |
