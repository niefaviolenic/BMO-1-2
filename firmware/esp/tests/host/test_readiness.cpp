#include <cassert>
#include <cstdio>
#include <cstring>
#include <vector>

#include "ble_framing.h"
#include "playback.h"

static void test_ble_framing_single_frame()
{
    ble_frame_assembler_t assembler;
    ble_frame_assembler_init(&assembler);

    const char *payload = "{\"status\":\"ok\",\"message\":\"hello\"}";
    size_t payload_len = strlen(payload);

    uint8_t packet[8 + 64];
    packet[0] = 1; // version
    packet[1] = BLE_FRAME_FLAG_START | BLE_FRAME_FLAG_END; // single frame has both
    packet[2] = 0x01; packet[3] = 0x00; // msg_id = 1
    packet[4] = 0x00; packet[5] = 0x00; // offset = 0
    packet[6] = (uint8_t)(payload_len & 0xFF); packet[7] = (uint8_t)((payload_len >> 8) & 0xFF);
    memcpy(packet + 8, payload, payload_len);

    ble_framing_result_t res = ble_frame_assembler_feed(&assembler, 0xFE03, packet, 8 + payload_len, 1000000LL);
    assert(res == BLE_FRAMING_COMPLETE);
    assert(strcmp(ble_frame_assembler_get_message(&assembler), payload) == 0);
    assert(ble_frame_assembler_get_length(&assembler) == payload_len);
    printf("  [PASS] test_ble_framing_single_frame\n");
}

static void test_ble_framing_multi_chunk()
{
    ble_frame_assembler_t assembler;
    ble_frame_assembler_init(&assembler);

    // Create a 200 byte payload
    char full_payload[201];
    for (int i = 0; i < 200; i++) {
        full_payload[i] = 'A' + (i % 26);
    }
    full_payload[200] = '\0';
    size_t total_bytes = 200;

    // Split into 3 chunks: 70, 70, 60 bytes
    size_t offsets[3] = {0, 70, 140};
    size_t chunk_sizes[3] = {70, 70, 60};
    uint8_t flags[3] = {BLE_FRAME_FLAG_START, 0, BLE_FRAME_FLAG_END};

    for (int i = 0; i < 3; i++) {
        uint8_t packet[8 + 70];
        packet[0] = 1;
        packet[1] = flags[i];
        packet[2] = 0x42; packet[3] = 0x00; // msg_id = 0x42
        packet[4] = (uint8_t)(offsets[i] & 0xFF); packet[5] = (uint8_t)((offsets[i] >> 8) & 0xFF);
        packet[6] = (uint8_t)(total_bytes & 0xFF); packet[7] = (uint8_t)((total_bytes >> 8) & 0xFF);
        memcpy(packet + 8, full_payload + offsets[i], chunk_sizes[i]);

        ble_framing_result_t res = ble_frame_assembler_feed(
            &assembler, 0xFE05, packet, 8 + chunk_sizes[i], 1000000LL + i * 50000LL);

        if (i < 2) {
            assert(res == BLE_FRAMING_NEED_MORE);
        } else {
            assert(res == BLE_FRAMING_COMPLETE);
        }
    }

    assert(strcmp(ble_frame_assembler_get_message(&assembler), full_payload) == 0);
    assert(ble_frame_assembler_get_length(&assembler) == total_bytes);
    printf("  [PASS] test_ble_framing_multi_chunk\n");
}

static void test_ble_framing_rejections()
{
    ble_frame_assembler_t assembler;
    ble_frame_assembler_init(&assembler);

    // 1. Header too small
    uint8_t small[5] = {1, 0, 0, 0, 0};
    assert(ble_frame_assembler_feed(&assembler, 0xFE03, small, 5, 1000LL) == BLE_FRAMING_ERR_HEADER);

    // 2. Version != 1
    uint8_t bad_ver[10] = {2, 0x01, 1, 0, 0, 0, 2, 0, 'a', 'b'};
    assert(ble_frame_assembler_feed(&assembler, 0xFE03, bad_ver, 10, 1000LL) == BLE_FRAMING_ERR_HEADER);

    // 3. Overflow > 2048 bytes
    uint8_t overflow[10] = {1, 0x01, 1, 0, 0, 0, 0x01, 0x09, 'a', 'b'}; // total = 2305 > 2048
    assert(ble_frame_assembler_feed(&assembler, 0xFE03, overflow, 10, 1000LL) == BLE_FRAMING_ERR_OVERFLOW);

    // 4. Start offset != 0
    uint8_t bad_offset[10] = {1, 0x01, 1, 0, 5, 0, 10, 0, 'a', 'b'};
    assert(ble_frame_assembler_feed(&assembler, 0xFE03, bad_offset, 10, 1000LL) == BLE_FRAMING_ERR_SEQUENCE);

    // 5. Gap / out-of-order chunk
    uint8_t start[12] = {1, 0x01, 1, 0, 0, 0, 8, 0, 'a', 'b', 'c', 'd'};
    assert(ble_frame_assembler_feed(&assembler, 0xFE03, start, 12, 1000LL) == BLE_FRAMING_NEED_MORE);

    uint8_t gap[12] = {1, 0x02, 1, 0, 6, 0, 8, 0, 'g', 'h'}; // offset = 6 instead of expected 4!
    assert(ble_frame_assembler_feed(&assembler, 0xFE03, gap, 10, 2000LL) == BLE_FRAMING_ERR_SEQUENCE);

    printf("  [PASS] test_ble_framing_rejections\n");
}

