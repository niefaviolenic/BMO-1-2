# BMO ESP–VPS Dialog and Schedule Delivery Design

**Status:** Approved
**Date:** 2026-08-25

## 1. Goal and scope

This integration program makes two paths reliable without changing BMO's visual design:

1. A two-stage ESP↔VPS voice interaction: wake locally, then capture one bounded utterance and play the correlated VPS answer.
2. A schedule path: generate every due result through Hermes, persist it for mobile chat, and optionally speak it on the physical BMO when that device is online and idle.

Display animation is explicitly deferred. Existing static display modes, including the current `IDLE`, `THINKING`, and `SPEAKING` presentation, remain unchanged.

The program spans ESP firmware and VPS services, but is decomposable along the fixed contracts in this document: instrumentation and playback recovery, voice capture, schedule generation and mobile persistence, shared device arbitration, and the two-phase physical delivery protocol.

## 2. Grounded diagnosis

The fresh 10-utterance capture is not a valid WakeNet sensitivity test. The device was eligible to run WakeNet only while it was `IDLE`. After VPS authentication recovered a stale `backend_state=audio_ready`, the device transitioned `IDLE → THINKING → SPEAKING` and did not return to `IDLE` for more than 43 seconds. WakeNet does not run outside `IDLE`, so misses observed during that interval cannot be attributed to WakeNet sensitivity.

Mic full-frame heartbeats were healthy. Observed peaks were 1121, 1571, 870, and 685. The confirmed defect is starvation caused by recovered playback/state handling. Phrase-time level, signal-to-noise ratio, and sensitivity remain calibration hypotheses, not confirmed root causes. In particular, a value such as 393 can be real low-level input, so the current `SILENCE_THRESHOLD=800` must not be copied into the new capture policy without measured calibration.

The implementation order follows this diagnosis: first guarantee playback completion or bounded recovery back to `IDLE`; then collect valid wake and VAD measurements while wake eligibility is explicitly true.

## 3. System invariants

- WakeNet is eligible only in local `IDLE`, with no voice or proactive reservation and no speaker output in progress.
- Every speaker output, including the local acknowledgement beep, gates WakeNet and drains rather than classifies contemporaneous microphone frames.
- Voice and proactive schedule playback use the same per-device `DeviceSpeechArbiter`; neither path may perform a check and later send outside the reservation transaction.
- Voice capture admission is an authenticated WebSocket reservation. HTTP upload may create `RequestStore` processing only by atomically promoting the exact unexpired reservation with the same `request_id`; device ownership is never released between those phases.
- Every terminal voice or playback path that owns the local device clears its job, releases its reservation, and returns the ESP to `IDLE`; a rejected proactive offer that never acquired local ownership leaves the winning state and owner unchanged.
- Every due schedule goes through Hermes and becomes exactly one persisted assistant message before any physical delivery is offered.
- Mobile chat history is authoritative and always available as the recovery source. Realtime events are best-effort acceleration only.
- Physical schedule playback is opportunistic, has no retry, is never delayed for a busy or offline device, and never changes the successful schedule run outcome.
- All protocol events are correlated to the exact authenticated request or delivery attempt; stale, late, foreign, or superseded events cannot mutate the active interaction.

## 4. Two-stage voice interaction

### 4.1 Authenticated pre-capture reservation and local states

The successful-dialog control sequence is:

`IDLE → VOICE_RESERVING → BEEP → DRAIN_SETTLE → CAPTURE_ARMED → RECORDING → UPLOADING → THINKING → SPEAKING → IDLE`

`VOICE_RESERVING`, `BEEP`, `DRAIN_SETTLE`, `CAPTURE_ARMED`, `RECORDING`, and `UPLOADING` are control states, not new display modes. They continue to use the existing static display behavior.

When WakeNet detects “Hi Joy” while explicitly eligible, the ESP generates a cryptographically random UUIDv4 `request_id` and atomically changes its local owner from free `IDLE` to `VOICE_RESERVING(request_id)`. That transition immediately disables further WakeNet calls. Over the currently authenticated device WebSocket, it sends:

