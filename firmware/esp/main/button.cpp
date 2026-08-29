#include "button.h"

#include "audio.h"
#include "display.h"
#include "pairing.h"
#include "state.h"
#include "driver/gpio.h"
#include "driver/touch_sensor_legacy.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

//--------------------------------------------------
// Touch + volume input pins.
//--------------------------------------------------

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

// GPIO14 is an ESP32-S3 native touch channel. The previous implementation
// treated it only as a digital input, which cannot detect a bare capacitive
// pad. Keep the digital fallback if native touch setup is unavailable.
static constexpr touch_pad_t TOUCH_CHANNEL = TOUCH_PAD_NUM14;
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
    if(touch_pad_init() != ESP_OK)
        return false;

    if(touch_pad_set_fsm_mode(TOUCH_FSM_MODE_SW) != ESP_OK ||
       touch_pad_set_voltage(
           TOUCH_HVOLT_2V7,
           TOUCH_LVOLT_0V5,
           TOUCH_HVOLT_ATTEN_0V5) != ESP_OK ||
       touch_pad_set_idle_channel_connect(TOUCH_PAD_CONN_HIGHZ) != ESP_OK ||
       touch_pad_set_charge_discharge_times(500) != ESP_OK ||
       touch_pad_set_measurement_interval(0x0f) != ESP_OK ||
       touch_pad_set_cnt_mode(
           TOUCH_CHANNEL,
           TOUCH_PAD_SLOPE_7,
           TOUCH_PAD_TIE_OPT_FLOAT) != ESP_OK ||
       touch_pad_config(TOUCH_CHANNEL) != ESP_OK ||
       touch_pad_set_channel_mask(1U << TOUCH_CHANNEL) != ESP_OK)
    {
        (void)touch_pad_deinit();
        return false;
    }

    native_touch_enabled = true;
    native_touch_level = false;
    native_touch_baseline_ready = false;
    native_touch_raw = 0;
    native_touch_baseline = 0;
    native_touch_threshold = 0;
    native_touch_calibration_sum = 0;
    native_touch_calibration_samples = 0;

    return touch_pad_sw_start() == ESP_OK;
}

static bool native_touch_update()
{
    if(!native_touch_enabled || !touch_pad_meas_is_done())
        return native_touch_level;

    uint32_t raw = 0;
    if(touch_pad_read_raw_data(TOUCH_CHANNEL, &raw) != ESP_OK)
        return native_touch_level;

    native_touch_raw = raw;

    if(!native_touch_baseline_ready)
    {
        native_touch_calibration_sum += raw;
        native_touch_calibration_samples++;

        if(native_touch_calibration_samples >= 16)
        {
            native_touch_baseline = static_cast<uint32_t>(
                native_touch_calibration_sum /
                static_cast<uint64_t>(native_touch_calibration_samples));
            native_touch_threshold = native_touch_baseline / 20U;
            if(native_touch_threshold < 100U)
                native_touch_threshold = 100U;
            native_touch_baseline_ready = true;

            ESP_LOGI(
                TAG,
                "Native touch calibrated: baseline=%lu threshold=%lu",
                (unsigned long)native_touch_baseline,
                (unsigned long)native_touch_threshold);
        }
    }
    else
    {
        const uint32_t delta = raw >= native_touch_baseline ?
            raw - native_touch_baseline :
            native_touch_baseline - raw;
        native_touch_level = delta >= native_touch_threshold;

        // Track slow environmental drift only while the pad is released.
        if(!native_touch_level)
        {
            native_touch_baseline =
                (native_touch_baseline * 99U + raw) / 100U;
        }
    }

    (void)touch_pad_sw_start();
    return native_touch_level;
}

static bool read_touch_level()
{
    if(native_touch_enabled)
        return native_touch_update();

    return gpio_get_level(TOUCH_PIN) == 1;
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
}

//--------------------------------------------------

void button_update()
{
    int64_t now = esp_timer_get_time();

    if(update_debounced_button(BTN_VOL_UP, volume_up_state, now))
    {
        audio_adjustVolume(VOLUME_STEP);

        ESP_LOGI(
            TAG,
            "Volume up: %d",
            audio_getVolume());
    }

    if(update_debounced_button(BTN_VOL_DOWN, volume_down_state, now))
    {
        audio_adjustVolume(-VOLUME_STEP);

        ESP_LOGI(
            TAG,
            "Volume down: %d",
            audio_getVolume());
    }

    const bool expression_button_pressed =
        gpio_get_level(BTN_EXPRESSION) == 0;

    if(expression_button_pressed != expression_button_candidate_pressed)
    {
        expression_button_candidate_pressed = expression_button_pressed;
        expression_button_candidate_since_us = now;
    }

    if(expression_button_candidate_pressed != expression_button_stable_pressed &&
       now - expression_button_candidate_since_us >= BUTTON_DEBOUNCE_US)
    {
        expression_button_stable_pressed = expression_button_candidate_pressed;

        if(expression_button_stable_pressed)
        {
            if(getState() == JoyState::IDLE)
            {
                if(display_pairing_code_is_visible() ||
                   display_qr_code_is_visible() ||
                   pairing_get_snapshot().phase != PairingPhase::NONE)
                {
                    ESP_LOGW(
                        TAG,
                        "Expression button rejected: pairing or QR display active");
                }
                else
                {
                    const Face next_face = display_next_touch_face();
                    ESP_LOGI(
                        TAG,
                        "Expression button: selected face=%d; playing local expression audio",
                        (int)next_face);
                    audio_triggerExpressionAudio((int)next_face);
                }
            }
            else
            {
                ESP_LOGW(
                    TAG,
                    "Expression button rejected: state=%s (not IDLE)",
                    joy_state_name(getState()));
            }
        }
    }

    const bool touch_level = read_touch_level();

    if(now - last_touch_diag_us >= 2000000LL)
    {
        last_touch_diag_us = now;
        ESP_LOGI(
            TAG,
            "Touch sample: raw=%d candidate=%d stable=%d lifecycle=%s state=%s",
            touch_level ? 1 : 0,
            touch_candidate_level ? 1 : 0,
            touch_stable_level ? 1 : 0,
            touch_lifecycle_name(touch_state),
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
            if(touch_state == TouchLifecycleState::TOUCH_ARMED)
            {
                touch_state = TouchLifecycleState::TOUCH_CONSUMED;
                ESP_LOGI(
                    TAG,
                    "Touch lifecycle: %s",
                    touch_lifecycle_name(touch_state));

                if(getState() == JoyState::IDLE)
                {
                    if(display_pairing_code_is_visible() || display_qr_code_is_visible() || pairing_get_snapshot().phase != PairingPhase::NONE)
                    {
                        ESP_LOGW(TAG, "Touch rejected: robot is in pairing mode or QR display mode");
                    }
                    else
                    {
                        display_set_idle_face(FACE_HAPPY);
                        audio_triggerReadyAudio();
                        ESP_LOGI(
                            TAG,
                            "Touch accepted: idle HAPPY face rendered with local I'm ready audio");
                    }
                }
                else
                {
                    ESP_LOGW(
                        TAG,
                        "Touch rejected: state=%s (not IDLE)",
                        joy_state_name(getState()));
                }
            }
        }
        else
        {
            // Only a stable LOW/released state re-arms the physical input.
            touch_state = TouchLifecycleState::TOUCH_ARMED;
            ESP_LOGI(
                TAG,
                "Touch lifecycle: %s",
                touch_lifecycle_name(touch_state));
        }
    }
}
