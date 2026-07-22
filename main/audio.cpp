#include "audio.h"

#include <stdint.h>

#include "driver/gpio.h"
#include "driver/i2s_std.h"
#include "esp_err.h"
#include "esp_log.h"
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

static i2s_chan_handle_t speaker_tx_handle = NULL;

static bool speaker_ready = false;

static int volume = SPEAKER_DEFAULT_VOLUME;

//--------------------------------------------------

static int16_t speaker_amplitude()
{
    int safe_volume = volume;

    if(safe_volume < 0)
        safe_volume = 0;

    if(safe_volume > 100)
        safe_volume = 100;

    return (int16_t)(safe_volume * 55);
}

//--------------------------------------------------

static esp_err_t speaker_write_tone(
    int frequency_hz,
    int duration_ms)
{
    if(!speaker_ready)
        return ESP_ERR_INVALID_STATE;

    int16_t samples[SPEAKER_CHUNK_FRAMES * 2];

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

        if(frames > SPEAKER_CHUNK_FRAMES)
            frames = SPEAKER_CHUNK_FRAMES;

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
                pdMS_TO_TICKS(500));

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

    int16_t samples[SPEAKER_CHUNK_FRAMES * 2] = {};

    int total_frames =
        (SPEAKER_SAMPLE_RATE * duration_ms) / 1000;

    while(total_frames > 0)
    {
        int frames =
            total_frames;

        if(frames > SPEAKER_CHUNK_FRAMES)
            frames = SPEAKER_CHUNK_FRAMES;

        size_t bytes_written = 0;

        esp_err_t write_result =
            i2s_channel_write(
                speaker_tx_handle,
                samples,
                frames * 2 * sizeof(int16_t),
                &bytes_written,
                pdMS_TO_TICKS(500));

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
    volume = vol;

    if(volume < 0)
        volume = 0;

    if(volume > 100)
        volume = 100;

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

    int16_t stereo_buf[SPEAKER_CHUNK_FRAMES * 2];
    size_t i = 0;
    while(i < sample_count)
    {
        size_t chunk_samples = sample_count - i;
        if(chunk_samples > SPEAKER_CHUNK_FRAMES)
            chunk_samples = SPEAKER_CHUNK_FRAMES;

        for(size_t j = 0; j < chunk_samples; j++)
        {
            int16_t sample = mono_samples[i + j];
            // Apply volume dynamically
            sample = (int16_t)(((int32_t)sample * volume) / 100);

            stereo_buf[j * 2] = sample;
            stereo_buf[j * 2 + 1] = sample;
        }

        size_t bytes_written = 0;
        i2s_channel_write(
            speaker_tx_handle,
            stereo_buf,
            chunk_samples * 2 * sizeof(int16_t),
            &bytes_written,
            pdMS_TO_TICKS(500));

        i += chunk_samples;
    }
}
