#ifndef JOY_IDENTITY_H
#define JOY_IDENTITY_H

#include <cstdint>
#include <cstddef>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

struct joy_identity_t
{
    char hardware_id[128];
    char provisioning_ref[9];
    uint8_t manufacturing_secret[32];
    uint8_t provisioning_root_secret[32];
    char hardware_revision[32];
    uint32_t reset_epoch;
};

struct joy_runtime_creds_t
{
    char wifi_ssid[33];
    char wifi_password[65];
    char runtime_device_token[128];
    bool is_provisioned;
    char pending_reservation_id[64];
    char pending_claim_token[64];
    bool pending_finalize;
};

esp_err_t joy_identity_init(void);
const joy_identity_t *joy_identity_get(void);
const joy_runtime_creds_t *joy_runtime_get(void);

esp_err_t joy_runtime_save_wifi(const char *ssid, const char *password);
esp_err_t joy_runtime_save_pending_claim(const char *reservation_id, const char *claim_token);
esp_err_t joy_runtime_save_token(const char *runtime_device_token);
esp_err_t joy_runtime_clear_pending_claim(void);
esp_err_t joy_identity_increment_reset_epoch(uint32_t *new_epoch_out);
esp_err_t joy_runtime_clear_provisioning(void);

#ifdef __cplusplus
}
#endif

#endif // JOY_IDENTITY_H
