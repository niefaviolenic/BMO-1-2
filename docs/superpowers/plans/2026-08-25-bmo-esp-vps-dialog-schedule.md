# BMO ESP VPS Dialog Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver reliable two-stage ESP voice conversations and exactly-once mobile schedule results with opportunistic, race-free physical playback.

**Architecture:** The ESP first gains bounded playback recovery, explicit local ownership, authenticated voice reservation, calibrated capture, and shared proactive playback. The VPS uses PostgreSQL-locked device arbitration, exactly-once schedule persistence, and correlated two-phase delivery so every terminal path releases ownership and mobile history remains authoritative.

**Tech Stack:** ESP-IDF/C++ (FreeRTOS, I2S, WakeNet, HTTP/WebSocket, MP3/WAV), backend TypeScript services, PostgreSQL migrations/advisory locks, Hermes, mobile realtime events, and protocol/unit/fake-device/hardware tests.

**Approved spec:** `docs/superpowers/specs/2026-08-25-bmo-esp-vps-dialog-schedule-design.md`

---

## File Responsibility Map

- **Firmware playback/watchdog:** shared streaming download/decode/speaker worker, atomic progress counters, watchdog-only cancellation requests, correlation/replay budget, and worker-owned terminal return to `IDLE`.
- **Firmware voice capture:** local speech owner, reserve/cancel lease handling, beep/drain/settle, frame-boundary reset, calibrated VAD hysteresis, bounded recording, and canonical WAV finalization.
- **Firmware integration:** API protocol payloads, state transitions, audio I/O, WakeNet gating/metrics, CMake component wiring, and focused host/fake-device/hardware tests.
- **Backend persistence:** schema and migration for device speech ownership, schedule chat purpose/idempotency, delivery attempts, leases, receipts, generations, and terminal states.
- **Backend connectivity:** event schemas, authenticated WebSocket handlers, live-device registry, correlation checks, duplicate ACK handling, and disconnect/expiry cleanup.
- **Backend voice admission:** `RequestStore` same-ID promotion and authenticated voice-upload route validation under the per-device advisory lock.
- **Backend arbitration:** `DeviceSpeechArbiterService` plus reservation, delivery, attempt, schedule-run, chat-session, and message repositories with exact-owner release semantics.
- **Backend schedule/mobile:** `ScheduledResultService`, Hermes 2–10-word validation/one repair, deterministic `BMO Schedule` persistence, and existing mobile realtime emission.
- **Backend physical speech:** one-shot `DeviceSpeechPort`, post-accept TTS, public temporary-audio URLs, expiry/deletion, and protocol/unit/integration/fake-ESP tests.
- **Evidence docs:** checked-in command logs, timing/calibration summaries, production/runtime identifiers, firmware hashes, and gate results; never raw microphone audio or secrets.

## Task 1: Preflight

- [ ] **Step 1: Record both integration bases and create both clean implementation worktrees**

The current firmware planning worktree has unrelated generated/build changes and is never used for implementation. Resolve the committed `feat/display-expression-animation-merged` tip, verify that it is the planning worktree's `HEAD`, and create a fresh firmware worktree from that commit without cleaning, stashing, resetting, or otherwise touching the original. The backend gets its own isolated worktree from the backend repository's current integration base.

```powershell
$EspRepo = 'D:/codex/BMO/esp'
$EspBaseWorktree = 'D:/codex/BMO/esp/.worktrees/display-expression-animation-merged'
$EspBaseRef = 'feat/display-expression-animation-merged'
$EspWorktree = 'D:/codex/BMO/esp/.worktrees/esp-vps-dialog-schedule'
$EspProject = "$EspWorktree/esp"
$BackendRepo = 'D:/codex/BMO/backend'
$BackendWorktree = 'D:/codex/BMO/backend/.worktrees/esp-vps-dialog-schedule'
$BackendProject = "$BackendWorktree/backend"

$EspBase = git -C $EspRepo rev-parse "$EspBaseRef^{commit}"
$EspPlanningHead = git -C $EspBaseWorktree rev-parse HEAD
if ($EspPlanningHead -ne $EspBase) {
  throw 'Planning worktree HEAD does not match committed firmware integration branch'
}
$BackendBase = git -C $BackendRepo rev-parse HEAD
$EspBase
$BackendBase

git -C $EspRepo worktree add `
  -b feat/esp-vps-dialog-schedule-firmware `
  $EspWorktree `
  $EspBase
git -C $BackendRepo worktree add `
  -b feat/esp-vps-dialog-schedule `
  $BackendWorktree `
  $BackendBase

git -C $EspWorktree branch --show-current
git -C $BackendWorktree branch --show-current
Test-Path $EspProject
Test-Path $BackendProject
```

Expected: `$EspBase` is the committed tip of `feat/display-expression-animation-merged` and equals the original planning worktree's `HEAD`; the original dirty worktree is untouched; the new firmware worktree is exactly `D:/codex/BMO/esp/.worktrees/esp-vps-dialog-schedule` on `feat/esp-vps-dialog-schedule-firmware`; the backend worktree is exactly `D:/codex/BMO/backend/.worktrees/esp-vps-dialog-schedule` on `feat/esp-vps-dialog-schedule`; and both `Test-Path` calls print `True`. Every later firmware command runs from `$EspProject` or uses `$EspWorktree`; every backend project command runs from `$BackendProject`.

- [ ] **Step 2: Prove both new implementation baselines are clean**

```powershell
git -C $EspWorktree status --short
git -C $BackendWorktree status --short
git -C $EspWorktree diff --check
git -C $BackendWorktree diff --check
$FirmwareImplementationBase = git -C $EspWorktree rev-parse HEAD
$VpsBase = git -C $BackendWorktree rev-parse HEAD
$FirmwareImplementationBase
$VpsBase
if ($FirmwareImplementationBase -ne $EspBase) {
  throw 'Firmware implementation worktree is not based on the recorded committed tip'
}
if ($VpsBase -ne $BackendBase) {
  throw 'Backend implementation worktree is not based on the recorded integration tip'
}
```

Expected: both `status --short` and both `diff --check` commands produce no output; both implementation bases print 40-character commit hashes and equal their recorded bases. Record both hashes in rollout evidence before implementation. If either new worktree is dirty, stop rather than cleaning, stashing, resetting, or overwriting somebody else's work.

- [ ] **Step 3: Capture read-only production runtime evidence and the local CMake prerequisite**

Production evidence comes only from the `bmo-codex` SSH alias and `/opt/bmo/app`. The local private environment file is checked only because CMake requires it; never hash, copy, print, or include it in evidence.

```powershell
$LocalCMakeEnv = 'D:/BMO/private/bmo-production.env'

Test-Path $LocalCMakeEnv
ssh bmo-codex "cd /opt/bmo/app && git rev-parse HEAD && git status --short"
ssh bmo-codex "cd /opt/bmo/app && docker ps --no-trunc --format 'table {{.Names}}\t{{.Image}}\t{{.ID}}\t{{.Status}}'"
```

Expected: `Test-Path` prints `True`; the remote application path prints the deployed commit and checkout status; and remote `docker ps` records container names, immutable image references or IDs, container IDs, and status. Record the SSH alias, `/opt/bmo/app`, deployed commit, runtime identifiers, and capture timestamp. If the local CMake prerequisite is absent or the remote evidence commands fail, stop. Do not treat `D:/BMO` as a production checkout.

- [ ] **Step 4: Establish the external ESP-IDF build baseline**

```powershell
$Build = 'C:/Users/cenna/AppData/Local/Temp/bmo-dialog-schedule-build'
Push-Location $EspProject
cmd.exe /d /c "call C:\esp\v6.0.1\esp-idf\export.bat && idf.py -B $Build reconfigure && idf.py -B $Build build"
Pop-Location
Get-FileHash -Algorithm SHA256 "$Build/*.bin"
git -C $EspWorktree status --short
```

Expected: ESP-IDF runs from the clean `$EspProject`, configures and builds successfully with all generated files under `C:/Users/cenna/AppData/Local/Temp/bmo-dialog-schedule-build`; each baseline firmware binary has a recorded SHA-256; and the final status command remains empty. Never configure or build into a source worktree.

- [ ] **Step 5: Detect the assigned device on COM12 without changing flash**

```powershell
Get-CimInstance Win32_SerialPort |
  Where-Object DeviceID -eq 'COM12' |
  Select-Object DeviceID, Name, PNPDeviceID

python -m esptool --port COM12 chip_id
```

Expected: exactly one serial-port row identifies `COM12`, and `esptool chip_id` connects and prints the target chip identity. This is detection only: do not run `erase-flash`, `erase_region`, partition-table writes, NVS/model-partition writes, or any command that erases installed WakeNet/model data.

- [ ] **Step 6: Record separate repository and commit ownership**

```text
Firmware root:    D:/codex/BMO/esp/.worktrees/esp-vps-dialog-schedule
Firmware branch:  feat/esp-vps-dialog-schedule-firmware
Firmware cwd:     D:/codex/BMO/esp/.worktrees/esp-vps-dialog-schedule/esp
Backend root:     D:/codex/BMO/backend/.worktrees/esp-vps-dialog-schedule
Backend branch:   feat/esp-vps-dialog-schedule
Backend cwd:      D:/codex/BMO/backend/.worktrees/esp-vps-dialog-schedule/backend
Evidence/docs:    firmware repository, evidence-only commits separate from firmware implementation commits
Planning root:    D:/codex/BMO/esp/.worktrees/display-expression-animation-merged, never used for implementation
```

Expected: later tasks stage and commit only files owned by their repository. Firmware implementation/test commits belong only to `feat/esp-vps-dialog-schedule-firmware`; backend implementation/test commits belong only to `feat/esp-vps-dialog-schedule`; evidence commits are distinct from both implementation commit sets. Apart from creating the two isolated implementation worktrees and baseline build output outside both source trees, preflight is read-only and contains no implementation code or commit.
## Task 2: Make playback cancellation cooperative and worker-owned

- [ ] **Step 1: Wire the files and make both source-contract tests RED.** Update `playback_watchdog.h`, `playback_watchdog.cpp`, `playback.h`, `playback.cpp`, `api.cpp`, `audio.h`, `audio.cpp`, `state.cpp`, `CMakeLists.txt`, `tests/test_playback_watchdog_contract.py`, and `tests/test_playback_contract.py`. Keep `download_and_play_mp3(const PlaybackJob*)` as the worker entry point returning `BMOPlaybackResult`. Add source assertions for the three progress counters, cancellation checks around HTTP/MP3/audio work, the five-second counter-snapshot watchdog, the `bool` audio wrapper, and worker-only terminal cleanup. Run the expected-RED command:

  ```bat
  python -m unittest discover -s tests -p "test_playback_watchdog_contract.py" -v
  python -m unittest discover -s tests -p "test_playback_contract.py" -v
  ```

- [ ] **Step 2: Add explicit progress atomics and a counter-snapshot watchdog.** Put the shared control in `playback.h`. Initialize all counters to zero and initialize the watchdog snapshot time when the job starts. Only completed work may update the counters and `last_progress_us`; a heartbeat must never update any of them.

  ```cpp
  enum class PlaybackTerminalReason : uint8_t {
      NONE,
      CANCELLED,
      STALLED,
  };

  struct PlaybackJobControl {
      std::atomic<bool> cancel_requested{false};
      std::atomic<PlaybackTerminalReason> requested_terminal_reason{
          PlaybackTerminalReason::NONE};
      std::atomic<uint64_t> http_bytes_received{0};
      std::atomic<uint64_t> mp3_frames_decoded{0};
      std::atomic<uint64_t> pcm_frames_written{0};
      std::atomic<int64_t> last_progress_us{0};
      std::atomic<bool> terminal_cleanup_claimed{false};
  };

  struct PlaybackWatchdogSnapshot {
      uint64_t http_bytes_received{0};
      uint64_t mp3_frames_decoded{0};
      uint64_t pcm_frames_written{0};
      int64_t last_counter_increase_us{0};
  };

  constexpr int64_t kPlaybackStallUs = 5'000'000;

  bool playback_watchdog_latch_stalled(PlaybackJobControl* control,
                                       PlaybackWatchdogSnapshot* snapshot,
                                       int64_t now_us) {
      const uint64_t http = control->http_bytes_received.load(std::memory_order_acquire);
      const uint64_t mp3 = control->mp3_frames_decoded.load(std::memory_order_acquire);
      const uint64_t pcm = control->pcm_frames_written.load(std::memory_order_acquire);
      const bool increased = http > snapshot->http_bytes_received
          || mp3 > snapshot->mp3_frames_decoded
          || pcm > snapshot->pcm_frames_written;
      if (increased) {
          snapshot->http_bytes_received = http;
          snapshot->mp3_frames_decoded = mp3;
          snapshot->pcm_frames_written = pcm;
          snapshot->last_counter_increase_us = now_us;
          return false;
      }
      if (now_us - snapshot->last_counter_increase_us < kPlaybackStallUs) return false;

      PlaybackTerminalReason expected = PlaybackTerminalReason::NONE;
      if (!control->requested_terminal_reason.compare_exchange_strong(
              expected, PlaybackTerminalReason::STALLED,
              std::memory_order_acq_rel)) {
          return false;
      }
      control->cancel_requested.store(true, std::memory_order_release);
      return true;
  }
  ```

  The watchdog may mutate its private snapshot, but its only job-control effects are setting `requested_terminal_reason` to `STALLED` and setting `cancel_requested`; it never reports terminal state, clears/releases a job, or transitions to `IDLE`.

- [ ] **Step 3: Instrument real HTTP and MP3 progress in `api.cpp`.** Check `cancel_requested` immediately before and after every HTTP read and immediately before and after the existing `MP3Decode(...)` call. A successful HTTP read increments `http_bytes_received` by the actual positive byte count and then updates `last_progress_us`. A successfully decoded MP3 frame increments `mp3_frames_decoded` by one and then updates `last_progress_us`. Zero-byte reads, decode failures, retries, polls, and heartbeats are not progress.

  ```cpp
  if (control->cancel_requested.load(std::memory_order_acquire)) {
      return playback_result_for_terminal_reason(
          control->requested_terminal_reason.load(std::memory_order_acquire));
  }
  const int bytes_read = esp_http_client_read(
      http_client,
      reinterpret_cast<char*>(http_buffer),
      sizeof(http_buffer));
  if (control->cancel_requested.load(std::memory_order_acquire)) {
      return playback_result_for_terminal_reason(
          control->requested_terminal_reason.load(std::memory_order_acquire));
  }
  if (bytes_read > 0) {
      control->http_bytes_received.fetch_add(
          static_cast<uint64_t>(bytes_read), std::memory_order_acq_rel);
      control->last_progress_us.store(esp_timer_get_time(), std::memory_order_release);
  }

  if (control->cancel_requested.load(std::memory_order_acquire)) {
      return playback_result_for_terminal_reason(
          control->requested_terminal_reason.load(std::memory_order_acquire));
  }
  const int decode_result = MP3Decode(decoder, &read_ptr, &bytes_left,
                                      pcm_samples, 0);
  if (control->cancel_requested.load(std::memory_order_acquire)) {
      return playback_result_for_terminal_reason(
          control->requested_terminal_reason.load(std::memory_order_acquire));
  }
  if (decode_result == 0) {
      control->mp3_frames_decoded.fetch_add(1, std::memory_order_acq_rel);
      control->last_progress_us.store(esp_timer_get_time(), std::memory_order_release);
  }
  ```

  Continue to map cancellation from `requested_terminal_reason` to the corresponding existing `BMOPlaybackResult`; do not create a second terminal path in the decode loop.

- [ ] **Step 4: Preserve the actual `bool audio_play_raw(...)` API and add chunk cancellation/progress.** Declare `audio_play_raw_cancellable` in `audio.h`. In `audio.cpp`, keep the current validation, `audio_set_sample_rate`, mono-to-stereo scaling, stereo scaling, write timing, slow-playback logging, and `SPEAKER_OUTPUT_CHUNK_FRAMES` bounds. Extract the duplicated existing `i2s_channel_write(..., 500)` body from the mono and stereo loops into the concrete private helper below; this helper is not a substitute for, or new abstraction over, the existing I2S implementation. Check cancellation immediately before every helper call. Only a helper call that returns `true` increments `pcm_frames_written` by the chunk's frame count and then updates `last_progress_us`. Preserve the existing public wrapper as `bool`:

  ```cpp
  struct RawWriteStats {
      int64_t total_us{0};
      int64_t max_us{0};
      size_t chunks{0};
  };

  static bool write_scaled_stereo_chunk(
      const int16_t* stereo_samples,
      size_t chunk_frames,
      RawWriteStats* stats) {
      const size_t expected_bytes =
          chunk_frames * 2 * sizeof(int16_t);
      size_t bytes_written = 0;
      const int64_t write_start_us = esp_timer_get_time();
      const esp_err_t err = i2s_channel_write(
          speaker_tx_handle,
          stereo_samples,
          expected_bytes,
          &bytes_written,
          500);
      const int64_t write_us = esp_timer_get_time() - write_start_us;
      stats->total_us += write_us;
      stats->max_us = std::max(stats->max_us, write_us);
      ++stats->chunks;
      if (err != ESP_OK || bytes_written != expected_bytes) {
          ESP_LOGE(TAG,
                   "Raw playback write failed: err=%s bytes=%u/%u chunk=%u",
                   esp_err_to_name(err),
                   static_cast<unsigned>(bytes_written),
                   static_cast<unsigned>(expected_bytes),
                   static_cast<unsigned>(stats->chunks));
          return false;
      }
      return true;
  }

  bool audio_play_raw_cancellable(
      const int16_t* samples,
      size_t sample_count,
      int channels,
      int sample_rate,
      PlaybackJobControl* control);

  bool audio_play_raw(const int16_t* samples, size_t sample_count,
                      int channels, int sample_rate) {
      return audio_play_raw_cancellable(
          samples, sample_count, channels, sample_rate, nullptr);
  }
  ```

  In each of the existing mono and stereo bounded loops, call the extracted helper only after scaling the current chunk into `stereo_buf`:

  ```cpp
  if (control != nullptr
      && control->cancel_requested.load(std::memory_order_acquire)) {
      return false;
  }
  if (!write_scaled_stereo_chunk(stereo_buf, chunk_frames, &write_stats)) {
      return false;
  }
  if (control != nullptr) {
      control->pcm_frames_written.fetch_add(
          chunk_frames, std::memory_order_acq_rel);
      control->last_progress_us.store(
          esp_timer_get_time(), std::memory_order_release);
  }
  ```

  For the mono loop, `chunk_frames` is the existing `chunk_samples`; for the stereo loop it is the existing `chunk_frames`. No undefined write helper, replacement I2S path, unbounded write, or change to `audio_play_raw`'s boolean contract is introduced.

- [ ] **Step 5: Let `download_and_play_mp3` unwind, then perform the sole worker terminal cleanup.** Thread the job's `PlaybackJobControl*` through the existing Helix `download_and_play_mp3(const PlaybackJob*)` path and into `audio_play_raw_cancellable`. On cancellation, stop acquiring new work and break to the existing common cleanup tail. `download_and_play_mp3` must free `out_pcm` and `mp3_stream_buf`, call `MP3FreeDecoder`, close and clean up the HTTP client, and only then return its existing `BMOPlaybackResult`; do not add an `unwind_worker_resources()` stand-in or change the Helix `MP3Decode` API. After that return, only the playback worker may claim terminal cleanup with `compare_exchange_strong`. Extract the existing result-reporting branches into `report_existing_terminal_result`, and add exact active-job clear/release helpers in `playback.cpp`; inside the single claimed branch preserve the order shown:

  ```cpp
  bool playback_worker_claim_terminal_cleanup(PlaybackJobControl* control) {
      bool expected = false;
      return control->terminal_cleanup_claimed.compare_exchange_strong(
          expected, true, std::memory_order_acq_rel);
  }

  const BMOPlaybackResult result = download_and_play_mp3(job);
  // The function has already freed both buffers, freed the Helix decoder,
  // and closed/cleaned the HTTP client before returning here.
  if (playback_worker_claim_terminal_cleanup(control)) {
      report_existing_terminal_result(job, result);
      clear_existing_active_job(job);
      release_existing_job(job);
      setState(BMOState::IDLE);
  }
  ```

  `report_existing_terminal_result`, `clear_existing_active_job`, and `release_existing_job` are extracted in this task from the existing worker's terminal-reporting, active-request clear, and job-lifetime code so all callers share one ordered worker path. They are not watchdog callbacks. The watchdog's only shared-control writes remain the `STALLED` reason latch and `cancel_requested`; it never reports a terminal event, clears or releases a job, frees worker resources, or calls `setState`.


- [ ] **Step 6: Turn the contracts GREEN, run full unittest discovery, and perform the external IDF build.** Make the Python tests isolate real function bodies and assert: all three atomics exist; HTTP bytes, decoded frames, and written PCM frames increment before their timestamp update; watchdog progress depends only on counter increases; heartbeat symbols cannot update progress; cancellation brackets HTTP and `MP3Decode`; every bounded audio chunk checks cancellation; the wrapper returns the cancellable result; resource unwind precedes the terminal CAS; and the worker-only operations remain in terminal-report/clear/release/`IDLE` order. Run:

  ```bat
  python -m unittest discover -s tests -p "test_playback_watchdog_contract.py" -v
  python -m unittest discover -s tests -p "test_playback_contract.py" -v
  python -m unittest discover -s tests -v
  cmd.exe /d /c "cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule\esp && call C:\esp\v6.0.1\esp-idf\export.bat && idf.py -B C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build build"
  ```

- [ ] **Step 7: Review the invariants and commit only the implementation set.** Confirm duplicate/idle watchdog ticks without counter growth reach `STALLED` after five seconds, while each real HTTP/MP3/PCM increment resets the watchdog's private counter-change time. Confirm the watchdog only requests cancellation, every worker boundary cooperatively unwinds, and exactly one worker-owned compare/exchange path performs terminal reporting, clear, release, and `IDLE`. Stage all and only the Task 2 implementation/test files, explicitly including both audio files:

  ```bat
  git add playback_watchdog.h playback_watchdog.cpp playback.h playback.cpp api.cpp audio.h audio.cpp state.cpp CMakeLists.txt tests/test_playback_watchdog_contract.py tests/test_playback_contract.py
  git commit -m "fix: make playback watchdog cancellation cooperative"
  ```

## Task 3: Device Speech Arbiter

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260825_device_speech_arbiter/migration.sql`
- Create: `backend/src/p9/services/device-speech-arbiter.service.ts`
- Modify: `backend/src/p9/db/repositories.ts`
- Modify: `backend/src/p9/index.ts`
- Modify: `backend/src/server.ts`
- Create: `backend/tests/p9/device-speech-arbiter.service.unit.test.ts`
- Create: `backend/tests/p9/device-speech-arbiter.repository.test.ts`
- Create: `backend/tests/p9/device-speech-arbiter.schema.test.ts`

- [ ] **Step 1: Write the failing service contract test**

Create `backend/tests/p9/device-speech-arbiter.service.unit.test.ts`:

```ts
import { describe, expect, test, vi, type Mocked } from "vitest";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  DeviceSpeechArbiterService,
  type AuthenticatedDeviceResolver,
  type DeviceSpeechArbiterStore,
  type DeviceSpeechTransactionRunner,
} from "../../src/p9/services/device-speech-arbiter.service";

const deviceId = randomUUID();
const bindingId = "authenticated-binding:device-cert-sha256";
const correlationId = randomUUID();

function fixture() {
  const resolver: AuthenticatedDeviceResolver = {
    resolveP9DeviceId: vi.fn(async (binding) => {
      if (binding !== bindingId) throw new Error("unknown binding");
      return deviceId;
    }),
  };
  const store: Mocked<DeviceSpeechArbiterStore> = {
    acquire: vi.fn(),
    promote: vi.fn(),
    release: vi.fn(),
  };
  const tx = {} as Prisma.TransactionClient;
  const transactions: DeviceSpeechTransactionRunner = {
    run: vi.fn(async (work) => work(tx)),
  };
  const service = new DeviceSpeechArbiterService(
    resolver,
    store,
    transactions,
  );
  return { resolver, store, service, tx };
}

describe("DeviceSpeechArbiterService", () => {
  test("resolves the authenticated hardware binding to the P9 Device UUID", async () => {
    const { resolver, store, service, tx } = fixture();
    store.acquire.mockResolvedValue({
      deviceId,
      ownerKind: "VOICE_CAPTURE_RESERVED",
      ownerCorrelationId: correlationId,
      generation: 1,
      leaseId: randomUUID(),
      receipt: "opaque-receipt",
      leaseExpiresAt: new Date("2026-08-25T12:00:45.000Z"),
    });

    await service.acquire(bindingId, {
      mode: "ACQUIRE_OR_RETURN_EXACT",
      ownerKind: "VOICE_CAPTURE_RESERVED",
      ownerCorrelationId: correlationId,
      leaseDurationMs: 45_000,
    });

    expect(resolver.resolveP9DeviceId).toHaveBeenCalledWith(bindingId);
    expect(store.acquire).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ deviceId }),
    );
    expect(store.acquire).not.toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ deviceId: "bmo-001" }),
    );
  });

  test("promotes only the exact reserved tuple without reacquiring", async () => {
    const { store, service, tx } = fixture();
    const leaseId = randomUUID();
    store.promote.mockResolvedValue(true);

    await expect(
      service.promote(bindingId, {
        fromOwnerKind: "VOICE_CAPTURE_RESERVED",
        toOwnerKind: "VOICE_PROCESSING",
        ownerCorrelationId: correlationId,
        generation: 7,
        leaseId,
        receipt: "reserve-receipt",
        nextLeaseId: null,
        nextReceipt: null,
        nextLeaseDurationMs: null,
      }),
    ).resolves.toBe(true);

    expect(store.promote).toHaveBeenCalledWith(tx, {
      deviceId,
      fromOwnerKind: "VOICE_CAPTURE_RESERVED",
      toOwnerKind: "VOICE_PROCESSING",
      ownerCorrelationId: correlationId,
      generation: 7,
      leaseId,
      receipt: "reserve-receipt",
      nextLeaseId: null,
      nextReceipt: null,
      nextLeaseDurationMs: null,
    });
    expect(store.release).not.toHaveBeenCalled();
    expect(store.acquire).not.toHaveBeenCalled();
  });

  test("releases only an exact owner tuple", async () => {
    const { store, service, tx } = fixture();
    const leaseId = randomUUID();
    store.release.mockResolvedValue(false);

    await expect(
      service.release(bindingId, {
        ownerKind: "PROACTIVE_DELIVERY",
        ownerCorrelationId: correlationId,
        generation: 4,
        leaseId,
        receipt: "audio-receipt",
      }),
    ).resolves.toBe(false);

    expect(store.release).toHaveBeenCalledWith(tx, {
      deviceId,
      ownerKind: "PROACTIVE_DELIVERY",
      ownerCorrelationId: correlationId,
      generation: 4,
      leaseId,
      receipt: "audio-receipt",
    });
  });
});
```

- [ ] **Step 2: Write failing schema and repository lock contracts**

Create `backend/tests/p9/device-speech-arbiter.schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../..");

