#include "joy_ble_provisioning.h"
#include "joy_ble_nimble.h"
#include "joy_identity.h"
#include "joy_crypto.h"
#include "wifi.h"
#include "esp_wifi.h"
#include "display.h"
#include "audio.h"
#include "api.h"
#include <cstring>
#include <cstdio>
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_random.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include "cJSON.h"
static const char *TAG = "JOY_BLE_PROV";

#define PROVISIONING_WINDOW_US 300000000LL // 5 minutes
#define PHYSICAL_ARM_WINDOW_US 60000000LL  // 60 seconds

static JoyBleState s_state = JoyBleState::UNPAIRED_IDLE;
static int64_t s_window_deadline_us = 0;
static char s_setup_nonce[32] = {0};

// Armed physical confirmation state
static char s_session_id[64] = {0};
static char s_challenge[128] = {0};
static char s_confirmation_nonce[64] = {0};
static char s_physical_proof[128] = {0};
static int64_t s_arm_deadline_us = 0;

// Commit state
static char s_commit_nonce[64] = {0};
static char s_commit_proof[128] = {0};

static void clear_confirmation()
{
    s_arm_deadline_us = 0;
    s_session_id[0] = '\0';
    s_challenge[0] = '\0';
    s_confirmation_nonce[0] = '\0';
    s_physical_proof[0] = '\0';
    s_commit_nonce[0] = '\0';
    s_commit_proof[0] = '\0';
}

static void generate_nonce(char *dst, size_t max_len)
{
    uint8_t rand_bytes[16];
    esp_fill_random(rand_bytes, sizeof(rand_bytes));
    joy_crypto_base64url_encode(rand_bytes, sizeof(rand_bytes), dst, max_len);
}

esp_err_t joy_ble_provisioning_init(void)
{
    joy_identity_init();
    joy_ble_nimble_init();

    const joy_runtime_creds_t *runtime = joy_runtime_get();
    if (runtime && runtime->is_provisioned) {
        s_state = JoyBleState::RUNTIME_OPERATIONAL;
        display_set_idle_face(FACE_HAPPY);
        ESP_LOGI(TAG, "Device already provisioned; BLE provisioning idle");
    } else {
        ESP_LOGI(TAG, "Device in unprovisioned state; automatically opening BLE pairing window on boot");
        joy_ble_start_pairing_window();
    }
    return ESP_OK;
}

void joy_ble_start_pairing_window(void)
{
    api_ws_reset_authentication_blocked();
    esp_wifi_disconnect();
    clear_confirmation();
    generate_nonce(s_setup_nonce, sizeof(s_setup_nonce));
    s_state = JoyBleState::BOOTSTRAP_ADVERTISING;

    const joy_identity_t *id = joy_identity_get();
    char ble_name[16];
    snprintf(ble_name, sizeof(ble_name), "JOY-%.4s", id->provisioning_ref);

    s_window_deadline_us = esp_timer_get_time() + 120000000LL;
    ESP_LOGI(TAG, "Started 120-second BLE pairing window: local_name=%s, setup_nonce=%s",
             ble_name, s_setup_nonce);
    display_show_ble_pairing(120);
    audio_playBleActivated();
    joy_ble_nimble_start_advertising();
}

void joy_ble_stop_provisioning(void)
{
    s_state = JoyBleState::UNPAIRED_IDLE;
    s_window_deadline_us = 0;
    clear_confirmation();
    joy_ble_nimble_stop();
    display_hide_ble_pairing();
    const joy_runtime_creds_t *runtime = joy_runtime_get();
    if (runtime && !runtime->is_provisioned) {
        display_set_idle_face(FACE_DEAD);
    }
    ESP_LOGI(TAG, "Stopped BLE provisioning");
}

void joy_ble_unpair(void)
{
    ESP_LOGI(TAG, "Unpairing device: clearing credentials and transitioning to UNPAIRED_IDLE / FACE_DEAD");
    joy_identity_increment_reset_epoch(nullptr);
    joy_runtime_clear_provisioning();
    joy_ble_stop_provisioning();
    display_set_idle_face(FACE_DEAD);
    audio_playUnpairedSad();
}

bool joy_ble_is_active(void)
{
    return (s_state != JoyBleState::UNPAIRED_IDLE && s_state != JoyBleState::RUNTIME_OPERATIONAL);
}

JoyBleState joy_ble_get_state(void)
{
    return s_state;
}

void joy_ble_set_state(JoyBleState new_state)
{
    s_state = new_state;
}

const char *joy_ble_get_setup_nonce(void)
{
    return s_setup_nonce;
}

const char *joy_ble_get_session_id(void)
{
    return s_session_id;
}

const char *joy_ble_get_confirm_nonce(void)
{
    return s_confirmation_nonce;
}

const char *joy_ble_get_physical_proof(void)
{
    return s_physical_proof;
}

const char *joy_ble_get_commit_nonce(void)
{
    return s_commit_nonce;
}

const char *joy_ble_get_commit_proof(void)
{
    return s_commit_proof;
}

