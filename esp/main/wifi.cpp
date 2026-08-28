#include "wifi.h"
#include "network.h"

#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_netif_sntp.h"
#include "nvs_flash.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <time.h>
#include <string.h>

static const char *WIFI_TAG = "WIFI";

static TaskHandle_t time_sync_task_handle = NULL;

static bool system_time_is_valid()
{
    time_t now = 0;
    time(&now);
    return now >= 1704067200; // 2024-01-01T00:00:00Z
}

static void sntp_time_sync_callback(struct timeval *tv)
{
    ESP_LOGI(WIFI_TAG, "SNTP sync callback invoked: event_data=%s epoch_sec=%lld",
             tv != NULL ? "available" : "unavailable",
             tv != NULL ? (long long)tv->tv_sec : 0LL);
    if (system_time_is_valid())
    {
        network_set_time_synced(true);
        ESP_LOGI(WIFI_TAG, "SNTP time synced via callback; readiness_bit=1");
    }
}

static void sntp_event_handler(
    void *arg,
    esp_event_base_t event_base,
    int32_t event_id,
    void *event_data)
{
    if (event_base == NETIF_SNTP_EVENT && event_id == NETIF_SNTP_TIME_SYNC)
    {
        esp_netif_sntp_time_sync_t *event = (esp_netif_sntp_time_sync_t *)event_data;
        ESP_LOGI(WIFI_TAG, "SNTP time-sync event received: event_data=%s epoch_sec=%lld",
                 event != NULL ? "available" : "unavailable",
                 event != NULL ? (long long)event->tv.tv_sec : 0LL);
        if (system_time_is_valid())
        {
            network_set_time_synced(true);
            ESP_LOGI(WIFI_TAG, "SNTP time synced via event handler; readiness_bit=1");
        }
    }
}

static void time_sync_task(void *param)
{
    time_sync_task_handle = xTaskGetCurrentTaskHandle();
    ESP_LOGI(WIFI_TAG, "SNTP worker started: handle_available=%d", time_sync_task_handle != NULL ? 1 : 0);

    if (!system_time_is_valid())
    {
        ESP_LOGI(WIFI_TAG, "SNTP sync wait begin: timeout_ms=30000");
        esp_err_t err = esp_netif_sntp_sync_wait(pdMS_TO_TICKS(30000));
        ESP_LOGI(WIFI_TAG, "SNTP sync wait end: return_code=%s(%d)",
                 esp_err_to_name(err), (int)err);
        if (err != ESP_OK)
        {
            if (system_time_is_valid())
            {
                network_set_time_synced(true);
                ESP_LOGI(WIFI_TAG, "SNTP wait returned error/timeout but system time is valid; readiness_bit=1");
            }
            else
            {
                network_set_time_synced(false);
                ESP_LOGW(WIFI_TAG, "SNTP sync timeout/failure: return_code=%s(%d)",
                         esp_err_to_name(err), (int)err);
            }
            time_sync_task_handle = NULL;
            vTaskDelete(NULL);
            return;
        }
    }

    if (system_time_is_valid())
    {
        network_set_time_synced(true);
        ESP_LOGI(WIFI_TAG, "SNTP time is valid; TLS connections may start; readiness_bit=1");
    }
    else
    {
        network_set_time_synced(false);
        ESP_LOGW(WIFI_TAG, "SNTP returned but system time is still invalid; readiness_bit=0");
    }

    time_sync_task_handle = NULL;
    vTaskDelete(NULL);
}

static void start_time_sync_after_ip()
{
    ESP_LOGI(WIFI_TAG, "SNTP start requested after IP acquisition");

    if (system_time_is_valid())
    {
        network_set_time_synced(true);
        ESP_LOGI(WIFI_TAG, "System time is already valid on IP acquisition; readiness_bit=1");
    }
    else
    {
        network_set_time_synced(false);
    }

    esp_err_t err = esp_netif_sntp_start();
    ESP_LOGI(WIFI_TAG, "SNTP start return_code=%s(%d)", esp_err_to_name(err), (int)err);
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE)
    {
        ESP_LOGW(WIFI_TAG, "Failed to start SNTP: %s", esp_err_to_name(err));
        return;
    }

    if (time_sync_task_handle == NULL)
    {
        BaseType_t task_result = xTaskCreate(
            time_sync_task, "sntp_wait", 3072, NULL, 3, &time_sync_task_handle);
        ESP_LOGI(WIFI_TAG, "SNTP worker create return=%s handle_available=%d",
                 task_result == pdPASS ? "pdPASS" : "pdFAIL",
                 time_sync_task_handle != NULL ? 1 : 0);
    }
    else
    {
        ESP_LOGI(WIFI_TAG, "SNTP worker create skipped: worker_already_present=1");
    }
}

// Ganti dengan SSID dan Password WiFi kamu
#define JOY_WIFI_SSID "TIKKUM"
#define JOY_WIFI_PASS "kopikumbang"

