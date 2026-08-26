#include "api.h"
#include "bmo_credentials.h"
#include "bmo_dev_config.h"
#include "state.h"
#include "audio.h"
#include "playback.h"
#include "display.h"
#include "pairing.h"
#include "wakeword.h"
#include "network.h"

#include "esp_http_client.h"
#include "esp_websocket_client.h"
#include "esp_crt_bundle.h"
#include "cJSON.h"
#include "mp3dec.h"

#include "esp_log.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <time.h>

static const char *TAG = "API";

#define BMO_BACKEND_HOST "api.personalbmo.web.id"
#define BMO_WS_URL      "wss://" BMO_BACKEND_HOST "/ws"
#define BMO_UPLOAD_URL  "https://" BMO_BACKEND_HOST "/api/v1/voice"
#define WS_AUTH_TIMEOUT_MS 5000
#define BMO_BACKEND_STATE_MAX_LEN 16
#define BMO_PLAYBACK_REASON_MAX_LEN 24
#define MAX_WAV_BYTES 3145728U
#define MAX_WAV_DURATION_SEC 60U
#define WAV_SAMPLE_RATE 16000U
#define WAV_CHANNELS 1U
#define WAV_BITS_PER_SAMPLE 16U
#define WAV_BYTE_RATE (WAV_SAMPLE_RATE * WAV_CHANNELS * (WAV_BITS_PER_SAMPLE / 8U))
#define WAV_BLOCK_ALIGN (WAV_CHANNELS * (WAV_BITS_PER_SAMPLE / 8U))
#define UPLOAD_BODY_TIMEOUT_MS 30000U
#define UPLOAD_RESPONSE_MAX_BYTES 1024U
#define UPLOAD_MAX_ATTEMPTS 3U
#define TOTAL_PIPELINE_TIMEOUT_MS 300000U

enum BMOUploadResult {
    BMO_UPLOAD_ACCEPTED,
    BMO_UPLOAD_RETRYABLE_TRANSPORT,
    BMO_UPLOAD_RECONNECT_REQUIRED,
    BMO_UPLOAD_TERMINAL_CREDENTIAL,
    BMO_UPLOAD_TERMINAL_BUSY,
    BMO_UPLOAD_TERMINAL_REQUEST_CONFLICT,
    BMO_UPLOAD_TERMINAL_RECORDING,
    BMO_UPLOAD_TERMINAL_REQUEST,
    BMO_UPLOAD_TERMINAL_MALFORMED_RESPONSE,
    BMO_UPLOAD_TERMINAL_DUPLICATE
};

// Playback & State variables
enum BMOPlaybackState {
    BMO_PLAYBACK_IDLE,
    BMO_PLAYBACK_WAITING,
    BMO_PLAYBACK_DOWNLOADING,
    BMO_PLAYBACK_PLAYING,
    BMO_PLAYBACK_DONE,
    BMO_PLAYBACK_FAILED,
    BMO_PLAYBACK_DONE_PENDING_SEND,
    BMO_PLAYBACK_FAILED_PENDING_SEND,
    BMO_PLAYBACK_CANCELLED
};

enum BMOPlaybackResult {
    BMO_PLAYBACK_SUCCESS,
    BMO_PLAYBACK_EXPIRED,
    BMO_PLAYBACK_DOWNLOAD_FAILED,
    BMO_PLAYBACK_DECODE_FAILED,
    BMO_PLAYBACK_PLAYBACK_FAILED,
    BMO_PLAYBACK_REQUEST_FAILED
};

static volatile BMOPlaybackState playback_state = BMO_PLAYBACK_IDLE;
static char current_request_id[37] = {0};
static PlaybackJob current_playback_job = {};
static char backend_state[BMO_BACKEND_STATE_MAX_LEN] = "idle";
static char backend_active_request_id[37] = {0};
static TickType_t audio_deadline_tick = 0;

static esp_websocket_client_handle_t ws_client = NULL;
static bool ws_connected = false;
static bool ws_authenticated = false;
static bool ws_client_started = false;
static bool ws_auth_pending = false;
static TickType_t ws_auth_deadline = 0;
static bool ws_authentication_blocked = false;
static int ws_reconnect_delay_sec = 1;
static TickType_t ws_last_disconnect_tick = 0;
static uint32_t ws_lifecycle_sequence = 0;
static TickType_t ws_lifecycle_first_tick = 0;
static TickType_t ws_lifecycle_last_tick = 0;
static bool ws_reconnect_pending = false;
static bool ws_pairing_reconnect_pending = false;
static bool ws_connection_replacement_suppressed = false;

enum BMOWsLifecycleState {
    BMO_WS_LIFECYCLE_STOPPED,
    BMO_WS_LIFECYCLE_STARTED,
    BMO_WS_LIFECYCLE_CONNECTED,
    BMO_WS_LIFECYCLE_TERMINAL
};

static BMOWsLifecycleState ws_lifecycle_state = BMO_WS_LIFECYCLE_STOPPED;

static bool ws_reconnect_allowed()
{
    return !ws_authentication_blocked && !ws_connection_replacement_suppressed;
}

enum BMOPendingPlaybackEvent {
    BMO_PENDING_PLAYBACK_NONE,
    BMO_PENDING_PLAYBACK_DONE,
    BMO_PENDING_PLAYBACK_FAILED
};

static BMOPendingPlaybackEvent pending_playback_event = BMO_PENDING_PLAYBACK_NONE;
static char pending_playback_request_id[37] = {0};
static char pending_playback_reason[BMO_PLAYBACK_REASON_MAX_LEN] = {0};
static bool recovery_request_pending = false;
static volatile bool pending_request_failed = false;
static char pending_request_failed_id[37] = {0};
static char pending_request_failed_code[BMO_PLAYBACK_REASON_MAX_LEN] = {0};

static SemaphoreHandle_t ws_send_mutex = NULL;

static void log_ws_stack_high_water(const char *phase)
{
    UBaseType_t high_water_bytes = uxTaskGetStackHighWaterMark(NULL);
    ESP_LOGI(TAG, "WS task stack high-water mark at %s: %u bytes",
             phase, (unsigned)high_water_bytes);
}

static const char *ws_error_type_name(esp_websocket_error_type_t error_type)
{
    switch (error_type)
    {
        case WEBSOCKET_ERROR_TYPE_NONE:
            return "none";
        case WEBSOCKET_ERROR_TYPE_TCP_TRANSPORT:
            return "tcp_transport";
        case WEBSOCKET_ERROR_TYPE_PONG_TIMEOUT:
            return "pong_timeout";
        case WEBSOCKET_ERROR_TYPE_HANDSHAKE:
            return "handshake";
        case WEBSOCKET_ERROR_TYPE_SERVER_CLOSE:
            return "server_close";
        default:
            return "unknown";
    }
}

static const char *ws_lifecycle_state_name(BMOWsLifecycleState state)
{
    switch (state)
    {
        case BMO_WS_LIFECYCLE_STOPPED:
            return "stopped";
        case BMO_WS_LIFECYCLE_STARTED:
            return "started";
        case BMO_WS_LIFECYCLE_CONNECTED:
            return "connected";
        case BMO_WS_LIFECYCLE_TERMINAL:
            return "terminal";
        default:
            return "unknown";
    }
}

static void log_ws_diagnostics(const char *phase, const esp_websocket_event_data_t *data)
{
    TickType_t now_tick = xTaskGetTickCount();
    unsigned long now_ms = (unsigned long)(now_tick * portTICK_PERIOD_MS);
    unsigned long since_disconnect_ms = ws_last_disconnect_tick == 0
        ? 0
        : (unsigned long)((now_tick - ws_last_disconnect_tick) * portTICK_PERIOD_MS);

    if (data != NULL)
    {
        ESP_LOGW(TAG,
                 "WS diagnostics phase=%s now_ms=%lu since_disconnect_ms=%lu "
                 "error_type=%s(%d) close_status=%d handshake_status=%d "
                 "transport_errno=%d tls_err=%d tls_stack=%d tls_flags=%d "
                 "ws_connected=%d ws_authenticated=%d",
                 phase, now_ms, since_disconnect_ms,
                 ws_error_type_name(data->error_handle.error_type),
                 (int)data->error_handle.error_type,
                 data->close_status_code,
                 data->error_handle.esp_ws_handshake_status_code,
                 data->error_handle.esp_transport_sock_errno,
                 (int)data->error_handle.esp_tls_last_esp_err,
                 data->error_handle.esp_tls_stack_err,
                 data->error_handle.esp_tls_cert_verify_flags,
                 ws_connected ? 1 : 0,
                 ws_authenticated ? 1 : 0);
    }
    else
    {
        ESP_LOGW(TAG,
                 "WS diagnostics phase=%s now_ms=%lu since_disconnect_ms=%lu "
                 "event_data_unavailable ws_connected=%d ws_authenticated=%d",
                 phase, now_ms, since_disconnect_ms,
                 ws_connected ? 1 : 0,
                 ws_authenticated ? 1 : 0);
    }
}

static void log_ws_lifecycle_event(const char *event_name, const char *source,
                                   const esp_websocket_event_data_t *data)
{
    TickType_t now_tick = xTaskGetTickCount();
    if (ws_lifecycle_sequence == 0)
    {
        ws_lifecycle_first_tick = now_tick;
    }

    unsigned long now_ms = (unsigned long)((now_tick - ws_lifecycle_first_tick) * portTICK_PERIOD_MS);
    unsigned long delta_ms = ws_lifecycle_sequence == 0
        ? 0
        : (unsigned long)((now_tick - ws_lifecycle_last_tick) * portTICK_PERIOD_MS);
    ws_lifecycle_last_tick = now_tick;
    ws_lifecycle_sequence++;

    ESP_LOGI(TAG,
             "WS lifecycle seq=%lu event=%s source=%s now_ms=%lu delta_ms=%lu %s "
             "lifecycle_state=%s ws_client_started=%d ws_connected=%d ws_authenticated=%d",
             (unsigned long)ws_lifecycle_sequence, event_name, source,
             now_ms, delta_ms,
             data != NULL ? "event_data_available" : "event_data_unavailable",
             ws_lifecycle_state_name(ws_lifecycle_state),
             ws_client_started ? 1 : 0,
             ws_connected ? 1 : 0,
             ws_authenticated ? 1 : 0);
}

static void mark_ws_down(const char *source)
{
    if (ws_lifecycle_state != BMO_WS_LIFECYCLE_STOPPED)
    {
        ws_lifecycle_state = BMO_WS_LIFECYCLE_TERMINAL;
    }
    log_ws_lifecycle_event("state_down_before", source, NULL);
    ws_connected = false;
    ws_authenticated = false;
    ws_auth_pending = false;
    ws_auth_deadline = 0;
    pairing_on_disconnected();
    network_set_backend_connected(false);
    log_ws_lifecycle_event("state_down_after", source, NULL);
}

