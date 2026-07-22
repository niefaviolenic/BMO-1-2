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

void display_init();

void display_sleep();

void display_face(Face face);

void display_test_pattern();

#endif
