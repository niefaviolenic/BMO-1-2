#ifndef SHIM_TASK_H
#define SHIM_TASK_H

#include <cstdint>

typedef uint32_t TickType_t;
typedef void *TaskHandle_t;
typedef int BaseType_t;
#define pdPASS 1
#define pdFAIL 0

extern "C" {
inline TickType_t xTaskGetTickCount() {
    static TickType_t s_ticks = 0;
    return s_ticks++;
}

inline void vTaskDelay(TickType_t) {}
inline BaseType_t xTaskCreateWithCaps(void (*)(void*), const char*, uint32_t, void*, int, TaskHandle_t*, uint32_t) {
    return pdPASS;
}
}

#define pdMS_TO_TICKS(ms) ((TickType_t)(ms))
#define portTICK_PERIOD_MS 1

#endif
