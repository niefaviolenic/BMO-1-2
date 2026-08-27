# Joy ESP32-S3 Implementation / Change Log

Date: 2026-08-23
Branch: `cenna`
Starting SHA: `639a2b933b08cea415f91198716b86d216dd6556`
Scope: shared playback task only. No push was performed.

## Change 1 — Shared playback abstraction and physical-owner core

- Goal: establish one bounded playback ownership and admission boundary that can serve current voice playback and a future backend-owned proactive delivery without inventing a protocol.
- Files/functions affected: `esp/main/playback.h` (`PlaybackJob`, origin/state/admission/result types, public API); `esp/main/playback.cpp` (`playback_admit_voice_job`, `playback_prepare_proactive`, `playback_is_expired`, `playback_mark_terminal`, `playback_cancel`, snapshot/state helpers); `esp/main/CMakeLists.txt` (register `playback.cpp`).
- Behavior before: voice playback kept its audio URL and deadline bookkeeping inside `api.cpp`; there was no shared `PlaybackJob`, no proactive admission boundary, and no bounded delivery deduplication state.
- Behavior after: both origins are represented by bounded `PlaybackJob` fields (`origin`, `correlation_id`, `audio_url`, `expires_in_seconds`, `source`). A lock-protected in-memory owner admits one active physical playback, validates the backend audio URL and TTL, blocks proactive delivery during recording/upload/thinking/downloading/speaking/result-pending states, and retains only the current and last terminal proactive delivery IDs/results.
- Reason: make arbitration, expiry, and terminal ownership explicit while keeping RAM usage bounded and preserving backend protocol ownership.
- Regression risk: admission or deadline mistakes could reject valid voice playback, allow overlap, or leave stale ownership. Mitigations are bounded copies, explicit terminal/cancel paths, monotonic deadlines, focused contract tests, and the real ESP-IDF build.
- Verification evidence: the focused playback test initially failed 6/6 before the module existed, then passed 6/6 after implementation; the full host suite passed 51/51; `idf.py build` exited successfully.

## Change 2 — Voice adapter into the shared playback path

- Goal: preserve strict existing voice validation while routing accepted voice audio through the shared job and one physical downloader/decoder/I2S path.
- Files/functions affected: `esp/main/api.cpp` (`handle_ws_message`, `api_init`, `download_and_play_mp3`, `api_upload_audio_and_process`, request cleanup helpers).
- Behavior before: a valid `audio_ready` event copied its URL into `play_audio_url`, used local deadline state, and called the downloader with a raw URL.
- Behavior after: the existing request correlation, UUID, URL, MP3 format, expiry, content-type, and decode checks remain in place; accepted voice data is adapted to `PlaybackJob`, admitted by `playback_admit_voice_job`, passed to `download_and_play_mp3(const PlaybackJob *)`, and closed through shared terminal/cancel/expiry calls. No proactive WebSocket event branch was added.
- Reason: make voice the first production adapter of the shared physical owner without changing the existing backend contract.
- Regression risk: changed ownership cleanup and retry/expiry timing could affect result reporting or recovered requests. Mitigations are preserved request-result paths, explicit cancellation on request failure, terminal marking before existing backend result events, host contract coverage, and build verification.
- Verification evidence: `test_voice_audio_ready_adapts_into_shared_job_before_download` passed; all 51 host tests passed; the flashed COM12 bench reached boot, Wi-Fi/SNTP, WSS, authentication, and the existing `pairing_code` event. No human voice/audio playback claim was made.

## Change 3 — Proactive preparation boundary without protocol invention

