#include "audio.h"

#include <stdint.h>
#include <string.h>

#include "driver/gpio.h"
#include "driver/i2s_std.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
static const char *TAG = "AUDIO";

//--------------------------------------------------
// MAX98357A speaker pins.
//--------------------------------------------------

#define SPEAKER_I2S_BCLK GPIO_NUM_1
#define SPEAKER_I2S_WS   GPIO_NUM_2
#define SPEAKER_I2S_DIN  GPIO_NUM_42

//--------------------------------------------------

#define SPEAKER_SAMPLE_RATE 16000
#ifndef SPEAKER_DEFAULT_VOLUME
#define SPEAKER_DEFAULT_VOLUME 100
#endif
#define SPEAKER_CHUNK_FRAMES 256
#define SPEAKER_OUTPUT_CHUNK_FRAMES 64

static i2s_chan_handle_t speaker_tx_handle = NULL;

static bool speaker_ready = false;

static volatile int volume = SPEAKER_DEFAULT_VOLUME;
static TaskHandle_t wake_ack_worker_task_handle = NULL;
static TaskHandle_t thinking_filler_task_handle = NULL;
static volatile bool thinking_filler_running = false;
static volatile bool thinking_filler_stop_requested = false;
static int last_thinking_filler_index = -1;
static uint32_t current_sample_rate = SPEAKER_SAMPLE_RATE;
extern "C" {
extern const uint8_t _binary_01_wav_start[];
extern const uint8_t _binary_01_wav_end[];
extern const uint8_t _binary_02_wav_start[];
extern const uint8_t _binary_02_wav_end[];
extern const uint8_t _binary_03_wav_start[];
extern const uint8_t _binary_03_wav_end[];
extern const uint8_t _binary_04_wav_start[];
extern const uint8_t _binary_04_wav_end[];
extern const uint8_t _binary_05_wav_start[];
extern const uint8_t _binary_05_wav_end[];
extern const uint8_t _binary_06_wav_start[];
extern const uint8_t _binary_06_wav_end[];
extern const uint8_t _binary_07_wav_start[];
extern const uint8_t _binary_07_wav_end[];
extern const uint8_t _binary_08_wav_start[];
extern const uint8_t _binary_08_wav_end[];
extern const uint8_t _binary_09_wav_start[];
extern const uint8_t _binary_09_wav_end[];
extern const uint8_t _binary_10_wav_start[];
extern const uint8_t _binary_10_wav_end[];
extern const uint8_t _binary_wake_ack_wav_start[];
extern const uint8_t _binary_wake_ack_wav_end[];
extern const uint8_t _binary_thinking_01_wav_start[];
extern const uint8_t _binary_thinking_01_wav_end[];
extern const uint8_t _binary_thinking_02_wav_start[];
extern const uint8_t _binary_thinking_02_wav_end[];
extern const uint8_t _binary_thinking_03_wav_start[];
extern const uint8_t _binary_thinking_03_wav_end[];
extern const uint8_t _binary_thinking_04_wav_start[];
extern const uint8_t _binary_thinking_04_wav_end[];
extern const uint8_t _binary_thinking_05_wav_start[];
extern const uint8_t _binary_thinking_05_wav_end[];
}

struct EmbeddedWavClip
{
    const uint8_t *start;
    const uint8_t *end;
};

static const EmbeddedWavClip expression_clips[] =
{
    {_binary_01_wav_start, _binary_01_wav_end},
    {_binary_02_wav_start, _binary_02_wav_end},
    {_binary_03_wav_start, _binary_03_wav_end},
    {_binary_04_wav_start, _binary_04_wav_end},
    {_binary_05_wav_start, _binary_05_wav_end},
    {_binary_06_wav_start, _binary_06_wav_end},
    {_binary_07_wav_start, _binary_07_wav_end},
    {_binary_08_wav_start, _binary_08_wav_end},
    {_binary_09_wav_start, _binary_09_wav_end},
    {_binary_10_wav_start, _binary_10_wav_end},
};
static const EmbeddedWavClip thinking_clips[] =
{
    {_binary_thinking_01_wav_start, _binary_thinking_01_wav_end},
    {_binary_thinking_02_wav_start, _binary_thinking_02_wav_end},
    {_binary_thinking_03_wav_start, _binary_thinking_03_wav_end},
    {_binary_thinking_04_wav_start, _binary_thinking_04_wav_end},
    {_binary_thinking_05_wav_start, _binary_thinking_05_wav_end},
};

static const char *expression_phrase(int expression_index)
{
    switch(expression_index)
    {
        case 0: return "aku happy";
        case 1: return "aku cute";
        case 2: return "aku excited";
        case 3: return "aku sleepy";
        case 4: return "aku angry";
        case 5: return "aku sedih";
        case 6: return "aku wink";
        case 7: return "aku surprised";
        case 8: return "aku love";
        case 9: return "aku confused";
        default: return "unknown expression";
    }
}
static const char *thinking_phrase(int index)
{
    switch(index)
    {
        case 0: return "let me think for a moment";
        case 1: return "processing your question";
        case 2: return "just a second";
        case 3: return "hmm let me check that for you";
        case 4: return "hold on joy is thinking";
        default: return "unknown thinking phrase";
    }
}

