#ifndef PAIRING_H
#define PAIRING_H

#include <cstdint>
#include <ctime>

enum class PairingPhase : uint8_t
{
    NONE,
    CODE_ACTIVE,
    CODE_EXPIRED,
    RECOVERY_WAIT,
    RECOVERY_SENT,
    RECONNECT_PENDING
};

enum PairingAction : uint8_t
{
    PAIRING_ACTION_NONE = 0,
    PAIRING_ACTION_SHOW_UI = 1U << 0,
    PAIRING_ACTION_CLEAR_UI = 1U << 1,
    PAIRING_ACTION_SEND_REQUEST = 1U << 2,
    PAIRING_ACTION_RECONNECT = 1U << 3,
};

struct PairingSnapshot
{
    PairingPhase phase;
    char code[7];
    time_t expires_at_epoch;
    int64_t last_request_ms;
    int64_t recovery_due_ms;
    uint32_t socket_generation;
    bool pairing_seen_in_boot;
    bool incomplete_before_disconnect;
    bool request_sent_this_reason;
};

void pairing_init();
uint32_t pairing_on_socket_connected();
void pairing_on_authenticated(int64_t monotonic_ms);
void pairing_on_disconnected();
bool pairing_on_code(const char *code, const char *expires_at, time_t now_epoch);
void pairing_on_completed();
uint8_t pairing_poll(time_t now_epoch, int64_t monotonic_ms);
PairingSnapshot pairing_get_snapshot();

#endif