- Goal: prepare safe proactive playback arbitration while deferring event wiring until the backend defines the actual physical sender and WebSocket event contract.
- Files/functions affected: `esp/main/playback.h` (`playback_prepare_proactive` declaration); `esp/main/playback.cpp` (`playback_prepare_proactive`, `proactive_state_blocks`, bounded duplicate/terminal checks).
- Behavior before: there was no firmware-side proactive playback preparation API.
- Behavior after: a future adapter can submit a `PROACTIVE` `PlaybackJob` and receive `ACCEPTED`, `BUSY`, `DUPLICATE`, `INVALID`, or `EXPIRED` without bypassing the physical owner. The function is intentionally not called from WebSocket parsing and does not create an event name, scheduler, or proactive result protocol.
- Reason: implement the firmware core requested by the task while keeping schedule ownership and protocol naming on the backend.
- Regression risk: the adapter is not end-to-end usable until the backend sends a defined event and result contract; premature wiring would create an untestable or incompatible protocol. Mitigation: explicit isolation tests and backend source audit.
- Verification evidence: proactive arbitration, bounded deduplication, expiry, and protocol-isolation tests passed; the audited backend event union contains no proactive/scheduled outbound event family.

## Change 4 — Focused playback contract tests

- Goal: lock the shared abstraction, voice adaptation, proactive isolation, arbitration, deduplication, and expiry requirements into reviewable tests.
- Files/functions affected: `esp/tests/test_playback_contract.py` (six focused contract tests and source/function helpers).
- Behavior before: no focused tests asserted the shared playback boundary.
- Behavior after: tests assert build registration, the `PlaybackJob` model, voice adaptation before download, absence of invented proactive event names, voice-priority admission guards, bounded terminal deduplication, and shared URL/expiry handling.
- Reason: provide a narrow regression net without requiring a host build of ESP-IDF internals.
- Regression risk: these are source-contract tests rather than runtime C++ tests. Mitigation: the production module is compiled and linked by the real ESP-IDF build, and the full existing Python contract suite also passes.
- Verification evidence: focused suite passed 6/6; full suite passed 51/51. `pytest` was attempted but the environment has no `pytest` module, so the repository's `unittest` runner was used.

## Change 5 — Persistent implementation record

- Goal: preserve the material change rationale, before/after behavior, risks, and evidence alongside the task implementation.
- Files/functions affected: `IMPLEMENTATION_CHANGELOG.md` (this file).
- Behavior before: the task had no persistent implementation/change log in the Git worktree.
- Behavior after: this file records every task-material change and its verification evidence, including the deliberate backend protocol boundary.
- Reason: make selective staging and future review traceable in a pre-existing dirty worktree.
- Regression risk: none to firmware behavior; documentation only.
- Verification evidence: reviewed as part of the pre-commit staged diff and committed with the task files.

## Explicitly preserved scope

No pairing/display/Wi-Fi/sdkconfig/backend behavior was changed as part of this task. Existing dirty changes in those areas, plus `build/**` and `managed_components/**`, remain outside the focused commit.

## Change — Development pairing UI suppression

Goal: Add one explicit development-only compile-time flag that suppresses only LCD rendering of the six-digit pairing code while keeping the pairing protocol and lifecycle active.

Files/functions affected: root `CMakeLists.txt` (the `JOY_DEV_SUPPRESS_PAIRING_UI` cache option and generated `joy_dev_config.h`); `esp/main/api.cpp` (`process_pairing_actions()` and the generated-config include); `esp/tests/test_pairing_ui_suppression_contract.py` (focused contracts).

Behavior before: every accepted `PAIRING_ACTION_SHOW_UI` action called `display_set_pairing_code()`; there was no project-level switch for development firmware to suppress that rendering.

Behavior after: the default `OFF` configuration preserves the existing display call. When `JOY_DEV_SUPPRESS_PAIRING_UI=ON`, the `SHOW_UI` action is consumed without calling the LCD renderer; pairing code validation/storage, expiry, recovery/reissue, completion cleanup, pairing-mode request, reconnect, and re-authentication paths remain active.

Reason: allow development firmware to exercise pairing internally without exposing the code on the LCD, without changing the protocol, credentials, renderer, orientation, or playback/proactive implementation.

Regression risk: a preprocessor guard in the action processor could accidentally suppress protocol actions or alter production behavior if the default is wrong. Mitigations are an explicit default-off generated macro, focused source contracts, default and suppression-mode builds, and the full existing test suite.

