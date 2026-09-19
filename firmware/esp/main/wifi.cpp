#include "wifi.h"
#include "network.h"
#include "joy_identity.h"
#include "joy_ble_provisioning.h"
#include "api.h"

#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_netif_sntp.h"
#include "nvs_flash.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "esp_heap_caps.h"
#include <time.h>
#include <string.h>
#include <stdlib.h>
#include "cJSON.h"
static const char *WIFI_TAG = "WIFI";

static TaskHandle_t time_sync_task_handle = NULL;
static TaskHandle_t s_finalize_task_handle = NULL;
static volatile bool s_finalize_spawn_pending = false;
static StaticSemaphore_t s_scan_mutex_storage;
static SemaphoreHandle_t s_scan_mutex = nullptr;

static void log_heap_diagnostics(const char *context)
{
    size_t free_heap = esp_get_free_heap_size();
    size_t internal_free = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    size_t internal_largest = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    size_t spiram_free = heap_caps_get_free_size(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    size_t spiram_largest = heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);

    ESP_LOGI(WIFI_TAG, "[%s] Heap diagnostics: total_free=%u internal_free=%u internal_largest=%u spiram_free=%u spiram_largest=%u",
             context ? context : "MEMORY",
             (unsigned)free_heap, (unsigned)internal_free, (unsigned)internal_largest,
             (unsigned)spiram_free, (unsigned)spiram_largest);
}


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

#if defined(NETIF_SNTP_EVENT) && defined(NETIF_SNTP_TIME_SYNC)
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
#endif

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
        log_heap_diagnostics("SNTP_PRE_CREATE");
        BaseType_t task_result = xTaskCreate(
            time_sync_task, "sntp_wait", 3072, NULL, 3, &time_sync_task_handle);
        ESP_LOGI(WIFI_TAG, "SNTP worker create return=%s handle_available=%d",
                 task_result == pdPASS ? "pdPASS" : "pdFAIL",
                 time_sync_task_handle != NULL ? 1 : 0);
        if (task_result != pdPASS)
        {
            log_heap_diagnostics("SNTP_POST_CREATE_FAIL");
        }
    }
    else
    {
        ESP_LOGI(WIFI_TAG, "SNTP worker create skipped: worker_already_present=1");
    }
}

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

static void finalize_worker_task(void *param)
{
    ESP_LOGI(WIFI_TAG, "Finalize worker task started (stack: 8192 bytes)");

    // Wait for SNTP time synchronization to ensure TLS certificate verification succeeds
    ESP_LOGI(WIFI_TAG, "Waiting for valid network time before backend finalize...");
    EventBits_t bits = network_wait_for_valid_time(pdMS_TO_TICKS(15000));
    if ((bits & NETWORK_TIME_SYNCED_BIT) == 0)
    {
        ESP_LOGW(WIFI_TAG, "Time sync timeout reached; proceeding with finalize attempt anyway");
    }

    constexpr int MAX_FINALIZE_ATTEMPTS = 5;
    const int retry_delays_ms[MAX_FINALIZE_ATTEMPTS] = { 500, 1500, 3000, 5000, 5000 };

    for (int attempt = 1; attempt <= MAX_FINALIZE_ATTEMPTS; attempt++)
    {
        if (!network_has_ip())
        {
            ESP_LOGW(WIFI_TAG, "Finalize attempt %d/%d paused: no IP address", attempt, MAX_FINALIZE_ATTEMPTS);
            network_wait_for_got_ip(pdMS_TO_TICKS(10000));
        }

        ESP_LOGI(WIFI_TAG, "Executing backend finalize attempt %d/%d...", attempt, MAX_FINALIZE_ATTEMPTS);
        esp_err_t err = joy_ble_finalize_with_backend();
        if (err == ESP_OK)
        {
            ESP_LOGI(WIFI_TAG, "Backend finalize completed successfully on attempt %d!", attempt);
            break;
        }

        ESP_LOGW(WIFI_TAG, "Backend finalize attempt %d failed (%s)", attempt, esp_err_to_name(err));
        if (attempt < MAX_FINALIZE_ATTEMPTS)
        {
            int delay_ms = retry_delays_ms[attempt - 1];
            vTaskDelay(pdMS_TO_TICKS(delay_ms));
        }
    }

    UBaseType_t hwm = uxTaskGetStackHighWaterMark(NULL);
    ESP_LOGI(WIFI_TAG, "Finalize worker task exiting: stack_hwm=%u bytes", (unsigned)(hwm * sizeof(StackType_t)));
    s_finalize_task_handle = NULL;
    vTaskDelete(NULL);
}

