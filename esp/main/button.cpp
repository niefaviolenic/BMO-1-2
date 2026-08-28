#include "button.h"

#include "audio.h"
#include "display.h"
#include "pairing.h"
#include "state.h"
#include "wakeword.h"
#include "driver/gpio.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_timer.h"

//--------------------------------------------------
// Touch + volume input pins.
//--------------------------------------------------

#define TOUCH_PIN      GPIO_NUM_14
#define BTN_VOL_UP    GPIO_NUM_15
#define BTN_VOL_DOWN  GPIO_NUM_16

#define VOLUME_STEP 5
#define BUTTON_REPEAT_US 180000LL
#define BUTTON_DEBOUNCE_US 30000LL
#define TOUCH_DEBOUNCE_US 30000LL

static const char *TAG="BUTTON";

static int64_t last_up_us = 0;
static int64_t last_down_us = 0;
static int64_t vol_up_press_start_us = 0;
static int64_t vol_down_press_start_us = 0;
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
    gpio_config_t touch_config = {};

    touch_config.pin_bit_mask = 1ULL << TOUCH_PIN;
    touch_config.mode = GPIO_MODE_INPUT;
    touch_config.pull_up_en = GPIO_PULLUP_DISABLE;
    touch_config.pull_down_en = GPIO_PULLDOWN_ENABLE;
    touch_config.intr_type = GPIO_INTR_DISABLE;

    ESP_ERROR_CHECK(
        gpio_config(
            &touch_config));

    gpio_config_t button_config = {};

    button_config.pin_bit_mask =
        (1ULL << BTN_VOL_UP) |
        (1ULL << BTN_VOL_DOWN);

    button_config.mode = GPIO_MODE_INPUT;
    button_config.pull_up_en = GPIO_PULLUP_ENABLE;
    button_config.pull_down_en = GPIO_PULLDOWN_DISABLE;
    button_config.intr_type = GPIO_INTR_DISABLE;

    ESP_ERROR_CHECK(
        gpio_config(
            &button_config));

    const int64_t now = esp_timer_get_time();
    const bool touch_level = gpio_get_level(TOUCH_PIN) == 1;

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
        "Input ready: touch=%d vol_up=%d vol_down=%d",
        TOUCH_PIN,
        BTN_VOL_UP,
        BTN_VOL_DOWN);
}

//--------------------------------------------------

void button_update()
{
    int64_t now = esp_timer_get_time();

    bool volume_up_raw =
        gpio_get_level(BTN_VOL_UP) == 0;

    bool volume_down_raw =
        gpio_get_level(BTN_VOL_DOWN) == 0;

    if(volume_up_raw)
    {
        if(vol_up_press_start_us == 0)
            vol_up_press_start_us = now;
        else if(now - vol_up_press_start_us >= BUTTON_DEBOUNCE_US &&
                now - last_up_us > BUTTON_REPEAT_US)
        {
            last_up_us = now;
            audio_adjustVolume(VOLUME_STEP);

            ESP_LOGI(
                TAG,
                "Volume up: %d",
                audio_getVolume());
        }
    }
    else
    {
        vol_up_press_start_us = 0;
    }

    if(volume_down_raw)
    {
        if(vol_down_press_start_us == 0)
            vol_down_press_start_us = now;
        else if(now - vol_down_press_start_us >= BUTTON_DEBOUNCE_US &&
                now - last_down_us > BUTTON_REPEAT_US)
        {
            last_down_us = now;
            audio_adjustVolume(-VOLUME_STEP);

            ESP_LOGI(
                TAG,
                "Volume down: %d",
                audio_getVolume());
        }
    }
    else
    {
        vol_down_press_start_us = 0;
    }

    bool touch_level =
        gpio_get_level(TOUCH_PIN) == 1;

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
                        const JoyState state_before = getState();

                        // Single tap touch trigger: waking up Joy (alternative to wake word)
                        audio_triggerWakeAck();
                        wakeword_task();

                        ESP_LOGI(
                            TAG,
                            "Touch accepted: Joy state before=%s - waking up to RECORDING",
                            joy_state_name(state_before));
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
            // Only a stable LOW release re-arms the physical input. This is
            // also the boot-high lockout exit path.
            touch_state = TouchLifecycleState::TOUCH_ARMED;
            ESP_LOGI(
                TAG,
                "Touch lifecycle: %s",
                touch_lifecycle_name(touch_state));
        }
    }
}