esp_err_t joy_ble_arm_physical_confirmation(const char *session_id, const char *challenge)
{
    if (!session_id || !challenge || !session_id[0] || !challenge[0] ||
        strlen(session_id) >= sizeof(s_session_id) || strlen(challenge) >= sizeof(s_challenge)) {
        return ESP_ERR_INVALID_ARG;
    }
    if (s_state != JoyBleState::BOOTSTRAP_CONNECTED) return ESP_ERR_INVALID_STATE;
    clear_confirmation();

    strncpy(s_session_id, session_id, sizeof(s_session_id) - 1);
    s_session_id[sizeof(s_session_id) - 1] = '\0';

    strncpy(s_challenge, challenge, sizeof(s_challenge) - 1);
    s_challenge[sizeof(s_challenge) - 1] = '\0';

    s_arm_deadline_us = esp_timer_get_time() + PHYSICAL_ARM_WINDOW_US;
    s_state = JoyBleState::PHYSICAL_CONFIRM_PENDING;

    display_hide_ble_pairing();
    display_set_idle_face(FACE_SURPRISED);
    audio_triggerExpressionAudio(7);
    ESP_LOGI(TAG, "Armed physical confirmation window (60s): session_id=%s", s_session_id);
    return ESP_OK;
}

void joy_ble_on_physical_hold_2s(void)
{
    if (s_state != JoyBleState::PHYSICAL_CONFIRM_PENDING ||
        esp_timer_get_time() >= s_arm_deadline_us) {
        ESP_LOGW(TAG, "2s physical hold ignored: no live confirmation challenge");
        return;
    }

    const joy_identity_t *id = joy_identity_get();
    generate_nonce(s_confirmation_nonce, sizeof(s_confirmation_nonce));

    joy_crypto_create_physical_proof(
        id->provisioning_root_secret,
        id->hardware_id,
        id->provisioning_ref,
        s_setup_nonce,
        id->reset_epoch,
        s_session_id,
        s_challenge,
        s_confirmation_nonce,
        s_physical_proof,
        sizeof(s_physical_proof)
    );

    s_state = JoyBleState::PHYSICAL_CONFIRMED;
    ESP_LOGI(TAG, "Physical presence confirmed! Generated proof for session %s", s_session_id);
    display_hide_ble_pairing();
    display_set_idle_face(FACE_EXCITED);
    // Send GATT notification to mobile on Char 3
    joy_ble_nimble_notify_proof(s_confirmation_nonce, s_physical_proof);
}

esp_err_t joy_ble_handle_secure_start_payload(
    const char *res_id,
    const char *token,
    const char *start_proof,
    const char *ssid,
    const char *pass)
{
    const joy_identity_t *id = joy_identity_get();
    if (s_state != JoyBleState::PHYSICAL_CONFIRMED &&
        s_state != JoyBleState::WAITING_WIFI_CREDENTIALS &&
        s_state != JoyBleState::WIFI_SELECTION_READY) {
        return ESP_ERR_INVALID_STATE;
    }

    // 1. Verify start_proof HMAC
    bool valid = joy_crypto_verify_secure_start(
        id->provisioning_root_secret,
        id->hardware_id,
        id->provisioning_ref,
        s_setup_nonce,
        id->reset_epoch,
        s_session_id,
        res_id,
        start_proof
    );

    if (!valid) {
        ESP_LOGE(TAG, "Invalid secure_start_proof! Rejecting provisioning payload.");
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "secure_start_proof verified successfully!");

    // 2. Generate commit_nonce and commit_proof HMAC
    generate_nonce(s_commit_nonce, sizeof(s_commit_nonce));
    joy_crypto_create_commit_proof(
        id->provisioning_root_secret,
        id->hardware_id,
        s_setup_nonce,
        id->reset_epoch,
        res_id,
        s_commit_nonce,
        s_commit_proof,
        sizeof(s_commit_proof)
    );

    s_state = JoyBleState::CLAIM_COMMITTED;

    // 3. Save pending claim to runtime NVS/RAM
    joy_runtime_save_pending_claim(res_id, token);

    // 4. Send GATT Notification on Char 5 (Commit & Status)
    joy_ble_nimble_notify_commit(s_commit_nonce, s_commit_proof, "CONNECTING");

    // 5. Connect to Wi-Fi with decrypted credentials
    ESP_LOGI(TAG, "Initiating Wi-Fi connection to SSID \"%s\"...", ssid);
    wifi_connect_to_ap(ssid, pass);

    return ESP_OK;
}

void joy_ble_poll(void)
{
    if (!joy_ble_is_active()) return;

    int64_t now = esp_timer_get_time();
    if (s_state == JoyBleState::BOOTSTRAP_ADVERTISING && now >= s_window_deadline_us) {
        ESP_LOGW(TAG, "BLE discovery window expired (60s timeout)");
        joy_ble_stop_provisioning();
        return;
    }

    if (s_state == JoyBleState::BOOTSTRAP_ADVERTISING) {
        static int last_countdown_sec = -1;
        int remaining_sec = (int)((s_window_deadline_us - now) / 1000000LL);
        if (remaining_sec != last_countdown_sec) {
            last_countdown_sec = remaining_sec;
            display_update_ble_countdown(remaining_sec);
        }
    }
    if (s_state == JoyBleState::PHYSICAL_CONFIRM_PENDING && now >= s_arm_deadline_us) {
        ESP_LOGW(TAG, "Physical confirm arming expired (60s timeout)");
        joy_ble_stop_provisioning();
    }
}

