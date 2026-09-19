#ifndef FACE_POLICY_H
#define FACE_POLICY_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

enum class FaceMode : uint8_t {
    BOOT_GREETING_STAGE1 = 0, // Asset 7 (5s)
    BOOT_GREETING_STAGE2,     // Asset 4 (5s)
    IDLE_DEFAULT,             // Asset 3
    IDLE_OVERLAY,             // Temporary overlay (Touch Asset 6, Expr Asset 11) for 5s
    PAIRING_DISCOVERY,        // Asset 1
    PAIRING_WAIT_PROOF,       // Asset 5
    PAIRING_SUCCESS,          // Asset 6 for 5s
    RECORDING,                // Asset 4
    THINKING,                 // 10 -> 8 -> 9 loop, 400ms each
    SPEAKING,                 // Asset 2
    ERROR_OVERLAY             // Asset 14 for 5s
};

struct FaceDecision {
    uint8_t asset_id;
    int64_t next_deadline_us; // 0 if indefinite until state change
    bool face_changed;
};

class FacePolicy {
public:
    FacePolicy();
    void reset(int64_t now_us);

    void trigger_boot(int64_t now_us);
    void trigger_recording_start(int64_t now_us);
    void trigger_recording_stop(int64_t now_us);
    void trigger_thinking_start(int64_t now_us);
    void trigger_speaking_start(int64_t now_us);
    void trigger_speaking_stop(int64_t now_us);
    void trigger_error(int64_t now_us);
    void trigger_ble_discovery_start(int64_t now_us);
    void trigger_ble_connected(int64_t now_us);
    void trigger_ble_proof_accepted(int64_t now_us);
    void trigger_provisioning_success(int64_t now_us);
    void trigger_ble_stop(int64_t now_us);
    void trigger_touch_overlay(int64_t now_us);
    void trigger_expression_overlay(int64_t now_us);

    FaceDecision update(int64_t now_us);

    FaceMode get_current_mode() const;
    uint8_t get_current_asset_id() const;

    FaceMode m_mode = FaceMode::BOOT_GREETING_STAGE1;
    uint8_t m_current_asset = 7;
    int64_t m_boot_start_us = 0;
    int64_t m_deadline_us = 0;
    int64_t m_thinking_start_us = 0;
    uint8_t m_overlay_asset = 0;
    bool m_face_changed = true;
};

#ifdef __cplusplus
}
#endif

#endif // FACE_POLICY_H
