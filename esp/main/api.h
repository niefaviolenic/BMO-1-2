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

// Physical-control actions used by the BMO2 buttons.
bool api_request_pairing_mode();
void api_cancel_current_voice();
bool api_spotify_next();
bool api_spotify_previous();

#endif
