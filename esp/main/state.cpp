#include "state.h"
#include "display.h"
#include "audio.h"
#include "api.h"
#include "wakeword.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

#include <stdint.h>

static const char *TAG = "STATE";

static constexpr uint32_t RECORDING_STATE_WATCHDOG_MS = 65000;

JoyState currentState = JoyState::IDLE;
static portMUX_TYPE state_mux = portMUX_INITIALIZER_UNLOCKED;

static const char *state_name(JoyState state)
{
    switch(state)
    {
        case JoyState::IDLE: return "IDLE";
        case JoyState::RECORDING: return "RECORDING";
        case JoyState::THINKING: return "THINKING";
        case JoyState::SPEAKING: return "SPEAKING";
        case JoyState::ERROR_STATE: return "ERROR";
        default: return "UNKNOWN";
    }
}

static void apply_state_display(JoyState state)
{
    switch (state) {
        case JoyState::IDLE:
            display_set_mode(DisplayMode::IDLE);
            break;
        case JoyState::RECORDING:
            display_set_mode(DisplayMode::LISTENING);
            break;
        case JoyState::THINKING:
            display_set_mode(DisplayMode::THINKING);
            break;
        case JoyState::SPEAKING:
            display_set_mode(DisplayMode::SPEAKING);
            break;
        case JoyState::ERROR_STATE:
            display_set_mode(DisplayMode::ERROR);
            break;
    }
}

void setState(JoyState state)
{
    JoyState previous_state;

    portENTER_CRITICAL(&state_mux);
    previous_state = currentState;
    currentState = state;
    portEXIT_CRITICAL(&state_mux);

    if(previous_state != state)
    {
        ESP_LOGI(
            TAG,
            "State: %s -> %s",
            state_name(previous_state),
            state_name(state));
    }
    apply_state_display(state);
}

bool trySetState(JoyState expected, JoyState next)
{
    bool changed = false;
    JoyState actual_state;

    portENTER_CRITICAL(&state_mux);
    actual_state = currentState;
    if(actual_state == expected)
    {
        currentState = next;
        changed = true;
    }
    portEXIT_CRITICAL(&state_mux);

    if(!changed)
    {
        ESP_LOGW(
            TAG,
            "State transition rejected: expected=%s actual=%s next=%s",
            state_name(expected),
            state_name(actual_state),
            state_name(next));
        return false;
    }

    ESP_LOGI(
        TAG,
        "State: %s -> %s",
        state_name(expected),
        state_name(next));
    apply_state_display(next);

    return true;
}

JoyState getState()
{
    portENTER_CRITICAL(&state_mux);
    JoyState state = currentState;
    portEXIT_CRITICAL(&state_mux);
    return state;
}

static void joy_state_machine_task(void *pvParameters)
{
    ESP_LOGI(TAG, "State machine orchestrator task started");
    while (true)
    {
        JoyState current = getState();

        switch (current)
        {
            case JoyState::IDLE:
                // Menunggu trigger dari Wake Word (yang merubah state ke RECORDING)
                vTaskDelay(pdMS_TO_TICKS(20));
                break;

            case JoyState::RECORDING: {
                ESP_LOGI(TAG, "Entering RECORDING state");
                if(!start_recording())
                {
                    ESP_LOGE(
                        TAG,
                        "Recording start failed; upload skipped");
                    setState(JoyState::IDLE);
                    break;
                }

                TickType_t recording_wait_start = xTaskGetTickCount();
                while (is_recording())
                {
                    if((TickType_t)(xTaskGetTickCount() - recording_wait_start) >=
                       pdMS_TO_TICKS(RECORDING_STATE_WATCHDOG_MS))
                    {
                        ESP_LOGE(
                            TAG,
                            "Recording watchdog timeout; upload skipped");
                        abort_recording("state_watchdog_timeout");
                        break;
                    }

                    vTaskDelay(pdMS_TO_TICKS(10));
                }

                RecordingStatus recording_status =
                    get_recording_status();

                if(recording_status == RecordingStatus::COMPLETED &&
                   get_record_size() > WAV_HEADER_SAMPLES)
                {
                    // Phase 1 Thinking Transition: immediately switch expression to
                    // DisplayMode::THINKING (FACE_CONFUSED) when user finishes speaking,
                    // matching the thinking filler voice without flashing IDLE/HAPPY.
                    setState(JoyState::THINKING);
                    audio_startThinkingFillerLoop();
                    api_upload_audio_and_process();
                    audio_stopThinkingFillerLoop();
                }
                else
                {
                    display_set_mode(DisplayMode::IDLE);
                    ESP_LOGW(
                        TAG,
                        "Recording not uploadable: status=%d; upload skipped",
                        (int)recording_status);
                }
                setState(JoyState::IDLE);
                break;
            }

            case JoyState::THINKING:
                ESP_LOGI(TAG, "Entering THINKING state");
                audio_startThinkingFillerLoop();
                // api_upload_audio_and_process mengupload, menunggu WS audio_ready, 
                // memutar MP3 progresif secara blocking, dan mengirim completion events.
                api_upload_audio_and_process();
                audio_stopThinkingFillerLoop();
                setState(JoyState::IDLE);
                break;

            case JoyState::SPEAKING:
            case JoyState::ERROR_STATE:
                // State ini dikendalikan didalam api_upload_audio_and_process
                vTaskDelay(pdMS_TO_TICKS(100));
                break;
        }
    }
}

void joy_state_machine_init()
{
    xTaskCreate(
        joy_state_machine_task,
        "joy_state_task",
        8192,
        NULL,
        4,
        NULL);
}
