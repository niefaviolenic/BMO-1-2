#include "boot_diagnostics.h"
#include "display.h"
#include "audio.h"
#include "wakeword.h"
#include "button.h"
#include "wifi.h"
#include "state.h"
#include "api.h"
#include "network.h"
#include "joy_identity.h"
#include "joy_ble_provisioning.h"

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_heap_caps.h"

#include <cstdio>
#include <cstring>

static void serial_cli_task(void *param)
{
    vTaskDelay(pdMS_TO_TICKS(1500));
    ESP_LOGI("CLI", "==================================================");
    ESP_LOGI("CLI", " Joy Serial CLI Ready");
    ESP_LOGI("CLI", " Command: WIFI:<SSID>:<PASSWORD>");
    ESP_LOGI("CLI", " Example: WIFI:MyWifiNetwork:mypassword123");
    ESP_LOGI("CLI", " Status : STATUS");
    ESP_LOGI("CLI", "==================================================");

    char line_buf[128];
    while (true)
    {
        if (fgets(line_buf, sizeof(line_buf), stdin) != NULL)
        {
            size_t len = strlen(line_buf);
            while (len > 0 && (line_buf[len - 1] == '\r' || line_buf[len - 1] == '\n'))
            {
                line_buf[--len] = '\0';
            }
            if (len == 0) continue;

            if (strncmp(line_buf, "WIFI:", 5) == 0)
            {
                char *ssid = line_buf + 5;
                char *colon = strchr(ssid, ':');
                char *pass = NULL;
                if (colon)
                {
                    *colon = '\0';
                    pass = colon + 1;
                }
                ESP_LOGI("CLI", ">> Received Wi-Fi config via Serial CLI: SSID=\"%s\"", ssid);
                wifi_connect_to_ap(ssid, pass ? pass : "");
            }
            else if (strcmp(line_buf, "STATUS") == 0)
            {
                const joy_runtime_creds_t *rt = joy_runtime_get();
                ESP_LOGI("CLI", ">> Status: Wi-Fi=%s, SSID=\"%s\", IP=%s",
                         network_is_wifi_connected() ? "CONNECTED" : "DISCONNECTED",
                         (rt && rt->wifi_ssid[0]) ? rt->wifi_ssid : "(none)",
                         network_has_ip() ? "YES" : "NO");
            }
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
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
    ESP_ERROR_CHECK(boot_diagnostics_init());

    joy_identity_init();
    network_init();

    display_init();

    audio_init();
    audio_setVolume(SPEAKER_DEFAULT_VOLUME);
    wakeword_init();

    button_init();
    joy_ble_provisioning_init();
    
    // Inisialisasi koneksi WiFi
    wifi_init();

    xTaskCreateWithCaps(
        api_init_when_network_ready_task,
        "api_init_network",
        4096,
        NULL,
        3,
        NULL,
        MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    xTaskCreate(
        serial_cli_task,
        "serial_cli",
        4096,
        NULL,
        2,
        NULL);

    // Jalankan background task state machine orchestrator
    joy_state_machine_init();


    while (true)
    {
        button_update();
        joy_ble_poll();
        wifi_poll();
        vTaskDelay(pdMS_TO_TICKS(20));
    }
}
