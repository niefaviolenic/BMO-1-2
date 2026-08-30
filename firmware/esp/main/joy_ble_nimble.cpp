#include "joy_ble_nimble.h"
#include "joy_ble_provisioning.h"
#include "joy_identity.h"
#include "joy_crypto.h"
#include "wifi.h"

#include "esp_log.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "host/ble_hs.h"
#include "host/util/util.h"
#include "host/ble_uuid.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"
#include "cJSON.h"

#include <cstring>
#include <cstdio>
#include <cstdlib>

static const char *TAG = "JOY_NIMBLE";

// Custom 128-bit UUIDs for Joy Provisioning Service (Base: 0000xxxx-6a6f-7961-692d-62696e657231)
static const ble_uuid128_t gatt_svr_svc_uuid =
    BLE_UUID128_INIT(0x31, 0x72, 0x65, 0x6e, 0x69, 0x62, 0x2d, 0x69, 0x61, 0x79, 0x6f, 0x6a, 0x01, 0xfe, 0x00, 0x00);
static const ble_uuid128_t gatt_svr_chr_identity_uuid =
    BLE_UUID128_INIT(0x31, 0x72, 0x65, 0x6e, 0x69, 0x62, 0x2d, 0x69, 0x61, 0x79, 0x6f, 0x6a, 0x02, 0xfe, 0x00, 0x00);
static const ble_uuid128_t gatt_svr_chr_challenge_uuid =
    BLE_UUID128_INIT(0x31, 0x72, 0x65, 0x6e, 0x69, 0x62, 0x2d, 0x69, 0x61, 0x79, 0x6f, 0x6a, 0x03, 0xfe, 0x00, 0x00);
static const ble_uuid128_t gatt_svr_chr_proof_uuid =
    BLE_UUID128_INIT(0x31, 0x72, 0x65, 0x6e, 0x69, 0x62, 0x2d, 0x69, 0x61, 0x79, 0x6f, 0x6a, 0x04, 0xfe, 0x00, 0x00);
static const ble_uuid128_t gatt_svr_chr_secure_start_uuid =
    BLE_UUID128_INIT(0x31, 0x72, 0x65, 0x6e, 0x69, 0x62, 0x2d, 0x69, 0x61, 0x79, 0x6f, 0x6a, 0x05, 0xfe, 0x00, 0x00);
static const ble_uuid128_t gatt_svr_chr_commit_uuid =
    BLE_UUID128_INIT(0x31, 0x72, 0x65, 0x6e, 0x69, 0x62, 0x2d, 0x69, 0x61, 0x79, 0x6f, 0x6a, 0x06, 0xfe, 0x00, 0x00);

static uint16_t s_proof_val_handle = 0;
static uint16_t s_commit_val_handle = 0;
static uint16_t s_conn_handle = BLE_HS_CONN_HANDLE_NONE;
static bool s_nimble_started = false;
static uint8_t s_own_addr_type = 0;

static int gatt_svr_chr_access_identity(uint16_t conn_handle, uint16_t attr_handle,
                                       struct ble_gatt_access_ctxt *ctxt, void *arg);
static int gatt_svr_chr_access_challenge(uint16_t conn_handle, uint16_t attr_handle,
                                        struct ble_gatt_access_ctxt *ctxt, void *arg);
static int gatt_svr_chr_access_proof(uint16_t conn_handle, uint16_t attr_handle,
                                    struct ble_gatt_access_ctxt *ctxt, void *arg);
static int gatt_svr_chr_access_secure_start(uint16_t conn_handle, uint16_t attr_handle,
                                           struct ble_gatt_access_ctxt *ctxt, void *arg);
static int gatt_svr_chr_access_commit(uint16_t conn_handle, uint16_t attr_handle,
                                     struct ble_gatt_access_ctxt *ctxt, void *arg);

