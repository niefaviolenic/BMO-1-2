#include "joy_ble_provisioning.h"

#include <cstring>
#include <cstdio>
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_random.h"
#include "esp_http_client.h"
#include "joy_identity.h"
#include "joy_crypto.h"

static const char *TAG = "JOY_BLE_PROV";

#define PROVISIONING_WINDOW_US 300000000LL // 5 minutes

static JoyBleState s_state = JoyBleState::UNPAIRED_IDLE;
static int64_t s_window_deadline_us = 0;
static char s_setup_nonce[32] = {0};

// Armed physical confirmation state
static char s_session_id[64] = {0};
static char s_challenge[128] = {0};
static char s_confirmation_nonce[64] = {0};
static char s_physical_proof[128] = {0};
static int64_t s_arm_deadline_us = 0;

static void generate_nonce(char *dst, size_t max_len)
{
    uint8_t rand_bytes[16];
    esp_fill_random(rand_bytes, sizeof(rand_bytes));
    joy_crypto_base64url_encode(rand_bytes, sizeof(rand_bytes), dst, max_len);
}

esp_err_t joy_ble_provisioning_init(void)
{
    joy_identity_init();
    const joy_runtime_creds_t *runtime = joy_runtime_get();
    if (runtime && runtime->is_provisioned) {
        s_state = JoyBleState::RUNTIME_OPERATIONAL;
        ESP_LOGI(TAG, "Device already provisioned; BLE provisioning inactive");
    } else {
        s_state = JoyBleState::UNPAIRED_IDLE;
        ESP_LOGI(TAG, "Device in unpaired idle state; waiting for 5s touch to start pairing window");
    }
    return ESP_OK;
}

void joy_ble_start_pairing_window(void)
{
    generate_nonce(s_setup_nonce, sizeof(s_setup_nonce));
    s_window_deadline_us = esp_timer_get_time() + PROVISIONING_WINDOW_US;
    s_state = JoyBleState::BOOTSTRAP_ADVERTISING;

    const joy_identity_t *id = joy_identity_get();
    char ble_name[16];
    snprintf(ble_name, sizeof(ble_name), "JOY-%.4s", id->provisioning_ref);

    ESP_LOGI(TAG, "Started 5-minute BLE pairing window: local_name=%s, setup_nonce=%s",
             ble_name, s_setup_nonce);
}

void joy_ble_stop_provisioning(void)
{
    s_state = JoyBleState::UNPAIRED_IDLE;
    s_window_deadline_us = 0;
    s_arm_deadline_us = 0;
    memset(s_session_id, 0, sizeof(s_session_id));
    memset(s_challenge, 0, sizeof(s_challenge));
    ESP_LOGI(TAG, "Stopped BLE provisioning");
}

bool joy_ble_is_active(void)
{
    return (s_state != JoyBleState::UNPAIRED_IDLE && s_state != JoyBleState::RUNTIME_OPERATIONAL);
}

JoyBleState joy_ble_get_state(void)
{
    return s_state;
}

void joy_ble_on_physical_hold_2s(void)
{
    if (s_state != JoyBleState::PHYSICAL_CONFIRM_PENDING) {
        ESP_LOGW(TAG, "2s physical hold ignored: state is not PHYSICAL_CONFIRM_PENDING");
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
}

void joy_ble_poll(void)
{
    if (!joy_ble_is_active()) return;

    int64_t now = esp_timer_get_time();
    if (now >= s_window_deadline_us) {
        ESP_LOGW(TAG, "BLE provisioning window expired (5 minutes timeout)");
        joy_ble_stop_provisioning();
        return;
    }

    if (s_state == JoyBleState::PHYSICAL_CONFIRM_PENDING && now >= s_arm_deadline_us) {
        ESP_LOGW(TAG, "Physical confirm arming expired (60s timeout)");
        s_state = JoyBleState::BOOTSTRAP_CONNECTED;
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
    config.timeout_ms = 10000;

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (!client) {
        ESP_LOGE(TAG, "Failed to initialize HTTP client for finalize");
        return ESP_FAIL;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "X-Hardware-Id", id->hardware_id);
    esp_http_client_set_post_field(client, json_body, strlen(json_body));

    s_state = JoyBleState::FINALIZING_WITH_BACKEND;
    ESP_LOGI(TAG, "Sending finalize request to backend for reservation %s...", runtime->pending_reservation_id);

    esp_err_t err = esp_http_client_perform(client);
    int status_code = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);

    if (err == ESP_OK && status_code == 200) {
        ESP_LOGI(TAG, "Finalize successful! Provisioning completed.");
        joy_runtime_save_token("joy_tok_finalized");
        s_state = JoyBleState::RUNTIME_OPERATIONAL;
        return ESP_OK;
    } else {
        ESP_LOGW(TAG, "Finalize HTTP request failed: err=%s, status_code=%d", esp_err_to_name(err), status_code);
        return ESP_FAIL;
    }
}