static void try_start_finalize_worker()
{
    const joy_runtime_creds_t *rt = joy_runtime_get();
    if (!rt || !rt->pending_finalize)
    {
        s_finalize_spawn_pending = false;
        return;
    }

    if (!network_has_ip())
    {
        return;
    }

    if (s_finalize_task_handle != NULL)
    {
        s_finalize_spawn_pending = false;
        return;
    }

    log_heap_diagnostics("FINALIZE_PRE_CREATE");

    ESP_LOGI(WIFI_TAG, "Attempting to create ble_finalize task (stack: 8192 bytes)...");
    BaseType_t ret = xTaskCreateWithCaps(
        finalize_worker_task,
        "ble_finalize",
        8192,
        NULL,
        5,
        &s_finalize_task_handle,
        MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);

    if (ret == pdPASS && s_finalize_task_handle != NULL)
    {
        s_finalize_spawn_pending = false;
        ESP_LOGI(WIFI_TAG, "ble_finalize task created successfully (handle=%p)", s_finalize_task_handle);
        log_heap_diagnostics("FINALIZE_POST_CREATE_PASS");
    }
    else
    {
        s_finalize_spawn_pending = true;
        ESP_LOGE(WIFI_TAG, "Failed to create ble_finalize task: ret=%d (pdFAIL=%d)", (int)ret, (int)pdFAIL);
        log_heap_diagnostics("FINALIZE_POST_CREATE_FAIL");
    }
}

static void wifi_paged_scan_poll(void);

void wifi_poll(void)
{
    if (s_finalize_spawn_pending)
    {
        try_start_finalize_worker();
    }
    wifi_paged_scan_poll();
}

static void event_handler(
    void* arg,
    esp_event_base_t event_base,
    int32_t event_id,
    void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START)
    {
        const joy_runtime_creds_t *rt = joy_runtime_get();
        if (rt && strlen(rt->wifi_ssid) > 0)
        {
            ESP_LOGI(WIFI_TAG, "Connecting to WiFi SSID \"%s\"...", rt->wifi_ssid);
            esp_err_t err = esp_wifi_connect();
            if (err != ESP_OK)
            {
                ESP_LOGW(WIFI_TAG, "Failed to start WiFi connection: %s", esp_err_to_name(err));
            }
        }
        else
        {
            ESP_LOGI(WIFI_TAG, "No Wi-Fi credentials configured; awaiting BLE provisioning");
        }
    }
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_CONNECTED)
    {
        network_set_wifi_connected(true);
        const joy_runtime_creds_t *rt = joy_runtime_get();
        const char *ssid = (rt && rt->wifi_ssid[0]) ? rt->wifi_ssid : "(unknown)";
        ESP_LOGI(WIFI_TAG, "Connected to AP \"%s\", waiting for IP...", ssid);
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
            const joy_runtime_creds_t *rt = joy_runtime_get();
            const char *ssid = (rt && rt->wifi_ssid[0]) ? rt->wifi_ssid : "(current)";
            ESP_LOGW(WIFI_TAG, "No AP found for SSID \"%s\". Check SSID, 2.4 GHz visibility, range, or hidden AP settings.", ssid);
        }
        if (joy_ble_is_active() && joy_ble_get_state() != JoyBleState::CLAIM_COMMITTED)
        {
            ESP_LOGI(WIFI_TAG, "BLE provisioning active; pausing automatic Wi-Fi reconnect");
            return;
        }

        esp_err_t err = esp_wifi_connect();
        if (err != ESP_OK)
        {
            ESP_LOGW(WIFI_TAG, "Failed to retry WiFi connection: %s", esp_err_to_name(err));
        }
    }
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_SCAN_DONE)
    {
        const auto *event = static_cast<const wifi_event_sta_scan_done_t *>(event_data);
        wifi_paged_scan_on_scan_done(event ? event->status : 1);
    }
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        network_set_wifi_connected(true);
        network_set_got_ip(true);
        start_time_sync_after_ip();
        api_ws_reset_authentication_blocked();
        ESP_LOGI(WIFI_TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        // Get current RSSI
        wifi_ap_record_t ap_info = {};
        int rssi = -50;
        if (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK) {
            rssi = ap_info.rssi;
        }

        const joy_runtime_creds_t *rt = joy_runtime_get();
        if (rt && rt->pending_finalize)
        {
            ESP_LOGI(WIFI_TAG, "Scheduling finalize background task after IP acquisition...");
            s_finalize_spawn_pending = true;
            try_start_finalize_worker();
        }
    }
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_LOST_IP)
    {
        network_set_got_ip(false);
        network_set_time_synced(false);
        ESP_LOGW(WIFI_TAG, "Lost IP address");
    }
}
void wifi_init(void)
{
    s_scan_mutex = xSemaphoreCreateMutexStatic(&s_scan_mutex_storage);
    network_init();


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
#if defined(NETIF_SNTP_EVENT) && defined(NETIF_SNTP_TIME_SYNC)
    esp_event_handler_instance_t instance_sntp_sync;
#endif
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
#if defined(NETIF_SNTP_EVENT) && defined(NETIF_SNTP_TIME_SYNC)
    esp_err_t sntp_event_register_err = esp_event_handler_instance_register(
        NETIF_SNTP_EVENT,
        NETIF_SNTP_TIME_SYNC,
        &sntp_event_handler,
        NULL,
        &instance_sntp_sync);
    ESP_LOGI(WIFI_TAG, "SNTP event handler register return_code=%s(%d)",
             esp_err_to_name(sntp_event_register_err), (int)sntp_event_register_err);
#endif


    joy_identity_init();
    const joy_runtime_creds_t *runtime = joy_runtime_get();

    wifi_config_t wifi_config = {};
    wifi_config.sta.threshold.authmode = WIFI_AUTH_OPEN;
    wifi_config.sta.pmf_cfg.capable = true;
    wifi_config.sta.pmf_cfg.required = false;
    if (runtime && strlen(runtime->wifi_ssid) > 0)
    {
        strncpy((char*)wifi_config.sta.ssid, runtime->wifi_ssid, sizeof(wifi_config.sta.ssid) - 1);
        strncpy((char*)wifi_config.sta.password, runtime->wifi_password, sizeof(wifi_config.sta.password) - 1);
        ESP_LOGI(WIFI_TAG, "WiFi config loaded from NVS: ssid=\"%s\"", (const char*)wifi_config.sta.ssid);
    }
    else
    {
        ESP_LOGI(WIFI_TAG, "No WiFi credentials in NVS. Device ready for BLE provisioning.");
    }

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_LOGI(WIFI_TAG, "WiFi STA config applied");

    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(WIFI_TAG, "WiFi initialization complete. Waiting for STA_START event...");
}

