#include "wakeword.h"

#include <stdint.h>
#include <stdlib.h>

#include "audio.h"
#include "display.h"
#include "state.h"

#include "driver/gpio.h"
#include "driver/i2s_std.h"
#include "esp_check.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_wn_iface.h"
#include "esp_wn_models.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "model_path.h"

static const char *TAG = "WAKE";

//--------------------------------------------------
// I2S microphone pins.
// Ubah ini kalau wiring mic kamu beda.
//--------------------------------------------------

#define WAKEWORD_I2S_BCLK GPIO_NUM_5
#define WAKEWORD_I2S_WS   GPIO_NUM_4
#define WAKEWORD_I2S_DIN  GPIO_NUM_6

//--------------------------------------------------

#define WAKEWORD_MODEL_PARTITION "model"
#define WAKEWORD_MODEL_KEYWORD   "hijoy"

#define WAKEWORD_TASK_STACK_SIZE 8192
#define WAKEWORD_TASK_PRIORITY   5
#define WAKEWORD_COOLDOWN_MS     2500

#define RECORD_DURATION_SEC 4
#define RECORD_SAMPLE_RATE 16000
#define RECORD_BUFFER_SIZE (RECORD_SAMPLE_RATE * RECORD_DURATION_SEC) // 64000 samples

static i2s_chan_handle_t i2s_rx_handle = NULL;

static srmodel_list_t *sr_models = NULL;

static const esp_wn_iface_t *wakenet = NULL;

static model_iface_data_t *wakenet_data = NULL;

static int16_t *sample_buffer = NULL;

static int32_t *raw_i2s_buffer = NULL;

static int wakeword_chunk_size = 0;

static TaskHandle_t wakeword_task_handle = NULL;

// Buffer rekaman suara untuk dikirim ke backend
static int16_t *record_buffer = NULL;
static int record_index = 0;
static bool recording_active = false;

//--------------------------------------------------

static int sample_peak(
    const int16_t *samples,
    int count)
{
    int peak = 0;

    for(int i = 0; i < count; i++)
    {
        int value = samples[i];

        if(value < 0)
            value = -value;

        if(value > peak)
            peak = value;
    }

    return peak;
}

//--------------------------------------------------

static esp_err_t wakeword_i2s_init(
    int sample_rate)
{
    if(i2s_rx_handle != NULL)
        return ESP_OK;

    i2s_chan_config_t channel_config =
        I2S_CHANNEL_DEFAULT_CONFIG(
            I2S_NUM_AUTO,
            I2S_ROLE_MASTER);

    ESP_RETURN_ON_ERROR(
        i2s_new_channel(
            &channel_config,
            NULL,
            &i2s_rx_handle),
        TAG,
        "I2S channel create failed");

    i2s_std_config_t std_config = {};

    std_config.clk_cfg =
        I2S_STD_CLK_DEFAULT_CONFIG(
            static_cast<uint32_t>(sample_rate));

    std_config.slot_cfg =
        I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
            I2S_DATA_BIT_WIDTH_32BIT,
            I2S_SLOT_MODE_MONO);

    std_config.slot_cfg.slot_mask =
        I2S_STD_SLOT_LEFT;

    std_config.gpio_cfg.mclk =
        I2S_GPIO_UNUSED;

    std_config.gpio_cfg.bclk =
        WAKEWORD_I2S_BCLK;

    std_config.gpio_cfg.ws =
        WAKEWORD_I2S_WS;

    std_config.gpio_cfg.dout =
        I2S_GPIO_UNUSED;

    std_config.gpio_cfg.din =
        WAKEWORD_I2S_DIN;

    std_config.gpio_cfg.invert_flags.mclk_inv =
        false;

    std_config.gpio_cfg.invert_flags.bclk_inv =
        false;

    std_config.gpio_cfg.invert_flags.ws_inv =
        false;

    ESP_RETURN_ON_ERROR(
        i2s_channel_init_std_mode(
            i2s_rx_handle,
            &std_config),
        TAG,
        "I2S std init failed");

    ESP_RETURN_ON_ERROR(
        i2s_channel_enable(
            i2s_rx_handle),
        TAG,
        "I2S enable failed");

    ESP_LOGI(
        TAG,
        "I2S mic ready: BCLK=%d WS=%d DIN=%d rate=%d",
        WAKEWORD_I2S_BCLK,
        WAKEWORD_I2S_WS,
        WAKEWORD_I2S_DIN,
        sample_rate);

    return ESP_OK;
}

//--------------------------------------------------

