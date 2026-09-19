#ifndef FACE_ASSETS_H
#define FACE_ASSETS_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint8_t asset_id;
    uint16_t width;
    uint16_t height;
    bool is_rle;
    size_t run_count;
    const uint16_t *data; // (run_length, color565) pairs
} face_asset_t;

const face_asset_t *face_assets_get(uint8_t asset_id);
size_t face_assets_get_count(void);

#ifdef __cplusplus
}
#endif

#endif // FACE_ASSETS_H
