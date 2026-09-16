#ifndef SPOTIFY_CONTROLLER_H
#define SPOTIFY_CONTROLLER_H

#include <cstdint>
#include <cstddef>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

enum class SpotifyActionType : uint8_t {
    NONE = 0,
    NEXT,
    PREVIOUS
};

struct SpotifyActionEntry {
    char action_id[37];
    SpotifyActionType action;
    int64_t created_at_us;
};

class SpotifyController {
public:
    static constexpr size_t QUEUE_CAPACITY = 4;
    static constexpr int64_t ACTION_TTL_US = 10000000LL; // 10 seconds

    SpotifyController();
    void reset();

    bool queue_action(SpotifyActionType action, int64_t now_us, bool is_authenticated);

    bool get_action_to_send(
        char *out_action_id,
        size_t id_len,
        SpotifyActionType *out_action,
        int64_t now_us);

    void on_action_result(const char *action_id, bool succeeded, const char *error_code);
    void on_disconnected();

    size_t get_queue_count() const;
    bool has_in_flight() const;

private:
    SpotifyActionEntry m_queue[QUEUE_CAPACITY];
    size_t m_queue_count = 0;
    bool m_in_flight = false;
    char m_in_flight_id[37] = {0};
    int64_t m_in_flight_sent_us = 0;

    void pop_first();
};

#ifdef __cplusplus
}
#endif

#endif // SPOTIFY_CONTROLLER_H
