#ifndef WAKEWORD_H
#define WAKEWORD_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#define WAV_HEADER_SAMPLES 22  // Number of int16 samples used by WAV header

enum class RecordingStatus : uint8_t
{
    IDLE,
    ACTIVE,
    COMPLETED,
    FAILED,
    ABORTED
};

void wakeword_init();
bool wakeword_task();

bool start_recording();
bool is_recording();
RecordingStatus get_recording_status();
void abort_recording(const char *reason);
int16_t *get_record_buffer();
size_t get_record_size();

#endif
