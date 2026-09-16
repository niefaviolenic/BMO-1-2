#ifndef JOY_BLE_NIMBLE_H
#define JOY_BLE_NIMBLE_H

#include "esp_err.h"
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t joy_ble_nimble_init(void);
void joy_ble_nimble_start_advertising(void);
void joy_ble_nimble_stop(void);
bool joy_ble_nimble_is_connected(void);
void joy_ble_nimble_notify_proof(const char *confirm_nonce, const char *proof);
void joy_ble_nimble_notify_commit(const char *commit_nonce, const char *commit_proof, const char *status);
void joy_ble_nimble_notify_wifi_scan(const char *json_str);
#ifdef __cplusplus
}
#endif

#endif // JOY_BLE_NIMBLE_H
