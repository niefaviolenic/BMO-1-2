#include "button.h"

#include "audio.h"
#include "display.h"
#include "pairing.h"
#include "joy_ble_provisioning.h"
#include "joy_identity.h"
#include "state.h"
#include "board_config.h"
#include "button_policy.h"
#include "wakeword.h"
extern "C" void api_spotify_queue_action(int action_type);
#include "driver/gpio.h"
#if __has_include("driver/touch_sensor_legacy.h")
#include "driver/touch_sensor_legacy.h"
#define JOY_HAS_TOUCH_PAD 1
#elif __has_include("driver/touch_pad.h")
#include "driver/touch_pad.h"
#define JOY_HAS_TOUCH_PAD 1
#elif __has_include("driver/touch_sensor.h")
#include "driver/touch_sensor.h"
#define JOY_HAS_TOUCH_PAD 1
#else
#define JOY_HAS_TOUCH_PAD 0
#endif
#include "esp_err.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

//--------------------------------------------------
// Touch + volume input pins.
//--------------------------------------------------

#define BTN_BOOT       GPIO_NUM_0
#define TOUCH_PIN      GPIO_NUM_14
#define BTN_VOL_UP    GPIO_NUM_15
#define BTN_VOL_DOWN  GPIO_NUM_16
#define BTN_EXPRESSION GPIO_NUM_17
#define VOLUME_STEP 5
#define BUTTON_DEBOUNCE_US 30000LL
#define TOUCH_DEBOUNCE_US 30000LL

static const char *TAG="BUTTON";

struct DebouncedButtonState
{
    bool candidate_pressed;
    bool stable_pressed;
    int64_t candidate_since_us;
};

static DebouncedButtonState volume_up_state = {};
static DebouncedButtonState volume_down_state = {};
static bool expression_button_candidate_pressed = false;
static bool expression_button_stable_pressed = false;
static int64_t expression_button_candidate_since_us = 0;
static ButtonPolicy s_button_policy;
enum class TouchLifecycleState
{
    TOUCH_ARMED,
    TOUCH_CONSUMED,
    TOUCH_BOOT_HIGH_LOCKOUT
};

static TouchLifecycleState touch_state =
    TouchLifecycleState::TOUCH_ARMED;
static bool touch_candidate_level = false;
static bool touch_stable_level = false;
static int64_t touch_candidate_since_us = 0;
static int64_t last_touch_diag_us = 0;
static int64_t touch_press_start_us = 0;
static bool touch_physical_confirm_triggered = false;
static bool touch_factory_reset_triggered = false;

// GPIO14 is an ESP32-S3 native touch channel. The previous implementation
// treated it only as a digital input, which cannot detect a bare capacitive
// pad. Keep the digital fallback if native touch setup is unavailable.
#if JOY_HAS_TOUCH_PAD
static constexpr touch_pad_t TOUCH_CHANNEL = TOUCH_PAD_NUM14;
#endif
static bool native_touch_enabled = false;
static bool native_touch_level = false;
static bool native_touch_baseline_ready = false;
static uint32_t native_touch_raw = 0;
static uint32_t native_touch_baseline = 0;
static uint32_t native_touch_threshold = 0;
static uint64_t native_touch_calibration_sum = 0;
static int native_touch_calibration_samples = 0;

static bool native_touch_init()
{
#if JOY_HAS_TOUCH_PAD
    if(touch_pad_init() != ESP_OK)
        return false;

    if(touch_pad_config(TOUCH_CHANNEL) != ESP_OK ||
       touch_pad_set_voltage(TOUCH_PAD_HIGH_VOLTAGE_THRESHOLD, TOUCH_PAD_LOW_VOLTAGE_THRESHOLD, TOUCH_PAD_ATTEN_VOLTAGE_THRESHOLD) != ESP_OK ||
       touch_pad_set_cnt_mode(TOUCH_CHANNEL, TOUCH_PAD_SLOPE_7, TOUCH_PAD_TIE_OPT_LOW) != ESP_OK ||
       touch_pad_set_fsm_mode(TOUCH_FSM_MODE_TIMER) != ESP_OK ||
       touch_pad_fsm_start() != ESP_OK)
    {
        (void)touch_pad_deinit();
        return false;
    }
    native_touch_enabled = true;
    native_touch_level = false;
    native_touch_baseline_ready = false;
    native_touch_raw = 0;
    native_touch_baseline = 0;
    native_touch_threshold = 2500;
    native_touch_calibration_sum = 0;
    native_touch_calibration_samples = 0;
    ESP_LOGI(TAG, "Native touch sensor initialized in timer FSM mode with filter on GPIO14 (T%d)", TOUCH_CHANNEL);
    return true;
#else
    return false;
#endif
}

