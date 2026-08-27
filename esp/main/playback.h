#ifndef PLAYBACK_H
#define PLAYBACK_H

#include <cstddef>
#include <cstdint>

constexpr std::size_t PLAYBACK_CORRELATION_ID_MAX = 37;
constexpr std::size_t PLAYBACK_AUDIO_URL_MAX = 256;
constexpr std::size_t PLAYBACK_SOURCE_MAX = 16;

enum class PlaybackOrigin : uint8_t
{
    VOICE_RESPONSE,
    PROACTIVE,
};

enum class PlaybackLocalState : uint8_t
{
    IDLE,
    RECORDING,
    UPLOADING,
    THINKING,
    DOWNLOADING,
    SPEAKING,
    VOICE_RESULT_PENDING,
};

enum class PlaybackAdmission : uint8_t
{
    ACCEPTED,
    INVALID,
    BUSY,
    DUPLICATE,
    EXPIRED,
};

enum class PlaybackTerminalResult : uint8_t
{
    NONE,
    DONE,
    FAILED,
    EXPIRED,
    CANCELLED,
};

struct PlaybackJob
{
    PlaybackOrigin origin;
    char correlation_id[PLAYBACK_CORRELATION_ID_MAX];
    char audio_url[PLAYBACK_AUDIO_URL_MAX];
    uint32_t expires_in_seconds;
    char source[PLAYBACK_SOURCE_MAX];
};

struct PlaybackSnapshot
{
    bool active;
    PlaybackJob current_job;
    char current_proactive_delivery_id[PLAYBACK_CORRELATION_ID_MAX];
    char last_terminal_proactive_delivery_id[PLAYBACK_CORRELATION_ID_MAX];
    PlaybackTerminalResult last_terminal_proactive_result;
    int64_t deadline_monotonic_ms;
};
constexpr int64_t kProactiveLeaseUs = 45000000LL;
constexpr size_t kUuidBufferSize = 37;
constexpr size_t kReceiptBufferSize = 513;
constexpr size_t kAudioUrlBufferSize = 256;

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

bool playback_prepare_proactive_offer(const ProactiveOffer& offer,
                                      int64_t now_us,
                                      ProactiveRejectReason* rejection);
bool playback_start_proactive_ready(const ProactiveAudioReady& ready,
                                   int64_t now_us);
void playback_cancel_proactive(const ProactiveCancel& cancel,
                               int64_t now_us);

void playback_init();

bool playback_url_is_valid(const char *url);

PlaybackAdmission playback_admit_voice_job(
    const PlaybackJob *job,
    int64_t monotonic_ms);

// Future Backend proactive delivery adapter. This is intentionally not wired
// to a WebSocket event until the Backend defines that event contract.
PlaybackAdmission playback_prepare_proactive(
    const PlaybackJob *job,
    PlaybackLocalState local_state,
    int64_t monotonic_ms);

bool playback_is_expired(int64_t monotonic_ms);

bool playback_get_current_job(PlaybackJob *job);

void playback_mark_started();
void playback_mark_terminal(PlaybackTerminalResult result);
void playback_cancel();

PlaybackSnapshot playback_get_snapshot();

#endif
