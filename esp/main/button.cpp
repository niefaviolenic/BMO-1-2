#include "button.h"

#include "api.h"
#include "audio.h"
#include "display.h"
#include "hardware_config.h"
#include "state.h"
#include "wakeword.h"

#include "driver/gpio.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <stdint.h>

//--------------------------------------------------
// BMO2 button layout.
//--------------------------------------------------

static constexpr int VOLUME_STEP = 5;
static constexpr int64_t BUTTON_DEBOUNCE_US = 30000LL;
static constexpr int64_t BLUETOOTH_HOLD_US = 3000000LL;
static constexpr int64_t BLUETOOTH_WAIT_US = 120000000LL;

static const char *TAG = "BUTTON";

enum class ButtonId : uint8_t
{
    A1_WAKE,
    A2_BLUETOOTH,
    A3_BAD_FACE,
    A4_VOLUME_UP,
    A5_VOLUME_DOWN,
    A6_SPOTIFY_NEXT,
    A7_SPOTIFY_PREVIOUS,
};

struct DebouncedButton
{
    ButtonId id;
    const char *name;
    gpio_num_t pin;
    bool candidate_pressed;
    bool stable_pressed;
    int64_t candidate_since_us;
    int64_t pressed_since_us;
    bool long_action_fired;
};

static DebouncedButton buttons[] = {
    {ButtonId::A1_WAKE, "A1_TRIANGLE", static_cast<gpio_num_t>(BMO2_BUTTON_A1_GPIO), false, false, 0, 0, false},
    {ButtonId::A2_BLUETOOTH, "A2_SMALL_CIRCLE", static_cast<gpio_num_t>(BMO2_BUTTON_A2_GPIO), false, false, 0, 0, false},
    {ButtonId::A3_BAD_FACE, "A3_LARGE_CIRCLE", static_cast<gpio_num_t>(BMO2_BUTTON_A3_GPIO), false, false, 0, 0, false},
    {ButtonId::A4_VOLUME_UP, "A4_UP", static_cast<gpio_num_t>(BMO2_BUTTON_A4_GPIO), false, false, 0, 0, false},
    {ButtonId::A5_VOLUME_DOWN, "A5_DOWN", static_cast<gpio_num_t>(BMO2_BUTTON_A5_GPIO), false, false, 0, 0, false},
    {ButtonId::A6_SPOTIFY_NEXT, "A6_RIGHT", static_cast<gpio_num_t>(BMO2_BUTTON_A6_GPIO), false, false, 0, 0, false},
    {ButtonId::A7_SPOTIFY_PREVIOUS, "A7_LEFT", static_cast<gpio_num_t>(BMO2_BUTTON_A7_GPIO), false, false, 0, 0, false},
};

static int64_t bluetooth_wait_until_us = 0;

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

static bool display_overlay_is_active()
{
    return display_pairing_code_is_visible() || display_qr_code_is_visible();
}

// Returns true only once, when a debounced button becomes pressed.
static bool update_debounced_button(
    DebouncedButton &button,
    bool pressed,
    int64_t now_us)
{
    if (pressed != button.candidate_pressed)
    {
        button.candidate_pressed = pressed;
        button.candidate_since_us = now_us;
    }

    if (button.candidate_pressed != button.stable_pressed &&
        now_us - button.candidate_since_us >= BUTTON_DEBOUNCE_US)
    {
        button.stable_pressed = button.candidate_pressed;

        if (button.stable_pressed)
        {
            button.pressed_since_us = now_us;
            button.long_action_fired = false;
            ESP_LOGI(TAG, "%s pressed", button.name);
            return true;
        }

        button.pressed_since_us = 0;
        button.long_action_fired = false;
        ESP_LOGI(TAG, "%s released", button.name);
    }

    return false;
}

static void start_spotify_control_task(void *param)
{
    const bool next = reinterpret_cast<intptr_t>(param) != 0;
    const bool success = next ? api_spotify_next() : api_spotify_previous();
    ESP_LOGI(TAG, "Spotify %s result=%d", next ? "next" : "previous", success ? 1 : 0);
    vTaskDelete(NULL);
}

static void dispatch_spotify_control(bool next)
{
    BaseType_t result = xTaskCreate(
        start_spotify_control_task,
        next ? "spotify_next" : "spotify_previous",
        4096,
        reinterpret_cast<void *>(static_cast<intptr_t>(next ? 1 : 0)),
        3,
        NULL);

    if (result != pdPASS)
    {
        ESP_LOGW(TAG, "Spotify %s task could not be created", next ? "next" : "previous");
    }
}