static uint16_t read_wav_le16(const uint8_t *data)
{
    return (uint16_t)data[0] | ((uint16_t)data[1] << 8);
}

static uint32_t read_wav_le32(const uint8_t *data)
{
    return (uint32_t)data[0] |
           ((uint32_t)data[1] << 8) |
           ((uint32_t)data[2] << 16) |
           ((uint32_t)data[3] << 24);
}

static bool wav_tag_is(const uint8_t *data, const char tag[4])
{
    return memcmp(data, tag, 4) == 0;
}

//--------------------------------------------------

static int speaker_volume_percent()
{
    int safe_volume = volume;

    if(safe_volume < 0)
        safe_volume = 0;

    if(safe_volume > 100)
        safe_volume = 100;

    return safe_volume;
}

//--------------------------------------------------

static inline int16_t speaker_soft_clip(int32_t x)
{
    if (x > 32767) return 32767;
    if (x < -32768) return -32768;
    return (int16_t)x;
}

static int16_t speaker_scale_sample(
    int16_t sample,
    int safe_volume)
{
    // Digital pre-amp gain multiplier (1.6x = ~+4.1dB)
    int32_t boosted = (int32_t)sample * 16 / 10;
    int32_t scaled = (boosted * safe_volume) / 100;
    return speaker_soft_clip(scaled);
}

//--------------------------------------------------

static int16_t speaker_amplitude()
{
    return (int16_t)(speaker_volume_percent() * 180);
}

//--------------------------------------------------

static esp_err_t speaker_write_tone(
    int frequency_hz,
    int duration_ms)
{
    if(!speaker_ready)
        return ESP_ERR_INVALID_STATE;

    int16_t samples[SPEAKER_OUTPUT_CHUNK_FRAMES * 2];

    uint32_t rate = current_sample_rate ? current_sample_rate : SPEAKER_SAMPLE_RATE;

    int total_frames =
        (rate * duration_ms) / 1000;

    int phase = 0;

    int period =
        rate / frequency_hz;

    if(period < 2)
        period = 2;
    while(total_frames > 0)
    {
        int frames =
            total_frames;

        if(frames > SPEAKER_OUTPUT_CHUNK_FRAMES)
            frames = SPEAKER_OUTPUT_CHUNK_FRAMES;

        // Mendapatkan amplitudo secara dinamis dari volume terbaru
        int16_t amplitude = speaker_amplitude();

        for(int i = 0; i < frames; i++)
        {
            int16_t sample =
                (phase < (period / 2))
                    ? amplitude
                    : (int16_t)-amplitude;

            samples[i * 2] = sample;
            samples[i * 2 + 1] = sample;

            phase++;

            if(phase >= period)
                phase = 0;
        }

        size_t bytes_written = 0;

        esp_err_t write_result =
            i2s_channel_write(
                speaker_tx_handle,
                samples,
                frames * 2 * sizeof(int16_t),
                &bytes_written,
                500);

        if(write_result != ESP_OK)
            return write_result;

        total_frames -= frames;
    }

    return ESP_OK;
}

//--------------------------------------------------

static esp_err_t speaker_write_silence(
    int duration_ms)
{
    if(!speaker_ready)
        return ESP_ERR_INVALID_STATE;

    int16_t samples[SPEAKER_OUTPUT_CHUNK_FRAMES * 2] = {};

    uint32_t rate = current_sample_rate ? current_sample_rate : SPEAKER_SAMPLE_RATE;

    int total_frames =
        (rate * duration_ms) / 1000;

    if(total_frames <= 0)
        total_frames = SPEAKER_OUTPUT_CHUNK_FRAMES;

    while(total_frames > 0)
    {
        int frames =
            total_frames;

        if(frames > SPEAKER_OUTPUT_CHUNK_FRAMES)
            frames = SPEAKER_OUTPUT_CHUNK_FRAMES;

        size_t bytes_written = 0;

        esp_err_t write_result =
            i2s_channel_write(
                speaker_tx_handle,
                samples,
                frames * 2 * sizeof(int16_t),
                &bytes_written,
                500);

        if(write_result != ESP_OK)
            return write_result;

        total_frames -= frames;
    }

    return ESP_OK;
}

//--------------------------------------------------

static void wake_ack_worker_task(void *param)
{
    while(true)
    {
        uint32_t count = ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        if(count > 0)
        {
            audio_playWakeAck();
        }
    }
}

static void thinking_filler_worker_task(void *param);

