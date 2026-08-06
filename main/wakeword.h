#ifndef WAKEWORD_H
#define WAKEWORD_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#define WAV_HEADER_SAMPLES 22  // Number of int16 samples used by WAV header

void wakeword_init();
void wakeword_task();

void start_recording();
bool is_recording();
int16_t *get_record_buffer();
size_t get_record_size();

#endif