describe("device speech arbiter schema", () => {
  test("uses one reservation per P9 Device UUID", () => {
    const schema = readFileSync(
      join(root, "prisma/schema.prisma"),
      "utf8",
    );
    expect(schema).toContain("enum DeviceSpeechOwnerKind");
    expect(schema).toContain("VOICE_CAPTURE_RESERVED");
    expect(schema).toContain("VOICE_PROCESSING");
    expect(schema).toContain("PROACTIVE_DELIVERY");
    expect(schema).toMatch(/deviceId\s+String\s+@unique\s+@db\.Uuid/);
    expect(schema).toMatch(/ownerCorrelationId\s+String\s+@db\.Uuid/);
    expect(schema).toMatch(/generation\s+Int/);
    expect(schema).toMatch(/leaseId\s+String\?\s+@db\.Uuid/);
  });

  test("migration enforces the UUID foreign key and unique device row", () => {
    const sql = readFileSync(
      join(
        root,
        "prisma/migrations/20260825_device_speech_arbiter/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain('CREATE UNIQUE INDEX "DeviceSpeechReservation_deviceId_key"');
    expect(sql).toContain(
      'FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE',
    );
    expect(sql).toContain('"ownerCorrelationId" UUID NOT NULL');
    expect(sql).not.toContain("bmo-001");
  });
});
```

Create `backend/tests/p9/device-speech-arbiter.repository.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(__dirname, "../../src/p9/db/repositories.ts"),
  "utf8",
);

describe("device speech arbiter repository transaction", () => {
  test("uses the caller transaction and takes the advisory lock in every mutation", () => {
    expect(source.match(/tx: Prisma\.TransactionClient/g)?.length ?? 0)
      .toBeGreaterThanOrEqual(4);
    expect(source.match(/await lockDevice\(tx, input\.deviceId\)/g)).toHaveLength(3);
    expect(source).toContain("hashtextextended(${input.deviceId}::text, 0)");
  });

  test("acquire, promote, and release are conditional SQL mutations", () => {
    expect(source).toContain('ON CONFLICT ("deviceId") DO UPDATE');
    expect(source).toContain('"leaseExpiresAt" <= clock_timestamp()');
    expect(source).toContain('"ownerKind" = ${input.fromOwnerKind}');
    expect(source).toContain('"ownerCorrelationId" = ${input.ownerCorrelationId}::uuid');
    expect(source).toContain('"generation" = ${input.generation}');
    expect(source).toContain('"leaseId" IS NOT DISTINCT FROM ${input.leaseId}::uuid');
    expect(source).toContain('"receipt" IS NOT DISTINCT FROM ${input.receipt}');
    expect(source).toContain('RETURNING "deviceId"');
  });
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run from the isolated backend project:

```powershell
Set-Location 'D:/codex/BMO/backend/.worktrees/esp-vps-dialog-schedule/backend'
npx vitest run `
  tests/p9/device-speech-arbiter.service.unit.test.ts `
  tests/p9/device-speech-arbiter.repository.test.ts `
  tests/p9/device-speech-arbiter.schema.test.ts
```

Expected: FAIL because `DeviceSpeechArbiterService`, its repository mutations, the Prisma enum/model, and migration do not exist.

- [ ] **Step 4: Add the Prisma ownership model**

Add this enum and model to `backend/prisma/schema.prisma`:

```prisma
enum DeviceSpeechOwnerKind {
  VOICE_CAPTURE_RESERVED
  VOICE_PROCESSING
  PROACTIVE_DELIVERY
}

model DeviceSpeechReservation {
  id                     String                @id @default(uuid()) @db.Uuid
  deviceId               String                @unique @db.Uuid
  ownerKind              DeviceSpeechOwnerKind
  ownerCorrelationId     String                @db.Uuid
  generation             Int
  leaseId                String?               @db.Uuid
  receipt                String?
  leaseExpiresAt         DateTime?             @db.Timestamptz(6)
  createdAt              DateTime              @default(now()) @db.Timestamptz(6)
  updatedAt              DateTime              @updatedAt @db.Timestamptz(6)
  device                 Device                @relation(
    fields: [deviceId],
    references: [id],
    onDelete: Cascade
  )

  @@index([ownerCorrelationId])
  @@index([leaseExpiresAt])
}
```

Add this inverse field to the existing `Device` model:

```prisma
deviceSpeechReservation DeviceSpeechReservation?
```

`deviceId` is the UUID primary key of the P9 `Device` row obtained from the authenticated hardware binding. A display label or hardware nickname such as `bmo-001` is never stored as the arbiter key.

- [ ] **Step 5: Add the exact SQL migration**

Create `backend/prisma/migrations/20260825_device_speech_arbiter/migration.sql`:

```sql
CREATE TYPE "DeviceSpeechOwnerKind" AS ENUM (
  'VOICE_CAPTURE_RESERVED',
  'VOICE_PROCESSING',
  'PROACTIVE_DELIVERY'
);

CREATE TABLE "DeviceSpeechReservation" (
  "id" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "ownerKind" "DeviceSpeechOwnerKind" NOT NULL,
  "ownerCorrelationId" UUID NOT NULL,
  "generation" INTEGER NOT NULL,
  "leaseId" UUID,
  "receipt" TEXT,
  "leaseExpiresAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "DeviceSpeechReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceSpeechReservation_generation_check"
    CHECK ("generation" > 0),
  CONSTRAINT "DeviceSpeechReservation_lease_tuple_check"
    CHECK (
      ("leaseId" IS NULL AND "receipt" IS NULL AND "leaseExpiresAt" IS NULL)
      OR
      ("leaseId" IS NOT NULL AND "receipt" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL)
    ),
  CONSTRAINT "DeviceSpeechReservation_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "DeviceSpeechReservation_deviceId_key"
  ON "DeviceSpeechReservation"("deviceId");
CREATE INDEX "DeviceSpeechReservation_ownerCorrelationId_idx"
  ON "DeviceSpeechReservation"("ownerCorrelationId");
CREATE INDEX "DeviceSpeechReservation_leaseExpiresAt_idx"
  ON "DeviceSpeechReservation"("leaseExpiresAt");
```

The nullable lease tuple supports promoted `VOICE_PROCESSING`, whose capture lease no longer controls ownership. The check constraint prevents partially populated lease credentials.

- [ ] **Step 6: Define the complete arbiter service API**

Create `backend/src/p9/services/device-speech-arbiter.service.ts`. `ACQUIRE_OR_RETURN_EXACT` creates ownership when free, replaces only a different expired owner, and returns an exact active duplicate without extending it. `MATCH_ACTIVE_LEASE` is read-only under the same device lock and exists so later authenticated protocol phases can recover the persistent `generation` from `ownerCorrelationId + leaseId + receipt` without an in-memory map or direct Prisma access. Public mutations may join one caller-owned transaction; this is required for Task 4's match/promote/request-admission sequence.

```ts
import type { Prisma } from "@prisma/client";

export type DeviceSpeechOwnerKind =
  | "VOICE_CAPTURE_RESERVED"
  | "VOICE_PROCESSING"
  | "PROACTIVE_DELIVERY";

export interface DeviceSpeechReservation {
  deviceId: string;
  ownerKind: DeviceSpeechOwnerKind;
  ownerCorrelationId: string;
  generation: number;
  leaseId: string | null;
  receipt: string | null;
  leaseExpiresAt: Date | null;
}

export type AcquireDeviceSpeechInput =
  | {
      mode: "ACQUIRE_OR_RETURN_EXACT";
      ownerKind: DeviceSpeechOwnerKind;
      ownerCorrelationId: string;
      leaseDurationMs: number;
    }
  | {
      mode: "MATCH_ACTIVE_LEASE";
      ownerKind: DeviceSpeechOwnerKind;
      ownerCorrelationId: string;
      leaseId: string;
      receipt: string;
    };

export type AcquireDeviceSpeechStoreInput =
  AcquireDeviceSpeechInput & { deviceId: string };

export interface PromoteDeviceSpeechInput {
  fromOwnerKind: DeviceSpeechOwnerKind;
  toOwnerKind: DeviceSpeechOwnerKind;
  ownerCorrelationId: string;
  generation: number;
  leaseId: string;
  receipt: string;
  nextLeaseId: string | null;
  nextReceipt: string | null;
  nextLeaseDurationMs: number | null;
}

export interface PromoteDeviceSpeechStoreInput
  extends PromoteDeviceSpeechInput {
  deviceId: string;
}

export interface ReleaseDeviceSpeechInput {
  ownerKind: DeviceSpeechOwnerKind;
  ownerCorrelationId: string;
  generation: number;
  leaseId: string | null;
  receipt: string | null;
}

export interface ReleaseDeviceSpeechStoreInput
  extends ReleaseDeviceSpeechInput {
  deviceId: string;
}

export interface AuthenticatedDeviceResolver {
  resolveP9DeviceId(authenticatedHardwareBinding: string): Promise<string>;
}

export interface DeviceSpeechArbiterStore {
  acquire(
    tx: Prisma.TransactionClient,
    input: AcquireDeviceSpeechStoreInput,
  ): Promise<DeviceSpeechReservation | null>;
  promote(
    tx: Prisma.TransactionClient,
    input: PromoteDeviceSpeechStoreInput,
  ): Promise<boolean>;
  release(
    tx: Prisma.TransactionClient,
    input: ReleaseDeviceSpeechStoreInput,
  ): Promise<boolean>;
}

export interface DeviceSpeechTransactionRunner {
  run<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
}

export class DeviceSpeechArbiterService {
  constructor(
    private readonly deviceResolver: AuthenticatedDeviceResolver,
    private readonly store: DeviceSpeechArbiterStore,
    private readonly transactions: DeviceSpeechTransactionRunner,
  ) {}

  runInTransaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.transactions.run(work);
  }

  async acquire(
    authenticatedHardwareBinding: string,
    input: AcquireDeviceSpeechInput,
    tx?: Prisma.TransactionClient,
  ): Promise<DeviceSpeechReservation | null> {
    const deviceId = await this.deviceResolver.resolveP9DeviceId(
      authenticatedHardwareBinding,
    );
    const work = (currentTx: Prisma.TransactionClient) =>
      this.store.acquire(currentTx, { deviceId, ...input });
    return tx ? work(tx) : this.transactions.run(work);
  }

  async promote(
    authenticatedHardwareBinding: string,
    input: PromoteDeviceSpeechInput,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const deviceId = await this.deviceResolver.resolveP9DeviceId(
      authenticatedHardwareBinding,
    );
    const work = (currentTx: Prisma.TransactionClient) =>
      this.store.promote(currentTx, { deviceId, ...input });
    return tx ? work(tx) : this.transactions.run(work);
  }

  async release(
    authenticatedHardwareBinding: string,
    input: ReleaseDeviceSpeechInput,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const deviceId = await this.deviceResolver.resolveP9DeviceId(
      authenticatedHardwareBinding,
    );
    const work = (currentTx: Prisma.TransactionClient) =>
      this.store.release(currentTx, { deviceId, ...input });
    return tx ? work(tx) : this.transactions.run(work);
  }
}
```

The public service accepts only the authenticated hardware-binding identity supplied by the current authenticated connection. It resolves that binding to the P9 `Device.id` UUID before every arbiter operation and exposes no caller-supplied `deviceId`. `runInTransaction` exposes only a `Prisma.TransactionClient` scope; callers still use `acquire`, `promote`, and `release` rather than issuing direct reservation-table queries.

- [ ] **Step 7: Implement the repository adapter and authenticated-device resolver**

In `backend/src/p9/db/repositories.ts`, import Prisma SQL helpers, `randomBytes`, and `randomUUID`, then export the resolver and store. Use the repository's existing authenticated hardware-binding lookup to select only `Device.id`; its concrete adapter must have this shape:

```ts
export class PrismaAuthenticatedDeviceResolver
  implements AuthenticatedDeviceResolver {
  constructor(private readonly prisma: PrismaClient) {}

  async resolveP9DeviceId(
    authenticatedHardwareBinding: string,
  ): Promise<string> {
    const binding = await this.prisma.deviceHardwareBinding.findUnique({
      where: { bindingId: authenticatedHardwareBinding },
      select: { device: { select: { id: true } } },
    });
    if (!binding) {
      throw new Error("Authenticated hardware binding has no P9 Device");
    }
    return binding.device.id;
  }
}
```

Implement one private advisory-lock helper:

```ts
async function lockDevice(
  tx: Prisma.TransactionClient,
  deviceId: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${deviceId}::text, 0)
    )
  `;
}
```

Then implement all three store methods so each receives the caller's `Prisma.TransactionClient`; each method takes the advisory lock and performs its conditional mutation on that same transaction. The repository methods never open a nested transaction:

```ts
export class PrismaDeviceSpeechArbiterStore
  implements DeviceSpeechArbiterStore {
  async acquire(
    tx: Prisma.TransactionClient,
    input: AcquireDeviceSpeechStoreInput,
  ): Promise<DeviceSpeechReservation | null> {
    await lockDevice(tx, input.deviceId);
    if (input.mode === "MATCH_ACTIVE_LEASE") {
      const rows = await tx.$queryRaw<DeviceSpeechReservation[]>`
        SELECT
          "deviceId", "ownerKind", "ownerCorrelationId", "generation",
          "leaseId", "receipt", "leaseExpiresAt"
        FROM "DeviceSpeechReservation"
        WHERE "deviceId" = ${input.deviceId}::uuid
          AND "ownerKind" = ${input.ownerKind}::"DeviceSpeechOwnerKind"
          AND "ownerCorrelationId" = ${input.ownerCorrelationId}::uuid
          AND "leaseId" = ${input.leaseId}::uuid
          AND "receipt" = ${input.receipt}
          AND "leaseExpiresAt" > clock_timestamp()
      `;
      return rows[0] ?? null;
    }

    const leaseId = randomUUID();
    const receipt = randomBytes(32).toString("base64url");
    const rows = await tx.$queryRaw<DeviceSpeechReservation[]>`
      WITH acquired AS (
        INSERT INTO "DeviceSpeechReservation" (
          "id", "deviceId", "ownerKind", "ownerCorrelationId",
          "generation", "leaseId", "receipt", "leaseExpiresAt",
          "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), ${input.deviceId}::uuid,
          ${input.ownerKind}::"DeviceSpeechOwnerKind",
          ${input.ownerCorrelationId}::uuid, 1, ${leaseId}::uuid,
          ${receipt},
          clock_timestamp() + (${input.leaseDurationMs} * interval '1 millisecond'),
          clock_timestamp(), clock_timestamp()
        )
        ON CONFLICT ("deviceId") DO UPDATE SET
          "ownerKind" = EXCLUDED."ownerKind",
          "ownerCorrelationId" = EXCLUDED."ownerCorrelationId",
          "generation" = "DeviceSpeechReservation"."generation" + 1,
          "leaseId" = EXCLUDED."leaseId",
          "receipt" = EXCLUDED."receipt",
          "leaseExpiresAt" = EXCLUDED."leaseExpiresAt",
          "updatedAt" = clock_timestamp()
        WHERE "DeviceSpeechReservation"."leaseExpiresAt" <= clock_timestamp()
          AND "DeviceSpeechReservation"."ownerCorrelationId"
              <> EXCLUDED."ownerCorrelationId"
        RETURNING
          "deviceId", "ownerKind", "ownerCorrelationId", "generation",
          "leaseId", "receipt", "leaseExpiresAt"
      )
      SELECT * FROM acquired
      UNION ALL
      SELECT
        "deviceId", "ownerKind", "ownerCorrelationId", "generation",
        "leaseId", "receipt", "leaseExpiresAt"
      FROM "DeviceSpeechReservation"
      WHERE "deviceId" = ${input.deviceId}::uuid
        AND "ownerKind" = ${input.ownerKind}::"DeviceSpeechOwnerKind"
        AND "ownerCorrelationId" = ${input.ownerCorrelationId}::uuid
        AND "leaseExpiresAt" > clock_timestamp()
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async promote(
    tx: Prisma.TransactionClient,
    input: PromoteDeviceSpeechStoreInput,
  ): Promise<boolean> {
    await lockDevice(tx, input.deviceId);
    const rows = await tx.$queryRaw<Array<{ deviceId: string }>>`
      UPDATE "DeviceSpeechReservation"
      SET
        "ownerKind" = ${input.toOwnerKind}::"DeviceSpeechOwnerKind",
        "leaseId" = ${input.nextLeaseId}::uuid,
        "receipt" = ${input.nextReceipt},
        "leaseExpiresAt" = CASE
          WHEN ${input.nextLeaseDurationMs}::integer IS NULL THEN NULL
          ELSE clock_timestamp()
            + (${input.nextLeaseDurationMs} * interval '1 millisecond')
        END,
        "updatedAt" = clock_timestamp()
      WHERE "deviceId" = ${input.deviceId}::uuid
        AND "ownerKind" = ${input.fromOwnerKind}::"DeviceSpeechOwnerKind"
        AND "ownerCorrelationId" = ${input.ownerCorrelationId}::uuid
        AND "generation" = ${input.generation}
        AND "leaseId" IS NOT DISTINCT FROM ${input.leaseId}::uuid
        AND "receipt" IS NOT DISTINCT FROM ${input.receipt}
        AND "leaseExpiresAt" > clock_timestamp()
      RETURNING "deviceId"
    `;
    return rows.length === 1;
  }

  async release(
    tx: Prisma.TransactionClient,
    input: ReleaseDeviceSpeechStoreInput,
  ): Promise<boolean> {
    await lockDevice(tx, input.deviceId);
    const rows = await tx.$queryRaw<Array<{ deviceId: string }>>`
      DELETE FROM "DeviceSpeechReservation"
      WHERE "deviceId" = ${input.deviceId}::uuid
        AND "ownerKind" = ${input.ownerKind}::"DeviceSpeechOwnerKind"
        AND "ownerCorrelationId" = ${input.ownerCorrelationId}::uuid
        AND "generation" = ${input.generation}
        AND "leaseId" IS NOT DISTINCT FROM ${input.leaseId}::uuid
        AND "receipt" IS NOT DISTINCT FROM ${input.receipt}
      RETURNING "deviceId"
    `;
    return rows.length === 1;
  }
}
```

`acquire` takes the advisory lock in both modes. `ACQUIRE_OR_RETURN_EXACT` inserts when free, replaces only a different expired correlation, returns an exact active duplicate unchanged, and rejects a different active or reused expired correlation. `MATCH_ACTIVE_LEASE` performs no mutation and returns only the exact unexpired `ownerKind + ownerCorrelationId + leaseId + receipt`, including its persistent `generation`. `promote` conditionally updates that exact unexpired tuple in place while preserving `deviceId`, `ownerCorrelationId`, and `generation`: voice promotion changes `VOICE_CAPTURE_RESERVED → VOICE_PROCESSING` and clears the lease tuple; proactive acceptance keeps `PROACTIVE_DELIVERY` and atomically rotates to the accepted lease ID/receipt/expiry. `release` deletes only the exact current owner tuple. The service's caller-owned transaction runner encloses the repository method, advisory lock, and mutation; repository methods never create a nested transaction.

- [ ] **Step 8: Wire one singleton arbiter into P9**

Export the API and a construction helper from `backend/src/p9/index.ts`:

```ts
export * from "./services/device-speech-arbiter.service";

export function createDeviceSpeechArbiter(
  prisma: PrismaClient,
): DeviceSpeechArbiterService {
  const transactions: DeviceSpeechTransactionRunner = {
    run: (work) => prisma.$transaction(work),
  };
  return new DeviceSpeechArbiterService(
    new PrismaAuthenticatedDeviceResolver(prisma),
    new PrismaDeviceSpeechArbiterStore(),
    transactions,
  );
}
```

In `backend/src/server.ts`, create exactly one instance beside the existing P9 service graph and pass that same instance to every P9 WebSocket, voice, and proactive composition point:

```ts
const deviceSpeechArbiter = createDeviceSpeechArbiter(prisma);

const p9 = createP9({
  prisma,
  deviceSpeechArbiter,
});
```

Do not instantiate an arbiter per request or per WebSocket. Callers supply the authenticated binding already attached to their authenticated connection/request context; they never supply `Device.id`, a display name, or `bmo-001`.

- [ ] **Step 9: Run focused tests and verify GREEN**

Run:

```powershell
Set-Location 'D:/codex/BMO/backend/.worktrees/esp-vps-dialog-schedule/backend'
npx vitest run `
  tests/p9/device-speech-arbiter.service.unit.test.ts `
  tests/p9/device-speech-arbiter.repository.test.ts `
  tests/p9/device-speech-arbiter.schema.test.ts
```

Expected: all focused tests pass, proving authenticated binding resolution to a P9 Device UUID, the three owner kinds, one row per device, same-transaction advisory locking, conditional acquire, gapless exact promotion, and exact stale-safe release.

- [ ] **Step 10: Validate Prisma, generate the client, typecheck, and run the full backend suite**

Run:

```powershell
Set-Location 'D:/codex/BMO/backend/.worktrees/esp-vps-dialog-schedule/backend'
npx prisma validate
npx prisma generate
npm run typecheck
npm test
```

Expected: Prisma reports the schema valid; client generation succeeds with `DeviceSpeechOwnerKind` and `DeviceSpeechReservation`; TypeScript reports no errors; and the full backend test suite passes. No migration is applied to production in this task.

- [ ] **Step 11: Commit only the backend arbiter slice**

Run from the backend repository:

```powershell
git -C 'D:/codex/BMO/backend/.worktrees/esp-vps-dialog-schedule' add `
  backend/prisma/schema.prisma `
  backend/prisma/migrations/20260825_device_speech_arbiter/migration.sql `
  backend/src/p9/services/device-speech-arbiter.service.ts `
  backend/src/p9/db/repositories.ts `
  backend/src/p9/index.ts `
  backend/src/server.ts `
  backend/tests/p9/device-speech-arbiter.service.unit.test.ts `
  backend/tests/p9/device-speech-arbiter.repository.test.ts `
  backend/tests/p9/device-speech-arbiter.schema.test.ts
git -C 'D:/codex/BMO/backend/.worktrees/esp-vps-dialog-schedule' commit `
  -m "feat(p9): add device speech arbiter"
```

Expected: one backend-only commit on `feat/esp-vps-dialog-schedule`; no firmware, plan, or rollout-evidence files are staged.

## Task 4: Voice Reserve — persistently lease capture before recording

- [ ] **Step 1: Lock the snake_case event and upload-header contracts; make backend tests RED.** Update `backend/src/websocket/events.ts`, `backend/src/websocket/websocket.server.ts`, `backend/src/websocket/device-registry.ts`, `backend/src/http/voice.route.ts`, `backend/src/domain/request-store.ts`, and `backend/src/server.ts`; create/update `backend/tests/voice-reserve.test.ts` and `backend/tests/voice-route.test.ts`. Use the existing `event` discriminator. The client never sends a device ID; the current authenticated `ApplicationDeviceBinding.hardwareId` is the Task 3 resolver input and resolves to the P9 `Device.id`.

  ```ts
  // backend/src/websocket/events.ts
  import { z } from "zod";

  export const VoiceReserveEvent = z.object({
    event: z.literal("voice_reserve"),
    request_id: z.string().uuid(),
  }).strict();

  export const VoiceReserveAcceptedEvent = z.object({
    event: z.literal("voice_reserve_accepted"),
    request_id: z.string().uuid(),
    lease_id: z.string().uuid(),
    reserve_receipt: z.string().min(1).max(512),
    capture_lease_duration_seconds: z.literal(45),
    capture_lease_expires_at: z.string().datetime({ offset: true }),
  }).strict();

  export const VoiceReserveRejectedEvent = z.object({
    event: z.literal("voice_reserve_rejected"),
    request_id: z.string().uuid(),
    reason: z.enum([
      "UNAUTHENTICATED",
      "NOT_IDLE",
      "BUSY",
      "STALE_REQUEST",
    ]),
  }).strict();

  export const VoiceCancelEvent = z.object({
    event: z.literal("voice_cancel"),
    request_id: z.string().uuid(),
    lease_id: z.string().uuid(),
    reserve_receipt: z.string().min(1).max(512),
    reason: z.enum([
      "NO_SPEECH",
      "LOCAL_ABORT",
      "UPLOAD_HANDOFF_FAILED",
    ]),
  }).strict();

  export const VoiceReserveExpiredEvent = z.object({
    event: z.literal("voice_reserve_expired"),
    request_id: z.string().uuid(),
    lease_id: z.string().uuid(),
    reserve_receipt: z.string().min(1).max(512),
  }).strict();

  export const VoiceUploadHeaders = z.object({
    "x-request-id": z.string().uuid(),
    "x-voice-lease-id": z.string().uuid(),
    "x-voice-reserve-receipt": z.string().min(1).max(512),
  });
  ```

  Run from the isolated backend project:

  ```powershell
  Set-Location 'D:/codex/BMO/backend/.worktrees/esp-vps-dialog-schedule/backend'
  npx vitest run tests/voice-reserve.test.ts tests/voice-route.test.ts
  ```

  Expected: RED identifies missing persistent reservation, original-expiry idempotency, exact cancel, and transaction-scoped promotion behavior; schema or fixture setup errors are fixed before continuing.

- [ ] **Step 2: Reserve through Task 3 `acquire` and map the persistent row to the wire contract.** Do not add an arbiter `Map`, new reservation fields, or direct reservation-model Prisma calls. A reserve handler checks the current authenticated socket and backend `IDLE`, then calls the singleton Task 3 service with `ownerCorrelationId = request_id`. `ACQUIRE_OR_RETURN_EXACT` returns the original active row for an exact duplicate without changing `generation`, `leaseId`, `receipt`, or `leaseExpiresAt`; it returns `null` for a different active owner or a terminal/reused correlation.

  ```ts
  const VOICE_CAPTURE_LEASE_MS = 45_000;

  async function reserveVoiceCapture(
    authenticatedHardwareBinding: string,
    requestId: string,
  ): Promise<DeviceSpeechReservation | null> {
    const reservation = await deviceSpeechArbiter.acquire(
      authenticatedHardwareBinding,
      {
        mode: "ACQUIRE_OR_RETURN_EXACT",
        ownerKind: "VOICE_CAPTURE_RESERVED",
        ownerCorrelationId: requestId,
        leaseDurationMs: VOICE_CAPTURE_LEASE_MS,
      },
    );
    if (reservation === null) return null;
    if (
      reservation.ownerKind !== "VOICE_CAPTURE_RESERVED"
      || reservation.ownerCorrelationId !== requestId
      || reservation.leaseId === null
      || reservation.receipt === null
      || reservation.leaseExpiresAt === null
    ) {
      throw new Error("invalid persistent voice reservation tuple");
    }
    return reservation;
  }

  function voiceReserveAccepted(
    reservation: DeviceSpeechReservation,
  ): z.infer<typeof VoiceReserveAcceptedEvent> {
    return {
      event: "voice_reserve_accepted",
      request_id: reservation.ownerCorrelationId,
      lease_id: reservation.leaseId!,
      reserve_receipt: reservation.receipt!,
      capture_lease_duration_seconds: 45,
      capture_lease_expires_at: reservation.leaseExpiresAt!.toISOString(),
    };
  }
  ```

  The snake_case fields are wire mappings only: `request_id ← ownerCorrelationId`, `lease_id ← leaseId`, `reserve_receipt ← receipt`, and `capture_lease_expires_at ← leaseExpiresAt`. `ownerKind` and `generation` remain persistent correlation fields; there are no Prisma columns named `requestId`, `reserveReceipt`, `state`, or `expiresAt`.

- [ ] **Step 3: Handle authenticated WebSocket reserve/cancel with Task 3 `acquire` and `release`.** Parse strict events, require the current authenticated socket's active application binding, require registry backend state `idle`, and pass `binding.hardwareId` to the singleton arbiter. A missing binding returns `UNAUTHENTICATED`; non-idle returns `NOT_IDLE`; `null` acquisition returns `BUSY` unless the correlation is known terminal/reused, which returns `STALE_REQUEST`. The exact cancel transaction uses read-only `MATCH_ACTIVE_LEASE` to recover the persistent generation, then calls `release` on that same transaction. A stale, foreign, expired, mismatched, or post-promotion cancel returns no match and cannot release anything.

  ```ts
  const reservation = await reserveVoiceCapture(
    binding.hardwareId,
    reserve.data.request_id,
  );
  if (reservation === null) {
    return send({
      event: "voice_reserve_rejected",
      request_id: reserve.data.request_id,
      reason: "BUSY",
    });
  }
  socketState.acceptedVoiceReservation = reservation;
  return send(voiceReserveAccepted(reservation));

  async function applyVoiceCancel(
    binding: ApplicationDeviceBinding,
    cancel: z.infer<typeof VoiceCancelEvent>,
  ): Promise<boolean> {
    return deviceSpeechArbiter.runInTransaction(async (tx) => {
      const current = await deviceSpeechArbiter.acquire(
        binding.hardwareId,
        {
          mode: "MATCH_ACTIVE_LEASE",
          ownerKind: "VOICE_CAPTURE_RESERVED",
          ownerCorrelationId: cancel.request_id,
          leaseId: cancel.lease_id,
          receipt: cancel.reserve_receipt,
        },
        tx,
      );
      if (current === null) return false;
      return deviceSpeechArbiter.release(
        binding.hardwareId,
        {
          ownerKind: current.ownerKind,
          ownerCorrelationId: current.ownerCorrelationId,
          generation: current.generation,
          leaseId: current.leaseId,
          receipt: current.receipt,
        },
        tx,
      );
    });
  }
  ```

  The socket stores only its own last accepted tuple for immediate disconnect cleanup; PostgreSQL remains authoritative. Disconnect before promotion invokes `applyVoiceCancel` with that tuple. The five-second response timeout is ESP-owned; the backend never refreshes the 45-second database-clock expiry.

- [ ] **Step 4: Match and promote the exact persistent tuple before same-ID `RequestStore` admission.** Validate all three headers, derive the current `ApplicationDeviceBinding`, and call `runInTransaction`. Within it, `MATCH_ACTIVE_LEASE` reads the exact unexpired persistent tuple under the device advisory lock; `promote` uses its real `generation` and changes the same row to `VOICE_PROCESSING`, clearing `leaseId`, `receipt`, and `leaseExpiresAt` without releasing ownership. Only then call the existing synchronous `RequestStore.create` with the same request UUID and real uploaded-file metadata. Add `speechOwner` to the existing request record so every later terminal voice path can call Task 3 `release` with `ownerKind:"VOICE_PROCESSING"`, the same `ownerCorrelationId` and `generation`, and null lease fields.

  ```ts
  const headers = VoiceUploadHeaders.parse(request.headers);
  const binding = await currentApplicationBinding(request);
  if (!binding) {
    return reply.code(403).send({ error: "not_bound" });
  }

  let admitted:
    | { requestId: string; deviceId: string }
    | undefined;
  try {
    const stored = await deviceSpeechArbiter.runInTransaction(async (tx) => {
      const current = await deviceSpeechArbiter.acquire(
        binding.hardwareId,
        {
          mode: "MATCH_ACTIVE_LEASE",
          ownerKind: "VOICE_CAPTURE_RESERVED",
          ownerCorrelationId: headers["x-request-id"],
          leaseId: headers["x-voice-lease-id"],
          receipt: headers["x-voice-reserve-receipt"],
        },
        tx,
      );
      if (current === null) return null;

      const promoted = await deviceSpeechArbiter.promote(
        binding.hardwareId,
        {
          fromOwnerKind: "VOICE_CAPTURE_RESERVED",
          toOwnerKind: "VOICE_PROCESSING",
          ownerCorrelationId: current.ownerCorrelationId,
          generation: current.generation,
          leaseId: current.leaseId!,
          receipt: current.receipt!,
          nextLeaseId: null,
          nextReceipt: null,
          nextLeaseDurationMs: null,
        },
        tx,
      );
      if (!promoted) return null;

      const record = requestStore.create({
        requestId: current.ownerCorrelationId,
        deviceId: current.deviceId,
        inputPath: uploadedFile.path,
        inputSha256: uploadedFile.sha256,
        inputContentLength: uploadedFile.byteLength,
        speechOwner: {
          ownerKind: "VOICE_PROCESSING",
          ownerCorrelationId: current.ownerCorrelationId,
          generation: current.generation,
          leaseId: null,
          receipt: null,
        },
      });
      admitted = { requestId: record.requestId, deviceId: record.deviceId };
      return record;
    });
    if (stored === null) {
      return reply.code(409).send({
        error: "invalid_or_expired_voice_reservation",
      });
    }
    return reply.send(stored);
  } catch (error) {
    if (admitted) {
      requestStore.rollbackAcceptedCreateExact(
        admitted.requestId,
        admitted.deviceId,
      );
    }
    throw error;
  }
  ```

  `rollbackAcceptedCreateExact` removes only the exact just-created `accepted` record and matching active-device pointer if the surrounding database transaction rejects after synchronous admission; it cannot remove a progressed or different request. If `RequestStore.create` throws, the Prisma transaction rolls promotion back. Once promotion commits, upload-body, WAV-validation, processing, playback, disconnect, and failure handlers release the persisted processing owner from `record.speechOwner`; they never try to release with the cleared capture lease credentials.

- [ ] **Step 5: Cover persistence, identity, idempotency, exact cancellation, and no-gap promotion with Vitest; turn backend GREEN and commit separately.** Use the Task 3 PostgreSQL fixture for reservation state and Vitest `vi`/`Mocked` for socket, upload, and `RequestStore` edges. Assert duplicate acquire equality after advancing time, unchanged original `leaseExpiresAt`, a different request rejected as busy, terminal/reused correlation rejected stale, strict schemas rejecting spoofed device fields, P9 identity derived from `binding.hardwareId`, exact cancel only, 409 on a bad upload tuple, `MATCH_ACTIVE_LEASE` and `promote` sharing one transaction, promotion before `RequestStore.create`, persistent `VOICE_PROCESSING` during creation, rollback on create/commit failure, and exact processing-owner release on every terminal path.

  ```ts
  import {
    describe,
    expect,
    it,
    vi,
    type Mocked,
  } from "vitest";

  it("returns the original persistent fields without extending the lease", async () => {
    const first = await deviceSpeechArbiter.acquire(binding.hardwareId, {
      mode: "ACQUIRE_OR_RETURN_EXACT",
      ownerKind: "VOICE_CAPTURE_RESERVED",
      ownerCorrelationId: requestId,
      leaseDurationMs: 45_000,
    });
    await databaseClock.advanceBy(20_000);
    const duplicate = await deviceSpeechArbiter.acquire(binding.hardwareId, {
      mode: "ACQUIRE_OR_RETURN_EXACT",
      ownerKind: "VOICE_CAPTURE_RESERVED",
      ownerCorrelationId: requestId,
      leaseDurationMs: 45_000,
    });
    expect(duplicate).toEqual(first);
    expect(first?.leaseExpiresAt?.toISOString())
      .toBe("2026-08-25T00:00:45.000Z");
  });

  it("promotes before same-ID request admission in one runner transaction", async () => {
    const mockedRequestStore = requestStore as Mocked<RequestStore>;
    const promote = vi.spyOn(deviceSpeechArbiter, "promote");
    const create = vi.spyOn(mockedRequestStore, "create").mockImplementation((input) => {
      expect(input.requestId).toBe(requestId);
      expect(input.speechOwner.ownerCorrelationId).toBe(requestId);
      expect(input.speechOwner.generation).toBeGreaterThan(0);
      return storedRequest;
    });
    const response = await uploadWithHeaders(app, acceptedTuple);
    expect(response.statusCode).toBe(200);
    expect(promote.mock.invocationCallOrder[0]).toBeLessThan(
      create.mock.invocationCallOrder[0],
    );
  });
  ```

  Run:

  ```powershell
  Set-Location 'D:/codex/BMO/backend/.worktrees/esp-vps-dialog-schedule/backend'
  npx vitest run tests/voice-reserve.test.ts tests/voice-route.test.ts
  npm test
  git add src/websocket/events.ts src/websocket/websocket.server.ts src/websocket/device-registry.ts src/http/voice.route.ts src/domain/request-store.ts src/server.ts tests/voice-reserve.test.ts tests/voice-route.test.ts
  git commit -m "feat: persist voice capture reservations"
  ```

  Expected: focused and full backend suites pass; the commit contains only Task 4 backend implementation/tests and does not stage this plan.

- [ ] **Step 6: Create the collision-free ESP reservation module and make its source contract RED.** Create `main/voice_capture_reservation.h` and `main/voice_capture_reservation.cpp`; modify `main/api.cpp`, `main/wakeword.cpp`, and `main/CMakeLists.txt`; create `tests/test_voice_capture_reservation_contract.py`. Do not name this Task 4 module `voice_capture`, because Task 5 owns that module. Run:

  ```bat
  python -m unittest discover -s tests -p "test_voice_capture_reservation_contract.py" -v
  ```

  ```cpp
  // main/voice_capture_reservation.h
  #pragma once
  #include <cstdint>

  struct VoiceCaptureReservation {
      char request_id[37];
      char lease_id[37];
      char reserve_receipt[513];
      uint32_t capture_lease_duration_seconds;
      char capture_lease_expires_at[40];
  };

  enum class VoiceCaptureReserveResult : uint8_t {
      ACCEPTED,
      REJECTED,
      TIMEOUT,
  };

  bool voice_capture_reservation_init();
  VoiceCaptureReserveResult voice_capture_reservation_request(
      VoiceCaptureReservation* accepted);
  void voice_capture_reservation_on_accepted(
      const VoiceCaptureReservation& reservation);
  void voice_capture_reservation_on_rejected(
      const char* request_id, const char* reason);
  void voice_capture_reservation_cancel_best_effort(
      const VoiceCaptureReservation& reservation);
  ```

- [ ] **Step 7: Implement UUIDv4, the exact tuple, five-second wait, and stale/late cancellation.** Generate a new UUIDv4 for every current request, send `{event:"voice_reserve",request_id}`, and wait exactly `pdMS_TO_TICKS(5000)`. Start the conservative 45-second local monotonic deadline at successful reserve send, never at response receipt. An accepted response continues only when its request ID equals the current pending request and arrives before the response deadline. Store its lease ID, opaque receipt, literal duration, and ISO server expiry byte-for-byte. A mismatched or late accepted response is stale: do not change local state, but send a best-effort `voice_cancel` with that response's exact request/lease/receipt tuple so its persistent lease is not stranded.

  ```cpp
  constexpr TickType_t kVoiceReserveResponseTimeout = pdMS_TO_TICKS(5000);

  void voice_capture_reservation_on_accepted(
      const VoiceCaptureReservation& incoming) {
      xSemaphoreTake(g_lock, portMAX_DELAY);
      const bool current = g_pending
          && static_cast<int32_t>(g_deadline - xTaskGetTickCount()) > 0
          && std::strcmp(g_request_id, incoming.request_id) == 0;
      if (current) {
          g_accepted = incoming;
          g_result = VoiceCaptureReserveResult::ACCEPTED;
          g_pending = false;
          xSemaphoreGive(g_lock);
          xSemaphoreGive(g_response_ready);
          return;
      }
      xSemaphoreGive(g_lock);
      voice_capture_reservation_cancel_best_effort(incoming);
  }

  VoiceCaptureReserveResult voice_capture_reservation_request(
      VoiceCaptureReservation* accepted) {
      xSemaphoreTake(g_lock, portMAX_DELAY);
      make_uuid_v4(g_request_id);
      g_pending = true;
      g_deadline = xTaskGetTickCount() + kVoiceReserveResponseTimeout;
      char request_id[37]{};
      std::strncpy(request_id, g_request_id, sizeof(request_id) - 1);
      xSemaphoreGive(g_lock);

      if (!api_send_voice_reserve(request_id)
          || xSemaphoreTake(g_response_ready, kVoiceReserveResponseTimeout) != pdTRUE) {
          xSemaphoreTake(g_lock, portMAX_DELAY);
          g_pending = false;
          xSemaphoreGive(g_lock);
          return VoiceCaptureReserveResult::TIMEOUT;
      }
      *accepted = g_accepted;
      return g_result;
  }
  ```

  In `api.cpp`, parse/emit the exact snake_case event fields and send upload headers from the stored tuple:

  ```cpp
  http.set_header("X-Request-Id", reservation.request_id);
  http.set_header("X-Voice-Lease-Id", reservation.lease_id);
  http.set_header("X-Voice-Reserve-Receipt", reservation.reserve_receipt);
  ```

  `wakeword.cpp` continues into Task 5 capture only for `VoiceCaptureReserveResult::ACCEPTED`; rejected and timeout return to the prior eligible state without capture.

- [ ] **Step 8: Defend ESP wire names, timeout, stale cancel, and accepted-only continuation; turn GREEN, build externally, and commit separately.** The source contract must verify the collision-free filenames, `event` plus snake_case keys, UUIDv4 generation, exact 5-second wait, request-ID/deadline checks before tuple assignment, stale accepted calling best-effort cancel with the incoming exact tuple, all three HTTP headers, and accepted-only wakeword continuation.

  ```python
  import pathlib
  import unittest

  ROOT = pathlib.Path(__file__).resolve().parents[1]
  MAIN = ROOT / "main"

  class VoiceCaptureReservationContractTest(unittest.TestCase):
      def test_timeout_and_stale_accepted_cancel(self):
          source = (MAIN / "voice_capture_reservation.cpp").read_text(encoding="utf-8")
          self.assertIn("pdMS_TO_TICKS(5000)", source)
          body = function_body(source, "voice_capture_reservation_on_accepted")
          self.assertLess(body.index("g_request_id"), body.index("g_accepted = incoming"))
          self.assertLess(body.index("g_deadline"), body.index("g_accepted = incoming"))
          self.assertIn("voice_capture_reservation_cancel_best_effort(incoming)", body)

      def test_wire_contract_and_upload_tuple(self):
          api = (MAIN / "api.cpp").read_text(encoding="utf-8")
          for field in ('"event"', '"request_id"', '"lease_id"',
                        '"reserve_receipt"',
                        '"capture_lease_duration_seconds"',
                        '"capture_lease_expires_at"'):
              self.assertIn(field, api)
          for header in ("X-Request-Id", "X-Voice-Lease-Id",
                         "X-Voice-Reserve-Receipt"):
              self.assertIn(header, api)
          wakeword = (MAIN / "wakeword.cpp").read_text(encoding="utf-8")
          self.assertRegex(wakeword,
              r"VoiceCaptureReserveResult::ACCEPTED[\s\S]+voice_capture")
  ```

  Run:

  ```bat
  python -m unittest discover -s tests -p "test_voice_capture_reservation_contract.py" -v
  python -m unittest discover -s tests -p "test_*.py" -v
  cmd.exe /d /c "cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule\esp && call C:\esp\v6.0.1\esp-idf\export.bat && idf.py -B C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build build"
  ```

  Stage only ESP reservation/API/wakeword/CMake/test files and commit `git commit -m "feat: reserve voice capture on ESP"`. Do not stage this plan file.

## Task 5: Two-Stage Capture — keep WakeNet as the RX owner

- [ ] **Step 1: Lock the file scope and make the focused contract RED.** Change `main/voice_capture.h`, `main/voice_capture.cpp`, `main/wakeword.cpp`, `main/wakeword.h`, `main/audio.cpp`, `main/audio.h`, `main/state.cpp`, `main/CMakeLists.txt`, and create `tests/test_voice_capture_contract.py`. `wakeword_listener_task` remains the only continuous microphone/I2S RX owner; do not add an RX task, RX driver wrapper, or `audio_read_existing_rx`. Run:

  ```bat
  python -m unittest discover -s tests -p "test_voice_capture_contract.py" -v
  ```

- [ ] **Step 2: Define the shared atomic control session and exact timing/audio contracts in `main/voice_capture.h`.** These are control states, not face/display modes. WakeNet frames are complete 512-sample PCM16 frames at 16 kHz mono (32 ms). Use a 128 ms acknowledgement beep and a separately measured 128 ms drain/settle interval. The listener owns frame buffers, ambient ring, pre-roll, and PCM writes; fields touched by the control path are atomic.

  ```cpp
  #pragma once
  #include <array>
  #include <atomic>
  #include <cstddef>
  #include <cstdint>

  constexpr uint32_t kVoiceSampleRateHz = 16'000;
  constexpr uint16_t kVoiceChannels = 1;
  constexpr uint16_t kVoiceBitsPerSample = 16;
  constexpr size_t kWakeNetFrameSamples = 512;
  constexpr int64_t kWakeNetFrameUs = 32'000;
  constexpr uint32_t kVoiceAckBeepMs = 128;
  constexpr int64_t kVoiceDrainSettleUs = 128'000;
  constexpr int64_t kVoiceSpeechWaitUs = 5'000'000;
  constexpr int64_t kVoicePostSpeechMaxUs = 15'000'000;
  constexpr int64_t kVoiceTrailingSilenceUs = 1'500'000;
  constexpr size_t kIdleNoiseWindowFrames = 64;
  constexpr size_t kPostSettlePreRollFrames = 10;

  enum class VoiceCaptureControlState : uint8_t {
      VOICE_RESERVING,
      BEEP,
      DRAIN_SETTLE,
      CAPTURE_ARMED,
      RECORDING,
  };

  enum class VoiceCaptureFrameResult : uint8_t {
      CONTINUE,
      NO_SPEECH,
      TRAILING_SILENCE,
      MAX_DURATION,
      BUFFER_FULL,
  };

  struct AmbientNoiseModel {
      std::array<uint32_t, kIdleNoiseWindowFrames> rms{};
      uint64_t sum{0};
      size_t next{0};
      size_t count{0};
  };

  struct AmbientNoiseSnapshot {
      uint32_t mean_rms{0};
      uint32_t peak_rms{0};
      uint32_t start_threshold{0};
      uint32_t end_threshold{0};
  };

  struct VoiceCaptureSession {
      std::atomic<VoiceCaptureControlState> state{
          VoiceCaptureControlState::VOICE_RESERVING};
      std::atomic<int64_t> settle_started_us{0};
      std::atomic<int64_t> armed_at_us{0};
      std::atomic<int64_t> speech_started_us{0};
      AmbientNoiseModel eligible_idle_noise{};
      AmbientNoiseSnapshot capture_noise{};
      int64_t speech_wait_deadline_us{0};
      int64_t recording_deadline_us{0};
      int64_t last_voiced_frame_us{0};
      uint8_t consecutive_start_frames{0};
  };

  void voice_capture_observe_eligible_idle_frame(
      VoiceCaptureSession* session,
      const int16_t frame[kWakeNetFrameSamples]);
  bool voice_capture_begin_ack_beep(VoiceCaptureSession* session);
  void voice_capture_finish_ack_beep(VoiceCaptureSession* session,
                                     int64_t now_us);
  VoiceCaptureFrameResult voice_capture_on_full_wakenet_frame(
      VoiceCaptureSession* session,
      const int16_t frame[kWakeNetFrameSamples],
      int64_t frame_end_us);
  bool voice_capture_finalize_wav(uint8_t* buffer, size_t capacity,
                                  size_t pcm_bytes, size_t* wav_bytes);
  ```

- [ ] **Step 3: Continuously calibrate ambient noise only before wake in explicit eligible `IDLE`.** Keep `wakeword_listener_task` as the sole continuous microphone/I2S RX owner and keep its current read plus 512-sample WakeNet framing in `main/wakeword.cpp`. At each existing complete-frame boundary, call WakeNet first against the current frame. If it detects wake, snapshot the already accumulated bounded 64-frame ambient model into `session->capture_noise` before leaving eligible `IDLE`; do not add the detection frame to ambient calibration. If WakeNet does not detect, add the eligible full frame to the rolling model for the next call. Never update the model while disabled, reserving, beeping, settling, armed, recording, or playing audio, and never calibrate from capture frames.

  ```cpp
  static void observe_idle_noise(AmbientNoiseModel* model,
                                 const int16_t frame[kWakeNetFrameSamples]) {
      const uint32_t rms = frame_rms(frame, kWakeNetFrameSamples);
      if (model->count == kIdleNoiseWindowFrames) {
          model->sum -= model->rms[model->next];
      } else {
          ++model->count;
      }
      model->rms[model->next] = rms;
      model->sum += rms;
      model->next = (model->next + 1) % kIdleNoiseWindowFrames;
  }

  void wakeword_listener_task(void*) {
      for (;;) {
          // Keep the existing I2S read and partial accumulation here.
          if (!existing_wakenet_frame_is_complete(kWakeNetFrameSamples)) continue;
          const int64_t frame_end_us = esp_timer_get_time();

          if (wakeword_is_explicitly_idle_and_eligible()) {
              const bool detected =
                  call_existing_wakenet_detection(wakenet_frame);
              if (detected) {
                  g_voice_capture_session.capture_noise =
                      snapshot_idle_noise(
                          g_voice_capture_session.eligible_idle_noise);
                  continue_into_existing_wake_reservation();
              } else {
                  voice_capture_observe_eligible_idle_frame(
                      &g_voice_capture_session, wakenet_frame);
              }
              continue;
          }

          voice_capture_on_full_wakenet_frame(
              &g_voice_capture_session, wakenet_frame, frame_end_us);
      }
  }
  ```

  Keep the existing concrete I2S/frame-completion and WakeNet-call expressions in the implementation; the names above mark their required ordering and do not create a new RX abstraction. Wake eligibility begins only after the rolling model contains enough preceding ambient frames to snapshot. The capture path consumes that stored pre-wake snapshot and never recalculates it from the user's question.

- [ ] **Step 4: Play one short acknowledgement beep on the control path while the listener keeps draining full frames.** Add only `audio_play_voice_ack_beep()` to `main/audio.h/.cpp`; it uses the existing playback path for 128 ms and owns no RX code. The reservation/control path stores `BEEP` before calling the blocking beep. Because `wakeword_listener_task` remains active on its existing task as the continuous RX owner, it keeps completing 512-sample reads throughout the blocking beep and settle interval. Every such full frame is dispatched to the capture state machine and discarded; none reaches WakeNet, VAD, pre-roll, PCM, or calibration. After the beep returns, store a fresh settle origin and transition to `DRAIN_SETTLE`.

  ```cpp
  // main/audio.h
  bool audio_play_voice_ack_beep();

  // main/audio.cpp
  bool audio_play_voice_ack_beep() {
      static_assert(kVoiceAckBeepMs >= 100 && kVoiceAckBeepMs <= 150);
      return audio_play_existing_tone(kVoiceAckBeepHz, kVoiceAckBeepMs);
  }

  bool voice_capture_begin_ack_beep(VoiceCaptureSession* session) {
      session->state.store(VoiceCaptureControlState::BEEP,
                           std::memory_order_release);
      return audio_play_voice_ack_beep();
  }

  void voice_capture_finish_ack_beep(VoiceCaptureSession* session,
                                     int64_t now_us) {
      session->settle_started_us.store(now_us, std::memory_order_release);
      session->state.store(VoiceCaptureControlState::DRAIN_SETTLE,
                           std::memory_order_release);
  }
  ```

- [ ] **Step 5: Discard beep/settle frames, then logically reset on a complete settle-frame boundary.** `voice_capture_on_full_wakenet_frame` receives only full 512-sample frames already read by the continuous listener. `BEEP` and `DRAIN_SETTLE` return after discarding every frame and never classify, calibrate, write PCM, or populate pre-roll. When a settle frame ends at least 128 ms after `settle_started_us`, discard that boundary frame, reset pre-roll/PCM/VAD/silence/speech/recording counters together, retain the `capture_noise` snapshot taken immediately before the wake transition, derive no thresholds from post-wake audio, and arm at that frame's end timestamp. The first retained question frame is the next full frame.

  ```cpp
  static AmbientNoiseSnapshot snapshot_idle_noise(
      const AmbientNoiseModel& model) {
      AmbientNoiseSnapshot out{};
      out.mean_rms = static_cast<uint32_t>(model.sum / model.count);
      for (size_t i = 0; i < model.count; ++i) {
          out.peak_rms = std::max(out.peak_rms, model.rms[i]);
      }
      out.start_threshold = std::max(kMinimumSpeechRms,
          std::max(out.peak_rms + kStartMarginRms, out.mean_rms * 2U));
      out.end_threshold = std::max(kMinimumEndRms,
          std::max(out.peak_rms + kEndMarginRms,
                   out.mean_rms + out.mean_rms / 2U));
      if (out.end_threshold >= out.start_threshold) {
          out.end_threshold = out.start_threshold - 1;
      }
      return out;
  }

  VoiceCaptureFrameResult voice_capture_on_full_wakenet_frame(
      VoiceCaptureSession* session,
      const int16_t frame[kWakeNetFrameSamples],
      int64_t frame_end_us) {
      const auto state = session->state.load(std::memory_order_acquire);
      if (state == VoiceCaptureControlState::BEEP) {
          return VoiceCaptureFrameResult::CONTINUE;
      }
      if (state == VoiceCaptureControlState::DRAIN_SETTLE) {
          const int64_t settle_started =
              session->settle_started_us.load(std::memory_order_acquire);
          if (frame_end_us - settle_started >= kVoiceDrainSettleUs) {
              reset_post_settle_pre_roll();
              reset_pcm_after_wav_header();
              session->consecutive_start_frames = 0;
              session->armed_at_us.store(frame_end_us, std::memory_order_release);
              session->speech_wait_deadline_us =
                  frame_end_us + kVoiceSpeechWaitUs;
              session->state.store(VoiceCaptureControlState::CAPTURE_ARMED,
                                   std::memory_order_release);
          }
          return VoiceCaptureFrameResult::CONTINUE;
      }
      return process_post_settle_frame(session, frame, frame_end_us);
  }
  ```

  `main/state.cpp` exposes these values only as capture-control diagnostics; it must not add them to or alias them with display modes.

- [ ] **Step 6: Use the pre-wake ambient snapshot for start/end hysteresis; retain only post-settle pre-roll.** In `CAPTURE_ARMED`, push every full post-settle frame into the bounded 10-frame pre-roll. Do not spend or discard the first 200 ms of the user's question on calibration. Require three consecutive frames above the snapshot's higher start threshold. On confirmation, flush post-settle pre-roll, set the 15-second deadline from confirmed speech, and enter `RECORDING`. Update `last_voiced_frame_us` only above the lower end threshold; stop after 1.5 seconds below it or at the 15-second post-speech deadline. If speech is not confirmed by exactly 5 seconds from the arm boundary, return `NO_SPEECH`.

  ```cpp
  static VoiceCaptureFrameResult process_post_settle_frame(
      VoiceCaptureSession* session,
      const int16_t frame[kWakeNetFrameSamples],
      int64_t frame_end_us) {
      const uint32_t rms = frame_rms(frame, kWakeNetFrameSamples);
      if (session->state.load(std::memory_order_acquire)
          == VoiceCaptureControlState::CAPTURE_ARMED) {
          if (frame_end_us >= session->speech_wait_deadline_us) {
              return VoiceCaptureFrameResult::NO_SPEECH;
          }
          post_settle_pre_roll_push(frame);
          session->consecutive_start_frames =
              rms >= session->capture_noise.start_threshold
                  ? session->consecutive_start_frames + 1 : 0;
          if (session->consecutive_start_frames < 3) {
              return VoiceCaptureFrameResult::CONTINUE;
          }
          flush_post_settle_pre_roll_to_pcm();
          session->speech_started_us.store(frame_end_us, std::memory_order_release);
          session->recording_deadline_us =
              frame_end_us + kVoicePostSpeechMaxUs;
          session->last_voiced_frame_us = frame_end_us;
          session->state.store(VoiceCaptureControlState::RECORDING,
                               std::memory_order_release);
          return VoiceCaptureFrameResult::CONTINUE;
      }

      if (!append_pcm16_mono_frame(frame)) return VoiceCaptureFrameResult::BUFFER_FULL;
      if (rms >= session->capture_noise.end_threshold) {
          session->last_voiced_frame_us = frame_end_us;
      }
      if (frame_end_us - session->last_voiced_frame_us
          >= kVoiceTrailingSilenceUs) {
          return VoiceCaptureFrameResult::TRAILING_SILENCE;
      }
      if (frame_end_us >= session->recording_deadline_us) {
          return VoiceCaptureFrameResult::MAX_DURATION;
      }
      return VoiceCaptureFrameResult::CONTINUE;
  }
  ```

- [ ] **Step 7: Finalize a canonical PCM16/16 kHz/mono WAV in place.** Reserve 44 bytes before PCM, append only full post-settle frames, and write a little-endian RIFF/WAVE header without copying captured PCM. Required fields are PCM format 1, one channel, 16,000 Hz, 32,000 byte/s, block align 2, 16 bits/sample, and exact PCM data length.

  ```cpp
  bool voice_capture_finalize_wav(uint8_t* buffer, size_t capacity,
                                  size_t pcm_bytes, size_t* wav_bytes) {
      if (!buffer || !wav_bytes || capacity < 44 + pcm_bytes
          || pcm_bytes > UINT32_MAX - 36) return false;
      std::memcpy(buffer + 0, "RIFF", 4);
      put_le32(buffer + 4, static_cast<uint32_t>(36 + pcm_bytes));
      std::memcpy(buffer + 8, "WAVE", 4);
      std::memcpy(buffer + 12, "fmt ", 4);
      put_le32(buffer + 16, 16);
      put_le16(buffer + 20, 1);
      put_le16(buffer + 22, kVoiceChannels);
      put_le32(buffer + 24, kVoiceSampleRateHz);
      put_le32(buffer + 28, 32'000);
      put_le16(buffer + 32, 2);
      put_le16(buffer + 34, kVoiceBitsPerSample);
      std::memcpy(buffer + 36, "data", 4);
      put_le32(buffer + 40, static_cast<uint32_t>(pcm_bytes));
      *wav_bytes = 44 + pcm_bytes;
      return true;
  }
  ```

- [ ] **Step 8: Defend RX ownership, frame boundaries, ambient snapshot timing, beep exclusion, timer origins, hysteresis, and WAV in `tests/test_voice_capture_contract.py`.** Use the correct ESP root and isolate function bodies. The test must reject any independent RX task/driver helper, capture-time calibration window, pre-roll before arm, partial-frame dispatch, or display-mode collision.

  ```python
  import pathlib
  import re
  import unittest

  ROOT = pathlib.Path(__file__).resolve().parents[1]
  MAIN = ROOT / "main"

  def function_body(source: str, name: str) -> str:
      start = source.index(name)
      brace = source.index("{", start)
      depth = 0
      for index in range(brace, len(source)):
          depth += source[index] == "{"
          depth -= source[index] == "}"
          if depth == 0:
              return source[brace:index + 1]
      raise AssertionError(name)

  class VoiceCaptureContractTest(unittest.TestCase):
      def setUp(self):
          self.header = (MAIN / "voice_capture.h").read_text(encoding="utf-8")
          self.capture = (MAIN / "voice_capture.cpp").read_text(encoding="utf-8")
          self.wakeword = (MAIN / "wakeword.cpp").read_text(encoding="utf-8")
          self.audio = (MAIN / "audio.cpp").read_text(encoding="utf-8")

      def test_listener_remains_the_only_rx_owner_and_dispatches_full_frames(self):
          listener = function_body(self.wakeword, "wakeword_listener_task")
          self.assertIn("kWakeNetFrameSamples", listener)
          self.assertIn("voice_capture_on_full_wakenet_frame", listener)
          self.assertNotIn("audio_read_existing_rx", self.audio + self.capture)
          self.assertNotRegex(self.audio + self.capture, r"xTaskCreate[^;]+(?:rx|capture)")
          self.assertIn("kWakeNetFrameSamples = 512", self.header)

      def test_idle_noise_is_snapshotted_only_after_settle_boundary(self):
          listener = function_body(self.wakeword, "wakeword_listener_task")
          self.assertLess(listener.index("wakeword_is_explicitly_idle_and_eligible"),
                          listener.index("voice_capture_observe_eligible_idle_frame"))
          handler = function_body(self.capture, "voice_capture_on_full_wakenet_frame")
          self.assertLess(handler.index("DRAIN_SETTLE"),
                          handler.index("snapshot_idle_noise"))
          self.assertLess(handler.index("snapshot_idle_noise"),
                          handler.index("CAPTURE_ARMED"))
          self.assertNotRegex(self.capture, r"(?:calibrat|noise)[\s\S]{0,80}200(?:'000|ms)")

      def test_beep_and_settle_frames_are_excluded(self):
          handler = function_body(self.capture, "voice_capture_on_full_wakenet_frame")
          self.assertLess(handler.index("BEEP"), handler.index("DRAIN_SETTLE"))
          self.assertLess(handler.index("DRAIN_SETTLE"),
                          handler.index("reset_post_settle_pre_roll"))
          self.assertLess(handler.index("reset_post_settle_pre_roll"),
                          handler.index("CAPTURE_ARMED"))
          self.assertGreaterEqual(handler.count("VoiceCaptureFrameResult::CONTINUE"), 2)
          beep = function_body(self.audio, "audio_play_voice_ack_beep")
          self.assertIn("kVoiceAckBeepMs", beep)
          self.assertNotRegex(beep, r"(?:i2s.*read|receive|rx)")

      def test_timer_origins_and_hysteresis(self):
          self.assertIn("kVoiceSpeechWaitUs = 5'000'000", self.header)
          self.assertIn("kVoicePostSpeechMaxUs = 15'000'000", self.header)
          self.assertIn("kVoiceTrailingSilenceUs = 1'500'000", self.header)
          self.assertRegex(self.capture,
              r"speech_wait_deadline_us\s*=\s*frame_end_us\s*\+\s*kVoiceSpeechWaitUs")
          self.assertRegex(self.capture,
              r"recording_deadline_us\s*=\s*frame_end_us\s*\+\s*kVoicePostSpeechMaxUs")
          self.assertIn("start_threshold", self.capture)
          self.assertIn("end_threshold", self.capture)
          self.assertIn("out.end_threshold >= out.start_threshold", self.capture)
          self.assertIn("post_settle_pre_roll_push", self.capture)

      def test_canonical_wav(self):
          wav = function_body(self.capture, "voice_capture_finalize_wav")
          for token in ('"RIFF"', '"WAVE"', '"fmt "', '"data"',
                        "buffer + 20, 1", "buffer + 22, kVoiceChannels",
                        "buffer + 24, kVoiceSampleRateHz", "buffer + 28, 32'000",
                        "buffer + 32, 2", "buffer + 40"):
              self.assertIn(token, wav)

  if __name__ == "__main__":
      unittest.main()
  ```

- [ ] **Step 9: Turn GREEN, run full firmware discovery and the exact external build, then commit implementation only.** Verify an accepted trace in this order: eligible-IDLE ambient rolling model → wake/reserve → `BEEP` while listener discards frames → measured `DRAIN_SETTLE` while listener discards frames → logical reset at the final settle-frame boundary → ambient snapshot and `CAPTURE_ARMED` → post-settle pre-roll/speech → 1.5-second silence or 15-second post-speech cap → canonical WAV.

  ```bat
  python -m unittest discover -s tests -p "test_voice_capture_contract.py" -v
  python -m unittest discover -s tests -p "test_*.py" -v
  cmd.exe /d /c "cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule\esp && call C:\esp\v6.0.1\esp-idf\export.bat && idf.py -B C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build build"
  git add main/voice_capture.h main/voice_capture.cpp main/wakeword.cpp main/wakeword.h main/audio.cpp main/audio.h main/state.cpp main/CMakeLists.txt tests/test_voice_capture_contract.py
  git commit -m "feat: add two-stage voice capture"
  ```

  Do not stage or commit this plan file.

## Task 6: Observability Calibration

- [ ] **Step 1: Lock scope, log policy, and make the focused source contract RED.** Modify only `main/wakeword.cpp`, `main/voice_capture.h`, `main/voice_capture.cpp`, and `main/api.cpp`; create `tests/test_mic_observability_contract.py`; later create `docs/evidence/mic-observability-calibration.json` and `docs/evidence/mic-observability-calibration.md`. Serial JSON-lines are primary; an existing bounded `device_log` may mirror only after serial. Never log, encode, retain, or mirror raw audio/PCM samples.

  ```bat
  python -m unittest discover -s tests -p "test_mic_observability_contract.py" -v
  ```

- [ ] **Step 2: Add a fixed-size once-per-second aggregate in `main/voice_capture.h/.cpp`.** Count full 512-sample frames, RX timeouts, partial reads, clipping samples, wake-eligible frames, WakeNet detect calls/detections, and VAD classifications. Accumulate peak absolute sample, sum-of-squares, and sample count so the emitted RMS is computed over the full one-second window. Include the continuously rolling eligible-IDLE ambient mean/peak plus the capture snapshot's start/end thresholds. All hot-path updates are atomic and allocation-free.

  ```cpp
  constexpr int64_t kMicStatsPeriodUs = 1'000'000;

  struct MicObservabilityStats {
      std::atomic<uint32_t> full_frames{0};
      std::atomic<uint32_t> read_timeouts{0};
      std::atomic<uint32_t> partial_reads{0};
      std::atomic<uint32_t> peak_abs{0};
      std::atomic<uint64_t> sum_squares{0};
      std::atomic<uint32_t> sample_count{0};
      std::atomic<uint32_t> clipping_samples{0};
      std::atomic<uint32_t> wake_eligible_frames{0};
      std::atomic<uint32_t> wake_detect_calls{0};
      std::atomic<uint32_t> wake_detections{0};
      std::atomic<uint32_t> vad_below_end{0};
      std::atomic<uint32_t> vad_between{0};
      std::atomic<uint32_t> vad_above_start{0};
      std::atomic<int64_t> window_started_us{0};
  };

  struct MicCalibrationSnapshot {
      uint32_t ambient_mean_rms;
      uint32_t ambient_peak_rms;
      uint32_t start_threshold;
      uint32_t end_threshold;
  };

  enum class VoiceStage : uint8_t {
      WAKE,
      BEEP,
      DRAIN,
      ARM,
      SPEECH,
      WAV_READY,
      UPLOAD_START,
      UPLOAD_DONE,
      AUDIO_START,
      FIRST_PCM,
      TERMINAL,
      IDLE,
  };

  void mic_observability_on_full_frame(
      MicObservabilityStats* stats,
      const int16_t frame[kWakeNetFrameSamples]);
  void mic_observability_on_read_timeout(MicObservabilityStats* stats);
  void mic_observability_on_partial_read(MicObservabilityStats* stats);
  void mic_observability_maybe_emit(
      MicObservabilityStats* stats,
      const MicCalibrationSnapshot& calibration,
      VoiceCaptureControlState state,
      bool wake_eligible,
      int64_t now_us);
  void mic_observability_log_stage(VoiceStage stage,
                                   const char* request_id,
                                   int64_t timestamp_us);
  ```

  ```cpp
  void mic_observability_on_full_frame(
      MicObservabilityStats* stats,
      const int16_t frame[kWakeNetFrameSamples]) {
      uint32_t peak = 0;
      uint64_t squares = 0;
      uint32_t clipped = 0;
      for (size_t i = 0; i < kWakeNetFrameSamples; ++i) {
          const int32_t sample = frame[i];
          const uint32_t magnitude = static_cast<uint32_t>(
              sample < 0 ? -sample : sample);
          peak = std::max(peak, magnitude);
          squares += static_cast<uint64_t>(sample * sample);
          clipped += magnitude >= 32'760;
      }
      stats->full_frames.fetch_add(1, std::memory_order_relaxed);
      stats->sum_squares.fetch_add(squares, std::memory_order_relaxed);
      stats->sample_count.fetch_add(kWakeNetFrameSamples,
                                    std::memory_order_relaxed);
      stats->clipping_samples.fetch_add(clipped, std::memory_order_relaxed);
      atomic_max(&stats->peak_abs, peak);
  }
  ```

- [ ] **Step 3: Instrument the existing `wakeword_listener_task` without changing RX ownership or cadence.** At its existing read outcomes, increment timeout/partial/full counters. For each full frame, record peak/RMS/clipping before any classification. Increment `wake_eligible_frames` only when the state is explicitly eligible `IDLE`; increment `wake_detect_calls` immediately around each real WakeNet invocation and `wake_detections` only for a positive result. Call `mic_observability_maybe_emit` on every loop path so timeout-only windows still produce one aggregate line per second.

  ```cpp
  if (read_timed_out) {
      mic_observability_on_read_timeout(&g_mic_stats);
      mic_observability_maybe_emit(&g_mic_stats, current_calibration(),
                                   current_capture_state(), false,
                                   esp_timer_get_time());
      continue;
  }
  if (samples_read != kWakeNetFrameSamples) {
      mic_observability_on_partial_read(&g_mic_stats);
      continue;
  }

  mic_observability_on_full_frame(&g_mic_stats, wakenet_frame);
  const bool eligible = wakeword_is_explicitly_idle_and_eligible();
  if (eligible) {
      g_mic_stats.wake_eligible_frames.fetch_add(1, std::memory_order_relaxed);
      g_mic_stats.wake_detect_calls.fetch_add(1, std::memory_order_relaxed);
      const bool detected = call_existing_wakenet_detection(wakenet_frame);
      if (detected) {
          g_mic_stats.wake_detections.fetch_add(1, std::memory_order_relaxed);
          mic_observability_log_stage(
              VoiceStage::WAKE, current_request_id(), esp_timer_get_time());
      }
  }
  mic_observability_maybe_emit(&g_mic_stats, current_calibration(),
                               current_capture_state(), eligible,
                               esp_timer_get_time());
  ```

- [ ] **Step 4: Emit a stable bounded JSON schema to serial first.** Every one-second `mic_stats` line includes timestamps/window duration, control state/eligibility, all RX/audio counters, aggregate peak/RMS/clipping, WakeNet counters, rolling ambient values, snapshotted thresholds, and below-end/between/above-start VAD classifications. Exchange counters only after the one-second boundary so each event belongs to exactly one window. The emitter receives aggregates only—never a frame pointer.

  ```cpp
  const uint64_t squares = stats->sum_squares.exchange(0);
  const uint32_t samples = stats->sample_count.exchange(0);
  const uint32_t rms = samples == 0
      ? 0 : static_cast<uint32_t>(std::sqrt(squares / samples));
  char line[768];
  const int length = std::snprintf(
      line, sizeof(line),
      "{\"event\":\"mic_stats\",\"ts_us\":%lld,\"window_ms\":1000,"
      "\"state\":\"%s\",\"wake_eligible\":%s,"
      "\"rx\":{\"full_frames\":%u,\"timeouts\":%u,\"partials\":%u},"
      "\"signal\":{\"peak\":%u,\"rms\":%u,\"clipping\":%u},"
      "\"wake\":{\"eligible_frames\":%u,\"detect_calls\":%u,\"detections\":%u},"
      "\"vad\":{\"ambient_mean\":%u,\"ambient_peak\":%u,"
      "\"start_threshold\":%u,\"end_threshold\":%u,"
      "\"below_end\":%u,\"between\":%u,\"above_start\":%u}}",
      static_cast<long long>(now_us), state_name(state),
      wake_eligible ? "true" : "false",
      full_frames, timeouts, partials, peak, rms, clipping,
      eligible_frames, detect_calls, detections,
      calibration.ambient_mean_rms, calibration.ambient_peak_rms,
      calibration.start_threshold, calibration.end_threshold,
      below_end, between, above_start);
  if (length > 0 && length < static_cast<int>(sizeof(line))) {
      ESP_LOGI("MIC_OBS", "%s", line);
  }
  ```

  If the existing `device_log` mirror is enabled, cap it to the existing maximum record length, call it only after `ESP_LOGI`, and drop an oversized mirror rather than truncating JSON or blocking serial.

- [ ] **Step 5: Log monotonic stage timestamps from `voice_capture.cpp` and `api.cpp`.** Emit a separate bounded `voice_stage` JSON line at each actual transition: `wake`, `beep`, `drain`, `arm`, `speech`, `wav_ready`, `upload_start`, `upload_done`, `audio_start`, `first_pcm`, `terminal`, and `idle`. Include only `request_id`, stage, and monotonic `ts_us`; never include WAV, PCM, request audio, decoded samples, or model input. `first_pcm` is logged once immediately before the first successful PCM playback write. Terminal precedes the existing transition to `IDLE`, then log `idle` after that transition.

  ```cpp
  void mic_observability_log_stage(VoiceStage stage,
                                   const char* request_id,
                                   int64_t timestamp_us) {
      char line[192];
      const int length = std::snprintf(
          line, sizeof(line),
          "{\"event\":\"voice_stage\",\"request_id\":\"%s\","
          "\"stage\":\"%s\",\"ts_us\":%lld}",
          request_id, voice_stage_name(stage),
          static_cast<long long>(timestamp_us));
      if (length > 0 && length < static_cast<int>(sizeof(line))) {
          ESP_LOGI("MIC_OBS", "%s", line);
      }
  }
  ```

  Place calls at the state changes already implemented by Tasks 4–5 and around the existing API upload/playback path; do not create parallel state transitions just for logging.

- [ ] **Step 6: Defend the aggregate schema, cadence, classification, stage coverage, serial-first order, and raw-audio prohibition in `tests/test_mic_observability_contract.py`.** Use the correct ESP root. Assert counter updates at real read/detect branches, exactly one-second cadence, required JSON keys, ambient/snapshot thresholds, all stage names, `terminal` before `idle`, and no frame/sample pointer in either emitter. If an existing `device_log` call is present, assert it follows `ESP_LOGI` and uses a bounded length.

  ```python
  import pathlib
  import re
  import unittest

  ROOT = pathlib.Path(__file__).resolve().parents[1]
  MAIN = ROOT / "main"

  def function_body(source: str, name: str) -> str:
      start = source.index(name)
      brace = source.index("{", start)
      depth = 0
      for index in range(brace, len(source)):
          depth += source[index] == "{"
          depth -= source[index] == "}"
          if depth == 0:
              return source[brace:index + 1]
      raise AssertionError(name)

  class MicObservabilityContractTest(unittest.TestCase):
      def setUp(self):
          self.header = (MAIN / "voice_capture.h").read_text(encoding="utf-8")
          self.capture = (MAIN / "voice_capture.cpp").read_text(encoding="utf-8")
          self.wakeword = (MAIN / "wakeword.cpp").read_text(encoding="utf-8")
          self.api = (MAIN / "api.cpp").read_text(encoding="utf-8")

      def test_once_per_second_schema_has_all_aggregates(self):
          self.assertIn("kMicStatsPeriodUs = 1'000'000", self.header)
          emit = function_body(self.capture, "mic_observability_maybe_emit")
          for key in ("full_frames", "timeouts", "partials", "peak", "rms",
                      "clipping", "eligible_frames", "detect_calls", "detections",
                      "ambient_mean", "ambient_peak", "start_threshold",
                      "end_threshold", "below_end", "between", "above_start"):
              self.assertIn(key, emit)
          self.assertNotRegex(emit, r"(?:frame|samples|pcm)\s*\[")

      def test_wake_counters_wrap_real_detection(self):
          listener = function_body(self.wakeword, "wakeword_listener_task")
          call = listener.index("call_existing_wakenet_detection")
          self.assertLess(listener.index("wake_detect_calls"), call)
          self.assertGreater(listener.index("wake_detections"), call)
          self.assertIn("mic_observability_on_read_timeout", listener)
          self.assertIn("mic_observability_on_partial_read", listener)

      def test_stage_schema_is_complete_and_terminal_precedes_idle(self):
          for stage in ("WAKE", "BEEP", "DRAIN", "ARM", "SPEECH", "WAV_READY",
                        "UPLOAD_START", "UPLOAD_DONE", "AUDIO_START", "FIRST_PCM",
                        "TERMINAL", "IDLE"):
              self.assertIn(stage, self.header)
          terminal = self.api.index("VoiceStage::TERMINAL")
          idle = self.api.index("VoiceStage::IDLE", terminal)
          self.assertLess(terminal, idle)
          stage_emit = function_body(self.capture, "mic_observability_log_stage")
          self.assertNotRegex(stage_emit, r"(?:frame|samples)\s*\[")

      def test_serial_is_primary_and_optional_mirror_is_bounded(self):
          emit = function_body(self.capture, "mic_observability_maybe_emit")
          serial = emit.index("ESP_LOGI")
          if "device_log" in emit:
              self.assertLess(serial, emit.index("device_log"))
              self.assertRegex(emit, r"device_log[\s\S]{0,120}(?:sizeof|max|length)")

  if __name__ == "__main__":
      unittest.main()
  ```

- [ ] **Step 7: Turn firmware GREEN, run full discovery and the exact external build, then commit implementation only.** Run:

  ```bat
  python -m unittest discover -s tests -p "test_mic_observability_contract.py" -v
  python -m unittest discover -s tests -p "test_*.py" -v
  cmd.exe /d /c "cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule\esp && call C:\esp\v6.0.1\esp-idf\export.bat && idf.py -B C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build build"
  git add main/wakeword.cpp main/voice_capture.h main/voice_capture.cpp main/api.cpp tests/test_mic_observability_contract.py
  git commit -m "feat: add microphone observability"
  ```

  Do not stage this plan file or evidence before the implementation commit.

- [ ] **Step 8: Detect COM12 and capture serial evidence without erase/model writes.** Confirm the target appears as COM12, verify the connected device identity, and monitor the already deployed matching firmware without erasing flash, writing a model partition, or resetting on monitor attach:

  ```bat
  python -m serial.tools.list_ports -v
  cmd.exe /d /c "cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule\esp && call C:\esp\v6.0.1\esp-idf\export.bat && idf.py -B C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build -p COM12 monitor --no-reset"
  ```

  If the matching implementation is not on the device, use only the project's approved application-only deployment path; never run `erase-flash` or write the WakeNet/model partition. Save structured serial lines only—never raw microphone data.

- [ ] **Step 9: Run the hardware calibration gate and record distributions.** First collect at least two minutes of ambient `mic_stats` while the device is explicitly `IDLE` with `wake_eligible:true`; record RMS/peak/clipping and rolling ambient/threshold distributions. Then run 10 spoken wake trials at a measured 15–20 cm. Before every trial, record the immediately preceding aggregate's timestamp, `state:"IDLE"`, and `wake_eligible:true`; mark the trial invalid and repeat it if either precondition is absent. Pass only with at least 8 detections in 10 valid trials. Finally run a continuous 10-minute no-speech soak under the same explicit eligible-IDLE condition; pass only with at most one false wake. If thresholds change, rebuild/redeploy and repeat the complete ambient, 10-trial, and 10-minute gates.

- [ ] **Step 10: Write measured calibration evidence with the firmware hash and commit evidence separately.** Create `docs/evidence/mic-observability-calibration.json` only after the hardware run and a matching human-readable `docs/evidence/mic-observability-calibration.md`. The JSON must contain schema version `1`; the measured 40-hex firmware commit and 64-hex application SHA-256; COM12 identity and `monitor_no_reset:true`; ambient start time, duration of at least 120 seconds, `eligible_idle_only:true`, measured RMS/peak/clipping/start-threshold/end-threshold distributions; exactly 10 valid spoken trials at 15–20 cm, each with nonzero precondition/stage timestamp references, `state:"IDLE"`, eligibility, and detection result; the 600-second eligible soak and measured false-wake count; and the computed acceptance verdict. Do not create or commit the file with empty strings, zero timestamp references, synthetic hashes, omitted measurements, or raw audio.

  Validate that the JSON values match the Markdown table and structured serial timestamps, then commit only evidence:

  ```bat
  git add docs/evidence/mic-observability-calibration.json docs/evidence/mic-observability-calibration.md
  git commit -m "docs: record microphone calibration evidence"
  ```

## Task 7: Schedule Chat Schema

- [ ] **Step 1: Lock the backend file set and make focused schema/repository tests RED.** Update `backend/prisma/schema.prisma`; create `backend/prisma/migrations/20260825_bmo_schedule_chat/migration.sql`; add/update `backend/src/repositories/schedule-chat.repository.ts`; create `backend/tests/schema/schedule-chat-schema.test.ts` and `backend/tests/repositories/schedule-chat.repository.test.ts`. Run from `backend`:

  ```bat
  npx vitest run tests/schema/schedule-chat-schema.test.ts tests/repositories/schedule-chat.repository.test.ts
  npx prisma validate --schema prisma/schema.prisma
  ```

  The focused Vitest run must be RED for the missing purpose/session/result-message contracts; `prisma validate` must remain a clean structural baseline before editing.

- [ ] **Step 2: Add the exact Prisma enum, per-user/purpose session key, and one-to-one run result relation.** Adapt the existing `ChatSession` default to `USER_CHAT` so old and unspecified sessions retain current behavior. A nullable unique `ChatMessage.scheduleRunId` links an assistant result to at most one `ScheduleRun`; the inverse optional field makes the relation one-to-one.

  ```prisma
  enum ChatSessionPurpose {
    USER_CHAT
    BMO_SCHEDULE
  }

  model ChatSession {
    id        String             @id @default(uuid()) @db.Uuid
    userId    String             @db.Uuid
    purpose   ChatSessionPurpose @default(USER_CHAT)
    user      User               @relation(fields: [userId], references: [id])
    messages  ChatMessage[]

    @@unique([userId, purpose])
  }

  model ChatMessage {
    id            String       @id @default(uuid()) @db.Uuid
    sessionId     String       @db.Uuid
    scheduleRunId String?      @unique @db.Uuid
    role          ChatRole
    content       String
    session       ChatSession  @relation(fields: [sessionId], references: [id])
    scheduleRun   ScheduleRun? @relation(
      "ScheduleRunResultMessage",
      fields: [scheduleRunId],
      references: [id],
      onDelete: SetNull
    )
  }

  model ScheduleRun {
    id            String       @id @default(uuid()) @db.Uuid
    resultMessage ChatMessage? @relation("ScheduleRunResultMessage")
  }
  ```

  Merge these fields into the existing models rather than duplicating existing IDs, relations, timestamps, role/content fields, or mappings. Run `npx prisma format --schema prisma/schema.prisma` and `npx prisma validate --schema prisma/schema.prisma`.

- [ ] **Step 3: Write the timestamped migration with an explicit existing-row backfill.** Add the purpose column as nullable, backfill every existing `ChatSession` to `USER_CHAT`, then set the default and `NOT NULL`. Existing rows remain valid. Drop the old user-only uniqueness if present, replace it with `(userId, purpose)`, and add the nullable UUID, unique index, and foreign key for schedule results. PostgreSQL permits multiple `NULL` values in the unique result index.

  ```sql
  CREATE TYPE "ChatSessionPurpose" AS ENUM ('USER_CHAT', 'BMO_SCHEDULE');

  ALTER TABLE "ChatSession"
    ADD COLUMN "purpose" "ChatSessionPurpose";

  UPDATE "ChatSession"
  SET "purpose" = 'USER_CHAT'
  WHERE "purpose" IS NULL;

  ALTER TABLE "ChatSession"
    ALTER COLUMN "purpose" SET DEFAULT 'USER_CHAT',
    ALTER COLUMN "purpose" SET NOT NULL;

  DROP INDEX IF EXISTS "ChatSession_userId_key";
  CREATE UNIQUE INDEX "ChatSession_userId_purpose_key"
    ON "ChatSession"("userId", "purpose");

  ALTER TABLE "ChatMessage"
    ADD COLUMN "scheduleRunId" UUID;

  CREATE UNIQUE INDEX "ChatMessage_scheduleRunId_key"
    ON "ChatMessage"("scheduleRunId");

  ALTER TABLE "ChatMessage"
    ADD CONSTRAINT "ChatMessage_scheduleRunId_fkey"
    FOREIGN KEY ("scheduleRunId")
    REFERENCES "ScheduleRun"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  ```

  Keep the folder name exactly `20260825_bmo_schedule_chat`; do not regenerate it under a different timestamp.

- [ ] **Step 4: Implement deterministic schedule-chat creation under a per-user PostgreSQL advisory lock.** The repository transaction first takes the user lock, verifies the run belongs to that user, returns the existing message for an already-materialized run, upserts the single `BMO_SCHEDULE` session through the compound unique key, and creates one `ASSISTANT` message linked by `scheduleRunId`. The unique result relation is the database backstop; retries return the same row instead of creating another assistant message.

  ```ts
  import { ChatRole, ChatSessionPurpose, type PrismaClient } from "@prisma/client";

  export class ScheduleChatRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async appendRunResult(input: {
      userId: string;
      scheduleRunId: string;
      content: string;
    }) {
      return this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`bmo-schedule-chat:${input.userId}`}, 0)
          )
        `;

        const run = await tx.scheduleRun.findFirstOrThrow({
          where: { id: input.scheduleRunId, userId: input.userId },
          select: { id: true },
        });
        const existing = await tx.chatMessage.findUnique({
          where: { scheduleRunId: run.id },
        });
        if (existing) return existing;

        const session = await tx.chatSession.upsert({
          where: {
            userId_purpose: {
              userId: input.userId,
              purpose: ChatSessionPurpose.BMO_SCHEDULE,
            },
          },
          create: {
            userId: input.userId,
            purpose: ChatSessionPurpose.BMO_SCHEDULE,
          },
          update: {},
        });

        return tx.chatMessage.create({
          data: {
            sessionId: session.id,
            scheduleRunId: run.id,
            role: ChatRole.ASSISTANT,
            content: input.content,
          },
        });
      });
    }
  }
  ```

- [ ] **Step 5: Defend the schema and migration ordering with a focused Vitest source contract.** Assert the exact enum values/default, compound session uniqueness, nullable UUID plus unique run link, named inverse relation, exact migration directory, `USER_CHAT` backfill before `NOT NULL`, and unique/FK SQL.

  ```ts
  import { readFileSync } from "node:fs";
  import { describe, expect, it } from "vitest";

  describe("schedule chat schema", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const migration = readFileSync(
      "prisma/migrations/20260825_bmo_schedule_chat/migration.sql",
      "utf8",
    );

    it("defines one session per user and purpose", () => {
      expect(schema).toMatch(/enum ChatSessionPurpose\s*{[^}]*USER_CHAT[^}]*BMO_SCHEDULE/s);
      expect(schema).toMatch(/purpose\s+ChatSessionPurpose\s+@default\(USER_CHAT\)/);
      expect(schema).toContain("@@unique([userId, purpose])");
    });

    it("defines exactly one assistant result link per schedule run", () => {
      expect(schema).toMatch(/scheduleRunId\s+String\?\s+@unique\s+@db\.Uuid/);
      expect(schema).toContain('"ScheduleRunResultMessage"');
      expect(migration).toContain('"ChatMessage_scheduleRunId_key"');
      expect(migration).toContain('"ChatMessage_scheduleRunId_fkey"');
    });

    it("backfills existing sessions before enforcing non-null", () => {
      const backfill = migration.indexOf("SET \"purpose\" = 'USER_CHAT'");
      const notNull = migration.indexOf('ALTER COLUMN "purpose" SET NOT NULL');
      expect(backfill).toBeGreaterThanOrEqual(0);
      expect(backfill).toBeLessThan(notNull);
    });
  });
  ```

- [ ] **Step 6: Prove repository determinism and exactly one assistant message per run against PostgreSQL.** Use the backend's real database fixture. Concurrent calls for the same user/run must return one message ID; different schedule runs for one user must share one `BMO_SCHEDULE` session; an existing/default chat remains `USER_CHAT`; and a run owned by another user must fail without creating a session or message.

  ```ts
  import { ChatRole, ChatSessionPurpose } from "@prisma/client";
  import { describe, expect, it } from "vitest";

  it("creates one deterministic session and one result message under retries", async () => {
    const calls = await Promise.all(
      Array.from({ length: 6 }, () => repository.appendRunResult({
        userId: user.id,
        scheduleRunId: run.id,
        content: "Schedule completed",
      })),
    );
    expect(new Set(calls.map((message) => message.id)).size).toBe(1);

    const sessions = await prisma.chatSession.findMany({
      where: { userId: user.id, purpose: ChatSessionPurpose.BMO_SCHEDULE },
    });
    expect(sessions).toHaveLength(1);
    expect(await prisma.chatMessage.count({
      where: { scheduleRunId: run.id, role: ChatRole.ASSISTANT },
    })).toBe(1);
  });

  it("reuses the per-user schedule session across runs", async () => {
    const first = await repository.appendRunResult(firstInput);
    const second = await repository.appendRunResult(secondInput);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.scheduleRunId).not.toBe(first.scheduleRunId);
  });
  ```

- [ ] **Step 7: Apply/generate, turn GREEN, typecheck, run full tests, and commit.** From `backend`, apply the exact checked-in migration to the development database, regenerate Prisma types, and run all validation in order:

  ```bat
  npx prisma migrate dev --schema prisma/schema.prisma
  npx prisma generate --schema prisma/schema.prisma
  npx prisma validate --schema prisma/schema.prisma
  npx vitest run tests/schema/schedule-chat-schema.test.ts tests/repositories/schedule-chat.repository.test.ts
  npx tsc --noEmit
  npm test
  ```

  Confirm migrated legacy sessions are `USER_CHAT`, creating `BMO_SCHEDULE` does not alter them, duplicate run delivery returns the original assistant message, and each run has exactly one linked assistant result. Stage only the backend schema, exact migration, repository, and tests; do not stage this plan file:

  ```bat
  git add prisma/schema.prisma prisma/migrations/20260825_bmo_schedule_chat/migration.sql src/repositories/schedule-chat.repository.ts tests/schema/schedule-chat-schema.test.ts tests/repositories/schedule-chat.repository.test.ts
  git commit -m "feat: add schedule chat sessions"
  ```

## Task 8: Scheduled Result Service

- [ ] **Step 1: Lock scope and make focused service/validator/repository tests RED.** Create `backend/src/services/schedule-result.validation.ts` and `backend/src/services/scheduled-result.service.ts`; modify `backend/src/p9/index.ts`, `backend/src/scheduler/runScheduler.ts`, `backend/src/repositories/schedule-run.repository.ts`, `backend/src/repositories/schedule-chat.repository.ts`, and `backend/src/mobile-events/index.ts`; create/update `backend/tests/services/schedule-result.validation.test.ts`, `backend/tests/services/scheduled-result.service.test.ts`, and `backend/tests/repositories/schedule-chat.repository.test.ts`. From `backend`, run:

  ```bat
  npx vitest run tests/services/schedule-result.validation.test.ts tests/services/scheduled-result.service.test.ts tests/repositories/schedule-chat.repository.test.ts
  ```

  RED must cover the missing Unicode rule, one-repair limit, atomic message/run persistence, post-commit events, and failure gating. Do not modify normal chat handling and do not inject or call `ChatService`.

- [ ] **Step 2: Implement the exact Unicode 2–10-word validator.** Normalize to NFC and trim Unicode whitespace; reject CR/LF; split on one-or-more Unicode `White_Space` characters. Require 2 through 10 tokens. Tokens contain Unicode letters, marks, or numbers, with optional internal apostrophe or hyphen joins; only the final token may have one terminal `.`, `!`, `?`, or `…`. Return the normalized single-space result so persistence and speech use identical text.

  ```ts
  const WORD = /^[\p{L}\p{M}\p{N}]+(?:['’\-‐][\p{L}\p{M}\p{N}]+)*$/u;
  const FINAL_WORD = /^[\p{L}\p{M}\p{N}]+(?:['’\-‐][\p{L}\p{M}\p{N}]+)*[.!?…]?$/u;

  export type ScheduleResultValidation =
    | { valid: true; value: string; wordCount: number }
    | { valid: false; reason: "empty" | "multiline" | "word_count" | "token" };

  export function validateScheduleResult(input: string): ScheduleResultValidation {
    const normalized = input.normalize("NFC").trim();
    if (!normalized) return { valid: false, reason: "empty" };
    if (/[\r\n]/u.test(normalized)) return { valid: false, reason: "multiline" };
    const words = normalized.split(/\p{White_Space}+/u);
    if (words.length < 2 || words.length > 10) {
      return { valid: false, reason: "word_count" };
    }
    const tokensValid = words.every((word, index) =>
      (index === words.length - 1 ? FINAL_WORD : WORD).test(word),
    );
    if (!tokensValid) return { valid: false, reason: "token" };
    return { valid: true, value: words.join(" "), wordCount: words.length };
  }
  ```

- [ ] **Step 3: Add the Hermes-only generation service with at most one repair.** `ScheduledResultService.completeClaimedRun` accepts only a `CLAIMED` run, calls the Hermes schedule-generation adapter with a dedicated schedule prompt, validates once, and if invalid makes exactly one repair call containing the rule and invalid output. A generation error or second invalid result marks the run `FAILED` and returns failure. The service never calls normal chat, native push, or physical-device/call APIs.

  ```ts
  export interface HermesScheduleResultGenerator {
    generate(input: { system: string; prompt: string }): Promise<string>;
  }

  export interface ScheduledResultRepository {
    persistSuccess(input: {
      runId: string;
      userId: string;
      content: string;
    }): Promise<PersistedScheduledResult>;
    markFailed(runId: string, reason: string): Promise<void>;
  }

  const SYSTEM_PROMPT =
    "Write the spoken result for this schedule. Return exactly 2-10 Unicode words, one line, no markup.";

  export class ScheduledResultService {
    constructor(
      private readonly hermes: HermesScheduleResultGenerator,
      private readonly repository: ScheduledResultRepository,
      private readonly mobileEvents: MobileEvents,
    ) {}

    async completeClaimedRun(run: ClaimedScheduleRun): Promise<ScheduledResultOutcome> {
      if (run.status !== "CLAIMED") throw new Error("schedule run must be CLAIMED");

      let checked: ScheduleResultValidation;
      try {
        const first = await this.hermes.generate({
          system: SYSTEM_PROMPT,
          prompt: buildSchedulePrompt(run),
        });
        checked = validateScheduleResult(first);
        if (!checked.valid) {
          const repaired = await this.hermes.generate({
            system: SYSTEM_PROMPT,
            prompt: `Repair this output to the exact rule; output only the repair:\n${first}`,
          });
          checked = validateScheduleResult(repaired);
        }
      } catch (error) {
        await this.repository.markFailed(run.id, "schedule_generation_failed");
        return { ok: false, reason: "schedule_generation_failed" };
      }
      if (!checked.valid) {
        await this.repository.markFailed(run.id, "invalid_schedule_result");
        return { ok: false, reason: "invalid_schedule_result" };
      }

      let persisted: PersistedScheduledResult;
      try {
        persisted = await this.repository.persistSuccess({
          runId: run.id,
          userId: run.userId,
          content: checked.value,
        });
      } catch (error) {
        await this.repository.markFailed(run.id, "schedule_persistence_failed");
        return { ok: false, reason: "schedule_persistence_failed" };
      }

      await this.emitBestEffort(run.userId, persisted.message);
      return { ok: true, message: persisted.message };
    }

    private async emitBestEffort(userId: string, message: ChatMessageDto): Promise<void> {
      await Promise.allSettled([
        Promise.resolve().then(() =>
          this.mobileEvents.emit(userId, { event: "chat_message", message })),
        Promise.resolve().then(() =>
          this.mobileEvents.emit(userId, {
            event: "notification",
            notification: {
              id: message.id,
              title: "BMO Schedule",
              body: message.content,
            },
          })),
      ]);
    }
  }
  ```

  Keep failure marking outside the failed success transaction so a generation or persistence exception can transition the claimed run to `FAILED`. If failure marking itself errors, surface it to scheduler error reporting without dispatching a physical call.

- [ ] **Step 4: Persist one assistant message and `SUCCEEDED` atomically under the Task 7 user lock.** Implement `persistSuccess` in the schedule repositories as one PostgreSQL transaction. Acquire the same per-user advisory lock, verify the run is still `CLAIMED` and owned by the user, return the existing message on an idempotent retry, upsert the unique `(userId, BMO_SCHEDULE)` session, insert exactly one `ASSISTANT` `ChatMessage` keyed by unique `scheduleRunId`, and update the run to `SUCCEEDED` before commit. There must be no committed message with a non-succeeded run and no succeeded run without its message.

  ```ts
  async persistSuccess(input: {
    runId: string;
    userId: string;
    content: string;
  }): Promise<PersistedScheduledResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`bmo-schedule-chat:${input.userId}`}, 0)
        )
      `;

      const existing = await tx.chatMessage.findUnique({
        where: { scheduleRunId: input.runId },
      });
      if (existing) return { message: toChatMessageDto(existing), created: false };

      const run = await tx.scheduleRun.findFirstOrThrow({
        where: { id: input.runId, userId: input.userId, status: "CLAIMED" },
      });
      const session = await tx.chatSession.upsert({
        where: {
          userId_purpose: {
            userId: input.userId,
            purpose: ChatSessionPurpose.BMO_SCHEDULE,
          },
        },
        create: {
          userId: input.userId,
          purpose: ChatSessionPurpose.BMO_SCHEDULE,
        },
        update: {},
      });
      const message = await tx.chatMessage.create({
        data: {
          sessionId: session.id,
          scheduleRunId: run.id,
          role: ChatRole.ASSISTANT,
          content: input.content,
        },
      });
      await tx.scheduleRun.update({
        where: { id: run.id },
        data: { status: "SUCCEEDED" },
      });
      return { message: toChatMessageDto(message), created: true };
    });
  }
  ```

- [ ] **Step 5: Wire `p9/index.ts`, `runScheduler`, repositories, and existing mobile events without normal-chat/native-push coupling.** Build the Hermes adapter and `ScheduledResultService` in `p9/index.ts` using existing dependency wiring. For each claimed schedule run, `runScheduler` awaits this service. Only an `ok: true` result may be handed to the existing physical delivery/call path; failures are already `FAILED` and must not call it. Physical delivery remains a post-commit, independent side effect: its outcome does not rewrite the authoritative chat message or the already-persisted result transaction. Realtime `chat_message` and `notification` emissions are also post-commit best-effort; reconnect/history reads the persisted chat as authority. Do not add native push.

  ```ts
  const result = await scheduledResultService.completeClaimedRun(claimedRun);
  if (!result.ok) return;

  await existingPhysicalScheduleDelivery.deliver({
    run: claimedRun,
    text: result.message.content,
  });
  ```

  Use the existing `chat_message` and `notification` mobile event shapes. Set `notification.id` to the assistant message UUID exactly; never generate a second notification ID.

- [ ] **Step 6: Cover Unicode boundaries, one repair, transaction ordering, failure gates, and post-commit realtime with Vitest fakes using `vi`.** Validator cases must include accented Latin, combining marks normalized to NFC, non-Latin scripts, internal apostrophe/hyphen, exactly 2 and 10 words, rejection at 1 and 11, multiline, markup, emoji-only tokens, and punctuation outside the single allowed terminal mark. Service tests use fake Hermes/repository/events/physical delivery; all doubles use Vitest `vi`.

  ```ts
  import { describe, expect, it, vi } from "vitest";

  it("repairs once, persists once, then emits existing events", async () => {
    const hermes = { generate: vi.fn()
      .mockResolvedValueOnce("too many, punctuation")
      .mockResolvedValueOnce("Meeting starts now.") };
    const message = {
      id: "8bcf6f38-4d56-4f39-9ee8-6bcb15da53af",
      content: "Meeting starts now.",
    };
    const repository = {
      persistSuccess: vi.fn().mockResolvedValue({ message, created: true }),
      markFailed: vi.fn(),
    };
    const mobileEvents = { emit: vi.fn().mockResolvedValue(undefined) };
    const service = new ScheduledResultService(hermes, repository, mobileEvents);

    await expect(service.completeClaimedRun(claimedRun)).resolves.toMatchObject({ ok: true });
    expect(hermes.generate).toHaveBeenCalledTimes(2);
    expect(repository.persistSuccess).toHaveBeenCalledTimes(1);
    expect(repository.markFailed).not.toHaveBeenCalled();
    expect(repository.persistSuccess.mock.invocationCallOrder[0]).toBeLessThan(
      mobileEvents.emit.mock.invocationCallOrder[0],
    );
    expect(mobileEvents.emit).toHaveBeenCalledWith(claimedRun.userId, {
      event: "notification",
      notification: expect.objectContaining({ id: message.id }),
    });
  });

  it.each(["generation", "second-invalid", "persistence"])(
    "%s failure marks FAILED and never dispatches physical delivery",
    async (failure) => {
      const fixture = makeFailureFixture(failure);
      const outcome = await fixture.runSchedulerOnce();
      expect(outcome).toMatchObject({ ok: false });
      expect(fixture.repository.markFailed).toHaveBeenCalledTimes(1);
      expect(fixture.physicalDelivery.deliver).not.toHaveBeenCalled();
      expect(fixture.mobileEvents.emit).not.toHaveBeenCalled();
    },
  );
  ```

  Repository integration tests must prove concurrent retries yield one `BMO_SCHEDULE` session, one assistant message for `scheduleRunId`, and one atomic `SUCCEEDED` transition; injected message-create or run-update failures roll back both and are followed by `FAILED` marking.

- [ ] **Step 7: Turn focused tests GREEN, run all backend checks, and commit.** From `backend`, run:

  ```bat
  npx vitest run tests/services/schedule-result.validation.test.ts tests/services/scheduled-result.service.test.ts tests/repositories/schedule-chat.repository.test.ts
  npx prisma validate --schema prisma/schema.prisma
  npx prisma generate --schema prisma/schema.prisma
  npx tsc --noEmit
  npm test
  ```

  Confirm normal user chat still uses `USER_CHAT` unchanged, scheduled output never calls `ChatService` or native push, invalid/generation/persistence failures make no physical call, successful history exists before realtime events, and notification IDs equal assistant message UUIDs. Stage only Task 8 backend implementation/tests and do not stage this plan file:

  ```bat
  git add src/services/schedule-result.validation.ts src/services/scheduled-result.service.ts src/p9/index.ts src/scheduler/runScheduler.ts src/repositories/schedule-run.repository.ts src/repositories/schedule-chat.repository.ts src/mobile-events/index.ts tests/services/schedule-result.validation.test.ts tests/services/scheduled-result.service.test.ts tests/repositories/schedule-chat.repository.test.ts
  git commit -m "feat: persist scheduled assistant results"
  ```

## Task 9: Device Speech Port

- [ ] **Step 1: Lock the one-shot scope and make focused tests RED.** Create `backend/src/device-speech.port.ts` and `backend/prisma/migrations/20260825_proactive_speech_owner/migration.sql`; modify `backend/prisma/schema.prisma`, `backend/src/services/scheduled-result.service.ts`, `backend/src/p9/index.ts`, `backend/src/events.ts`, `backend/src/websocket.server.ts`, `backend/src/temp-audio.ts`, `backend/src/audio-service.ts`, Task 3's `backend/src/p9/db/repositories.ts`, `backend/src/repositories/proactive-delivery.repository.ts`, and `backend/src/scheduler/runScheduler.ts`; create/update the listed Task 9 Vitest files. Do not add a second arbiter repository, retry queue, or retrofit of the broader `ProactiveDelivery` system.

  ```bat
  npx vitest run tests/device-speech.port.test.ts tests/scheduled-result.device-speech.test.ts tests/events/proactive-speech-events.test.ts tests/p9/device-speech-arbiter.repository.test.ts
  ```

- [ ] **Step 2: Define the complete one-shot port and timers.** The port receives only an already-committed assistant message from Task 8. Offline and busy are terminal `MISSED` outcomes; offer/lease failures are one-shot `FAILED` outcomes; a successful audio-ready send is `SENT`. Both the offer and accepted speech lease last exactly 45 seconds. No outcome schedules a retry.

  ```ts
  export const PROACTIVE_OFFER_TTL_MS = 45_000;
  export const PROACTIVE_SPEECH_LEASE_TTL_MS = 45_000;
  export const PUBLIC_AUDIO_ORIGIN = "https://api.personalbmo.web.id";

  export type DeviceSpeechOutcome =
    | { status: "SENT"; deliveryId: string; attemptId: string; leaseId: string }
    | { status: "MISSED"; reason: "OFFLINE" | "BUSY" }
    | { status: "FAILED"; reason: string };

  export interface DeviceSpeechPort {
    deliverScheduleOnce(input: {
      userId: string;
      deviceId: string;
      scheduleRunId: string;
      assistantMessageId: string;
      text: string;
    }): Promise<DeviceSpeechOutcome>;
  }

  export interface DeviceSpeechReservationRepository {
    beginAuthenticatedIdleOffer(input: {
      userId: string;
      deviceId: string;
      scheduleRunId: string;
      assistantMessageId: string;
    }): Promise<
      | { status: "MISSED"; reason: "OFFLINE" | "BUSY" }
      | {
          status: "RESERVED";
          deliveryId: string;
          attemptId: string;
          offerReceipt: string;
          offerExpiresAt: Date;
          bindingHardwareId: string;
          speechOwner: DeviceSpeechReservation;
        }
    >;
    acceptOfferExact(input: {
      bindingHardwareId: string;
      deliveryId: string;
      attemptId: string;
      offerReceipt: string;
      acceptedAt: Date;
    }): Promise<
      | { speechOwner: DeviceSpeechReservation }
      | null
    >;
    prepareAudioReadyExact(input: {
      bindingHardwareId: string;
      attemptId: string;
      acceptedOwner: DeviceSpeechReservation;
      audioReceipt: string;
      remainingLeaseMs: number;
    }): Promise<DeviceSpeechReservation | null>;
    markSent(attemptId: string): Promise<void>;
    markFailed(attemptId: string, reason: string): Promise<void>;
  }
  ```

- [ ] **Step 3: Add exact Zod WebSocket events with the existing `event` discriminator.** Device identity never appears in payloads; `websocket.server.ts` derives it from the authenticated socket. `proactive_offer_accepted` must exactly match the authenticated device, delivery, attempt, opaque offer receipt, unexpired persistent offer, and `PENDING` attempt before `acceptOfferExact` creates a UUID lease with a fresh 45-second expiry.

  ```ts
  export const ProactiveOfferEvent = z.object({
    event: z.literal("proactive_offer"),
    delivery_id: z.string().uuid(),
    attempt_id: z.string().uuid(),
    offer_receipt: z.string().min(1).max(512),
    expires_at_ms: z.number().int().positive(),
  }).strict();

  export const ProactiveOfferAcceptedEvent = z.object({
    event: z.literal("proactive_offer_accepted"),
    delivery_id: z.string().uuid(),
    attempt_id: z.string().uuid(),
    offer_receipt: z.string().min(1).max(512),
  }).strict();

  export const ProactiveAudioReadyEvent = z.object({
    event: z.literal("proactive_audio_ready"),
    source: z.literal("SCHEDULE"),
    delivery_id: z.string().uuid(),
    attempt_id: z.string().uuid(),
    lease_id: z.string().uuid(),
    audio_url: z.string().url().max(255).refine(
      (value) => value.startsWith("https://api.personalbmo.web.id/audio/"),
    ),
    audio_receipt: z.string().min(1).max(512),
    expires_at_ms: z.number().int().positive(),
  }).strict();

  export const ProactiveCancelEvent = z.object({
    event: z.literal("proactive_cancel"),
    source: z.literal("SCHEDULE"),
    delivery_id: z.string().uuid(),
    attempt_id: z.string().uuid(),
    lease_id: z.string().uuid(),
  }).strict();
  ```

  The accepted handler calls `acceptOfferExact` with the authenticated device ID and resolves only the matching bounded in-flight waiter. Wrong-device, wrong-receipt, stale, late, duplicate, or unknown acceptance is ignored. The waiter expires with the persistent offer at 45 seconds and is not a retry mechanism.

- [ ] **Step 4: Reserve authenticated-and-idle speech through Task 3 before TTS.** Use the singleton `DeviceSpeechArbiterService`; do not open a second `prisma.$transaction`, call a second advisory-lock helper, or write `DeviceSpeechReservation` directly. Resolve the current authenticated application binding and backend `IDLE` presence first. Offline becomes terminal `MISSED/OFFLINE`; non-idle becomes `MISSED/BUSY`, with no attempt, offer, or TTS. For an eligible device, generate the delivery/attempt IDs, then use the Task 3 transaction runner to `acquire` `PROACTIVE_DELIVERY` with `ownerCorrelationId = deliveryId` and persist the delivery/attempt plus all six returned ownership fields in the same transaction.

  ```ts
  const deliveryId = randomUUID();
  const attemptId = randomUUID();
  const connection = await currentAuthenticatedApplicationConnection(
    input.deviceId,
  );
  if (!connection) {
    return proactiveDeliveryRepository.markMissed(input, "OFFLINE");
  }
  if (connection.backendState !== "idle") {
    return proactiveDeliveryRepository.markMissed(input, "BUSY");
  }

  const reserved = await deviceSpeechArbiter.runInTransaction(async (tx) => {
    const speechOwner = await deviceSpeechArbiter.acquire(
      connection.binding.hardwareId,
      {
        mode: "ACQUIRE_OR_RETURN_EXACT",
        ownerKind: "PROACTIVE_DELIVERY",
        ownerCorrelationId: deliveryId,
        leaseDurationMs: PROACTIVE_OFFER_TTL_MS,
      },
      tx,
    );
    if (speechOwner === null) {
      return proactiveDeliveryRepository.markMissedInTransaction(
        tx,
        input,
        "BUSY",
      );
    }
    return proactiveDeliveryRepository.createDeliveringAttemptInTransaction(
      tx,
      {
        ...input,
        deliveryId,
        attemptId,
        status: "DELIVERING",
        attemptStatus: "PENDING",
        bindingHardwareId: connection.binding.hardwareId,
        ownerKind: speechOwner.ownerKind,
        ownerCorrelationId: speechOwner.ownerCorrelationId,
        generation: speechOwner.generation,
        leaseId: speechOwner.leaseId!,
        receipt: speechOwner.receipt!,
        leaseExpiresAt: speechOwner.leaseExpiresAt!,
      },
    );
  });
  ```


  The Prisma model and `20260825_proactive_speech_owner` migration add nullable attempt correlation columns `bindingHardwareId`, `ownerKind`, `ownerCorrelationId`, `generation`, `leaseId`, `receipt`, and `leaseExpiresAt` with the same database types as Task 3. One check requires all seven ownership columns to be null for legacy attempts or all seven to be populated for Task 9 attempts; a second check requires a populated generation to be positive. Existing rows remain unchanged and cleanup treats an all-null legacy tuple as a no-op. Every new Task 9 attempt writes the complete tuple. Task 11 updates these exact columns rather than creating ownership aliases.
  `offer_receipt` maps from the persisted `receipt`; the offer deadline maps from `leaseExpiresAt`. `deviceId`, `ownerKind`, `ownerCorrelationId`, `generation`, `leaseId`, `receipt`, and `leaseExpiresAt` retain Task 3's exact names in repositories and later lifecycle tasks. No `requestId`, `reserveReceipt`, `state`, `expiresAt`, in-memory ownership map, or separate arbiter repository is introduced.

- [ ] **Step 5: Implement reserve → offer → exact accept → TTS/audio-ready as one shot.** Validate the already-persisted assistant text again with Task 8's Unicode 2–10-word validator. Call `beginAuthenticatedIdleOffer` before synthesis. Send the offer from the persisted `receipt`/`leaseExpiresAt`, await exact authenticated acceptance, and receive the Task 3 owner rotated by Task 11's accept transaction. Only then synthesize and persist temporary audio. Before ready send, generate `audioReceipt` and call `prepareAudioReadyExact`, which uses Task 3 `promote` to keep `PROACTIVE_DELIVERY`, `ownerCorrelationId`, `generation`, and accepted `leaseId` while replacing `receipt` with `audioReceipt` and shortening `leaseExpiresAt` to the shared remaining lease/audio deadline. Send the exact rotated fields and only then mark the attempt `SENT`.

  ```ts
  export class OneShotDeviceSpeechPort implements DeviceSpeechPort {
    async deliverScheduleOnce(input: DeviceSpeechInput): Promise<DeviceSpeechOutcome> {
      const validated = validateScheduleResult(input.text);
      if (!validated.valid) {
        return { status: "FAILED", reason: "INVALID_TEXT" };
      }

      const offer = await this.reservations.beginAuthenticatedIdleOffer(input);
      if (offer.status === "MISSED") return offer;

      let accepted: { speechOwner: DeviceSpeechReservation } | null = null;
      try {
        await this.socket.send(input.deviceId, {
          event: "proactive_offer",
          delivery_id: offer.deliveryId,
          attempt_id: offer.attemptId,
          offer_receipt: offer.offerReceipt,
          expires_at_ms: offer.offerExpiresAt.getTime(),
        });
        accepted = await this.acceptances.waitExact(
          input.deviceId,
          offer.deliveryId,
          offer.attemptId,
          offer.offerReceipt,
          offer.offerExpiresAt,
        );
        if (!accepted) throw new Error("OFFER_NOT_ACCEPTED");

        const acceptedOwner = accepted.speechOwner;
        const synthesized = await this.audioService.synthesize(validated.value);
        const audio = await this.tempAudio.persist(synthesized, {
          expiresAt: acceptedOwner.leaseExpiresAt!,
        });
        const audioUrl =
          `${PUBLIC_AUDIO_ORIGIN}/audio/${encodeURIComponent(audio.id)}`;
        const sharedExpiresAtMs = Math.min(
          audio.expiresAt.getTime(),
          acceptedOwner.leaseExpiresAt!.getTime(),
        );
        const remainingLeaseMs = sharedExpiresAtMs - this.clock.now();
        if (audioUrl.length >= 256 || remainingLeaseMs <= 0) {
          throw new Error("INVALID_AUDIO_URL_OR_EXPIRY");
        }

        const audioReceipt = randomBytes(32).toString("base64url");
        const readyOwner = await this.reservations.prepareAudioReadyExact({
          bindingHardwareId: offer.bindingHardwareId,
          attemptId: offer.attemptId,
          acceptedOwner,
          audioReceipt,
          remainingLeaseMs,
        });
        if (!readyOwner) throw new Error("STALE_ACCEPTED_LEASE");

        await this.socket.send(input.deviceId, {
          event: "proactive_audio_ready",
          source: "SCHEDULE",
          delivery_id: offer.deliveryId,
          attempt_id: offer.attemptId,
          lease_id: readyOwner.leaseId!,
          audio_url: audioUrl,
          audio_receipt: readyOwner.receipt!,
          expires_at_ms: readyOwner.leaseExpiresAt!.getTime(),
        });
        await this.reservations.markSent(offer.attemptId);
        return {
          status: "SENT",
          deliveryId: offer.deliveryId,
          attemptId: offer.attemptId,
          leaseId: readyOwner.leaseId!,
        };
      } catch (error) {
        if (accepted) {
          await Promise.allSettled([
            this.socket.send(input.deviceId, {
              event: "proactive_cancel",
              source: "SCHEDULE",
              delivery_id: offer.deliveryId,
              attempt_id: offer.attemptId,
              lease_id: accepted.speechOwner.leaseId!,
            }),
          ]);
        }
        await this.reservations.markFailed(
          offer.attemptId,
          errorCode(error),
        );
        return { status: "FAILED", reason: errorCode(error) };
      }
    }
  }
  ```

  Any failure after acceptance sends best-effort `proactive_cancel` and marks the attempt `FAILED`. Keep the persisted owner until exact cancel/cleanup or its unchanged deadline so a lost cancel self-expires; never release and reacquire between phases and never retry physical delivery.

- [ ] **Step 6: Persist and serve temporary audio only from the public origin.** `audio-service.ts` synthesizes only after acceptance and returns persisted audio metadata. `temp-audio.ts` uses opaque IDs, bounded positive TTL, content type for the existing audio format, and the existing `/audio/:id` authenticated/receipt-aware serving path. Reject any URL containing `127.0.0.1`, `localhost`, a non-HTTPS scheme, or 256 or more characters. Do not put audio bytes in WebSocket events.

- [ ] **Step 7: Invoke the port only after Task 8's mobile-history transaction commits.** Wire `OneShotDeviceSpeechPort` in `p9/index.ts`. In `ScheduledResultService`, call it only after `persistSuccess` returns the committed assistant message and after starting the existing best-effort mobile event emission. Device delivery outcome never rolls back or rewrites the authoritative mobile chat/run result. A mobile persistence failure never calls the port. Offline/busy/missed/failed delivery is final for this one-shot attempt and does not enqueue a retry.

  ```ts
  const persisted = await this.repository.persistSuccess({
    runId: run.id,
    userId: run.userId,
    content: checked.value,
  });
  await this.emitBestEffort(run.userId, persisted.message);
  const speech = await this.deviceSpeech.deliverScheduleOnce({
    userId: run.userId,
    deviceId: run.deviceId,
    scheduleRunId: run.id,
    assistantMessageId: persisted.message.id,
    text: persisted.message.content,
  });
  return { ok: true, message: persisted.message, speech };
  ```

  Remove the direct Task 8 physical-delivery call from `runScheduler`; the scheduler invokes only `ScheduledResultService`, and this narrow port owns the one-shot schedule speech path. Normal chat, `ChatService`, and native push remain untouched.

- [ ] **Step 8: Prove offline/busy short-circuiting, exact authentication, timer/URL rules, sent/failure transitions, and no retries with Vitest `vi`.** Offline and busy tests must assert `audioService.synthesize`, temp-audio persistence, socket sends, and acceptance waits are never called. Success tests assert persistent reserve precedes offer, exact authenticated acceptance precedes synthesize, audio-ready uses `source:"SCHEDULE"`, the lease/audio receipt/positive expiry, the URL prefix and `<256` length, and `markSent` occurs after send. Post-accept synthesize/persist/send failures must send cancel and mark `FAILED`; dropped cancel leaves the fake lease busy until fake time advances 45 seconds.

  ```ts
  import { describe, expect, it, vi } from "vitest";

  it.each(["OFFLINE", "BUSY"] as const)(
    "%s is immediately MISSED and never synthesizes",
    async (reason) => {
      const fixture = makePortFixture();
      fixture.reservations.beginAuthenticatedIdleOffer.mockResolvedValue({
        status: "MISSED",
        reason,
      });
      await expect(fixture.port.deliverScheduleOnce(validInput))
        .resolves.toEqual({ status: "MISSED", reason });
      expect(fixture.audioService.synthesize).not.toHaveBeenCalled();
      expect(fixture.tempAudio.persist).not.toHaveBeenCalled();
      expect(fixture.socket.send).not.toHaveBeenCalled();
      expect(fixture.acceptances.waitExact).not.toHaveBeenCalled();
    },
  );

  it("sends public audio only after exact accepted lease", async () => {
    const fixture = makeAcceptedPortFixture();
    const result = await fixture.port.deliverScheduleOnce(validInput);
    expect(result).toMatchObject({ status: "SENT" });
    expect(fixture.acceptances.waitExact.mock.invocationCallOrder[0]).toBeLessThan(
      fixture.audioService.synthesize.mock.invocationCallOrder[0],
    );
    const ready = fixture.socket.send.mock.calls[1][1];
    expect(ready).toMatchObject({
      event: "proactive_audio_ready",
      source: "SCHEDULE",
      lease_id: expect.any(String),
      audio_receipt: expect.any(String),
    });
    expect(ready.audio_url).toMatch(
      /^https:\/\/api\.personalbmo\.web\.id\/audio\//,
    );
    expect(ready.audio_url.length).toBeLessThan(256);
    expect(ready.expires_at_ms).toBeGreaterThan(0);
    expect(fixture.reservations.markSent).toHaveBeenCalledTimes(1);
  });
  ```

  Repository/event tests must cover atomic authenticated+idle reservation, `DELIVERING/PENDING`, `MISSED/OFFLINE`, `MISSED/BUSY`, fresh 45-second accepted lease, exact tuple rejection, lease auto-expiry, strict Zod fields, and absence of `127.0.0.1`/retry scheduling.

- [ ] **Step 9: Turn focused tests GREEN, run full backend checks, and commit.** From `backend`, run:

  ```bat
  npx vitest run tests/device-speech.port.test.ts tests/scheduled-result.device-speech.test.ts tests/events/proactive-speech-events.test.ts tests/p9/device-speech-arbiter.repository.test.ts
  npx prisma validate --schema prisma/schema.prisma
  npx prisma generate --schema prisma/schema.prisma
  npx tsc --noEmit
  npm test
  ```

  Confirm mobile history commits before any reserve/TTS call; offline and busy perform zero synthesis; acceptance is authenticated and exact; post-accept failure cancels best-effort and remains leased until expiry; public audio URLs always use `https://api.personalbmo.web.id/audio/` and remain below 256 characters; no retry queue, normal-chat coupling, native push, or broad `ProactiveDelivery` rewrite was introduced. Stage only Task 9 backend files/tests and do not stage this plan file:

  ```bat
  git add prisma/schema.prisma prisma/migrations/20260825_proactive_speech_owner/migration.sql src/device-speech.port.ts src/services/scheduled-result.service.ts src/p9/index.ts src/events.ts src/websocket.server.ts src/temp-audio.ts src/audio-service.ts src/p9/db/repositories.ts src/repositories/proactive-delivery.repository.ts src/scheduler/runScheduler.ts tests/device-speech.port.test.ts tests/scheduled-result.device-speech.test.ts tests/events/proactive-speech-events.test.ts tests/p9/device-speech-arbiter.repository.test.ts
  git commit -m "feat: add one-shot scheduled device speech"
  ```

## Task 10: ESP Proactive Playback

- [ ] **Step 1: Lock scope and replace the obsolete negative test with focused RED contracts.** Modify `main/playback.h`, `main/playback.cpp`, `main/api.cpp`, `main/state.cpp`, and `main/CMakeLists.txt` only if registration changes are required; update `tests/test_playback_contract.py` and create `tests/test_proactive_protocol_contract.py`. Delete the assertion that proactive parsing is absent and replace it with parser, arbitration, playback reuse, expiry, no-replay, and terminal-cleanup contracts.

  ```bat
  python -m unittest discover -s tests -p "test_playback_contract.py" -v
  python -m unittest discover -s tests -p "test_proactive_protocol_contract.py" -v
  ```

- [ ] **Step 2: Define bounded strict protocol and local reservation types in `main/playback.h`.** Keep UUIDs at 36 characters plus terminator, URLs below 256 including terminator space, and receipts bounded. The accepted/rejected replies echo the exact offer tuple. The first authenticated matching audio-ready atomically binds its backend lease ID and audio receipt to the current local reservation; after binding, every cancel/terminal comparison is byte-exact.

  ```cpp
  constexpr int64_t kProactiveLeaseUs = 45'000'000;
  constexpr size_t kUuidBufferSize = 37;
  constexpr size_t kReceiptBufferSize = 513;
  constexpr size_t kAudioUrlBufferSize = 256;
  constexpr char kPublicAudioPrefix[] =
      "https://api.personalbmo.web.id/audio/";

  struct ProactiveOffer {
      char delivery_id[kUuidBufferSize];
      char attempt_id[kUuidBufferSize];
      char offer_receipt[kReceiptBufferSize];
      int64_t expires_at_ms;
  };

  struct ProactiveAudioReady {
      char delivery_id[kUuidBufferSize];
      char attempt_id[kUuidBufferSize];
      char lease_id[kUuidBufferSize];
      char audio_receipt[kReceiptBufferSize];
      char audio_url[kAudioUrlBufferSize];
      int64_t expires_at_ms;
  };

  struct ProactiveCancel {
      char delivery_id[kUuidBufferSize];
      char attempt_id[kUuidBufferSize];
      char lease_id[kUuidBufferSize];
  };

  enum class ProactivePlaybackState : uint8_t {
      NONE,
      RESERVED,
      PLAYING,
  };

  enum class ProactiveRejectReason : uint8_t {
      BUSY,
      EXPIRED,
      INVALID,
  };

  enum class ProactiveFailureReason : uint8_t {
      DOWNLOAD_FAILED,
      DECODE_FAILED,
      PLAYBACK_FAILED,
      CANCELLED,
      LEASE_EXPIRED,
      WATCHDOG_STALLED,
  };

  struct ProactivePlaybackReservation {
      ProactivePlaybackState state{ProactivePlaybackState::NONE};
      ProactiveOffer offer{};
      char lease_id[kUuidBufferSize]{};
      char audio_receipt[kReceiptBufferSize]{};
      int64_t local_lease_deadline_us{0};
      bool ready_consumed{false};
  };

  bool playback_prepare_proactive(const ProactiveOffer& offer,
                                  int64_t now_us,
                                  ProactiveRejectReason* rejection);
  bool playback_start_proactive(const ProactiveAudioReady& ready,
                                int64_t now_us);
  void playback_cancel_proactive(const ProactiveCancel& cancel,
                                 int64_t now_us);
  void playback_expire_proactive(int64_t now_us);
  ```

- [ ] **Step 3: Parse `proactive_offer`, `proactive_cancel`, and `proactive_audio_ready` strictly in `main/api.cpp`.** Require an exact JSON object: no missing, duplicate, wrong-type, or unknown fields. All IDs must be UUIDs; receipts must be non-empty and bounded; expiry must be a positive integer. `proactive_audio_ready.source` and `proactive_cancel.source` must equal `SCHEDULE`; the ready URL must start exactly with `https://api.personalbmo.web.id/audio/`, be valid UTF-8, and have byte length 1–255. Reject `http`, `127.0.0.1`, `localhost`, query-based prefix tricks, and oversized URLs before touching playback state.

  ```cpp
  bool parse_proactive_audio_ready(cJSON* root, ProactiveAudioReady* out) {
      static constexpr const char* kFields[] = {
          "event", "source", "delivery_id", "attempt_id", "lease_id",
          "audio_url", "audio_receipt", "expires_at_ms",
      };
      if (!json_has_exact_fields(root, kFields)
          || !json_string_equals(root, "event", "proactive_audio_ready")
          || !json_string_equals(root, "source", "SCHEDULE")
          || !json_copy_uuid(root, "delivery_id", out->delivery_id)
          || !json_copy_uuid(root, "attempt_id", out->attempt_id)
          || !json_copy_uuid(root, "lease_id", out->lease_id)
          || !json_copy_bounded_string(root, "audio_receipt",
                                       out->audio_receipt,
                                       sizeof(out->audio_receipt))
          || !json_copy_bounded_string(root, "audio_url", out->audio_url,
                                       sizeof(out->audio_url))
          || !json_positive_int64(root, "expires_at_ms", &out->expires_at_ms)) {
          return false;
      }
      const size_t prefix = std::strlen(kPublicAudioPrefix);
      const size_t length = std::strlen(out->audio_url);
      return length < kAudioUrlBufferSize
          && std::strncmp(out->audio_url, kPublicAudioPrefix, prefix) == 0
          && out->audio_url[prefix] != '\0';
  }
  ```

  Implement equivalent exact-field parsers for offer and cancel. Invalid events are ignored or answered with strict `INVALID` rejection only when a valid exact offer tuple is available; they never reserve, start, cancel, or replay audio.

- [ ] **Step 4: Make `playback_prepare_proactive` an atomic local-idle reservation.** Under the existing state/arbitration lock, first expire any elapsed reservation, then require local `IDLE`, no active capture, and no active speaker/playback. On failure return `BUSY` without changing state. On success copy the exact offer, set `RESERVED`, clear `ready_consumed`, set the local monotonic deadline to `now_us + 45s`, and reserve the speaker state in the same critical section. After unlocking, send either `proactive_offer_accepted` or `proactive_offer_rejected`, echoing exact `delivery_id`, `attempt_id`, and `offer_receipt`; rejected reasons are exactly `BUSY`, `EXPIRED`, or `INVALID`.

  ```cpp
  bool playback_prepare_proactive(const ProactiveOffer& offer,
                                  int64_t now_us,
                                  ProactiveRejectReason* rejection) {
      StateLock lock;
      expire_proactive_locked(now_us);
      if (!state_is_idle_locked()
          || capture_is_active_locked()
          || speaker_is_active_locked()) {
          *rejection = ProactiveRejectReason::BUSY;
          return false;
      }
      g_proactive.state = ProactivePlaybackState::RESERVED;
      g_proactive.offer = offer;
      g_proactive.lease_id[0] = '\0';
      g_proactive.audio_receipt[0] = '\0';
      g_proactive.ready_consumed = false;
      g_proactive.local_lease_deadline_us = now_us + kProactiveLeaseUs;
      state_reserve_speaker_for_proactive_locked();
      return true;
  }
  ```

  Use the backend `expires_at_ms` only as a required positive protocol field; use the 45-second local monotonic deadline for safety even if wall-clock synchronization is unavailable.

- [ ] **Step 5: Bind one exact ready event and reuse the existing MP3 worker/watchdog.** Under the same lock, `playback_start_proactive` requires `RESERVED`, an unexpired local deadline, exact delivery/attempt IDs, `ready_consumed == false`, strict source/URL/receipt validation, and no conflicting capture/speaker owner. Atomically copy the first lease ID/audio receipt, set `ready_consumed`, and transition to `PLAYING`; every duplicate or later ready returns false, so the tuple cannot replay. Build the existing `PlaybackJob` with the public URL and proactive context, then run the existing `download_and_play_mp3(const PlaybackJob*)` and Task 2 `PlaybackJobControl`/watchdog. Do not add another download loop, decoder, audio writer, task-specific watchdog, or second `MP3Decode` path.

  ```cpp
  bool playback_start_proactive(const ProactiveAudioReady& ready,
                                int64_t now_us) {
      StateLock lock;
      if (g_proactive.state != ProactivePlaybackState::RESERVED
          || g_proactive.ready_consumed
          || now_us >= g_proactive.local_lease_deadline_us
          || std::strcmp(g_proactive.offer.delivery_id, ready.delivery_id) != 0
          || std::strcmp(g_proactive.offer.attempt_id, ready.attempt_id) != 0) {
          return false;
      }
      copy_uuid(g_proactive.lease_id, ready.lease_id);
      copy_receipt(g_proactive.audio_receipt, ready.audio_receipt);
      g_proactive.ready_consumed = true;
      g_proactive.state = ProactivePlaybackState::PLAYING;
      enqueue_existing_playback_job(ready.audio_url, &g_proactive);
      return true;
  }
  ```

  Move queueing outside the critical section if the existing enqueue can block, but retain an atomic `RESERVED → PLAYING` claim before unlock.

- [ ] **Step 6: Handle exact cancel, lease expiry, and worker-owned terminal events.** A cancel must have exact source, delivery, attempt, and lease. While merely reserved, a matching cancel/expiry releases the speaker reservation and returns to `IDLE`. While playing, it sets the existing Task 2 cancellation control and terminal reason; the worker unwinds HTTP/decoder/audio first, then the sole Task 2 terminal compare/exchange branch emits terminal, clears/releases, and transitions to `IDLE`. A lease deadline tick auto-releases `RESERVED` or cooperatively cancels `PLAYING`; lost backend cancel therefore self-heals after 45 seconds.

  Emit strict terminal events with exact stored identifiers:

  ```cpp
  struct ProactiveTerminalEvent {
      char delivery_id[kUuidBufferSize];
      char attempt_id[kUuidBufferSize];
      char lease_id[kUuidBufferSize];
      char audio_receipt[kReceiptBufferSize];
  };

  void emit_proactive_terminal(const ProactiveTerminalEvent& terminal,
                               BMOPlaybackResult result) {
      if (result == BMOPlaybackResult::COMPLETED) {
          api_send_proactive_done(terminal, "COMPLETED");
          return;
      }
      api_send_proactive_failed(terminal,
          proactive_failure_reason(result));
  }
  ```

  `proactive_done` has exact fields `event`, `source:SCHEDULE`, `delivery_id`, `attempt_id`, `lease_id`, `audio_receipt`, and reason `COMPLETED`. `proactive_failed` has those same fields and one exact reason from `DOWNLOAD_FAILED`, `DECODE_FAILED`, `PLAYBACK_FAILED`, `CANCELLED`, `LEASE_EXPIRED`, or `WATCHDOG_STALLED`. No parse rejection, duplicate ready, stale cancel, or replay emits a false terminal event. Every real done/failed path ends with reservation clear, speaker release, and `IDLE` in the worker-owned order.

- [ ] **Step 7: Replace absence assertions with source behavior contracts.** Update `tests/test_playback_contract.py` to require proactive jobs to call the existing `download_and_play_mp3`, use `PlaybackJobControl`, retain cancellation checks around HTTP/`MP3Decode`/bounded audio, and keep terminal reporting → clear → release → `IDLE`. Explicitly assert there is no proactive decoder function and no extra `MP3Decode` call outside the shared API worker.

  Create `tests/test_proactive_protocol_contract.py` with the correct ESP root and checks for strict parser fields, bounded buffers, atomic idle/capture/speaker reservation, exact accepted/rejected tuple, 45-second monotonic expiry, exact source/public URL/positive expiry, one-time `RESERVED → PLAYING`, exact cancel, strict terminal fields/reasons, and all terminal cleanup.

  ```python
  import pathlib
  import unittest

  ROOT = pathlib.Path(__file__).resolve().parents[1]
  MAIN = ROOT / "main"

  class ProactiveProtocolContractTest(unittest.TestCase):
      def setUp(self):
          self.header = (MAIN / "playback.h").read_text(encoding="utf-8")
          self.playback = (MAIN / "playback.cpp").read_text(encoding="utf-8")
          self.api = (MAIN / "api.cpp").read_text(encoding="utf-8")
          self.state = (MAIN / "state.cpp").read_text(encoding="utf-8")

      def test_strict_ready_contract_and_public_url(self):
          parser = function_body(self.api, "parse_proactive_audio_ready")
          for field in ("event", "source", "delivery_id", "attempt_id",
                        "lease_id", "audio_url", "audio_receipt", "expires_at_ms"):
              self.assertIn(f'"{field}"', parser)
          self.assertIn('"SCHEDULE"', parser)
          self.assertIn("https://api.personalbmo.web.id/audio/", self.header)
          self.assertIn("kAudioUrlBufferSize = 256", self.header)
          self.assertNotIn("127.0.0.1", self.api + self.playback)

      def test_prepare_is_atomic_idle_capture_speaker_gate(self):
          prepare = function_body(self.playback, "playback_prepare_proactive")
          self.assertIn("StateLock", prepare)
          self.assertIn("state_is_idle_locked", prepare)
          self.assertIn("capture_is_active_locked", prepare)
          self.assertIn("speaker_is_active_locked", prepare)
          self.assertIn("kProactiveLeaseUs", prepare)

      def test_ready_is_one_shot_and_reuses_shared_worker(self):
          start = function_body(self.playback, "playback_start_proactive")
          self.assertIn("ready_consumed", start)
          self.assertLess(start.index("RESERVED"), start.index("PLAYING"))
          self.assertIn("enqueue_existing_playback_job", start)
          self.assertNotIn("MP3Decode", self.playback)
          self.assertIn("download_and_play_mp3", self.api)

      def test_terminal_is_exact_and_always_releases_idle(self):
          for field in ("delivery_id", "attempt_id", "lease_id", "audio_receipt"):
              self.assertIn(field, self.header + self.api)
          for reason in ("COMPLETED", "DOWNLOAD_FAILED", "DECODE_FAILED",
                         "PLAYBACK_FAILED", "CANCELLED", "LEASE_EXPIRED",
                         "WATCHDOG_STALLED"):
              self.assertIn(reason, self.api + self.playback)
          worker = function_body(self.api, "playback_worker_finish")
          self.assertLess(worker.index("terminal"), worker.index("clear"))
          self.assertLess(worker.index("clear"), worker.index("release"))
          self.assertLess(worker.index("release"), worker.index("IDLE"))
  ```

- [ ] **Step 8: Turn focused tests GREEN, run full firmware discovery and the exact external build, then commit.** Run:

  ```bat
  python -m unittest discover -s tests -p "test_playback_contract.py" -v
  python -m unittest discover -s tests -p "test_proactive_protocol_contract.py" -v
  python -m unittest discover -s tests -p "test_*.py" -v
  cmd.exe /d /c "cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule\esp && call C:\esp\v6.0.1\esp-idf\export.bat && idf.py -B C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build build"
  ```

  Confirm busy/capture/speaker offers reject before reservation, accepted replies echo the exact offer tuple, stale/invalid/duplicate ready never starts a second worker, cancel and lease expiry cooperatively unwind, shared MP3/watchdog code is the only playback path, terminal schemas use only strict reasons, and every terminal releases to `IDLE`. Stage only Task 10 firmware/tests and do not stage this plan file:

  ```bat
  git add main/playback.h main/playback.cpp main/api.cpp main/state.cpp main/CMakeLists.txt tests/test_playback_contract.py tests/test_proactive_protocol_contract.py
  git commit -m "feat: add proactive schedule playback"
  ```

## Task 11: ACK Lifecycle

- [ ] **Step 1: Lock scope and make ACK/lifecycle integration tests RED.** Modify `backend/src/events.ts`, `backend/src/websocket.server.ts`, `backend/src/device-registry.ts`, `backend/src/device-speech.port.ts`, Task 3's `backend/src/p9/db/repositories.ts`, `backend/src/repositories/proactive-delivery.repository.ts`, `backend/src/temp-audio.ts`, and `backend/src/mobile-events/index.ts`; create/update the listed Task 11 Vitest files. Do not add a second arbiter repository or delivery retries.

  ```bat
  npx vitest run tests/events/proactive-speech-events.test.ts tests/proactive-ack-lifecycle.test.ts tests/repositories/proactive-delivery.repository.test.ts tests/proactive-lease-sweeper.test.ts
  ```

- [ ] **Step 2: Define strict accepted/done/failed events and current-socket authentication.** Keep the existing `event` discriminator and snake_case fields. Payloads contain no device identity. `websocket.server.ts` asks `device-registry.ts` for the P9 `Device.id` only when the sender is the currently registered authenticated socket for that application/device binding; an old replaced socket, unauthenticated socket, foreign binding, or stale disconnect has no ACK authority.

  ```ts
  export const ProactiveOfferAcceptedEvent = z.object({
    event: z.literal("proactive_offer_accepted"),
    delivery_id: z.string().uuid(),
    attempt_id: z.string().uuid(),
    offer_receipt: z.string().min(1).max(512),
  }).strict();

  export const ProactiveDoneEvent = z.object({
    event: z.literal("proactive_done"),
    source: z.literal("SCHEDULE"),
    delivery_id: z.string().uuid(),
    attempt_id: z.string().uuid(),
    lease_id: z.string().uuid(),
    audio_receipt: z.string().min(1).max(512),
    reason: z.literal("COMPLETED"),
  }).strict();

  export const ProactiveFailedReason = z.enum([
    "DOWNLOAD_FAILED",
    "DECODE_FAILED",
    "PLAYBACK_FAILED",
    "CANCELLED",
    "LEASE_EXPIRED",
    "WATCHDOG_STALLED",
  ]);

  export const ProactiveFailedEvent = z.object({
    event: z.literal("proactive_failed"),
    source: z.literal("SCHEDULE"),
    delivery_id: z.string().uuid(),
    attempt_id: z.string().uuid(),
    lease_id: z.string().uuid(),
    audio_receipt: z.string().min(1).max(512),
    reason: ProactiveFailedReason,
  }).strict();
  ```

  ```ts
  const authenticated = deviceRegistry.currentAuthenticatedSocket(socket);
  if (!authenticated) return;
  const deviceId = authenticated.device.id;

  if (accepted.success) {
    await deviceSpeechPort.acceptOffer(deviceId, socket.id, accepted.data);
  } else if (done.success) {
    await deviceSpeechPort.finishPlayed(deviceId, socket.id, done.data);
  } else if (failed.success) {
    await deviceSpeechPort.finishFailed(deviceId, socket.id, failed.data);
  }
  ```

- [ ] **Step 3: Enforce the legal persistent lifecycle under the per-device advisory lock.** Delivery states are exactly `PENDING → DELIVERING → DELIVERED | FAILED | EXPIRED`; an offline/busy decision is `PENDING → MISSED`. Attempt states are exactly `PENDING → SENT → PLAYED | FAILED | EXPIRED`. Accept is legal only for the current authenticated device, `DELIVERING` delivery, `PENDING` attempt, exact delivery/attempt/offer receipt, and unexpired offer. Done/failed are legal only for that device, `DELIVERING` delivery, `SENT` attempt, exact delivery/attempt/lease/audio receipt, and unexpired lease.

  A duplicate exact accept returns the original lease ID and original expiry without extension. A duplicate exact done or failed returns the existing terminal result without another transition/event. Late, foreign, wrong-receipt, wrong-lease, stale, or conflicting terminal ACKs return `IGNORED`; they cannot mutate rows, resolve an acceptance waiter, delete another attempt's audio, or release a newer reservation.

- [ ] **Step 4: Implement conditional accept and terminal updates through the Task 3 runner.** Accept uses `deviceSpeechArbiter.runInTransaction`, locks the exact attempt, and verifies the authenticated binding, delivery/attempt state, original offer receipt, and offer expiry. An exact duplicate returns the stored accepted owner tuple unchanged. First acceptance uses `MATCH_ACTIVE_LEASE` against the attempt's persisted Task 3 fields, then `promote` keeps `ownerKind:"PROACTIVE_DELIVERY"` and atomically rotates `leaseId`, `receipt`, and `leaseExpiresAt` to a fresh accepted lease while preserving `ownerCorrelationId` and `generation`. Update the attempt with those same names in the same transaction. Terminal SQL moves attempt and delivery together or neither.

  ```ts
  async function acceptOfferExact(
    binding: ApplicationDeviceBinding,
    input: ExactAcceptedAck,
  ): Promise<AckResult<AcceptedLease>> {
    return deviceSpeechArbiter.runInTransaction(async (tx) => {
      const current = await lockExactAttempt(tx, input);
      if (
        !current
        || current.deliveryStatus !== "DELIVERING"
        || current.attemptStatus !== "PENDING"
        || current.offerReceipt !== input.offerReceipt
        || current.offerExpiresAt <= input.now
      ) {
        return { kind: "IGNORED" };
      }
      if (current.acceptedAt) {
        return {
          kind: "DUPLICATE",
          value: speechOwnerFromAttempt(current),
        };
      }

      const offered = await deviceSpeechArbiter.acquire(
        binding.hardwareId,
        {
          mode: "MATCH_ACTIVE_LEASE",
          ownerKind: current.ownerKind,
          ownerCorrelationId: current.ownerCorrelationId,
          leaseId: current.leaseId,
          receipt: current.receipt,
        },
        tx,
      );
      if (offered === null) return { kind: "IGNORED" };

      const nextLeaseId = randomUUID();
      const nextReceipt = randomBytes(32).toString("base64url");
      const promoted = await deviceSpeechArbiter.promote(
        binding.hardwareId,
        {
          fromOwnerKind: "PROACTIVE_DELIVERY",
          toOwnerKind: "PROACTIVE_DELIVERY",
          ownerCorrelationId: offered.ownerCorrelationId,
          generation: offered.generation,
          leaseId: offered.leaseId!,
          receipt: offered.receipt!,
          nextLeaseId,
          nextReceipt,
          nextLeaseDurationMs: 45_000,
        },
        tx,
      );
      if (!promoted) return { kind: "IGNORED" };

      const accepted = await updateAttemptAcceptedExact(tx, {
        attemptId: input.attemptId,
        ownerKind: offered.ownerKind,
        ownerCorrelationId: offered.ownerCorrelationId,
        generation: offered.generation,
        leaseId: nextLeaseId,
        receipt: nextReceipt,
        leaseExpiresAt: new Date(input.now.getTime() + 45_000),
        acceptedAt: input.now,
      });
      return accepted
        ? { kind: "APPLIED", value: speechOwnerFromAttempt(accepted) }
        : { kind: "IGNORED" };
    });
  }
  ```

  Before `proactive_audio_ready`, rotate the same accepted owner once more through `promote`, keeping its lease ID and generation but replacing its internal receipt with the emitted `audio_receipt` and setting `leaseExpiresAt` to the remaining shared lease/audio deadline. The attempt update and rotation share one runner transaction. This makes terminal ACK fields match the exact Task 3 release tuple without a release/reacquire gap.

  ```sql
  WITH exact_attempt AS (
    SELECT a."id", a."deliveryId"
    FROM "ProactiveDeliveryAttempt" a
    JOIN "ProactiveDelivery" d ON d."id" = a."deliveryId"
    WHERE a."id" = $1
      AND a."deliveryId" = $2
      AND d."deviceId" = $3
      AND a."leaseId" = $4
      AND a."audioReceipt" = $5
      AND a."status" = 'SENT'
      AND d."status" = 'DELIVERING'
      AND a."leaseExpiresAt" > $6
    FOR UPDATE OF a, d
  ), updated_attempt AS (
    UPDATE "ProactiveDeliveryAttempt" a
    SET "status" = $7, "terminalReason" = $8, "terminalAt" = $6
    FROM exact_attempt x
    WHERE a."id" = x."id"
    RETURNING a."deliveryId"
  )
  UPDATE "ProactiveDelivery" d
  SET "status" = $9, "terminalAt" = $6
  FROM updated_attempt a
  WHERE d."id" = a."deliveryId"
  RETURNING d."id";
  ```

  Bind done as attempt `PLAYED`, delivery `DELIVERED`, reason `COMPLETED`; bind failed as attempt/delivery `FAILED` with the strict device reason. After a successful terminal, a failed ACK after delivered or a done ACK after failed/expired matches no legal source state and is ignored. For duplicate idempotency, read the exact already-terminal tuple and same terminal kind/reason after the conditional update returns zero; conflicting terminals remain ignored.

- [ ] **Step 5: Resolve the one-shot port and acceptance waiter only from applied/current ACKs.** `device-speech.port.ts` passes `deviceId` from the current socket into repository methods. An `APPLIED` or exact `DUPLICATE` accepted ACK resolves only the matching delivery/attempt/offer waiter with the stored lease tuple; `IGNORED` does nothing. Done/failed handling never restarts delivery, never invokes TTS, and never creates a retry. The port marks attempt `SENT` only after `proactive_audio_ready` is successfully sent and persists the exact `audioReceipt` before accepting terminal ACKs.

- [ ] **Step 6: Clean temporary MP3 and call Task 3 `release` with the exact persisted owner on every terminal.** The terminal transaction returns `bindingHardwareId` plus `ownerKind`, `ownerCorrelationId`, `generation`, `leaseId`, `receipt`, and `leaseExpiresAt` from the attempt. After commit, delete temp audio by the protocol tuple and call the singleton arbiter's `release` with the five exact release fields. Apply the same idempotent cleanup to `PLAYED`, `FAILED`, `EXPIRED`, and disconnect expiry; `MISSED` has no MP3/owner and is a no-op. A stale ACK cannot clean newer state because the terminal transition and release both compare the full persistent owner tuple.

  ```ts
  async function releasePersistedSpeechOwner(
    terminal: AppliedProactiveTerminal,
  ): Promise<boolean> {
    return deviceSpeechArbiter.release(
      terminal.bindingHardwareId,
      {
        ownerKind: terminal.ownerKind,
        ownerCorrelationId: terminal.ownerCorrelationId,
        generation: terminal.generation,
        leaseId: terminal.leaseId,
        receipt: terminal.receipt,
      },
    );
  }

  if (result.kind === "APPLIED") {
    await Promise.allSettled([
      tempAudio.deleteExact({
        deliveryId: ack.delivery_id,
        attemptId: ack.attempt_id,
        leaseId: ack.lease_id,
        audioReceipt: ack.audio_receipt,
      }),
      releasePersistedSpeechOwner(result.value),
    ]);
    await mobileEvents.emitBestEffort(
      result.value.userId,
      proactiveStatusEvent(result.value),
    );
  }
  ```

  Persist cleanup-needed state and the exact ownership fields with the terminal row before commit. If file deletion or Task 3 release fails, the sweeper repeats cleanup only; it never retries speech delivery.

- [ ] **Step 7: Add current-disconnect handling and a lease/offer sweeper.** When the current authenticated socket disconnects, pass its socket generation plus P9 device ID to the repository. Under the device lock, expire only active attempts owned by that exact connection generation; a disconnect from an old replaced socket is ignored. Run a bounded sweeper every five seconds: conditionally transition expired `PENDING` offers or `SENT` leases to attempt/delivery `EXPIRED`, return the persisted Task 3 ownership fields, delete exact temp audio, call `releasePersistedSpeechOwner`, and emit one mobile status. This is cleanup, not a delivery retry.

  ```ts
  const PROACTIVE_SWEEP_INTERVAL_MS = 5_000;

  async function sweepExpiredProactiveSpeech(now: Date): Promise<void> {
    const expired = await deliveryRepository.expireDueExact(now);
    for (const terminal of expired) {
      await Promise.allSettled([
        tempAudio.deleteExact(terminal.protocolTuple),
        releasePersistedSpeechOwner(terminal),
      ]);
      await mobileEvents.emitBestEffort(
        terminal.userId,
        proactiveStatusEvent(terminal),
      );
    }
  }
  ```

- [ ] **Step 8: Emit existing mobile proactive status only after committed transitions.** Add/use the existing mobile event path with `event:"proactive_status"`, delivery/attempt IDs, and one of `DELIVERING`, `DELIVERED`, `FAILED`, `MISSED`, or `EXPIRED`; include strict reason when present. Database history is authoritative and realtime is best-effort. Exact duplicate ACKs and ignored ACKs do not emit another status; no native push or retry is introduced.

  ```ts
  export const ProactiveStatusEvent = z.object({
    event: z.literal("proactive_status"),
    delivery_id: z.string().uuid(),
    attempt_id: z.string().uuid().nullable(),
    status: z.enum(["DELIVERING", "DELIVERED", "FAILED", "MISSED", "EXPIRED"]),
    reason: z.string().min(1).optional(),
  }).strict();
  ```

- [ ] **Step 9: Cover authentication, exact tuples, conditional states, idempotency, cleanup, disconnect, sweeper, and mobile status with Vitest integration tests.** Use the real PostgreSQL fixture for repository transitions and `vi` for socket/temp-audio/arbiter/mobile edges. Required cases: current socket accepted; old/foreign/unauthenticated socket ignored; delivery's `deviceId` equals the bound P9 device; duplicate accept returns the same lease/expiry; wrong receipt and late accept ignored; exact done produces `SENT→PLAYED` plus `DELIVERING→DELIVERED`; exact failed produces both `FAILED`; duplicate exact terminal emits no second status; failed-after-delivered and done-after-failed/expired ignored; stale ACK cannot release/delete a newer tuple; every applied terminal deletes exact MP3 and releases exact reservation; old-socket disconnect is harmless; current disconnect expires only its tuple; 45-second lease/offer expiry is swept; no test observes a retry.

  ```ts
  import { expect, it, vi } from "vitest";

  it("is idempotent for exact done and ignores failed after delivered", async () => {
    const fixture = await sentAttemptFixture();
    const first = await fixture.acks.finishPlayed(
      fixture.currentDeviceId, fixture.currentSocketId, fixture.done,
    );
    const duplicate = await fixture.acks.finishPlayed(
      fixture.currentDeviceId, fixture.currentSocketId, fixture.done,
    );
    const conflicting = await fixture.acks.finishFailed(
      fixture.currentDeviceId, fixture.currentSocketId,
      { ...fixture.failed, reason: "PLAYBACK_FAILED" },
    );
    expect(first.kind).toBe("APPLIED");
    expect(duplicate.kind).toBe("DUPLICATE");
    expect(conflicting.kind).toBe("IGNORED");
    expect(await fixture.attemptStatus()).toBe("PLAYED");
    expect(await fixture.deliveryStatus()).toBe("DELIVERED");
    expect(fixture.tempAudio.deleteExact).toHaveBeenCalledTimes(1);
    expect(fixture.deviceSpeechArbiter.release).toHaveBeenCalledTimes(1);
    expect(fixture.mobileEvents.emitBestEffort).toHaveBeenCalledTimes(1);
  });

  it("foreign ACK cannot release the current reservation", async () => {
    const fixture = await sentAttemptFixture();
    await fixture.acks.finishPlayed(
      fixture.foreignDeviceId, fixture.foreignSocketId, fixture.done,
    );
    expect(await fixture.attemptStatus()).toBe("SENT");
    expect(fixture.tempAudio.deleteExact).not.toHaveBeenCalled();
    expect(fixture.deviceSpeechArbiter.release).not.toHaveBeenCalled();
  });
  ```

- [ ] **Step 10: Turn focused tests GREEN, run full backend checks, and commit.** From `backend`, run:

  ```bat
  npx vitest run tests/events/proactive-speech-events.test.ts tests/proactive-ack-lifecycle.test.ts tests/repositories/proactive-delivery.repository.test.ts tests/proactive-lease-sweeper.test.ts
  npx prisma validate --schema prisma/schema.prisma
  npx prisma generate --schema prisma/schema.prisma
  npx tsc --noEmit
  npm test
  ```

  Confirm only the current authenticated socket can ACK for its bound P9 device, all transitions are conditional on exact tuples/legal states, duplicates are idempotent, conflicting/late/stale ACKs cannot release newer work, all terminal states clean exact MP3/reservation state, disconnect/expiry perform cleanup without redelivery, and realtime status follows commit. Stage only Task 11 backend implementation/tests and do not stage this plan file:

  ```bat
  git add src/events.ts src/websocket.server.ts src/device-registry.ts src/device-speech.port.ts src/p9/db/repositories.ts src/repositories/proactive-delivery.repository.ts src/temp-audio.ts src/mobile-events/index.ts tests/events/proactive-speech-events.test.ts tests/proactive-ack-lifecycle.test.ts tests/repositories/proactive-delivery.repository.test.ts tests/proactive-lease-sweeper.test.ts
  git commit -m "feat: finalize proactive ACK lifecycle"
  ```

## Task 12: Cross-System E2E

- [ ] **Step 1: Add the cross-system test/evidence files and make focused suites RED.** Create `backend/tests/e2e/fake-esp.ts`, `backend/tests/e2e/fake-mobile.ts`, the four listed backend E2E tests, and firmware `tests/test_cross_system_protocol_contract.py`. Evidence outputs are `docs/evidence/cross-system-e2e.json`, `docs/evidence/cross-system-e2e.md`, and the separate hardware-only `docs/evidence/answer-slo-hardware.json`.

  ```bat
  cd /d D:\codex\BMO\backend\.worktrees\esp-vps-dialog-schedule\backend
  npx vitest run tests/e2e/voice-reservation.e2e.test.ts tests/e2e/speech-arbitration.e2e.test.ts tests/e2e/proactive-schedule.e2e.test.ts tests/e2e/mobile-socket.e2e.test.ts
  cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule\esp
  python -m unittest discover -s tests -p "test_cross_system_protocol_contract.py" -v
  ```

  RED must identify missing scenario wiring/assertions, not imports, ports, database setup, or fixture authentication.

- [ ] **Step 2: Build a strict fake ESP peer that uses the real WebSocket, production Zod schemas, P9 binding, and PostgreSQL paths.** The fake owns only device-side protocol state; it must not call repositories, arbiter methods, or service handlers directly. Authenticate through the real device socket handshake, bind to a real seeded P9 `Device.id`, parse every inbound message with production event schemas, and send outbound events through JSON serialization over the socket. Keep a deterministic state machine and exact current tuples so stale/replay assertions are meaningful.

  ```ts
  import { randomUUID } from "node:crypto";
  import {
    ProactiveAudioReadyEvent,
    ProactiveCancelEvent,
    ProactiveOfferEvent,
    VoiceReserveAcceptedEvent,
    VoiceReserveRejectedEvent,
  } from "../../src/events";

  type FakeEspState =
    | { kind: "IDLE" }
    | { kind: "VOICE_RESERVED"; requestId: string; leaseId: string; receipt: string }
    | {
        kind: "PROACTIVE_OFFERED";
        deliveryId: string;
        attemptId: string;
        offerReceipt: string;
      }
    | {
        kind: "PROACTIVE_PLAYING";
        deliveryId: string;
        attemptId: string;
        leaseId: string;
        audioReceipt: string;
      };

  export class FakeEsp {
    state: FakeEspState = { kind: "IDLE" };
    readonly received: unknown[] = [];

    constructor(private readonly socket: RealAuthenticatedTestSocket) {}

    async reserveVoice(requestId = randomUUID()) {
      await this.socket.send({ event: "voice_reserve", request_id: requestId });
      const raw = await this.socket.nextMessage();
      const accepted = VoiceReserveAcceptedEvent.safeParse(raw);
      if (accepted.success) {
        this.state = {
          kind: "VOICE_RESERVED",
          requestId: accepted.data.request_id,
          leaseId: accepted.data.lease_id,
          receipt: accepted.data.reserve_receipt,
        };
        return accepted.data;
      }
      return VoiceReserveRejectedEvent.parse(raw);
    }

    async acceptNextOffer() {
      const offer = ProactiveOfferEvent.parse(await this.socket.nextMessage());
      if (this.state.kind !== "IDLE") throw new Error("offer while fake ESP busy");
      this.state = {
        kind: "PROACTIVE_OFFERED",
        deliveryId: offer.delivery_id,
        attemptId: offer.attempt_id,
        offerReceipt: offer.offer_receipt,
      };
      await this.socket.send({
        event: "proactive_offer_accepted",
        delivery_id: offer.delivery_id,
        attempt_id: offer.attempt_id,
        offer_receipt: offer.offer_receipt,
      });
      return offer;
    }

    async receiveAudioAndDone() {
      const ready = ProactiveAudioReadyEvent.parse(await this.socket.nextMessage());
      if (this.state.kind !== "PROACTIVE_OFFERED"
          || ready.delivery_id !== this.state.deliveryId
          || ready.attempt_id !== this.state.attemptId) throw new Error("stale ready");
      this.state = {
        kind: "PROACTIVE_PLAYING",
        deliveryId: ready.delivery_id,
        attemptId: ready.attempt_id,
        leaseId: ready.lease_id,
        audioReceipt: ready.audio_receipt,
      };
      await this.socket.send({
        event: "proactive_done",
        source: "SCHEDULE",
        delivery_id: ready.delivery_id,
        attempt_id: ready.attempt_id,
        lease_id: ready.lease_id,
        audio_receipt: ready.audio_receipt,
        reason: "COMPLETED",
      });
      this.state = { kind: "IDLE" };
      return ready;
    }

    async expectExactCancel() {
      const cancel = ProactiveCancelEvent.parse(await this.socket.nextMessage());
      expect(cancel.delivery_id).toBe(currentDelivery(this.state));
      expect(cancel.attempt_id).toBe(currentAttempt(this.state));
      this.state = { kind: "IDLE" };
      return cancel;
    }
  }
  ```

- [ ] **Step 3: Exercise the complete voice reservation lifecycle through real WS/HTTP boundaries.** Cover accepted reserve, exact duplicate returning the identical lease/receipt/original expiry without extension, exact cancel, five-second client timeout behavior when a response is deliberately ignored, stale/late response isolation, and HTTP upload with `X-Request-Id`, `X-Voice-Lease-Id`, and `X-Voice-Reserve-Receipt`. Assert the persistent row atomically changes `VOICE_CAPTURE_RESERVED → VOICE_PROCESSING` before `RequestStore` creation and is never observable as free. The timeout case is a functional fake-peer scenario plus firmware source contract; do not report it as hardware timing evidence.

- [ ] **Step 4: Race voice reserve against scheduled speech under the real advisory lock.** Seed one authenticated/online/idle P9 device, synchronize two real requests at a barrier, then concurrently send `voice_reserve` and trigger the claimed schedule result path. Both must reach the same PostgreSQL per-device advisory lock. Assert XOR: exactly one becomes reserved/delivering and the other returns/reaches `BUSY`; there is never a committed overlap, both requests retain their own exact tuples, and releasing the winner does not release the loser or a later reservation.

  ```ts
  it("allows exactly one voice or schedule owner", async () => {
    const barrier = createBarrier(2);
    const voice = barrier.run(() => esp.reserveVoice());
    const schedule = barrier.run(() => triggerClaimedScheduleThroughScheduler(run.id));
    const [voiceResult, scheduleResult] = await Promise.all([voice, schedule]);

    const voiceWon = voiceResult.event === "voice_reserve_accepted";
    const scheduleWon = scheduleResult.speech.status !== "MISSED";
    expect(Number(voiceWon) + Number(scheduleWon)).toBe(1);
    expect(await activeSpeechOwners(device.id)).toHaveLength(1);
    expect(voiceWon ? scheduleResult.speech : voiceResult).toMatchObject(
      voiceWon
        ? { status: "MISSED", reason: "BUSY" }
        : { event: "voice_reserve_rejected", reason: "busy" },
    );
  });
  ```

  The test may query rows after actions for assertions, but no fake may reserve/release by calling repositories directly.

- [ ] **Step 5: Exercise schedule generation, mobile history/realtime, and one-shot device delivery.** Use a deterministic fake only at the Hermes and TTS external boundaries; keep `ScheduledResultService`, Unicode validator, repositories, transactions, schemas, arbiter, sockets, and mobile events real. Hermes returns invalid once and valid once; assert exactly two calls, one `BMO_SCHEDULE` session, one assistant message keyed by `scheduleRunId`, `ScheduleRun.SUCCEEDED`, one `chat_message`, and one `notification` whose ID equals the assistant message UUID. Then cover:

  - online/idle: offer → exact accepted lease → persisted public audio → ready → exact done → `PLAYED/DELIVERED`, exact MP3 cleanup, arbiter release, and mobile `proactive_status`;
  - offline and busy: immediate `MISSED/OFFLINE` or `MISSED/BUSY`, with TTS and temp-audio persistence never called;
  - accepted then TTS failure: exact best-effort cancel, attempt/delivery `FAILED`, no ready, no retry;
  - lease/offer expiry: fake clock advances persistent deadlines, sweeper marks `EXPIRED`, cleans exact tuple, and does not redeliver;
  - duplicate done: idempotent, no second cleanup/status;
  - foreign device, late old lease, and old socket after reconnect: ignored and unable to mutate/release current work;
  - current disconnect: exact active attempt expires/cleans, with no retry.

  Fake clocks validate state-machine expiry only; they are not evidence for the 45-second answer SLO.

- [ ] **Step 6: Verify mobile socket ordering and history authority with a real authenticated mobile peer.** `fake-mobile.ts` authenticates through the real mobile socket path and parses production mobile schemas. Assert committed chat history contains the assistant message before `chat_message`/`notification`; notification ID equals the assistant message UUID; proactive statuses follow committed delivery transitions; exact duplicates/ignored ACKs emit no duplicate status; after deliberate realtime disconnect, reconnect/history still returns the one authoritative assistant message and terminal delivery state. Do not substitute direct event-emitter calls.

- [ ] **Step 7: Add the firmware cross-system source contract for shared protocol, stall cleanup, and no replay.** `tests/test_cross_system_protocol_contract.py` reads `main/playback.h/.cpp`, `main/api.cpp`, `main/audio.cpp`, and `main/state.cpp`. Assert backend/ESP field parity for voice reserve/cancel/upload and proactive offer/accepted/rejected/ready/cancel/done/failed; strict `SCHEDULE`, UUID/receipt/url/expiry fields; 5-second voice response timeout; 45-second proactive local lease; public URL prefix and `<256`; one atomic `RESERVED → PLAYING` claim; no second decoder; and worker-only terminal reporting/clear/release/`IDLE`.

  Defend all three Task 2 stall sources: HTTP bytes, decoded MP3 frames, and written PCM frames are the only watchdog progress; a frozen HTTP read, decode loop, or bounded PCM write requests cancellation, unwinds, emits `WATCHDOG_STALLED`, and reaches the sole terminal `IDLE`/release path.

  ```python
  import pathlib
  import unittest

  ROOT = pathlib.Path(__file__).resolve().parents[1]
  MAIN = ROOT / "main"

  class CrossSystemProtocolContractTest(unittest.TestCase):
      def test_all_stall_sources_share_worker_idle_cleanup(self):
          playback = (MAIN / "playback.cpp").read_text(encoding="utf-8")
          api = (MAIN / "api.cpp").read_text(encoding="utf-8")
          for counter in ("http_bytes_received", "mp3_frames_decoded",
                          "pcm_frames_written"):
              self.assertIn(counter, playback + api)
          self.assertIn("WATCHDOG_STALLED", playback + api)
          worker = function_body(api, "playback_worker_finish")
          self.assertLess(worker.index("terminal"), worker.index("clear"))
          self.assertLess(worker.index("clear"), worker.index("release"))
          self.assertLess(worker.index("release"), worker.index("IDLE"))

      def test_proactive_is_one_shot_and_uses_shared_decoder(self):
          playback = (MAIN / "playback.cpp").read_text(encoding="utf-8")
          api = (MAIN / "api.cpp").read_text(encoding="utf-8")
          self.assertIn("ready_consumed", playback)
          self.assertNotIn("MP3Decode", playback)
          self.assertEqual(api.count("MP3Decode"), 1)
          self.assertIn("download_and_play_mp3", api)
          self.assertIn("https://api.personalbmo.web.id/audio/", playback + api)
  ```

- [ ] **Step 8: Turn focused suites GREEN and run all backend/firmware checks.** Use the real PostgreSQL test database and real in-process HTTP/WebSocket server; external Hermes/TTS responses may be deterministic fakes, but schemas, authentication, locks, transactions, repositories, mobile sockets, and cleanup remain real.

  ```bat
  cd /d D:\codex\BMO\backend\.worktrees\esp-vps-dialog-schedule\backend
  npx vitest run tests/e2e/voice-reservation.e2e.test.ts tests/e2e/speech-arbitration.e2e.test.ts tests/e2e/proactive-schedule.e2e.test.ts tests/e2e/mobile-socket.e2e.test.ts
  npx prisma validate --schema prisma/schema.prisma
  npx prisma generate --schema prisma/schema.prisma
  npx tsc --noEmit
  npm test
  cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule\esp
  python -m unittest discover -s tests -p "test_cross_system_protocol_contract.py" -v
  python -m unittest discover -s tests -p "test_*.py" -v
  cmd.exe /d /c "call C:\esp\v6.0.1\esp-idf\export.bat && idf.py -B C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build build"
  ```

- [ ] **Step 9: Record reproducible measured E2E evidence without claiming hardware latency.** After the runs complete, write `docs/evidence/cross-system-e2e.json` with schema version `1`; measured 40-hex backend and firmware commits; PostgreSQL engine and measured version; the nonzero random seed; UTC run time; exact sanitized commands; every required scenario's pass/fail; winning owner for every concurrency iteration; persistent terminal states; cleanup results; and an explicit `real` or `fake-clock` timing mode per scenario. Write matching `docs/evidence/cross-system-e2e.md` with the scenario matrix and hashes of sanitized structured logs. Do not create or commit either file with empty measurements, zero/synthetic commit hashes, a zero seed, missing scenarios, auth tokens, receipts, signed URLs, raw audio, or full message payloads. Fake-clock scenarios must set `slo_evidence:false`; only Step 10 hardware measurements may support the answer SLO.

- [ ] **Step 10: Verify the 45-second answer SLO separately on hardware.** Do not infer or claim latency from fake timers, in-process tests, or source contracts. On the real device/production-like backend, use Task 6 structured stage timestamps and record at least 10 valid voice-answer trials in `docs/evidence/answer-slo-hardware.json`. Define answer latency as `first_pcm.ts_us - wav_ready.ts_us`; require each valid trial to use the same request ID, public backend path, real Hermes/TTS, and no simulated clock, and report pass/fail against `45_000 ms`. Include device identity, firmware/backend commits, network, UTC timestamps, all trial latencies, p50/p95/max, invalid-trial reasons, and sanitized stage references. A failed or missing hardware run leaves the SLO explicitly `UNVERIFIED`; E2E GREEN alone never upgrades it.

- [ ] **Step 11: Commit tests and evidence in separable changes.** If Task 12 changes tests only, commit backend and firmware contracts independently so either suite can be reverted without source changes; commit evidence only after the corresponding run.

  ```bat
  cd /d D:\codex\BMO\backend\.worktrees\esp-vps-dialog-schedule
  git add backend/tests/e2e/fake-esp.ts backend/tests/e2e/fake-mobile.ts backend/tests/e2e/voice-reservation.e2e.test.ts backend/tests/e2e/speech-arbitration.e2e.test.ts backend/tests/e2e/proactive-schedule.e2e.test.ts backend/tests/e2e/mobile-socket.e2e.test.ts
  git commit -m "test: cover cross-system speech concurrency"
  cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule
  git add esp/tests/test_cross_system_protocol_contract.py
  git commit -m "test: lock cross-system speech protocol"
  ```

  After evidence is complete, stage only `docs/evidence/cross-system-e2e.json`, `docs/evidence/cross-system-e2e.md`, and, when genuinely measured, `docs/evidence/answer-slo-hardware.json`; commit with `git commit -m "docs: record cross-system speech evidence"`. Do not stage this plan file and do not add a retry implementation.

## Task 13: Canary Hardware Deploy

- [ ] **Step 1: Freeze the release scope, artifacts, evidence, and stop policy.** This task deploys only backend schedule/dialog work and the ESP firmware already implemented by Tasks 1–12. Display animation and native push are explicitly excluded. Create `docs/evidence/canary-hardware-deploy.schema.json`, `docs/evidence/canary-hardware-deploy.json`, and `docs/evidence/canary-hardware-deploy.md`; store only sanitized commands/results, UTC timestamps, migration names, immutable image digest, firmware/application hashes, device identity, aggregate metrics, and verdicts. Never store secrets, auth headers, receipts, signed audio URLs, raw audio, or database contents.

  Immediate stop conditions are: dirty/unreviewed artifact inputs; failed backend/firmware full checks; migration drift or non-additive/destructive SQL; staging migration failure; image tag without immutable digest; digest mismatch; previous-image incompatibility on the migrated schema; COM12 identity mismatch; any erase/model-partition command; firmware hash mismatch; any required hardware gate failure; production migration/deploy failure; health non-2xx; new migration/auth/WebSocket/5xx errors; duplicate message/delivery invariant violation; or unavailable rollback digest. Stop means no next gate and no production rollout.

- [ ] **Step 2: Validate backend and stage the exact migration before any production change.** From `backend`, run full checks and confirm the only pending migration is the reviewed `20260825_bmo_schedule_chat` path plus any already-approved Task 9–11 migrations. Inspect SQL for destructive statements and stop on `DROP TABLE`, dropped data columns/types, lossy casts, or unreviewed data rewrites.

  ```bat
  npx prisma validate --schema prisma/schema.prisma
  npx prisma generate --schema prisma/schema.prisma
  npx prisma migrate status --schema prisma/schema.prisma
  npx tsc --noEmit
  npm test
  ```

  Use the existing operations document and its existing secret injection to back up staging and run the documented staging `npx prisma migrate deploy --schema prisma/schema.prisma`; never use `migrate dev`, embed a database URL, or print credentials. Verify migration history, legacy `ChatSession.purpose=USER_CHAT`, the unique per-user/purpose schedule session, nullable one-to-one `scheduleRunId`, and proactive lifecycle constraints. Record row counts only.

- [ ] **Step 3: Build/publish one immutable backend image and canary it on staging by digest.** Use the repository's existing CI/ops build command; do not invent a second image recipe. Capture the published OCI reference as the repository name, `@sha256:`, and its 64-hex digest; verify the local/registry digest and deploy that digest—not a mutable tag—to the documented staging canary slot. Record the exact non-secret build/run IDs and digest.

  ```bat
  docker image inspect --format "{{json .RepoDigests}}" "%BACKEND_IMAGE_REF%"
  curl.exe --fail --show-error --silent "%STAGING_HEALTH_URL%"
  ```

  `BACKEND_IMAGE_REF` and `STAGING_HEALTH_URL` must come from the existing ops environment; do not guess them. Run the existing migration-deploy, immutable-image deploy, health, and log commands exactly as documented. Canary for at least 15 minutes with health checks plus filtered logs for migration, database constraint, advisory-lock, WebSocket auth, TTS/temp-audio, and 5xx errors. Run Task 12 focused E2E against staging. Stop on any critical/new error or invariant mismatch.

- [ ] **Step 4: Prove rollback compatibility on the migrated staging database.** Record the currently deployed production/previous image digest before rollout. After the additive migration is applied in staging, temporarily run that exact previous digest against the migrated schema and smoke normal `USER_CHAT`, authentication, health, and existing non-schedule APIs. Then restore the new canary digest and rerun health/E2E. This is mandatory because application rollback leaves additive columns/enums/indexes in place. If the previous immutable image cannot operate safely with both `USER_CHAT` and `BMO_SCHEDULE` rows, stop; do not rely on a down migration or schema rollback.

- [ ] **Step 5: Produce a clean external ESP build and hash the exact application artifact.** From the ESP project root use the fixed external build directory. `fullclean` is confined to that temporary build tree; do not clean source or model assets.

  ```bat
  cmd.exe /d /c "cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule\esp && call C:\esp\v6.0.1\esp-idf\export.bat && idf.py -B C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build fullclean build"
  python -m unittest discover -s tests -p "test_*.py" -v
  powershell.exe -NoProfile -Command "$bins=@(Get-ChildItem 'C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build\*.bin'); if($bins.Count -ne 1){throw 'Expected exactly one top-level app binary'}; Get-FileHash -Algorithm SHA256 $bins[0].FullName | Format-List"
  powershell.exe -NoProfile -Command "$elfs=@(Get-ChildItem 'C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build\*.elf'); if($elfs.Count -ne 1){throw 'Expected exactly one app ELF'}; Get-FileHash -Algorithm SHA256 $elfs[0].FullName | Format-List"
  ```

  Record project commit, IDF version, app `.bin` path/hash, ELF path/hash, size, build timestamp, and the generated flash metadata hash. Stop if more than one candidate app binary exists or hashes change between verification and flash.

- [ ] **Step 6: Detect COM12, verify device identity, and app-flash only the hashed build.** Detect ports before attaching and confirm COM12's USB identity matches the designated canary device. Use the exact external build directory for `app-flash`, which writes only the application slot; never run `erase-flash`, full `flash`, partition-table/bootloader writes, model writes, or force options.

  ```bat
  python -m serial.tools.list_ports -v
  cmd.exe /d /c "cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule\esp && call C:\esp\v6.0.1\esp-idf\export.bat && idf.py -B C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build -p COM12 app-flash"
  cmd.exe /d /c "cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule\esp && call C:\esp\v6.0.1\esp-idf\export.bat && idf.py -B C:\Users\cenna\AppData\Local\Temp\bmo-dialog-schedule-build -p COM12 monitor --no-reset"
  ```

  Compare the boot-reported application/ELF SHA prefix and project version with the recorded build. Stop on port re-enumeration to another identity, flash verification failure, unexpected partition write, boot loop, hash/version mismatch, or model load error.

- [ ] **Step 7: Pass the dialog hardware gate on COM12 against staging.** Keep structured serial observability enabled and raw audio disabled. Explicitly record `IDLE` and `wake_eligible:true` before each valid trial. Run all gates with the exact canary firmware/backend:

  - 10 wake trials at a measured 15–20 cm: at least 8/10 detected;
  - 10-minute eligible-IDLE no-speech soak: at most one false wake;
  - accepted reservation: 100–150 ms acknowledgement beep and separately measured 100–150 ms drain/settle, with all beep/settle RX frames discarded and first retained PCM timestamp at or after `CAPTURE_ARMED`;
  - no-speech capture: terminal at 5.0 seconds from arm within one 512-sample frame plus scheduler tolerance;
  - sustained speech: hard stop at 15.0 seconds from confirmed speech within one frame plus tolerance;
  - speech then silence: stop at 1.5 seconds from last above-end-threshold frame within one frame plus tolerance;
  - uploaded WAV: RIFF/WAVE PCM format 1, mono, 16 kHz, 16-bit, 32 kB/s, block align 2, exact data length, and no pre-arm/beep frames;
  - real answer latency: `first_pcm.ts_us - wav_ready.ts_us <= 45_000 ms`, using matching request/stage IDs and real staging Hermes/TTS; fake-clock results are invalid;
  - controlled HTTP, decode, and PCM no-progress cases using only existing staging/fault controls: Task 2 watchdog requests cancellation, worker unwinds, emits strict failure, releases, and returns to `IDLE`.

  If an existing safe fault control cannot exercise any required stall on the exact production artifact, mark that gate `UNVERIFIED` and stop rather than adding ad-hoc production hooks or claiming source-test evidence as hardware proof.

- [ ] **Step 8: Pass the schedule/proactive hardware and mobile gate.** Use real authenticated application/device/mobile bindings and staging PostgreSQL; never edit rows to simulate success. Verify:

  - online + backend/device idle: mobile assistant history commits first, offer/accepted/ready/done exact tuples complete, audio uses public `https://api.personalbmo.web.id/audio/`, attempt reaches `PLAYED`, delivery `DELIVERED`, MP3/reservation cleanup completes, and device returns `IDLE`;
  - offline: delivery `MISSED/OFFLINE`, zero TTS/temp audio, no retry;
  - voice/speaker busy: `MISSED/BUSY`, zero TTS, no retry;
  - accepted then TTS failure: exact cancel observed, `FAILED`, and lost-cancel simulation remains reserved only until the real 45-second lease expiry;
  - offer/lease expiry: real-time expiry and sweeper cleanup, no redelivery;
  - duplicate exact done: idempotent with one status/cleanup;
  - foreign device/socket and late old lease ACKs: ignored without releasing current work;
  - current disconnect: exact tuple expires/cleans and does not retry;
  - authenticated mobile: exactly one `chat_message`, one `notification` whose ID equals the assistant message UUID, committed history survives reconnect, and proactive statuses match persistent lifecycle.

  Stop on localhost/private audio URL, URL length 256 or more, non-positive expiry, replay, duplicate message/notification/status, cross-device mutation, cleanup leak, unexpected TTS on offline/busy, or any retry.

- [ ] **Step 9: Prepare the production change and rollback record on `bmo-codex`.** Use the existing operations document only. Before mutation, connect read-only to verify host identity and capture the current immutable image digest, service health, migration status, deploy command version, and rollback command. Do not print environment values or secrets.

  ```bat
  ssh bmo-codex "cd /opt/bmo/app && git rev-parse HEAD && git status --short"
  ssh bmo-codex "cd /opt/bmo/app && docker version --format '{{.Server.Version}}' && docker ps --format '{{.Names}} {{.Image}} {{.Status}}'"
  ```

  If the documented platform is not Docker, stop using Docker commands and follow the actual ops document; do not guess. Confirm the new digest equals the staging-tested digest, the previous digest is still pullable/present, database backup/restore verification is current, and additive-migration compatibility from Step 4 passed. The rollback is application-only to the previous digest; leave additive schema in place. Never force-push, rewrite Git history, or run an unreviewed down migration.

- [ ] **Step 10: Deploy migration then immutable image using the existing `bmo-codex` ops procedure.** Run the documented one-shot production `prisma migrate deploy` job first with existing secret injection, verify migration history and health, then deploy the exact immutable digest recorded in Step 3 to the canary instance/traffic slice. Do not paste guessed commands into production: copy the literal migration, deploy, health, log, and rollback commands from the current ops document into the sanitized evidence with secret values redacted and command hashes retained.

  Stop immediately on migration error/drift, digest mismatch, restart loop, failed readiness, database/advisory-lock error, WebSocket authentication regression, or health failure. On application failure after a successful additive migration, execute the recorded previous-digest rollback command; do not reverse the schema.

- [ ] **Step 11: Run production health/log canary and promote or roll back.** For at least 30 minutes on the canary slice, require continuous documented health success, no new 5xx/migration/constraint/auth/WebSocket/TTS/temp-audio errors, stable process restarts/memory, and no stuck `CLAIMED`, `DELIVERING`, `PENDING`, or expired lease rows beyond the sweeper window. Run one authorized production canary schedule on the designated canary user/device and verify mobile history/notification, public audio, exact ACK lifecycle, cleanup, and `IDLE`; do not repeat destructive/stall injection in production.

  Promote the same immutable digest only if every stop gate remains clear. Roll back immediately to the recorded previous digest on any critical error, invariant violation, cleanup leak, duplicate delivery, cross-device ACK, non-public URL, or health regression. After rollback, verify health, normal `USER_CHAT`, WebSocket auth, and migration compatibility; leave schedule canary disabled until root cause is resolved.

- [ ] **Step 12: Define, generate, validate, and commit sanitized hashed evidence separately.** Create `docs/evidence/canary-hardware-deploy.schema.json` first. It rejects absent or empty measurements, mutable image tags, malformed Git/SHA-256 values, missing UTC windows, missing gate timestamp references, and undeclared fields. It permits either final promotion or recorded rollback, but every digest/hash remains required in both cases.

  ```json
  {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://personalbmo.web.id/schemas/canary-hardware-deploy.schema.json",
    "title": "BMO canary hardware deployment evidence",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "captured_at",
      "backend",
      "firmware",
      "gates",
      "rollback",
      "excluded",
      "decision"
    ],
    "properties": {
      "schema_version": { "const": 1 },
      "captured_at": { "type": "string", "format": "date-time" },
      "backend": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "commit",
          "migrations",
          "image_digest",
          "previous_digest",
          "staging_health_window",
          "production_health_window"
        ],
        "properties": {
          "commit": { "$ref": "#/$defs/gitCommit" },
          "migrations": {
            "type": "array",
            "minItems": 1,
            "uniqueItems": true,
            "items": {
              "type": "string",
              "minLength": 1,
              "pattern": "^[0-9]{8}_[a-z0-9_]+$"
            }
          },
          "image_digest": { "$ref": "#/$defs/ociDigest" },
          "previous_digest": { "$ref": "#/$defs/ociDigest" },
          "staging_health_window": { "$ref": "#/$defs/healthWindow" },
          "production_health_window": { "$ref": "#/$defs/healthWindow" }
        }
      },
      "firmware": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "commit",
          "app_bin_sha256",
          "elf_sha256",
          "flash_metadata_sha256",
          "port",
          "device_identity",
          "device_identity_verified"
        ],
        "properties": {
          "commit": { "$ref": "#/$defs/gitCommit" },
          "app_bin_sha256": { "$ref": "#/$defs/sha256" },
          "elf_sha256": { "$ref": "#/$defs/sha256" },
          "flash_metadata_sha256": { "$ref": "#/$defs/sha256" },
          "port": { "const": "COM12" },
          "device_identity": { "type": "string", "minLength": 1 },
          "device_identity_verified": { "const": true }
        }
      },
      "gates": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "dialog_hardware",
          "answer_slo_hardware",
          "schedule_hardware",
          "rollback_compatibility"
        ],
        "properties": {
          "dialog_hardware": { "$ref": "#/$defs/gate" },
          "answer_slo_hardware": { "$ref": "#/$defs/gate" },
          "schedule_hardware": { "$ref": "#/$defs/gate" },
          "rollback_compatibility": { "$ref": "#/$defs/gate" }
        }
      },
      "rollback": {
        "type": "object",
        "additionalProperties": false,
        "required": ["rehearsed_at", "result", "command_sha256"],
        "properties": {
          "rehearsed_at": { "type": "string", "format": "date-time" },
          "result": { "enum": ["PASS", "EXECUTED"] },
          "command_sha256": { "$ref": "#/$defs/sha256" }
        }
      },
      "excluded": {
        "type": "array",
        "const": ["display_animation", "native_push"]
      },
      "decision": { "enum": ["PROMOTE", "ROLLBACK"] }
    },
    "$defs": {
      "gitCommit": {
        "type": "string",
        "pattern": "^[a-f0-9]{40}$"
      },
      "sha256": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "ociDigest": {
        "type": "string",
        "pattern": "^sha256:[a-f0-9]{64}$"
      },
      "healthWindow": {
        "type": "object",
        "additionalProperties": false,
        "required": ["started_at", "ended_at", "result"],
        "properties": {
          "started_at": { "type": "string", "format": "date-time" },
          "ended_at": { "type": "string", "format": "date-time" },
          "result": { "enum": ["PASS", "ROLLED_BACK"] }
        }
      },
      "gate": {
        "type": "object",
        "additionalProperties": false,
        "required": ["result", "timestamp_refs", "log_sha256"],
        "properties": {
          "result": { "enum": ["PASS", "FAIL"] },
          "timestamp_refs": {
            "type": "array",
            "minItems": 1,
            "items": { "type": "string", "minLength": 1 }
          },
          "log_sha256": { "$ref": "#/$defs/sha256" }
        }
      }
    }
  }
  ```

  Generate `docs/evidence/canary-hardware-deploy.json` only from the measured outputs captured in Steps 2–11; do not copy an example instance or use empty strings, zero hashes, synthetic digests, sentinel values, or values scheduled for later replacement. Write `docs/evidence/canary-hardware-deploy.md` from the same measurements with the human gate table, command-log hash references, and promotion/rollback narrative.

  Validate the generated instance against the checked-in schema and independently compare every hash/digest to the sanitized command transcript:

  ```bat
  cd /d D:\codex\BMO\esp\.worktrees\esp-vps-dialog-schedule
  npx --yes ajv-cli@5.0.0 validate --strict=true --spec=draft2020 -s docs/evidence/canary-hardware-deploy.schema.json -d docs/evidence/canary-hardware-deploy.json
  git add docs/evidence/canary-hardware-deploy.schema.json docs/evidence/canary-hardware-deploy.json docs/evidence/canary-hardware-deploy.md
  git commit -m "docs: record canary hardware deployment"
  ```

  Expected: AJV prints that `docs/evidence/canary-hardware-deploy.json` is valid; each digest/hash equals a measured command result; the Markdown and JSON verdicts agree; and the final commit is evidence-only on `feat/esp-vps-dialog-schedule-firmware`, separate from firmware/backend implementation commits and this plan.

## Spec Coverage Matrix

| Spec section | Requirement cluster | Implementing task(s) | Completion evidence |
|---|---|---|---|
| §2 Grounded diagnosis | Playback starvation is fixed before WakeNet/VAD conclusions; all builds/evidence use clean committed inputs | Tasks 1, 2, 6 | Clean firmware worktree/base hash, counter-only watchdog contracts, eligible-only calibration evidence |
| §3 System invariants | Local/backend ownership, speaker gating, same-ID promotion, mobile-first persistence, opportunistic no-retry delivery, exact correlation | Tasks 2–12 | Firmware/backend contract suites plus cross-system concurrency and terminal-cleanup E2E |
| §4 Two-stage voice | Authenticated reserve/accept/cancel/expiry, beep/drain/settle, pre-wake ambient snapshot, bounded VAD/WAV, same-ID upload, answer SLO | Tasks 3–6, 12, 13 | Arbiter/voice Vitest, firmware discovery, calibration evidence, fake-ESP and COM12 dialog gates |
| §5 Playback watchdog | Three monotonic counters, five-second cancellation latch, safe Helix/I2S boundaries, worker-owned cleanup, one normal replay, no proactive replay | Tasks 2, 10, 12, 13 | Focused playback contracts, forced-stall E2E, external build, hardware stall evidence |
| §6 Schedule/mobile | Hermes every run, Unicode 2–10-word validation and one repair, deterministic `BMO Schedule`, exactly one message, history before optional speech | Tasks 7–9, 12, 13 | Schema/repository/service Vitest, realtime-failure E2E, staging and canary persistence evidence |
| §7 Shared arbitration | P9 UUID ownership with advisory locks, persistent generations/leases/receipts, gapless voice promotion, atomic schedule acquisition, exact release | Tasks 3, 4, 9, 11, 12 | Prisma migration/source contracts, PostgreSQL transition tests, concurrent voice/schedule E2E |
| §8 Physical schedule protocol | Offer/accept, post-accept TTS, public temporary MP3, ready/terminal events, expiry, cleanup, no queue/retry | Tasks 9–12 | Device-port and ACK Vitest, firmware proactive contracts, fake-ESP lifecycle E2E |
| §9 ACK authentication | Current authenticated connection, device/correlation/generation/receipt checks, legal transitions, duplicate idempotency, foreign/late rejection | Tasks 9, 11, 12 | PostgreSQL ACK tests, forged/late/duplicate E2E, mobile status assertions |
| §10 Observability | Correlated stage timestamps, one-second aggregate mic records, answer-start definition, counter-only stall timing, separate mobile/physical outcomes | Tasks 2, 5, 6, 8–13 | Serial schema contract, sanitized calibration/E2E evidence, hardware and canary timing records |
| §11 Failure/test matrix | Every named voice, playback, generation, mobile, device, lease, ACK, and calibration scenario has an observable assertion | Tasks 2–13 | Focused unit/protocol suites, cross-system E2E, hardware gate tables, canary schema-validated evidence |
| §12 Rollout gates | Unit/protocol, fake ESP, calibration, dialog hardware, schedule hardware, VPS canary, identical hashed firmware rollout | Tasks 12, 13 | Ordered stop gates, measured hashes/digests, staging/rollback rehearsal, COM12 and production canary records |
| §13 Decomposition | Five contract-aligned slices land in dependency order with independent backend and firmware commits | Tasks 1–11 | File responsibility map, task ordering, separate worktrees/branches, repository-owned commit commands |
| §14 Non-goals | Display/native push/broad proactive framework/retry/ChatService coupling/guard changes/unmeasured threshold changes/I2S recreation/raw audio/replay remain excluded | Tasks 1–13 and Explicit Non-Goals | Source/file scopes, negative assertions, evidence exclusions, stop policy |

### Explicit Non-Goals

- Display/face animation changes and animation QA are outside this plan.
- Native push notifications are not added; the existing mobile socket/history path remains authoritative.
- No retry queue, broad `ProactiveDelivery` retrofit, or replay mechanism is introduced.
- Normal `USER_CHAT` behavior and `ChatService` remain untouched except for backward-compatible schema defaults.
- The deployed 3,145,728-byte/60-second voice-input guard, 600-character/three-sentence normal TTS policy, and 32 KiB/4 KiB ESP streaming layout are not changed solely for schedule brevity.
- `SILENCE_THRESHOLD=800`, phrase-time level, SNR, and WakeNet sensitivity are not treated as confirmed fixes before valid eligible calibration.
- Normal capture does not recreate the I2S driver; frame draining and one frame-boundary logical reset provide isolation.
- Raw microphone/PCM audio, secrets, private environment contents or hashes, receipts, auth headers, and signed URLs are never evidence.
- No firmware model/NVS erase, partition rewrite, source-tree build output, force-push, history rewrite, or production down migration is permitted.
- `D:/BMO` is not treated as production source; production inspection/deploy uses `bmo-codex:/opt/bmo/app` and the existing ops procedure.
