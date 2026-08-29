#include "joy_identity.h"

#include <cstring>
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include "esp_random.h"

static const char *TAG = "JOY_IDENTITY";

static joy_identity_t s_identity = {};
static joy_runtime_creds_t s_runtime = {};
static bool s_initialized = false;

static void generate_default_identity(void)
{
    // Generate deterministic/unique default for uninitialized units
    snprintf(s_identity.hardware_id, sizeof(s_identity.hardware_id), "joy_%08lx-%04lx-%04lx-%04lx-%012llx",
             (unsigned long)esp_random(),
             (unsigned long)(esp_random() & 0xFFFF),
             (unsigned long)((esp_random() & 0x0FFF) | 0x4000),
             (unsigned long)((esp_random() & 0x3FFF) | 0x8000),
             (unsigned long long)(((uint64_t)esp_random() << 32) | esp_random()) & 0xFFFFFFFFFFFFULL);

    const char base32_chars[] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (int i = 0; i < 8; i++) {
        s_identity.provisioning_ref[i] = base32_chars[esp_random() % (sizeof(base32_chars) - 1)];
    }
    s_identity.provisioning_ref[8] = '\0';

    esp_fill_random(s_identity.manufacturing_secret, sizeof(s_identity.manufacturing_secret));
    esp_fill_random(s_identity.provisioning_root_secret, sizeof(s_identity.provisioning_root_secret));
    strncpy(s_identity.hardware_revision, "revA", sizeof(s_identity.hardware_revision));
    s_identity.reset_epoch = 0;
}

esp_err_t joy_identity_init(void)
{
    if (s_initialized) return ESP_OK;

    nvs_handle_t factory_handle;
    esp_err_t err = nvs_open("joy_factory", NVS_READWRITE, &factory_handle);
    if (err == ESP_OK) {
        size_t str_len = sizeof(s_identity.hardware_id);
        if (nvs_get_str(factory_handle, "hw_id", s_identity.hardware_id, &str_len) != ESP_OK) {
            generate_default_identity();
            nvs_set_str(factory_handle, "hw_id", s_identity.hardware_id);
            nvs_set_str(factory_handle, "prov_ref", s_identity.provisioning_ref);
            nvs_set_blob(factory_handle, "mfg_sec", s_identity.manufacturing_secret, sizeof(s_identity.manufacturing_secret));
            nvs_set_blob(factory_handle, "root_sec", s_identity.provisioning_root_secret, sizeof(s_identity.provisioning_root_secret));
            nvs_set_str(factory_handle, "hw_rev", s_identity.hardware_revision);
            nvs_set_u32(factory_handle, "reset_epoch", s_identity.reset_epoch);
            nvs_commit(factory_handle);
            ESP_LOGI(TAG, "Initialized new factory identity: hw_id=%s, ref=%s", s_identity.hardware_id, s_identity.provisioning_ref);
        } else {
            str_len = sizeof(s_identity.provisioning_ref);
            nvs_get_str(factory_handle, "prov_ref", s_identity.provisioning_ref, &str_len);
            size_t blob_len = sizeof(s_identity.manufacturing_secret);
            nvs_get_blob(factory_handle, "mfg_sec", s_identity.manufacturing_secret, &blob_len);
            blob_len = sizeof(s_identity.provisioning_root_secret);
            nvs_get_blob(factory_handle, "root_sec", s_identity.provisioning_root_secret, &blob_len);
            str_len = sizeof(s_identity.hardware_revision);
            nvs_get_str(factory_handle, "hw_rev", s_identity.hardware_revision, &str_len);
            nvs_get_u32(factory_handle, "reset_epoch", &s_identity.reset_epoch);
            ESP_LOGI(TAG, "Loaded existing factory identity: hw_id=%s, ref=%s, epoch=%lu",
                     s_identity.hardware_id, s_identity.provisioning_ref, (unsigned long)s_identity.reset_epoch);
        }
        nvs_close(factory_handle);
    } else {
        generate_default_identity();
        ESP_LOGW(TAG, "Failed to open joy_factory NVS namespace, using in-memory identity");
    }

    nvs_handle_t runtime_handle;
    err = nvs_open("joy_runtime", NVS_READWRITE, &runtime_handle);
    if (err == ESP_OK) {
        size_t str_len = sizeof(s_runtime.wifi_ssid);
        if (nvs_get_str(runtime_handle, "wifi_ssid", s_runtime.wifi_ssid, &str_len) == ESP_OK) {
            str_len = sizeof(s_runtime.wifi_password);
            nvs_get_str(runtime_handle, "wifi_pass", s_runtime.wifi_password, &str_len);
            str_len = sizeof(s_runtime.runtime_device_token);
            if (nvs_get_str(runtime_handle, "dev_token", s_runtime.runtime_device_token, &str_len) == ESP_OK &&
                strlen(s_runtime.runtime_device_token) > 0) {
                s_runtime.is_provisioned = true;
            }
        }
        str_len = sizeof(s_runtime.pending_reservation_id);
        if (nvs_get_str(runtime_handle, "res_id", s_runtime.pending_reservation_id, &str_len) == ESP_OK) {
            str_len = sizeof(s_runtime.pending_claim_token);
            nvs_get_str(runtime_handle, "claim_tok", s_runtime.pending_claim_token, &str_len);
            s_runtime.pending_finalize = true;
        }
        nvs_close(runtime_handle);
    }

    s_initialized = true;
    return ESP_OK;
}