static void handle_a1()
{
    if (display_overlay_is_active())
    {
        ESP_LOGW(TAG, "A1 ignored while pairing or QR overlay is visible");
        return;
    }

    JoyState state = getState();
    if (state == JoyState::RECORDING)
    {
        // A1 while recording closes the current voice capture as a valid WAV;
        // the state machine then continues with the normal backend upload.
        const bool finished = finish_recording("button_a1");
        ESP_LOGI(TAG, "A1 finished recording for backend upload=%d", finished ? 1 : 0);
        return;
    }

    if (state == JoyState::SPEAKING ||
        state == JoyState::THINKING ||
        state == JoyState::ERROR_STATE)
    {
        api_cancel_current_voice();
        setState(JoyState::IDLE);
        state = JoyState::IDLE;
    }

    if (state == JoyState::IDLE)
    {
        audio_triggerWakeAck();
        const bool recording_started = wakeword_task();
        ESP_LOGI(TAG, "A1 wake/voice trigger accepted=%d", recording_started ? 1 : 0);
    }
    else
    {
        ESP_LOGW(TAG, "A1 ignored in state=%s", joy_state_name(state));
    }
}

static void handle_a2_bluetooth_long_press(int64_t now_us)
{
    if (bluetooth_wait_until_us > now_us)
    {
        ESP_LOGI(TAG, "A2 wireless pairing window already active for %lld ms",
                 (long long)((bluetooth_wait_until_us - now_us) / 1000LL));
        return;
    }

    bluetooth_wait_until_us = now_us + BLUETOOTH_WAIT_US;

    // The current firmware exposes the existing authenticated pairing request
    // as the wireless-pairing hook. The BMO2 button timing is local and remains
    // two minutes even when the backend is temporarily offline.
    const bool requested = api_request_pairing_mode();
    ESP_LOGI(TAG, "A2 Bluetooth/pairing enabled for 120 seconds requested=%d",
             requested ? 1 : 0);
}

static void handle_a3_bad_face()
{
    if (display_overlay_is_active() || getState() != JoyState::IDLE)
    {
        ESP_LOGW(TAG, "A3 ignored: state=%s overlay=%d",
                 joy_state_name(getState()), display_overlay_is_active() ? 1 : 0);
        return;
    }

    display_set_idle_face(FACE_ANGRY);
    audio_triggerExpressionAudio(static_cast<int>(FACE_ANGRY));
    ESP_LOGI(TAG, "A3 rendered bad face=ANGRY");
}

static void handle_button_press(ButtonId id)
{
    switch(id)
    {
        case ButtonId::A1_WAKE:
            handle_a1();
            break;
        case ButtonId::A3_BAD_FACE:
            handle_a3_bad_face();
            break;
        case ButtonId::A4_VOLUME_UP:
            audio_adjustVolume(VOLUME_STEP);
            ESP_LOGI(TAG, "A4 volume up: %d", audio_getVolume());
            break;
        case ButtonId::A5_VOLUME_DOWN:
            audio_adjustVolume(-VOLUME_STEP);
            ESP_LOGI(TAG, "A5 volume down: %d", audio_getVolume());
            break;
        case ButtonId::A6_SPOTIFY_NEXT:
            dispatch_spotify_control(true);
            break;
        case ButtonId::A7_SPOTIFY_PREVIOUS:
            dispatch_spotify_control(false);
            break;
        case ButtonId::A2_BLUETOOTH:
            // A2 is intentionally long-press only.
            break;
    }
}

void button_init()
{
    uint64_t pin_mask = 0;
    for (const DebouncedButton &button : buttons)
        pin_mask |= 1ULL << button.pin;

    gpio_config_t button_config = {};
    button_config.pin_bit_mask = pin_mask;
    button_config.mode = GPIO_MODE_INPUT;
    button_config.pull_up_en = GPIO_PULLUP_ENABLE;
    button_config.pull_down_en = GPIO_PULLDOWN_DISABLE;
    button_config.intr_type = GPIO_INTR_DISABLE;

    ESP_ERROR_CHECK(gpio_config(&button_config));

    const int64_t now_us = esp_timer_get_time();
    for (DebouncedButton &button : buttons)
    {
        const bool pressed = gpio_get_level(button.pin) == 0;
        button.candidate_pressed = pressed;
        button.stable_pressed = pressed;
        button.candidate_since_us = now_us;
        button.pressed_since_us = pressed ? now_us : 0;
        // Do not fire an action for a button that was already held at boot.
        button.long_action_fired = pressed;
    }

    ESP_LOGI(
        TAG,
        "BMO2 inputs ready: A1=%d A2=%d A3=%d A4=%d A5=%d A6=%d A7=%d",
        BMO2_BUTTON_A1_GPIO,
        BMO2_BUTTON_A2_GPIO,
        BMO2_BUTTON_A3_GPIO,
        BMO2_BUTTON_A4_GPIO,
        BMO2_BUTTON_A5_GPIO,
        BMO2_BUTTON_A6_GPIO,
        BMO2_BUTTON_A7_GPIO);
}

void button_update()
{
    const int64_t now_us = esp_timer_get_time();

    for (DebouncedButton &button : buttons)
    {
        const bool pressed = gpio_get_level(button.pin) == 0;
        if (update_debounced_button(button, pressed, now_us))
            handle_button_press(button.id);

        if (button.id == ButtonId::A2_BLUETOOTH &&
            button.stable_pressed &&
            !button.long_action_fired &&
            button.pressed_since_us > 0 &&
            now_us - button.pressed_since_us >= BLUETOOTH_HOLD_US)
        {
            button.long_action_fired = true;
            handle_a2_bluetooth_long_press(now_us);
        }
    }
}
