#include "ble_framing.h"
#include <cstring>

void ble_frame_assembler_init(ble_frame_assembler_t *assembler)
{
    if (!assembler) return;
    ble_frame_assembler_reset(assembler);
}

void ble_frame_assembler_reset(ble_frame_assembler_t *assembler)
{
    if (!assembler) return;
    assembler->current_chr_id = 0;
    assembler->current_msg_id = 0;
    assembler->total_bytes = 0;
    assembler->received_bytes = 0;
    assembler->last_chunk_us = 0;
    assembler->in_progress = false;
    assembler->buffer[0] = '\0';
}

ble_framing_result_t ble_frame_assembler_feed(
    ble_frame_assembler_t *assembler,
    uint16_t chr_id,
    const uint8_t *chunk_data,
    size_t chunk_len,
    int64_t now_us)
{
    if (!assembler || !chunk_data) return BLE_FRAMING_ERR_HEADER;

    if (chunk_len < BLE_FRAME_HEADER_SIZE) {
        return BLE_FRAMING_ERR_HEADER;
    }

    uint8_t version = chunk_data[0];
    uint8_t flags = chunk_data[1];
    uint16_t msg_id = (uint16_t)chunk_data[2] | ((uint16_t)chunk_data[3] << 8);
    uint16_t offset = (uint16_t)chunk_data[4] | ((uint16_t)chunk_data[5] << 8);
    uint16_t total = (uint16_t)chunk_data[6] | ((uint16_t)chunk_data[7] << 8);

    if (version != 1) {
        return BLE_FRAMING_ERR_HEADER;
    }

    if (flags & ~(BLE_FRAME_FLAG_START | BLE_FRAME_FLAG_END)) {
        return BLE_FRAMING_ERR_HEADER;
    }

    if (total == 0 || total > BLE_FRAME_MAX_MESSAGE_BYTES) {
        return BLE_FRAMING_ERR_OVERFLOW;
    }

    size_t payload_len = chunk_len - BLE_FRAME_HEADER_SIZE;
    if ((size_t)offset + payload_len > (size_t)total) {
        return BLE_FRAMING_ERR_OVERFLOW;
    }

    // Check expiration of incomplete in-progress assembly
    if (assembler->in_progress && (now_us - assembler->last_chunk_us > BLE_FRAME_TIMEOUT_US)) {
        ble_frame_assembler_reset(assembler);
    }

    if (flags & BLE_FRAME_FLAG_START) {
        if (offset != 0) {
            return BLE_FRAMING_ERR_SEQUENCE;
        }
        ble_frame_assembler_reset(assembler);
        assembler->in_progress = true;
        assembler->current_chr_id = chr_id;
        assembler->current_msg_id = msg_id;
        assembler->total_bytes = total;
        assembler->received_bytes = 0;
    } else {
        if (!assembler->in_progress) {
            return BLE_FRAMING_ERR_SEQUENCE;
        }
        if (assembler->current_chr_id != chr_id) {
            return BLE_FRAMING_ERR_CHR_MISMATCH;
        }
        if (assembler->current_msg_id != msg_id) {
            return BLE_FRAMING_ERR_SEQUENCE;
        }
        if (assembler->total_bytes != total) {
            return BLE_FRAMING_ERR_SEQUENCE;
        }
        if (assembler->received_bytes != offset) {
            return BLE_FRAMING_ERR_SEQUENCE;
        }
    }

    if (payload_len > 0) {
        memcpy(assembler->buffer + offset, chunk_data + BLE_FRAME_HEADER_SIZE, payload_len);
    }
    assembler->received_bytes = (uint16_t)(offset + payload_len);
    assembler->last_chunk_us = now_us;

    if (flags & BLE_FRAME_FLAG_END) {
        if (assembler->received_bytes != assembler->total_bytes) {
            return BLE_FRAMING_ERR_SEQUENCE;
        }
        assembler->buffer[assembler->total_bytes] = '\0';
        assembler->in_progress = false;
        return BLE_FRAMING_COMPLETE;
    }

    return BLE_FRAMING_NEED_MORE;
}

const char *ble_frame_assembler_get_message(const ble_frame_assembler_t *assembler)
{
    if (!assembler) return "";
    return assembler->buffer;
}

size_t ble_frame_assembler_get_length(const ble_frame_assembler_t *assembler)
{
    if (!assembler) return 0;
    return assembler->received_bytes;
}