static void wakeword_listener_task(
    void *arg)
{
    (void)arg;

    int frame_count = 0;

    ESP_LOGI(
        TAG,
        "Listening for Hi Joy");

    while(true)
    {
        size_t bytes_read = 0;

        esp_err_t read_result =
            i2s_channel_read(
                i2s_rx_handle,
                raw_i2s_buffer,
                wakeword_chunk_size * sizeof(int32_t),
                &bytes_read,
                portMAX_DELAY);

        if(read_result != ESP_OK)
        {
            ESP_LOGW(
                TAG,
                "I2S read failed: %s",
                esp_err_to_name(read_result));

            vTaskDelay(
                pdMS_TO_TICKS(50));

            continue;
        }

        int raw_samples =
            bytes_read / sizeof(int32_t);

        if(raw_samples < wakeword_chunk_size)
            continue;

        for(int i = 0; i < wakeword_chunk_size; i++)
        {
            sample_buffer[i] =
                (int16_t)(raw_i2s_buffer[i] >> 16);
        }

        frame_count++;

        if((frame_count % 100) == 0)
        {
            ESP_LOGI(
                TAG,
                "Mic peak: %d",
                sample_peak(
                    sample_buffer,
                    wakeword_chunk_size));
        }

        BMOState current_state = getState();

        if (current_state == BMOState::SLEEP)
        {
            wakenet_state_t detected =
                wakenet->detect(
                    wakenet_data,
                    sample_buffer);

            if(detected == WAKENET_DETECTED)
            {
                ESP_LOGI(
                    TAG,
                    "Hi Joy detected");

                wakeword_task();

                vTaskDelay(
                    pdMS_TO_TICKS(WAKEWORD_COOLDOWN_MS));
            }
        }
        else if (current_state == BMOState::LISTENING && recording_active)
        {
            for (int i = 0; i < wakeword_chunk_size; i++)
            {
                if (record_index < RECORD_BUFFER_SIZE)
                {
                    record_buffer[record_index++] = sample_buffer[i];
                }
                else
                {
                    recording_active = false;
                    ESP_LOGI(TAG, "Recording finished, buffer full");
                    break;
                }
            }
        }
    }
}

//--------------------------------------------------

void wakeword_init()
{
    if(wakeword_task_handle != NULL)
    {
        ESP_LOGW(
            TAG,
            "Wakeword already initialized");

        return;
    }

    sr_models =
        esp_srmodel_init(
            WAKEWORD_MODEL_PARTITION);

    if(sr_models == NULL)
    {
        ESP_LOGE(
            TAG,
            "No speech models found in partition '%s'",
            WAKEWORD_MODEL_PARTITION);

        return;
    }

    char *model_name =
        esp_srmodel_filter(
            sr_models,
            ESP_WN_PREFIX,
            WAKEWORD_MODEL_KEYWORD);

    if(model_name == NULL)
    {
        model_name =
            esp_srmodel_filter(
                sr_models,
                ESP_WN_PREFIX,
                NULL);
    }

    if(model_name == NULL)
    {
        ESP_LOGE(
            TAG,
            "No WakeNet model found");

        return;
    }

    char *wake_words =
        esp_srmodel_get_wake_words(
            sr_models,
            model_name);

    ESP_LOGI(
        TAG,
        "WakeNet model: %s",
        model_name);

    if(wake_words != NULL)
    {
        ESP_LOGI(
            TAG,
            "Wake words: %s",
            wake_words);

        free(
            wake_words);
    }

    wakenet =
        esp_wn_handle_from_name(
            model_name);

    if(wakenet == NULL)
    {
        ESP_LOGE(
            TAG,
            "WakeNet handle failed");

        return;
    }

    wakenet_data =
        wakenet->create(
            model_name,
            DET_MODE_90);

    if(wakenet_data == NULL)
    {
        ESP_LOGE(
            TAG,
            "WakeNet create failed");

        return;
    }

    wakeword_chunk_size =
        wakenet->get_samp_chunksize(
            wakenet_data);

    int sample_rate =
        wakenet->get_samp_rate(
            wakenet_data);

    int channel_count =
        wakenet->get_channel_num(
            wakenet_data);

    ESP_LOGI(
        TAG,
        "WakeNet sample_rate=%d chunk=%d channels=%d",
        sample_rate,
        wakeword_chunk_size,
        channel_count);

    if(channel_count != 1)
    {
        ESP_LOGE(
            TAG,
            "This wiring path supports mono WakeNet only");

        return;
    }

    sample_buffer =
        (int16_t *)calloc(
            wakeword_chunk_size,
            sizeof(int16_t));

    raw_i2s_buffer =
        (int32_t *)calloc(
            wakeword_chunk_size,
            sizeof(int32_t));

    if(sample_buffer == NULL ||
       raw_i2s_buffer == NULL)
    {
        ESP_LOGE(
            TAG,
            "Wakeword buffer allocation failed");

        return;
    }

    if(wakeword_i2s_init(sample_rate) != ESP_OK)
        return;

    BaseType_t task_created =
        xTaskCreatePinnedToCore(
            wakeword_listener_task,
            "wakeword_listener",
            WAKEWORD_TASK_STACK_SIZE,
            NULL,
            WAKEWORD_TASK_PRIORITY,
            &wakeword_task_handle,
            1);

    if(task_created != pdPASS)
    {
        ESP_LOGE(
            TAG,
            "Wakeword task create failed");

        wakeword_task_handle = NULL;

        return;
    }

    ESP_LOGI(
        TAG,
        "Wakeword initialized");
}

//--------------------------------------------------

void wakeword_task()
{
    setState(BMOState::WAKE);
    ESP_LOGI(TAG, "Wake detected");
}

//--------------------------------------------------

void start_recording()
{
    if (record_buffer == NULL)
    {
        record_buffer = (int16_t *)malloc(RECORD_BUFFER_SIZE * sizeof(int16_t));
        if (record_buffer == NULL)
        {
            ESP_LOGE(TAG, "Failed to allocate record buffer!");
            return;
        }
    }
    record_index = 0;
    recording_active = true;
    ESP_LOGI(TAG, "Recording started");
}

bool is_recording()
{
    return recording_active;
}

int16_t *get_record_buffer()
{
    return record_buffer;
}

size_t get_record_size()
{
    return record_index;
}
