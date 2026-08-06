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
    network_wait_for_got_ip(portMAX_DELAY);

    ESP_LOGI(TAG, "WiFi got IP. API init started.");
    api_init();

    vTaskDelete(NULL);
}

extern "C" void app_main()
{
    network_init();

    display_init();
    display_sleep();

    audio_init();
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