```text
voice_reserve {
  request_id: UUIDv4
}
```

The backend derives `device_id` from the authenticated connection, never from the payload. Under the PostgreSQL advisory lock keyed by that device ID, one transaction verifies that the connection is still authenticated, backend device state is `IDLE`, and `DeviceSpeechArbiter` has no owner. If eligible, it creates `VOICE_CAPTURE_RESERVED` ownership keyed by `device_id + request_id`, a UUID `lease_id`, an opaque unguessable `reserve_receipt`, and a database-clock expiry exactly 45.000 seconds after acceptance. It replies:

```text
voice_reserve_accepted {
  request_id: UUIDv4,
  lease_id: UUID,
  reserve_receipt: opaque,
  capture_lease_duration_seconds: 45,
  capture_lease_expires_at: server timestamp
}
```

If authentication, backend `IDLE`, arbiter availability, or request freshness fails, it creates no reservation and replies:

```text
voice_reserve_rejected {
  request_id: UUIDv4,
  reason: UNAUTHENTICATED | NOT_IDLE | BUSY | STALE_REQUEST
}
```

The ESP's reservation-response deadline is 5.000 seconds from successful `voice_reserve` send. Send failure, WebSocket disconnect, response timeout, or a matching rejection releases the local owner and returns directly to `IDLE`. Only a matching accepted response for the current `VOICE_RESERVING(request_id)` owner may trigger the beep and capture sequence.

The 45-second capture lease is deliberately larger than the worst bounded capture path: 150 ms beep + 150 ms settle + 5.000 seconds waiting for speech + 15.000 seconds speech is 20.300 seconds. From backend acceptance, that leaves 24.700 seconds for frame-boundary finalization and authenticated HTTP upload admission. The backend lease starts at its acceptance transaction. To avoid clock-skew or response-delay overrun, the ESP uses the conservative local deadline `voice_reserve sent monotonic time + 45.000 seconds`; even when the accepted response consumes the full 5-second response window, at least 19.700 seconds remain after the worst bounded capture path for finalization and HTTP handoff. The ESP never extends the lease from response receipt.

An exact duplicate `voice_reserve` from the same authenticated device and active `request_id` returns the same `lease_id`, receipt, and original expiry without extending it. A terminal or reused `request_id` is rejected as `STALE_REQUEST`. The ESP applies accepted/rejected responses only to the exact current `request_id`. A duplicate acceptance never causes a second beep. A rejection received after acceptance and any response for a different, expired, cancelled, or terminal request is ignored. If a late acceptance arrives after the ESP has released its local owner, the ESP sends a best-effort exact `voice_cancel` so the backend can release that otherwise valid stale reservation safely.

### 4.2 Beep, drain, settle, and reset timing

After admission:

1. Play one local acknowledgement beep lasting 100–150 ms.
2. Discard or drain every microphone RX frame from the first speaker-beep write through the entire settle interval. None of these frames enters WakeNet, VAD, pre-roll, or recording counters.
3. The settle interval starts when the final beep PCM frame is successfully written to the speaker and lasts a hardware-measured value in the inclusive range 100–150 ms. The selected value is fixed by hardware calibration and logged for each capture.
4. At the first complete microphone frame boundary after the settle deadline, reset logical WakeNet, VAD, pre-roll, silence, speech, and recording counters together, then enter `CAPTURE_ARMED`.

Normal captures do not delete, reinstall, or recreate the I2S driver. I2S recreation is reserved for a separately diagnosed driver failure; the ordinary isolation mechanism is frame draining plus a frame-boundary logical reset.

### 4.3 Speech timing and finalization

All durations use monotonic time and are evaluated on complete audio-frame boundaries:

- The wait-for-speech deadline is exactly 5.000 seconds after `CAPTURE_ARMED` begins.
- If the calibrated speech-start hysteresis has not confirmed speech by that deadline, finalize locally as `NO_SPEECH`, send the exact pre-promotion `voice_cancel`, upload nothing, release the local voice owner, and return to `IDLE`.
- After speech-start confirmation, the utterance recording budget is at most 15.000 seconds measured from the first frame included as confirmed speech. Pre-speech waiting is a separate bounded arm phase and does not consume that 15-second speech budget.
- After speech begins, finalize at the first complete frame that establishes 1.500 seconds of continuous calibrated trailing silence, or at the 15-second speech deadline, whichever occurs first.
- A short retained pre-roll may precede the confirmed speech frame, but it must contain only post-settle frames and does not alter either deadline.

Speech-start and speech-end use separate hysteresis thresholds and dwell requirements derived from ambient and spoken frame distributions on the target hardware. Calibration records ambient and spoken peak/RMS distributions and selects thresholds between those distributions. It must not blindly reuse `SILENCE_THRESHOLD=800`.

The uploaded file is canonical WAV: PCM signed 16-bit little-endian, 16 kHz, mono, with a correct RIFF/WAVE header and data length. Invalid or truncated WAV is rejected before model processing.

### 4.4 Upload promotion, cancellation, and expiry

The authenticated HTTP upload carries the same `request_id`, `lease_id`, and `reserve_receipt` issued by `voice_reserve_accepted`. Before accepting the body into voice processing, the backend derives the device from HTTP authentication and, under the same per-device PostgreSQL advisory lock, verifies the exact active `VOICE_CAPTURE_RESERVED` tuple and that its capture lease has not expired. In one transaction it creates or admits the `RequestStore` record with that same `request_id` and promotes arbiter ownership from `VOICE_CAPTURE_RESERVED` to `VOICE_PROCESSING`. There is no release/reacquire gap in which proactive delivery can win.

A missing, foreign, mismatched, cancelled, or expired reservation is rejected without creating `RequestStore` processing and without mutating another active reservation. Once promotion commits, the 45-second capture lease no longer controls the request; the existing `RequestStore` processing and playback lifecycle owns the same uninterrupted device reservation until its terminal path. Upload-body, WAV-validation, or processing failure terminalizes that correlated request, releases the arbiter, and returns the ESP to `IDLE`.

Before promotion, the ESP cancels `NO_SPEECH`, local abort, or failed upload handoff with:

```text
voice_cancel {
  request_id: UUIDv4,
  lease_id: UUID,
  reserve_receipt: opaque,
  reason: NO_SPEECH | LOCAL_ABORT | UPLOAD_HANDOFF_FAILED
}
```

The backend applies `voice_cancel` only under the device advisory lock and only to the exact current `VOICE_CAPTURE_RESERVED` tuple. An exact duplicate cancel is idempotent. A stale, foreign, mismatched, or post-promotion cancel cannot release `VOICE_PROCESSING` or a newer owner.

If the capture lease expires before promotion, the backend atomically marks that reservation expired and releases it; it sends a correlated `voice_reserve_expired` when the authenticated channel is available. Authenticated WebSocket disconnect before promotion performs the same backend release immediately. Independently, the ESP aborts capture or upload handoff at its conservative local lease deadline, releases its local owner, and returns to `IDLE`, so a lost cancel or expiry event cannot strand either side.

### 4.5 Existing input and output bounds

The deployed voice-input backend accepts at most 3,145,728 bytes and 60 seconds, and requires canonical WAV. The ESP currently has the same maximum. Those guards remain valid; the new 5-second arm window and 15-second post-speech recording limit are stricter UX bounds.

Deployed answer TTS accepts at most 600 characters and three sentences, and streams MP3 to the ESP through a 32 KiB buffer using 4 KiB reads. Normal dialogue retains this longer response policy.

A normal answer meets its start SLO only when the first speaker PCM frame is successfully written no later than 45.000 seconds after recording finalization. HTTP response receipt, `audio_ready`, download start, MP3 decode, and an attempted speaker write do not satisfy the SLO.

### 4.6 Wake acceptance and calibration

A wake calibration run is valid only when logs prove the device was explicitly WakeNet-eligible for each utterance. Release acceptance is:

- At least 8 detections in 10 utterances spoken from 15–20 cm while explicitly `IDLE` and eligible.
- At most one false wake during 10 continuous minutes in the target ambient environment.

Calibration must preserve the utterance-level wake-eligibility record and aggregate mic statistics described in Section 10. It must not store or emit raw audio.

## 5. Blocking playback watchdog and stale recovery

Playback remains a blocking worker operation, so a separate coordinator/task owns cancellation, terminal cleanup, and state recovery. The worker exposes only atomic monotonic progress counters:

- HTTP response-body bytes received,
- MP3 frames successfully decoded, and
- PCM frames successfully written to the speaker.

For an active playback job, the coordinator records the latest monotonic time at which any of those counters increases. If none increases for a contiguous 5.000 seconds, the coordinator requests cancellation. Heartbeats, loop iterations, log lines, socket liveness, state messages, and failed write attempts are not progress.

The blocking worker checks cancellation at safe network, decoder-frame, and PCM-write boundaries. At the first safe boundary it stops, closes stream/decoder resources, emits the job's correlated failure exactly once, and yields terminal ownership to the coordinator. The coordinator then clears the job, releases the arbiter, and returns the ESP to `IDLE`. If the worker cannot reach a safe boundary, the coordinator still owns the bounded terminal transition and prevents the stale job from retaining logical device ownership.

Recovered normal-dialog playback may be replayed at most once for the original request, using the exact original request correlation. The replay budget is stored with that request and is not renewed by reconnects. A schedule delivery is never replayed. Events whose request ID, device ID, playback generation, or current state do not match the active job are ignored. Every success, rejection, cancellation, watchdog failure, decode/download failure, disconnect, and recovery-exhausted path returns to `IDLE`.

## 6. Schedule result generation and mobile persistence

### 6.1 Dedicated service boundary

A dedicated `ScheduledResultService` owns schedule execution. It calls Hermes, validates the result, persists the mobile-visible assistant message, and only then asks a narrow one-shot `DeviceSpeechPort` to attempt physical delivery.

This is intentionally not a retrofit of a broad `ProactiveDeliveryService`, and schedule generation does not couple to `ChatService`. The one-shot port accepts a completed persisted schedule result and returns one terminal physical outcome; it does not own generation, chat history, retries, or delayed queues.

### 6.2 Hermes result contract

Every due schedule calls Hermes. A valid schedule response contains exactly 2–10 words. For this postcondition, trim outer whitespace, split on one or more Unicode whitespace characters, and count each nonempty token containing at least one Unicode letter or number as one word; any other nonempty token makes the result invalid. This is a UX constraint applied to Hermes output, not a consequence of the 3,145,728-byte voice-input limit.

If the first Hermes result is outside 2–10 words, the service may make one bounded repair-generation call that asks Hermes to preserve the meaning in 2–10 words. The repaired output is validated again. No invalid result is persisted, offered, or synthesized. Initial generation failure, repair failure, or a second invalid result makes the `ScheduleRun` `FAILED` and prevents physical delivery.

### 6.3 Deterministic chat session decision

Each user has exactly one real `ChatSession` with purpose `BMO_SCHEDULE` and display title `BMO Schedule`. A database uniqueness constraint on `(user_id, purpose)` makes the relation deterministic; the title alone is not used as identity.

`ScheduledResultService` takes a PostgreSQL advisory lock keyed by user ID, then selects or creates this session inside the transaction. The final validated result is inserted as exactly one assistant message in that session. The message carries a unique schedule-run idempotency key, so retries or process recovery cannot create a second assistant message for the same run.

`ScheduleRun` remains `CLAIMED` throughout Hermes generation and the transaction that creates/selects the session, inserts the assistant message, and marks the run `SUCCEEDED`. Generation or persistence failure marks it `FAILED`; no physical offer follows. After commit, the service emits the existing mobile `chat_message` event and existing in-app realtime notification. There is no native FCM or APNs work. Realtime emission is best-effort; the persisted `BMO Schedule` chat history is the authoritative recovery path and therefore makes the result mobile-visible even if realtime delivery is missed.

