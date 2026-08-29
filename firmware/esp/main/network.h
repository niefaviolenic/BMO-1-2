#ifndef NETWORK_H
#define NETWORK_H

#include <stdbool.h>

#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

#ifdef __cplusplus
extern "C" {
#endif

#define NETWORK_WIFI_CONNECTED_BIT   BIT0
#define NETWORK_GOT_IP_BIT           BIT1
#define NETWORK_BACKEND_CONNECTED_BIT BIT2
#define NETWORK_TIME_SYNCED_BIT      BIT3

void network_init(void);

void network_set_wifi_connected(bool connected);
void network_set_got_ip(bool got_ip);
void network_set_backend_connected(bool connected);
void network_set_time_synced(bool synced);

bool network_is_wifi_connected(void);
bool network_has_ip(void);
bool network_is_backend_connected(void);
bool network_has_valid_time(void);

EventBits_t network_wait_for_bits(EventBits_t bits, TickType_t timeout_ticks);
EventBits_t network_wait_for_got_ip(TickType_t timeout_ticks);
EventBits_t network_wait_for_valid_time(TickType_t timeout_ticks);

#ifdef __cplusplus
}
#endif

#endif
