#ifndef DISPLAY_H
#define DISPLAY_H

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
    THINKING,
    SPEAKING,
    ERROR
};

void display_init();

void display_sleep();

void display_face(Face face);

void display_set_mode(DisplayMode mode);

bool display_set_pairing_code(const char code[7]);

void display_clear_pairing_code();

bool display_pairing_code_is_visible();

void display_test_pattern();

#endif
