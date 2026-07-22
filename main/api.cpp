#include "api.h"
#include "state.h"
#include "audio.h"
#include "display.h"
#include "wakeword.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "API";

// Ganti IP ini dengan IP backend Express.js kamu
#define BMO_BACKEND_URL "http://192.168.1.100:3000/api/audio"

void api_send_audio_and_play()
{
    int16_t *record_buf = get_record_buffer();
    size_t record_len = get_record_size();

    if (record_buf == NULL || record_len == 0)
    {
        ESP_LOGW(TAG, "Record buffer is empty, skipping request");
        return;
    }

    ESP_LOGI(TAG, "Sending %d samples of audio to backend...", record_len);

    esp_http_client_config_t config = {};
    config.url = BMO_BACKEND_URL;
    config.method = HTTP_METHOD_POST;
    config.timeout_ms = 15000; // 15 seconds timeout
    
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL)
    {
        ESP_LOGE(TAG, "Failed to initialize HTTP client");
        return;
    }

    esp_http_client_set_header(client, "Content-Type", "application/octet-stream");

    size_t data_len = record_len * sizeof(int16_t);
    esp_err_t err = esp_http_client_open(client, data_len);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to open HTTP connection: %s", esp_err_to_name(err));
        esp_http_client_cleanup(client);
        return;
    }

    int w_len = esp_http_client_write(client, (const char *)record_buf, data_len);
    if (w_len < 0)
    {
        ESP_LOGE(TAG, "Failed to write HTTP body");
        esp_http_client_cleanup(client);
        return;
    }

    int content_length = esp_http_client_fetch_headers(client);
    if (content_length < 0)
    {
        ESP_LOGE(TAG, "HTTP fetch headers failed");
        esp_http_client_cleanup(client);
        return;
    }

    int status_code = esp_http_client_get_status_code(client);
    ESP_LOGI(TAG, "HTTP Status Code: %d, Content-Length: %d", status_code, content_length);

    if (status_code == 200)
    {
        // Transition to SPEAKING
        setState(BMOState::SPEAKING);
        display_face(FACE_HAPPY);

        // Read response in chunks and play
        char read_buf[1024];
        int read_bytes;
        bool checked_header = false;

        while ((read_bytes = esp_http_client_read(client, read_buf, sizeof(read_buf))) > 0)
        {
            char *play_ptr = read_buf;
            int play_len = read_bytes;

            if (!checked_header)
            {
                checked_header = true;
                // Cek apakah data response berupa file WAV (dimulai dengan "RIFF" dan "WAVE")
                if (read_bytes >= 44 && 
                    read_buf[0] == 'R' && read_buf[1] == 'I' && read_buf[2] == 'F' && read_buf[3] == 'F')
                {
                    // Skip WAV header (44 bytes pertama) untuk memutar data raw PCM
                    play_ptr += 44;
                    play_len -= 44;
                    ESP_LOGI(TAG, "WAV header detected and skipped");
                }
                else
                {
                    ESP_LOGI(TAG, "Playing raw PCM stream");
                }
            }

            if (play_len > 0)
            {
                audio_play_pcm((const int16_t *)play_ptr, play_len / sizeof(int16_t));
            }
        }
    }
    else
    {
        ESP_LOGW(TAG, "Backend returned error status code: %d", status_code);
        // Tampilkan wajah sedih jika backend gagal merespon
        display_face(FACE_SAD);
        vTaskDelay(pdMS_TO_TICKS(2000));
    }

    esp_http_client_close(client);
    esp_http_client_cleanup(client);
}