static esp_err_t start_ws_if_network_ready(const char *source)
{
    if (ws_client == NULL)
    {
        ESP_LOGW(TAG, "WS client is not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!network_has_ip() || !network_has_valid_time())
    {
        ESP_LOGW(TAG, "Network or valid time is not ready, delaying WebSocket start");
        return ESP_ERR_INVALID_STATE;
    }

    if (ws_authentication_blocked)
    {
        return ESP_ERR_INVALID_STATE;
    }

    if (ws_connection_replacement_suppressed)
    {
        return ESP_ERR_INVALID_STATE;
    }

    if (ws_client_started)
    {
        return ESP_OK;
    }

    log_ws_lifecycle_event("start_call_before", source, NULL);
    ws_client_started = true;
    ws_lifecycle_state = BMO_WS_LIFECYCLE_STARTED;
    esp_err_t err = esp_websocket_client_start(ws_client);
    if (err == ESP_OK)
    {
        ws_reconnect_pending = false;
        ESP_LOGI(TAG, "WebSocket started");
    }
    else
    {
        ws_client_started = false;
        ws_lifecycle_state = BMO_WS_LIFECYCLE_STOPPED;
        ESP_LOGW(TAG, "Failed to start WebSocket: %s", esp_err_to_name(err));
    }

    log_ws_lifecycle_event("start_call_after", source, NULL);
    ESP_LOGI(TAG, "WS lifecycle operation=start source=%s return_code=%s(%d)",
             source, esp_err_to_name(err), (int)err);

    return err;
}

static void stop_ws_if_started(const char *source)
{
    if (ws_client != NULL && ws_client_started)
    {
        log_ws_lifecycle_event("stop_call_before", source, NULL);
        esp_err_t err = esp_websocket_client_stop(ws_client);
        if (err != ESP_OK)
        {
            ESP_LOGW(TAG, "Failed to stop WebSocket: %s", esp_err_to_name(err));
        }

        if (err == ESP_OK)
        {
            ws_client_started = false;
            ws_lifecycle_state = BMO_WS_LIFECYCLE_STOPPED;
        }
        log_ws_lifecycle_event("stop_call_after", source, NULL);
        ESP_LOGI(TAG, "WS lifecycle operation=stop source=%s return_code=%s(%d)",
                 source, esp_err_to_name(err), (int)err);
    }
    else
    {
        log_ws_lifecycle_event("stop_skipped", source, NULL);
    }

    mark_ws_down(source);
}

// Skip ID3 tags
static int skip_id3_tag(esp_http_client_handle_t http_client, uint8_t *first_chunk,
                        int chunk_len, int *skipped_out, uint64_t *received_total) {
    if (chunk_len >= 10 && first_chunk[0] == 'I' && first_chunk[1] == 'D' && first_chunk[2] == '3') {
        uint32_t tag_size = ((first_chunk[6] & 0x7F) << 21) |
                            ((first_chunk[7] & 0x7F) << 14) |
                            ((first_chunk[8] & 0x7F) << 7) |
                            (first_chunk[9] & 0x7F);
        uint32_t total_skip = tag_size + 10;
        ESP_LOGI(TAG, "Detected ID3v2 tag of size %lu bytes. Skipping...", (unsigned long)total_skip);
        
        uint32_t already_read = chunk_len;
        if (total_skip <= already_read) {
            *skipped_out = total_skip;
            return 0;
        } else {
            uint32_t to_skip = total_skip - already_read;
            uint8_t temp_buf[512];
            while (to_skip > 0) {
                int r = esp_http_client_read(http_client, (char *)temp_buf, to_skip > sizeof(temp_buf) ? sizeof(temp_buf) : to_skip);
                if (r <= 0) {
                    ESP_LOGE(TAG, "Failed to skip ID3 tag: EOF or error");
                    return -1;
                }
                *received_total += (uint64_t)r;
                to_skip -= r;
            }
            *skipped_out = chunk_len; // Skipped all of the first chunk
            return 0;
        }
    }
    *skipped_out = 0;
    return 0;
}

// Generate UUID v4
static void generate_uuid_v4(char *buf) {
    uint32_t r0 = esp_random();
    uint32_t r1 = esp_random();
    uint32_t r2 = esp_random();
    uint32_t r3 = esp_random();
    
    sprintf(buf, "%08lx-%04lx-4%03lx-%04lx-%08lx%04lx",
            (unsigned long)r0,
            (unsigned long)(r1 & 0xFFFF),
            (unsigned long)((r1 >> 16) & 0x0FFF),
            (unsigned long)(((r2 & 0x3FFF) | 0x8000)),
            (unsigned long)(r3),
            (unsigned long)(r2 >> 16));
}

static bool is_hex_char(char value)
{
    return (value >= '0' && value <= '9') ||
           (value >= 'a' && value <= 'f') ||
           (value >= 'A' && value <= 'F');
}

static bool is_uuid_v4_string(const char *value)
{
    if (value == NULL || strlen(value) != 36)
        return false;

    for (int i = 0; i < 36; ++i)
    {
        if (i == 8 || i == 13 || i == 18 || i == 23)
        {
            if (value[i] != '-')
                return false;
        }
        else if (!is_hex_char(value[i]))
        {
            return false;
        }
    }

    return value[14] == '4' &&
           (value[19] == '8' || value[19] == '9' ||
            value[19] == 'a' || value[19] == 'A' ||
            value[19] == 'b' || value[19] == 'B');
}

static bool is_valid_backend_state(const cJSON *node)
{
    return node != NULL && cJSON_IsString(node) &&
           (strcmp(node->valuestring, "idle") == 0 ||
            strcmp(node->valuestring, "thinking") == 0 ||
            strcmp(node->valuestring, "audio_ready") == 0);
}

static const char *const PAIRING_CODE_FIELDS[] = {
    "event",
    "code",
    "expires_at",
};

static const char *const PAIRING_COMPLETED_FIELDS[] = {
    "event",
    "status",
};

static bool json_object_has_exact_fields(const cJSON *root,
                                         const char *const *fields,
                                         size_t field_count)
{
    if (root == NULL || !cJSON_IsObject(root))
        return false;

    size_t seen_fields = 0;
    for (const cJSON *item = root->child; item != NULL; item = item->next)
    {
        if (item->string == NULL)
            return false;

        bool field_is_allowed = false;
        for (size_t index = 0; index < field_count; ++index)
        {
            if (strcmp(item->string, fields[index]) == 0)
            {
                field_is_allowed = true;
                break;
            }
        }
        if (!field_is_allowed)
            return false;

        ++seen_fields;
    }

    return seen_fields == field_count;
}

static void set_audio_deadline(uint32_t expires_in_seconds)
{
    uint64_t ttl_ticks = ((uint64_t)expires_in_seconds * 1000ULL +
                          (uint64_t)portTICK_PERIOD_MS - 1ULL) /
                         (uint64_t)portTICK_PERIOD_MS;
    if (ttl_ticks == 0)
        ttl_ticks = 1;
    if (ttl_ticks > (uint64_t)portMAX_DELAY)
        ttl_ticks = (uint64_t)portMAX_DELAY;

    audio_deadline_tick = xTaskGetTickCount() + (TickType_t)ttl_ticks;
}

static bool audio_deadline_expired(void)
{
    if (audio_deadline_tick == 0 ||
        playback_is_expired(esp_timer_get_time() / 1000))
        return true;

    return (int32_t)(xTaskGetTickCount() - audio_deadline_tick) >= 0;
}

static void reset_audio_deadline(void)
{
    audio_deadline_tick = 0;
}

static void clear_current_playback_job()
{
    memset(&current_playback_job, 0, sizeof(current_playback_job));
}

static PlaybackTerminalResult playback_terminal_result(BMOPlaybackResult result)
{
    switch (result)
    {
        case BMO_PLAYBACK_SUCCESS:
            return PlaybackTerminalResult::DONE;
        case BMO_PLAYBACK_EXPIRED:
            return PlaybackTerminalResult::EXPIRED;
        case BMO_PLAYBACK_DOWNLOAD_FAILED:
        case BMO_PLAYBACK_DECODE_FAILED:
        case BMO_PLAYBACK_PLAYBACK_FAILED:
        case BMO_PLAYBACK_REQUEST_FAILED:
        default:
            return PlaybackTerminalResult::FAILED;
    }
}

static bool request_is_known(const char *request_id)
{
    if (!is_uuid_v4_string(request_id))
        return false;

    return (current_request_id[0] != '\0' && strcmp(request_id, current_request_id) == 0) ||
           (backend_active_request_id[0] != '\0' && strcmp(request_id, backend_active_request_id) == 0);
}

static bool request_is_terminal(void)
{
    return playback_state == BMO_PLAYBACK_DONE ||
           playback_state == BMO_PLAYBACK_FAILED ||
           playback_state == BMO_PLAYBACK_CANCELLED ||
           playback_state == BMO_PLAYBACK_DONE_PENDING_SEND ||
           playback_state == BMO_PLAYBACK_FAILED_PENDING_SEND;
}

static bool adopt_recovered_request(const char *request_id)
{
    if (!is_uuid_v4_string(request_id))
        return false;

    if (current_request_id[0] == '\0' ||
        (strcmp(current_request_id, request_id) != 0 && request_is_terminal() &&
         pending_playback_event == BMO_PENDING_PLAYBACK_NONE))
    {
        strncpy(current_request_id, request_id, sizeof(current_request_id) - 1);
        current_request_id[sizeof(current_request_id) - 1] = '\0';
        clear_current_playback_job();
        reset_audio_deadline();
        playback_state = BMO_PLAYBACK_WAITING;
    }

    return strcmp(current_request_id, request_id) == 0;
}

// WebSocket Send helper. Authentication is required for protocol events,
// but not for the authenticate message itself.
static bool ws_send_text(const char *text, bool require_authenticated) {
    if (ws_client == NULL || !network_has_ip() || !ws_connected ||
        (require_authenticated && !ws_authenticated) || ws_send_mutex == NULL) {
        ESP_LOGW(TAG, "WS client not connected, cannot send text");
        return false;
    }

    size_t text_len = strlen(text);
    xSemaphoreTake(ws_send_mutex, portMAX_DELAY);
    int sent = esp_websocket_client_send_text(ws_client, text, text_len, portMAX_DELAY);
    xSemaphoreGive(ws_send_mutex);

    if (sent != (int)text_len)
    {
        ESP_LOGW(TAG, "WS text send failed");
        return false;
    }

    return true;
}

// Send event audio_playback_done
static bool send_playback_done(const char *req_id) {
    cJSON *root = cJSON_CreateObject();
    if (root == NULL)
        return false;
    cJSON_AddStringToObject(root, "event", "audio_playback_done");
    cJSON_AddStringToObject(root, "request_id", req_id);
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (json_str == NULL)
        return false;

    ESP_LOGI(TAG, "Sending audio_playback_done for %s", req_id);
    bool sent = ws_send_text(json_str, true);
    free(json_str);
    return sent;
}

// Send event audio_playback_failed
static bool send_playback_failed(const char *req_id, const char *reason) {
    cJSON *root = cJSON_CreateObject();
    if (root == NULL)
        return false;
    cJSON_AddStringToObject(root, "event", "audio_playback_failed");
    cJSON_AddStringToObject(root, "request_id", req_id);
    cJSON_AddStringToObject(root, "reason", reason);
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (json_str == NULL)
        return false;

    ESP_LOGI(TAG, "Sending audio_playback_failed for %s (reason: %s)", req_id, reason);
    bool sent = ws_send_text(json_str, true);
    free(json_str);
    return sent;
}

// WebSocket Send Authenticate
static bool send_authenticate() {
    cJSON *root = cJSON_CreateObject();
    if (root == NULL)
        return false;
    cJSON_AddStringToObject(root, "event", "authenticate");
    cJSON_AddStringToObject(root, "device_id", BMO_DEVICE_ID);
    cJSON_AddStringToObject(root, "device_token", BMO_DEVICE_TOKEN);
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (json_str == NULL)
        return false;

    ESP_LOGI(TAG, "Sending authenticate to WS...");
    bool sent = ws_send_text(json_str, false);
    free(json_str);
    return sent;
}

static bool send_pairing_mode_request() {
    cJSON *root = cJSON_CreateObject();
    if (root == NULL)
        return false;
    cJSON_AddStringToObject(root, "event", "pairing_mode_request");
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (json_str == NULL)
        return false;

    bool sent = ws_send_text(json_str, true);
    free(json_str);
    return sent;
}

static void clear_pending_playback_event()
{
    pending_playback_event = BMO_PENDING_PLAYBACK_NONE;
    pending_playback_request_id[0] = '\0';
    pending_playback_reason[0] = '\0';
}

static void mark_request_result_sent(const char *request_id)
{
    const bool matches_current = strcmp(current_request_id, request_id) == 0;
    const bool matches_backend = strcmp(backend_active_request_id, request_id) == 0;

    if (matches_current)
        current_request_id[0] = '\0';
    if (matches_backend)
    {
        backend_active_request_id[0] = '\0';
        strncpy(backend_state, "idle", sizeof(backend_state) - 1);
        backend_state[sizeof(backend_state) - 1] = '\0';
        ESP_LOGI(TAG, "Playback result sent; local active request cleared");
    }
    clear_current_playback_job();
    reset_audio_deadline();
}

static void queue_pending_playback_event(const char *request_id, BMOPendingPlaybackEvent event, const char *reason)
{
    pending_playback_event = event;
    strncpy(pending_playback_request_id, request_id, sizeof(pending_playback_request_id) - 1);
    pending_playback_request_id[sizeof(pending_playback_request_id) - 1] = '\0';
    if (reason != NULL)
    {
        strncpy(pending_playback_reason, reason, sizeof(pending_playback_reason) - 1);
        pending_playback_reason[sizeof(pending_playback_reason) - 1] = '\0';
    }
    else
    {
        pending_playback_reason[0] = '\0';
    }

    playback_state = event == BMO_PENDING_PLAYBACK_DONE
        ? BMO_PLAYBACK_DONE_PENDING_SEND
        : BMO_PLAYBACK_FAILED_PENDING_SEND;
}

static bool flush_pending_playback_event()
{
    if (pending_playback_event == BMO_PENDING_PLAYBACK_NONE)
        return true;

    bool sent = pending_playback_event == BMO_PENDING_PLAYBACK_DONE
        ? send_playback_done(pending_playback_request_id)
        : send_playback_failed(pending_playback_request_id, pending_playback_reason);

    if (!sent)
        return false;

    BMOPlaybackState final_state = pending_playback_event == BMO_PENDING_PLAYBACK_DONE
        ? BMO_PLAYBACK_DONE
        : BMO_PLAYBACK_FAILED;
    char sent_request_id[37] = {0};
    strncpy(sent_request_id, pending_playback_request_id, sizeof(sent_request_id) - 1);
    clear_pending_playback_event();
    playback_state = final_state;
    mark_request_result_sent(sent_request_id);
    return true;
}

// Handle request_failed locally (e.g. error message sound and face display)
static void handle_request_failed(const char *code) {
    setState(BMOState::ERROR_STATE);
    audio_play_error();
    
    if (strcmp(code, "NO_SPEECH") == 0) {
        ESP_LOGI(TAG, "Voice Error: Sorry, it is too noisy. BMO cannot hear you.");
    } else {
        ESP_LOGI(TAG, "Voice Error: Oh no. BMO could not answer. Please try again. Code: %s", code);
    }
    
    vTaskDelay(pdMS_TO_TICKS(2000));
    setState(BMOState::IDLE);
}

static void queue_request_failed(const char *request_id, const char *code)
{
    strncpy(pending_request_failed_id, request_id,
            sizeof(pending_request_failed_id) - 1);
    pending_request_failed_id[sizeof(pending_request_failed_id) - 1] = '\0';
    strncpy(pending_request_failed_code, code,
            sizeof(pending_request_failed_code) - 1);
    pending_request_failed_code[sizeof(pending_request_failed_code) - 1] = '\0';
    pending_request_failed = true;
    playback_state = BMO_PLAYBACK_CANCELLED;
    playback_cancel();
    backend_active_request_id[0] = '\0';
    clear_current_playback_job();
    reset_audio_deadline();
    strncpy(backend_state, "idle", sizeof(backend_state) - 1);
    backend_state[sizeof(backend_state) - 1] = '\0';
    ESP_LOGI(TAG, "Queued request_failed for task processing code=%s", code);
}

static bool process_pending_request_failed(void)
{
    if (!pending_request_failed)
        return false;

    char request_id[37] = {0};
    char code[BMO_PLAYBACK_REASON_MAX_LEN] = {0};
    strncpy(request_id, pending_request_failed_id, sizeof(request_id) - 1);
    strncpy(code, pending_request_failed_code, sizeof(code) - 1);
    pending_request_failed = false;
    pending_request_failed_id[0] = '\0';
    pending_request_failed_code[0] = '\0';
    if (strcmp(current_request_id, request_id) == 0)
        current_request_id[0] = '\0';
    playback_cancel();
    clear_current_playback_job();
    reset_audio_deadline();
    playback_state = BMO_PLAYBACK_CANCELLED;
    handle_request_failed(code);
    return true;
}

// WebSocket event processor
static void handle_ws_message(const char *payload, int len) {
    cJSON *root = cJSON_ParseWithLength(payload, len);
    if (root == NULL) {
        ESP_LOGW(TAG, "Failed to parse WS JSON message");
        return;
    }

    cJSON *event_node = cJSON_GetObjectItem(root, "event");
    if (event_node == NULL || !cJSON_IsString(event_node)) {
        cJSON_Delete(root);
        return;
    }

    const char *event = event_node->valuestring;
    ESP_LOGI(TAG, "Received WS event: %s", event);

    if (strcmp(event, "authenticated") == 0) {
        cJSON *status_node = cJSON_GetObjectItem(root, "status");
        cJSON *device_id_node = cJSON_GetObjectItem(root, "device_id");
        cJSON *state_node = cJSON_GetObjectItem(root, "backend_state");
        cJSON *active_request_node = cJSON_GetObjectItem(root, "active_request_id");
        bool active_request_is_null = active_request_node != NULL && cJSON_IsNull(active_request_node);
        bool active_request_is_valid = active_request_is_null ||
            (active_request_node != NULL && cJSON_IsString(active_request_node) &&
             is_uuid_v4_string(active_request_node->valuestring));
        bool state_matches_active_request = is_valid_backend_state(state_node) &&
            ((strcmp(state_node->valuestring, "idle") == 0 && active_request_is_null) ||
             (strcmp(state_node->valuestring, "idle") != 0 && !active_request_is_null));

        bool authenticated_event_is_valid =
            status_node != NULL && cJSON_IsString(status_node) &&
            strcmp(status_node->valuestring, "ok") == 0 &&
            device_id_node != NULL && cJSON_IsString(device_id_node) &&
            strcmp(device_id_node->valuestring, BMO_DEVICE_ID) == 0 &&
            active_request_node != NULL && active_request_is_valid &&
            state_matches_active_request;

        if (!authenticated_event_is_valid) {
            ESP_LOGW(TAG, "WS authenticated event failed contract validation");
            mark_ws_down("authenticated_contract_invalid");
            if (ws_client != NULL)
                esp_websocket_client_close(ws_client, portMAX_DELAY);
            cJSON_Delete(root);
            return;
        }

        strncpy(backend_state, state_node->valuestring, sizeof(backend_state) - 1);
        backend_state[sizeof(backend_state) - 1] = '\0';
        if (active_request_is_null) {
            backend_active_request_id[0] = '\0';
        } else {
            strncpy(backend_active_request_id, active_request_node->valuestring,
                    sizeof(backend_active_request_id) - 1);
            backend_active_request_id[sizeof(backend_active_request_id) - 1] = '\0';
        }

        ws_authenticated = true;
        ws_auth_pending = false;
        ws_auth_deadline = 0;
            network_set_backend_connected(true);
            ws_reconnect_delay_sec = 1;
            ESP_LOGI(TAG, "WS authenticated successfully. Backend state: %s", backend_state);

        if (!active_request_is_null &&
            adopt_recovered_request(backend_active_request_id) &&
            !request_is_terminal() &&
            (strcmp(backend_state, "thinking") == 0 || strcmp(backend_state, "audio_ready") == 0)) {
            if (getState() == BMOState::IDLE) {
                recovery_request_pending = true;
                setState(BMOState::THINKING);
            }
        }

        (void)flush_pending_playback_event();
        pairing_on_authenticated(esp_timer_get_time() / 1000);
        log_ws_stack_high_water("authenticated");
    }
    else if (strcmp(event, "authentication_failed") == 0) {
        ws_authentication_blocked = true;
        mark_ws_down("authentication_failed");
        ESP_LOGE(TAG, "WS authentication failed; automatic retry is paused until provisioning is fixed");
        if (ws_client != NULL)
            esp_websocket_client_close(ws_client, portMAX_DELAY);
    }
    else if (strcmp(event, "connection_replaced") == 0) {
        ESP_LOGW(TAG, "WS connection replaced by new session; stopping use of this connection");
        ws_connection_replacement_suppressed = true;
        ws_reconnect_pending = false;
        mark_ws_down("connection_replaced");
        ESP_LOGW(TAG, "WS reconnect suppressed after connection_replaced until reboot");
        if (ws_client != NULL)
            esp_websocket_client_close(ws_client, portMAX_DELAY);
    }
    else if (!ws_authenticated) {
        ESP_LOGW(TAG, "Ignoring WS event before valid authentication");
    }
    else if (strcmp(event, "pairing_code") == 0) {
        cJSON *code_node = cJSON_GetObjectItem(root, "code");
        cJSON *expires_node = cJSON_GetObjectItem(root, "expires_at");
        bool valid_pairing_code =
            json_object_has_exact_fields(
                root, PAIRING_CODE_FIELDS,
                sizeof(PAIRING_CODE_FIELDS) / sizeof(PAIRING_CODE_FIELDS[0])) &&
            code_node != NULL && cJSON_IsString(code_node) &&
            expires_node != NULL && cJSON_IsString(expires_node);
        if (valid_pairing_code)
            (void)pairing_on_code(code_node->valuestring, expires_node->valuestring, time(NULL));
    }
    else if (strcmp(event, "pairing_completed") == 0) {
        cJSON *status_node = cJSON_GetObjectItem(root, "status");
        bool valid_pairing_completion =
            json_object_has_exact_fields(
                root, PAIRING_COMPLETED_FIELDS,
                sizeof(PAIRING_COMPLETED_FIELDS) / sizeof(PAIRING_COMPLETED_FIELDS[0])) &&
            status_node != NULL && cJSON_IsString(status_node) &&
            strcmp(status_node->valuestring, "ok") == 0;
        if (valid_pairing_completion)
            pairing_on_completed();
    }
    else if (strcmp(event, "display_status") == 0) {
        cJSON *req_id_node = cJSON_GetObjectItem(root, "request_id");
        cJSON *status_node = cJSON_GetObjectItem(root, "status");
        cJSON *transcript_node = cJSON_GetObjectItem(root, "transcript");
        if (transcript_node == NULL) {
            transcript_node = cJSON_GetObjectItem(root, "user_transcript");
        }
        if (transcript_node != NULL && cJSON_IsString(transcript_node) &&
            transcript_node->valuestring != NULL && transcript_node->valuestring[0] != '\0') {
            ESP_LOGI(TAG, "🎤 [User STT]: %s", transcript_node->valuestring);
        }
        if (req_id_node != NULL && cJSON_IsString(req_id_node) &&
            status_node != NULL && cJSON_IsString(status_node) &&
            strcmp(status_node->valuestring, "thinking") == 0 &&
            request_is_known(req_id_node->valuestring) &&
            adopt_recovered_request(req_id_node->valuestring) && !request_is_terminal()) {
            strncpy(backend_state, "thinking", sizeof(backend_state) - 1);
            backend_state[sizeof(backend_state) - 1] = '\0';
            // Backend owns the thinking transition; listening remains local
            // firmware state and is never sent over WebSocket.
            display_set_mode(DisplayMode::THINKING);
            if (getState() == BMOState::IDLE) {
                recovery_request_pending = true;
                setState(BMOState::THINKING);
            }
        }
    }
    else if (strcmp(event, "audio_ready") == 0) {
        cJSON *req_id_node = cJSON_GetObjectItem(root, "request_id");
        cJSON *url_node = cJSON_GetObjectItem(root, "audio_url");
        cJSON *format_node = cJSON_GetObjectItem(root, "format");
        cJSON *expires_node = cJSON_GetObjectItem(root, "expires_in_seconds");
        cJSON *transcript_node = cJSON_GetObjectItem(root, "transcript");
        if (transcript_node == NULL) {
            transcript_node = cJSON_GetObjectItem(root, "user_transcript");
        }
        if (transcript_node == NULL) {
            transcript_node = cJSON_GetObjectItem(root, "stt");
        }
        cJSON *resp_text_node = cJSON_GetObjectItem(root, "response_text");
        if (resp_text_node == NULL) {
            resp_text_node = cJSON_GetObjectItem(root, "text");
        }
        if (resp_text_node == NULL) {
            resp_text_node = cJSON_GetObjectItem(root, "ai_response");
        }
        PlaybackJob voice_job = {};
        uint32_t expires_in_seconds = 0;
        bool expires_value_valid = expires_node != NULL && cJSON_IsNumber(expires_node) &&
            expires_node->valuedouble > 0 &&
            expires_node->valuedouble <= (double)UINT32_MAX;
        if (expires_value_valid)
        {
            expires_in_seconds = (uint32_t)expires_node->valuedouble;
            expires_value_valid = expires_in_seconds > 0 &&
                (double)expires_in_seconds == expires_node->valuedouble;
        }
        bool valid_audio_ready = req_id_node != NULL && cJSON_IsString(req_id_node) &&
            url_node != NULL && cJSON_IsString(url_node) &&
            format_node != NULL && cJSON_IsString(format_node) &&
            strcmp(format_node->valuestring, "mp3") == 0 &&
            expires_value_valid &&
            strlen(url_node->valuestring) < sizeof(voice_job.audio_url) &&
            playback_url_is_valid(url_node->valuestring) &&
            request_is_known(req_id_node->valuestring) &&
            adopt_recovered_request(req_id_node->valuestring);

        if (valid_audio_ready) {
            if (transcript_node != NULL && cJSON_IsString(transcript_node) &&
                transcript_node->valuestring != NULL && transcript_node->valuestring[0] != '\0') {
                ESP_LOGI(TAG, "🎤 [User STT]: %s", transcript_node->valuestring);
            }
            if (resp_text_node != NULL && cJSON_IsString(resp_text_node) &&
                resp_text_node->valuestring != NULL && resp_text_node->valuestring[0] != '\0') {
                ESP_LOGI(TAG, "🤖 [BMO AI]: %s", resp_text_node->valuestring);
            }
            strncpy(backend_state, "audio_ready", sizeof(backend_state) - 1);
            backend_state[sizeof(backend_state) - 1] = '\0';
            if (playback_state == BMO_PLAYBACK_DONE_PENDING_SEND ||
                playback_state == BMO_PLAYBACK_FAILED_PENDING_SEND) {
                ESP_LOGI(TAG, "Ignore audio_ready while playback outcome is pending");
            }
            else if (playback_state == BMO_PLAYBACK_DOWNLOADING ||
                     playback_state == BMO_PLAYBACK_PLAYING ||
                     playback_state == BMO_PLAYBACK_DONE ||
                     playback_state == BMO_PLAYBACK_FAILED ||
                     playback_state == BMO_PLAYBACK_CANCELLED) {
                ESP_LOGI(TAG, "Ignore duplicate audio_ready for request");
            }
            else {
                voice_job.origin = PlaybackOrigin::VOICE_RESPONSE;
                strncpy(voice_job.correlation_id, req_id_node->valuestring,
                        sizeof(voice_job.correlation_id) - 1);
                strncpy(voice_job.audio_url, url_node->valuestring,
                        sizeof(voice_job.audio_url) - 1);
                voice_job.expires_in_seconds = expires_in_seconds;
                strncpy(voice_job.source, "VOICE", sizeof(voice_job.source) - 1);

                if (playback_admit_voice_job(
                        &voice_job, esp_timer_get_time() / 1000) != PlaybackAdmission::ACCEPTED) {
                    ESP_LOGI(TAG, "Ignore audio_ready while another playback owns the audio path");
                } else {
                    current_playback_job = voice_job;
                    set_audio_deadline(expires_in_seconds);
                    playback_state = BMO_PLAYBACK_DOWNLOADING;
                    ESP_LOGI(TAG, "Accepted audio_ready request_id=%s format=mp3 expires_in_seconds=%lu url_host=%s",
                             req_id_node->valuestring, (unsigned long)expires_in_seconds,
                             BMO_BACKEND_HOST);
                    if (getState() == BMOState::IDLE) {
                        recovery_request_pending = true;
                        setState(BMOState::THINKING);
                    }
                }
            }
        }
    }
    else if (strcmp(event, "request_failed") == 0) {
        cJSON *req_id_node = cJSON_GetObjectItem(root, "request_id");
        cJSON *code_node = cJSON_GetObjectItem(root, "code");
        cJSON *recoverable_node = cJSON_GetObjectItem(root, "recoverable");
        if (req_id_node != NULL && cJSON_IsString(req_id_node) &&
            code_node != NULL && cJSON_IsString(code_node) &&
            recoverable_node != NULL && cJSON_IsTrue(recoverable_node) &&
            request_is_known(req_id_node->valuestring) &&
            adopt_recovered_request(req_id_node->valuestring) && !request_is_terminal()) {
            queue_request_failed(req_id_node->valuestring, code_node->valuestring);
        }
    }

    cJSON_Delete(root);
}

// WebSocket Event Handler
static void websocket_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data) {
    esp_websocket_event_data_t *data = (esp_websocket_event_data_t *)event_data;
    switch (event_id) {
        case WEBSOCKET_EVENT_BEGIN:
            ws_client_started = true;
            ws_lifecycle_state = BMO_WS_LIFECYCLE_STARTED;
            log_ws_lifecycle_event("event_begin", "websocket_event", data);
            break;

        case WEBSOCKET_EVENT_FINISH:
            ws_client_started = false;
            mark_ws_down("event_finish");
            ws_lifecycle_state = BMO_WS_LIFECYCLE_STOPPED;
            ws_reconnect_pending = ws_reconnect_allowed();
            log_ws_lifecycle_event("event_finish", "websocket_event", data);
            break;

        case WEBSOCKET_EVENT_CONNECTED:
            log_ws_diagnostics("connected_before_mark", data);
            ESP_LOGI(TAG, "WebSocket connected, authenticating...");
            ws_client_started = true;
            ws_connected = true;
            ws_authenticated = false;
            ws_auth_pending = true;
            ws_auth_deadline = xTaskGetTickCount() + pdMS_TO_TICKS(WS_AUTH_TIMEOUT_MS);
            ws_lifecycle_state = BMO_WS_LIFECYCLE_CONNECTED;
            ws_reconnect_pending = false;
            (void)pairing_on_socket_connected();
            log_ws_lifecycle_event("event_connected", "websocket_event", data);
            network_set_backend_connected(false);
            if (!send_authenticate()) {
                ESP_LOGW(TAG, "WS authenticate send failed; closing connection and scheduling reconnect");
                mark_ws_down("authenticate_send_failed");
                ws_reconnect_pending = ws_reconnect_allowed();
                if (ws_client != NULL)
                    esp_websocket_client_close(ws_client, portMAX_DELAY);
            }
            log_ws_stack_high_water("connected");
            log_ws_diagnostics("connected_after_mark", data);
            break;
            
        case WEBSOCKET_EVENT_DISCONNECTED:
            log_ws_diagnostics("disconnected_before_mark", data);
            ws_last_disconnect_tick = xTaskGetTickCount();
            ESP_LOGI(TAG, "WebSocket disconnected");
            mark_ws_down("event_disconnected");
            ws_reconnect_pending = ws_reconnect_allowed();
            log_ws_lifecycle_event("event_disconnected", "websocket_event", data);
            log_ws_diagnostics("disconnected_after_mark", data);
            break;
            
        case WEBSOCKET_EVENT_DATA:
            if (data->op_code == 0x01 && data->data_ptr != NULL) { // Text frame
                handle_ws_message(data->data_ptr, data->data_len);
            }
            break;
            
        case WEBSOCKET_EVENT_ERROR:
            log_ws_diagnostics("error_before_mark", data);
            ESP_LOGE(TAG, "WebSocket error event");
            ws_last_disconnect_tick = xTaskGetTickCount();
            mark_ws_down("event_error");
            ws_reconnect_pending = ws_reconnect_allowed();
            log_ws_lifecycle_event("event_error", "websocket_event", data);
            log_ws_diagnostics("error_after_mark", data);
            break;

        case WEBSOCKET_EVENT_CLOSED:
            log_ws_diagnostics("closed_before_mark", data);
            ESP_LOGI(TAG, "WebSocket closed");
            ws_last_disconnect_tick = xTaskGetTickCount();
            mark_ws_down("event_closed");
            ws_reconnect_pending = ws_reconnect_allowed();
            log_ws_lifecycle_event("event_closed", "websocket_event", data);
            log_ws_diagnostics("closed_after_mark", data);
            break;

        default:
            break;
    }
}

static void process_pairing_actions() {
    const uint8_t actions = pairing_poll(time(NULL), esp_timer_get_time() / 1000);
    if (actions == PAIRING_ACTION_NONE)
        return;

    if ((actions & PAIRING_ACTION_SHOW_UI) != 0) {
#if !BMO_DEV_SUPPRESS_PAIRING_UI
        const PairingSnapshot snapshot = pairing_get_snapshot();
        if (!display_set_pairing_code(snapshot.code))
            ESP_LOGW(TAG, "Pairing display update failed");
#endif
    }
    if ((actions & PAIRING_ACTION_CLEAR_UI) != 0) {
        display_clear_pairing_code();
    }
    if ((actions & PAIRING_ACTION_SEND_REQUEST) != 0) {
        if (!send_pairing_mode_request())
            ESP_LOGW(TAG, "Pairing mode request send failed");
    }
    if ((actions & PAIRING_ACTION_RECONNECT) != 0) {
        ws_pairing_reconnect_pending = true;
    }
}

// Background WS Monitor/Reconnect task
static void ws_monitor_task(void *param) {
    while (true) {
        process_pairing_actions();

        if (!network_has_ip() || !network_has_valid_time()) {
            stop_ws_if_started("monitor_network_not_ready");
            vTaskDelay(pdMS_TO_TICKS(1000));
            continue;
        }

        if (ws_connection_replacement_suppressed) {
            ws_reconnect_pending = false;
            ws_pairing_reconnect_pending = false;
            if (ws_client_started)
                stop_ws_if_started("monitor_connection_replaced");
            vTaskDelay(pdMS_TO_TICKS(1000));
            continue;
        }

        if (ws_authentication_blocked) {
            ws_pairing_reconnect_pending = false;
            stop_ws_if_started("monitor_authentication_blocked");
            vTaskDelay(pdMS_TO_TICKS(1000));
            continue;
        }

        if (ws_pairing_reconnect_pending) {
            ws_pairing_reconnect_pending = false;
            ws_reconnect_pending = false;
            stop_ws_if_started("pairing_completed");
            ws_reconnect_pending = false;

            if (!ws_client_started) {
                esp_err_t err = start_ws_if_network_ready("pairing_reconnect");
                if (err != ESP_OK)
                    ws_reconnect_pending = ws_reconnect_allowed();
            } else {
                ws_pairing_reconnect_pending = true;
            }
        }

        if (ws_connected && ws_auth_pending && !ws_authenticated &&
            (int32_t)(xTaskGetTickCount() - ws_auth_deadline) >= 0) {
            ESP_LOGW(TAG, "WebSocket authentication timeout after %d ms", WS_AUTH_TIMEOUT_MS);
            mark_ws_down("monitor_auth_timeout");
            if (ws_client != NULL)
                esp_websocket_client_close(ws_client, portMAX_DELAY);
        }

        if (!ws_client_started && ws_reconnect_pending) {
            ESP_LOGI(TAG, "Reconnecting WebSocket in %d seconds...", ws_reconnect_delay_sec);
            int wait_time_ms = 0;
            int reconnect_delay_ms = ws_reconnect_delay_sec * 1000;

            while (network_has_ip() && !ws_authentication_blocked && wait_time_ms < reconnect_delay_ms) {
                vTaskDelay(pdMS_TO_TICKS(100));
                wait_time_ms += 100;
            }

            if (!network_has_ip() || ws_authentication_blocked) {
                stop_ws_if_started("monitor_reconnect_abort");
                continue;
            }

            // The previous client task has reached a terminal lifecycle event.
            start_ws_if_network_ready("monitor_reconnect");

            // Exponential backoff up to 30 seconds
            ws_reconnect_delay_sec = (ws_reconnect_delay_sec * 2 > 30) ? 30 : ws_reconnect_delay_sec * 2;
        }
        else if (!ws_client_started) {
            ESP_LOGI(TAG, "Network ready, starting WebSocket...");
            start_ws_if_network_ready("monitor_initial");
        }
        else if (ws_lifecycle_state == BMO_WS_LIFECYCLE_STARTED ||
                 ws_lifecycle_state == BMO_WS_LIFECYCLE_TERMINAL) {
            // A connection attempt or shutdown is still active; do not stop/start it.
        }
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void api_init() {
    ESP_LOGI(TAG, "API init started");
    playback_init();
    pairing_init();
    ws_pairing_reconnect_pending = false;
    ws_connection_replacement_suppressed = false;
    network_set_backend_connected(false);

    if (ws_send_mutex == NULL) {
        ws_send_mutex = xSemaphoreCreateMutex();
    }
    
    esp_websocket_client_config_t ws_cfg = {};
    ws_cfg.uri = BMO_WS_URL;
    ws_cfg.task_stack = 8192;
    ws_cfg.disable_auto_reconnect = true; // Let monitor task manage reconnect with exact backoff
    ws_cfg.crt_bundle_attach = esp_crt_bundle_attach;
    ws_cfg.cert_common_name = BMO_BACKEND_HOST;
    ws_cfg.skip_cert_common_name_check = false;
    ws_cfg.network_timeout_ms = 10000;
    
    ws_client = esp_websocket_client_init(&ws_cfg);
    if (ws_client == NULL) {
        ESP_LOGE(TAG, "Failed to initialize WebSocket client");
        return;
    }
    
    esp_websocket_register_events(ws_client, WEBSOCKET_EVENT_ANY, websocket_event_handler, NULL);
    start_ws_if_network_ready("api_init");
    
    xTaskCreate(ws_monitor_task, "ws_monitor", 4096, NULL, 3, NULL);
}

bool api_ws_is_connected() {
    return network_has_ip() && ws_connected;
}

bool api_ws_is_authenticated() {
    return network_has_ip() && ws_authenticated && network_is_backend_connected();
}

bool api_ws_authentication_is_blocked() {
    return ws_authentication_blocked;
}

static bool is_audio_mpeg_content_type(const char *content_type)
{
    static const char expected[] = "audio/mpeg";
    if (content_type == NULL)
        return false;

    while (*content_type == ' ' || *content_type == '\t')
        content_type++;

    for (size_t i = 0; i < sizeof(expected) - 1; ++i)
    {
        char actual = content_type[i];
        if (actual >= 'A' && actual <= 'Z')
            actual = (char)(actual - 'A' + 'a');
        if (actual != expected[i])
            return false;
    }

    content_type += sizeof(expected) - 1;
    while (*content_type == ' ' || *content_type == '\t')
        content_type++;
    return *content_type == '\0' || *content_type == ';';
}

// IDF 6 only exposes esp_http_client_get_response_header when response-header
// caching is enabled. Capture Content-Type from the portable header event so
// the MP3 stream keeps the same validation without changing global Kconfig.
static esp_err_t mp3_http_event_handler(esp_http_client_event_t *event)
{
    if (event == NULL || event->event_id != HTTP_EVENT_ON_HEADER ||
        event->header_key == NULL || event->header_value == NULL ||
        event->user_data == NULL)
    {
        return ESP_OK;
    }

    if (strcmp(event->header_key, "Content-Type") != 0 &&
        strcmp(event->header_key, "content-type") != 0)
    {
        return ESP_OK;
    }

    char *content_type = static_cast<char *>(event->user_data);
    strncpy(content_type, event->header_value, 63);
    content_type[63] = '\0';
    return ESP_OK;
}

// Shared MP3 downloader/decoder/player. Transport validation and voice
// correlation happen before this physical playback path is entered.
static BMOPlaybackResult download_and_play_mp3(const PlaybackJob *job) {
    if (job == NULL || audio_deadline_expired() ||
        playback_is_expired(esp_timer_get_time() / 1000))
    {
        ESP_LOGW(TAG, "MP3 download skipped: audio URL expired");
        return BMO_PLAYBACK_EXPIRED;
    }

    ESP_LOGI(TAG, "Initializing HTTP GET stream for MP3 host=%s", BMO_BACKEND_HOST);
    
    char content_type[64] = {};
    esp_http_client_config_t config = {};
    config.url = job->audio_url;
    config.method = HTTP_METHOD_GET;
    config.timeout_ms = 4000;
    config.event_handler = mp3_http_event_handler;
    config.user_data = content_type;
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.common_name = BMO_BACKEND_HOST;
    config.skip_cert_common_name_check = false;
    
    esp_http_client_handle_t http_client = esp_http_client_init(&config);
    if (http_client == NULL) {
        ESP_LOGE(TAG, "Failed to initialize HTTP client");
        return BMO_PLAYBACK_DOWNLOAD_FAILED;
    }
    
    esp_err_t err = esp_http_client_open(http_client, 0);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open GET connection: %s", esp_err_to_name(err));
        esp_http_client_cleanup(http_client);
        return BMO_PLAYBACK_DOWNLOAD_FAILED;
    }
    
    int64_t content_length = esp_http_client_fetch_headers(http_client);
    int status_code = esp_http_client_get_status_code(http_client);
    bool content_type_valid = is_audio_mpeg_content_type(content_type);
    ESP_LOGI(TAG, "MP3 response status=%d content_type=%s content_length=%lld",
             status_code, content_type_valid ? "audio/mpeg" : "invalid",
             (long long)content_length);
    
    if (status_code == 410) {
        ESP_LOGW(TAG, "Audio expired (HTTP 410 Gone)");
        esp_http_client_close(http_client);
        esp_http_client_cleanup(http_client);
        return BMO_PLAYBACK_EXPIRED;
    }
    
    if (status_code != 200 || !content_type_valid || content_length <= 0) {
        ESP_LOGE(TAG, "MP3 download rejected status=%d content_type_valid=%d content_length=%lld",
                 status_code, content_type_valid ? 1 : 0, (long long)content_length);
        esp_http_client_close(http_client);
        esp_http_client_cleanup(http_client);
        return BMO_PLAYBACK_DOWNLOAD_FAILED;
    }
    
    // MP3 Buffer configuration
    #define MP3_STREAM_BUF_SIZE (32 * 1024) // 32 KB buffer
    #define MP3_STREAM_PREBUFFER_BYTES 2048 // 2 KB low-latency pre-buffer threshold
    uint8_t *mp3_stream_buf = (uint8_t *)malloc(MP3_STREAM_BUF_SIZE);
    if (mp3_stream_buf == NULL) {
        ESP_LOGE(TAG, "Failed to allocate MP3 streaming buffer");
        esp_http_client_close(http_client);
        esp_http_client_cleanup(http_client);
        return BMO_PLAYBACK_DOWNLOAD_FAILED;
    }
    
    HMP3Decoder hMP3Decoder = MP3InitDecoder();
    if (hMP3Decoder == NULL) {
        ESP_LOGE(TAG, "Failed to initialize Helix MP3 decoder");
        free(mp3_stream_buf);
        esp_http_client_close(http_client);
        esp_http_client_cleanup(http_client);
        return BMO_PLAYBACK_DECODE_FAILED;
    }
    
    int bytes_left = 0;
    uint8_t *read_ptr = mp3_stream_buf;
    bool checked_id3 = false;
    bool playback_started = false;
    bool is_eof = false;
    bool read_failed = false;
    uint32_t resync_bytes = 0;
    uint64_t received_bytes = 0;
    uint32_t decoded_frames = 0;
    uint64_t decoded_media_us = 0;
    int64_t playback_wall_start_us = 0;
    int64_t last_progress_log_us = 0;
    
    static constexpr int64_t MP3_STREAM_READ_TIMEOUT_US = 5000000LL;
    static constexpr int64_t MP3_STREAM_UNDERRUN_MAX_US = 4000000LL;
    int64_t last_receive_time_us = esp_timer_get_time();
    
    short *out_pcm = (short *)malloc(1152 * 2 * sizeof(short)); // Helix frame capacity
    if (out_pcm == NULL) {
        ESP_LOGE(TAG, "Failed to allocate frame PCM output buffer");
        MP3FreeDecoder(hMP3Decoder);
        free(mp3_stream_buf);
        esp_http_client_close(http_client);
        esp_http_client_cleanup(http_client);
        return BMO_PLAYBACK_DECODE_FAILED;
    }

    BMOPlaybackResult result = BMO_PLAYBACK_DOWNLOAD_FAILED;
    
    while (true) {
        int64_t now_us = esp_timer_get_time();

        if (audio_deadline_expired() ||
            playback_is_expired(now_us / 1000LL)) {
            result = BMO_PLAYBACK_EXPIRED;
            break;
        }

        if (playback_state == BMO_PLAYBACK_CANCELLED) {
            result = pending_request_failed
                ? BMO_PLAYBACK_REQUEST_FAILED
                : BMO_PLAYBACK_DOWNLOAD_FAILED;
            break;
        }

        if (!is_eof && (now_us - last_receive_time_us) >= MP3_STREAM_READ_TIMEOUT_US) {
            ESP_LOGW(TAG, "MP3 stream stall timeout: no bytes received for %lld ms",
                     (long long)((now_us - last_receive_time_us) / 1000LL));
            read_failed = true;
            result = BMO_PLAYBACK_DOWNLOAD_FAILED;
            break;
        }

        if (playback_started && (now_us - playback_wall_start_us) >= (int64_t)(decoded_media_us + MP3_STREAM_UNDERRUN_MAX_US)) {
            ESP_LOGW(TAG, "MP3 playback underrun timeout: wall_ms=%lld media_ms=%llu",
                     (long long)((now_us - playback_wall_start_us) / 1000LL),
                     (unsigned long long)(decoded_media_us / 1000ULL));
            result = BMO_PLAYBACK_PLAYBACK_FAILED;
            break;
        }
        // 1. Fetch more data if space is available
        if (bytes_left > 0 && read_ptr != mp3_stream_buf) {
            memmove(mp3_stream_buf, read_ptr, bytes_left);
            read_ptr = mp3_stream_buf;
        } else if (bytes_left == 0) {
            read_ptr = mp3_stream_buf;
        }

        int space_avail = MP3_STREAM_BUF_SIZE - bytes_left;
        if (space_avail > 1024 && !is_eof) {
            int bytes_to_read = space_avail < 4096 ? space_avail : 4096;
            
            int r = esp_http_client_read(http_client, (char *)(read_ptr + bytes_left), bytes_to_read);
            if (r < 0) {
                ESP_LOGE(TAG, "HTTP read error: %d", r);
                read_failed = true;
                result = BMO_PLAYBACK_DOWNLOAD_FAILED;
                break;
            } else if (r == 0) {
                is_eof = true;
            } else {
                last_receive_time_us = esp_timer_get_time();
                received_bytes += (uint64_t)r;
                if (received_bytes > (uint64_t)content_length) {
                    ESP_LOGE(TAG, "MP3 body exceeded Content-Length expected=%lld received=%llu",
                             (long long)content_length,
                             (unsigned long long)received_bytes);
                    read_failed = true;
                    result = BMO_PLAYBACK_DOWNLOAD_FAILED;
                    break;
                }
                bytes_left += r;
            }
        }
        
        // 2. Skip ID3 tags on the first chunk
        if (!checked_id3 && bytes_left >= 10) {
            checked_id3 = true;
            int skipped = 0;
            if (skip_id3_tag(http_client, read_ptr, bytes_left, &skipped,
                             &received_bytes) == 0) {
                last_receive_time_us = esp_timer_get_time();
                if (received_bytes > (uint64_t)content_length) {
                    ESP_LOGE(TAG, "MP3 ID3 skip exceeded Content-Length");
                    read_failed = true;
                    result = BMO_PLAYBACK_DOWNLOAD_FAILED;
                    break;
                }
                read_ptr += skipped;
                bytes_left -= skipped;
            } else {
                read_failed = true;
                result = BMO_PLAYBACK_DOWNLOAD_FAILED;
                break;
            }
        }
        
        // 3. Initial buffering requirement (2 KB low-latency threshold)
        if (!playback_started && bytes_left < MP3_STREAM_PREBUFFER_BYTES && !is_eof) {
            // Keep buffering
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }
        
        // 4. Check EOF done condition
        if (is_eof && bytes_left == 0) {
            break;
        }
        
        // 5. Decode frame
        uint8_t *orig_read_ptr = read_ptr;
        int orig_bytes_left = bytes_left;
        
        int err_decode = MP3Decode(hMP3Decoder, &read_ptr, &bytes_left, out_pcm, 0);
        
        if (err_decode == ERR_MP3_NONE) {
            MP3FrameInfo frameInfo;
            MP3GetLastFrameInfo(hMP3Decoder, &frameInfo);

            if (frameInfo.outputSamps <= 0 ||
                (frameInfo.nChans != 1 && frameInfo.nChans != 2) ||
                frameInfo.samprate <= 0) {
                ESP_LOGE(TAG, "MP3 decoder returned invalid frame metadata");
                result = BMO_PLAYBACK_DECODE_FAILED;
                break;
            }
            
            if (!playback_started) {
                playback_started = true;
                playback_wall_start_us = esp_timer_get_time();
                last_progress_log_us = playback_wall_start_us;
                playback_mark_started();
                playback_state = BMO_PLAYBACK_PLAYING;
                setState(BMOState::SPEAKING);
                ESP_LOGI(TAG, "MP3 Playback started: rate=%d, channels=%d", frameInfo.samprate, frameInfo.nChans);
            }
            
            // Output audio through dynamic scaling configuration
            if (!audio_play_raw(out_pcm, frameInfo.outputSamps, frameInfo.nChans, frameInfo.samprate)) {
                result = BMO_PLAYBACK_PLAYBACK_FAILED;
                break;
            }

            decoded_frames++;
            uint32_t pcm_frames = (uint32_t)frameInfo.outputSamps / (uint32_t)frameInfo.nChans;
            decoded_media_us += ((uint64_t)pcm_frames * 1000000ULL) /
                                (uint32_t)frameInfo.samprate;

            int64_t now_us = esp_timer_get_time();
            if (now_us - last_progress_log_us >= 1000000LL) {
                ESP_LOGI(TAG,
                         "MP3 playback progress: frames=%lu media_ms=%llu wall_ms=%lld received=%llu/%lld bytes_left=%d",
                         (unsigned long)decoded_frames,
                         (unsigned long long)(decoded_media_us / 1000ULL),
                         (long long)((now_us - playback_wall_start_us) / 1000LL),
                         (unsigned long long)received_bytes,
                         (long long)content_length,
                         bytes_left);
                last_progress_log_us = now_us;
            }
        }
        else if (err_decode == ERR_MP3_INDATA_UNDERFLOW) {
            // Need more data. Restore indices for partial frame
            read_ptr = orig_read_ptr;
            bytes_left = orig_bytes_left;
            
            if (is_eof) {
                if (playback_started && decoded_frames > 0) {
                    result = BMO_PLAYBACK_SUCCESS;
                } else {
                    result = BMO_PLAYBACK_DECODE_FAILED;
                }
                break;
            }
            vTaskDelay(pdMS_TO_TICKS(10));
        }
        else {
            if (playback_started || resync_bytes >= 1024U) {
                ESP_LOGE(TAG, "MP3 decoder rejected stream after limited resync");
                result = BMO_PLAYBACK_DECODE_FAILED;
                break;
            }

            // Limited pre-frame resync; never hide corruption after playback starts.
            read_ptr++;
            bytes_left--;
            resync_bytes++;
            if (bytes_left <= 0) {
                bytes_left = 0;
                read_ptr = mp3_stream_buf;
            }
        }
    }

    if (result == BMO_PLAYBACK_DOWNLOAD_FAILED && !read_failed) {
        bool complete_data = esp_http_client_is_complete_data_received(http_client);
        ESP_LOGI(TAG, "MP3 download completeness=%s expected_bytes=%lld received_bytes=%llu",
                 complete_data ? "yes" : "no", (long long)content_length,
                 (unsigned long long)received_bytes);
        if (!complete_data || received_bytes != (uint64_t)content_length) {
            result = BMO_PLAYBACK_DOWNLOAD_FAILED;
        }
        else if (!playback_started || bytes_left != 0) {
            result = BMO_PLAYBACK_DECODE_FAILED;
        }
        else {
            result = BMO_PLAYBACK_SUCCESS;
        }
    }
    
    int64_t playback_wall_ms = playback_wall_start_us > 0
        ? (esp_timer_get_time() - playback_wall_start_us) / 1000LL
        : 0;
    ESP_LOGI(TAG,
             "MP3 playback end: result=%d frames=%lu media_ms=%llu wall_ms=%lld received=%llu/%lld bytes_left=%d",
             (int)result,
             (unsigned long)decoded_frames,
             (unsigned long long)(decoded_media_us / 1000ULL),
             (long long)playback_wall_ms,
             (unsigned long long)received_bytes,
             (long long)content_length,
             bytes_left);

    // Clean up
    free(out_pcm);
    free(mp3_stream_buf);
    MP3FreeDecoder(hMP3Decoder);
    esp_http_client_close(http_client);
    esp_http_client_cleanup(http_client);
    
    return result;
}

static uint16_t read_le16(const uint8_t *data)
{
    return (uint16_t)data[0] | ((uint16_t)data[1] << 8);
}

static uint32_t read_le32(const uint8_t *data)
{
    return (uint32_t)data[0] |
           ((uint32_t)data[1] << 8) |
           ((uint32_t)data[2] << 16) |
           ((uint32_t)data[3] << 24);
}

static bool wav_chunk_is(const uint8_t *chunk, const char *name)
{
    return memcmp(chunk, name, 4) == 0;
}

static bool validate_canonical_wav(const uint8_t *wav, size_t wav_bytes,
                                   const char **reason_out)
{
    const char *reason = "invalid_wav";
    if (wav == NULL)
    {
        reason = "null_buffer";
        if (reason_out != NULL) *reason_out = reason;
        return false;
    }
    if (wav_bytes < 44)
    {
        reason = "too_small";
        if (reason_out != NULL) *reason_out = reason;
        return false;
    }
    if (wav_bytes > MAX_WAV_BYTES)
    {
        reason = "too_large";
        if (reason_out != NULL) *reason_out = reason;
        return false;
    }
    if (!wav_chunk_is(wav, "RIFF") || !wav_chunk_is(wav + 8, "WAVE"))
    {
        reason = "riff_wave";
        if (reason_out != NULL) *reason_out = reason;
        return false;
    }
    if (read_le32(wav + 4) != (uint32_t)(wav_bytes - 8))
    {
        reason = "riff_size";
        if (reason_out != NULL) *reason_out = reason;
        return false;
    }

    bool fmt_found = false;
    bool data_found = false;
    uint32_t data_bytes = 0;
    size_t data_payload_offset = 0;
    size_t offset = 12;

    while (offset <= wav_bytes && wav_bytes - offset >= 8)
    {
        const uint8_t *chunk = wav + offset;
        uint32_t chunk_bytes = read_le32(chunk + 4);
        size_t payload_offset = offset + 8;
        if ((size_t)chunk_bytes > wav_bytes - payload_offset)
        {
            reason = "chunk_size";
            if (reason_out != NULL) *reason_out = reason;
            return false;
        }

        size_t chunk_end = payload_offset + (size_t)chunk_bytes;
        if (wav_chunk_is(chunk, "fmt "))
        {
            if (fmt_found || chunk_bytes != 16)
            {
                reason = "fmt_chunk";
                if (reason_out != NULL) *reason_out = reason;
                return false;
            }
            const uint8_t *fmt = wav + payload_offset;
            uint16_t audio_format = read_le16(fmt + 0);
            uint16_t channels = read_le16(fmt + 2);
            uint32_t sample_rate = read_le32(fmt + 4);
            uint32_t byte_rate = read_le32(fmt + 8);
            uint16_t block_align = read_le16(fmt + 12);
            uint16_t bits_per_sample = read_le16(fmt + 14);
            ESP_LOGI(TAG, "WAV fmt format=%u channels=%u sample_rate=%lu byte_rate=%lu block_align=%u bits=%u",
                     (unsigned)audio_format, (unsigned)channels,
                     (unsigned long)sample_rate, (unsigned long)byte_rate,
                     (unsigned)block_align, (unsigned)bits_per_sample);
            if (audio_format != 1 ||
                channels != WAV_CHANNELS ||
                sample_rate != WAV_SAMPLE_RATE ||
                byte_rate != WAV_BYTE_RATE ||
                block_align != WAV_BLOCK_ALIGN ||
                bits_per_sample != WAV_BITS_PER_SAMPLE)
            {
                reason = "fmt_values";
                if (reason_out != NULL) *reason_out = reason;
                return false;
            }
            fmt_found = true;
        }
        else if (wav_chunk_is(chunk, "data"))
        {
            if (!fmt_found || data_found || chunk_bytes == 0 || chunk_end != wav_bytes)
            {
                reason = "data_chunk";
                if (reason_out != NULL) *reason_out = reason;
                return false;
            }
            data_found = true;
            data_bytes = chunk_bytes;
            data_payload_offset = payload_offset;
        }

        if ((chunk_bytes & 1U) != 0U)
        {
            if (chunk_end >= wav_bytes)
            {
                reason = "chunk_padding";
                if (reason_out != NULL) *reason_out = reason;
                return false;
            }
            chunk_end++;
        }
        offset = chunk_end;
    }

    if (!fmt_found || !data_found || offset != wav_bytes ||
        data_bytes != (uint32_t)(wav_bytes - data_payload_offset) ||
        (data_bytes % WAV_BLOCK_ALIGN) != 0U ||
        data_bytes > WAV_BYTE_RATE * MAX_WAV_DURATION_SEC)
    {
        reason = "audio_geometry";
        if (reason_out != NULL) *reason_out = reason;
        return false;
    }

    if (reason_out != NULL)
        *reason_out = "ok";
    return true;
}

enum BMOResponseReadResult {
    BMO_RESPONSE_READ_OK,
    BMO_RESPONSE_READ_TRUNCATED,
    BMO_RESPONSE_READ_TOO_LARGE,
    BMO_RESPONSE_READ_ERROR
};

static BMOResponseReadResult read_bounded_response(esp_http_client_handle_t client,
                                                    int64_t expected_length,
                                                    char *response_buf,
                                                    size_t response_capacity,
                                                    size_t *response_length)
{
    if (client == NULL || response_buf == NULL || response_capacity < 2 || response_length == NULL)
        return BMO_RESPONSE_READ_ERROR;

    const size_t max_body = response_capacity - 1;
    if (expected_length > (int64_t)max_body)
        return BMO_RESPONSE_READ_TOO_LARGE;

    size_t total = 0;
    while (total < max_body)
    {
        int read_count = esp_http_client_read(client, response_buf + total, max_body - total);
        if (read_count < 0)
            return BMO_RESPONSE_READ_ERROR;
        if (read_count == 0)
            break;
        total += (size_t)read_count;
    }

    if (total == max_body)
    {
        char extra = 0;
        int extra_count = esp_http_client_read(client, &extra, 1);
        if (extra_count < 0)
            return BMO_RESPONSE_READ_ERROR;
        if (extra_count > 0)
            return BMO_RESPONSE_READ_TOO_LARGE;
    }

    response_buf[total] = '\0';
    *response_length = total;
    if (expected_length >= 0 && total != (size_t)expected_length)
        return BMO_RESPONSE_READ_TRUNCATED;
    return BMO_RESPONSE_READ_OK;
}

static void clear_upload_request(const char *request_id, BMOPlaybackState terminal_state)
{
    if (request_id != NULL && strcmp(current_request_id, request_id) == 0)
        current_request_id[0] = '\0';
    if (request_id != NULL && strcmp(backend_active_request_id, request_id) == 0)
        backend_active_request_id[0] = '\0';
    backend_state[0] = '\0';
    strncpy(backend_state, "idle", sizeof(backend_state) - 1);
    backend_state[sizeof(backend_state) - 1] = '\0';
    clear_current_playback_job();
    reset_audio_deadline();
    playback_state = terminal_state;
}

// Perform HTTP POST WAV Upload with the Retry Matrix
static BMOUploadResult finish_upload_client(esp_http_client_handle_t client,
                                             bool client_open,
                                             BMOUploadResult result)
{
    if (client != NULL)
    {
        if (client_open)
            esp_http_client_close(client);
        esp_http_client_cleanup(client);
    }
    return result;
}

static BMOUploadResult upload_wav_voice(const char *uuid, int16_t *record_buf, size_t sample_count) {

    if (!api_ws_is_authenticated()) {
        ESP_LOGW(TAG, "Refusing upload until WebSocket authentication is valid");
        return ws_authentication_blocked
            ? BMO_UPLOAD_TERMINAL_CREDENTIAL
            : BMO_UPLOAD_RECONNECT_REQUIRED;
    }
    
    if (record_buf == NULL || sample_count > (SIZE_MAX / sizeof(int16_t)))
    {
        ESP_LOGE(TAG, "WAV body size is invalid before upload");
        return BMO_UPLOAD_TERMINAL_RECORDING;
    }

    size_t wav_byte_size = sample_count * sizeof(int16_t);
    ESP_LOGI(TAG, "Starting upload of WAV (%lu bytes, ID: %s)...",
             (unsigned long)wav_byte_size, uuid);
    
    esp_http_client_config_t config = {};
    config.url = BMO_UPLOAD_URL;
    config.method = HTTP_METHOD_POST;
    config.timeout_ms = 30000; // 30s individual POST timeout
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.common_name = BMO_BACKEND_HOST;
    config.skip_cert_common_name_check = false;
    
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL) {
        ESP_LOGE(TAG, "Failed to init HTTP upload client");
        return BMO_UPLOAD_RETRYABLE_TRANSPORT;
    }
    bool client_open = false;
    
    // Set headers
    esp_http_client_set_header(client, "X-Device-Id", BMO_DEVICE_ID);
    esp_http_client_set_header(client, "X-Device-Token", BMO_DEVICE_TOKEN);
    esp_http_client_set_header(client, "X-Request-Id", uuid);
    esp_http_client_set_header(client, "Content-Type", "audio/wav");
    
    esp_err_t err = esp_http_client_open(client, wav_byte_size);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open upload connection: %s", esp_err_to_name(err));
        return finish_upload_client(client, client_open, BMO_UPLOAD_RETRYABLE_TRANSPORT);
    }
    client_open = true;
    
    size_t bytes_written = 0;
    TickType_t body_deadline = xTaskGetTickCount() + pdMS_TO_TICKS(UPLOAD_BODY_TIMEOUT_MS);
    while (bytes_written < wav_byte_size)
    {
        if (xTaskGetTickCount() > body_deadline)
        {
            ESP_LOGE(TAG, "WAV body write timeout at %lu/%lu bytes",
                     (unsigned long)bytes_written, (unsigned long)wav_byte_size);
            return finish_upload_client(client, client_open, BMO_UPLOAD_RETRYABLE_TRANSPORT);
        }

        size_t remaining = wav_byte_size - bytes_written;
        int write_size = (int)(remaining > 4096U ? 4096U : remaining);
        int written = esp_http_client_write(client,
                                            ((const char *)record_buf) + bytes_written,
                                            write_size);
        if (written <= 0 || written > write_size)
        {
            ESP_LOGE(TAG, "WAV body write stopped at %lu/%lu bytes",
                     (unsigned long)bytes_written, (unsigned long)wav_byte_size);
            return finish_upload_client(client, client_open, BMO_UPLOAD_RETRYABLE_TRANSPORT);
        }
        bytes_written += (size_t)written;
    }
    ESP_LOGI(TAG, "WAV body write complete bytes=%lu/%lu",
             (unsigned long)bytes_written, (unsigned long)wav_byte_size);
    
    int64_t fetch_len = esp_http_client_fetch_headers(client);
    int status_code = esp_http_client_get_status_code(client);
    ESP_LOGI(TAG, "Upload response status: %d", status_code);

    if (status_code <= 0)
        return finish_upload_client(client, client_open, BMO_UPLOAD_RETRYABLE_TRANSPORT);

    bool needs_json = status_code == 202 || status_code == 200 || status_code == 409;
    char response_buf[UPLOAD_RESPONSE_MAX_BYTES] = {0};
    size_t response_length = 0;
    cJSON *response_root = NULL;
    if (needs_json)
    {
        BMOResponseReadResult read_result = read_bounded_response(
            client, fetch_len, response_buf, sizeof(response_buf), &response_length);
        if (read_result != BMO_RESPONSE_READ_OK)
        {
            ESP_LOGE(TAG, "Upload response body rejected class=%d bytes=%lu",
                     (int)read_result, (unsigned long)response_length);
            return finish_upload_client(client, client_open, BMO_UPLOAD_TERMINAL_MALFORMED_RESPONSE);
        }
        response_root = cJSON_ParseWithLength(response_buf, response_length);
        if (response_root == NULL)
        {
            ESP_LOGE(TAG, "Upload response JSON is malformed bytes=%lu",
                     (unsigned long)response_length);
            return finish_upload_client(client, client_open, BMO_UPLOAD_TERMINAL_MALFORMED_RESPONSE);
        }
    }

    BMOUploadResult result = BMO_UPLOAD_TERMINAL_REQUEST;
    bool duplicate_failure = false;
    bool duplicate_expired = false;
    if (status_code == 202)
    {
        cJSON *request_id_node = cJSON_GetObjectItem(response_root, "request_id");
        cJSON *status_node = cJSON_GetObjectItem(response_root, "status");
        if (request_id_node == NULL || !cJSON_IsString(request_id_node) ||
            strcmp(request_id_node->valuestring, uuid) != 0 ||
            status_node == NULL || !cJSON_IsString(status_node) ||
            strcmp(status_node->valuestring, "processing") != 0)
        {
            ESP_LOGE(TAG, "HTTP 202 response identity/status mismatch");
            result = BMO_UPLOAD_TERMINAL_MALFORMED_RESPONSE;
        }
        else
        {
            ESP_LOGI(TAG, "Upload accepted status=processing response_bytes=%lu",
                     (unsigned long)response_length);
            result = BMO_UPLOAD_ACCEPTED;
        }
    }
    else if (status_code == 200)
    {
        cJSON *request_id_node = cJSON_GetObjectItem(response_root, "request_id");
        cJSON *status_node = cJSON_GetObjectItem(response_root, "status");
        cJSON *duplicate_node = cJSON_GetObjectItem(response_root, "duplicate");
        if (request_id_node == NULL || !cJSON_IsString(request_id_node) ||
            strcmp(request_id_node->valuestring, uuid) != 0 ||
            duplicate_node == NULL || !cJSON_IsTrue(duplicate_node) ||
            status_node == NULL || !cJSON_IsString(status_node))
        {
            ESP_LOGE(TAG, "HTTP 200 duplicate response identity/status mismatch");
            result = BMO_UPLOAD_TERMINAL_MALFORMED_RESPONSE;
        }
        else if (strcmp(status_node->valuestring, "processing") == 0 ||
                 strcmp(status_node->valuestring, "audio_ready") == 0)
        {
            ESP_LOGI(TAG, "Duplicate response status=%s response_bytes=%lu",
                     status_node->valuestring, (unsigned long)response_length);
            result = BMO_UPLOAD_ACCEPTED;
        }
        else if (strcmp(status_node->valuestring, "completed") == 0 ||
                 strcmp(status_node->valuestring, "failed") == 0 ||
                 strcmp(status_node->valuestring, "expired") == 0)
        {
            ESP_LOGI(TAG, "Duplicate terminal status=%s; no new request",
                     status_node->valuestring);
            duplicate_expired = strcmp(status_node->valuestring, "expired") == 0;
            clear_upload_request(uuid, BMO_PLAYBACK_CANCELLED);
            duplicate_failure = strcmp(status_node->valuestring, "failed") == 0 || duplicate_expired;
            if (!duplicate_failure)
            {
                setState(BMOState::IDLE);
            }
            result = BMO_UPLOAD_TERMINAL_DUPLICATE;
        }
        else
        {
            ESP_LOGE(TAG, "HTTP 200 duplicate status is unsupported");
            result = BMO_UPLOAD_TERMINAL_MALFORMED_RESPONSE;
        }
    }
    else if (status_code == 409)
    {
        cJSON *error_node = cJSON_GetObjectItem(response_root, "error");
        if (error_node == NULL || !cJSON_IsString(error_node))
        {
            ESP_LOGE(TAG, "HTTP 409 response has no error classification");
            result = BMO_UPLOAD_TERMINAL_MALFORMED_RESPONSE;
        }
        else if (strcmp(error_node->valuestring, "WEBSOCKET_NOT_CONNECTED") == 0)
        {
            ESP_LOGW(TAG, "HTTP 409 classified=WEBSOCKET_NOT_CONNECTED");
            result = BMO_UPLOAD_RECONNECT_REQUIRED;
        }
        else if (strcmp(error_node->valuestring, "DEVICE_BUSY") == 0)
        {
            ESP_LOGW(TAG, "HTTP 409 classified=DEVICE_BUSY; no retry loop");
            result = BMO_UPLOAD_TERMINAL_BUSY;
        }
        else if (strcmp(error_node->valuestring, "REQUEST_ID_CONFLICT") == 0)
        {
            ESP_LOGE(TAG, "HTTP 409 classified=REQUEST_ID_CONFLICT; terminal");
            result = BMO_UPLOAD_TERMINAL_REQUEST_CONFLICT;
        }
        else
        {
            ESP_LOGE(TAG, "HTTP 409 classification is unsupported");
            result = BMO_UPLOAD_TERMINAL_MALFORMED_RESPONSE;
        }
    }
    else if (status_code == 401)
    {
        ESP_LOGE(TAG, "Upload rejected: terminal credential status");
        result = BMO_UPLOAD_TERMINAL_CREDENTIAL;
    }
    else if (status_code == 400)
    {
        ESP_LOGE(TAG, "Upload rejected: terminal request status=400");
        result = BMO_UPLOAD_TERMINAL_REQUEST;
    }
    else if (status_code == 413 || status_code == 415 || status_code == 422)
    {
        ESP_LOGE(TAG, "Upload rejected: terminal recording/format status=%d", status_code);
        result = BMO_UPLOAD_TERMINAL_RECORDING;
    }
    else if (status_code >= 500 && status_code <= 599)
    {
        ESP_LOGW(TAG, "Upload server status=%d; retryable transport/server result", status_code);
        result = BMO_UPLOAD_RETRYABLE_TRANSPORT;
    }
    else if (status_code >= 400 && status_code < 500)
    {
        ESP_LOGE(TAG, "Upload rejected: terminal client status=%d", status_code);
        result = BMO_UPLOAD_TERMINAL_REQUEST;
    }
    else
    {
        ESP_LOGE(TAG, "Upload returned unexpected HTTP status=%d", status_code);
        result = BMO_UPLOAD_TERMINAL_REQUEST;
    }

    if (response_root != NULL)
        cJSON_Delete(response_root);
    BMOUploadResult finished_result = finish_upload_client(client, client_open, result);
    if (duplicate_failure)
        handle_request_failed(duplicate_expired ? "AUDIO_EXPIRED" : "REQUEST_FAILED");
    return finished_result;
}

