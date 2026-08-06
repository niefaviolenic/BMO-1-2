#include "api.h"
#include "state.h"
#include "audio.h"
#include "display.h"
#include "wakeword.h"
#include "network.h"

#include "esp_http_client.h"
#include "esp_websocket_client.h"
#include "cJSON.h"
#include "mp3dec.h"

#include "esp_log.h"
#include "esp_random.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include <string.h>

static const char *TAG = "API";

// Configuration - Ganti IP VPS / Domain di sini
#define BMO_BACKEND_HOST "192.168.1.100"
#define BMO_BACKEND_PORT "3000"
#define BMO_DEVICE_ID    "bmo-001"
#define BMO_DEVICE_TOKEN "secret acak unik"

#define BMO_WS_URL      "ws://" BMO_BACKEND_HOST ":" BMO_BACKEND_PORT "/ws"
#define BMO_UPLOAD_URL  "http://" BMO_BACKEND_HOST ":" BMO_BACKEND_PORT "/api/v1/voice"

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

static BMOPlaybackState playback_state = BMO_PLAYBACK_IDLE;
static char current_request_id[37] = {0};
static char play_audio_url[256] = {0};

static esp_websocket_client_handle_t ws_client = NULL;
static bool ws_connected = false;
static bool ws_authenticated = false;
static bool ws_client_started = false;
static int ws_reconnect_delay_sec = 1;

static SemaphoreHandle_t ws_send_mutex = NULL;

static void mark_ws_down()
{
    ws_connected = false;
    ws_authenticated = false;
    network_set_backend_connected(false);
}

static esp_err_t start_ws_if_network_ready()
{
    if (ws_client == NULL)
    {
        ESP_LOGW(TAG, "WS client is not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!network_has_ip())
    {
        ESP_LOGW(TAG, "Network is not ready, delaying WebSocket start");
        return ESP_ERR_INVALID_STATE;
    }

    if (ws_client_started)
    {
        return ESP_OK;
    }

    esp_err_t err = esp_websocket_client_start(ws_client);
    if (err == ESP_OK)
    {
        ws_client_started = true;
        ESP_LOGI(TAG, "WebSocket started: %s", BMO_WS_URL);
    }
    else
    {
        ESP_LOGW(TAG, "Failed to start WebSocket: %s", esp_err_to_name(err));
    }

    return err;
}

static void stop_ws_if_started()
{
    if (ws_client != NULL && ws_client_started)
    {
        esp_err_t err = esp_websocket_client_stop(ws_client);
        if (err != ESP_OK)
        {
            ESP_LOGW(TAG, "Failed to stop WebSocket: %s", esp_err_to_name(err));
        }

        ws_client_started = false;
    }

    mark_ws_down();
}

// Skip ID3 tags
static int skip_id3_tag(esp_http_client_handle_t http_client, uint8_t *first_chunk, int chunk_len, int *skipped_out) {
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

// WebSocket Send helper
static void ws_send_text(const char *text) {
    if (ws_client == NULL || !network_has_ip() || !ws_connected) {
        ESP_LOGW(TAG, "WS client not connected, cannot send text");
        return;
    }
    xSemaphoreTake(ws_send_mutex, portMAX_DELAY);
    esp_websocket_client_send_text(ws_client, text, strlen(text), portMAX_DELAY);
    xSemaphoreGive(ws_send_mutex);
}

// Send event audio_playback_done
static void send_playback_done(const char *req_id) {
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "event", "audio_playback_done");
    cJSON_AddStringToObject(root, "request_id", req_id);
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    
    ESP_LOGI(TAG, "Sending audio_playback_done for %s", req_id);
    ws_send_text(json_str);
    free(json_str);
}

// Send event audio_playback_failed
static void send_playback_failed(const char *req_id, const char *reason) {
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "event", "audio_playback_failed");
    cJSON_AddStringToObject(root, "request_id", req_id);
    cJSON_AddStringToObject(root, "reason", reason);
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    
    ESP_LOGI(TAG, "Sending audio_playback_failed for %s (reason: %s)", req_id, reason);
    ws_send_text(json_str);
    free(json_str);
}

// WebSocket Send Authenticate
static void send_authenticate() {
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "event", "authenticate");
    cJSON_AddStringToObject(root, "device_id", BMO_DEVICE_ID);
    cJSON_AddStringToObject(root, "device_token", BMO_DEVICE_TOKEN);
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    
    ESP_LOGI(TAG, "Sending authenticate to WS...");
    ws_send_text(json_str);
    free(json_str);
}

