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

BMOState currentState = BMOState::IDLE;
static portMUX_TYPE state_mux = portMUX_INITIALIZER_UNLOCKED;

static const char *state_name(BMOState state)
{
    switch(state)
    {
        case BMOState::IDLE: return "IDLE";
        case BMOState::RECORDING: return "RECORDING";
        case BMOState::THINKING: return "THINKING";
        case BMOState::SPEAKING: return "SPEAKING";
        case BMOState::ERROR_STATE: return "ERROR";
        default: return "UNKNOWN";
    }
}

static void apply_state_display(BMOState state)
{
    switch (state) {
        case BMOState::IDLE:
            display_set_mode(DisplayMode::IDLE);
            break;
        case BMOState::RECORDING:
            display_set_mode(DisplayMode::LISTENING);
            break;
        case BMOState::THINKING:
            display_set_mode(DisplayMode::THINKING);
            break;
        case BMOState::SPEAKING:
            display_set_mode(DisplayMode::SPEAKING);
            break;
        case BMOState::ERROR_STATE:
            display_set_mode(DisplayMode::ERROR);
            break;
    }
}

void setState(BMOState state)
{
    BMOState previous_state;

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

bool trySetState(BMOState expected, BMOState next)
{
    bool changed = false;
    BMOState actual_state;

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

BMOState getState()
{
    portENTER_CRITICAL(&state_mux);
    BMOState state = currentState;
    portEXIT_CRITICAL(&state_mux);
    return state;
}

static void bmo_state_machine_task(void *pvParameters)
{
    ESP_LOGI(TAG, "State machine orchestrator task started");

    while (true)
    {
        BMOState current = getState();

        switch (current)
        {
            case BMOState::IDLE:
                // Menunggu trigger dari Wake Word (yang merubah state ke RECORDING)
                vTaskDelay(pdMS_TO_TICKS(20));
                break;

            case BMOState::RECORDING: {
                ESP_LOGI(TAG, "Entering RECORDING state");
                if(!start_recording())
                {
                    ESP_LOGE(
                        TAG,
                        "Recording start failed; upload skipped");
                    setState(BMOState::IDLE);
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

                // Recording is terminal now; release the local listening UI
                // before any backend request can take over with thinking.
                display_set_mode(DisplayMode::IDLE);

                RecordingStatus recording_status =
                    get_recording_status();

                if(recording_status == RecordingStatus::COMPLETED &&
                   get_record_size() > WAV_HEADER_SAMPLES)
                {
                    api_upload_audio_and_process();
                }
                else
                {
                    ESP_LOGW(
                        TAG,
                        "Recording not uploadable: status=%d; upload skipped",
                        (int)recording_status);
                }

                setState(BMOState::IDLE);
                break;
            }

            case BMOState::THINKING:
                ESP_LOGI(TAG, "Entering THINKING state");
                // api_upload_audio_and_process mengupload, menunggu WS audio_ready, 
                // memutar MP3 progresif secara blocking, dan mengirim completion events.
                api_upload_audio_and_process();
                setState(BMOState::IDLE);
                break;

            case BMOState::SPEAKING:
            case BMOState::ERROR_STATE:
                // State ini dikendalikan didalam api_upload_audio_and_process
                vTaskDelay(pdMS_TO_TICKS(100));
                break;
        }
    }
}

void bmo_state_machine_init()
{
    xTaskCreate(
        bmo_state_machine_task,
        "bmo_state_task",
        8192,
        NULL,
        4,
        NULL);
}