Once message persistence succeeds, the schedule run remains `SUCCEEDED` regardless of whether optional physical playback is `DELIVERED`, `MISSED`, `FAILED`, or `EXPIRED`.

## 7. Shared device speech arbitration

`DeviceSpeechArbiter` is the single cross-path authority for voice and proactive speaker ownership. Its reservation is keyed by authenticated device ID and records the owner kind, owner correlation ID, current generation, and terminal/release state.

Every acquire, promote, or release operation runs under a PostgreSQL advisory lock keyed by device ID. Voice reserve acquisition mutates only the arbiter's `VOICE_CAPTURE_RESERVED` record. HTTP upload admission atomically creates or admits the same-ID `RequestStore` request and promotes that reservation to `VOICE_PROCESSING` in one transaction. Schedule acquisition mutates its delivery state in the reservation transaction. This supplies multi-process correctness and removes both check-then-send and release/reacquire races.

For voice, the authenticated WebSocket reservation wins device ownership before the beep but deliberately precedes `RequestStore`; the authenticated HTTP handoff performs the exact promotion later. For schedule delivery, the winning transaction authenticates the connected device, verifies backend presence and `IDLE`, reserves the device, and records the delivery transition before any WebSocket offer is sent. Release compares the exact active owner, correlation, lease, and generation; an old expiry, cancel, upload, or terminal event cannot release a newer reservation.

The ESP mirrors the same exclusion locally with an atomic owner transition. `playback_prepare_proactive` succeeds only from local `IDLE` with no capture or speaker owner. All speaker activity disables WakeNet until the owner is terminally released.

## 8. Two-phase physical schedule protocol

### 8.1 Eligibility and phase 1: offer

Physical delivery is attempted after mobile persistence and only once.

The backend atomically claims the authenticated device through `DeviceSpeechArbiter` and verifies online presence plus backend `IDLE`. If the device is offline or busy, the delivery immediately becomes terminal `MISSED` with reason `OFFLINE` or `BUSY`; no TTS is generated, no offer is queued, and there is no retry or delayed playback.

After a successful reservation, the backend creates one delivery attempt in `PENDING`, changes the delivery from `PENDING` to `DELIVERING`, and sends:

```text
proactive_offer {
  delivery_id: UUID,
  source: SCHEDULE,
  attempt_id: UUID,
  offer_receipt: opaque,
  reservation_expires_in_seconds: 45
}
```

The offer deadline is exactly 45.000 seconds from successful send. The ESP executes `playback_prepare_proactive` as one atomic local transition from `IDLE`. It replies with accepted or rejected and echoes `delivery_id`, `attempt_id`, and `offer_receipt`. Local rejection as busy makes the delivery `MISSED/BUSY`; loss of the authenticated connection before acceptance makes it `MISSED/OFFLINE`. No TTS is generated for either outcome. An unanswered offer that reaches its deadline becomes `EXPIRED` and releases both reservations.

A valid acceptance starts a fresh 45.000-second lease on both ESP and backend, measured from backend receipt of the accepted ACK. The backend creates a unique `lease_id`; the ESP retains the accepted delivery and attempt as its sole local owner while waiting for phase 2. If cancellation is lost, the ESP releases that owner automatically at its local lease deadline.

### 8.2 Phase 2: synthesize and stream

Only after valid acceptance does the backend synthesize the already-persisted 2–10-word result, store the temporary MP3, and form its public URL. The URL must:

- use `https://api.personalbmo.web.id/audio/...`,
- never expose an internal address such as `127.0.0.1`,
- identify the accepted delivery artifact, and
- contain fewer than 256 characters.

If TTS, temporary storage, URL formation, or the WebSocket send fails after acceptance, the backend sends `proactive_cancel` when the authenticated channel remains available, marks the attempt and delivery `FAILED`, releases the arbiter, and deletes the temporary MP3. The ESP releases locally on a matching cancel or, if cancel is lost, on lease expiry. There is no physical retry.