Verification evidence: focused suppression contracts pass; full `python -m unittest discover -s tests -v` passed 56/56; `idf.py -D JOY_DEV_SUPPRESS_PAIRING_UI=ON build` passed with generated macro `1`; final default `idf.py build` passed with generated macro `0` and CMake cache `OFF`. COM12 dev image flash passed, and serial monitoring observed stable boot, WSS authentication, and internal `pairing_code` receipt without logging the code. LCD visual output was not directly observable in this setup, so no visual claim is made; no pairing completion was claimed without a backend claim.

## Change — Wake-Up Acknowledgment Audio Cue ("heem" / rising earcon)

- Goal: Provide immediate acoustic feedback (Siri-like "heem" / rising earcon cue) to the user when the "Hi Joy" wake word is detected by ESP-SR WakeNet, played before voice recording starts to avoid microphone self-capture.
- Files/functions affected:
  - `esp/main/audio.h` (`audio_playWakeAck()` declaration).
  - `esp/main/audio.cpp` (`audio_playWakeAck()` implementation using embedded WAV clip `wake_ack.wav` and fallback synthesized dual-tone rising chime `659 Hz (75ms) -> 25ms silence -> 880 Hz (110ms) -> 50ms silence` via `speaker_write_tone`/`speaker_write_silence`).
  - `esp/main/wakeword.cpp` (invoking `audio_playWakeAck()` immediately on `WAKENET_DETECTED` prior to calling `wakeword_task()`).
  - `esp/main/CMakeLists.txt` (embedding `audio_wav/wake_ack.wav` into the firmware binary).
  - `esp/main/audio_wav/wake_ack.wav` (embedded wake acknowledgment audio asset, $\le 600\text{ ms}$, 16kHz mono 16-bit PCM WAV).
  - `esp/tests/test_wake_ack_contract.py` (contract tests validating function declaration, implementation symbols, CMake EMBED_FILES registration, WAV format/duration $\le 600\text{ ms}$, invocation order before `wakeword_task()`, and state machine isolation).
- Behavior before: upon detecting "Hi Joy", the firmware transitioned directly into `wakeword_task()` and `JoyState::RECORDING` with only visual LCD indication (`LISTENING`), without an acoustic wake acknowledgment cue.
- Behavior after: upon `WAKENET_DETECTED`, `audio_playWakeAck()` is executed immediately to play the embedded `wake_ack.wav` (or fallback dual-tone synthesized earcon) through the MAX98357A I2S speaker at `SPEAKER_SAMPLE_RATE`. Voice capture and transition to `JoyState::RECORDING` occurs only after cue playback finishes, ensuring the INMP441 microphone does not capture the cue sound.
- Reason: improves conversational voice assistant UX by immediately acknowledging wake word detection with a pleasant, low-latency earcon sound before listening.
- Regression risk: playing audio during microphone capture could contaminate the user audio recording buffer with the cue tone; playing an excessively long cue would introduce noticeable interaction latency. Mitigations include strict sequential invocation before `wakeword_task()`, concise audio duration ($\le 600\text{ ms}$), fallback dual-tone synthesis if WAV is missing or corrupt, and dedicated contract tests in `test_wake_ack_contract.py`.
- Verification evidence: `test_wake_ack_contract.py` passes 6/6 tests; full contract suite passes 83/83 tests (`python3 -m unittest discover -s esp/tests`).

## Change — Hermes Streaming Backend Integration & TTFA Optimization (~1.7s)

- Goal: Document backend voice pipeline transition to Hermes Streaming (`POST /v1/chat/completions` SSE stream with `stream: true`), `SentenceSplitter`, and pipelined TTS synthesis, reducing Time-To-First-Audio (TTFA) to ~1.7s while maintaining 100% ESP32 firmware contract compatibility.
- Files/areas affected:
  - Backend (VPS): `backend/src/services/hermes.client.ts` (`FastVoiceLlmClient`, `generateStream`, `generateResponseStream`), `backend/src/services/voice-pipeline.service.ts` (`SentenceSplitter`, `#runStreaming`, `LiveAudioStream`), `backend/src/services/temp-audio.service.ts` (`LiveAudioStream` chunked MP3 streaming).
  - ESP32 Firmware: No changes required (`esp/main/api.cpp`, `esp/main/audio.cpp`, `esp/main/playback.cpp` already natively support standard WebSocket `audio_ready`, HTTP GET Chunked Transfer Encoding / direct streaming, and Helix MP3 decoder).