void audio_init()
{
    if(speaker_ready)
        return;

    i2s_chan_config_t channel_config =
        I2S_CHANNEL_DEFAULT_CONFIG(
            I2S_NUM_AUTO,
            I2S_ROLE_MASTER);
    channel_config.auto_clear_after_cb = true;
    channel_config.auto_clear_before_cb = true;
    esp_err_t result =
        i2s_new_channel(
            &channel_config,
            &speaker_tx_handle,
            NULL);

    if(result != ESP_OK)
    {
        ESP_LOGE(
            TAG,
            "Speaker I2S channel failed: %s",
            esp_err_to_name(result));

        return;
    }

    i2s_std_config_t std_config = {};

    std_config.clk_cfg =
        I2S_STD_CLK_DEFAULT_CONFIG(
            SPEAKER_SAMPLE_RATE);

    std_config.slot_cfg =
        I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
            I2S_DATA_BIT_WIDTH_16BIT,
            I2S_SLOT_MODE_STEREO);

    std_config.gpio_cfg.mclk =
        I2S_GPIO_UNUSED;

    std_config.gpio_cfg.bclk =
        SPEAKER_I2S_BCLK;

    std_config.gpio_cfg.ws =
        SPEAKER_I2S_WS;

    std_config.gpio_cfg.dout =
        SPEAKER_I2S_DIN;

    std_config.gpio_cfg.din =
        I2S_GPIO_UNUSED;

    std_config.gpio_cfg.invert_flags.mclk_inv =
        false;

    std_config.gpio_cfg.invert_flags.bclk_inv =
        false;

    std_config.gpio_cfg.invert_flags.ws_inv =
        false;

    result =
        i2s_channel_init_std_mode(
            speaker_tx_handle,
            &std_config);

    if(result != ESP_OK)
    {
        ESP_LOGE(
            TAG,
            "Speaker I2S init failed: %s",
            esp_err_to_name(result));

        return;
    }

    result =
        i2s_channel_enable(
            speaker_tx_handle);

    if(result != ESP_OK)
    {
        ESP_LOGE(
            TAG,
            "Speaker I2S enable failed: %s",
            esp_err_to_name(result));

        return;
    }

    speaker_ready = true;

    // Flush and prime DMA TX buffers with digital silence to prevent DC offset
    // or underrun screams before any tone/clip starts.
    (void)speaker_write_silence(50);

    ESP_LOGI(
        TAG,
        "MAX98357A ready: BCLK=%d WS=%d DIN=%d volume=%d",
        SPEAKER_I2S_BCLK,
        SPEAKER_I2S_WS,
        SPEAKER_I2S_DIN,
        volume);
    if(wake_ack_worker_task_handle == NULL)
    {
        BaseType_t ret = xTaskCreatePinnedToCore(
            wake_ack_worker_task,
            "wake_ack_worker",
            4096,
            NULL,
            5,
            &wake_ack_worker_task_handle,
            0);
        if(ret != pdPASS)
        {
            ESP_LOGE(TAG, "Failed to create wake_ack_worker task");
            wake_ack_worker_task_handle = NULL;
        }
    }
    if(thinking_filler_task_handle == NULL)
    {
        BaseType_t ret = xTaskCreatePinnedToCore(
            thinking_filler_worker_task,
            "thinking_filler",
            4096,
            NULL,
            4,
            &thinking_filler_task_handle,
            0);
        if(ret != pdPASS)
        {
            ESP_LOGE(TAG, "Failed to create thinking_filler task");
            thinking_filler_task_handle = NULL;
        }
    }
}

//--------------------------------------------------

void audio_playHello()
{
    ESP_LOGI(
        TAG,
        "Play hello");

    (void)audio_set_sample_rate(SPEAKER_SAMPLE_RATE);

    esp_err_t result = ESP_OK;

    result |=
        speaker_write_tone(
            660,
            95);

    result |=
        speaker_write_silence(
            35);

    result |=
        speaker_write_tone(
            880,
            115);

    result |=
        speaker_write_silence(
            35);

    result |=
        speaker_write_tone(
            1040,
            150);

    // Trailing silence ensures DMA pipeline drains clean zero samples
    // and prevents underrun noise or DC offset on MAX98357A
    result |=
        speaker_write_silence(
            50);
    if(result != ESP_OK)
    {
        ESP_LOGW(
            TAG,
            "Speaker beep skipped: %s",
            esp_err_to_name(result));
    }
}

//--------------------------------------------------

void audio_playExpressionChange()
{
    ESP_LOGI(
        TAG,
        "Play expression change melody");

    // A short C-major rise and fall gives the face transition a musical
    // identity without keeping the recorder waiting for too long.
    static constexpr int melody_hz[] =
    {
        523,  // C5
        659,  // E5
        784,  // G5
        1047, // C6
        784   // G5
    };

    static constexpr int melody_ms[] =
    {
        60,
        60,
        70,
        110,
        90
    };

    esp_err_t result = ESP_OK;

    (void)audio_set_sample_rate(SPEAKER_SAMPLE_RATE);

    for(size_t index = 0; index < sizeof(melody_hz) / sizeof(melody_hz[0]); index++)
    {
        result |= speaker_write_tone(melody_hz[index], melody_ms[index]);

        if(index + 1 < sizeof(melody_hz) / sizeof(melody_hz[0]))
            result |= speaker_write_silence(18);
    }

    // End at silence so the next microphone capture starts cleanly.
    result |= speaker_write_silence(35);

    if(result != ESP_OK)
    {
        ESP_LOGW(
            TAG,
            "Expression melody skipped: %s",
            esp_err_to_name(result));
    }
}

//--------------------------------------------------