static bool native_touch_update()
{
#if JOY_HAS_TOUCH_PAD
    if(!native_touch_enabled)
        return false;

    uint32_t val = 0;
    if(touch_pad_filter_read_smooth(TOUCH_CHANNEL, &val) != ESP_OK)
    {
        if(touch_pad_read_raw_data(TOUCH_CHANNEL, &val) != ESP_OK)
            return false;
    }

    native_touch_raw = val;
    if(!native_touch_baseline_ready)
    {
        native_touch_calibration_sum += val;
        native_touch_calibration_samples++;
        if(native_touch_calibration_samples >= 32)
        {
            native_touch_baseline = (uint32_t)(native_touch_calibration_sum / 32ULL);
            native_touch_threshold = 2500U;
            native_touch_baseline_ready = true;
            ESP_LOGI(TAG, "Native touch calibrated: baseline=%lu delta_thresh=%lu",
                     (unsigned long)native_touch_baseline,
                     (unsigned long)native_touch_threshold);
        }
        return false;
    }

    uint32_t delta = (val > native_touch_baseline) ? (val - native_touch_baseline) : (native_touch_baseline - val);

    if (delta >= native_touch_threshold)
    {
        native_touch_level = true;
        // Never adjust baseline while pressed
    }
    else
    {
        native_touch_level = false;
        // Very slow baseline tracking when untouched (over 256 samples)
        native_touch_baseline = (native_touch_baseline * 255U + val) / 256U;
    }

    return native_touch_level;
#else
    return false;
#endif
}
static bool read_touch_level()
{
    if(native_touch_enabled) {
        return native_touch_update();
    }
    return (gpio_get_level(TOUCH_PIN) == 1);
}

static bool update_debounced_button(
    gpio_num_t pin,
    DebouncedButtonState &button,
    int64_t now)
{
    const bool pressed = gpio_get_level(pin) == 0;

    if(pressed != button.candidate_pressed)
    {
        button.candidate_pressed = pressed;
        button.candidate_since_us = now;
    }

    if(button.candidate_pressed != button.stable_pressed &&
       now - button.candidate_since_us >= BUTTON_DEBOUNCE_US)
    {
        button.stable_pressed = button.candidate_pressed;
        return button.stable_pressed;
    }

    return false;
}

static const char *touch_lifecycle_name(TouchLifecycleState state)
{
    switch(state)
    {
        case TouchLifecycleState::TOUCH_ARMED: return "ARMED";
        case TouchLifecycleState::TOUCH_CONSUMED: return "CONSUMED";
        case TouchLifecycleState::TOUCH_BOOT_HIGH_LOCKOUT: return "BOOT_HIGH_LOCKOUT";
        default: return "UNKNOWN";
    }
}

static const char *joy_state_name(JoyState state)
{
    switch(state)
    {
        case JoyState::IDLE: return "IDLE";
        case JoyState::RECORDING: return "RECORDING";
        case JoyState::THINKING: return "THINKING";
        case JoyState::SPEAKING: return "SPEAKING";
        case JoyState::ERROR_STATE: return "ERROR";
        default: return "UNKNOWN";
    }
}

//--------------------------------------------------