void wifi_connect_to_ap(const char *ssid, const char *password)
{
    if (!ssid || strlen(ssid) == 0) return;
    ESP_LOGI(WIFI_TAG, "Configuring WiFi STA for SSID \"%s\"...", ssid);
    api_ws_reset_authentication_blocked();
    joy_runtime_save_wifi(ssid, password ? password : "");

    wifi_config_t conf = {};
    strncpy((char *)conf.sta.ssid, ssid, sizeof(conf.sta.ssid) - 1);
    if (password && strlen(password) > 0) {
        strncpy((char *)conf.sta.password, password, sizeof(conf.sta.password) - 1);
    }
    conf.sta.threshold.authmode = WIFI_AUTH_OPEN;
    conf.sta.pmf_cfg.capable = true;
    conf.sta.pmf_cfg.required = false;

    esp_wifi_disconnect();
    esp_wifi_set_config(WIFI_IF_STA, &conf);
    esp_wifi_connect();
}

struct ScannedAp {
    char ssid[33];
    int8_t rssi;
    char security[8];
};

static int compare_ap_rssi(const void *a, const void *b)
{
    const struct ScannedAp *ap_a = (const struct ScannedAp *)a;
    const struct ScannedAp *ap_b = (const struct ScannedAp *)b;
    return (ap_b->rssi - ap_a->rssi);
}


enum class WifiPagedScanStatus {
    IDLE,
    SCANNING,
    READY,
    ERROR
};

static uint32_t s_paged_scan_id = 0;
static WifiPagedScanStatus s_paged_scan_status = WifiPagedScanStatus::IDLE;
static char s_paged_scan_error[32] = {0};
static struct ScannedAp s_paged_scan_aps[12];
static size_t s_paged_scan_count = 0;
static uint16_t s_paged_scan_selected_index = 0;
static bool s_paged_scan_requested = false;

