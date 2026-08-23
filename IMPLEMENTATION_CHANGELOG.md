# BMO ESP32-S3 Implementation / Change Log

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

Files/functions affected: root `CMakeLists.txt` (the `BMO_DEV_SUPPRESS_PAIRING_UI` cache option and generated `bmo_dev_config.h`); `esp/main/api.cpp` (`process_pairing_actions()` and the generated-config include); `esp/tests/test_pairing_ui_suppression_contract.py` (focused contracts).

Behavior before: every accepted `PAIRING_ACTION_SHOW_UI` action called `display_set_pairing_code()`; there was no project-level switch for development firmware to suppress that rendering.

Behavior after: the default `OFF` configuration preserves the existing display call. When `BMO_DEV_SUPPRESS_PAIRING_UI=ON`, the `SHOW_UI` action is consumed without calling the LCD renderer; pairing code validation/storage, expiry, recovery/reissue, completion cleanup, pairing-mode request, reconnect, and re-authentication paths remain active.

Reason: allow development firmware to exercise pairing internally without exposing the code on the LCD, without changing the protocol, credentials, renderer, orientation, or playback/proactive implementation.

Regression risk: a preprocessor guard in the action processor could accidentally suppress protocol actions or alter production behavior if the default is wrong. Mitigations are an explicit default-off generated macro, focused source contracts, default and suppression-mode builds, and the full existing test suite.

Verification evidence: focused suppression contracts pass; full `python -m unittest discover -s tests -v` passed 56/56; `idf.py -D BMO_DEV_SUPPRESS_PAIRING_UI=ON build` passed with generated macro `1`; final default `idf.py build` passed with generated macro `0` and CMake cache `OFF`. COM12 dev image flash passed, and serial monitoring observed stable boot, WSS authentication, and internal `pairing_code` receipt without logging the code. LCD visual output was not directly observable in this setup, so no visual claim is made; no pairing completion was claimed without a backend claim.
