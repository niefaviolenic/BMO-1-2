#ifndef VOICE_CAPTURE_RESERVATION_H
#define VOICE_CAPTURE_RESERVATION_H

#include <cstdint>
#include <cstddef>

constexpr size_t UUID_STR_LEN = 37;
constexpr size_t RECEIPT_STR_LEN = 513;

enum class VoiceReservationState : uint8_t {
    IDLE,
    REQUESTING,
    RESERVED,
    EXPIRED,
    REJECTED,
};

struct VoiceCaptureReservation {
    VoiceReservationState state{VoiceReservationState::IDLE};
    char request_id[UUID_STR_LEN]{};
    char lease_id[UUID_STR_LEN]{};
    char reserve_receipt[RECEIPT_STR_LEN]{};
    int64_t capture_lease_deadline_us{0};
};

void voice_reservation_init();
bool voice_reservation_begin_request(const char* request_id, int64_t now_us);
bool voice_reservation_handle_accepted(const char* request_id,
                                      const char* lease_id,
                                      const char* reserve_receipt,
                                      uint32_t lease_duration_seconds,
                                      int64_t now_us);
void voice_reservation_handle_rejected(const char* request_id);
void voice_reservation_handle_expired(const char* request_id);
void voice_reservation_reset();
bool voice_reservation_is_valid(const char* request_id, int64_t now_us);
const VoiceCaptureReservation* voice_reservation_get_current();

#endif // VOICE_CAPTURE_RESERVATION_H
