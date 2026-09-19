#ifndef WIFI_H
#define WIFI_H

#include <stdbool.h>
#include <stdint.h>
#include "esp_err.h"
#ifdef __cplusplus
extern "C" {
#endif

void wifi_init(void);
void wifi_connect_to_ap(const char *ssid, const char *password);
void wifi_poll(void);
esp_err_t wifi_paged_scan_schedule(uint32_t scan_id);
esp_err_t wifi_paged_scan_select_page(uint32_t scan_id, uint16_t index);
char *wifi_paged_scan_get_page_json(void);
void wifi_paged_scan_on_scan_done(uint32_t scan_status);
#ifdef __cplusplus
}
#endif

#endif // WIFI_H