const joy_identity_t *joy_identity_get(void)
{
    if (!s_initialized) joy_identity_init();
    return &s_identity;
}

const joy_runtime_creds_t *joy_runtime_get(void)
{
    if (!s_initialized) joy_identity_init();
    return &s_runtime;
}

esp_err_t joy_runtime_save_wifi(const char *ssid, const char *password)
{
    if (!ssid) return ESP_ERR_INVALID_ARG;
    strncpy(s_runtime.wifi_ssid, ssid, sizeof(s_runtime.wifi_ssid) - 1);
    s_runtime.wifi_ssid[sizeof(s_runtime.wifi_ssid) - 1] = '\0';

    if (password) {
        strncpy(s_runtime.wifi_password, password, sizeof(s_runtime.wifi_password) - 1);
        s_runtime.wifi_password[sizeof(s_runtime.wifi_password) - 1] = '\0';
    } else {
        s_runtime.wifi_password[0] = '\0';
    }

    nvs_handle_t handle;
    esp_err_t err = nvs_open("joy_runtime", NVS_READWRITE, &handle);
    if (err != ESP_OK) return err;

    nvs_set_str(handle, "wifi_ssid", s_runtime.wifi_ssid);
    nvs_set_str(handle, "wifi_pass", s_runtime.wifi_password);
    nvs_commit(handle);
    nvs_close(handle);

    ESP_LOGI(TAG, "Saved Wi-Fi credentials for SSID \"%s\"", s_runtime.wifi_ssid);
    return ESP_OK;
}

esp_err_t joy_runtime_save_pending_claim(const char *reservation_id, const char *claim_token)
{
    if (!reservation_id || !claim_token) return ESP_ERR_INVALID_ARG;
    strncpy(s_runtime.pending_reservation_id, reservation_id, sizeof(s_runtime.pending_reservation_id) - 1);
    s_runtime.pending_reservation_id[sizeof(s_runtime.pending_reservation_id) - 1] = '\0';

    strncpy(s_runtime.pending_claim_token, claim_token, sizeof(s_runtime.pending_claim_token) - 1);
    s_runtime.pending_claim_token[sizeof(s_runtime.pending_claim_token) - 1] = '\0';
    s_runtime.pending_finalize = true;

    nvs_handle_t handle;
    esp_err_t err = nvs_open("joy_runtime", NVS_READWRITE, &handle);
    if (err != ESP_OK) return err;

    nvs_set_str(handle, "res_id", s_runtime.pending_reservation_id);
    nvs_set_str(handle, "claim_tok", s_runtime.pending_claim_token);
    nvs_commit(handle);
    nvs_close(handle);

    ESP_LOGI(TAG, "Saved pending claim reservation: %s", s_runtime.pending_reservation_id);
    return ESP_OK;
}

esp_err_t joy_runtime_save_token(const char *runtime_device_token)
{
    if (!runtime_device_token) return ESP_ERR_INVALID_ARG;
    strncpy(s_runtime.runtime_device_token, runtime_device_token, sizeof(s_runtime.runtime_device_token) - 1);
    s_runtime.runtime_device_token[sizeof(s_runtime.runtime_device_token) - 1] = '\0';
    s_runtime.is_provisioned = true;
    s_runtime.pending_finalize = false;

    nvs_handle_t handle;
    esp_err_t err = nvs_open("joy_runtime", NVS_READWRITE, &handle);
    if (err != ESP_OK) return err;

    nvs_set_str(handle, "dev_token", s_runtime.runtime_device_token);
    nvs_erase_key(handle, "res_id");
    nvs_erase_key(handle, "claim_tok");
    nvs_commit(handle);
    nvs_close(handle);

    ESP_LOGI(TAG, "Saved runtime device token; provisioning complete");
    return ESP_OK;
}

esp_err_t joy_runtime_clear_pending_claim(void)
{
    s_runtime.pending_reservation_id[0] = '\0';
    s_runtime.pending_claim_token[0] = '\0';
    s_runtime.pending_finalize = false;

    nvs_handle_t handle;
    esp_err_t err = nvs_open("joy_runtime", NVS_READWRITE, &handle);
    if (err != ESP_OK) return err;

    nvs_erase_key(handle, "res_id");
    nvs_erase_key(handle, "claim_tok");
    nvs_commit(handle);
    nvs_close(handle);
    return ESP_OK;
}

esp_err_t joy_identity_increment_reset_epoch(uint32_t *new_epoch_out)
{
    s_identity.reset_epoch += 1;
    if (new_epoch_out) *new_epoch_out = s_identity.reset_epoch;

    nvs_handle_t handle;
    esp_err_t err = nvs_open("joy_factory", NVS_READWRITE, &handle);
    if (err == ESP_OK) {
        nvs_set_u32(handle, "reset_epoch", s_identity.reset_epoch);
        nvs_commit(handle);
        nvs_close(handle);
    }

    ESP_LOGI(TAG, "Incremented reset_epoch to %lu", (unsigned long)s_identity.reset_epoch);
    return ESP_OK;
}

esp_err_t joy_runtime_clear_provisioning(void)
{
    memset(&s_runtime, 0, sizeof(s_runtime));

    nvs_handle_t handle;
    esp_err_t err = nvs_open("joy_runtime", NVS_READWRITE, &handle);
    if (err == ESP_OK) {
        nvs_erase_all(handle);
        nvs_commit(handle);
        nvs_close(handle);
    }

    ESP_LOGI(TAG, "Cleared runtime provisioning data");
    return ESP_OK;
}
