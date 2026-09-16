#include "button_policy.h"

ButtonPolicy::ButtonPolicy()
{
    reset();
}

void ButtonPolicy::reset()
{
    m_voice = DebouncedButton{};
    m_pair = DebouncedButton{};
    m_expr = DebouncedButton{};
    m_vol_up = DebouncedButton{};
    m_vol_down = DebouncedButton{};
    m_spot_next = DebouncedButton{};
    m_spot_prev = DebouncedButton{};
    m_touch = DebouncedButton{};
    m_action_count = 0;
}

void ButtonPolicy::push_action(ButtonAction action)
{
    if (action == ButtonAction::NONE) return;
    if (m_action_count < ACTION_QUEUE_MAX) {
        m_action_queue[m_action_count++] = action;
    }
}

size_t ButtonPolicy::get_pending_action_count() const
{
    return m_action_count;
}

ButtonAction ButtonPolicy::pop_action()
{
    if (m_action_count == 0) return ButtonAction::NONE;
    ButtonAction first = m_action_queue[0];
    for (size_t i = 1; i < m_action_count; ++i) {
        m_action_queue[i - 1] = m_action_queue[i];
    }
    m_action_count--;
    return first;
}

bool ButtonPolicy::update_debounced(
    DebouncedButton &btn,
    bool is_pressed,
    int64_t now_us,
    bool &just_pressed,
    bool &just_released)
{
    just_pressed = false;
    just_released = false;

    if (is_pressed != btn.raw_pressed) {
        btn.raw_pressed = is_pressed;
        btn.last_raw_change_us = now_us;
    }

    if (!btn.stable_pressed && btn.raw_pressed) {
        if (now_us - btn.last_raw_change_us >= BUTTON_DEBOUNCE_US) {
            btn.stable_pressed = true;
            btn.press_start_us = now_us;
            just_pressed = true;
        }
    } else if (btn.stable_pressed && !btn.raw_pressed) {
        if (now_us - btn.last_raw_change_us >= BUTTON_DEBOUNCE_US) {
            btn.stable_pressed = false;
            btn.hold_emitted = false;
            btn.released_since_hold = true;
            just_released = true;
        }
    }

    return btn.stable_pressed;
}

void ButtonPolicy::update_raw(
    bool btn_voice_pressed,
    bool btn_pair_pressed,
    bool btn_expr_pressed,
    bool btn_vol_up_pressed,
    bool btn_vol_down_pressed,
    bool btn_spot_next_pressed,
    bool btn_spot_prev_pressed,
    bool touch_pressed,
    int64_t now_us,
    SystemInteractionState sys_state)
{
    bool voice_edge = false, voice_rel = false;
    update_debounced(m_voice, btn_voice_pressed, now_us, voice_edge, voice_rel);

    bool pair_edge = false, pair_rel = false;
    update_debounced(m_pair, btn_pair_pressed, now_us, pair_edge, pair_rel);

    bool expr_edge = false, expr_rel = false;
    update_debounced(m_expr, btn_expr_pressed, now_us, expr_edge, expr_rel);

    bool vol_up_edge = false, vol_up_rel = false;
    update_debounced(m_vol_up, btn_vol_up_pressed, now_us, vol_up_edge, vol_up_rel);

    bool vol_dn_edge = false, vol_dn_rel = false;
    update_debounced(m_vol_down, btn_vol_down_pressed, now_us, vol_dn_edge, vol_dn_rel);

    bool spot_next_edge = false, spot_next_rel = false;
    update_debounced(m_spot_next, btn_spot_next_pressed, now_us, spot_next_edge, spot_next_rel);

    bool spot_prev_edge = false, spot_prev_rel = false;
    update_debounced(m_spot_prev, btn_spot_prev_pressed, now_us, spot_prev_edge, spot_prev_rel);

    bool touch_edge = false, touch_rel = false;
    update_debounced(m_touch, touch_pressed, now_us, touch_edge, touch_rel);

    // 1. Voice button action
    if (voice_edge) {
        if (sys_state == SystemInteractionState::IDLE) {
            push_action(ButtonAction::VOICE_START);
        } else if (sys_state == SystemInteractionState::RECORDING) {
            push_action(ButtonAction::VOICE_STOP);
        }
        // Ignored during THINKING, SPEAKING, PAIRING
    }

    // 2. BLE Pairing button: hold actions
    if (m_pair.stable_pressed && !m_pair.hold_emitted && m_pair.released_since_hold) {
        int64_t hold_duration = now_us - m_pair.press_start_us;
        if (sys_state == SystemInteractionState::IDLE && hold_duration >= BLE_PAIRING_ENTRY_HOLD_US) {
            m_pair.hold_emitted = true;
            m_pair.released_since_hold = false;
            push_action(ButtonAction::BLE_OPEN_DISCOVERY);
        } else if (sys_state == SystemInteractionState::PAIRING_ARMED_PROOF && hold_duration >= BLE_PAIRING_CONFIRM_HOLD_US) {
            m_pair.hold_emitted = true;
            m_pair.released_since_hold = false;
            push_action(ButtonAction::BLE_PHYSICAL_CONFIRM);
        }
    }

    // 3. Expression button
    if (expr_edge && sys_state == SystemInteractionState::IDLE) {
        push_action(ButtonAction::EXPRESSION_ASSET_11);
    }

    // 4. Touch pad
    if (touch_edge && sys_state == SystemInteractionState::IDLE) {
        push_action(ButtonAction::TOUCH_ASSET_6);
    }

    // 5. Volume buttons: cancel as a pair if simultaneous
    if (vol_up_edge && vol_dn_edge) {
        // Cancelled simultaneous inputs
    } else if (vol_up_edge) {
        push_action(ButtonAction::VOLUME_UP);
    } else if (vol_dn_edge) {
        push_action(ButtonAction::VOLUME_DOWN);
    }

    // 6. Spotify buttons: cancel as a pair if simultaneous
    if (spot_next_edge && spot_prev_edge) {
        // Cancelled simultaneous inputs
    } else if (spot_next_edge) {
        push_action(ButtonAction::SPOTIFY_NEXT);
    } else if (spot_prev_edge) {
        push_action(ButtonAction::SPOTIFY_PREV);
    }
}
