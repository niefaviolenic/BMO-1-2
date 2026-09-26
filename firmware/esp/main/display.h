#ifndef DISPLAY_H
#define DISPLAY_H
#include <time.h>
#include <stdint.h>

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
    FACE_CONFUSED,
    FACE_DEAD
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

// Set the persistent idle face and render it immediately when idle.
void display_set_idle_face(Face face);

// Touch follows the Face declaration order and wraps after FACE_CONFUSED.
Face display_next_touch_face();
Face display_get_idle_face();

// Non-blocking five-second shy interaction. This transient animation is not
// part of the persistent GPIO17 face cycle.
bool display_start_shy();
void display_cancel_shy();
bool display_is_shy_active();

// Unpaired auto-revert interaction helpers
bool display_is_unpaired_revert_active();
void display_cancel_unpaired_revert();
void display_trigger_unpaired_revert();

void display_set_mode(DisplayMode mode);

bool display_set_pairing_code(const char code[7], time_t expires_at_epoch);

void display_update_pairing_countdown();

void display_clear_pairing_code();

bool display_pairing_code_is_visible();

bool display_set_qr_code(const char *qr_payload, time_t expires_at_epoch);

void display_update_qr_countdown();

void display_clear_qr_code();

bool display_qr_code_is_visible();

// BLE Pairing UI with Bluetooth logo and countdown timer (seconds remaining)
bool display_show_ble_pairing(int remaining_seconds);
void display_update_ble_countdown(int remaining_seconds);
void display_hide_ble_pairing();
bool display_ble_pairing_is_visible();

void display_test_pattern();
void display_render_asset(uint8_t asset_id);
void display_trigger_touch_overlay();
void display_trigger_expression_overlay();
void display_trigger_expression_test(int expression_index);
void display_trigger_ble_discovery();
void display_trigger_ble_connected();
void display_trigger_ble_proof_accepted();
void display_trigger_provisioning_success();
void display_trigger_ble_stop();
#endif