Before the lease deadline, the backend sends:

```text
proactive_audio_ready {
  delivery_id: UUID,
  source: SCHEDULE,
  attempt_id: UUID,
  lease_id: UUID,
  audio_receipt: opaque,
  audio_url: https://api.personalbmo.web.id/audio/...,
  format: mp3,
  expires_in_seconds: positive integer
}
```

`expires_in_seconds` is the whole-second remaining validity shared by the temporary object and the accepted lease; it never extends past the lease deadline. If no positive interval remains, the backend sends no ready event and marks the attempt and delivery `EXPIRED`.

A successful ready send changes the attempt from `PENDING` to `SENT`. The ESP uses the shared streaming downloader/decoder/playback path and its watchdog. It sends exactly one matching terminal event:

```text
proactive_playback_done {
  delivery_id, attempt_id, lease_id, audio_receipt
}
```

or:

```text
proactive_playback_failed {
  delivery_id, attempt_id, lease_id, audio_receipt,
  reason: DOWNLOAD_FAILED | DECODE_FAILED | PLAYBACK_FAILED | AUDIO_EXPIRED
}
```

A valid done changes the attempt to `PLAYED` and the delivery to `DELIVERED`. A valid failed event changes both attempt and delivery to `FAILED`. Reaching the accepted lease or audio deadline before a valid terminal ACK changes all nonterminal records to `EXPIRED`. Every terminal outcome releases the arbiter, clears the ESP owner, returns the ESP to `IDLE`, and deletes or releases the temporary MP3.

### 8.3 Delivery lifecycle

The allowed lifecycle is:

- Reservation failure: delivery `PENDING → MISSED`.
- Reservation success: delivery `PENDING → DELIVERING`; create attempt `PENDING`.
- Local rejection after backend reservation: delivery `DELIVERING → MISSED`; attempt becomes terminal `MISSED`.
- Ready send: attempt `PENDING → SENT`.
- Valid done: attempt `SENT → PLAYED`; delivery `DELIVERING → DELIVERED`.
- Valid playback failure, or post-accept TTS/URL/WebSocket failure: nonterminal attempt `→ FAILED`; delivery `DELIVERING → FAILED`.
- Offer, lease, or audio deadline: nonterminal attempt, when present, `→ EXPIRED`; nonterminal delivery `→ EXPIRED`.

No transition leaves a terminal state. Cleanup is idempotent and runs for `MISSED`, `PLAYED`/`DELIVERED`, `FAILED`, and `EXPIRED`.

## 9. ACK authentication, correlation, and idempotency

Accepted, done, and failed ACKs are processed only when all of these conditions hold:

1. The event arrived on the currently authenticated device connection.
2. `delivery.deviceId` equals the authenticated sender device ID.
3. `device_id`, `delivery_id`, `attempt_id`, active lease generation when present, and the phase receipt exactly match the current reservation and attempt.
4. The requested transition is legal from the current delivery and attempt states.

`offer_receipt` is required for accepted/rejected ACKs. `lease_id` and `audio_receipt` are required for done/failed ACKs. Receipts are opaque, unguessable per-send values and are never reused across an attempt or reconnect.

An exact duplicate of an already-applied ACK is idempotently acknowledged without a second transition or side effect. A late ACK cannot close or release a newer reservation. Done after `FAILED`, `MISSED`, or `EXPIRED` is ignored. Failed after `DELIVERED` is ignored. ACKs from a different authenticated device, a stale connection, a superseded attempt, an expired lease, or the wrong receipt are rejected and produce no state change.

## 10. Observability and calibration data

Each interaction emits correlated stage timestamps for:

- wake eligibility and wake detection,
- voice reserve send, acceptance/rejection, response timeout, lease/cancel/expiry, and atomic HTTP promotion,
- beep start/end,
- RX drain start/end and selected settle duration,
- capture arm, speech start, and capture end with terminal reason,
- WAV finalization and upload,
- `display_status`, `audio_ready`, download start/progress, first decoded MP3 frame, first successful speaker PCM, playback terminal, and return to `IDLE`,
- schedule claim, Hermes generation/repair, assistant-message persistence, mobile event emission, device reservation, offer, acceptance/rejection, TTS, ready, and physical terminal outcome.