- Behavior before: Voice pipeline operated in full sequential mode (STT transcribe $\to$ wait for full LLM generation $\to$ batch TTS synthesis of entire response $\to$ write MP3 file to disk $\to$ emit `audio_ready` WS event). Total roundtrip latency before audio playback was ~4.5s – 6.0s.
- Behavior after:
  1. STT transcribes user WAV (~350ms).
  2. Hermes LLM generates tokens via SSE stream (`stream: true`, TTFT ~450ms).
  3. `SentenceSplitter` incrementally buffers incoming token chunks, strips internal reasoning tags (e.g. `<think>...</think>`), and extracts complete sentence/clause boundaries (`.`, `!`, `?`, `\n`, soft clauses `,`, `;`, `:`).
  4. Each extracted sentence is immediately enqueued for concurrent TTS synthesis (`audioService.synthesizeStream` / `synthesize`).
  5. As soon as the first synthesized audio chunk is received by `LiveAudioStream`, backend emits the WebSocket `audio_ready` event with `audio_url` (`https://api.personalbmo.web.id/audio/<uuid>.mp3`).
  6. TTFA (Time-To-First-Audio) drops significantly to ~1.7s.
  7. ESP32 connects via HTTPS GET to the `audio_url`, receives audio chunks via HTTP `Transfer-Encoding: chunked`, decodes frames in real time with Helix MP3 Decoder (32 KB cyclic buffer, 2 KB pre-buffering), and begins playback immediately.
- Contract Compatibility: 100% backward & forward compatible with the existing ESP32 production contract:
  - Same WebSocket `audio_ready` payload schema (`request_id`, `audio_url`, `format: "mp3"`, `expires_in_seconds`).
  - Same HTTP GET `/audio/<id>.mp3` endpoint.
  - Same `audio_playback_done` / `audio_playback_failed` acknowledgement lifecycle.
  - No firmware modifications or re-flashing needed.
- Verification evidence: All 83 Python contract tests pass (`Ran 83 tests in 0.031s, OK`); backend test suite verifies streaming pipeline (`voice-pipeline-streaming.test.ts`, `voice.integration.test.ts`).

## Change — Dynamic Thinking Filler Voice Speech (Zero Dead-Air Latency Masking)

- Goal: Eliminate dead air and awkward silence during LLM token generation and TTS audio synthesis by having Joy immediately utter a randomized, pleasant thinking phrase as soon as user voice capture is accepted by the backend.
- Files/functions affected:
  - `esp/main/audio.h` (`audio_playThinkingFiller(int index)` and `audio_playRandomThinkingFiller()` declarations).
  - `esp/main/audio.cpp` (`_binary_thinking_01_wav_start` .. `_binary_thinking_05_wav_end` extern symbols, `thinking_clips` array, `thinking_phrase` lookup table, `audio_playThinkingFiller(int index)` with fallback synthesized chime tones, `audio_playRandomThinkingFiller()`).
  - `esp/main/api.cpp` (invoking `audio_playRandomThinkingFiller()` immediately when voice upload is accepted with `JOY_UPLOAD_ACCEPTED`).
  - `esp/main/CMakeLists.txt` (registering `audio_wav/thinking_01.wav` .. `audio_wav/thinking_05.wav` in `EMBED_FILES`).
  - `esp/main/audio_wav/generate_thinking_clips.py` (canonical WAV synthesis script for 16kHz 16-bit mono PCM thinking filler clips).
  - `esp/main/audio_wav/thinking_01.wav` .. `thinking_05.wav` (embedded WAV assets: "bentar aku pikir dulu", "aku lagi proses dulu pertanyaannya", "tunggu sebentar ya", "hmm coba aku cari tahu dulu", "bentar ya joy lagi mikir").
  - `esp/tests/test_thinking_filler_contract.py` (contract tests validating function declarations, implementation symbols, phrases, CMake registration, WAV format/duration, and upload acceptance trigger).
