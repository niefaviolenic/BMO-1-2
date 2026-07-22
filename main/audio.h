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

#endif