static const char *wifi_disconnect_reason_to_string(uint8_t reason)
{
    switch (reason)
    {
        case WIFI_REASON_BEACON_TIMEOUT:
            return "BEACON_TIMEOUT";
        case WIFI_REASON_NO_AP_FOUND:
            return "NO_AP_FOUND";
        case WIFI_REASON_AUTH_FAIL:
            return "AUTH_FAIL";
        case WIFI_REASON_ASSOC_FAIL:
            return "ASSOC_FAIL";
        case WIFI_REASON_HANDSHAKE_TIMEOUT:
            return "HANDSHAKE_TIMEOUT";
        case WIFI_REASON_CONNECTION_FAIL:
            return "CONNECTION_FAIL";
        case WIFI_REASON_NO_AP_FOUND_W_COMPATIBLE_SECURITY:
            return "NO_AP_FOUND_W_COMPATIBLE_SECURITY";
        case WIFI_REASON_NO_AP_FOUND_IN_AUTHMODE_THRESHOLD:
            return "NO_AP_FOUND_IN_AUTHMODE_THRESHOLD";
        case WIFI_REASON_NO_AP_FOUND_IN_RSSI_THRESHOLD:
            return "NO_AP_FOUND_IN_RSSI_THRESHOLD";
        default:
            return "UNKNOWN";
    }
}

static void event_handler(
    void* arg,
    esp_event_base_t event_base,
    int32_t event_id,
    void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START)
    {
        ESP_LOGI(WIFI_TAG, "Connecting to WiFi SSID \"%s\"...", JOY_WIFI_SSID);
        esp_err_t err = esp_wifi_connect();
        if (err != ESP_OK)
        {
            ESP_LOGW(WIFI_TAG, "Failed to start WiFi connection: %s", esp_err_to_name(err));
        }
    }
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_CONNECTED)
    {
        network_set_wifi_connected(true);
        ESP_LOGI(WIFI_TAG, "Connected to AP \"%s\", waiting for IP...", JOY_WIFI_SSID);
    }
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED)
    {
        wifi_event_sta_disconnected_t* event = (wifi_event_sta_disconnected_t*) event_data;
        uint8_t reason = event ? event->reason : 0;
        network_set_wifi_connected(false);
        ESP_LOGW(
            WIFI_TAG,
            "Disconnected from AP, reason=%u (%s). Retrying connection...",
            reason,
            wifi_disconnect_reason_to_string(reason));

        if (reason == WIFI_REASON_NO_AP_FOUND)
        {
            ESP_LOGW(WIFI_TAG, "No AP found for SSID \"%s\". Check SSID, 2.4 GHz visibility, range, or hidden AP settings.", JOY_WIFI_SSID);
        }

        esp_err_t err = esp_wifi_connect();
        if (err != ESP_OK)
        {
            ESP_LOGW(WIFI_TAG, "Failed to retry WiFi connection: %s", esp_err_to_name(err));
        }
    }
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        network_set_wifi_connected(true);
        network_set_got_ip(true);
        start_time_sync_after_ip();
        ESP_LOGI(WIFI_TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
    }
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_LOST_IP)
    {
        network_set_got_ip(false);
        network_set_time_synced(false);
        ESP_LOGW(WIFI_TAG, "Lost IP address");
    }
}

void wifi_init()
{
    network_init();

    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    esp_sntp_config_t sntp_config = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
    sntp_config.start = false;
    sntp_config.sync_cb = sntp_time_sync_callback;
    esp_err_t sntp_init_err = esp_netif_sntp_init(&sntp_config);
    ESP_LOGI(WIFI_TAG, "SNTP init return_code=%s(%d)",
             esp_err_to_name(sntp_init_err), (int)sntp_init_err);
    ESP_ERROR_CHECK(sntp_init_err);

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;
    esp_event_handler_instance_t instance_sntp_sync;
    ESP_ERROR_CHECK(
        esp_event_handler_instance_register(
            WIFI_EVENT,
            ESP_EVENT_ANY_ID,
            &event_handler,
            NULL,
            &instance_any_id));
    ESP_ERROR_CHECK(
        esp_event_handler_instance_register(
            IP_EVENT,
            ESP_EVENT_ANY_ID,
            &event_handler,
            NULL,
            &instance_got_ip));
    esp_err_t sntp_event_register_err = esp_event_handler_instance_register(
        NETIF_SNTP_EVENT,
        NETIF_SNTP_TIME_SYNC,
        &sntp_event_handler,
        NULL,
        &instance_sntp_sync);
    ESP_LOGI(WIFI_TAG, "SNTP event handler register return_code=%s(%d)",
             esp_err_to_name(sntp_event_register_err), (int)sntp_event_register_err);

    wifi_config_t wifi_config = {};
    strncpy((char*)wifi_config.sta.ssid, JOY_WIFI_SSID, sizeof(wifi_config.sta.ssid));
    strncpy((char*)wifi_config.sta.password, JOY_WIFI_PASS, sizeof(wifi_config.sta.password));
    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

    ESP_LOGI(
        WIFI_TAG,
        "WiFi config prepared: ssid=\"%s\", ssid_len=%u, password_len=%u, auth_threshold=WPA2_PSK",
        (const char*)wifi_config.sta.ssid,
        (unsigned)strlen((const char*)wifi_config.sta.ssid),
        (unsigned)strlen((const char*)wifi_config.sta.password));

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_LOGI(WIFI_TAG, "WiFi STA config applied");

    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(WIFI_TAG, "WiFi initialization complete. Waiting for STA_START event...");
}
