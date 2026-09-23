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

static bool read_touch_level()
{
#if defined(PIN_TOUCH_PAD) && (PIN_TOUCH_PAD >= 0)
    return (gpio_get_level((gpio_num_t)PIN_TOUCH_PAD) == 1);
#else
    return false;
#endif
}


//--------------------------------------------------

void button_init()
{
#if defined(PIN_TOUCH_PAD) && (PIN_TOUCH_PAD >= 0)
    gpio_reset_pin((gpio_num_t)PIN_TOUCH_PAD);
    gpio_config_t touch_config = {};
    touch_config.pin_bit_mask = (1ULL << PIN_TOUCH_PAD);
    touch_config.mode = GPIO_MODE_INPUT;
    touch_config.pull_up_en = GPIO_PULLUP_DISABLE;
    touch_config.pull_down_en = GPIO_PULLDOWN_ENABLE;
    touch_config.intr_type = GPIO_INTR_DISABLE;
    ESP_ERROR_CHECK(gpio_config(&touch_config));
    ESP_LOGI(TAG, "Digital Touch Sensor initialized on GPIO %d (Active-HIGH, Pull-Down)", PIN_TOUCH_PAD);
#else
    ESP_LOGI(TAG, "Touch sensor disabled (PIN_TOUCH_PAD < 0)");
#endif

    const gpio_num_t all_button_pins[] = {
        (gpio_num_t)PIN_BTN_VOICE,        // A1 (GPIO 20)
        (gpio_num_t)PIN_BTN_PAIR,         // A2 (GPIO 21)
        (gpio_num_t)PIN_BTN_EXPRESSION,   // A3 (GPIO 47)
        (gpio_num_t)PIN_BTN_VOL_UP,       // A4 (GPIO 48)
        (gpio_num_t)PIN_BTN_VOL_DOWN,     // A5 (GPIO 45)
        (gpio_num_t)PIN_BTN_SPOTIFY_NEXT, // A6 (GPIO 0)
        (gpio_num_t)PIN_BTN_SPOTIFY_PREV  // A7 (GPIO 38)
    };

    uint64_t pin_mask = 0;
    for (gpio_num_t pin : all_button_pins) {
        if ((int)pin >= 0) {
            gpio_reset_pin(pin);
            gpio_set_direction(pin, GPIO_MODE_INPUT);
            gpio_set_pull_mode(pin, GPIO_PULLUP_ONLY);
            pin_mask |= (1ULL << pin);
        }
    }

    gpio_config_t button_config = {};
    button_config.pin_bit_mask = pin_mask;
    button_config.mode = GPIO_MODE_INPUT;
    button_config.pull_up_en = GPIO_PULLUP_ENABLE;
    button_config.pull_down_en = GPIO_PULLDOWN_DISABLE;
    button_config.intr_type = GPIO_INTR_DISABLE;
    ESP_ERROR_CHECK(gpio_config(&button_config));

    ESP_LOGI(TAG, "7 Physical Buttons initialized (Active-LOW, Internal Pull-Up):");
    ESP_LOGI(TAG, "  A1_VOICE       -> GPIO %d", PIN_BTN_VOICE);
    ESP_LOGI(TAG, "  A2_PAIR        -> GPIO %d", PIN_BTN_PAIR);
    ESP_LOGI(TAG, "  A3_EXPRESSION  -> GPIO %d", PIN_BTN_EXPRESSION);
    ESP_LOGI(TAG, "  A4_VOLUME_UP   -> GPIO %d", PIN_BTN_VOL_UP);
    ESP_LOGI(TAG, "  A5_VOLUME_DOWN -> GPIO %d", PIN_BTN_VOL_DOWN);
    ESP_LOGI(TAG, "  A6_SPOTIFY_NEXT-> GPIO %d", PIN_BTN_SPOTIFY_NEXT);
    ESP_LOGI(TAG, "  A7_SPOTIFY_PREV-> GPIO %d", PIN_BTN_SPOTIFY_PREV);

    s_button_policy.reset();
}

//--------------------------------------------------

