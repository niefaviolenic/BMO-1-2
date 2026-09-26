#include "face_policy.h"

FacePolicy::FacePolicy()
{
    reset(0);
}

void FacePolicy::reset(int64_t now_us)
{
    m_mode = FaceMode::BOOT_GREETING_STAGE1;
    m_current_asset = 7;
    m_boot_start_us = now_us;
    m_deadline_us = now_us + 5000000LL;
    m_thinking_start_us = 0;
    m_overlay_asset = 0;
    m_face_changed = true;
}

void FacePolicy::trigger_boot(int64_t now_us)
{
    reset(now_us);
}

void FacePolicy::trigger_recording_start(int64_t now_us)
{
    m_mode = FaceMode::RECORDING;
    m_current_asset = 4;
    m_deadline_us = 0;
    m_face_changed = true;
}

void FacePolicy::trigger_recording_stop(int64_t now_us)
{
}

void FacePolicy::trigger_thinking_start(int64_t now_us)
{
    m_mode = FaceMode::THINKING;
    m_current_asset = 10;
    m_thinking_start_us = now_us;
    m_deadline_us = now_us + 400000LL;
    m_face_changed = true;
}

void FacePolicy::trigger_speaking_start(int64_t now_us)
{
    m_mode = FaceMode::SPEAKING;
    m_current_asset = 2;
    m_deadline_us = 0;
    m_face_changed = true;
}

void FacePolicy::trigger_speaking_stop(int64_t now_us)
{
    m_mode = FaceMode::IDLE_DEFAULT;
    m_current_asset = 3;
    m_deadline_us = 0;
    m_face_changed = true;
}

void FacePolicy::trigger_error(int64_t now_us)
{
    m_mode = FaceMode::ERROR_OVERLAY;
    m_current_asset = 14;
    m_deadline_us = now_us + 5000000LL;
    m_face_changed = true;
}

void FacePolicy::trigger_ble_discovery_start(int64_t now_us)
{
    m_mode = FaceMode::PAIRING_DISCOVERY;
    m_current_asset = 1;
    m_deadline_us = now_us + 60000000LL;
    m_face_changed = true;
}

void FacePolicy::trigger_ble_connected(int64_t now_us)
{
    m_mode = FaceMode::PAIRING_WAIT_PROOF;
    m_current_asset = 5;
    m_deadline_us = 0;
    m_face_changed = true;
}

void FacePolicy::trigger_ble_proof_accepted(int64_t now_us)
{
    m_mode = FaceMode::PAIRING_SUCCESS;
    m_current_asset = 6;
    m_deadline_us = now_us + 5000000LL;
    m_face_changed = true;
}

void FacePolicy::trigger_provisioning_success(int64_t now_us)
{
    m_mode = FaceMode::PAIRING_SUCCESS;
    m_current_asset = 6;
    m_deadline_us = now_us + 5000000LL;
    m_face_changed = true;
}

void FacePolicy::trigger_ble_stop(int64_t now_us)
{
    if (m_mode == FaceMode::PAIRING_DISCOVERY || m_mode == FaceMode::PAIRING_WAIT_PROOF) {
        m_mode = FaceMode::IDLE_DEFAULT;
        m_current_asset = 3;
        m_deadline_us = 0;
        m_face_changed = true;
    }
}

void FacePolicy::trigger_touch_overlay(int64_t now_us)
{
    if (m_mode == FaceMode::IDLE_DEFAULT || m_mode == FaceMode::IDLE_OVERLAY) {
        m_mode = FaceMode::IDLE_OVERLAY;
        m_current_asset = 6;
        m_deadline_us = now_us + 5000000LL;
        m_face_changed = true;
    }
}

void FacePolicy::trigger_expression_overlay(int64_t now_us)
{
    if (m_mode == FaceMode::IDLE_DEFAULT || m_mode == FaceMode::IDLE_OVERLAY) {
        m_mode = FaceMode::IDLE_OVERLAY;
        m_current_asset = 11;
        m_deadline_us = now_us + 5000000LL;
        m_face_changed = true;
    }
}

void FacePolicy::trigger_custom_overlay(int64_t now_us, uint8_t asset_id)
{
    if (m_mode == FaceMode::IDLE_DEFAULT || m_mode == FaceMode::IDLE_OVERLAY) {
        m_mode = FaceMode::IDLE_OVERLAY;
        m_current_asset = asset_id;
        m_deadline_us = now_us + 5000000LL;
        m_face_changed = true;
    }
}

FaceDecision FacePolicy::update(int64_t now_us)
{
    bool changed = m_face_changed;
    m_face_changed = false;

    if (m_mode == FaceMode::BOOT_GREETING_STAGE1 || m_mode == FaceMode::BOOT_GREETING_STAGE2) {
        int64_t boot_elapsed = now_us - m_boot_start_us;
        if (boot_elapsed >= 10000000LL) {
            m_mode = FaceMode::IDLE_DEFAULT;
            m_current_asset = 3;
            m_deadline_us = 0;
            changed = true;
        } else if (boot_elapsed >= 5000000LL && m_mode == FaceMode::BOOT_GREETING_STAGE1) {
            m_mode = FaceMode::BOOT_GREETING_STAGE2;
            m_current_asset = 4;
            m_deadline_us = m_boot_start_us + 10000000LL;
            changed = true;
        }
    } else if (m_mode == FaceMode::THINKING) {
        int64_t elapsed_us = now_us - m_thinking_start_us;
        if (elapsed_us < 0) elapsed_us = 0;
        int64_t frame_index = (elapsed_us / 400000LL) % 3;
        static const uint8_t thinking_frames[3] = {10, 8, 9};
        uint8_t next_asset = thinking_frames[frame_index];
        if (next_asset != m_current_asset) {
            m_current_asset = next_asset;
            changed = true;
        }
        int64_t next_frame_deadline = m_thinking_start_us + ((elapsed_us / 400000LL) + 1) * 400000LL;
        m_deadline_us = next_frame_deadline;
    } else if (m_mode == FaceMode::PAIRING_SUCCESS ||
               m_mode == FaceMode::ERROR_OVERLAY ||
               m_mode == FaceMode::IDLE_OVERLAY) {
        if (now_us >= m_deadline_us) {
            m_mode = FaceMode::IDLE_DEFAULT;
            m_current_asset = 3;
            m_deadline_us = 0;
            changed = true;
        }
    } else if (m_mode == FaceMode::PAIRING_DISCOVERY) {
        if (now_us >= m_deadline_us) {
            m_mode = FaceMode::IDLE_DEFAULT;
            m_current_asset = 3;
            m_deadline_us = 0;
            changed = true;
        }
    }

    return FaceDecision{
        m_current_asset,
        m_deadline_us,
        changed
    };
}

FaceMode FacePolicy::get_current_mode() const
{
    return m_mode;
}

uint8_t FacePolicy::get_current_asset_id() const
{
    return m_current_asset;
}
