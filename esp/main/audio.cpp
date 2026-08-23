#include "audio.h"

#include <stdint.h>

#include "driver/gpio.h"
#include "driver/i2s_std.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"

static const char *TAG = "AUDIO";

//--------------------------------------------------
// MAX98357A speaker pins.
//--------------------------------------------------

#define SPEAKER_I2S_BCLK GPIO_NUM_1
#define SPEAKER_I2S_WS   GPIO_NUM_2
#define SPEAKER_I2S_DIN  GPIO_NUM_42

//--------------------------------------------------

#define SPEAKER_SAMPLE_RATE 16000
#define SPEAKER_DEFAULT_VOLUME 8
#define SPEAKER_CHUNK_FRAMES 256
#define SPEAKER_OUTPUT_CHUNK_FRAMES 64

static i2s_chan_handle_t speaker_tx_handle = NULL;

static bool speaker_ready = false;

static volatile int volume = SPEAKER_DEFAULT_VOLUME;

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

static int16_t speaker_scale_sample(
    int16_t sample,
    int safe_volume)
{
    return (int16_t)(((int32_t)sample * safe_volume) / 100);
}

//--------------------------------------------------

static int16_t speaker_amplitude()
{
    return (int16_t)(speaker_volume_percent() * 55);
}

//--------------------------------------------------

static esp_err_t speaker_write_tone(
    int frequency_hz,
    int duration_ms)
{
    if(!speaker_ready)
        return ESP_ERR_INVALID_STATE;

    int16_t samples[SPEAKER_OUTPUT_CHUNK_FRAMES * 2];

    int total_frames =
        (SPEAKER_SAMPLE_RATE * duration_ms) / 1000;

    int phase = 0;

    int period =
        SPEAKER_SAMPLE_RATE / frequency_hz;

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

    int total_frames =
        (SPEAKER_SAMPLE_RATE * duration_ms) / 1000;

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

void audio_init()
{
    if(speaker_ready)
        return;

    i2s_chan_config_t channel_config =
        I2S_CHANNEL_DEFAULT_CONFIG(
            I2S_NUM_AUTO,
            I2S_ROLE_MASTER);

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

    ESP_LOGI(
        TAG,
        "MAX98357A ready: BCLK=%d WS=%d DIN=%d volume=%d",
        SPEAKER_I2S_BCLK,
        SPEAKER_I2S_WS,
        SPEAKER_I2S_DIN,
        volume);
}

//--------------------------------------------------

void audio_playHello()
{
    ESP_LOGI(
        TAG,
        "Play hello");

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

    if(result != ESP_OK)
    {
        ESP_LOGW(
            TAG,
            "Speaker beep skipped: %s",
            esp_err_to_name(result));
    }
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
}

static uint32_t current_sample_rate = SPEAKER_SAMPLE_RATE;

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

    if(result != ESP_OK)
    {
        ESP_LOGW(TAG, "Error beep skipped: %s", esp_err_to_name(result));
    }
}