static bool audio_play_embedded_wav_clip(
    const uint8_t *start,
    const uint8_t *end,
    const char *clip_name)
{
    if(start == nullptr || end == nullptr || end <= start)
    {
        return false;
    }

    const uint8_t *wav = start;
    const size_t wav_size = (size_t)(end - start);

    if(wav_size < 12 || !wav_tag_is(wav, "RIFF") || !wav_tag_is(wav + 8, "WAVE"))
    {
        ESP_LOGE(TAG, "%s WAV has an invalid RIFF header", clip_name);
        return false;
    }

    bool fmt_found = false;
    bool data_found = false;
    uint16_t audio_format = 0;
    uint16_t channels = 0;
    uint16_t bits_per_sample = 0;
    uint32_t sample_rate = 0;
    const uint8_t *pcm_data = nullptr;
    uint32_t pcm_bytes = 0;

    size_t offset = 12;
    while(offset <= wav_size && wav_size - offset >= 8)
    {
        const uint8_t *chunk = wav + offset;
        const uint32_t chunk_bytes = read_wav_le32(chunk + 4);
        const size_t payload_offset = offset + 8;

        if((size_t)chunk_bytes > wav_size - payload_offset)
            return false;

        if(wav_tag_is(chunk, "fmt "))
        {
            if(chunk_bytes < 16)
                return false;

            const uint8_t *fmt = wav + payload_offset;
            audio_format = read_wav_le16(fmt + 0);
            channels = read_wav_le16(fmt + 2);
            sample_rate = read_wav_le32(fmt + 4);
            bits_per_sample = read_wav_le16(fmt + 14);
            fmt_found = true;
        }
        else if(wav_tag_is(chunk, "data"))
        {
            if(data_found || chunk_bytes == 0)
                return false;

            pcm_data = wav + payload_offset;
            pcm_bytes = chunk_bytes;
            data_found = true;
        }

        offset = payload_offset + chunk_bytes;
        if((offset & 1U) != 0U)
            offset++;
    }

    if(!fmt_found || !data_found || audio_format != 1 ||
       (channels != 1 && channels != 2) || bits_per_sample != 16 ||
       sample_rate == 0 || (pcm_bytes % sizeof(int16_t)) != 0)
    {
        ESP_LOGE(TAG,
                 "%s WAV format rejected: format=%u channels=%u rate=%lu bits=%u bytes=%lu",
                 clip_name,
                 audio_format,
                 channels,
                 (unsigned long)sample_rate,
                 bits_per_sample,
                 (unsigned long)pcm_bytes);
        return false;
    }

    ESP_LOGI(TAG,
             "Play %s: rate=%lu channels=%u bytes=%lu volume=%d",
             clip_name,
             (unsigned long)sample_rate,
             channels,
             (unsigned long)pcm_bytes,
             speaker_volume_percent());

    const bool played = audio_play_raw(
        reinterpret_cast<const int16_t *>(pcm_data),
        pcm_bytes / sizeof(int16_t),
        channels,
        (int)sample_rate);
    if(!played)
        ESP_LOGE(TAG, "%s WAV playback failed", clip_name);
    else
        (void)speaker_write_silence(50);

    return played;
}

static bool audio_play_embedded_wav(int expression_index)
{
    if(expression_index < 0 ||
       expression_index >= (int)(sizeof(expression_clips) / sizeof(expression_clips[0])))
    {
        return false;
    }

    char name_buf[32];
    snprintf(name_buf, sizeof(name_buf), "expression %02d", expression_index + 1);

    const EmbeddedWavClip &clip = expression_clips[expression_index];
    return audio_play_embedded_wav_clip(clip.start, clip.end, name_buf);
}
static bool audio_play_embedded_thinking_wav(int index)
{
    if(index < 0 ||
       index >= (int)(sizeof(thinking_clips) / sizeof(thinking_clips[0])))
    {
        return false;
    }

    char name_buf[32];
    snprintf(name_buf, sizeof(name_buf), "thinking %02d", index + 1);

    const EmbeddedWavClip &clip = thinking_clips[index];
    return audio_play_embedded_wav_clip(clip.start, clip.end, name_buf);
}


//--------------------------------------------------

void audio_playWakeAck()
{
    // Wake acknowledgment cue is played at default volume (100),
    // even if a previous volume-button event lowered the runtime setting.
    audio_setVolume(SPEAKER_DEFAULT_VOLUME);

    ESP_LOGI(
        TAG,
        "Play wake ack cue");
    (void)audio_set_sample_rate(SPEAKER_SAMPLE_RATE);

    if(audio_play_embedded_wav_clip(
           _binary_wake_ack_wav_start,
           _binary_wake_ack_wav_end,
           "wake ack"))
    {
        return;
    }

    // Fallback dual-tone earcon synthesized in firmware (rising chime: 659 Hz -> 880 Hz)
    esp_err_t result = ESP_OK;
    result |= speaker_write_tone(659, 75);
    result |= speaker_write_silence(25);
    result |= speaker_write_tone(880, 110);
    result |= speaker_write_silence(50);

    if(result != ESP_OK)
    {
        ESP_LOGW(
            TAG,
            "Wake ack cue skipped: %s",
            esp_err_to_name(result));
    }
}