During mic operation, emit one aggregate record per second containing full frames, I2S timeouts, partial frames, peak, RMS, clipping count, WakeNet eligibility, WakeNet detect-call count, WakeNet detections, active VAD start/end thresholds, and VAD classification counts. Correlate records with device and request or delivery IDs where applicable. Never log, upload, or retain raw audio as observability data.

The answer-start SLO is computed from recording-finalized monotonic time to first successful speaker-PCM monotonic time. Playback stall duration is computed only from the three atomic progress counters. Schedule metrics keep mobile persistence outcome separate from optional physical outcome.

## 11. Failure and test matrix

| Scenario | Required assertion |
|---|---|
| Voice reservation accepted | Authenticated eligible wake creates one UUIDv4 `request_id`, one exact 45-second backend capture lease, and one local owner; beep/capture begins only after the matching acceptance. |
| Voice reservation rejected or offline | Send failure, disconnect, 5-second response timeout, or matching rejection produces no beep, capture, upload, or `RequestStore`; local state returns to `IDLE`. |
| Voice reservation duplicate/stale response | Duplicate reserve returns the original tuple and expiry without refresh; duplicate acceptance causes no second beep; late or mismatched responses cannot acquire or release a current owner. |
| Voice reservation cancel/expiry | Exact pre-promotion cancel and 45-second expiry release both sides idempotently; stale cancel/expiry cannot release `VOICE_PROCESSING` or a newer owner. |
| HTTP voice promotion | Exact authenticated `request_id + lease_id + reserve_receipt` atomically promotes to same-ID `RequestStore` processing without an arbiter gap; missing, foreign, cancelled, or expired reservation is rejected. |
| No speech | At 5.000 seconds after capture arm, terminal `NO_SPEECH`; exact `voice_cancel`; no WAV upload; reservation released; ESP `IDLE`. |
| Maximum capture | Speech recording finalizes no later than 15.000 seconds after confirmed speech start with valid canonical WAV. |
| Trailing silence | After speech, 1.500 seconds continuous end-classified silence finalizes at the next complete frame; shorter gaps do not. |
| Invalid WAV | Backend rejects malformed header, non-PCM16/16k/mono, truncation, or incorrect data length before model processing. |
| Answer-start SLO | First successful speaker PCM is at or before 45.000 seconds from recording finalization; earlier stages do not count. |
| Playback stall | With all three progress counters fixed for 5.000 seconds, cancellation occurs and the job releases to `IDLE`; heartbeats cannot postpone it. |
| Stale recovery | Only the exact correlated normal-dialog request can replay, at most once; stale/late events are ignored and terminal state is `IDLE`. |
| Hermes generation | Every schedule invokes Hermes; only a final 2–10-word result passes; at most one repair generation is allowed. |
| Mobile persistence | Exactly one assistant message exists in the deterministic user's `BMO Schedule` session; realtime failure does not remove history. |
| Generation/persistence failure | `ScheduleRun=FAILED`; no physical delivery record is offered. |
| Device offline | Delivery becomes `MISSED/OFFLINE` immediately; no TTS, retry, queue, or delayed playback. |
| Device busy | Delivery becomes `MISSED/BUSY` immediately or after local atomic rejection; no TTS, retry, or delayed playback. |
| Accepted then TTS/URL/WS failure | Matching cancel is attempted, attempt and delivery become `FAILED`, MP3 is cleaned, and both leases release even if cancel is lost. |
| Lease or audio expiry | Nonterminal attempt/delivery become `EXPIRED`; ESP auto-releases to `IDLE`; temporary MP3 is removed. |
| Successful physical delivery | Attempt progresses `PENDING → SENT → PLAYED`; delivery progresses `PENDING → DELIVERING → DELIVERED`; schedule run remains `SUCCEEDED`. |
| Download/decode/playback failure | Exact strict reason is reported; attempt and delivery become `FAILED`; no replay occurs. |
| Duplicate ACK | Exact duplicate is idempotent and produces no repeated transition, notification, cleanup failure, or playback. |
| Foreign or late ACK | Wrong device/correlation/receipt/state is ignored or rejected and cannot release the active reservation. |
| Wake calibration | At least 8/10 detections at 15–20 cm while proven eligible, and at most one false wake in 10 minutes. |

