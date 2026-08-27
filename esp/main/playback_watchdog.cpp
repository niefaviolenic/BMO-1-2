#include "playback_watchdog.h"

bool playback_watchdog_latch_stalled(PlaybackJobControl* control,
                                     PlaybackWatchdogSnapshot* snapshot,
                                     int64_t now_us)
{
    if (control == nullptr || snapshot == nullptr) {
        return false;
    }

    const uint64_t http = control->http_bytes_received.load(std::memory_order_acquire);
    const uint64_t mp3 = control->mp3_frames_decoded.load(std::memory_order_acquire);
    const uint64_t pcm = control->pcm_frames_written.load(std::memory_order_acquire);

    const bool increased = (http > snapshot->http_bytes_received)
        || (mp3 > snapshot->mp3_frames_decoded)
        || (pcm > snapshot->pcm_frames_written);

    if (increased) {
        snapshot->http_bytes_received = http;
        snapshot->mp3_frames_decoded = mp3;
        snapshot->pcm_frames_written = pcm;
        snapshot->last_counter_increase_us = now_us;
        return false;
    }

    if (now_us - snapshot->last_counter_increase_us < kPlaybackStallUs) {
        return false;
    }

    PlaybackTerminalReason expected = PlaybackTerminalReason::NONE;
    if (!control->requested_terminal_reason.compare_exchange_strong(
            expected, PlaybackTerminalReason::STALLED,
            std::memory_order_acq_rel)) {
        return false;
    }

    control->cancel_requested.store(true, std::memory_order_release);
    return true;
}