void audio_triggerWakeAck()
{
    if(wake_ack_worker_task_handle != NULL)
    {
        xTaskNotifyGive(wake_ack_worker_task_handle);
    }
    else
    {
        ESP_LOGW(TAG, "wake_ack_worker task not ready, falling back to direct playback");
        audio_playWakeAck();
    }
}

//--------------------------------------------------

void audio_playExpressionAudio(int expression_index)
{
    // Expression voice clips are played at default volume (100),
    // even if a previous volume-button event lowered the runtime setting.
    audio_setVolume(SPEAKER_DEFAULT_VOLUME);

    if(!audio_play_embedded_wav(expression_index))
    {
        ESP_LOGW(TAG,
                 "Expression WAV %02d unavailable for phrase=\"%s\"; using fallback melody",
                 expression_index + 1,
                 expression_phrase(expression_index));
        audio_playExpressionChange();
    }
}
//--------------------------------------------------

void audio_playThinkingFiller(int index)
{
    // Thinking filler clips are played at default volume (100).
    audio_setVolume(SPEAKER_DEFAULT_VOLUME);

    if(!audio_play_embedded_thinking_wav(index))
    {
        ESP_LOGW(TAG,
                 "Thinking WAV %02d unavailable for phrase=\"%s\"; using fallback melody",
                 index + 1,
                 thinking_phrase(index));

        (void)audio_set_sample_rate(SPEAKER_SAMPLE_RATE);

        static constexpr int melody_hz[] = { 659, 784, 880 };
        static constexpr int melody_ms[] = { 70, 70, 110 };

        esp_err_t result = ESP_OK;
        for(size_t i = 0; i < sizeof(melody_hz) / sizeof(melody_hz[0]); i++)
        {
            result |= speaker_write_tone(melody_hz[i], melody_ms[i]);
            if(i + 1 < sizeof(melody_hz) / sizeof(melody_hz[0]))
                result |= speaker_write_silence(25);
        }
        result |= speaker_write_silence(35);

        if(result != ESP_OK)
        {
            ESP_LOGW(TAG, "Thinking fallback melody skipped: %s", esp_err_to_name(result));
        }
    }
}

//--------------------------------------------------

void audio_playRandomThinkingFiller()
{
    int index = (int)(esp_random() % 5);
    audio_playThinkingFiller(index);
}