// Handle request_failed locally (e.g. error message sound and face display)
static void handle_request_failed(const char *code) {
    setState(BMOState::ERROR_STATE);
    display_face(FACE_SAD);
    audio_play_error();
    
    if (strcmp(code, "NO_SPEECH") == 0) {
        ESP_LOGI(TAG, "Voice Error: Sorry, it is too noisy. BMO cannot hear you.");
    } else {
        ESP_LOGI(TAG, "Voice Error: Oh no. BMO could not answer. Please try again. Code: %s", code);
    }
    
    vTaskDelay(pdMS_TO_TICKS(2000));
    setState(BMOState::IDLE);
    display_face(FACE_HAPPY);
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
        cJSON *state_node = cJSON_GetObjectItem(root, "backend_state");
        if (status_node && strcmp(status_node->valuestring, "ok") == 0) {
            ws_authenticated = true;
            network_set_backend_connected(true);
            ws_reconnect_delay_sec = 1; // Reset backoff delay
            ESP_LOGI(TAG, "WS authenticated successfully. Backend state: %s", state_node ? state_node->valuestring : "unknown");
            
            // Sync state
            if (state_node && strcmp(state_node->valuestring, "idle") == 0) {
                // Backend is idle, clear local request hang
                if (playback_state == BMO_PLAYBACK_WAITING) {
                    playback_state = BMO_PLAYBACK_CANCELLED;
                }
            }
            
            // Re-send pending done/failed if needed
            if (playback_state == BMO_PLAYBACK_DONE_PENDING_SEND) {
                send_playback_done(current_request_id);
                playback_state = BMO_PLAYBACK_DONE;
            } else if (playback_state == BMO_PLAYBACK_FAILED_PENDING_SEND) {
                send_playback_failed(current_request_id, "DOWNLOAD_FAILED");
                playback_state = BMO_PLAYBACK_FAILED;
            }
        }
        else {
            ws_authenticated = false;
            network_set_backend_connected(false);
        }
    }
    else if (strcmp(event, "authentication_failed") == 0) {
        ws_authenticated = false;
        network_set_backend_connected(false);
        cJSON *err_node = cJSON_GetObjectItem(root, "error");
        ESP_LOGE(TAG, "WS Authentication failed: %s", err_node ? err_node->valuestring : "unknown");
        esp_websocket_client_close(ws_client, portMAX_DELAY);
    }
    else if (strcmp(event, "connection_replaced") == 0) {
        ESP_LOGW(TAG, "WS connection replaced by new session");
    }
    else if (strcmp(event, "display_status") == 0) {
        cJSON *req_id_node = cJSON_GetObjectItem(root, "request_id");
        cJSON *status_node = cJSON_GetObjectItem(root, "status");
        if (req_id_node && status_node && strcmp(req_id_node->valuestring, current_request_id) == 0) {
            if (strcmp(status_node->valuestring, "thinking") == 0) {
                setState(BMOState::THINKING);
                display_face(FACE_CONFUSED);
            }
        }
    }
    else if (strcmp(event, "audio_ready") == 0) {
        cJSON *req_id_node = cJSON_GetObjectItem(root, "request_id");
        cJSON *url_node = cJSON_GetObjectItem(root, "audio_url");
        if (req_id_node && url_node && strcmp(req_id_node->valuestring, current_request_id) == 0) {
            if (playback_state == BMO_PLAYBACK_DOWNLOADING || playback_state == BMO_PLAYBACK_PLAYING) {
                ESP_LOGI(TAG, "Ignore duplicate audio_ready event (already downloading/playing)");
            }
            else if (playback_state == BMO_PLAYBACK_DONE_PENDING_SEND) {
                send_playback_done(current_request_id);
            }
            else if (playback_state == BMO_PLAYBACK_FAILED_PENDING_SEND) {
                send_playback_failed(current_request_id, "DOWNLOAD_FAILED");
            }
            else {
                strncpy(play_audio_url, url_node->valuestring, sizeof(play_audio_url) - 1);
                playback_state = BMO_PLAYBACK_DOWNLOADING;
            }
        }
    }
    else if (strcmp(event, "request_failed") == 0) {
        cJSON *req_id_node = cJSON_GetObjectItem(root, "request_id");
        cJSON *code_node = cJSON_GetObjectItem(root, "code");
        if (req_id_node && code_node && strcmp(req_id_node->valuestring, current_request_id) == 0) {
            playback_state = BMO_PLAYBACK_CANCELLED;
            handle_request_failed(code_node->valuestring);
        }
    }
    
    cJSON_Delete(root);
}

