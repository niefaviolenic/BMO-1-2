#include "state.h"
#include "display.h"
#include "audio.h"
#include "api.h"
#include "wakeword.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

static const char *TAG = "STATE";

BMOState currentState = BMOState::SLEEP;

void setState(BMOState state)
{
    currentState = state;
    ESP_LOGI(TAG, "State changed to %d", (int)state);

    if (state == BMOState::SLEEP)
    {
        display_sleep();
    }
}

BMOState getState()
{
    return currentState;
}

static void bmo_state_machine_task(void *pvParameters)
{
    ESP_LOGI(TAG, "State machine orchestrator task started");

    while (true)
    {
        BMOState current = getState();

        switch (current)
        {
            case BMOState::SLEEP:
                // Menunggu trigger dari Wake Word atau Touch Sensor
                vTaskDelay(pdMS_TO_TICKS(100));
                break;

            case BMOState::WAKE:
                ESP_LOGI(TAG, "Entering WAKE state");
                display_face(FACE_EXCITED);
                audio_playHello();
                setState(BMOState::LISTENING);
                break;

            case BMOState::LISTENING:
                ESP_LOGI(TAG, "Entering LISTENING state");
                display_face(FACE_CUTE);
                start_recording();
                while (is_recording())
                {
                    vTaskDelay(pdMS_TO_TICKS(50));
                }
                setState(BMOState::THINKING);
                break;

            case BMOState::THINKING:
                ESP_LOGI(TAG, "Entering THINKING state");
                display_face(FACE_CONFUSED);
                api_send_audio_and_play();
                // Setelah selesai memutar respon atau jika error, kembali ke SLEEP
                setState(BMOState::SLEEP);
                break;

            case BMOState::SPEAKING:
                // SPEAKING diatur oleh pemutaran audio di api_send_audio_and_play()
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