#ifndef WIFI_H
#define WIFI_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

void wifi_init(void);
void wifi_connect_to_ap(const char *ssid, const char *password);
void wifi_mgr_handle_remote_config(const char *config_id, const char *ssid, const char *password);
bool wifi_mgr_is_switching(void);

#ifdef __cplusplus
}
#endif

#endif // WIFI_H