// WebSocket Event Handler
static void websocket_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data) {
    esp_websocket_event_data_t *data = (esp_websocket_event_data_t *)event_data;
    switch (event_id) {
        case WEBSOCKET_EVENT_CONNECTED:
            ESP_LOGI(TAG, "WebSocket connected, authenticating...");
            ws_connected = true;
            network_set_backend_connected(false);
            send_authenticate();
            break;
            
        case WEBSOCKET_EVENT_DISCONNECTED:
            ESP_LOGI(TAG, "WebSocket disconnected");
            mark_ws_down();
            break;
            
        case WEBSOCKET_EVENT_DATA:
            if (data->op_code == 0x01 && data->data_ptr != NULL) { // Text frame
                handle_ws_message(data->data_ptr, data->data_len);
            }
            break;
            
        case WEBSOCKET_EVENT_ERROR:
            ESP_LOGE(TAG, "WebSocket error event");
            network_set_backend_connected(false);
            break;
    }
}

// Background WS Monitor/Reconnect task
static void ws_monitor_task(void *param) {
    while (true) {
        if (!network_has_ip()) {
            stop_ws_if_started();
            vTaskDelay(pdMS_TO_TICKS(1000));
            continue;
        }

        if (!ws_client_started) {
            ESP_LOGI(TAG, "Network ready, starting WebSocket...");
            start_ws_if_network_ready();
        }
        else if (!ws_connected) {
            ESP_LOGI(TAG, "Reconnecting WebSocket in %d seconds...", ws_reconnect_delay_sec);
            int wait_time_ms = 0;
            int reconnect_delay_ms = ws_reconnect_delay_sec * 1000;

            while (network_has_ip() && wait_time_ms < reconnect_delay_ms) {
                vTaskDelay(pdMS_TO_TICKS(100));
                wait_time_ms += 100;
            }

            if (!network_has_ip()) {
                stop_ws_if_started();
                continue;
            }
            
            // Try reconnecting
            stop_ws_if_started();
            start_ws_if_network_ready();
            
            // Exponential backoff up to 30 seconds
            ws_reconnect_delay_sec = (ws_reconnect_delay_sec * 2 > 30) ? 30 : ws_reconnect_delay_sec * 2;
        }
        vTaskDelay(pdMS_TO_TICKS(2000));
    }
}

void api_init() {
    ESP_LOGI(TAG, "API init started");
    network_set_backend_connected(false);

    if (ws_send_mutex == NULL) {
        ws_send_mutex = xSemaphoreCreateMutex();
    }
    
    esp_websocket_client_config_t ws_cfg = {};
    ws_cfg.uri = BMO_WS_URL;
    ws_cfg.disable_auto_reconnect = true; // Let monitor task manage reconnect with exact backoff
    
    ws_client = esp_websocket_client_init(&ws_cfg);
    if (ws_client == NULL) {
        ESP_LOGE(TAG, "Failed to initialize WebSocket client");
        return;
    }
    
    esp_websocket_register_events(ws_client, WEBSOCKET_EVENT_ANY, websocket_event_handler, NULL);
    start_ws_if_network_ready();
    
    xTaskCreate(ws_monitor_task, "ws_monitor", 4096, NULL, 3, NULL);
}