esp_err_t wifi_paged_scan_schedule(uint32_t scan_id)
{
    if (!s_scan_mutex) return ESP_ERR_INVALID_STATE;
    xSemaphoreTake(s_scan_mutex, portMAX_DELAY);
    if (s_paged_scan_status == WifiPagedScanStatus::SCANNING) {
        xSemaphoreGive(s_scan_mutex);
        return ESP_ERR_INVALID_STATE;
    }
    s_paged_scan_id = scan_id;
    s_paged_scan_status = WifiPagedScanStatus::SCANNING;
    s_paged_scan_count = 0;
    s_paged_scan_selected_index = 0;
    s_paged_scan_error[0] = '\0';
    s_paged_scan_requested = true;
    if (joy_ble_get_state() == JoyBleState::PHYSICAL_CONFIRMED ||
        joy_ble_get_state() == JoyBleState::WAITING_WIFI_CREDENTIALS) {
        joy_ble_set_state(JoyBleState::WIFI_SCANNING);
    }
    ESP_LOGI(WIFI_TAG, "Wi-Fi scan scheduled: scan_id=%lu", (unsigned long)scan_id);
    xSemaphoreGive(s_scan_mutex);
    return ESP_OK;
}

esp_err_t wifi_paged_scan_select_page(uint32_t scan_id, uint16_t index)
{
    if (!s_scan_mutex) return ESP_ERR_INVALID_STATE;
    xSemaphoreTake(s_scan_mutex, portMAX_DELAY);
    const bool valid = scan_id == s_paged_scan_id &&
                       s_paged_scan_status == WifiPagedScanStatus::READY &&
                       index < s_paged_scan_count;
    if (valid) s_paged_scan_selected_index = index;
    xSemaphoreGive(s_scan_mutex);
    return valid ? ESP_OK : ESP_ERR_INVALID_ARG;
}

static void wifi_paged_scan_poll(void)
{
    if (!s_scan_mutex) return;
    xSemaphoreTake(s_scan_mutex, portMAX_DELAY);
    if (s_paged_scan_requested)
    {
        s_paged_scan_requested = false;
        wifi_scan_config_t scan_config = {};
        scan_config.show_hidden = false;
        scan_config.scan_type = WIFI_SCAN_TYPE_ACTIVE;
        // Default scan_time (0) is required when Bluetooth coexistence is active
        esp_err_t err = esp_wifi_scan_start(&scan_config, false);
        ESP_LOGI(WIFI_TAG, "paged scan esp_wifi_scan_start returned %d", (int)err);
        if (err != ESP_OK) {
            s_paged_scan_status = WifiPagedScanStatus::ERROR;
            snprintf(s_paged_scan_error, sizeof(s_paged_scan_error), "SCAN_START_%d", (int)err);
            s_paged_scan_error[sizeof(s_paged_scan_error) - 1] = '\0';
            if (joy_ble_get_state() == JoyBleState::WIFI_SCANNING) {
                joy_ble_set_state(JoyBleState::WAITING_WIFI_CREDENTIALS);
            }
        }
    }
    xSemaphoreGive(s_scan_mutex);
}

