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

static const char *TAG="BUTTON";

static ButtonPolicy s_button_policy;

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

    const bool expression_button_pressed =
        gpio_get_level(BTN_EXPRESSION) == 0;

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

    // Read GPIO states
    const bool expr_down = (gpio_get_level(BTN_EXPRESSION) == 0);
    const bool boot_down = (gpio_get_level(BTN_BOOT) == 0);
    const bool vol_up_down = (gpio_get_level(BTN_VOL_UP) == 0);
    const bool vol_dn_down = (gpio_get_level(BTN_VOL_DOWN) == 0);

    bool btn_voice_down = BOARD_PIN_IS_ASSIGNED(PIN_BTN_VOICE) ? (gpio_get_level((gpio_num_t)PIN_BTN_VOICE) == 0) : false;
    bool btn_pair_down = false;
    if (BOARD_PIN_IS_ASSIGNED(PIN_BTN_PAIR)) {
        btn_pair_down = (gpio_get_level((gpio_num_t)PIN_BTN_PAIR) == 0);
    }
    bool btn_expr_down = BOARD_PIN_IS_ASSIGNED(PIN_BTN_EXPRESSION) ? (gpio_get_level((gpio_num_t)PIN_BTN_EXPRESSION) == 0) : expr_down;
    bool btn_vol_up = BOARD_PIN_IS_ASSIGNED(PIN_BTN_VOL_UP) ? (gpio_get_level((gpio_num_t)PIN_BTN_VOL_UP) == 0) : vol_up_down;
    bool btn_vol_dn = BOARD_PIN_IS_ASSIGNED(PIN_BTN_VOL_DOWN) ? (gpio_get_level((gpio_num_t)PIN_BTN_VOL_DOWN) == 0) : vol_dn_down;
    bool btn_spot_next_down = BOARD_PIN_IS_ASSIGNED(PIN_BTN_SPOTIFY_NEXT) ? (gpio_get_level((gpio_num_t)PIN_BTN_SPOTIFY_NEXT) == 0) : false;
    bool btn_spot_prev_down = BOARD_PIN_IS_ASSIGNED(PIN_BTN_SPOTIFY_PREV) ? (gpio_get_level((gpio_num_t)PIN_BTN_SPOTIFY_PREV) == 0) : false;
    bool touch_pad_down = read_touch_level();
    bool btn_boot_down = boot_down;

    // Pairing state owns inputs so face/voice cannot override it
    SystemInteractionState sys_interaction = SystemInteractionState::IDLE;
    JoyBleState ble_state = joy_ble_get_state();
    if (ble_state == JoyBleState::PHYSICAL_CONFIRM_PENDING) {
        sys_interaction = SystemInteractionState::PAIRING_ARMED_PROOF;
    } else if (ble_state == JoyBleState::BOOTSTRAP_ADVERTISING) {
        sys_interaction = SystemInteractionState::PAIRING_DISCOVERING;
    } else if (joy_ble_is_active()) {
        sys_interaction = SystemInteractionState::PAIRING_FINALIZING;
    } else {
        JoyState cur_joy_state = getState();
        if (cur_joy_state == JoyState::RECORDING) {
            sys_interaction = SystemInteractionState::RECORDING;
        } else if (cur_joy_state == JoyState::THINKING) {
            sys_interaction = SystemInteractionState::THINKING;
        } else if (cur_joy_state == JoyState::SPEAKING) {
            sys_interaction = SystemInteractionState::SPEAKING;
        }
    }

    s_button_policy.update_raw(
        btn_voice_down,
        btn_pair_down,
        btn_expr_down,
        btn_vol_up,
        btn_vol_dn,
        btn_spot_next_down,
        btn_spot_prev_down,
        touch_pad_down,
        now,
        sys_interaction,
        btn_boot_down);

    while (s_button_policy.get_pending_action_count() > 0) {
        ButtonAction action = s_button_policy.pop_action();
        switch (action) {
            case ButtonAction::VOICE_START:
                if (getState() == JoyState::IDLE && !joy_ble_is_active()) {
                    if (wakeword_task()) {
                        audio_triggerWakeAck();
                    }
                }
                break;
            case ButtonAction::VOICE_STOP:
                request_finish_recording();
                break;
            case ButtonAction::BLE_OPEN_DISCOVERY: {
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
                break;
            }
            case ButtonAction::BLE_PHYSICAL_CONFIRM:
                ESP_LOGI(TAG, "=======================================================");
                ESP_LOGI(TAG, ">>> PHYSICAL PROOF 2S HOLD CONFIRMED & SENT VIA BLE! <<<");
                ESP_LOGI(TAG, "=======================================================");
                joy_ble_on_physical_hold_2s();
                break;
            case ButtonAction::EXPRESSION_ASSET_11:
                display_trigger_expression_overlay();
                break;
            case ButtonAction::TOUCH_ASSET_6:
                display_trigger_touch_overlay();
                break;
            case ButtonAction::VOLUME_UP:
                audio_adjustVolume(VOLUME_STEP);
                ESP_LOGI(TAG, "Volume up: %d", audio_getVolume());
                break;
            case ButtonAction::VOLUME_DOWN:
                audio_adjustVolume(-VOLUME_STEP);
                ESP_LOGI(TAG, "Volume down: %d", audio_getVolume());
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

    // Touch is handled by ButtonPolicy; it never confirms a pairing challenge.

}
