#ifndef DISPLAY_H
#define DISPLAY_H
#include <time.h>

enum Face
{
    FACE_HAPPY,
    FACE_CUTE,
    FACE_EXCITED,
    FACE_SLEEPY,
    FACE_ANGRY,
    FACE_SAD,
    FACE_WINK,
    FACE_SURPRISED,
    FACE_LOVE,
    FACE_CONFUSED
};

enum class DisplayMode
{
    IDLE,
    LISTENING,
    THINKING,
    SPEAKING,
    ERROR
};

void display_init();

void display_sleep();

void display_face(Face face);

// Touch follows the Face declaration order and wraps after FACE_CONFUSED.
Face display_next_touch_face();
Face display_get_idle_face();

// Non-blocking five-second shy interaction. This transient animation is not
// part of the persistent GPIO17 face cycle.
bool display_start_shy();
void display_cancel_shy();
bool display_is_shy_active();

void display_set_mode(DisplayMode mode);

bool display_set_pairing_code(const char code[7], time_t expires_at_epoch);

void display_update_pairing_countdown();

void display_clear_pairing_code();

bool display_pairing_code_is_visible();

bool display_set_qr_code(const char *qr_payload, time_t expires_at_epoch);

void display_update_qr_countdown();

void display_clear_qr_code();

bool display_qr_code_is_visible();

void display_test_pattern();

#endif
