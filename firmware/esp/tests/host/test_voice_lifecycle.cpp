#include <cassert>
#include <cstdio>
#include <cstring>
#include <cstdint>

#include "state.h"
#include "wakeword.h"
#include "display.h"
#include "playback.h"

// Mock tracking variables
static bool s_mock_start_recording_return = true;
static int s_mock_start_recording_calls = 0;
static int s_mock_reset_recording_calls = 0;
static int s_mock_upload_calls = 0;
static int s_mock_display_set_mode_calls = 0;
static DisplayMode s_last_display_mode = DisplayMode::IDLE;
static RecordingStatus s_current_recording_status = RecordingStatus::IDLE;
static size_t s_current_record_size = 0;
static bool s_mock_is_recording = false;
static bool s_capture_reserved_released = false;

// Mock display
void display_set_mode(DisplayMode mode) {
    s_mock_display_set_mode_calls++;
    s_last_display_mode = mode;
}

// Mock audio
void audio_startThinkingFillerLoop() {}
void audio_stopThinkingFillerLoop() {}
extern "C" {
void api_upload_audio_and_process() {
    s_mock_upload_calls++;
}
}

// Mock playback capture release
void playback_release_capture() {
    s_capture_reserved_released = true;
}

bool playback_try_reserve_capture(int64_t) {
    s_capture_reserved_released = false;
    return true;
}

// Mock wakeword functions
bool start_recording() {
    s_mock_start_recording_calls++;
    if (!s_mock_start_recording_return) {
        s_current_recording_status = RecordingStatus::FAILED;
        s_mock_is_recording = false;
        return false;
    }
    s_current_recording_status = RecordingStatus::ACTIVE;
    s_mock_is_recording = false; // complete immediately in step for test
    return true;
}

bool is_recording() {
    return s_mock_is_recording;
}

RecordingStatus get_recording_status() {
    return s_current_recording_status;
}

void abort_recording(const char *) {
    s_current_recording_status = RecordingStatus::ABORTED;
    s_mock_is_recording = false;
}

void reset_recording() {
    s_mock_reset_recording_calls++;
    s_current_recording_status = RecordingStatus::IDLE;
    s_current_record_size = WAV_HEADER_SAMPLES;
}

size_t get_record_size() {
    return s_current_record_size;
}

static void reset_mocks() {
    s_mock_start_recording_return = true;
    s_mock_start_recording_calls = 0;
    s_mock_reset_recording_calls = 0;
    s_mock_upload_calls = 0;
    s_mock_display_set_mode_calls = 0;
    s_last_display_mode = DisplayMode::IDLE;
    s_current_recording_status = RecordingStatus::IDLE;
    s_current_record_size = 0;
    s_mock_is_recording = false;
    s_capture_reserved_released = false;
    setState(JoyState::IDLE);
}

static void test_unconditional_recording_start_on_entry() {
    reset_mocks();
    // Seed recorder with stale COMPLETED state from previous turn
    s_current_recording_status = RecordingStatus::COMPLETED;
    s_current_record_size = 10000;

    // Trigger state machine to RECORDING
    setState(JoyState::RECORDING);
    assert(getState() == JoyState::RECORDING);

    // Run one step of the state machine
    joy_state_machine_step();

    // Must have called start_recording unconditionally, overwriting stale COMPLETED!
    assert(s_mock_start_recording_calls == 1);
    printf("  [PASS] test_unconditional_recording_start_on_entry\n");
}

static void test_start_recording_failure_resets_idle() {
    reset_mocks();
    s_mock_start_recording_return = false; // Force start failure

    setState(JoyState::RECORDING);
    joy_state_machine_step();

    // Must not upload, must reset to IDLE and release capture reservation
    assert(s_mock_start_recording_calls == 1);
    assert(s_mock_upload_calls == 0);
    assert(getState() == JoyState::IDLE);
    assert(s_capture_reserved_released);
    printf("  [PASS] test_start_recording_failure_resets_idle\n");
}

static void test_zero_samples_does_not_upload() {
    reset_mocks();
    // Normal start, but finishes with zero audio samples (header only)
    s_current_record_size = WAV_HEADER_SAMPLES;
    s_current_recording_status = RecordingStatus::COMPLETED;

    setState(JoyState::RECORDING);
    joy_state_machine_step();

    // Zero samples must NOT upload
    assert(s_mock_upload_calls == 0);
    assert(getState() == JoyState::IDLE);
    assert(s_capture_reserved_released);
    printf("  [PASS] test_zero_samples_does_not_upload\n");
}

static void test_valid_recording_uploads_and_resets() {
    reset_mocks();
    s_current_record_size = WAV_HEADER_SAMPLES + 24000; // 1.5s audio
    s_current_recording_status = RecordingStatus::COMPLETED;

    setState(JoyState::RECORDING);
    joy_state_machine_step();

    // Valid samples must trigger upload
    assert(s_mock_upload_calls == 1);
    // After upload finishes, orchestrator resets recording and returns to IDLE
    assert(s_mock_reset_recording_calls >= 1);
    assert(getState() == JoyState::IDLE);
    assert(s_capture_reserved_released);
    printf("  [PASS] test_valid_recording_uploads_and_resets\n");
}

static void test_preparing_playback_display_suppressed() {
    reset_mocks();
    assert(s_last_display_mode == DisplayMode::IDLE);
    int display_calls_before = s_mock_display_set_mode_calls;

    // Transition to PREPARING_PLAYBACK
    bool changed = trySetState(JoyState::IDLE, JoyState::PREPARING_PLAYBACK);
    assert(changed);
    assert(getState() == JoyState::PREPARING_PLAYBACK);

    // Display must be SUPPRESSED (no display_set_mode call, no SPI redraw!)
    assert(s_mock_display_set_mode_calls == display_calls_before);

    // Only when transitioning to THINKING does display update
    setState(JoyState::THINKING);
    assert(s_last_display_mode == DisplayMode::THINKING);
    printf("  [PASS] test_preparing_playback_display_suppressed\n");
}

int main() {
    printf("Running Host C++ Voice Lifecycle Tests...\n");
    test_unconditional_recording_start_on_entry();
    test_start_recording_failure_resets_idle();
    test_zero_samples_does_not_upload();
    test_valid_recording_uploads_and_resets();
    test_preparing_playback_display_suppressed();
    printf("All Host C++ Voice Lifecycle Tests Passed!\n");
    return 0;
}
