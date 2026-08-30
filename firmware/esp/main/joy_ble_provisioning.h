#ifndef JOY_BLE_PROVISIONING_H
#define JOY_BLE_PROVISIONING_H

#include <cstdint>
#include <cstddef>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

enum class JoyBleState
{
    UNPAIRED_IDLE,
    BOOTSTRAP_ADVERTISING,
    BOOTSTRAP_CONNECTED,
    PHYSICAL_CONFIRM_PENDING,
    PHYSICAL_CONFIRMED,
    WAITING_SECURE_START,
    SECURE_PROVISIONING_STARTING,
    RESERVED_SECURE,
    CLAIM_TOKEN_STORED,
    CLAIM_COMMITTED,
    WIFI_SELECTION_READY,
    WIFI_SCANNING,
    WAITING_WIFI_CREDENTIALS,
    WIFI_CONNECTING,
    PROVISIONED_READY_FOR_FINALIZATION,
    FINALIZING_WITH_BACKEND,
    RUNTIME_OPERATIONAL
};

esp_err_t joy_ble_provisioning_init(void);
void joy_ble_start_pairing_window(void);
void joy_ble_stop_provisioning(void);
bool joy_ble_is_active(void);
void joy_ble_on_physical_hold_2s(void);
void joy_ble_poll(void);
JoyBleState joy_ble_get_state(void);
esp_err_t joy_ble_finalize_with_backend(void);
const char *joy_ble_get_setup_nonce(void);
const char *joy_ble_get_session_id(void);
const char *joy_ble_get_confirm_nonce(void);
const char *joy_ble_get_physical_proof(void);
const char *joy_ble_get_commit_nonce(void);
const char *joy_ble_get_commit_proof(void);
esp_err_t joy_ble_arm_physical_confirmation(const char *session_id, const char *challenge);
esp_err_t joy_ble_handle_secure_start_payload(
    const char *res_id,
    const char *token,
    const char *start_proof,
    const char *ssid,
    const char *pass);
void joy_ble_set_state(JoyBleState new_state);

#ifdef __cplusplus
}
#endif

#endif // JOY_BLE_PROVISIONING_H
