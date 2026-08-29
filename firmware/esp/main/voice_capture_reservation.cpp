#include "voice_capture_reservation.h"
#include <cstring>

namespace
{
VoiceCaptureReservation s_reservation{};
}

void voice_reservation_init()
{
    voice_reservation_reset();
}

void voice_reservation_reset()
{
    s_reservation = VoiceCaptureReservation{};
    s_reservation.state = VoiceReservationState::IDLE;
}

bool voice_reservation_begin_request(const char* request_id, int64_t now_us)
{
    if (request_id == nullptr || std::strlen(request_id) == 0) {
        return false;
    }

    voice_reservation_reset();
    std::strncpy(s_reservation.request_id, request_id, UUID_STR_LEN - 1);
    s_reservation.state = VoiceReservationState::REQUESTING;
    s_reservation.capture_lease_deadline_us = now_us + 5000000LL; // 5s timeout for reserve response
    return true;
}

bool voice_reservation_handle_accepted(const char* request_id,
                                      const char* lease_id,
                                      const char* reserve_receipt,
                                      uint32_t lease_duration_seconds,
                                      int64_t now_us)
{
    if (request_id == nullptr || lease_id == nullptr || reserve_receipt == nullptr) {
        return false;
    }
    if (s_reservation.state != VoiceReservationState::REQUESTING &&
        s_reservation.state != VoiceReservationState::IDLE) {
        return false;
    }
    if (std::strcmp(s_reservation.request_id, request_id) != 0 &&
        s_reservation.state == VoiceReservationState::REQUESTING) {
        return false;
    }

    std::strncpy(s_reservation.request_id, request_id, UUID_STR_LEN - 1);
    std::strncpy(s_reservation.lease_id, lease_id, UUID_STR_LEN - 1);
    std::strncpy(s_reservation.reserve_receipt, reserve_receipt, RECEIPT_STR_LEN - 1);
    s_reservation.capture_lease_deadline_us = now_us + (int64_t)lease_duration_seconds * 1000000LL;
    s_reservation.state = VoiceReservationState::RESERVED;
    return true;
}

void voice_reservation_handle_rejected(const char* request_id)
{
    if (request_id != nullptr && std::strcmp(s_reservation.request_id, request_id) == 0) {
        s_reservation.state = VoiceReservationState::REJECTED;
    }
}

void voice_reservation_handle_expired(const char* request_id)
{
    if (request_id != nullptr && std::strcmp(s_reservation.request_id, request_id) == 0) {
        s_reservation.state = VoiceReservationState::EXPIRED;
    }
}

bool voice_reservation_is_valid(const char* request_id, int64_t now_us)
{
    if (request_id == nullptr || s_reservation.state != VoiceReservationState::RESERVED) {
        return false;
    }
    if (std::strcmp(s_reservation.request_id, request_id) != 0) {
        return false;
    }
    return now_us <= s_reservation.capture_lease_deadline_us;
}

const VoiceCaptureReservation* voice_reservation_get_current()
{
    return &s_reservation;
}
