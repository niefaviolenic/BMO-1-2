#ifndef AUDIO_H
#define AUDIO_H

#include <stdint.h>
#include <stddef.h>

#define SPEAKER_DEFAULT_VOLUME 100

void audio_init();

void audio_playHello();

// Short pleasant wake-up acknowledgment cue ("heem" / rising earcon)
// played when the wake word ("Hi Joy") is detected.
// Synchronous direct playback:
void audio_playWakeAck();
// Non-blocking asynchronous trigger dispatched to dedicated worker task on Core 0:
void audio_triggerWakeAck();

// Short musical cue used when the device changes into an active expression
// before microphone capture begins.
void audio_playExpressionChange();

// Play the embedded spoken phrase assigned to the selected face (0..9),
// including "aku happy" for FACE_HAPPY and "aku sedih" for FACE_SAD.
// Falls back to the short melody when the requested clip is unavailable.
void audio_playExpressionAudio(int expression_index);

// Play a dynamic thinking filler phrase (0..4) or random thinking filler
// when voice capture finishes and backend processing begins.
void audio_playThinkingFiller(int index);
void audio_playRandomThinkingFiller();

void audio_setVolume(int vol);

int audio_getVolume();

void audio_adjustVolume(int delta);

void audio_play_pcm(const int16_t *mono_samples, size_t sample_count);

bool audio_play_raw(const int16_t *samples, size_t sample_count, int channels, int sample_rate);
bool audio_set_sample_rate(uint32_t sample_rate);
void audio_play_error();

#endif