## 12. Rollout gates

Rollout advances only through these gates in order:

1. Unit and protocol-contract coverage for voice reserve schemas, lease/timeout/cancel rules, upload promotion, timers, hysteresis, WAV validation, arbiter transitions, lifecycle transitions, receipts, idempotency, and cleanup.
2. Fake-ESP end-to-end coverage for WebSocket voice reservation, HTTP same-ID promotion, reserve rejection/expiry/stale events, stalled playback, reconnect recovery, schedule offer/accept/ready/terminal flows, and forged or late ACKs.
3. Hardware mic and WakeNet calibration with once-per-second aggregate evidence and valid explicit eligibility.
4. Hardware dialog end-to-end runs proving authenticated pre-capture reservation, two-stage capture, same-ID canonical upload promotion, answer-start SLO, watchdog recovery, and return to `IDLE` on every terminal path.
5. Hardware schedule runs for online-idle success, offline, busy, offer/lease expiry, accepted-then-failed preparation, duplicate ACK, and foreign ACK.
6. VPS canary proving deterministic session persistence, existing mobile realtime emission, public audio URL shape and length, arbitration under concurrent voice/schedule requests, and terminal cleanup.
7. Flash the same hashed firmware artifact that passed the hardware gates; record the hash with the rollout evidence.

A gate fails on an unexplained state transition, missing terminal cleanup, uncategorized timeout, correlation mismatch, invalid schedule word count, or inability to prove the exact timing definition from logs.

## 13. Implementation decomposition

The design is one integration program with five contract-aligned slices:

1. **ESP playback safety and observability:** atomic progress counters, coordinator cancellation, stale recovery correlation, aggregate mic metrics, and terminal `IDLE` guarantees.
2. **Two-stage voice capture:** UUIDv4 local ownership, authenticated WebSocket reserve/lease/cancel handling, same-ID HTTP promotion, beep/drain/settle sequence, frame-boundary reset, calibrated VAD hysteresis, bounded capture, and canonical WAV.
3. **Schedule result and mobile path:** `ScheduledResultService`, Hermes validation and one repair, deterministic `BMO Schedule` session, exactly-once assistant persistence, and existing realtime events.
4. **Shared arbitration and protocol:** PostgreSQL device lock, pre-capture reservation state, atomic `RequestStore` promotion, delivery/attempt state machine, receipts, leases, and authenticated ACK rules.
5. **One-shot physical port and ESP proactive playback:** offer/accept, post-accept TTS and public URL, shared streaming playback, terminal ACKs, expiry, and artifact cleanup.

The message schemas, timer origins, state transitions, correlation fields, and acceptance gates in this document are fixed interfaces between slices. Integration proceeds in that order so later wake calibration is not contaminated by the confirmed playback starvation defect.

## 14. Non-goals

- Display animation, new display modes, or changes to existing static display visuals.
- Native FCM or APNs push delivery.
- A broad proactive-delivery framework, delayed physical queue, or physical retry.
- Coupling schedule execution to `ChatService`.
- Changing the deployed 3,145,728-byte/60-second canonical voice-input guard, the 600-character/three-sentence normal TTS policy, or the ESP 32 KiB/4 KiB streaming layout solely to enforce schedule brevity.
- Treating `SILENCE_THRESHOLD=800`, phrase-time level, SNR, or WakeNet sensitivity as a confirmed fix before valid calibration.
- Recreating I2S during every capture.
- Logging or retaining raw microphone audio for telemetry.
- Replaying proactive schedule audio after any physical failure, reconnect, busy state, or expiry.