static bool audio_play_embedded_wav_clip_cancellable(
    const uint8_t *start,
    const uint8_t *end,
    const char *clip_name,
    volatile bool *stop_flag)
{
    if(start == nullptr || end == nullptr || end <= start)
    {
        return false;
    }

    if(stop_flag && *stop_flag)
    {
        return false;
    }

    const uint8_t *wav = start;
    const size_t wav_size = (size_t)(end - start);

    if(wav_size < 12 || !wav_tag_is(wav, "RIFF") || !wav_tag_is(wav + 8, "WAVE"))
    {
        ESP_LOGE(TAG, "%s WAV has an invalid RIFF header", clip_name);
        return false;
    }

    bool fmt_found = false;
    bool data_found = false;
    uint16_t audio_format = 0;
    uint16_t channels = 0;
    uint16_t bits_per_sample = 0;
    uint32_t sample_rate = 0;
    const uint8_t *pcm_data = nullptr;
    uint32_t pcm_bytes = 0;

    size_t offset = 12;
    while(offset <= wav_size && wav_size - offset >= 8)
    {
        const uint8_t *chunk = wav + offset;
        const uint32_t chunk_bytes = read_wav_le32(chunk + 4);
        const size_t payload_offset = offset + 8;

        if((size_t)chunk_bytes > wav_size - payload_offset)
            return false;

        if(wav_tag_is(chunk, "fmt "))
        {
            if(chunk_bytes < 16)
                return false;

            const uint8_t *fmt = wav + payload_offset;
            audio_format = read_wav_le16(fmt + 0);
            channels = read_wav_le16(fmt + 2);
            sample_rate = read_wav_le32(fmt + 4);
            bits_per_sample = read_wav_le16(fmt + 14);
            fmt_found = true;
        }
        else if(wav_tag_is(chunk, "data"))
        {
            if(data_found || chunk_bytes == 0)
                return false;

            pcm_data = wav + payload_offset;
            pcm_bytes = chunk_bytes;
            data_found = true;
        }

        offset = payload_offset + chunk_bytes;
        if((offset & 1U) != 0U)
            offset++;
    }

    if(!fmt_found || !data_found || audio_format != 1 ||
       (channels != 1 && channels != 2) || bits_per_sample != 16 ||
       sample_rate == 0 || (pcm_bytes % sizeof(int16_t)) != 0)
    {
        ESP_LOGE(TAG,
                 "%s WAV format rejected: format=%u channels=%u rate=%lu bits=%u bytes=%lu",
                 clip_name,
                 audio_format,
                 channels,
                 (unsigned long)sample_rate,
                 bits_per_sample,
                 (unsigned long)pcm_bytes);
        return false;
    }

    if(!speaker_ready || (stop_flag && *stop_flag))
    {
        return false;
    }

    if(!audio_set_sample_rate(sample_rate))
    {
        return false;
    }

    const int16_t *samples = reinterpret_cast<const int16_t *>(pcm_data);
    const size_t sample_count = pcm_bytes / sizeof(int16_t);

    int16_t stereo_buf[SPEAKER_OUTPUT_CHUNK_FRAMES * 2];

    if(channels == 1)
    {
        size_t i = 0;
        while(i < sample_count)
        {
            if(stop_flag && *stop_flag)
            {
                return false;
            }

            size_t chunk_samples = sample_count - i;
            if(chunk_samples > SPEAKER_OUTPUT_CHUNK_FRAMES)
                chunk_samples = SPEAKER_OUTPUT_CHUNK_FRAMES;

            int safe_volume = speaker_volume_percent();

            for(size_t j = 0; j < chunk_samples; j++)
            {
                int16_t sample = samples[i + j];
                sample = speaker_scale_sample(sample, safe_volume);

                stereo_buf[j * 2] = sample;
                stereo_buf[j * 2 + 1] = sample;
            }

            const size_t expected_bytes = chunk_samples * 2 * sizeof(int16_t);
            size_t bytes_written = 0;
            esp_err_t err = i2s_channel_write(
                speaker_tx_handle,
                stereo_buf,
                expected_bytes,
                &bytes_written,
                100);

            if(err != ESP_OK || bytes_written != expected_bytes)
            {
                return false;
            }

            i += chunk_samples;
        }
    }
    else
    {
        size_t total_frames = sample_count / 2;
        size_t frame_idx = 0;
        while(frame_idx < total_frames)
        {
            if(stop_flag && *stop_flag)
            {
                return false;
            }

            size_t chunk_frames = total_frames - frame_idx;
            if(chunk_frames > SPEAKER_OUTPUT_CHUNK_FRAMES)
                chunk_frames = SPEAKER_OUTPUT_CHUNK_FRAMES;

            int safe_volume = speaker_volume_percent();

            for(size_t j = 0; j < chunk_frames; j++)
            {
                int16_t left = samples[(frame_idx + j) * 2];
                int16_t right = samples[(frame_idx + j) * 2 + 1];

                left = speaker_scale_sample(left, safe_volume);
                right = speaker_scale_sample(right, safe_volume);

                stereo_buf[j * 2] = left;
                stereo_buf[j * 2 + 1] = right;
            }

            const size_t expected_bytes = chunk_frames * 2 * sizeof(int16_t);
            size_t bytes_written = 0;
            esp_err_t err = i2s_channel_write(
                speaker_tx_handle,
                stereo_buf,
                expected_bytes,
                &bytes_written,
                100);

            if(err != ESP_OK || bytes_written != expected_bytes)
            {
                return false;
            }

            frame_idx += chunk_frames;
        }
    }

    return true;
}

static void thinking_filler_worker_task(void *param)
{
    while(true)
    {
        uint32_t count = ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        if(count == 0 || thinking_filler_stop_requested)
            continue;

        thinking_filler_running = true;

        audio_setVolume(SPEAKER_DEFAULT_VOLUME);
        if(thinking_filler_stop_requested)
        {
            thinking_filler_running = false;
            continue;
        }
        (void)audio_set_sample_rate(SPEAKER_SAMPLE_RATE);

        ESP_LOGI(TAG, "Thinking filler loop started");

        while(!thinking_filler_stop_requested)
        {
            int count_clips = (int)(sizeof(thinking_clips) / sizeof(thinking_clips[0]));
            int index = (int)(esp_random() % count_clips);
            if(count_clips > 1 && index == last_thinking_filler_index)
            {
                index = (index + 1) % count_clips;
            }
            last_thinking_filler_index = index;

            char name_buf[32];
            snprintf(name_buf, sizeof(name_buf), "thinking %02d", index + 1);
            const EmbeddedWavClip &clip = thinking_clips[index];

            if(thinking_filler_stop_requested)
            {
                break;
            }

            ESP_LOGI(TAG, "Thinking filler loop playing %s (\"%s\")", name_buf, thinking_phrase(index));

            (void)audio_play_embedded_wav_clip_cancellable(
                clip.start,
                clip.end,
                name_buf,
                &thinking_filler_stop_requested);

            if(thinking_filler_stop_requested)
            {
                break;
            }

            // Inter-clip pause: ~1000ms pause broken into short 50ms chunks checking stop_requested
            for(int pause_ms = 0; pause_ms < 1000 && !thinking_filler_stop_requested; pause_ms += 50)
            {
                vTaskDelay(pdMS_TO_TICKS(50));
            }
        }

        // Flush and prime DMA TX buffers with digital silence to prevent DC offset
        (void)speaker_write_silence(30);

        thinking_filler_running = false;
        ESP_LOGI(TAG, "Thinking filler loop stopped");
    }
}

