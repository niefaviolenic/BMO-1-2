#include "spotify_controller.h"
#include <cstdio>
#include <cstring>

SpotifyController::SpotifyController()
{
    reset();
}

void SpotifyController::reset()
{
    m_queue_count = 0;
    m_in_flight = false;
    m_in_flight_id[0] = '\0';
    m_in_flight_sent_us = 0;
}

void SpotifyController::pop_first()
{
    if (m_queue_count == 0) return;
    for (size_t i = 1; i < m_queue_count; ++i) {
        m_queue[i - 1] = m_queue[i];
    }
    m_queue_count--;
}

static void make_uuid_v4(char *out_uuid, size_t max_len, uint32_t seed)
{
    // Generate deterministic standard UUID v4 format
    uint32_t r1 = seed ^ 0x12345678;
    uint32_t r2 = (seed * 1103515245U + 12345U);
    uint32_t r3 = (r2 * 1103515245U + 12345U);
    uint32_t r4 = (r3 * 1103515245U + 12345U);

    snprintf(out_uuid, max_len,
             "%08x-%04x-4%03x-%04x-%04x%08x",
             (unsigned int)r1,
             (unsigned int)((r2 >> 16) & 0xFFFF),
             (unsigned int)(r2 & 0x0FFF),
             (unsigned int)(0x8000 | ((r3 >> 16) & 0x3FFF)),
             (unsigned int)(r3 & 0xFFFF),
             (unsigned int)r4);
}

bool SpotifyController::queue_action(SpotifyActionType action, int64_t now_us, bool is_authenticated)
{
    if (!is_authenticated || action == SpotifyActionType::NONE) {
        return false;
    }

    if (m_queue_count >= QUEUE_CAPACITY) {
        return false;
    }

    static uint32_t s_action_counter = 0;
    s_action_counter++;
    uint32_t seed = (uint32_t)(now_us & 0xFFFFFFFF) ^ s_action_counter;

    SpotifyActionEntry entry{};
    make_uuid_v4(entry.action_id, sizeof(entry.action_id), seed);
    entry.action = action;
    entry.created_at_us = now_us;

    m_queue[m_queue_count++] = entry;
    return true;
}

bool SpotifyController::get_action_to_send(
    char *out_action_id,
    size_t id_len,
    SpotifyActionType *out_action,
    int64_t now_us)
{
    if (m_in_flight) {
        if (now_us - m_in_flight_sent_us > ACTION_TTL_US) {
            m_in_flight = false;
            m_in_flight_id[0] = '\0';
        } else {
            return false;
        }
    }

    while (m_queue_count > 0 && (now_us - m_queue[0].created_at_us > ACTION_TTL_US)) {
        pop_first();
    }

    if (m_queue_count == 0) {
        return false;
    }

    SpotifyActionEntry next_action = m_queue[0];
    pop_first();

    if (out_action_id && id_len > 0) {
        strncpy(out_action_id, next_action.action_id, id_len - 1);
        out_action_id[id_len - 1] = '\0';
    }
    if (out_action) {
        *out_action = next_action.action;
    }

    m_in_flight = true;
    strncpy(m_in_flight_id, next_action.action_id, sizeof(m_in_flight_id) - 1);
    m_in_flight_id[sizeof(m_in_flight_id) - 1] = '\0';
    m_in_flight_sent_us = now_us;

    return true;
}

void SpotifyController::on_action_result(const char *action_id, bool succeeded, const char *error_code)
{
    if (m_in_flight && action_id && strcmp(m_in_flight_id, action_id) == 0) {
        m_in_flight = false;
        m_in_flight_id[0] = '\0';
    }
}

void SpotifyController::on_disconnected()
{
    reset();
}

size_t SpotifyController::get_queue_count() const
{
    return m_queue_count;
}

bool SpotifyController::has_in_flight() const
{
    return m_in_flight;
}
