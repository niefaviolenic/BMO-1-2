#include "display.h"
#include "audio.h"
#include "wakeword.h"
#include "button.h"
#include "wifi.h"
#include "state.h"
#include "api.h"
#include "network.h"

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "MAIN";

static void api_init_when_network_ready_task(void *param)
{
    ESP_LOGI(TAG, "Waiting for WiFi IP before API init...");
    while (true)
    {
        network_wait_for_got_ip(portMAX_DELAY);
        ESP_LOGI(TAG, "WiFi got IP. Waiting for valid SNTP time before API init...");

        ESP_LOGI(TAG, "API readiness wait begin: required_bit=NETWORK_TIME_SYNCED_BIT timeout_ms=30000");
        EventBits_t bits = network_wait_for_valid_time(pdMS_TO_TICKS(30000));
        ESP_LOGI(TAG, "API readiness wait end: bits=0x%lx time_synced=%d",
                 (unsigned long)bits,
                 (bits & NETWORK_TIME_SYNCED_BIT) != 0 ? 1 : 0);
        if ((bits & NETWORK_TIME_SYNCED_BIT) != 0)
        {
            break;
        }

        ESP_LOGW(TAG, "API init waiting: reason=NETWORK_TIME_SYNCED_BIT_not_set; TLS/API startup remains paused");
        vTaskDelay(pdMS_TO_TICKS(1000));
    }

    ESP_LOGI(TAG, "WiFi and SNTP are ready. API init started.");
    api_init();

    vTaskDelete(NULL);
}

extern "C" void app_main()
{
    network_init();

    display_init();
    ESP_LOGI(TAG, "OUTPUT_DIAG LCD begin: red,yellow,blue,white,happy");
    TickType_t lcd_diag_start = xTaskGetTickCount();
    display_test_pattern();
    display_face(FACE_HAPPY);
    ESP_LOGI(TAG, "OUTPUT_DIAG LCD end: elapsed_ms=%lu",
             (unsigned long)((xTaskGetTickCount() - lcd_diag_start) * portTICK_PERIOD_MS));

    audio_init();
    audio_setVolume(0);
    ESP_LOGI(TAG, "OUTPUT_DIAG speaker begin: volume=%d", audio_getVolume());
    TickType_t speaker_diag_start = xTaskGetTickCount();
    audio_playHello();
    ESP_LOGI(TAG, "OUTPUT_DIAG speaker end: elapsed_ms=%lu",
             (unsigned long)((xTaskGetTickCount() - speaker_diag_start) * portTICK_PERIOD_MS));

    button_init();
    
    // Inisialisasi koneksi WiFi
    wifi_init();

    xTaskCreate(
        api_init_when_network_ready_task,
        "api_init_network",
        4096,
        NULL,
        3,
        NULL);

    // Jalankan background task state machine orchestrator
    bmo_state_machine_init();

    wakeword_init();

    while (true)
    {
        button_update();
        vTaskDelay(pdMS_TO_TICKS(20));
    }
}
