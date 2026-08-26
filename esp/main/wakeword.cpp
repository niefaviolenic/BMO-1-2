#include "wakeword.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "audio.h"
#include "display.h"
#include "state.h"

#include "driver/gpio.h"
#include "driver/i2s_std.h"
#include "esp_check.h"
#include "esp_err.h"
#include "esp_heap_caps.h"
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
#define WAKEWORD_COOLDOWN_MS     1000
#define WAKEWORD_STARTUP_GUARD_MS 1000

#define RECORD_DURATION_SEC 60
#define RECORD_SAMPLE_RATE 16000
#define RECORD_MAX_SAMPLES (RECORD_SAMPLE_RATE * RECORD_DURATION_SEC) // 960000 samples

#define RECORD_BUFFER_SIZE (RECORD_MAX_SAMPLES + WAV_HEADER_SAMPLES)
#define PREROLL_BUFFER_SAMPLES 24000 // ~1.5s at 16kHz mono circular pre-roll buffer

#ifndef MIC_GAIN_NUMERATOR
#define MIC_GAIN_NUMERATOR 5
#endif
#ifndef MIC_GAIN_DENOMINATOR
#define MIC_GAIN_DENOMINATOR 2
#endif
#ifndef MIC_DIGITAL_GAIN_FACTOR
#define MIC_DIGITAL_GAIN_FACTOR 2.5f
#endif

#define SILENCE_THRESHOLD 400
#define RECORD_LEADING_SILENCE_TIMEOUT_MS 6000
#define RECORD_SILENCE_DURATION_MS 4000
#define RECORD_MIN_SPEECH_DURATION_MS 400
#define RECORD_I2S_READ_TIMEOUT_MS 100
#define RECORD_NO_SAMPLE_PROGRESS_TIMEOUT_MS 3000
#define RECORD_DIAGNOSTIC_INTERVAL_MS 1000
#pragma pack(push, 1)
struct WAVHeader {
    char riff[4];
    uint32_t overall_size;
    char wave[4];
    char fmt_chunk_marker[4];
    uint32_t length_of_fmt;
    uint16_t format_type;
    uint16_t channels;
    uint32_t sample_rate;
    uint32_t byterate;
    uint16_t block_align;
    uint16_t bits_per_sample;
    char data_chunk_header[4];
    uint32_t data_size;
};
#pragma pack(pop)

static void write_wav_header(int16_t *buf, uint32_t pcm_samples) {
    WAVHeader *header = (WAVHeader *)buf;
    memcpy(header->riff, "RIFF", 4);
    header->overall_size = 36 + pcm_samples * sizeof(int16_t);
    memcpy(header->wave, "WAVE", 4);
    memcpy(header->fmt_chunk_marker, "fmt ", 4);
    header->length_of_fmt = 16;
    header->format_type = 1; // PCM
    header->channels = 1; // Mono
    header->sample_rate = 16000;
    header->byterate = 16000 * 1 * 2;
    header->block_align = 1 * 2;
    header->bits_per_sample = 16;
    memcpy(header->data_chunk_header, "data", 4);
    header->data_size = pcm_samples * sizeof(int16_t);
}

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
static int silence_samples = 0;
static int speech_samples = 0;
static int leading_silence_samples = 0;
static bool recording_speech_detected = false;
static RecordingStatus recording_status = RecordingStatus::IDLE;
static TickType_t recording_started_tick = 0;
static TickType_t recording_last_sample_tick = 0;
static TickType_t recording_last_diag_tick = 0;
static portMUX_TYPE recording_mux = portMUX_INITIALIZER_UNLOCKED;
static TickType_t wakeword_cooldown_until = 0;
static int16_t preroll_buffer[PREROLL_BUFFER_SAMPLES] = {};
static size_t preroll_write_index = 0;
static size_t preroll_count = 0;
static portMUX_TYPE preroll_mux = portMUX_INITIALIZER_UNLOCKED;

static void preroll_push_samples(const int16_t *samples, int count)
{
    if(samples == NULL || count <= 0)
        return;

    portENTER_CRITICAL(&preroll_mux);
    for(int i = 0; i < count; i++)
    {
        preroll_buffer[preroll_write_index] = samples[i];
        preroll_write_index = (preroll_write_index + 1) % PREROLL_BUFFER_SAMPLES;
        if(preroll_count < PREROLL_BUFFER_SAMPLES)
        {
            preroll_count++;
        }
    }
    portEXIT_CRITICAL(&preroll_mux);
}

