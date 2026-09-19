#ifndef BUTTON_POLICY_H
#define BUTTON_POLICY_H

#include <cstdint>
#include <cstddef>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

constexpr int64_t BUTTON_DEBOUNCE_US = 30000LL;          // 30 ms debounce
constexpr int64_t BLE_PAIRING_ENTRY_HOLD_US = 5000000LL; // 5 seconds hold to open pairing
constexpr int64_t BLE_PAIRING_CONFIRM_HOLD_US = 2000000LL; // 2 seconds hold to confirm physical proof

enum class ButtonAction : uint8_t {
    NONE = 0,
    VOICE_START,
    VOICE_STOP,
    BLE_OPEN_DISCOVERY,
    BLE_PHYSICAL_CONFIRM,
    EXPRESSION_ASSET_11,
    TOUCH_ASSET_6,
    VOLUME_UP,
    VOLUME_DOWN,
    SPOTIFY_NEXT,
    SPOTIFY_PREV
};

enum class SystemInteractionState : uint8_t {
    IDLE = 0,
    RECORDING,
    THINKING,
    SPEAKING,
    PAIRING_DISCOVERING,
    PAIRING_ARMED_PROOF,
    PAIRING_FINALIZING
};

struct DebouncedButton {
    bool raw_pressed = false;
    bool stable_pressed = false;
    int64_t last_raw_change_us = 0;
    int64_t press_start_us = 0;
    bool hold_emitted = false;
    bool released_since_hold = true;
};

class ButtonPolicy {
public:
    ButtonPolicy();
    void reset();

    void update_raw(
        bool btn_voice_pressed,
        bool btn_pair_pressed,
        bool btn_expr_pressed,
        bool btn_vol_up_pressed,
        bool btn_vol_down_pressed,
        bool btn_spot_next_pressed,
        bool btn_spot_prev_pressed,
        bool touch_pressed,
        int64_t now_us,
        SystemInteractionState sys_state,
        bool btn_boot_pressed = false);

    size_t get_pending_action_count() const;
    ButtonAction pop_action();

private:
    DebouncedButton m_voice;
    DebouncedButton m_pair;
    DebouncedButton m_boot;
    DebouncedButton m_expr;
    DebouncedButton m_vol_up;
    DebouncedButton m_vol_down;
    DebouncedButton m_spot_next;
    DebouncedButton m_spot_prev;
    DebouncedButton m_touch;

    SystemInteractionState m_prev_sys_state = SystemInteractionState::IDLE;
    bool m_arm_requires_release = false;

    static constexpr size_t ACTION_QUEUE_MAX = 8;
    ButtonAction m_action_queue[ACTION_QUEUE_MAX];
    size_t m_action_count = 0;

    void push_action(ButtonAction action);
    bool update_debounced(
        DebouncedButton &btn,
        bool is_pressed,
        int64_t now_us,
        bool &just_pressed,
        bool &just_released);
};

#ifdef __cplusplus
}
#endif

#endif // BUTTON_POLICY_H
