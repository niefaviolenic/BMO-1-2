#include "pairing.h"

#include <cstring>
#include <limits>

#include "freertos/FreeRTOS.h"

namespace
{
// Firmware scheduling policy; these are not Backend protocol requirements.
constexpr int64_t kRecoveryGraceMs = 2000;
constexpr int64_t kRequestDebounceMs = 5000;

struct PairingController
{
    PairingSnapshot snapshot{};
    uint8_t pending_actions = PAIRING_ACTION_NONE;
    bool authenticated = false;
    bool request_pending = false;
    bool request_is_recovery = false;
};

PairingController s_controller;
portMUX_TYPE s_pairing_lock = portMUX_INITIALIZER_UNLOCKED;

class PairingLock
{
public:
    PairingLock()
    {
        portENTER_CRITICAL(&s_pairing_lock);
    }

    ~PairingLock()
    {
        portEXIT_CRITICAL(&s_pairing_lock);
    }

    PairingLock(const PairingLock &) = delete;
    PairingLock &operator=(const PairingLock &) = delete;
};

bool is_ascii_digit(char value)
{
    return value >= '0' && value <= '9';
}

bool is_six_digit_code(const char *code)
{
    if (code == nullptr || std::strlen(code) != 6)
    {
        return false;
    }

    for (size_t index = 0; index < 6; ++index)
    {
        if (!is_ascii_digit(code[index]))
        {
            return false;
        }
    }
    return true;
}

bool is_leap_year(int year)
{
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

int days_in_month(int year, int month)
{
    static constexpr int kDaysByMonth[] = {
        0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    };
    if (month < 1 || month > 12)
    {
        return 0;
    }
    if (month == 2 && is_leap_year(year))
    {
        return 29;
    }
    return kDaysByMonth[month];
}

bool parse_digits(const char *text, size_t start, size_t count, int *value)
{
    int parsed = 0;
    for (size_t index = 0; index < count; ++index)
    {
        const char digit = text[start + index];
        if (!is_ascii_digit(digit))
        {
            return false;
        }
        parsed = parsed * 10 + (digit - '0');
    }
    *value = parsed;
    return true;
}

int64_t days_from_civil(int year, unsigned month, unsigned day)
{
    year -= month <= 2;
    const int era = (year >= 0 ? year : year - 399) / 400;
    const unsigned year_of_era = static_cast<unsigned>(year - era * 400);
    const unsigned shifted_month = month > 2 ? month - 3U : month + 9U;
    const unsigned day_of_year = (153U * shifted_month + 2U) / 5U + day - 1U;
    const unsigned day_of_era =
        year_of_era * 365U + year_of_era / 4U - year_of_era / 100U + day_of_year;
    return static_cast<int64_t>(era) * 146097 + static_cast<int64_t>(day_of_era) - 719468;
}

bool parse_rfc3339_utc(const char *text, time_t *epoch_out)
{
    if (text == nullptr || epoch_out == nullptr)
    {
        return false;
    }

    const size_t length = std::strlen(text);
    if (length < 20 || length > 35 || text[4] != '-' || text[7] != '-' || text[10] != 'T' ||
        text[13] != ':' || text[16] != ':')
    {
        return false;
    }

    int year = 0;
    int month = 0;
    int day = 0;
    int hour = 0;
    int minute = 0;
    int second = 0;
    if (!parse_digits(text, 0, 4, &year) || !parse_digits(text, 5, 2, &month) ||
        !parse_digits(text, 8, 2, &day) || !parse_digits(text, 11, 2, &hour) ||
        !parse_digits(text, 14, 2, &minute) || !parse_digits(text, 17, 2, &second))
    {
        return false;
    }
    if (year < 1970 || month < 1 || month > 12 || day < 1 || day > days_in_month(year, month) ||
        hour > 23 || minute > 59 || second > 59)
    {
        return false;
    }

    size_t cursor = 19;
    if (cursor < length && text[cursor] == '.')
    {
        ++cursor;
        const size_t fraction_start = cursor;
        while (cursor < length && is_ascii_digit(text[cursor]))
        {
            ++cursor;
        }
        if (cursor == fraction_start)
        {
            return false;
        }
    }

    int offset_seconds = 0;
    if (cursor < length && text[cursor] == 'Z')
    {
        ++cursor;
    }
    else if (cursor + 6 == length && (text[cursor] == '+' || text[cursor] == '-') &&
             text[cursor + 3] == ':')
    {
        int offset_hour = 0;
        int offset_minute = 0;
        if (!parse_digits(text, cursor + 1, 2, &offset_hour) ||
            !parse_digits(text, cursor + 4, 2, &offset_minute) || offset_hour > 23 || offset_minute > 59)
        {
            return false;
        }
        offset_seconds = (offset_hour * 60 + offset_minute) * 60;
        if (text[cursor] == '-')
        {
            offset_seconds = -offset_seconds;
        }
        cursor += 6;
    }
    else
    {
        return false;
    }

    if (cursor != length)
    {
        return false;
    }

    int64_t epoch = days_from_civil(year, static_cast<unsigned>(month), static_cast<unsigned>(day)) * 86400;
    epoch += hour * 3600 + minute * 60 + second;
    epoch -= offset_seconds;
    if (epoch < static_cast<int64_t>(std::numeric_limits<time_t>::min()) ||
        epoch > static_cast<int64_t>(std::numeric_limits<time_t>::max()))
    {
        return false;
    }

    *epoch_out = static_cast<time_t>(epoch);
    return true;
}

void secure_clear_code_locked()
{
    volatile char *cursor = s_controller.snapshot.code;
    for (size_t index = 0; index < sizeof(s_controller.snapshot.code); ++index)
    {
        cursor[index] = '\0';
    }
    s_controller.snapshot.expires_at_epoch = 0;
}

void queue_action_locked(PairingAction action)
{
    s_controller.pending_actions |= static_cast<uint8_t>(action);
}

void clear_action_locked(PairingAction action)
{
    s_controller.pending_actions &= static_cast<uint8_t>(~static_cast<uint8_t>(action));
}
} // namespace

void pairing_init()
{
    PairingLock lock;
    secure_clear_code_locked();
    s_controller.snapshot.phase = PairingPhase::NONE;
    s_controller.snapshot.last_request_ms = -kRequestDebounceMs;
    s_controller.snapshot.recovery_due_ms = 0;
    s_controller.snapshot.socket_generation = 0;
    s_controller.snapshot.pairing_seen_in_boot = false;
    s_controller.snapshot.incomplete_before_disconnect = false;
    s_controller.snapshot.request_sent_this_reason = false;
    s_controller.pending_actions = PAIRING_ACTION_NONE;
    s_controller.authenticated = false;
    s_controller.request_pending = false;
    s_controller.request_is_recovery = false;
}

uint32_t pairing_on_socket_connected()
{
    PairingLock lock;
    ++s_controller.snapshot.socket_generation;
    if (s_controller.snapshot.socket_generation == 0)
    {
        s_controller.snapshot.socket_generation = 1;
    }
    s_controller.authenticated = false;
    s_controller.request_pending = false;
    s_controller.request_is_recovery = false;
    s_controller.snapshot.request_sent_this_reason = false;
    s_controller.snapshot.recovery_due_ms = 0;
    clear_action_locked(PAIRING_ACTION_SEND_REQUEST);

    if (s_controller.snapshot.phase == PairingPhase::RECONNECT_PENDING)
    {
        s_controller.snapshot.phase = PairingPhase::NONE;
        s_controller.snapshot.incomplete_before_disconnect = false;
        clear_action_locked(PAIRING_ACTION_RECONNECT);
    }
    return s_controller.snapshot.socket_generation;
}

void pairing_on_authenticated(int64_t monotonic_ms)
{
    PairingLock lock;
    s_controller.authenticated = true;
    if (!s_controller.snapshot.incomplete_before_disconnect)
    {
        return;
    }

    s_controller.snapshot.phase = PairingPhase::RECOVERY_WAIT;
    s_controller.snapshot.recovery_due_ms = monotonic_ms + kRecoveryGraceMs;
    s_controller.snapshot.request_sent_this_reason = false;
    s_controller.request_pending = false;
    s_controller.request_is_recovery = true;
}

void pairing_on_disconnected()
{
    PairingLock lock;
    s_controller.authenticated = false;
    clear_action_locked(PAIRING_ACTION_SEND_REQUEST);
    s_controller.request_pending = false;

    switch (s_controller.snapshot.phase)
    {
    case PairingPhase::CODE_ACTIVE:
    case PairingPhase::CODE_EXPIRED:
    case PairingPhase::RECOVERY_WAIT:
    case PairingPhase::RECOVERY_SENT:
        s_controller.snapshot.incomplete_before_disconnect = true;
        break;
    case PairingPhase::NONE:
    case PairingPhase::RECONNECT_PENDING:
        break;
    }
}

bool pairing_on_code(const char *code, const char *expires_at, time_t now_epoch)
{
    time_t expires_at_epoch = 0;
    if (!is_six_digit_code(code) || !parse_rfc3339_utc(expires_at, &expires_at_epoch) ||
        expires_at_epoch <= now_epoch)
    {
        return false;
    }

    PairingLock lock;
    if (s_controller.snapshot.phase == PairingPhase::RECONNECT_PENDING)
    {
        return false;
    }
    if (s_controller.snapshot.phase == PairingPhase::CODE_ACTIVE &&
        s_controller.snapshot.expires_at_epoch == expires_at_epoch &&
        std::memcmp(s_controller.snapshot.code, code, 7) == 0)
    {
        return true;
    }

    secure_clear_code_locked();
    std::memcpy(s_controller.snapshot.code, code, 6);
    s_controller.snapshot.code[6] = '\0';
    s_controller.snapshot.expires_at_epoch = expires_at_epoch;
    s_controller.snapshot.phase = PairingPhase::CODE_ACTIVE;
    s_controller.snapshot.recovery_due_ms = 0;
    s_controller.snapshot.pairing_seen_in_boot = true;
    s_controller.snapshot.incomplete_before_disconnect = true;
    s_controller.snapshot.request_sent_this_reason = false;
    s_controller.request_pending = false;
    s_controller.request_is_recovery = false;
    clear_action_locked(PAIRING_ACTION_CLEAR_UI);
    clear_action_locked(PAIRING_ACTION_SEND_REQUEST);
    clear_action_locked(PAIRING_ACTION_RECONNECT);
    queue_action_locked(PAIRING_ACTION_SHOW_UI);
    return true;
}

void pairing_on_completed()
{
    PairingLock lock;
    if (s_controller.snapshot.phase == PairingPhase::NONE ||
        s_controller.snapshot.phase == PairingPhase::RECONNECT_PENDING)
    {
        return;
    }

    const bool completion_is_recovery = s_controller.snapshot.phase == PairingPhase::RECOVERY_SENT;
    secure_clear_code_locked();
    s_controller.snapshot.recovery_due_ms = 0;
    s_controller.snapshot.incomplete_before_disconnect = false;
    s_controller.snapshot.request_sent_this_reason = false;
    s_controller.request_pending = false;
    s_controller.request_is_recovery = false;
    clear_action_locked(PAIRING_ACTION_SHOW_UI);
    clear_action_locked(PAIRING_ACTION_SEND_REQUEST);
    queue_action_locked(PAIRING_ACTION_CLEAR_UI);

    if (completion_is_recovery)
    {
        s_controller.snapshot.phase = PairingPhase::NONE;
        clear_action_locked(PAIRING_ACTION_RECONNECT);
    }
    else
    {
        s_controller.snapshot.phase = PairingPhase::RECONNECT_PENDING;
        queue_action_locked(PAIRING_ACTION_RECONNECT);
    }
}

uint8_t pairing_poll(time_t now_epoch, int64_t monotonic_ms)
{
    PairingLock lock;

    if (s_controller.snapshot.expires_at_epoch > 0 &&
        s_controller.snapshot.expires_at_epoch <= now_epoch)
    {
        secure_clear_code_locked();
        clear_action_locked(PAIRING_ACTION_SHOW_UI);
        queue_action_locked(PAIRING_ACTION_CLEAR_UI);

        if (s_controller.snapshot.phase == PairingPhase::CODE_ACTIVE)
        {
            s_controller.snapshot.phase = PairingPhase::CODE_EXPIRED;
            s_controller.snapshot.request_sent_this_reason = false;
            if (s_controller.authenticated)
            {
                s_controller.request_pending = true;
                s_controller.request_is_recovery = false;
            }
        }
    }

    if (s_controller.snapshot.phase == PairingPhase::RECOVERY_WAIT &&
        monotonic_ms >= s_controller.snapshot.recovery_due_ms)
    {
        s_controller.request_pending = true;
        s_controller.request_is_recovery = true;
    }

    const bool debounce_elapsed =
        s_controller.snapshot.last_request_ms < 0 ||
        monotonic_ms >= s_controller.snapshot.last_request_ms + kRequestDebounceMs;
    if (s_controller.authenticated && s_controller.request_pending &&
        !s_controller.snapshot.request_sent_this_reason && debounce_elapsed)
    {
        s_controller.snapshot.last_request_ms = monotonic_ms;
        s_controller.snapshot.request_sent_this_reason = true;
        s_controller.request_pending = false;
        queue_action_locked(PAIRING_ACTION_SEND_REQUEST);
        if (s_controller.request_is_recovery)
        {
            s_controller.snapshot.phase = PairingPhase::RECOVERY_SENT;
        }
    }

    const uint8_t actions = s_controller.pending_actions;
    s_controller.pending_actions = PAIRING_ACTION_NONE;
    return actions;
}

PairingSnapshot pairing_get_snapshot()
{
    PairingLock lock;
    return s_controller.snapshot;
}