// Orchestrate Upload, WS sync, GET playback, and reporting
void api_upload_audio_and_process() {
    bool recovering_request = recovery_request_pending;
    recovery_request_pending = false;

    int16_t *record_buf = NULL;
    size_t sample_count = 0;
    if (!recovering_request) {
        record_buf = get_record_buffer();
        sample_count = get_record_size();

        if (record_buf == NULL || sample_count <= WAV_HEADER_SAMPLES) {
            ESP_LOGW(TAG, "Record buffer is empty, skipping API processing");
            setState(BMOState::IDLE);
            return;
        }

        if (sample_count > (SIZE_MAX / sizeof(int16_t)))
        {
            ESP_LOGE(TAG, "WAV sample count cannot be represented as bytes");
            handle_request_failed("INVALID_AUDIO");
            return;
        }

        size_t wav_byte_size = sample_count * sizeof(int16_t);
        const char *wav_validation_reason = NULL;
        if (!validate_canonical_wav((const uint8_t *)record_buf, wav_byte_size,
                                    &wav_validation_reason))
        {
            ESP_LOGE(TAG, "Local WAV validation failed reason=%s bytes=%lu",
                     wav_validation_reason != NULL ? wav_validation_reason : "unknown",
                     (unsigned long)wav_byte_size);
            handle_request_failed("INVALID_AUDIO");
            return;
        }
        ESP_LOGI(TAG, "Local WAV validation passed bytes=%lu", (unsigned long)wav_byte_size);

        if (!api_ws_is_authenticated()) {
            ESP_LOGW(TAG, "WebSocket is not authenticated. Refusing voice processing.");
            handle_request_failed("WEBSOCKET_NOT_CONNECTED");
            return;
        }

        if (pending_playback_event != BMO_PENDING_PLAYBACK_NONE) {
            (void)flush_pending_playback_event();
            if (pending_playback_event != BMO_PENDING_PLAYBACK_NONE)
                return;
        }

        if (backend_active_request_id[0] != '\0') {
            ESP_LOGW(TAG, "Backend already has an active request; refusing a second transaction");
            handle_request_failed("DEVICE_BUSY");
            return;
        }

        generate_uuid_v4(current_request_id);
        strncpy(backend_active_request_id, current_request_id, sizeof(backend_active_request_id) - 1);
        backend_active_request_id[sizeof(backend_active_request_id) - 1] = '\0';
        playback_state = BMO_PLAYBACK_WAITING;

        // HTTP POST retry matrix: preserve the same UUID and body on every attempt.
        bool success_post = false;
        BMOUploadResult last_upload_result = BMO_UPLOAD_TERMINAL_REQUEST;

        for (unsigned attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS && !success_post; ++attempt) {
            ESP_LOGI(TAG, "Voice upload attempt %u/%u", attempt, UPLOAD_MAX_ATTEMPTS);

            last_upload_result = upload_wav_voice(current_request_id, record_buf, sample_count);
            success_post = last_upload_result == BMO_UPLOAD_ACCEPTED;

            if (success_post) {
                break;
            }

            if (last_upload_result == BMO_UPLOAD_TERMINAL_DUPLICATE)
            {
                break;
            }

            if (last_upload_result == BMO_UPLOAD_RECONNECT_REQUIRED) {
                ESP_LOGW(TAG, "Upload requires WSS reconnect/auth; retaining same body and request ID");
                if (network_has_ip() && !ws_authentication_blocked) {
                    stop_ws_if_started("upload_reconnect");
                    start_ws_if_network_ready("upload_reconnect");
                }

                int wait_time = 0;
                while (network_has_ip() && !ws_authentication_blocked &&
                       !api_ws_is_authenticated() && wait_time < WS_AUTH_TIMEOUT_MS) {
                    vTaskDelay(pdMS_TO_TICKS(100));
                    wait_time += 100;
                }
            }

            if (last_upload_result != BMO_UPLOAD_RETRYABLE_TRANSPORT &&
                last_upload_result != BMO_UPLOAD_RECONNECT_REQUIRED)
                break;

            if (attempt < UPLOAD_MAX_ATTEMPTS) {
                int delay_sec = (int)attempt;
                ESP_LOGI(TAG, "Retrying same upload after %d seconds", delay_sec);
                vTaskDelay(pdMS_TO_TICKS(delay_sec * 1000));
            }
        }

        if (!success_post && playback_state != BMO_PLAYBACK_CANCELLED) {
            const char *failure_code = "UPLOAD_FAILED";
            switch (last_upload_result)
            {
                case BMO_UPLOAD_TERMINAL_CREDENTIAL:
                    failure_code = "INVALID_DEVICE_CREDENTIALS";
                    break;
                case BMO_UPLOAD_TERMINAL_BUSY:
                    failure_code = "DEVICE_BUSY";
                    break;
                case BMO_UPLOAD_TERMINAL_REQUEST_CONFLICT:
                    failure_code = "REQUEST_ID_CONFLICT";
                    break;
                case BMO_UPLOAD_TERMINAL_RECORDING:
                    failure_code = "INVALID_AUDIO";
                    break;
                case BMO_UPLOAD_TERMINAL_REQUEST:
                    failure_code = "UPLOAD_REJECTED";
                    break;
                case BMO_UPLOAD_TERMINAL_MALFORMED_RESPONSE:
                    failure_code = "MALFORMED_RESPONSE";
                    break;
                case BMO_UPLOAD_RECONNECT_REQUIRED:
                    failure_code = ws_authentication_blocked
                        ? "INVALID_DEVICE_CREDENTIALS"
                        : "WEBSOCKET_NOT_CONNECTED";
                    break;
                case BMO_UPLOAD_RETRYABLE_TRANSPORT:
                    failure_code = "UPLOAD_TRANSPORT_FAILED";
                    break;
                default:
                    failure_code = "UPLOAD_FAILED";
                    break;
            }
            ESP_LOGE(TAG, "Upload terminal result=%d after bounded attempts", (int)last_upload_result);
            clear_upload_request(current_request_id, BMO_PLAYBACK_FAILED);
            handle_request_failed(failure_code);
            return;
        }
    }

    if (playback_state == BMO_PLAYBACK_CANCELLED) {
        (void)process_pending_request_failed();
        return;
    }

    // Loop wait for audio_ready or failures (pipeline timeout: 300 seconds).
    int wait_timer_ms = 0;

    while (playback_state == BMO_PLAYBACK_WAITING && wait_timer_ms < TOTAL_PIPELINE_TIMEOUT_MS) {
        vTaskDelay(pdMS_TO_TICKS(20));
        wait_timer_ms += 20;
    }

    if (playback_state == BMO_PLAYBACK_WAITING) {
        ESP_LOGE(TAG, "Pipeline timeout: no audio_ready received within 300 seconds");
        clear_upload_request(current_request_id, BMO_PLAYBACK_FAILED);
        handle_request_failed("PIPELINE_TIMEOUT");
        return;
    }

    if (playback_state == BMO_PLAYBACK_CANCELLED) {
        (void)process_pending_request_failed();
        return;
    }

    if (playback_state == BMO_PLAYBACK_DOWNLOADING) {
        BMOPlaybackResult play_result = BMO_PLAYBACK_DOWNLOAD_FAILED;
        unsigned download_attempts = 0;

        while (download_attempts < 2) {
            if (audio_deadline_expired()) {
                play_result = BMO_PLAYBACK_EXPIRED;
                break;
            }

            download_attempts++;
            play_result = download_and_play_mp3(&current_playback_job);
            if (play_result == BMO_PLAYBACK_SUCCESS ||
                play_result == BMO_PLAYBACK_EXPIRED ||
                play_result == BMO_PLAYBACK_DECODE_FAILED ||
                play_result == BMO_PLAYBACK_PLAYBACK_FAILED ||
                play_result == BMO_PLAYBACK_REQUEST_FAILED ||
                playback_state == BMO_PLAYBACK_CANCELLED) {
                break;
            }

            if (download_attempts < 2) {
                ESP_LOGW(TAG, "MP3 download failed; retrying once in 1 second");
                vTaskDelay(pdMS_TO_TICKS(1000));
            }
        }

        if (play_result == BMO_PLAYBACK_REQUEST_FAILED ||
            (playback_state == BMO_PLAYBACK_CANCELLED && pending_request_failed)) {
            (void)process_pending_request_failed();
            return;
        }

        if (play_result == BMO_PLAYBACK_EXPIRED) {
            playback_mark_terminal(playback_terminal_result(play_result));
            clear_upload_request(current_request_id, BMO_PLAYBACK_CANCELLED);
            handle_request_failed("AUDIO_EXPIRED");
            return;
        }

        if (play_result == BMO_PLAYBACK_SUCCESS) {
            playback_mark_terminal(playback_terminal_result(play_result));
            if (send_playback_done(current_request_id)) {
                playback_state = BMO_PLAYBACK_DONE;
                mark_request_result_sent(current_request_id);
            } else {
                queue_pending_playback_event(current_request_id, BMO_PENDING_PLAYBACK_DONE, NULL);
            }

            setState(BMOState::IDLE);
        } else {
            playback_mark_terminal(playback_terminal_result(play_result));
            const char *failure_reason = play_result == BMO_PLAYBACK_DECODE_FAILED
                ? "DECODE_FAILED"
                : play_result == BMO_PLAYBACK_PLAYBACK_FAILED
                    ? "PLAYBACK_FAILED"
                    : "DOWNLOAD_FAILED";
            if (send_playback_failed(current_request_id, failure_reason)) {
                playback_state = BMO_PLAYBACK_FAILED;
                mark_request_result_sent(current_request_id);
            } else {
                queue_pending_playback_event(current_request_id, BMO_PENDING_PLAYBACK_FAILED, failure_reason);
            }

            setState(BMOState::ERROR_STATE);
            audio_play_error();
            vTaskDelay(pdMS_TO_TICKS(2000));
            setState(BMOState::IDLE);
        }
    }
}
