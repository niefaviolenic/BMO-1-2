#ifndef BLE_FRAMING_H
#define BLE_FRAMING_H

#include <cstdint>
#include <cstddef>

#ifdef __cplusplus
extern "C" {
#endif

#define BLE_FRAME_HEADER_SIZE 8
#define BLE_FRAME_MAX_MESSAGE_BYTES 2048
#define BLE_FRAME_TIMEOUT_US (10LL * 1000000LL) // 10 seconds

#define BLE_FRAME_FLAG_START 0x01
#define BLE_FRAME_FLAG_END   0x02

typedef enum {
    BLE_FRAMING_NEED_MORE = 0,
    BLE_FRAMING_COMPLETE  = 1,
    BLE_FRAMING_ERR_HEADER = -1,
    BLE_FRAMING_ERR_OVERFLOW = -2,
    BLE_FRAMING_ERR_SEQUENCE = -3,
    BLE_FRAMING_ERR_EXPIRED = -4,
    BLE_FRAMING_ERR_CHR_MISMATCH = -5,
} ble_framing_result_t;

typedef struct {
    uint8_t  version;
    uint8_t  flags;
    uint16_t message_id;
    uint16_t offset;
    uint16_t total_bytes;
} ble_frame_header_t;

typedef struct {
    uint16_t current_chr_id;
    uint16_t current_msg_id;
    uint16_t total_bytes;
    uint16_t received_bytes;
    int64_t  last_chunk_us;
    bool     in_progress;
    char     buffer[BLE_FRAME_MAX_MESSAGE_BYTES + 1];
} ble_frame_assembler_t;

void ble_frame_assembler_init(ble_frame_assembler_t *assembler);
void ble_frame_assembler_reset(ble_frame_assembler_t *assembler);

ble_framing_result_t ble_frame_assembler_feed(
    ble_frame_assembler_t *assembler,
    uint16_t chr_id,
    const uint8_t *chunk_data,
    size_t chunk_len,
    int64_t now_us);

const char *ble_frame_assembler_get_message(const ble_frame_assembler_t *assembler);
size_t ble_frame_assembler_get_length(const ble_frame_assembler_t *assembler);

#ifdef __cplusplus
}
#endif

#endif // BLE_FRAMING_H
