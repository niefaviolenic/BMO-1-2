#include <cassert>
#include <cstdio>
#include <cstring>

#include "face_policy.h"

static void test_boot_sequence()
{
    FacePolicy policy;
    policy.reset(0);

    // Initial state: Boot Stage 1 (Asset 7)
    FaceDecision d = policy.update(0);
    assert(d.asset_id == 7);
    assert(policy.get_current_mode() == FaceMode::BOOT_GREETING_STAGE1);

    // At 4.9s -> still Asset 7
    d = policy.update(4900000LL);
    assert(d.asset_id == 7);
    assert(policy.get_current_mode() == FaceMode::BOOT_GREETING_STAGE1);

    // At 5.01s -> transitions to Stage 2 (Asset 4)
    d = policy.update(5010000LL);
    assert(d.asset_id == 4);
    assert(d.face_changed);
    assert(policy.get_current_mode() == FaceMode::BOOT_GREETING_STAGE2);

    // At 9.9s -> still Asset 4
    d = policy.update(9900000LL);
    assert(d.asset_id == 4);

    // At 10.01s -> transitions to IDLE_DEFAULT (Asset 3)
    d = policy.update(10010000LL);
    assert(d.asset_id == 3);
    assert(d.face_changed);
    assert(policy.get_current_mode() == FaceMode::IDLE_DEFAULT);

    printf("  [PASS] test_boot_sequence\n");
}

static void test_boot_interruption()
{
    FacePolicy policy;
    policy.reset(0);

    // At 2.0s user triggers voice recording
    policy.trigger_recording_start(2000000LL);
    FaceDecision d = policy.update(2000000LL);
    assert(d.asset_id == 4);
    assert(policy.get_current_mode() == FaceMode::RECORDING);

    printf("  [PASS] test_boot_interruption\n");
}

static void test_thinking_cycle()
{
    FacePolicy policy;
    policy.reset(10000000LL);
    policy.update(10000000LL);

    // Start thinking at 10.0s
    policy.trigger_thinking_start(10000000LL);

    // At 0ms -> Asset 10
    FaceDecision d = policy.update(10000000LL);
    assert(d.asset_id == 10);

    // At 399ms -> still 10
    d = policy.update(10399000LL);
    assert(d.asset_id == 10);

    // At 400ms -> transitions to Asset 8
    d = policy.update(10400000LL);
    assert(d.asset_id == 8);
    assert(d.face_changed);

    // At 800ms -> transitions to Asset 9
    d = policy.update(10800000LL);
    assert(d.asset_id == 9);
    assert(d.face_changed);

    // At 1200ms -> transitions back to Asset 10
    d = policy.update(11200000LL);
    assert(d.asset_id == 10);
    assert(d.face_changed);

    printf("  [PASS] test_thinking_cycle (trace: 10 -> 8 -> 9 -> 10)\n");
}

static void test_speaking_and_error()
{
    FacePolicy policy;
    policy.reset(0);
    policy.update(15000000LL); // advance past boot

    // Speaking starts
    policy.trigger_speaking_start(16000000LL);
    FaceDecision d = policy.update(16000000LL);
    assert(d.asset_id == 2);
    assert(policy.get_current_mode() == FaceMode::SPEAKING);

    // Speaking stops -> reverts to idle 3
    policy.trigger_speaking_stop(18000000LL);
    d = policy.update(18000000LL);
    assert(d.asset_id == 3);

    // Error triggered -> Asset 14 for 5s
    policy.trigger_error(19000000LL);
    d = policy.update(19000000LL);
    assert(d.asset_id == 14);
    assert(policy.get_current_mode() == FaceMode::ERROR_OVERLAY);

    // At 4.9s -> still 14
    d = policy.update(23900000LL);
    assert(d.asset_id == 14);

    // At 5.01s -> reverts to 3
    d = policy.update(24010000LL);
    assert(d.asset_id == 3);

    printf("  [PASS] test_speaking_and_error\n");
}

static void test_pairing_faces()
{
    FacePolicy policy;
    policy.reset(0);
    policy.update(15000000LL); // past boot

    // Discovery -> Asset 1
    policy.trigger_ble_discovery_start(16000000LL);
    FaceDecision d = policy.update(16000000LL);
    assert(d.asset_id == 1);
    assert(policy.get_current_mode() == FaceMode::PAIRING_DISCOVERY);

    // BLE connected -> Asset 5
    policy.trigger_ble_connected(17000000LL);
    d = policy.update(17000000LL);
    assert(d.asset_id == 5);
    assert(policy.get_current_mode() == FaceMode::PAIRING_WAIT_PROOF);

    // Proof accepted -> Asset 6 for 5s
    policy.trigger_ble_proof_accepted(18000000LL);
    d = policy.update(18000000LL);
    assert(d.asset_id == 6);
    assert(policy.get_current_mode() == FaceMode::PAIRING_SUCCESS);

    // At 5.01s -> reverts to 3
    d = policy.update(23010000LL);
    assert(d.asset_id == 3);

    printf("  [PASS] test_pairing_faces\n");
}

static void test_idle_overlays()
{
    FacePolicy policy;
    policy.reset(0);
    policy.update(15000000LL); // past boot

    // Expression overlay -> Asset 11 for 5s
    policy.trigger_expression_overlay(16000000LL);
    FaceDecision d = policy.update(16000000LL);
    assert(d.asset_id == 11);

    d = policy.update(21010000LL);
    assert(d.asset_id == 3);

    // Touch overlay -> Asset 6 for 5s
    policy.trigger_touch_overlay(22000000LL);
    d = policy.update(22000000LL);
    assert(d.asset_id == 6);

    d = policy.update(27010000LL);
    assert(d.asset_id == 3);

    // Overlay ignored if not idle (e.g. while recording)
    policy.trigger_recording_start(28000000LL);
    policy.trigger_touch_overlay(29000000LL);
    d = policy.update(29000000LL);
    assert(d.asset_id == 4); // remains 4!

    printf("  [PASS] test_idle_overlays\n");
}

int main()
{
    printf("Running Host C++ Face Policy Tests...\n");
    test_boot_sequence();
    test_boot_interruption();
    test_thinking_cycle();
    test_speaking_and_error();
    test_pairing_faces();
    test_idle_overlays();
    printf("All Host C++ Face Policy Tests Passed!\n");
    return 0;
}
