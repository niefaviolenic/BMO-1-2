#ifndef API_H
#define API_H

#include <stdbool.h>

// Inisialisasi koneksi WebSocket & HTTP
void api_init();

// Menangani upload rekaman lokal dan memproses event WS/HTTP secara blocking
void api_upload_audio_and_process();

// Mendapatkan status koneksi WebSocket
bool api_ws_is_connected();
bool api_ws_is_authenticated();
bool api_ws_authentication_is_blocked();
bool api_ws_send_wifi_config_received(const char *config_id);
bool api_ws_send_wifi_config_result(const char *config_id, const char *status, int rssi, const char *reason);

#endif