void wifi_paged_scan_on_scan_done(uint32_t scan_status)
{
    if (!s_scan_mutex) return;
    xSemaphoreTake(s_scan_mutex, portMAX_DELAY);
    if (s_paged_scan_status != WifiPagedScanStatus::SCANNING) {
        esp_wifi_clear_ap_list();
        xSemaphoreGive(s_scan_mutex);
        return;
    }

    uint16_t ap_count = 0;
    esp_err_t err = scan_status == 0 ? esp_wifi_scan_get_ap_num(&ap_count) : ESP_FAIL;
    // Consume one driver-owned record at a time: this callback runs on the
    // 2304-byte system event task. A 32-record local array overflowed its stack.
    wifi_ap_record_t record = {};

    s_paged_scan_count = 0;
    for (uint16_t i = 0; err == ESP_OK && i < ap_count; i++) {
        err = esp_wifi_scan_get_ap_record(&record);
        if (err != ESP_OK) break;
        const char *ssid = (const char *)record.ssid;
        if (ssid[0] == '\0') continue;

        int existing_idx = -1;
        for (size_t u = 0; u < s_paged_scan_count; u++) {
            if (strncmp(s_paged_scan_aps[u].ssid, ssid, 32) == 0) {
                existing_idx = (int)u;
                break;
            }
        }

        const char *sec = "WPA2";
        if (record.authmode == WIFI_AUTH_OPEN) {
            sec = "OPEN";
        } else if (record.authmode == WIFI_AUTH_WPA3_PSK || record.authmode == WIFI_AUTH_WPA2_WPA3_PSK) {
            sec = "WPA3";
        }

        if (existing_idx >= 0) {
            if (record.rssi > s_paged_scan_aps[existing_idx].rssi) {
                s_paged_scan_aps[existing_idx].rssi = record.rssi;
                strncpy(s_paged_scan_aps[existing_idx].security, sec, sizeof(s_paged_scan_aps[existing_idx].security) - 1);
                s_paged_scan_aps[existing_idx].security[sizeof(s_paged_scan_aps[existing_idx].security) - 1] = '\0';
            }
        } else if (s_paged_scan_count < 12) {
            strncpy(s_paged_scan_aps[s_paged_scan_count].ssid, ssid, sizeof(s_paged_scan_aps[s_paged_scan_count].ssid) - 1);
            s_paged_scan_aps[s_paged_scan_count].ssid[sizeof(s_paged_scan_aps[s_paged_scan_count].ssid) - 1] = '\0';
            s_paged_scan_aps[s_paged_scan_count].rssi = record.rssi;
            strncpy(s_paged_scan_aps[s_paged_scan_count].security, sec, sizeof(s_paged_scan_aps[s_paged_scan_count].security) - 1);
            s_paged_scan_aps[s_paged_scan_count].security[sizeof(s_paged_scan_aps[s_paged_scan_count].security) - 1] = '\0';
            s_paged_scan_count++;
        }
    }

    esp_wifi_clear_ap_list();
    if (err != ESP_OK) {
        s_paged_scan_count = 0;
        s_paged_scan_status = WifiPagedScanStatus::ERROR;
        snprintf(s_paged_scan_error, sizeof(s_paged_scan_error), "SCAN_RESULTS_%d", (int)err);
    } else {
        qsort(s_paged_scan_aps, s_paged_scan_count, sizeof(struct ScannedAp), compare_ap_rssi);
        s_paged_scan_status = WifiPagedScanStatus::READY;
        ESP_LOGI(WIFI_TAG, "Wi-Fi scan ready: scan_id=%lu networks=%u",
                 (unsigned long)s_paged_scan_id, (unsigned)s_paged_scan_count);
    }
    if (joy_ble_get_state() == JoyBleState::WIFI_SCANNING) {
        joy_ble_set_state(JoyBleState::WAITING_WIFI_CREDENTIALS);
    }
    xSemaphoreGive(s_scan_mutex);
}

char *wifi_paged_scan_get_page_json(void)
{
    if (!s_scan_mutex) return nullptr;
    cJSON *root = cJSON_CreateObject();
    if (!root) return NULL;
    xSemaphoreTake(s_scan_mutex, portMAX_DELAY);

    cJSON_AddNumberToObject(root, "scan_id", s_paged_scan_id);

    const char *status_str = "IDLE";
    if (s_paged_scan_status == WifiPagedScanStatus::SCANNING) status_str = "SCANNING";
    else if (s_paged_scan_status == WifiPagedScanStatus::READY) status_str = "READY";
    else if (s_paged_scan_status == WifiPagedScanStatus::ERROR) status_str = "ERROR";

    cJSON_AddStringToObject(root, "status", status_str);
    cJSON_AddNumberToObject(root, "index", s_paged_scan_selected_index);
    cJSON_AddNumberToObject(root, "total", s_paged_scan_count);

    if (s_paged_scan_status == WifiPagedScanStatus::READY && s_paged_scan_selected_index < s_paged_scan_count) {
        cJSON *net = cJSON_CreateObject();
        cJSON_AddStringToObject(net, "ssid", s_paged_scan_aps[s_paged_scan_selected_index].ssid);
        cJSON_AddNumberToObject(net, "rssi", s_paged_scan_aps[s_paged_scan_selected_index].rssi);
        cJSON_AddStringToObject(net, "security", s_paged_scan_aps[s_paged_scan_selected_index].security);
        cJSON_AddItemToObject(root, "network", net);
    } else {
        cJSON_AddNullToObject(root, "network");
    }

    if (s_paged_scan_status == WifiPagedScanStatus::ERROR && s_paged_scan_error[0] != '\0') {
        cJSON_AddStringToObject(root, "error_code", s_paged_scan_error);
    } else {
        cJSON_AddNullToObject(root, "error_code");
    }

    xSemaphoreGive(s_scan_mutex);
    char *json = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return json;
}