void audio_startThinkingFillerLoop()
{
    if(!speaker_ready)
        return;

    if(thinking_filler_running && !thinking_filler_stop_requested)
    {
        return;
    }

    thinking_filler_stop_requested = false;

    if(thinking_filler_task_handle != NULL)
    {
        xTaskNotifyGive(thinking_filler_task_handle);
    }
    else
    {
        ESP_LOGE(TAG, "thinking_filler task not ready");
    }
}

void audio_stopThinkingFillerLoop()
{
    thinking_filler_stop_requested = true;

    // Wait briefly (up to 400ms) for the loop task to finish current chunk and exit
    int wait_count = 80; // 80 * 5ms = 400ms
    while(thinking_filler_running && wait_count > 0)
    {
        vTaskDelay(pdMS_TO_TICKS(5));
        wait_count--;
    }

    if(thinking_filler_running)
    {
        ESP_LOGW(TAG, "Thinking filler loop did not stop within 400ms");
    }
}

bool audio_isThinkingFillerLoopRunning()
{
    return thinking_filler_running;
}

//--------------------------------------------------

void audio_setVolume(
    int vol)
{
    int safe_volume = vol;

    if(safe_volume < 0)
        safe_volume = 0;

    if(safe_volume > 100)
        safe_volume = 100;

    volume = safe_volume;

    ESP_LOGI(
        TAG,
        "Volume : %d",
        volume);
}

//--------------------------------------------------

int audio_getVolume()
{
    return volume;
}

//--------------------------------------------------

void audio_adjustVolume(
    int delta)
{
    audio_setVolume(
        volume + delta);
}

//--------------------------------------------------

void audio_play_pcm(const int16_t *mono_samples, size_t sample_count)
{
    if(!speaker_ready)
        return;

    int16_t stereo_buf[SPEAKER_OUTPUT_CHUNK_FRAMES * 2];
    size_t i = 0;
    while(i < sample_count)
    {
        size_t chunk_samples = sample_count - i;
        if(chunk_samples > SPEAKER_OUTPUT_CHUNK_FRAMES)
            chunk_samples = SPEAKER_OUTPUT_CHUNK_FRAMES;

        int safe_volume = speaker_volume_percent();

        for(size_t j = 0; j < chunk_samples; j++)
        {
            int16_t sample = mono_samples[i + j];
            sample = speaker_scale_sample(sample, safe_volume);

            stereo_buf[j * 2] = sample;
            stereo_buf[j * 2 + 1] = sample;
        }

        size_t bytes_written = 0;
        i2s_channel_write(
            speaker_tx_handle,
            stereo_buf,
            chunk_samples * 2 * sizeof(int16_t),
            &bytes_written,
            500);

        i += chunk_samples;
    }

    (void)speaker_write_silence(30);
}

bool audio_set_sample_rate(uint32_t sample_rate)
{
    if (!speaker_ready || sample_rate == 0)
        return false;
    if (current_sample_rate == sample_rate)
        return true;

    int64_t change_start_us = esp_timer_get_time();
    ESP_LOGI(TAG, "Changing speaker sample rate to %lu Hz", (unsigned long)sample_rate);

    int64_t stage_start_us = esp_timer_get_time();
    esp_err_t err = i2s_channel_disable(speaker_tx_handle);
    int64_t disable_us = esp_timer_get_time() - stage_start_us;
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG,
                 "Failed to disable I2S for rate change: %s elapsed_us=%lld",
                 esp_err_to_name(err),
                 (long long)disable_us);
        return false;
    }

    i2s_std_clk_config_t clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(sample_rate);
    stage_start_us = esp_timer_get_time();
    err = i2s_channel_reconfig_std_clock(speaker_tx_handle, &clk_cfg);
    int64_t reconfig_us = esp_timer_get_time() - stage_start_us;
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG,
                 "Failed to reconfig I2S clock: %s disable_us=%lld reconfig_us=%lld",
                 esp_err_to_name(err),
                 (long long)disable_us,
                 (long long)reconfig_us);
        (void)i2s_channel_enable(speaker_tx_handle);
        return false;
    }

    stage_start_us = esp_timer_get_time();
    err = i2s_channel_enable(speaker_tx_handle);
    int64_t enable_us = esp_timer_get_time() - stage_start_us;
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG,
                 "Failed to enable I2S after rate change: %s enable_us=%lld",
                 esp_err_to_name(err),
                 (long long)enable_us);
        return false;
    }

    current_sample_rate = sample_rate;
    ESP_LOGI(TAG,
             "Speaker sample rate ready: rate=%lu disable_us=%lld reconfig_us=%lld enable_us=%lld total_us=%lld",
             (unsigned long)sample_rate,
             (long long)disable_us,
             (long long)reconfig_us,
             (long long)enable_us,
             (long long)(esp_timer_get_time() - change_start_us));
    return true;
}

