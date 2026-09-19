#ifndef SHIM_ESP_HEAP_CAPS_H
#define SHIM_ESP_HEAP_CAPS_H

#include <cstdlib>
#include <cstdint>

#define MALLOC_CAP_SPIRAM 1
#define MALLOC_CAP_8BIT 2
#define MALLOC_CAP_INTERNAL 4
#define MALLOC_CAP_DMA 8

inline void *heap_caps_malloc(size_t size, uint32_t) {
    return malloc(size);
}

inline void *heap_caps_calloc(size_t n, size_t size, uint32_t) {
    return calloc(n, size);
}

inline void heap_caps_free(void *ptr) {
    free(ptr);
}

#endif