static const struct ble_gatt_svc_def gatt_svr_svcs[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = &gatt_svr_svc_uuid.u,
        .includes = NULL,
        .characteristics = (struct ble_gatt_chr_def[]) {
            {
                .uuid = &gatt_svr_chr_identity_uuid.u,
                .access_cb = gatt_svr_chr_access_identity,
                .arg = NULL,
                .descriptors = NULL,
                .flags = BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_NOTIFY,
                .min_key_size = 0,
                .val_handle = NULL,
                .cpfd = NULL,
            },
            {
                .uuid = &gatt_svr_chr_challenge_uuid.u,
                .access_cb = gatt_svr_chr_access_challenge,
                .arg = NULL,
                .descriptors = NULL,
                .flags = BLE_GATT_CHR_F_WRITE,
                .min_key_size = 0,
                .val_handle = NULL,
                .cpfd = NULL,
            },
            {
                .uuid = &gatt_svr_chr_proof_uuid.u,
                .access_cb = gatt_svr_chr_access_proof,
                .arg = NULL,
                .descriptors = NULL,
                .flags = BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_NOTIFY,
                .min_key_size = 0,
                .val_handle = &s_proof_val_handle,
                .cpfd = NULL,
            },
            {
                .uuid = &gatt_svr_chr_secure_start_uuid.u,
                .access_cb = gatt_svr_chr_access_secure_start,
                .arg = NULL,
                .descriptors = NULL,
                .flags = BLE_GATT_CHR_F_WRITE,
                .min_key_size = 0,
                .val_handle = NULL,
                .cpfd = NULL,
            },
            {
                .uuid = &gatt_svr_chr_commit_uuid.u,
                .access_cb = gatt_svr_chr_access_commit,
                .arg = NULL,
                .descriptors = NULL,
                .flags = BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_NOTIFY,
                .min_key_size = 0,
                .val_handle = &s_commit_val_handle,
                .cpfd = NULL,
            },
            { 0 }
        },
    },
    { 0 }
};

static int gatt_svr_chr_access_identity(uint16_t conn_handle, uint16_t attr_handle,
                                       struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    if (ctxt->op != BLE_GATT_ACCESS_OP_READ_CHR) return BLE_ATT_ERR_UNLIKELY;

    const joy_identity_t *id = joy_identity_get();
    const char *nonce = joy_ble_get_setup_nonce();

    cJSON *root = cJSON_CreateObject();
    if (!root) return BLE_ATT_ERR_INSUFFICIENT_RES;

    cJSON_AddStringToObject(root, "hw_id", id->hardware_id);
    cJSON_AddStringToObject(root, "ref", id->provisioning_ref);
    cJSON_AddStringToObject(root, "nonce", nonce ? nonce : "");
    cJSON_AddNumberToObject(root, "epoch", id->reset_epoch);

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_str) return BLE_ATT_ERR_INSUFFICIENT_RES;

    int rc = os_mbuf_append(ctxt->om, json_str, strlen(json_str));
    free(json_str);

    return rc == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
}

static int gatt_svr_chr_access_challenge(uint16_t conn_handle, uint16_t attr_handle,
                                        struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    if (ctxt->op != BLE_GATT_ACCESS_OP_WRITE_CHR) return BLE_ATT_ERR_UNLIKELY;

    uint16_t len = OS_MBUF_PKTLEN(ctxt->om);
    char *buf = (char *)malloc(len + 1);
    if (!buf) return BLE_ATT_ERR_INSUFFICIENT_RES;

    os_mbuf_copydata(ctxt->om, 0, len, buf);
    buf[len] = '\0';

    cJSON *root = cJSON_Parse(buf);
    free(buf);
    if (!root) return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;

    cJSON *session_node = cJSON_GetObjectItem(root, "session_id");
    cJSON *challenge_node = cJSON_GetObjectItem(root, "challenge");

    if (!session_node || !cJSON_IsString(session_node) ||
        !challenge_node || !cJSON_IsString(challenge_node)) {
        cJSON_Delete(root);
        return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    }

    esp_err_t err = joy_ble_arm_physical_confirmation(session_node->valuestring, challenge_node->valuestring);
    cJSON_Delete(root);

    return err == ESP_OK ? 0 : BLE_ATT_ERR_UNLIKELY;
}