bool audio_play_raw(const int16_t *samples, size_t sample_count, int channels, int sample_rate)
{
    if (!speaker_ready || samples == NULL || sample_count == 0 || sample_rate <= 0 ||
        (channels != 1 && channels != 2) || (channels == 2 && (sample_count % 2) != 0))
        return false;

    int64_t call_start_us = esp_timer_get_time();
    int64_t write_total_us = 0;
    int64_t write_max_us = 0;
    size_t write_chunks = 0;
    size_t pcm_frames = channels == 1 ? sample_count : sample_count / 2;
    uint64_t media_us = ((uint64_t)pcm_frames * 1000000ULL) / (uint32_t)sample_rate;

    if (!audio_set_sample_rate((uint32_t)sample_rate))
        return false;

    int16_t stereo_buf[SPEAKER_OUTPUT_CHUNK_FRAMES * 2];

    if (channels == 1) {
        size_t i = 0;
        while (i < sample_count) {
            size_t chunk_samples = sample_count - i;
            if (chunk_samples > SPEAKER_OUTPUT_CHUNK_FRAMES)
                chunk_samples = SPEAKER_OUTPUT_CHUNK_FRAMES;

            int safe_volume = speaker_volume_percent();

            for (size_t j = 0; j < chunk_samples; j++) {
                int16_t sample = samples[i + j];
                sample = speaker_scale_sample(sample, safe_volume);

                stereo_buf[j * 2] = sample;
                stereo_buf[j * 2 + 1] = sample;
            }

            const size_t expected_bytes = chunk_samples * 2 * sizeof(int16_t);
            size_t bytes_written = 0;
            int64_t write_start_us = esp_timer_get_time();
            esp_err_t err = i2s_channel_write(
                speaker_tx_handle,
                stereo_buf,
                expected_bytes,
                &bytes_written,
                500);
            int64_t write_us = esp_timer_get_time() - write_start_us;
            write_total_us += write_us;
            if (write_us > write_max_us)
                write_max_us = write_us;
            write_chunks++;

            if (err != ESP_OK || bytes_written != expected_bytes) {
                ESP_LOGE(TAG,
                         "Raw playback write failed: err=%s bytes=%u/%u chunk=%u",
                         esp_err_to_name(err),
                         (unsigned)bytes_written,
                         (unsigned)expected_bytes,
                         (unsigned)write_chunks);
                return false;
            }

            i += chunk_samples;
        }
    } else {
        size_t total_frames = sample_count / 2;
        size_t frame_idx = 0;
        while (frame_idx < total_frames) {
            size_t chunk_frames = total_frames - frame_idx;
            if (chunk_frames > SPEAKER_OUTPUT_CHUNK_FRAMES)
                chunk_frames = SPEAKER_OUTPUT_CHUNK_FRAMES;

            int safe_volume = speaker_volume_percent();

            for (size_t j = 0; j < chunk_frames; j++) {
                int16_t left = samples[(frame_idx + j) * 2];
                int16_t right = samples[(frame_idx + j) * 2 + 1];

                left = speaker_scale_sample(left, safe_volume);
                right = speaker_scale_sample(right, safe_volume);

                stereo_buf[j * 2] = left;
                stereo_buf[j * 2 + 1] = right;
            }

            const size_t expected_bytes = chunk_frames * 2 * sizeof(int16_t);
            size_t bytes_written = 0;
            int64_t write_start_us = esp_timer_get_time();
            esp_err_t err = i2s_channel_write(
                speaker_tx_handle,
                stereo_buf,
                expected_bytes,
                &bytes_written,
                500);
            int64_t write_us = esp_timer_get_time() - write_start_us;
            write_total_us += write_us;
            if (write_us > write_max_us)
                write_max_us = write_us;
            write_chunks++;

            if (err != ESP_OK || bytes_written != expected_bytes) {
                ESP_LOGE(TAG,
                         "Raw playback write failed: err=%s bytes=%u/%u chunk=%u",
                         esp_err_to_name(err),
                         (unsigned)bytes_written,
                         (unsigned)expected_bytes,
                         (unsigned)write_chunks);
                return false;
            }

            frame_idx += chunk_frames;
        }
    }

    int64_t elapsed_us = esp_timer_get_time() - call_start_us;
    if (elapsed_us > (int64_t)media_us * 2 + 50000LL) {
        ESP_LOGW(TAG,
                 "Slow raw playback: frames=%u channels=%d rate=%d chunks=%u media_us=%llu elapsed_us=%lld write_total_us=%lld write_max_us=%lld",
                 (unsigned)pcm_frames,
                 channels,
                 sample_rate,
                 (unsigned)write_chunks,
                 (unsigned long long)media_us,
                 (long long)elapsed_us,
                 (long long)write_total_us,
                 (long long)write_max_us);
    }

    return true;
}

void audio_play_error()
{
    ESP_LOGI(TAG, "Play error tone sequence");

    // Make sure clock rate is reset for playHello / play_tone
    (void)audio_set_sample_rate(SPEAKER_SAMPLE_RATE);

    esp_err_t result = ESP_OK;

    // Play a error buzz: descending tones 440 -> 330 -> 220
    result |= speaker_write_tone(440, 150);
    result |= speaker_write_silence(50);
    result |= speaker_write_tone(330, 150);
    result |= speaker_write_silence(50);
    result |= speaker_write_tone(220, 250);
    result |= speaker_write_silence(50);
    if(result != ESP_OK)
    {
        ESP_LOGW(TAG, "Error beep skipped: %s", esp_err_to_name(result));
    }
}
