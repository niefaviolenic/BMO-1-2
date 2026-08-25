#ifndef AUDIO_H
#define AUDIO_H

#include <stdint.h>
#include <stddef.h>

void audio_init();

void audio_playHello();

// Short musical cue used when the device changes into an active expression
// before microphone capture begins.
void audio_playExpressionChange();

// Play the embedded spoken phrase assigned to the selected face (0..9),
// including "aku happy" for FACE_HAPPY and "aku sedih" for FACE_SAD.
// Falls back to the short melody when the requested clip is unavailable.
void audio_playExpressionAudio(int expression_index);

void audio_setVolume(int vol);

int audio_getVolume();

void audio_adjustVolume(int delta);

void audio_play_pcm(const int16_t *mono_samples, size_t sample_count);

bool audio_play_raw(const int16_t *samples, size_t sample_count, int channels, int sample_rate);
bool audio_set_sample_rate(uint32_t sample_rate);
void audio_play_error();

#endif