static int gatt_svr_chr_access_proof(uint16_t conn_handle, uint16_t attr_handle,
                                    struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    if (ctxt->op != BLE_GATT_ACCESS_OP_READ_CHR) return BLE_ATT_ERR_UNLIKELY;

    const char *nonce = joy_ble_get_confirm_nonce();
    const char *proof = joy_ble_get_physical_proof();

    cJSON *root = cJSON_CreateObject();
    if (!root) return BLE_ATT_ERR_INSUFFICIENT_RES;

    cJSON_AddStringToObject(root, "confirm_nonce", nonce ? nonce : "");
    cJSON_AddStringToObject(root, "proof", proof ? proof : "");

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_str) return BLE_ATT_ERR_INSUFFICIENT_RES;

    int rc = os_mbuf_append(ctxt->om, json_str, strlen(json_str));
    free(json_str);

    return rc == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
}

static int gatt_svr_chr_access_secure_start(uint16_t conn_handle, uint16_t attr_handle,
                                           struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    if (ctxt->op != BLE_GATT_ACCESS_OP_WRITE_CHR) return BLE_ATT_ERR_UNLIKELY;

    uint16_t len = OS_MBUF_PKTLEN(ctxt->om);
    char *buf = (char *)malloc(len + 1);
    if (!buf) return BLE_ATT_ERR_INSUFFICIENT_RES;

    os_mbuf_copydata(ctxt->om, 0, len, buf);
    buf[len] = '\0';

    cJSON *root = cJSON_Parse(buf);
    free(buf);
    if (!root) return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;

    cJSON *iv_node = cJSON_GetObjectItem(root, "iv");
    cJSON *cipher_node = cJSON_GetObjectItem(root, "ciphertext");
    cJSON *tag_node = cJSON_GetObjectItem(root, "tag");

    if (!iv_node || !cJSON_IsString(iv_node) ||
        !cipher_node || !cJSON_IsString(cipher_node) ||
        !tag_node || !cJSON_IsString(tag_node)) {
        cJSON_Delete(root);
        return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    }

    const joy_identity_t *id = joy_identity_get();
    const char *setup_nonce = joy_ble_get_setup_nonce();

    // 1. Derive PoP & Session Key locally
    char pop[64] = {0};
    joy_crypto_derive_sec2_pop(id->provisioning_root_secret, id->provisioning_ref, setup_nonce, pop, sizeof(pop));

    uint8_t session_key[32];
    if (joy_crypto_derive_session_key(pop, setup_nonce, session_key) != ESP_OK) {
        cJSON_Delete(root);
        return BLE_ATT_ERR_UNLIKELY;
    }

    // 2. Decode base64url inputs
    uint8_t iv_bytes[16], tag_bytes[32];
    uint8_t *cipher_bytes = (uint8_t *)malloc(1024);
    char *decrypted_json = (char *)calloc(1, 1024);
    if (!cipher_bytes || !decrypted_json) {
        if (cipher_bytes) free(cipher_bytes);
        if (decrypted_json) free(decrypted_json);
        cJSON_Delete(root);
        return BLE_ATT_ERR_INSUFFICIENT_RES;
    }

    size_t iv_len = 0, cipher_len = 0, tag_len = 0;
    if (joy_crypto_base64url_decode(iv_node->valuestring, iv_bytes, sizeof(iv_bytes), &iv_len) != ESP_OK ||
        joy_crypto_base64url_decode(cipher_node->valuestring, cipher_bytes, 1024, &cipher_len) != ESP_OK ||
        joy_crypto_base64url_decode(tag_node->valuestring, tag_bytes, sizeof(tag_bytes), &tag_len) != ESP_OK) {
        free(cipher_bytes);
        free(decrypted_json);
        cJSON_Delete(root);
        return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    }

    cJSON *res_id_node = cJSON_GetObjectItem(root, "res_id");
    char target_res_id[64] = {0};
    if (res_id_node && cJSON_IsString(res_id_node)) {
        strncpy(target_res_id, res_id_node->valuestring, sizeof(target_res_id) - 1);
    }
    cJSON_Delete(root);

    // 3. Prepare AAD = hw_id|ref|res_id (or hw_id|ref|session_id)
    char aad[256];
    if (strlen(target_res_id) > 0) {
        snprintf(aad, sizeof(aad), "%s|%s|%s", id->hardware_id, id->provisioning_ref, target_res_id);
    } else {
        snprintf(aad, sizeof(aad), "%s|%s|%s", id->hardware_id, id->provisioning_ref, joy_ble_get_session_id());
    }

    esp_err_t dec_err = joy_crypto_decrypt_session_envelope(
        session_key,
        iv_bytes, iv_len,
        cipher_bytes, cipher_len,
        tag_bytes, tag_len,
        aad, strlen(aad),
        decrypted_json, 1024
    );

    // Fallback: If decryption failed, try the other AAD variant
    if (dec_err != ESP_OK) {
        if (strlen(target_res_id) > 0) {
            snprintf(aad, sizeof(aad), "%s|%s|%s", id->hardware_id, id->provisioning_ref, joy_ble_get_session_id());
        }
        dec_err = joy_crypto_decrypt_session_envelope(
            session_key,
            iv_bytes, iv_len,
            cipher_bytes, cipher_len,
            tag_bytes, tag_len,
            aad, strlen(aad),
            decrypted_json, 1024
        );
    }

    free(cipher_bytes);

    if (dec_err != ESP_OK) {
        free(decrypted_json);
        ESP_LOGE(TAG, "Decryption/AAD validation failed for Characteristic 4");
        return BLE_ATT_ERR_UNLIKELY;
    }

    cJSON *dec_root = cJSON_Parse(decrypted_json);
    free(decrypted_json);
    if (!dec_root) {
        ESP_LOGE(TAG, "Decrypted plaintext is not valid JSON");
        return BLE_ATT_ERR_UNLIKELY;
    }

    cJSON *res_id = cJSON_GetObjectItem(dec_root, "res_id");
    cJSON *token = cJSON_GetObjectItem(dec_root, "token");
    cJSON *proof = cJSON_GetObjectItem(dec_root, "start_proof");
    cJSON *ssid = cJSON_GetObjectItem(dec_root, "ssid");
    cJSON *pass = cJSON_GetObjectItem(dec_root, "pass");

    if (res_id && cJSON_IsString(res_id) &&
        token && cJSON_IsString(token) &&
        proof && cJSON_IsString(proof) &&
        ssid && cJSON_IsString(ssid) &&
        pass && cJSON_IsString(pass)) {
        esp_err_t err = joy_ble_handle_secure_start_payload(
            res_id->valuestring,
            token->valuestring,
            proof->valuestring,
            ssid->valuestring,
            pass->valuestring
        );
        cJSON_Delete(dec_root);
        return err == ESP_OK ? 0 : BLE_ATT_ERR_UNLIKELY;
    }

    cJSON_Delete(dec_root);
    return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
}