bool api_ws_is_connected() {
    return network_has_ip() && ws_connected;
}

bool api_ws_is_authenticated() {
    return network_has_ip() && ws_authenticated && network_is_backend_connected();
}

// Progressive MP3 Streaming & Playback
static bool download_and_play_mp3(const char *url) {
    ESP_LOGI(TAG, "Initializing HTTP GET stream for MP3: %s", url);
    
    esp_http_client_config_t config = {};
    config.url = url;
    config.method = HTTP_METHOD_GET;
    config.timeout_ms = 10000;
    
    esp_http_client_handle_t http_client = esp_http_client_init(&config);
    if (http_client == NULL) {
        ESP_LOGE(TAG, "Failed to initialize HTTP client");
        return false;
    }
    
    esp_err_t err = esp_http_client_open(http_client, 0);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open GET connection: %s", esp_err_to_name(err));
        esp_http_client_cleanup(http_client);
        return false;
    }
    
    int content_length = esp_http_client_fetch_headers(http_client);
    int status_code = esp_http_client_get_status_code(http_client);
    ESP_LOGI(TAG, "HTTP GET status: %d, len: %d", status_code, content_length);
    
    if (status_code == 410) {
        ESP_LOGW(TAG, "Audio expired (HTTP 410 Gone)");
        esp_http_client_close(http_client);
        esp_http_client_cleanup(http_client);
        handle_request_failed("AUDIO_EXPIRED");
        return false;
    }
    
    if (status_code != 200) {
        ESP_LOGE(TAG, "Failed HTTP status: %d", status_code);
        esp_http_client_close(http_client);
        esp_http_client_cleanup(http_client);
        return false;
    }
    
    // MP3 Buffer configuration
    #define MP3_STREAM_BUF_SIZE (32 * 1024) // 32 KB buffer
    uint8_t *mp3_stream_buf = (uint8_t *)malloc(MP3_STREAM_BUF_SIZE);
    if (mp3_stream_buf == NULL) {
        ESP_LOGE(TAG, "Failed to allocate MP3 streaming buffer");
        esp_http_client_close(http_client);
        esp_http_client_cleanup(http_client);
        return false;
    }
    
    HMP3Decoder hMP3Decoder = MP3InitDecoder();
    if (hMP3Decoder == NULL) {
        ESP_LOGE(TAG, "Failed to initialize Helix MP3 decoder");
        free(mp3_stream_buf);
        esp_http_client_close(http_client);
        esp_http_client_cleanup(http_client);
        return false;
    }
    
    int bytes_left = 0;
    uint8_t *read_ptr = mp3_stream_buf;
    bool checked_id3 = false;
    bool playback_started = false;
    bool is_eof = false;
    bool success = true;
    
    short *out_pcm = (short *)malloc(1152 * 2 * sizeof(short)); // Helix frame capacity
    if (out_pcm == NULL) {
        ESP_LOGE(TAG, "Failed to allocate frame PCM output buffer");
        MP3FreeDecoder(hMP3Decoder);
        free(mp3_stream_buf);
        esp_http_client_close(http_client);
        esp_http_client_cleanup(http_client);
        return false;
    }
    
    while (true) {
        // 1. Fetch more data if space is available
        int space_avail = MP3_STREAM_BUF_SIZE - (read_ptr - mp3_stream_buf) - bytes_left;
        if (space_avail > 1024 && !is_eof) {
            // Shift remaining un-decoded bytes to the beginning of the buffer
            if (bytes_left > 0 && read_ptr != mp3_stream_buf) {
                memmove(mp3_stream_buf, read_ptr, bytes_left);
            }
            read_ptr = mp3_stream_buf;
            
            int bytes_to_read = space_avail;
            if (bytes_to_read > 4096) bytes_to_read = 4096;
            
            int r = esp_http_client_read(http_client, (char *)(read_ptr + bytes_left), bytes_to_read);
            if (r < 0) {
                ESP_LOGE(TAG, "HTTP read error: %d", r);
                success = false;
                break;
            } else if (r == 0) {
                is_eof = true;
            } else {
                bytes_left += r;
            }
        }
        
        // 2. Skip ID3 tags on the first chunk
        if (!checked_id3 && bytes_left >= 10) {
            checked_id3 = true;
            int skipped = 0;
            if (skip_id3_tag(http_client, read_ptr, bytes_left, &skipped) == 0) {
                read_ptr += skipped;
                bytes_left -= skipped;
            } else {
                success = false;
                break;
            }
        }
        
        // 3. Initial buffering requirement (16 KB)
        if (!playback_started && bytes_left < 16384 && !is_eof) {
            // Keep buffering
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }
        
        // 4. Check EOF done condition
        if (is_eof && bytes_left < 10) {
            break; // Done decoding
        }
        
        // 5. Decode frame
        uint8_t *orig_read_ptr = read_ptr;
        int orig_bytes_left = bytes_left;
        
        int err_decode = MP3Decode(hMP3Decoder, &read_ptr, &bytes_left, out_pcm, 0);
        
        if (err_decode == ERR_MP3_NONE) {
            MP3FrameInfo frameInfo;
            MP3GetLastFrameInfo(hMP3Decoder, &frameInfo);
            
            if (!playback_started) {
                playback_started = true;
                playback_state = BMO_PLAYBACK_PLAYING;
                setState(BMOState::SPEAKING);
                display_face(FACE_HAPPY);
                ESP_LOGI(TAG, "MP3 Playback started: rate=%d, channels=%d", frameInfo.samprate, frameInfo.nChans);
            }
            
            // Output audio through dynamic scaling configuration
            audio_play_raw(out_pcm, frameInfo.outputSamps, frameInfo.nChans, frameInfo.samprate);
        }
        else if (err_decode == ERR_MP3_INDATA_UNDERFLOW) {
            // Need more data. Restore indices for partial frame
            read_ptr = orig_read_ptr;
            bytes_left = orig_bytes_left;
            
            if (is_eof) {
                break; // EOF reached with incomplete frame
            }
            vTaskDelay(pdMS_TO_TICKS(10));
        }
        else {
            // Decoding sync error, skip 1 byte and search for next sync word
            read_ptr++;
            bytes_left--;
            if (bytes_left <= 0) {
                bytes_left = 0;
                read_ptr = mp3_stream_buf;
            }
        }
    }
    
    // Clean up
    free(out_pcm);
    free(mp3_stream_buf);
    MP3FreeDecoder(hMP3Decoder);
    esp_http_client_close(http_client);
    esp_http_client_cleanup(http_client);
    
    return success;
}

