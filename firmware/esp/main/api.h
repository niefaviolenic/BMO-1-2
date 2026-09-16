#ifndef API_H
#define API_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

void api_init(void);
void api_upload_audio_and_process(void);
bool api_ws_is_connected(void);
bool api_ws_is_authenticated(void);
bool api_ws_authentication_is_blocked(void);
void api_ws_reset_authentication_blocked(void);
void api_spotify_queue_action(int action_type);


#ifdef __cplusplus
}
#endif

#endif
