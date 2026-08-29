#include "playback.h"

#include <cstring>
#include <limits>

#include "freertos/FreeRTOS.h"

namespace
{
constexpr char kAudioUrlPrefix[] = "https://api.personalbmo.web.id/audio/";

struct PlaybackState
{
    bool active = false;
    PlaybackJob current_job{};
    char current_proactive_delivery_id[PLAYBACK_CORRELATION_ID_MAX] = {};
    char last_terminal_proactive_delivery_id[PLAYBACK_CORRELATION_ID_MAX] = {};
    PlaybackTerminalResult last_terminal_proactive_result = PlaybackTerminalResult::NONE;
    int64_t deadline_monotonic_ms = 0;
};

PlaybackState s_state;
portMUX_TYPE s_playback_lock = portMUX_INITIALIZER_UNLOCKED;

class PlaybackLock
{
public:
    PlaybackLock()
    {
        portENTER_CRITICAL(&s_playback_lock);
    }

    ~PlaybackLock()
    {
        portEXIT_CRITICAL(&s_playback_lock);
    }

    PlaybackLock(const PlaybackLock &) = delete;
    PlaybackLock &operator=(const PlaybackLock &) = delete;
};

void clear_job(PlaybackJob *job)
{
    if (job == nullptr)
    {
        return;
    }
    std::memset(job, 0, sizeof(*job));
}

bool bounded_string_is_present(const char *value, std::size_t capacity)
{
    if (value == nullptr || value[0] == '\0')
    {
        return false;
    }
    for (std::size_t index = 0; index < capacity; ++index)
    {
        if (value[index] == '\0')
        {
            return true;
        }
    }
    return false;
}

bool bounded_string_is_valid(const char *value, std::size_t capacity)
{
    if (value == nullptr)
    {
        return false;
    }
    for (std::size_t index = 0; index < capacity; ++index)
    {
        if (value[index] == '\0')
        {
            return true;
        }
    }
    return false;
}

bool job_is_valid(const PlaybackJob *job)
{
    return job != nullptr &&
           (job->origin == PlaybackOrigin::VOICE_RESPONSE ||
            job->origin == PlaybackOrigin::PROACTIVE) &&
           bounded_string_is_present(job->correlation_id, PLAYBACK_CORRELATION_ID_MAX) &&
           bounded_string_is_present(job->audio_url, PLAYBACK_AUDIO_URL_MAX) &&
           playback_url_is_valid(job->audio_url) &&
           job->expires_in_seconds > 0 &&
           bounded_string_is_valid(job->source, PLAYBACK_SOURCE_MAX);
}

int64_t deadline_from_now(uint32_t expires_in_seconds, int64_t monotonic_ms)
{
    const int64_t ttl_ms = static_cast<int64_t>(expires_in_seconds) * 1000LL;
    if (monotonic_ms > std::numeric_limits<int64_t>::max() - ttl_ms)
    {
        return std::numeric_limits<int64_t>::max();
    }
    return monotonic_ms + ttl_ms;
}

bool proactive_state_blocks(PlaybackLocalState local_state)
{
    return local_state == PlaybackLocalState::RECORDING ||
           local_state == PlaybackLocalState::UPLOADING ||
           local_state == PlaybackLocalState::THINKING ||
           local_state == PlaybackLocalState::DOWNLOADING ||
           local_state == PlaybackLocalState::SPEAKING ||
           local_state == PlaybackLocalState::VOICE_RESULT_PENDING;
}

bool is_same_proactive_id(const char *delivery_id, const char *stored_id)
{
    return delivery_id != nullptr && stored_id[0] != '\0' &&
           std::strcmp(delivery_id, stored_id) == 0;
}

} // namespace

void playback_init()
{
    PlaybackLock lock;
    s_state = PlaybackState{};
}

bool playback_url_is_valid(const char *url)
{
    return url != nullptr &&
           std::strncmp(url, kAudioUrlPrefix, sizeof(kAudioUrlPrefix) - 1) == 0;
}