static size_t preroll_drain_locked(int16_t *dest, size_t max_samples)
{
    if(dest == NULL || max_samples == 0 || preroll_count == 0)
        return 0;

    size_t count_to_copy = (preroll_count < max_samples) ? preroll_count : max_samples;
    size_t start_index;

    if(preroll_count < PREROLL_BUFFER_SAMPLES)
    {
        start_index = (preroll_count >= count_to_copy) ? (preroll_count - count_to_copy) : 0;
    }
    else
    {
        start_index = (preroll_write_index + PREROLL_BUFFER_SAMPLES - count_to_copy) % PREROLL_BUFFER_SAMPLES;
    }

    for(size_t i = 0; i < count_to_copy; i++)
    {
        size_t idx = (start_index + i) % PREROLL_BUFFER_SAMPLES;
        dest[i] = preroll_buffer[idx];
    }

    preroll_count = 0;
    preroll_write_index = 0;
    return count_to_copy;
}

static void preroll_reset()
{
    portENTER_CRITICAL(&preroll_mux);
    preroll_count = 0;
    preroll_write_index = 0;
    portEXIT_CRITICAL(&preroll_mux);
}

static bool recording_is_active_locked()
{
    return recording_status == RecordingStatus::ACTIVE;
}

static void log_recording_progress_if_due(
    TickType_t now,
    const char *context)
{
    uint32_t elapsed_ms = 0;
    uint32_t sample_count = 0;
    uint32_t silence_ms = 0;
    bool due = false;

    portENTER_CRITICAL(&recording_mux);

    if(recording_is_active_locked())
    {
        TickType_t elapsed_ticks =
            (TickType_t)(now - recording_started_tick);

        if((TickType_t)(now - recording_last_diag_tick) >=
           pdMS_TO_TICKS(RECORD_DIAGNOSTIC_INTERVAL_MS))
        {
            recording_last_diag_tick = now;
            elapsed_ms =
                (uint32_t)(elapsed_ticks * portTICK_PERIOD_MS);
            sample_count =
                (record_index > WAV_HEADER_SAMPLES) ?
                (uint32_t)(record_index - WAV_HEADER_SAMPLES) : 0;
            silence_ms =
                (uint32_t)(((uint64_t)silence_samples * 1000ULL) /
                           RECORD_SAMPLE_RATE);
            due = true;
        }
    }

    portEXIT_CRITICAL(&recording_mux);

    if(due)
    {
        ESP_LOGI(
            TAG,
            "Recording progress: context=%s elapsed_ms=%lu samples=%lu silence_ms=%lu",
            context,
            (unsigned long)elapsed_ms,
            (unsigned long)sample_count,
            (unsigned long)silence_ms);
    }
}

static bool finalize_recording(
    const char *reason)
{
    bool completed = false;
    uint32_t pcm_samples = 0;
    uint32_t elapsed_ms = 0;

    portENTER_CRITICAL(&recording_mux);

    if(recording_is_active_locked())
    {
        if(record_buffer != NULL &&
           record_index > WAV_HEADER_SAMPLES &&
           record_index <= RECORD_BUFFER_SIZE)
        {
            pcm_samples =
                (uint32_t)(record_index - WAV_HEADER_SAMPLES);

            // Header finalization is performed once, before publishing COMPLETED.
            write_wav_header(record_buffer, pcm_samples);
            elapsed_ms =
                (uint32_t)((xTaskGetTickCount() - recording_started_tick) *
                           portTICK_PERIOD_MS);
            silence_samples = 0;
            leading_silence_samples = 0;
            speech_samples = 0;
            recording_speech_detected = false;
            recording_status = RecordingStatus::COMPLETED;
            completed = true;
        }
        else
        {
            record_index = 0;
            silence_samples = 0;
            leading_silence_samples = 0;
            speech_samples = 0;
            recording_speech_detected = false;
            recording_status = RecordingStatus::FAILED;
        }
    }

    portEXIT_CRITICAL(&recording_mux);

    if(completed)
    {
        ESP_LOGI(
            TAG,
            "Recording finished: reason=%s samples=%lu elapsed_ms=%lu",
            reason,
            (unsigned long)pcm_samples,
            (unsigned long)elapsed_ms);
        ESP_LOGI(
            TAG,
            "WAV metadata: format=1 channels=1 sample_rate=16000 byte_rate=32000 block_align=2 bits=16 samples=%lu bytes=%lu",
            (unsigned long)pcm_samples,
            (unsigned long)(pcm_samples * sizeof(int16_t)));
    }
    else
    {
        ESP_LOGE(
            TAG,
            "Recording failed: reason=%s samples=0",
            reason);
    }

    return completed;
}

