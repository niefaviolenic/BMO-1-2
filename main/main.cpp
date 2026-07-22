#include "display.h"
#include "audio.h"
#include "wakeword.h"
#include "button.h"
#include "wifi.h"
#include "state.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

extern "C" void app_main()
{
    display_init();
    display_sleep();

    audio_init();
    button_init();
    
    // Inisialisasi koneksi WiFi
    wifi_init();

    // Jalankan background task state machine orchestrator
    bmo_state_machine_init();

    wakeword_init();

    while (true)
    {
        button_update();
        vTaskDelay(pdMS_TO_TICKS(20));
    }
}