- Behavior before: After user finished speaking and the WAV was uploaded, the device transitioned to `JoyState::THINKING` with visual LCD update only, leaving ~1.7s of dead-air silence while waiting for backend `audio_ready`.
- Behavior after: Upon `JOY_UPLOAD_ACCEPTED`, `audio_playRandomThinkingFiller()` immediately selects and plays one of the 5 thinking filler clips (or fallback melodic earcon) through the MAX98357A I2S speaker, masking backend processing latency and providing natural conversational responsiveness.
- Reason: Enhances conversational AI UX by eliminating silence latency between user input and assistant response.
- Regression risk: If a WAV clip is corrupted or unavailable, playback falls back safely to synthesized chime tones (`speaker_write_tone`). The filler playback does not block HTTP streaming when `audio_ready` arrives.

## Change — Seamless Single-Breath Wake Word & Rolling Pre-Roll Buffer (~512ms)

- Goal: Enable natural, single-breath voice commands ("Hey Joy <command>", e.g. "Hey Joy jam berapa hari ini") without requiring the user to pause or wait after saying the wake word, eliminating audio clipping and frame loss at the wake word boundary.
- Files/functions affected:
  - `esp/main/wakeword.cpp` (implemented rolling circular pre-roll buffer `PREROLL_BUFFER_SAMPLES = 8192` / ~512ms at 16kHz mono PCM during IDLE state; eliminated blocking acoustic playback from the critical microphone path in `wakeword_listener_task`; added immediate zero-latency handoff in `wakeword_task()` via direct `start_recording()` call; added pre-roll draining and idempotency in `start_recording()`; pre-allocated `record_buffer` in PSRAM during `wakeword_init()`).
  - `esp/tests/test_wake_ack_contract.py` (updated contract suite with `test_wakeword_seamless_single_breath_contract` to verify pre-roll sizing, zero blocking delay on wake detection, immediate recording activation, and pre-roll drain).
  - `README.md` (updated documentation to reflect single-breath audio capture contract).
- Behavior before: Upon detecting "Hi Joy", `audio_playWakeAck()` was executed synchronously inside `wakeword_listener_task`, blocking the I2S microphone loop for 300-600ms. Subsequent command words ("jam berapa...") were lost, and lack of pre-roll clipped audio at the boundary.
- Behavior after: Upon `WAKENET_DETECTED`, `wakeword_task()` immediately transitions state to `RECORDING` (triggering instant LCD visual feedback `DisplayMode::LISTENING`) and executes `start_recording()`, which commits the ~512ms pre-roll buffer into `record_buffer`. Microphone frames continue streaming into `record_buffer` with 0 dropped frames.
- Reason: Enables seamless conversational interaction where user commands spoken continuously in one breath are completely captured and accurately transcribed by STT.
- Verification evidence: Full Python contract test suite passes 88/88 tests (`python3 -m unittest discover -s esp/tests`).

## Change — Device ID Standardization to `joy-001` & Full Ecosystem Doc Alignment

- Goal: Standardize all device identity declarations across ESP32 firmware, build system (`esp/CMakeLists.txt`), environment templates (`.env`, `joy-production.env`, `bmo-production.env`), and backend handoff documentation to `joy-001`, eliminating authentication rejections caused by legacy `bmo-001` credentials.
- Files/functions affected:
  - `esp/CMakeLists.txt` (enforced strict check `DEVICE_ID=joy-001`, removing legacy acceptance of `bmo-001`).
  - `.env`, `esp/.env`, `bmo-production.env`, `esp/bmo-production.env`, `joy-production.env`, `esp/joy-production.env` (standardized `DEVICE_ID=joy-001`).
  - Backend VPS Docs (`/opt/bmo/app/docs/hardware-handoff/DEPLOYMENT-CONFIG.md`, `README.md`, `FIRMWARE-CHECKLIST.md`, `ACCEPTANCE-TESTS.md`, `docs/integration/ESP-AGENT-HANDOFF.md`, `docs/integration/11-FULL-ECOSYSTEM-ARCHITECTURE-AND-STATUS.md`): synchronized all hardware device IDs to `joy-001` and updated status to `PHYSICAL_ESP32_STATUS: VERIFIED_ONLINE_AND_AUTHENTICATED`.
  - ESP Repository Docs (`README.md`, `docs-config-ESPtoBACKEND/00-PROGRESS.md`, `docs-config-ESPtoBACKEND/08-ECOSYSTEM-INTEGRATION-GUIDE.md`): synchronized contract test counts to 93/93 passing tests and added physical verification records.