static int gatt_svr_chr_access_commit(uint16_t conn_handle, uint16_t attr_handle,
                                     struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    if (ctxt->op != BLE_GATT_ACCESS_OP_READ_CHR) return BLE_ATT_ERR_UNLIKELY;

    const char *commit_nonce = joy_ble_get_commit_nonce();
    const char *commit_proof = joy_ble_get_commit_proof();

    cJSON *root = cJSON_CreateObject();
    if (!root) return BLE_ATT_ERR_INSUFFICIENT_RES;

    cJSON_AddStringToObject(root, "commit_nonce", commit_nonce ? commit_nonce : "");
    cJSON_AddStringToObject(root, "commit_proof", commit_proof ? commit_proof : "");
    cJSON_AddStringToObject(root, "status", "CONNECTING");

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_str) return BLE_ATT_ERR_INSUFFICIENT_RES;

    int rc = os_mbuf_append(ctxt->om, json_str, strlen(json_str));
    free(json_str);

    return rc == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
}

void joy_ble_nimble_notify_proof(const char *confirm_nonce, const char *proof)
{
    if (s_conn_handle == BLE_HS_CONN_HANDLE_NONE || s_proof_val_handle == 0) return;

    cJSON *root = cJSON_CreateObject();
    if (!root) return;

    cJSON_AddStringToObject(root, "confirm_nonce", confirm_nonce ? confirm_nonce : "");
    cJSON_AddStringToObject(root, "proof", proof ? proof : "");
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_str) return;

    struct os_mbuf *om = ble_hs_mbuf_from_flat(json_str, strlen(json_str));
    free(json_str);
    if (!om) return;

    ble_gatts_notify_custom(s_conn_handle, s_proof_val_handle, om);
}