PlaybackAdmission playback_admit_voice_job(
    const PlaybackJob *job,
    int64_t monotonic_ms)
{
    if (!job_is_valid(job) || job->origin != PlaybackOrigin::VOICE_RESPONSE)
    {
        return PlaybackAdmission::INVALID;
    }

    PlaybackLock lock;
    if (s_state.active)
    {
        return PlaybackAdmission::BUSY;
    }

    s_state.current_job = *job;
    s_state.active = true;
    s_state.deadline_monotonic_ms = deadline_from_now(job->expires_in_seconds, monotonic_ms);
    return PlaybackAdmission::ACCEPTED;
}

PlaybackAdmission playback_prepare_proactive(
    const PlaybackJob *job,
    PlaybackLocalState local_state,
    int64_t monotonic_ms)
{
    if (job == nullptr || job->origin != PlaybackOrigin::PROACTIVE)
    {
        return PlaybackAdmission::INVALID;
    }
    if (job->expires_in_seconds == 0)
    {
        return PlaybackAdmission::EXPIRED;
    }
    if (!job_is_valid(job))
    {
        return PlaybackAdmission::INVALID;
    }
    if (proactive_state_blocks(local_state))
    {
        return PlaybackAdmission::BUSY;
    }

    PlaybackLock lock;
    if (s_state.active ||
        is_same_proactive_id(job->correlation_id, s_state.current_proactive_delivery_id) ||
        is_same_proactive_id(job->correlation_id, s_state.last_terminal_proactive_delivery_id))
    {
        return s_state.active &&
                   is_same_proactive_id(job->correlation_id, s_state.current_proactive_delivery_id)
               ? PlaybackAdmission::DUPLICATE
               : (s_state.active ? PlaybackAdmission::BUSY : PlaybackAdmission::DUPLICATE);
    }

    s_state.current_job = *job;
    s_state.active = true;
    std::strncpy(
        s_state.current_proactive_delivery_id,
        job->correlation_id,
        sizeof(s_state.current_proactive_delivery_id) - 1);
    s_state.current_proactive_delivery_id[sizeof(s_state.current_proactive_delivery_id) - 1] = '\0';
    s_state.deadline_monotonic_ms = deadline_from_now(job->expires_in_seconds, monotonic_ms);

    if (s_state.deadline_monotonic_ms <= monotonic_ms)
    {
        clear_job(&s_state.current_job);
        s_state.active = false;
        s_state.current_proactive_delivery_id[0] = '\0';
        s_state.deadline_monotonic_ms = 0;
        return PlaybackAdmission::EXPIRED;
    }
    return PlaybackAdmission::ACCEPTED;
}

bool playback_is_expired(int64_t monotonic_ms)
{
    PlaybackLock lock;
    return !s_state.active || s_state.deadline_monotonic_ms == 0 ||
           monotonic_ms >= s_state.deadline_monotonic_ms;
}

bool playback_get_current_job(PlaybackJob *job)
{
    if (job == nullptr)
    {
        return false;
    }

    PlaybackLock lock;
    if (!s_state.active)
    {
        clear_job(job);
        return false;
    }
    *job = s_state.current_job;
    return true;
}

void playback_mark_started()
{
    // Ownership is acquired at admission and remains held through the one
    // physical downloader/decoder/I2S path.
}

void playback_mark_terminal(PlaybackTerminalResult result)
{
    PlaybackLock lock;
    if (!s_state.active)
    {
        return;
    }

    if (s_state.current_job.origin == PlaybackOrigin::PROACTIVE)
    {
        std::strncpy(
            s_state.last_terminal_proactive_delivery_id,
            s_state.current_proactive_delivery_id,
            sizeof(s_state.last_terminal_proactive_delivery_id) - 1);
        s_state.last_terminal_proactive_delivery_id[
            sizeof(s_state.last_terminal_proactive_delivery_id) - 1] = '\0';
        s_state.last_terminal_proactive_result = result;
    }

    clear_job(&s_state.current_job);
    s_state.active = false;
    s_state.current_proactive_delivery_id[0] = '\0';
    s_state.deadline_monotonic_ms = 0;
}