esp_err_t joy_ble_finalize_with_backend(void)
{
    const joy_identity_t *id = joy_identity_get();
    const joy_runtime_creds_t *runtime = joy_runtime_get();

    if (!runtime || !runtime->pending_finalize) {
        ESP_LOGW(TAG, "Finalize skipped: no pending claim finalize");
        return ESP_OK;
    }
    time_t now_sec = time(NULL);
    if (now_sec < 1700000000) {
        ESP_LOGW(TAG, "System time not yet valid (SNTP pending). Deferring finalize.");
        return ESP_ERR_INVALID_STATE;
    }


    char finalize_nonce[64];
    generate_nonce(finalize_nonce, sizeof(finalize_nonce));

    char mfg_proof[128];
    joy_crypto_create_finalize_proof(
        id->manufacturing_secret,
        id->hardware_id,
        runtime->pending_reservation_id,
        runtime->pending_claim_token,
        id->reset_epoch,
        finalize_nonce,
        "v4.0.0",
        id->hardware_revision,
        mfg_proof,
        sizeof(mfg_proof)
    );

    char json_body[512];
    snprintf(json_body, sizeof(json_body),
             "{\"reservation_id\":\"%s\",\"claim_token\":\"%s\",\"reset_epoch\":%lu,"
             "\"finalize_nonce\":\"%s\",\"firmware_version\":\"v4.0.0\",\"hardware_revision\":\"%s\","
             "\"manufacturing_proof\":\"%s\"}",
             runtime->pending_reservation_id,
             runtime->pending_claim_token,
             (unsigned long)id->reset_epoch,
             finalize_nonce,
             id->hardware_revision,
             mfg_proof);

    esp_http_client_config_t config = {};
    config.url = "https://api.personalbmo.web.id/api/v1/device-enrollment/finalize";
    config.method = HTTP_METHOD_POST;
    config.timeout_ms = 15000;
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.skip_cert_common_name_check = false;
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (!client) {
        ESP_LOGE(TAG, "Failed to initialize HTTP client for finalize");
        return ESP_FAIL;
    }
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "X-Hardware-Id", id->hardware_id);

    s_state = JoyBleState::FINALIZING_WITH_BACKEND;
    ESP_LOGI(TAG, "Sending finalize request to backend for reservation %s...", runtime->pending_reservation_id);

    char response_buf[1024] = {0};
    int status_code = 0;
    esp_err_t err = esp_http_client_open(client, strlen(json_body));
    if (err == ESP_OK) {
        int wlen = esp_http_client_write(client, json_body, strlen(json_body));
        if (wlen > 0) {
            esp_http_client_fetch_headers(client);
            status_code = esp_http_client_get_status_code(client);
            int rlen = esp_http_client_read_response(client, response_buf, sizeof(response_buf) - 1);
            if (rlen > 0) response_buf[rlen] = '\0';
        }
    }
    esp_http_client_cleanup(client);

    if (status_code == 200) {
        ESP_LOGI(TAG, "Finalize HTTP succeeded! Parsing runtime token...");
        cJSON *res_root = cJSON_Parse(response_buf);
        bool token_saved = false;
        if (res_root) {
            cJSON *runtime_node = cJSON_GetObjectItem(res_root, "runtime");
            if (runtime_node) {
                cJSON *tok_node = cJSON_GetObjectItem(runtime_node, "device_token");
                if (tok_node && cJSON_IsString(tok_node) && strlen(tok_node->valuestring) >= 16) {
                    esp_err_t save_err = joy_runtime_save_token(tok_node->valuestring);
                    if (save_err == ESP_OK) {
                        token_saved = true;
                        ESP_LOGI(TAG, "Successfully persisted enrolled runtime device token");
                    } else {
                        ESP_LOGE(TAG, "Failed to persist runtime token to NVS: %s", esp_err_to_name(save_err));
                    }
                }
            }
            cJSON_Delete(res_root);
        }
        if (!token_saved) {
            ESP_LOGE(TAG, "Finalize failed: runtime token missing, invalid, or could not be persisted");
            return ESP_FAIL;
        }
        joy_ble_nimble_stop();
        s_state = JoyBleState::RUNTIME_OPERATIONAL;
        display_hide_ble_pairing();
        display_set_idle_face(FACE_HAPPY);
        audio_triggerExpressionAudio((int)FACE_HAPPY);
        api_ws_reset_authentication_blocked();
        return ESP_OK;
    } else {
        ESP_LOGW(TAG, "Finalize HTTP request failed: err=%s, status_code=%d, response=%s",
                 esp_err_to_name(err), status_code, response_buf);
        return ESP_FAIL;
    }
}