void joy_ble_nimble_notify_commit(const char *commit_nonce, const char *commit_proof, const char *status)
{
    if (s_conn_handle == BLE_HS_CONN_HANDLE_NONE || s_commit_val_handle == 0) return;

    cJSON *root = cJSON_CreateObject();
    if (!root) return;

    cJSON_AddStringToObject(root, "commit_nonce", commit_nonce ? commit_nonce : "");
    cJSON_AddStringToObject(root, "commit_proof", commit_proof ? commit_proof : "");
    cJSON_AddStringToObject(root, "status", status ? status : "CONNECTING");
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_str) return;

    struct os_mbuf *om = ble_hs_mbuf_from_flat(json_str, strlen(json_str));
    free(json_str);
    if (!om) return;

    ble_gatts_notify_custom(s_conn_handle, s_commit_val_handle, om);
}

static int gap_event_handler(struct ble_gap_event *event, void *arg)
{
    switch (event->type) {
        case BLE_GAP_EVENT_CONNECT:
            ESP_LOGI(TAG, "BLE connection %s; status=%d",
                     event->connect.status == 0 ? "established" : "failed",
                     event->connect.status);
            if (event->connect.status == 0) {
                s_conn_handle = event->connect.conn_handle;
                joy_ble_set_state(JoyBleState::BOOTSTRAP_CONNECTED);
            } else {
                s_conn_handle = BLE_HS_CONN_HANDLE_NONE;
                joy_ble_nimble_start_advertising();
            }
            break;

        case BLE_GAP_EVENT_DISCONNECT:
            ESP_LOGI(TAG, "BLE disconnected; reason=%d", event->disconnect.reason);
            s_conn_handle = BLE_HS_CONN_HANDLE_NONE;
            if (joy_ble_is_active()) {
                joy_ble_nimble_start_advertising();
            }
            break;

        case BLE_GAP_EVENT_MTU:
            ESP_LOGI(TAG, "BLE MTU update: conn_handle=%d, mtu=%d",
                     event->mtu.conn_handle, event->mtu.value);
            break;

        case BLE_GAP_EVENT_ADV_COMPLETE:
            ESP_LOGI(TAG, "BLE Advertising completed");
            if (joy_ble_is_active() && s_conn_handle == BLE_HS_CONN_HANDLE_NONE) {
                joy_ble_nimble_start_advertising();
            }
            break;

        default:
            break;
    }
    return 0;
}