void playback_cancel()
{
    playback_mark_terminal(PlaybackTerminalResult::CANCELLED);
}

PlaybackSnapshot playback_get_snapshot()
{
    PlaybackSnapshot snapshot{};
    PlaybackLock lock;
    snapshot.active = s_state.active;
    snapshot.current_job = s_state.current_job;
    std::strncpy(
        snapshot.current_proactive_delivery_id,
        s_state.current_proactive_delivery_id,
        sizeof(snapshot.current_proactive_delivery_id) - 1);
    std::strncpy(
        snapshot.last_terminal_proactive_delivery_id,
        s_state.last_terminal_proactive_delivery_id,
        sizeof(snapshot.last_terminal_proactive_delivery_id) - 1);
    snapshot.last_terminal_proactive_result = s_state.last_terminal_proactive_result;
    snapshot.deadline_monotonic_ms = s_state.deadline_monotonic_ms;
    return snapshot;
}

static ProactiveOffer s_active_offer{};
static bool s_has_active_offer = false;
static int64_t s_offer_deadline_us = 0;

bool playback_prepare_proactive_offer(const ProactiveOffer& offer,
                                      int64_t now_us,
                                      ProactiveRejectReason* rejection)
{
    PlaybackLock lock;
    if (s_state.active) {
        if (rejection) *rejection = ProactiveRejectReason::BUSY;
        return false;
    }

    if (std::strlen(offer.delivery_id) == 0 || std::strlen(offer.attempt_id) == 0 || std::strlen(offer.offer_receipt) == 0) {
        if (rejection) *rejection = ProactiveRejectReason::INVALID;
        return false;
    }

    s_active_offer = offer;
    s_has_active_offer = true;
    s_offer_deadline_us = now_us + kProactiveLeaseUs;
    return true;
}

bool playback_start_proactive_ready(const ProactiveAudioReady& ready,
                                   int64_t now_us)
{
    PlaybackLock lock;
    if (!s_has_active_offer) {
        return false;
    }
    if (now_us > s_offer_deadline_us) {
        s_has_active_offer = false;
        return false;
    }
    if (std::strcmp(s_active_offer.delivery_id, ready.delivery_id) != 0 ||
        std::strcmp(s_active_offer.attempt_id, ready.attempt_id) != 0) {
        return false;
    }

    PlaybackJob job{};
    job.origin = PlaybackOrigin::PROACTIVE;
    std::strncpy(job.correlation_id, ready.delivery_id, sizeof(job.correlation_id) - 1);
    std::strncpy(job.audio_url, ready.audio_url, sizeof(job.audio_url) - 1);
    job.expires_in_seconds = 45;
    std::strncpy(job.source, "SCHEDULE", sizeof(job.source) - 1);

    s_state.current_job = job;
    s_state.active = true;
    std::strncpy(s_state.current_proactive_delivery_id, ready.delivery_id, sizeof(s_state.current_proactive_delivery_id) - 1);
    s_state.deadline_monotonic_ms = (now_us / 1000LL) + 45000LL;
    s_has_active_offer = false;
    return true;
}

void playback_cancel_proactive(const ProactiveCancel& cancel,
                               int64_t now_us)
{
    PlaybackLock lock;
    if (s_has_active_offer &&
        std::strcmp(s_active_offer.delivery_id, cancel.delivery_id) == 0 &&
        std::strcmp(s_active_offer.attempt_id, cancel.attempt_id) == 0) {
        s_has_active_offer = false;
    }
    if (s_state.active &&
        std::strcmp(s_state.current_proactive_delivery_id, cancel.delivery_id) == 0) {
        playback_cancel();
    }
}