void button_init()
{
    const bool native_touch_ready = native_touch_init();

    if(!native_touch_ready)
    {
        gpio_config_t touch_config = {};

        touch_config.pin_bit_mask = 1ULL << TOUCH_PIN;
        touch_config.mode = GPIO_MODE_INPUT;
        touch_config.pull_up_en = GPIO_PULLUP_DISABLE;
        touch_config.pull_down_en = GPIO_PULLDOWN_ENABLE;
        touch_config.intr_type = GPIO_INTR_DISABLE;

        ESP_ERROR_CHECK(
            gpio_config(
                &touch_config));
    }

    gpio_config_t button_config = {};

    button_config.pin_bit_mask =
        (1ULL << BTN_BOOT) |
        (1ULL << BTN_VOL_UP) |
        (1ULL << BTN_VOL_DOWN) |
        (1ULL << BTN_EXPRESSION);
    button_config.mode = GPIO_MODE_INPUT;
    button_config.pull_up_en = GPIO_PULLUP_ENABLE;
    button_config.pull_down_en = GPIO_PULLDOWN_DISABLE;
    button_config.intr_type = GPIO_INTR_DISABLE;

    ESP_ERROR_CHECK(
        gpio_config(
            &button_config));

    const int64_t now = esp_timer_get_time();
    const bool touch_level = native_touch_enabled ?
        native_touch_level : gpio_get_level(TOUCH_PIN) == 1;
    const bool expression_button_pressed =
        gpio_get_level(BTN_EXPRESSION) == 0;
    const bool volume_up_pressed = gpio_get_level(BTN_VOL_UP) == 0;
    const bool volume_down_pressed = gpio_get_level(BTN_VOL_DOWN) == 0;

    volume_up_state = {volume_up_pressed, volume_up_pressed, now};
    volume_down_state = {volume_down_pressed, volume_down_pressed, now};

    expression_button_candidate_pressed = expression_button_pressed;
    expression_button_stable_pressed = expression_button_pressed;
    expression_button_candidate_since_us = now;

    // Synchronize with the physical level at boot. A HIGH input is treated
    // as already consumed until a complete stable release is observed.
    touch_candidate_level = touch_level;
    touch_stable_level = touch_level;
    touch_candidate_since_us = now;
    touch_state = touch_level ?
        TouchLifecycleState::TOUCH_BOOT_HIGH_LOCKOUT :
        TouchLifecycleState::TOUCH_ARMED;

    ESP_LOGI(
        TAG,
        "Touch init: raw=%d stable=%d lifecycle=%s",
        touch_level ? 1 : 0,
        touch_stable_level ? 1 : 0,
        touch_lifecycle_name(touch_state));

    ESP_LOGI(
        TAG,
        "Touch backend: %s",
        native_touch_enabled ? "ESP32-S3 capacitive" : "GPIO digital fallback");

    ESP_LOGI(
        TAG,
        "Input ready: touch=%d vol_up=%d vol_down=%d",
        TOUCH_PIN,
        BTN_VOL_UP,
        BTN_VOL_DOWN);

    ESP_LOGI(
        TAG,
        "Expression button ready: pin=%d active_low=1 initial_pressed=%d",
        BTN_EXPRESSION,
        expression_button_pressed ? 1 : 0);

    s_button_policy.reset();
}

//--------------------------------------------------

