#include "button.h"

#include "audio.h"
#include "display.h"
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
#define TOUCH_COOLDOWN_US 500000LL

static const char *TAG="BUTTON";

static int64_t last_up_us = 0;
static int64_t last_down_us = 0;
static int64_t last_touch_us = 0;

static bool last_touch_level = false;

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

    bool volume_up_pressed =
        gpio_get_level(BTN_VOL_UP) == 0;

    bool volume_down_pressed =
        gpio_get_level(BTN_VOL_DOWN) == 0;

    if(volume_up_pressed &&
       now - last_up_us > BUTTON_REPEAT_US)
    {
        last_up_us = now;
        audio_adjustVolume(VOLUME_STEP);

        ESP_LOGI(
            TAG,
            "Volume up: %d",
            audio_getVolume());
    }

    if(volume_down_pressed &&
       now - last_down_us > BUTTON_REPEAT_US)
    {
        last_down_us = now;
        audio_adjustVolume(-VOLUME_STEP);

        ESP_LOGI(
            TAG,
            "Volume down: %d",
            audio_getVolume());
    }

    bool touch_level =
        gpio_get_level(TOUCH_PIN) == 1;

    if(touch_level &&
       !last_touch_level &&
       now - last_touch_us > TOUCH_COOLDOWN_US)
    {
        last_touch_us = now;

        ESP_LOGI(
            TAG,
            "Touch detected");

        if (getState() == BMOState::IDLE)
        {
            wakeword_task();
        }
    }

    last_touch_level = touch_level;
}
