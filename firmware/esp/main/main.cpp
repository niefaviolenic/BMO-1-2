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
    ESP_LOGI("CLI", " Command: EXPR:<NAME|0-9|NEXT> - Test expression & voice");
    ESP_LOGI("CLI", " Example: EXPR:SAD, EXPR:HAPPY, EXPR:NEXT");
    ESP_LOGI("CLI", " Command: TEST:AUDIO          - Speaker chime test");
    ESP_LOGI("CLI", " Command: TEST:ALL            - Test all 10 expressions");
    ESP_LOGI("CLI", " Command: WIFI:<SSID>:<PASS>  - Set WiFi");
    ESP_LOGI("CLI", " Command: STATUS              - Check system status");
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

            if (strncmp(line_buf, "EXPR:", 5) == 0)
            {
                const char *cmd = line_buf + 5;
                int expr_idx = -1;
                if (strcasecmp(cmd, "HAPPY") == 0 || strcmp(cmd, "0") == 0) expr_idx = 0;
                else if (strcasecmp(cmd, "CUTE") == 0 || strcmp(cmd, "1") == 0) expr_idx = 1;
                else if (strcasecmp(cmd, "EXCITED") == 0 || strcmp(cmd, "2") == 0) expr_idx = 2;
                else if (strcasecmp(cmd, "SLEEPY") == 0 || strcmp(cmd, "3") == 0) expr_idx = 3;
                else if (strcasecmp(cmd, "ANGRY") == 0 || strcmp(cmd, "4") == 0) expr_idx = 4;
                else if (strcasecmp(cmd, "SAD") == 0 || strcmp(cmd, "5") == 0) expr_idx = 5;
                else if (strcasecmp(cmd, "WINK") == 0 || strcmp(cmd, "6") == 0) expr_idx = 6;
                else if (strcasecmp(cmd, "SURPRISED") == 0 || strcmp(cmd, "7") == 0) expr_idx = 7;
                else if (strcasecmp(cmd, "LOVE") == 0 || strcmp(cmd, "8") == 0) expr_idx = 8;
                else if (strcasecmp(cmd, "CONFUSED") == 0 || strcmp(cmd, "9") == 0) expr_idx = 9;
                else if (strcasecmp(cmd, "NEXT") == 0) {
                    static int s_cli_next = 0;
                    expr_idx = s_cli_next;
                    s_cli_next = (s_cli_next + 1) % 10;
                }

                if (expr_idx >= 0 && expr_idx < 10)
                {
                    ESP_LOGI("CLI", ">> Testing Expression [%d] via CLI", expr_idx);
                    display_trigger_expression_test(expr_idx);
                }
                else
                {
                    ESP_LOGW("CLI", ">> Unknown expression: '%s'. Valid: HAPPY, CUTE, EXCITED, SLEEPY, ANGRY, SAD, WINK, SURPRISED, LOVE, CONFUSED, NEXT, or 0-9", cmd);
                }
            }
            else if (strcmp(line_buf, "TEST:AUDIO") == 0)
            {
                ESP_LOGI("CLI", ">> Testing speaker audio on MAX98357A (DIN=17, BCLK=16, LRC=14)...");
                audio_playRecordingFinishedCue();
            }
            else if (strcmp(line_buf, "TEST:ALL") == 0)
            {
                ESP_LOGI("CLI", ">> Testing all 10 expressions in sequence...");
                for (int i = 0; i < 10; i++)
                {
                    display_trigger_expression_test(i);
                    vTaskDelay(pdMS_TO_TICKS(2500));
                }
            }
            else if (strncmp(line_buf, "WIFI:", 5) == 0)
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
            else if (strcmp(line_buf, "HELP") == 0)
            {
                ESP_LOGI("CLI", "Available commands:");
                ESP_LOGI("CLI", "  EXPR:<NAME>       - Test expression & voice (SAD, HAPPY, ANGRY, CUTE, EXCITED, SLEEPY, WINK, SURPRISED, LOVE, CONFUSED)");
                ESP_LOGI("CLI", "  EXPR:NEXT         - Cycle to next expression");
                ESP_LOGI("CLI", "  EXPR:<0-9>        - Test expression by index");
                ESP_LOGI("CLI", "  TEST:AUDIO        - Test speaker hardware chime");
                ESP_LOGI("CLI", "  TEST:ALL          - Test all 10 expressions sequentially");
                ESP_LOGI("CLI", "  WIFI:<SSID>:<PWD> - Connect Wi-Fi");
                ESP_LOGI("CLI", "  STATUS            - Check status");
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