void button_update()
{
    int64_t now = esp_timer_get_time();

    // Diagnostic live log every 1s showing exact GPIO readings
    static int64_t last_pin_diag_us = 0;
    if (now - last_pin_diag_us >= 1000000LL) {
        last_pin_diag_us = now;
        ESP_LOGI(TAG, "Pins: expr(17)=%d boot(0)=%d vol_up(15)=%d vol_dn(16)=%d touch_raw=%lu",
                 gpio_get_level(BTN_EXPRESSION),
                 gpio_get_level(BTN_BOOT),
                 gpio_get_level(BTN_VOL_UP),
                 gpio_get_level(BTN_VOL_DOWN),
                 (unsigned long)native_touch_raw);
    }
    // Dedicated button policy handling for assigned 7 inputs
    bool btn_voice_down = BOARD_PIN_IS_ASSIGNED(PIN_BTN_VOICE) ? (gpio_get_level((gpio_num_t)PIN_BTN_VOICE) == 0) : false;
    bool btn_pair_down = BOARD_PIN_IS_ASSIGNED(PIN_BTN_PAIR) ? (gpio_get_level((gpio_num_t)PIN_BTN_PAIR) == 0) : false;
    bool btn_expr_down = BOARD_PIN_IS_ASSIGNED(PIN_BTN_EXPRESSION) ? (gpio_get_level((gpio_num_t)PIN_BTN_EXPRESSION) == 0) : false;
    bool btn_vol_up_down = BOARD_PIN_IS_ASSIGNED(PIN_BTN_VOL_UP) ? (gpio_get_level((gpio_num_t)PIN_BTN_VOL_UP) == 0) : false;
    bool btn_vol_dn_down = BOARD_PIN_IS_ASSIGNED(PIN_BTN_VOL_DOWN) ? (gpio_get_level((gpio_num_t)PIN_BTN_VOL_DOWN) == 0) : false;
    bool btn_spot_next_down = BOARD_PIN_IS_ASSIGNED(PIN_BTN_SPOTIFY_NEXT) ? (gpio_get_level((gpio_num_t)PIN_BTN_SPOTIFY_NEXT) == 0) : false;
    bool btn_spot_prev_down = BOARD_PIN_IS_ASSIGNED(PIN_BTN_SPOTIFY_PREV) ? (gpio_get_level((gpio_num_t)PIN_BTN_SPOTIFY_PREV) == 0) : false;
    bool touch_pad_down = read_touch_level();

    SystemInteractionState sys_interaction = SystemInteractionState::IDLE;
    JoyState cur_joy_state = getState();
    if (cur_joy_state == JoyState::RECORDING) sys_interaction = SystemInteractionState::RECORDING;
    else if (cur_joy_state == JoyState::THINKING) sys_interaction = SystemInteractionState::THINKING;
    else if (cur_joy_state == JoyState::SPEAKING) sys_interaction = SystemInteractionState::SPEAKING;
    else if (joy_ble_get_state() == JoyBleState::BOOTSTRAP_ADVERTISING) sys_interaction = SystemInteractionState::PAIRING_DISCOVERING;
    else if (joy_ble_get_state() == JoyBleState::PHYSICAL_CONFIRM_PENDING) sys_interaction = SystemInteractionState::PAIRING_ARMED_PROOF;
    else if (joy_ble_get_state() == JoyBleState::FINALIZING_WITH_BACKEND) sys_interaction = SystemInteractionState::PAIRING_FINALIZING;

    s_button_policy.update_raw(
        btn_voice_down,
        btn_pair_down,
        btn_expr_down,
        btn_vol_up_down,
        btn_vol_dn_down,
        btn_spot_next_down,
        btn_spot_prev_down,
        touch_pad_down,
        now,
        sys_interaction);

    while (s_button_policy.get_pending_action_count() > 0) {
        ButtonAction action = s_button_policy.pop_action();
        switch (action) {
            case ButtonAction::VOICE_START:
                if (getState() == JoyState::IDLE) {
                    audio_triggerWakeAck();
                    start_recording();
                    setState(JoyState::RECORDING);
                }
                break;
            case ButtonAction::VOICE_STOP:
                request_finish_recording();
                break;
            case ButtonAction::BLE_OPEN_DISCOVERY:
                joy_ble_start_pairing_window();
                break;
            case ButtonAction::BLE_PHYSICAL_CONFIRM:
                joy_ble_on_physical_hold_2s();
                break;
            case ButtonAction::EXPRESSION_ASSET_11:
                display_set_idle_face(FACE_CUTE);
                break;
            case ButtonAction::TOUCH_ASSET_6:
                display_set_idle_face(FACE_HAPPY);
                break;
            case ButtonAction::VOLUME_UP:
                audio_setVolume(audio_getVolume() + VOLUME_STEP);
                break;
            case ButtonAction::VOLUME_DOWN:
                audio_setVolume(audio_getVolume() - VOLUME_STEP);
                break;
            case ButtonAction::SPOTIFY_NEXT:
                api_spotify_queue_action(1);
                break;
            case ButtonAction::SPOTIFY_PREV:
                api_spotify_queue_action(2);
                break;
            default:
                break;
        }
    }


    enum class BtnKind { NONE, EXPR, BOOT, VOL_UP, VOL_DOWN };
    static BtnKind s_debounced_btn = BtnKind::NONE;
    static BtnKind s_cand_btn = BtnKind::NONE;
    static int64_t s_cand_since_us = 0;
    static BtnKind s_held_btn = BtnKind::NONE;
    static int64_t s_press_start_us = 0;
    static bool s_hold_2s_triggered = false;
    static bool s_hold_5s_triggered = false;
    static int64_t s_last_hold_log_us = 0;

    const bool expr_down = (gpio_get_level(BTN_EXPRESSION) == 0);
    const bool boot_down = (gpio_get_level(BTN_BOOT) == 0);
    const bool vol_up_down = (gpio_get_level(BTN_VOL_UP) == 0);
    const bool vol_dn_down = (gpio_get_level(BTN_VOL_DOWN) == 0);

    BtnKind active_raw = BtnKind::NONE;
    if (expr_down) active_raw = BtnKind::EXPR;
    else if (boot_down) active_raw = BtnKind::BOOT;
    else if (vol_dn_down) active_raw = BtnKind::VOL_DOWN;
    else if (vol_up_down) active_raw = BtnKind::VOL_UP;

    if (active_raw != s_cand_btn) {
        s_cand_btn = active_raw;
        s_cand_since_us = now;
    }

    // Debounce: 20ms for press, 150ms for release to filter microswitch chatter
    int64_t debounce_limit_us = (s_cand_btn == BtnKind::NONE) ? 150000LL : 20000LL;

    if (s_cand_btn != s_debounced_btn && (now - s_cand_since_us >= debounce_limit_us)) {
        s_debounced_btn = s_cand_btn;

        if (s_debounced_btn != BtnKind::NONE) {
            // Button just pressed DOWN
            s_held_btn = s_debounced_btn;
            s_press_start_us = now;
            s_hold_2s_triggered = false;
            s_hold_5s_triggered = false;
            s_last_hold_log_us = now;

            const char *btn_name = (s_held_btn == BtnKind::EXPR) ? "EXPRESSION" :
                                   (s_held_btn == BtnKind::BOOT) ? "BOOT" :
                                   (s_held_btn == BtnKind::VOL_DOWN) ? "VOL_DOWN" : "VOL_UP";
            ESP_LOGI(TAG, "Button pressed: %s (hold 2s for verify, hold 5s for pairing)", btn_name);
        } else {
            // Button RELEASED
            const int64_t duration_us = (s_press_start_us > 0) ? (now - s_press_start_us) : 0;
            BtnKind released_btn = s_held_btn;
            s_held_btn = BtnKind::NONE;
            s_press_start_us = 0;

            if (s_hold_5s_triggered || s_hold_2s_triggered) {
                ESP_LOGI(TAG, "Button released after hold action completed");
            } else if (duration_us < 2000000LL) {
                // Short click:
                if (released_btn == BtnKind::EXPR || released_btn == BtnKind::BOOT) {
                    if (getState() == JoyState::IDLE &&
                        !display_pairing_code_is_visible() &&
                        !display_qr_code_is_visible() &&
                        !display_ble_pairing_is_visible()) {
                        const Face next_face = display_next_touch_face();
                        ESP_LOGI(TAG, "Expression button click -> switched to face=%d", (int)next_face);
                        audio_triggerExpressionAudio((int)next_face);
                    } else {
                        ESP_LOGW(TAG, "Expression button ignored: state=%s (not IDLE or pairing visible)", joy_state_name(getState()));
                    }
                } else if (released_btn == BtnKind::VOL_UP) {
                    audio_adjustVolume(VOLUME_STEP);
                    ESP_LOGI(TAG, "Volume up: %d", audio_getVolume());
                } else if (released_btn == BtnKind::VOL_DOWN) {
                    audio_adjustVolume(-VOLUME_STEP);
                    ESP_LOGI(TAG, "Volume down: %d", audio_getVolume());
                }
            }
        }
    }
    // While ANY button is being held:
    if (s_debounced_btn != BtnKind::NONE && s_press_start_us > 0) {
        const int64_t hold_us = now - s_press_start_us;

        if (now - s_last_hold_log_us >= 500000LL) {
            s_last_hold_log_us = now;
            ESP_LOGI(TAG, "Button holding: %lld ms / 2000 ms (BLE state: %s)",
                     (long long)(hold_us / 1000LL),
                     (joy_ble_get_state() == JoyBleState::PHYSICAL_CONFIRM_PENDING) ? "PHYSICAL_CONFIRM_PENDING" :
                     joy_ble_is_active() ? "BLE_ACTIVE" : "IDLE");
        }

        // 2-second hold for physical confirmation (Step 2 of pairing, EXPR or BOOT):
        if ((s_held_btn == BtnKind::EXPR || s_held_btn == BtnKind::BOOT) &&
            joy_ble_get_state() == JoyBleState::PHYSICAL_CONFIRM_PENDING &&
            hold_us >= 2000000LL && !s_hold_2s_triggered) {
            s_hold_2s_triggered = true;
            joy_ble_on_physical_hold_2s();
            ESP_LOGI(TAG, "=======================================================");
            ESP_LOGI(TAG, ">>> PHYSICAL PROOF 2S HOLD CONFIRMED & SENT VIA BLE! <<<");
            ESP_LOGI(TAG, "=======================================================");
        }

        // 5-second hold for BLE pairing window reset / unpair (EXPR or BOOT):
        if ((s_held_btn == BtnKind::EXPR || s_held_btn == BtnKind::BOOT) && !s_hold_2s_triggered &&
            hold_us >= 5000000LL && !s_hold_5s_triggered) {
            s_hold_5s_triggered = true;
            const joy_runtime_creds_t *runtime = joy_runtime_get();
            const bool was_provisioned = (runtime && runtime->is_provisioned);
            if (was_provisioned) {
                ESP_LOGI(TAG, ">>> 5-SECOND HOLD DETECTED (PAIRED): Unpairing and opening BLE Pairing Window! <<<");
                joy_ble_unpair();
                joy_ble_start_pairing_window();
            } else {
                ESP_LOGI(TAG, ">>> 5-SECOND HOLD DETECTED (UNPAIRED): Opening BLE Pairing Window! <<<");
                joy_ble_start_pairing_window();
            }
        }
    }
    const bool touch_level = read_touch_level();

    if(now - last_touch_diag_us >= 2000000LL)
    {
        last_touch_diag_us = now;
        long delta = (long)((native_touch_raw > native_touch_baseline) ? (native_touch_raw - native_touch_baseline) : (native_touch_baseline - native_touch_raw));
        ESP_LOGI(
            TAG,
            "Touch sample: val=%lu base=%lu delta=%ld thresh=%lu level=%d cand=%d stable=%d state=%s",
            (unsigned long)native_touch_raw,
            (unsigned long)native_touch_baseline,
            delta,
            (unsigned long)native_touch_threshold,
            touch_level ? 1 : 0,
            touch_candidate_level ? 1 : 0,
            touch_stable_level ? 1 : 0,
            joy_state_name(getState()));
    }
    if(touch_level != touch_candidate_level)
    {
        const bool previous_level = touch_candidate_level;
        touch_candidate_level = touch_level;
        touch_candidate_since_us = now;

        ESP_LOGI(
            TAG,
            "Touch raw transition: old=%d new=%d",
            previous_level ? 1 : 0,
            touch_level ? 1 : 0);
    }

    if(touch_candidate_level != touch_stable_level &&
       now - touch_candidate_since_us >= TOUCH_DEBOUNCE_US)
    {
        touch_stable_level = touch_candidate_level;

        ESP_LOGI(
            TAG,
            "Touch stable: level=%d",
            touch_stable_level ? 1 : 0);

        if(touch_stable_level)
        {
            touch_press_start_us = now;
            touch_physical_confirm_triggered = false;
            touch_factory_reset_triggered = false;
            touch_state = TouchLifecycleState::TOUCH_CONSUMED;
            ESP_LOGI(TAG, "Touch press started at %lld us", (long long)now);
        }
        else
        {
            touch_state = TouchLifecycleState::TOUCH_ARMED;
            const int64_t duration_us = (touch_press_start_us > 0) ? (now - touch_press_start_us) : 0;
            ESP_LOGI(TAG, "Touch released after %lld ms", (long long)(duration_us / 1000LL));

            if (touch_physical_confirm_triggered || touch_factory_reset_triggered)
            {
                ESP_LOGI(TAG, "Touch release consumed by previous confirmation/reset");
            }
            else if (duration_us < 5000000LL)
            {
                if(getState() == JoyState::IDLE)
                {
                    const Face next_face = display_next_touch_face();
                    ESP_LOGI(TAG, "Touch interaction -> switched to face=%d", (int)next_face);
                    audio_triggerExpressionAudio((int)next_face);
                }
                else
                {
                    ESP_LOGW(TAG, "Short touch rejected: state=%s (not IDLE)", joy_state_name(getState()));
                }
            }
            else
            {
                ESP_LOGI(TAG, "Touch released after %lld ms", (long long)(duration_us / 1000LL));
            }
            touch_press_start_us = 0;
        }
    }

}