void joy_ble_nimble_start_advertising(void)
{
    if (!s_nimble_started) return;

    const joy_identity_t *id = joy_identity_get();
    char dev_name[32];
    snprintf(dev_name, sizeof(dev_name), "JOY-%.4s", id->provisioning_ref);

    ble_svc_gap_device_name_set(dev_name);

    struct ble_hs_adv_fields adv_fields;
    memset(&adv_fields, 0, sizeof(adv_fields));

    adv_fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;

    // Primary Advertising: 128-bit Joy Service UUID
    adv_fields.uuids128 = (ble_uuid128_t *)&gatt_svr_svc_uuid;
    adv_fields.num_uuids128 = 1;
    adv_fields.uuids128_is_complete = 1;

    int rc = ble_gap_adv_set_fields(&adv_fields);
    if (rc != 0) {
        ESP_LOGE(TAG, "Failed to set advertising data; rc=%d", rc);
    }

    // Scan Response: Full Local Device Name (iOS/Android compatible)
    struct ble_hs_adv_fields rsp_fields;
    memset(&rsp_fields, 0, sizeof(rsp_fields));
    rsp_fields.name = (uint8_t *)dev_name;
    rsp_fields.name_len = strlen(dev_name);
    rsp_fields.name_is_complete = 1;

    rc = ble_gap_adv_rsp_set_fields(&rsp_fields);
    if (rc != 0) {
        ESP_LOGE(TAG, "Failed to set scan response data; rc=%d", rc);
    }

    struct ble_gap_adv_params adv_params;
    memset(&adv_params, 0, sizeof(adv_params));
    adv_params.conn_mode = BLE_GAP_CONN_MODE_UND;
    adv_params.disc_mode = BLE_GAP_DISC_MODE_GEN;

    rc = ble_gap_adv_start(s_own_addr_type, NULL, BLE_HS_FOREVER, &adv_params, gap_event_handler, NULL);
    if (rc != 0 && rc != BLE_HS_EALREADY) {
        ESP_LOGE(TAG, "Failed to start advertising; rc=%d", rc);
        return;
    }

    ESP_LOGI(TAG, "Started GAP advertising as %s with Joy Service UUID fe01", dev_name);
}

static void on_sync(void)
{
    int rc = ble_hs_util_ensure_addr(0);
    if (rc != 0) {
        ESP_LOGE(TAG, "Error ensuring address: rc=%d", rc);
        return;
    }

    rc = ble_hs_id_infer_auto(0, &s_own_addr_type);
    if (rc != 0) {
        ESP_LOGE(TAG, "Error determining address type: rc=%d", rc);
        return;
    }

    ESP_LOGI(TAG, "NimBLE host synced; ready for advertising");
    if (joy_ble_is_active()) {
        joy_ble_nimble_start_advertising();
    }
}

static void on_reset(int reason)
{
    ESP_LOGW(TAG, "NimBLE host reset; reason=%d", reason);
}

static void nimble_host_task(void *param)
{
    ESP_LOGI(TAG, "NimBLE Host Task Started");
    nimble_port_run();
    nimble_port_freertos_deinit();
}

esp_err_t joy_ble_nimble_init(void)
{
    if (s_nimble_started) return ESP_OK;

    esp_err_t ret = nimble_port_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to init NimBLE port: %s", esp_err_to_name(ret));
        return ret;
    }

    ble_hs_cfg.sync_cb = on_sync;
    ble_hs_cfg.reset_cb = on_reset;

    ble_svc_gap_init();
    ble_svc_gatt_init();

    int rc = ble_gatts_count_cfg(gatt_svr_svcs);
    if (rc != 0) {
        ESP_LOGE(TAG, "Failed to count GATT svcs; rc=%d", rc);
        return ESP_FAIL;
    }

    rc = ble_gatts_add_svcs(gatt_svr_svcs);
    if (rc != 0) {
        ESP_LOGE(TAG, "Failed to add GATT svcs; rc=%d", rc);
        return ESP_FAIL;
    }

    const joy_identity_t *id = joy_identity_get();
    char dev_name[32];
    snprintf(dev_name, sizeof(dev_name), "JOY-%.4s", id->provisioning_ref);
    ble_svc_gap_device_name_set(dev_name);

    s_nimble_started = true;
    nimble_port_freertos_init(nimble_host_task);

    ESP_LOGI(TAG, "NimBLE GATT Server initialized successfully");
    return ESP_OK;
}

void joy_ble_nimble_stop(void)
{
    if (!s_nimble_started) return;

    ESP_LOGI(TAG, "Stopping NimBLE advertising");
    ble_gap_adv_stop();
    s_conn_handle = BLE_HS_CONN_HANDLE_NONE;
}

bool joy_ble_nimble_is_connected(void)
{
    return s_conn_handle != BLE_HS_CONN_HANDLE_NONE;
}
