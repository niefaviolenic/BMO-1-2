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

#endif
