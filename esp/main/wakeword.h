#ifndef WAKEWORD_H
#define WAKEWORD_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#define WAV_HEADER_SAMPLES 22  // Number of int16 samples used by WAV header

// Digital gain settings for far-field microphone optimization (INMP441 MEMS)
// Boost multiplier: 2.5x (~+8dB boost) using fixed-point numerator / denominator
#ifndef MIC_GAIN_NUMERATOR
#define MIC_GAIN_NUMERATOR 5
#endif

#ifndef MIC_GAIN_DENOMINATOR
#define MIC_GAIN_DENOMINATOR 2
#endif

#ifndef MIC_DIGITAL_GAIN_FACTOR
#define MIC_DIGITAL_GAIN_FACTOR 2.5f
#endif

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