// Perform HTTP POST WAV Upload with the Retry Matrix
static bool upload_wav_voice(const char *uuid, int16_t *record_buf, size_t sample_count, bool *reconnect_needed) {
    *reconnect_needed = false;
    
    size_t wav_byte_size = sample_count * sizeof(int16_t);
    ESP_LOGI(TAG, "Starting upload of WAV (%d bytes, ID: %s)...", wav_byte_size, uuid);
    
    esp_http_client_config_t config = {};
    config.url = BMO_UPLOAD_URL;
    config.method = HTTP_METHOD_POST;
    config.timeout_ms = 30000; // 30s individual POST timeout
    
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL) {
        ESP_LOGE(TAG, "Failed to init HTTP upload client");
        return false;
    }
    
    // Set headers
    esp_http_client_set_header(client, "X-Device-Id", BMO_DEVICE_ID);
    esp_http_client_set_header(client, "X-Device-Token", BMO_DEVICE_TOKEN);
    esp_http_client_set_header(client, "X-Request-Id", uuid);
    esp_http_client_set_header(client, "Content-Type", "audio/wav");
    
    esp_err_t err = esp_http_client_open(client, wav_byte_size);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open upload connection: %s", esp_err_to_name(err));
        esp_http_client_cleanup(client);
        return false;
    }
    
    int written = esp_http_client_write(client, (const char *)record_buf, wav_byte_size);
    if (written < 0) {
        ESP_LOGE(TAG, "Failed to write WAV body");
        esp_http_client_cleanup(client);
        return false;
    }
    
    int fetch_len = esp_http_client_fetch_headers(client);
    if (fetch_len < 0) {
        ESP_LOGE(TAG, "Failed fetching response headers");
        esp_http_client_cleanup(client);
        return false;
    }
    
    int status_code = esp_http_client_get_status_code(client);
    ESP_LOGI(TAG, "Upload response status: %d", status_code);
    
    bool result = false;
    
    if (status_code == 202) {
        result = true;
    }
    else if (status_code == 200) {
        // Duplicate request. Parse response to see status
        char response_buf[512] = {0};
        esp_http_client_read(client, response_buf, sizeof(response_buf) - 1);
        cJSON *res_root = cJSON_Parse(response_buf);
        if (res_root) {
            cJSON *status_node = cJSON_GetObjectItem(res_root, "status");
            if (status_node && cJSON_IsString(status_node)) {
                const char *status = status_node->valuestring;
                ESP_LOGI(TAG, "Duplicate response status: %s", status);
                if (strcmp(status, "processing") == 0 || strcmp(status, "audio_ready") == 0) {
                    result = true;
                } else if (strcmp(status, "completed") == 0) {
                    // Already played, return to idle
                    playback_state = BMO_PLAYBACK_CANCELLED;
                    setState(BMOState::IDLE);
                    display_face(FACE_HAPPY);
                    result = true;
                } else if (strcmp(status, "failed") == 0 || strcmp(status, "expired") == 0) {
                    cJSON *err_code_node = cJSON_GetObjectItem(res_root, "error_code");
                    handle_request_failed(err_code_node ? err_code_node->valuestring : "AUDIO_EXPIRED");
                    result = true;
                }
            }
            cJSON_Delete(res_root);
        }
    }
    else if (status_code == 409) {
        // Read conflict code
        char response_buf[512] = {0};
        esp_http_client_read(client, response_buf, sizeof(response_buf) - 1);
        cJSON *res_root = cJSON_Parse(response_buf);
        if (res_root) {
            cJSON *err_node = cJSON_GetObjectItem(res_root, "error");
            if (err_node && cJSON_IsString(err_node)) {
                const char *err_str = err_node->valuestring;
                ESP_LOGW(TAG, "Upload HTTP 409: %s", err_str);
                if (strcmp(err_str, "WEBSOCKET_NOT_CONNECTED") == 0) {
                    *reconnect_needed = true;
                } else if (strcmp(err_str, "DEVICE_BUSY") == 0) {
                    ESP_LOGW(TAG, "Device busy on server. Waiting for current request to finish.");
                } else if (strcmp(err_str, "REQUEST_ID_CONFLICT") == 0) {
                    handle_request_failed("REQUEST_ID_CONFLICT");
                }
            }
            cJSON_Delete(res_root);
        }
    }
    else if (status_code == 401) {
        ESP_LOGE(TAG, "Invalid device credentials! Please update device config token.");
    }
    else if (status_code >= 400 && status_code < 500) {
        // Other non-retryable 4xx
        ESP_LOGE(TAG, "Upload rejected with bad client status: %d", status_code);
        handle_request_failed("INVALID_AUDIO");
    }
    
    esp_http_client_close(client);
    esp_http_client_cleanup(client);
    
    return result;
}