static void fail_recording(
    RecordingStatus terminal_status,
    const char *reason)
{
    bool changed = false;
    uint32_t elapsed_ms = 0;

    portENTER_CRITICAL(&recording_mux);

    if(recording_is_active_locked())
    {
        elapsed_ms =
            (uint32_t)((xTaskGetTickCount() - recording_started_tick) *
                       portTICK_PERIOD_MS);
        record_index = 0;
        silence_samples = 0;
        leading_silence_samples = 0;
        speech_samples = 0;
        recording_speech_detected = false;
        recording_status = terminal_status;
        changed = true;
    }

    portEXIT_CRITICAL(&recording_mux);

    if(changed)
    {
        ESP_LOGE(
            TAG,
            "Recording failed: reason=%s elapsed_ms=%lu samples=0",
            reason,
            (unsigned long)elapsed_ms);
    }
}

static bool enforce_recording_deadline(
    TickType_t now)
{
    bool deadline_reached = false;
    bool sample_progress_timeout = false;

    portENTER_CRITICAL(&recording_mux);

    if(recording_is_active_locked() &&
       (TickType_t)(now - recording_started_tick) >=
       pdMS_TO_TICKS(RECORD_DURATION_SEC * 1000))
    {
        deadline_reached = true;
    }
    else if(recording_is_active_locked() &&
            (TickType_t)(now - recording_last_sample_tick) >=
            pdMS_TO_TICKS(RECORD_NO_SAMPLE_PROGRESS_TIMEOUT_MS))
    {
        sample_progress_timeout = true;
    }

    portEXIT_CRITICAL(&recording_mux);

    if(sample_progress_timeout)
    {
        fail_recording(
            RecordingStatus::FAILED,
            "i2s_no_sample_progress");
        return true;
    }

    if(deadline_reached)
    {
        finalize_recording("max_duration");
        return true;
    }

    return false;
}

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

static inline int16_t apply_mic_gain(
    int16_t sample)
{
    int32_t amplified =
        ((int32_t)sample * MIC_GAIN_NUMERATOR) / MIC_GAIN_DENOMINATOR;

    if(amplified > 32767)
    {
        return 32767;
    }
    else if(amplified < -32768)
    {
        return -32768;
    }

    return (int16_t)amplified;
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
        "I2S mic ready: BCLK=%d WS=%d DIN=%d rate=%d gain=%.1fx (%d/%d)",
        WAKEWORD_I2S_BCLK,
        WAKEWORD_I2S_WS,
        WAKEWORD_I2S_DIN,
        sample_rate,
        (double)MIC_DIGITAL_GAIN_FACTOR,
        MIC_GAIN_NUMERATOR,
        MIC_GAIN_DENOMINATOR);
    return ESP_OK;
}

//--------------------------------------------------