static void test_proactive_offer_and_ready()
{
    playback_init();

    ProactiveOffer offer{};
    strcpy(offer.delivery_id, "deliv-uuid-001");
    strcpy(offer.attempt_id, "att-uuid-001");
    strcpy(offer.offer_receipt, "rcpt-offer-abc");
    offer.expires_at_ms = 10000;

    ProactiveRejectReason rej = ProactiveRejectReason::BUSY;
    int64_t now_us = 1000000LL;
    bool accepted = playback_prepare_proactive_offer(offer, now_us, &rej);
    assert(accepted);

    // Duplicate or active offer while busy
    // Accept ready
    ProactiveAudioReady ready{};
    strcpy(ready.delivery_id, "deliv-uuid-001");
    strcpy(ready.attempt_id, "att-uuid-001");
    strcpy(ready.lease_id, "lease-uuid-999");
    strcpy(ready.audio_receipt, "rcpt-audio-xyz");
    strcpy(ready.audio_url, "https://api.personalbmo.web.id/audio/sample.mp3");
    ready.expires_at_ms = 50000;

    bool ready_started = playback_start_proactive_ready(ready, now_us + 100000LL);
    assert(ready_started);

    // Retrieve proactive details
    char deliv_id[37] = {0};
    char att_id[37] = {0};
    char lease_id[37] = {0};
    char audio_rcpt[513] = {0};

    bool got_details = playback_get_proactive_details(
        deliv_id, sizeof(deliv_id),
        att_id, sizeof(att_id),
        lease_id, sizeof(lease_id),
        audio_rcpt, sizeof(audio_rcpt)
    );
    assert(got_details);
    assert(strcmp(deliv_id, "deliv-uuid-001") == 0);
    assert(strcmp(att_id, "att-uuid-001") == 0);
    assert(strcmp(lease_id, "lease-uuid-999") == 0);
    assert(strcmp(audio_rcpt, "rcpt-audio-xyz") == 0);

    // Cancel must not deadlock
    ProactiveCancel cancel{};
    strcpy(cancel.delivery_id, "deliv-uuid-001");
    strcpy(cancel.attempt_id, "att-uuid-001");
    strcpy(cancel.lease_id, "lease-uuid-999");
    playback_cancel_proactive(cancel, now_us + 200000LL);

    PlaybackSnapshot snap = playback_get_snapshot();
    assert(!snap.active);
    assert(snap.last_terminal_proactive_result == PlaybackTerminalResult::CANCELLED);
    printf("  [PASS] test_proactive_offer_and_ready\n");
}

static void test_physical_arbitration_and_lazy_expiry()
{
    playback_init();
    int64_t now_us = 1000000LL;

    // 1. Capture reserved first -> offer rejected with BUSY
    bool cap1 = playback_try_reserve_capture(now_us);
    assert(cap1);

    ProactiveOffer offer1{};
    strcpy(offer1.delivery_id, "deliv-1");
    strcpy(offer1.attempt_id, "att-1");
    strcpy(offer1.offer_receipt, "rcpt-1");
    offer1.expires_at_ms = 10000;
    ProactiveRejectReason rej = ProactiveRejectReason::INVALID;
    bool accepted1 = playback_prepare_proactive_offer(offer1, now_us, &rej);
    assert(!accepted1);
    assert(rej == ProactiveRejectReason::BUSY);

    // Release capture
    playback_release_capture();

    // 2. Offer prepared first -> capture rejected
    bool accepted2 = playback_prepare_proactive_offer(offer1, now_us, &rej);
    assert(accepted2);

    bool cap2 = playback_try_reserve_capture(now_us);
    assert(!cap2); // blocked by active offer

    // 3. Lazy expiry: offer TTL is 5s (5000000 us). At now_us + 6000000 us, offer is expired
    bool cap3 = playback_try_reserve_capture(now_us + 6000000LL);
    assert(cap3); // Unblocked via lazy expiry!
    playback_release_capture();

    // 4. Cancel pending offer
    playback_prepare_proactive_offer(offer1, now_us + 7000000LL, &rej);
    bool cancelled_pending = playback_cancel_pending_offer("deliv-1", "att-1");
    assert(cancelled_pending);
    // After cancel, capture can be reserved immediately
    bool cap4 = playback_try_reserve_capture(now_us + 7000000LL);
    assert(cap4);
    playback_release_capture();

    printf("  [PASS] test_physical_arbitration_and_lazy_expiry\n");
}

int main()
{
    printf("Running Host C++ Readiness Tests...\n");
    test_ble_framing_single_frame();
    test_ble_framing_multi_chunk();
    test_ble_framing_rejections();
    test_proactive_offer_and_ready();
    test_physical_arbitration_and_lazy_expiry();
    return 0;
}