// Orchestrate Upload, WS sync, GET playback, and reporting
void api_upload_audio_and_process() {
    int16_t *record_buf = get_record_buffer();
    size_t sample_count = get_record_size();
    
    if (record_buf == NULL || sample_count <= WAV_HEADER_SAMPLES) {
        ESP_LOGW(TAG, "Record buffer is empty, skipping API processing");
        setState(BMOState::IDLE);
        display_face(FACE_HAPPY);
        return;
    }
    
    // Ensure WebSocket is connected and authenticated
    if (!network_has_ip() || !ws_connected || !ws_authenticated) {
        ESP_LOGW(TAG, "WebSocket is not connected or authenticated. Refusing voice processing.");
        handle_request_failed("WEBSOCKET_NOT_CONNECTED");
        return;
    }
    
    // Generate request ID
    generate_uuid_v4(current_request_id);
    playback_state = BMO_PLAYBACK_WAITING;
    
    // HTTP POST Retry matrix: 3 total attempts
    bool success_post = false;
    int attempt = 0;
    
    while (attempt < 3 && !success_post) {
        bool reconnect_needed = false;
        attempt++;
        ESP_LOGI(TAG, "Voice Upload Attempt %d / 3", attempt);
        
        success_post = upload_wav_voice(current_request_id, record_buf, sample_count, &reconnect_needed);
        
        if (success_post) {
            break;
        }
        
        if (reconnect_needed) {
            ESP_LOGW(TAG, "Server indicates WebSocket not connected. Re-connecting WebSocket...");
            if (network_has_ip()) {
                stop_ws_if_started();
                start_ws_if_network_ready();
            }
            // Wait up to 5s for auth
            int wait_time = 0;
            while (network_has_ip() && !ws_authenticated && wait_time < 5000) {
                vTaskDelay(pdMS_TO_TICKS(100));
                wait_time += 100;
            }
        }
        
        if (!success_post && attempt < 3) {
            int delay_sec = attempt; // 1s wait before attempt 2, 2s wait before attempt 3
            ESP_LOGI(TAG, "POST failed. Waiting %d seconds before retry...", delay_sec);
            vTaskDelay(pdMS_TO_TICKS(delay_sec * 1000));
        }
    }
    
    if (!success_post) {
        ESP_LOGE(TAG, "Upload failed after 3 attempts.");
        handle_request_failed("INTERNAL_ERROR");
        return;
    }
    
    if (playback_state == BMO_PLAYBACK_CANCELLED) {
        return; // Cancelled/duplicate handled in post responses
    }
    
    // Loop wait for audio_ready or failures (Pipeline timeout: 90 seconds)
    int wait_timer_ms = 0;
    #define PIPELINE_TIMEOUT_MS 90000
    
    while (playback_state == BMO_PLAYBACK_WAITING && wait_timer_ms < PIPELINE_TIMEOUT_MS) {
        vTaskDelay(pdMS_TO_TICKS(100));
        wait_timer_ms += 100;
    }
    
    if (playback_state == BMO_PLAYBACK_WAITING) {
        ESP_LOGE(TAG, "Pipeline timeout: no audio_ready received within 90 seconds");
        handle_request_failed("PIPELINE_TIMEOUT");
        return;
    }
    
    if (playback_state == BMO_PLAYBACK_CANCELLED) {
        return;
    }
    
    if (playback_state == BMO_PLAYBACK_DOWNLOADING) {
        // Download and play MP3. Implement retry once if failed.
        bool play_ok = false;
        int play_attempts = 0;
        
        while (play_attempts < 2 && !play_ok) {
            play_attempts++;
            play_ok = download_and_play_mp3(play_audio_url);
            
            if (!play_ok && play_attempts < 2) {
                ESP_LOGW(TAG, "MP3 Download failed. Retrying 1 time in 1 second...");
                vTaskDelay(pdMS_TO_TICKS(1000));
            }
        }
        
        if (play_ok) {
            playback_state = BMO_PLAYBACK_DONE;
            if (network_has_ip() && ws_connected && ws_authenticated) {
                send_playback_done(current_request_id);
            } else {
                playback_state = BMO_PLAYBACK_DONE_PENDING_SEND;
            }
            
            // Clean up and back to IDLE
            setState(BMOState::IDLE);
            display_face(FACE_HAPPY);
        } else {
            playback_state = BMO_PLAYBACK_FAILED;
            if (network_has_ip() && ws_connected && ws_authenticated) {
                send_playback_failed(current_request_id, "DOWNLOAD_FAILED");
            } else {
                playback_state = BMO_PLAYBACK_FAILED_PENDING_SEND;
            }
            
            // Play error sequence
            setState(BMOState::ERROR_STATE);
            display_face(FACE_SAD);
            audio_play_error();
            vTaskDelay(pdMS_TO_TICKS(2000));
            setState(BMOState::IDLE);
            display_face(FACE_HAPPY);
        }
    }
}