static void wakeword_listener_task(
    void *arg)
{
    (void)arg;

    int frame_count = 0;
    TickType_t guard_until =
        xTaskGetTickCount() +
        pdMS_TO_TICKS(WAKEWORD_STARTUP_GUARD_MS);

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
                RECORD_I2S_READ_TIMEOUT_MS);

        TickType_t now = xTaskGetTickCount();

        // The deadline is checked even when I2S timed out or returned no data.
        if(enforce_recording_deadline(now))
            continue;

        if(read_result != ESP_OK)
        {
            RecordingStatus status = get_recording_status();

            if(status == RecordingStatus::ACTIVE)
            {
                if(read_result == ESP_ERR_TIMEOUT)
                {
                    log_recording_progress_if_due(now, "i2s_timeout");
                }
                else
                {
                    ESP_LOGE(
                        TAG,
                        "I2S read failed: %s",
                        esp_err_to_name(read_result));
                    fail_recording(
                        RecordingStatus::FAILED,
                        "i2s_read");
                }
            }

            if(read_result == ESP_ERR_TIMEOUT)
            {
                vTaskDelay(pdMS_TO_TICKS(10));
            }

            continue;
        }

        int raw_samples =
            bytes_read / sizeof(int32_t);

        if(raw_samples == 0)
        {
            if(get_recording_status() == RecordingStatus::ACTIVE)
            {
                fail_recording(
                    RecordingStatus::FAILED,
                    "i2s_no_samples");
            }

            continue;
        }

        if(raw_samples < wakeword_chunk_size)
        {
            if(get_recording_status() == RecordingStatus::ACTIVE)
            {
                fail_recording(
                    RecordingStatus::FAILED,
                    "i2s_partial_read");
            }

            continue;
        }

        for(int i = 0; i < wakeword_chunk_size; i++)
        {
            int16_t raw_sample =
                (int16_t)(raw_i2s_buffer[i] >> 16);
            sample_buffer[i] =
                apply_mic_gain(raw_sample);
        }

        frame_count++;

        if(xTaskGetTickCount() < guard_until)
        {
            continue;
        }

        if((frame_count % 100) == 0)
        {
            ESP_LOGI(
                TAG,
                "Mic peak: %d",
                sample_peak(
                    sample_buffer,
                    wakeword_chunk_size));
        }

        JoyState current_state = getState();

        if (current_state == JoyState::IDLE)
        {
            // Maintain continuous rolling pre-roll buffer for seamless single-breath capture
            preroll_push_samples(sample_buffer, wakeword_chunk_size);

            bool cooldown_active =
                wakeword_cooldown_until != 0 &&
                (int32_t)(now - wakeword_cooldown_until) < 0;

            if(!cooldown_active)
            {
                wakenet_state_t detected =
                    wakenet->detect(
                        wakenet_data,
                        sample_buffer);

                if(detected == WAKENET_DETECTED)
                {
                    ESP_LOGI(
                        TAG,
                        "Hi Joy detected - seamless single-breath trigger");

                    audio_triggerWakeAck();

                    if(wakeword_task())
                    {
                        wakeword_cooldown_until =
                            xTaskGetTickCount() + pdMS_TO_TICKS(WAKEWORD_COOLDOWN_MS);
                    }
                }
            }
        }
        else if (current_state == JoyState::RECORDING &&
                 get_recording_status() == RecordingStatus::ACTIVE)
        {
            // Calculate absolute peak amplitude for silence detection
            int peak = sample_peak(sample_buffer, wakeword_chunk_size);
            bool buffer_unavailable = false;
            bool buffer_full = false;
            bool silence_reached = false;
            bool leading_silence_reached = false;
            int samples_to_copy = 0;

            portENTER_CRITICAL(&recording_mux);

            if(!recording_is_active_locked() || record_buffer == NULL)
            {
                buffer_unavailable = true;
            }
            else
            {
                int available_samples =
                    RECORD_BUFFER_SIZE - record_index;
                samples_to_copy =
                    (available_samples < wakeword_chunk_size) ?
                    available_samples : wakeword_chunk_size;

                if(samples_to_copy <= 0)
                {
                    buffer_full = true;
                }
                else
                {
                    memcpy(
                        &record_buffer[record_index],
                        sample_buffer,
                        (size_t)samples_to_copy * sizeof(int16_t));
                    record_index += samples_to_copy;
                    recording_last_sample_tick = now;

                    if(!recording_speech_detected)
                    {
                        if(peak >= SILENCE_THRESHOLD)
                        {
                            recording_speech_detected = true;
                            speech_samples += samples_to_copy;
                            silence_samples = 0;
                        }
                        else
                        {
                            leading_silence_samples += samples_to_copy;
                            if(leading_silence_samples >=
                               (RECORD_SAMPLE_RATE * RECORD_LEADING_SILENCE_TIMEOUT_MS / 1000))
                            {
                                leading_silence_reached = true;
                            }
                        }
                    }
                    else
                    {
                        speech_samples += samples_to_copy;
                        if(peak < SILENCE_THRESHOLD)
                        {
                            silence_samples += samples_to_copy;
                        }
                        else
                        {
                            silence_samples = 0;
                        }

                        bool min_duration_reached =
                            speech_samples >=
                            (RECORD_SAMPLE_RATE * RECORD_MIN_SPEECH_DURATION_MS / 1000);
                        silence_reached =
                            min_duration_reached &&
                            (silence_samples >=
                             (RECORD_SAMPLE_RATE * RECORD_SILENCE_DURATION_MS / 1000));
                    }
                }
            }

            portEXIT_CRITICAL(&recording_mux);

            if(buffer_unavailable)
            {
                fail_recording(
                    RecordingStatus::FAILED,
                    "record_buffer_unavailable");
                continue;
            }

            if(buffer_full)
            {
                finalize_recording("buffer_full");
                continue;
            }

            log_recording_progress_if_due(now, "samples");

            if(leading_silence_reached)
            {
                fail_recording(
                    RecordingStatus::ABORTED,
                    "leading_silence_timeout");
                continue;
            }

            // Check stop conditions: 4000 ms trailing silence (after minimum speech duration) OR 60 seconds duration.
            if (silence_reached)
            {
                finalize_recording("silence_detected");
            }
            else if(samples_to_copy < wakeword_chunk_size)
            {
                finalize_recording("buffer_full");
            }
            else
            {
                // A second check covers the small interval spent processing the frame.
                enforce_recording_deadline(xTaskGetTickCount());
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

    if(record_buffer == NULL)
    {
        record_buffer = (int16_t *)heap_caps_malloc(RECORD_BUFFER_SIZE * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if(record_buffer == NULL)
        {
            record_buffer = (int16_t *)malloc(RECORD_BUFFER_SIZE * sizeof(int16_t));
        }
    }

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

bool wakeword_task()
{
    if(!trySetState(JoyState::IDLE, JoyState::RECORDING))
        return false;

    // Immediately start recording and commit pre-roll buffer to eliminate handoff gap
    start_recording();

    ESP_LOGI(TAG, "Voice capture requested (seamless single-breath)");
    return true;
}

//--------------------------------------------------

bool start_recording()
{
    if (record_buffer == NULL)
    {
        // Try allocating in PSRAM (SPIRAM) first, fallback to standard malloc
        record_buffer = (int16_t *)heap_caps_malloc(RECORD_BUFFER_SIZE * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (record_buffer == NULL)
        {
            ESP_LOGW(TAG, "Failed to allocate record buffer in SPIRAM, trying standard malloc...");
            record_buffer = (int16_t *)malloc(RECORD_BUFFER_SIZE * sizeof(int16_t));
        }
        if (record_buffer == NULL)
        {
            ESP_LOGE(TAG, "Failed to allocate record buffer!");

            portENTER_CRITICAL(&recording_mux);
            record_index = 0;
            silence_samples = 0;
            leading_silence_samples = 0;
            speech_samples = 0;
            recording_speech_detected = false;
            recording_status = RecordingStatus::FAILED;
            portEXIT_CRITICAL(&recording_mux);

            return false;
        }
    }

    TickType_t now = xTaskGetTickCount();

    portENTER_CRITICAL(&recording_mux);

    if(recording_is_active_locked())
    {
        portEXIT_CRITICAL(&recording_mux);
        return true;
    }

    record_index = WAV_HEADER_SAMPLES; // Offset by 22 samples for WAV Header

    // Drain pre-roll circular buffer into record_buffer so speech during/before wake detection is preserved
    portENTER_CRITICAL(&preroll_mux);
    size_t preroll_copied = preroll_drain_locked(&record_buffer[record_index], RECORD_BUFFER_SIZE - record_index);
    portEXIT_CRITICAL(&preroll_mux);

    record_index += preroll_copied;
    silence_samples = 0;
    leading_silence_samples = 0;
    speech_samples = 0;
    recording_speech_detected = false;
    recording_started_tick = now;
    recording_last_sample_tick = now;
    recording_last_diag_tick = now;
    recording_status = RecordingStatus::ACTIVE;

    portEXIT_CRITICAL(&recording_mux);

    ESP_LOGI(TAG, "Recording started (preroll_samples=%lu)", (unsigned long)preroll_copied);
    return true;
}

bool is_recording()
{
    portENTER_CRITICAL(&recording_mux);
    bool active = recording_is_active_locked();
    portEXIT_CRITICAL(&recording_mux);
    return active;
}

RecordingStatus get_recording_status()
{
    portENTER_CRITICAL(&recording_mux);
    RecordingStatus status = recording_status;
    portEXIT_CRITICAL(&recording_mux);
    return status;
}

void abort_recording(const char *reason)
{
    fail_recording(
        RecordingStatus::ABORTED,
        reason != NULL ? reason : "aborted");
}

int16_t *get_record_buffer()
{
    portENTER_CRITICAL(&recording_mux);
    int16_t *buffer =
        (recording_status == RecordingStatus::COMPLETED) ?
        record_buffer : NULL;
    portEXIT_CRITICAL(&recording_mux);
    return buffer;
}

size_t get_record_size()
{
    portENTER_CRITICAL(&recording_mux);
    size_t size =
        (recording_status == RecordingStatus::COMPLETED) ?
        (size_t)record_index : 0;
    portEXIT_CRITICAL(&recording_mux);
    return size;
}
