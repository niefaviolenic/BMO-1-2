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

void setState(BMOState state)
{
    portENTER_CRITICAL(&state_mux);
    currentState = state;
    portEXIT_CRITICAL(&state_mux);

    ESP_LOGI(TAG, "State changed to %d", (int)state);

    switch (state) {
        case BMOState::IDLE:
            display_set_mode(DisplayMode::IDLE);
            break;
        case BMOState::RECORDING:
            // Recording adalah state internal, display tetap IDLE (Hardware Contract v1.0.5)
            display_set_mode(DisplayMode::IDLE);
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
                vTaskDelay(pdMS_TO_TICKS(100));
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

                    vTaskDelay(pdMS_TO_TICKS(50));
                }

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
