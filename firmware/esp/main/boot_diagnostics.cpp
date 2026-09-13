#include "boot_diagnostics.h"

#include "esp_log.h"
#include "esp_system.h"
#include "nvs_flash.h"
#include "nvs.h"

static const char *TAG = "BOOT_DIAG";

esp_err_t boot_diagnostics_init(void)
{
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "NVS partition truncated or new version found, erasing...");
        ret = nvs_flash_erase();
        if (ret == ESP_OK) {
            ret = nvs_flash_init();
        }
    }
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize NVS flash: 0x%x (%s)", ret, esp_err_to_name(ret));
        return ret;
    }

    esp_reset_reason_t reason = esp_reset_reason();
    uint8_t brownout_seen = 0;

    nvs_handle_t handle;
    esp_err_t nvs_err = nvs_open("joy_boot", NVS_READWRITE, &handle);
    if (nvs_err == ESP_OK) {
        nvs_get_u8(handle, "brownout_seen", &brownout_seen);

        if (reason == ESP_RST_BROWNOUT) {
            if (brownout_seen == 0) {
                brownout_seen = 1;
                nvs_set_u8(handle, "brownout_seen", 1);
                nvs_commit(handle);
                ESP_LOGW(TAG, "Recorded historical brownout latch to NVS");
            }
        }
        nvs_close(handle);
    } else {
        ESP_LOGW(TAG, "Could not open joy_boot namespace in NVS: 0x%x (%s)", nvs_err, esp_err_to_name(nvs_err));
    }

    ESP_LOGI(TAG, "Boot diagnostics ready: reset_reason=%d brownout_latch=%d", (int)reason, (int)brownout_seen);
    return ESP_OK;
}