void button_update()
{
    int64_t now = esp_timer_get_time();

    // Direct pin reads (Active-LOW: 0 = pressed/grounded, 1 = idle/high)
    const bool btn_voice_down     = (gpio_get_level((gpio_num_t)PIN_BTN_VOICE) == 0);
    const bool btn_pair_down      = (gpio_get_level((gpio_num_t)PIN_BTN_PAIR) == 0);
    const bool btn_expr_down      = (gpio_get_level((gpio_num_t)PIN_BTN_EXPRESSION) == 0);
    const bool btn_vol_up         = (gpio_get_level((gpio_num_t)PIN_BTN_VOL_UP) == 0);
    const bool btn_vol_dn         = (gpio_get_level((gpio_num_t)PIN_BTN_VOL_DOWN) == 0);
    const bool btn_spot_next_down = (gpio_get_level((gpio_num_t)PIN_BTN_SPOTIFY_NEXT) == 0);
    const bool btn_spot_prev_down = (gpio_get_level((gpio_num_t)PIN_BTN_SPOTIFY_PREV) == 0);
    const bool touch_pad_down     = read_touch_level();
    const bool btn_boot_down      = false;

    // Responsive real-time edge detection log for every button
    static bool prev_voice = false;
    static bool prev_pair = false;
    static bool prev_expr = false;
    static bool prev_vol_up = false;
    static bool prev_vol_dn = false;
    static bool prev_spot_next = false;
    static bool prev_spot_prev = false;
    static bool prev_touch = false;
    static int64_t last_status_log_us = 0;

    if (btn_voice_down != prev_voice) {
        prev_voice = btn_voice_down;
        ESP_LOGI(TAG, ">> [PIN EVENT] A1_VOICE (GPIO %d) -> %s (level=%d)",
                 PIN_BTN_VOICE, btn_voice_down ? "GROUNDED (PRESSED)" : "HIGH (RELEASED)", btn_voice_down ? 0 : 1);
    }
    if (btn_pair_down != prev_pair) {
        prev_pair = btn_pair_down;
        ESP_LOGI(TAG, ">> [PIN EVENT] A2_PAIR (GPIO %d) -> %s (level=%d)",
                 PIN_BTN_PAIR, btn_pair_down ? "GROUNDED (PRESSED)" : "HIGH (RELEASED)", btn_pair_down ? 0 : 1);
    }
    if (btn_expr_down != prev_expr) {
        prev_expr = btn_expr_down;
        ESP_LOGI(TAG, ">> [PIN EVENT] A3_EXPRESSION (GPIO %d) -> %s (level=%d)",
                 PIN_BTN_EXPRESSION, btn_expr_down ? "GROUNDED (PRESSED)" : "HIGH (RELEASED)", btn_expr_down ? 0 : 1);
    }
    if (btn_vol_up != prev_vol_up) {
        prev_vol_up = btn_vol_up;
        ESP_LOGI(TAG, ">> [PIN EVENT] A4_VOLUME_UP (GPIO %d) -> %s (level=%d)",
                 PIN_BTN_VOL_UP, btn_vol_up ? "GROUNDED (PRESSED)" : "HIGH (RELEASED)", btn_vol_up ? 0 : 1);
    }
    if (btn_vol_dn != prev_vol_dn) {
        prev_vol_dn = btn_vol_dn;
        ESP_LOGI(TAG, ">> [PIN EVENT] A5_VOLUME_DOWN (GPIO %d) -> %s (level=%d)",
                 PIN_BTN_VOL_DOWN, btn_vol_dn ? "GROUNDED (PRESSED)" : "HIGH (RELEASED)", btn_vol_dn ? 0 : 1);
    }
    if (btn_spot_next_down != prev_spot_next) {
        prev_spot_next = btn_spot_next_down;
        ESP_LOGI(TAG, ">> [PIN EVENT] A6_SPOTIFY_NEXT (GPIO %d) -> %s (level=%d)",
                 PIN_BTN_SPOTIFY_NEXT, btn_spot_next_down ? "GROUNDED (PRESSED)" : "HIGH (RELEASED)", btn_spot_next_down ? 0 : 1);
    }
    if (btn_spot_prev_down != prev_spot_prev) {
        prev_spot_prev = btn_spot_prev_down;
        ESP_LOGI(TAG, ">> [PIN EVENT] A7_SPOTIFY_PREV (GPIO %d) -> %s (level=%d)",
                 PIN_BTN_SPOTIFY_PREV, btn_spot_prev_down ? "GROUNDED (PRESSED)" : "HIGH (RELEASED)", btn_spot_prev_down ? 0 : 1);
    }
    if (touch_pad_down != prev_touch) {
        prev_touch = touch_pad_down;
        ESP_LOGI(TAG, ">> [PIN EVENT] TOUCH_SENSOR (GPIO %d) -> %s (level=%d)",
                 PIN_TOUCH_PAD, touch_pad_down ? "TOUCHED (HIGH)" : "RELEASED (LOW)", touch_pad_down ? 1 : 0);
    }

    // Periodic live levels every 2 seconds
    if (now - last_status_log_us >= 2000000LL) {
        last_status_log_us = now;
        ESP_LOGI(TAG, "[PIN LIVE LEVELS] A1(%d)=%d A2(%d)=%d A3(%d)=%d A4(%d)=%d A5(%d)=%d A6(%d)=%d A7(%d)=%d TOUCH(%d)=%d",
                 PIN_BTN_VOICE, btn_voice_down ? 0 : 1,
                 PIN_BTN_PAIR, btn_pair_down ? 0 : 1,
                 PIN_BTN_EXPRESSION, btn_expr_down ? 0 : 1,
                 PIN_BTN_VOL_UP, btn_vol_up ? 0 : 1,
                 PIN_BTN_VOL_DOWN, btn_vol_dn ? 0 : 1,
                 PIN_BTN_SPOTIFY_NEXT, btn_spot_next_down ? 0 : 1,
                 PIN_BTN_SPOTIFY_PREV, btn_spot_prev_down ? 0 : 1,
                 PIN_TOUCH_PAD, touch_pad_down ? 1 : 0);
    }

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
                ESP_LOGI(TAG, ">>> [ACTION EXECUTED] VOICE_START (A1 pressed: recording started) <<<");
                if (getState() == JoyState::IDLE) {
                    if (wakeword_task()) {
                        audio_triggerWakeAck();
                    }
                }
                break;
            case ButtonAction::VOICE_STOP:
                ESP_LOGI(TAG, ">>> [ACTION EXECUTED] VOICE_STOP (A1 pressed: recording stopped & uploading) <<<");
                audio_playRecordingFinishedCue();
                request_finish_recording();
                break;
            case ButtonAction::BLE_OPEN_DISCOVERY: {
                ESP_LOGI(TAG, ">>> [ACTION EXECUTED] BLE_OPEN_DISCOVERY (A2 held 3s: opening 2-min pairing window) <<<");
                const joy_runtime_creds_t *runtime = joy_runtime_get();
                const bool was_provisioned = (runtime && runtime->is_provisioned);
                if (was_provisioned) {
                    joy_ble_unpair();
                    joy_ble_start_pairing_window();
                } else {
                    joy_ble_start_pairing_window();
                }
                audio_playBleActivated();
                break;
            }
            case ButtonAction::BLE_PHYSICAL_CONFIRM:
                ESP_LOGI(TAG, "=======================================================");
                ESP_LOGI(TAG, ">>> PHYSICAL PROOF 2S HOLD CONFIRMED & SENT VIA BLE! <<<");
                ESP_LOGI(TAG, "=======================================================");
                joy_ble_on_physical_hold_2s();
                audio_triggerExpressionAudio(2); // Play "I am excited" (03.wav)
                break;
            case ButtonAction::EXPRESSION_ASSET_11:
                ESP_LOGI(TAG, ">>> [ACTION EXECUTED] EXPRESSION_ASSET_11 (A3 pressed: Bad Face / Muka Jelek) <<<");
                display_trigger_expression_overlay();
                audio_playGoofyBoingCue(); // Cartoon goofy wobble-boing ("Bleeeh! :P")
                break;
            case ButtonAction::TOUCH_ASSET_6:
                ESP_LOGI(TAG, ">>> [ACTION EXECUTED] Touch Sensor (GPIO %d): Tap-to-Talk / Touch-to-Wake (recording started) <<<", PIN_TOUCH_PAD);
                if (getState() == JoyState::IDLE) {
                    if (wakeword_task()) {
                        audio_triggerWakeAck();
                    }
                }
                break;
            case ButtonAction::VOLUME_UP:
                audio_adjustVolume(VOLUME_STEP);
                ESP_LOGI(TAG, ">>> [ACTION EXECUTED] VOLUME_UP (A4 pressed: Volume %d%%) <<<", audio_getVolume());
                audio_playVolumeUpCue(); // Rising beep at new volume
                break;
            case ButtonAction::VOLUME_DOWN:
                audio_adjustVolume(-VOLUME_STEP);
                ESP_LOGI(TAG, ">>> [ACTION EXECUTED] VOLUME_DOWN (A5 pressed: Volume %d%%) <<<", audio_getVolume());
                audio_playVolumeDownCue(); // Falling beep at new volume
                break;
            case ButtonAction::SPOTIFY_NEXT:
                ESP_LOGI(TAG, ">>> [ACTION EXECUTED] SPOTIFY_NEXT (A6 pressed: Spotify Next Track) <<<");
                audio_playSpotifyNextCue(); // Fast forward skip cue
                api_spotify_queue_action(1);
                break;
            case ButtonAction::SPOTIFY_PREV:
                ESP_LOGI(TAG, ">>> [ACTION EXECUTED] SPOTIFY_PREV (A7 pressed: Spotify Previous Track) <<<");
                audio_playSpotifyPrevCue(); // Fast backward skip cue
                api_spotify_queue_action(2);
                break;
            default:
                break;
        }
    }
    // Touch is handled by ButtonPolicy; it never confirms a pairing challenge.

}
