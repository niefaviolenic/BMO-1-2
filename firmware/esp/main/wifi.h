#ifndef WIFI_H
#define WIFI_H

#include <stdbool.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif

void wifi_init(void);
void wifi_connect_to_ap(const char *ssid, const char *password);
void wifi_poll(void);
char *wifi_scan_nearby_aps_json(void);
void wifi_paged_scan_schedule(uint32_t scan_id);
void wifi_paged_scan_select_page(uint32_t scan_id, uint16_t index);
char *wifi_paged_scan_get_page_json(uint32_t scan_id);
void wifi_paged_scan_on_scan_done(void);
#ifdef __cplusplus
}
#endif

#endif // WIFI_H
