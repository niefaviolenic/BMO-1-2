#ifndef AUDIO_H
#define AUDIO_H

#include <stdint.h>
#include <stddef.h>

void audio_init();

void audio_playHello();

void audio_setVolume(int vol);

int audio_getVolume();

void audio_adjustVolume(int delta);

void audio_play_pcm(const int16_t *mono_samples, size_t sample_count);

void audio_play_raw(const int16_t *samples, size_t sample_count, int channels, int sample_rate);
void audio_set_sample_rate(uint32_t sample_rate);
void audio_play_error();

#endif
