#ifndef PLAYBACK_WATCHDOG_H
#define PLAYBACK_WATCHDOG_H

#include <atomic>
#include <cstdint>

enum class PlaybackTerminalReason : uint8_t {
    NONE,
    CANCELLED,
    STALLED,
};

struct PlaybackJobControl {
    std::atomic<bool> cancel_requested{false};
    std::atomic<PlaybackTerminalReason> requested_terminal_reason{PlaybackTerminalReason::NONE};
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

constexpr int64_t kPlaybackStallUs = 5000000LL;

bool playback_watchdog_latch_stalled(PlaybackJobControl* control,
                                     PlaybackWatchdogSnapshot* snapshot,
                                     int64_t now_us);

#endif // PLAYBACK_WATCHDOG_H