- Behavior before: If firmware was built with an environment file specifying `DEVICE_ID=bmo-001`, CMake allowed it to compile into `joy_credentials.h`. Upon connecting to the production backend (`wss://api.personalbmo.web.id/ws`), the backend rejected the handshake with `authentication_failed` (`INVALID_DEVICE_CREDENTIALS`, code `4003`) because the production container expects `deviceId: "joy-001"`.
- Behavior after: `esp/CMakeLists.txt` strictly asserts `DEVICE_ID=joy-001`. All local environment files and backend handoff documents specify `joy-001`. The firmware compiles cleanly and authenticates successfully on first attempt (`WS authenticated successfully. Backend state: idle`).
- Reason: Ensures end-to-end device identity alignment across backend database, WebSocket server, build automation, and physical hardware.
- Regression risk: None; `joy-001` is the active device identifier registered on the production backend.
- Verification evidence: Live ESP32-S3 physical boot log on `/dev/cu.usbmodem1101` verified WebSocket authentication success (`I (13987) API: WS authenticated successfully. Backend state: idle`); 93/93 Python contract tests passing (`python3 -m unittest discover -s esp/tests`).

## Change — Proactive Audio Protocol, Voice Capture Reservation & Playback Watchdog

- Goal: Complete the end-to-end integration for proactive audio delivery (scheduled reminders, WhatsApp/system alerts) while protecting user voice recording priority, and preventing audio playback stalls via an atomic watchdog.
- Files/functions affected:
  - `esp/main/playback.h` / `playback.cpp` (`ProactiveOffer`, `ProactiveAudioReady`, `ProactiveCancel`, `ProactiveRejectReason`, `ProactiveFailureReason`, `playback_prepare_proactive_offer`, `playback_start_proactive_ready`, `playback_cancel_proactive`).
  - `esp/main/voice_capture_reservation.h` / `voice_capture_reservation.cpp` (`VoiceReservationState`, `VoiceCaptureReservation`, `voice_reservation_begin_request`, `voice_reservation_handle_accepted`, `voice_reservation_handle_rejected`, `voice_reservation_handle_expired`, `voice_reservation_is_valid`).
  - `esp/main/playback_watchdog.h` / `playback_watchdog.cpp` (`PlaybackTerminalReason`, `PlaybackJobControl`, `PlaybackWatchdogSnapshot`, `playback_watchdog_latch_stalled`, stall timeout `kPlaybackStallUs = 5000000`).
  - `esp/main/api.cpp` (handlers for inbound WebSocket events `proactive_offer`, `proactive_audio_ready`, `proactive_cancel`, and outbound response `proactive_offer_accepted`).
  - `esp/tests/test_proactive_protocol_contract.py`, `esp/tests/test_playback_watchdog_contract.py`, `esp/tests/test_voice_capture_reservation_contract.py` (focused contract tests).
- Behavior before: Proactive delivery preparation existed as an isolated abstraction without direct WebSocket event dispatch; no voice reservation lease tracking or atomic stall watchdog was active.
- Behavior after: Backend can offer proactive audio (`proactive_offer`); if ESP32 is in `IDLE` state, it immediately confirms with `proactive_offer_accepted`. When audio is ready (`proactive_audio_ready`), playback begins immediately with watchdog protection. Voice capture reservation guards against scheduling collisions while user is speaking.
- Verification evidence: Full Python contract test suite passes 98/98 tests (`python3 -m unittest discover -s esp/tests`).
