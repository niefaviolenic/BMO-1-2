#include <cassert>
#include <cstdio>
#include <cstring>

#include "button_policy.h"

static void test_debounce()
{
    ButtonPolicy policy;

    // 10ms press -> should NOT register (debounce is 30ms)
    policy.update_raw(true, false, false, false, false, false, false, false, 10000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, false, false, false, false, false, false, 20000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 0);

    // 35ms press -> should register VOICE_START
    policy.update_raw(true, false, false, false, false, false, false, false, 30000LL, SystemInteractionState::IDLE);
    policy.update_raw(true, false, false, false, false, false, false, false, 65000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 1);
    assert(policy.pop_action() == ButtonAction::VOICE_START);

    printf("  [PASS] test_debounce\n");
}

static void test_voice_button_states()
{
    ButtonPolicy policy;

    // Press while IDLE -> VOICE_START
    policy.update_raw(true, false, false, false, false, false, false, false, 100000LL, SystemInteractionState::IDLE);
    policy.update_raw(true, false, false, false, false, false, false, false, 140000LL, SystemInteractionState::IDLE);
    assert(policy.pop_action() == ButtonAction::VOICE_START);

    // Release
    policy.update_raw(false, false, false, false, false, false, false, false, 200000LL, SystemInteractionState::RECORDING);
    policy.update_raw(false, false, false, false, false, false, false, false, 240000LL, SystemInteractionState::RECORDING);

    // Press while RECORDING -> VOICE_STOP
    policy.update_raw(true, false, false, false, false, false, false, false, 300000LL, SystemInteractionState::RECORDING);
    policy.update_raw(true, false, false, false, false, false, false, false, 340000LL, SystemInteractionState::RECORDING);
    assert(policy.pop_action() == ButtonAction::VOICE_STOP);

    // Release
    policy.update_raw(false, false, false, false, false, false, false, false, 400000LL, SystemInteractionState::THINKING);
    policy.update_raw(false, false, false, false, false, false, false, false, 440000LL, SystemInteractionState::THINKING);

    // Press while THINKING -> IGNORED (no action)
    policy.update_raw(true, false, false, false, false, false, false, false, 500000LL, SystemInteractionState::THINKING);
    policy.update_raw(true, false, false, false, false, false, false, false, 540000LL, SystemInteractionState::THINKING);
    assert(policy.get_pending_action_count() == 0);

    // Press while SPEAKING -> IGNORED
    policy.update_raw(false, false, false, false, false, false, false, false, 600000LL, SystemInteractionState::SPEAKING);
    policy.update_raw(false, false, false, false, false, false, false, false, 640000LL, SystemInteractionState::SPEAKING);
    policy.update_raw(true, false, false, false, false, false, false, false, 700000LL, SystemInteractionState::SPEAKING);
    policy.update_raw(true, false, false, false, false, false, false, false, 740000LL, SystemInteractionState::SPEAKING);
    assert(policy.get_pending_action_count() == 0);

    printf("  [PASS] test_voice_button_states\n");
}

static void test_ble_pairing_holds()
{
    ButtonPolicy policy;

    // Start pressing PAIR button at 1.0s
    policy.update_raw(false, true, false, false, false, false, false, false, 1000000LL, SystemInteractionState::IDLE);
    // Debounced at 1.04s
    policy.update_raw(false, true, false, false, false, false, false, false, 1040000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 0);

    // 4.99s hold -> not yet 5s, no action
    policy.update_raw(false, true, false, false, false, false, false, false, 5990000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 0);

    // 5.05s hold -> triggers BLE_OPEN_DISCOVERY
    policy.update_raw(false, true, false, false, false, false, false, false, 6050000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 1);
    assert(policy.pop_action() == ButtonAction::BLE_OPEN_DISCOVERY);

    // Continuing to hold -> NO repeat
    policy.update_raw(false, true, false, false, false, false, false, false, 7000000LL, SystemInteractionState::PAIRING_DISCOVERING);
    assert(policy.get_pending_action_count() == 0);

    // Even if state changes to PAIRING_ARMED_PROOF, keeping it held cannot trigger proof without a fresh release!
    policy.update_raw(false, true, false, false, false, false, false, false, 8000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // Debounced release
    policy.update_raw(false, false, false, false, false, false, false, false, 8100000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, false, false, false, false, false, false, false, 8140000LL, SystemInteractionState::PAIRING_ARMED_PROOF);

    // Fresh 2-second hold in PAIRING_ARMED_PROOF
    policy.update_raw(false, true, false, false, false, false, false, false, 9000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, true, false, false, false, false, false, false, 9040000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    // At 10.9s (1.9s hold) -> no action
    policy.update_raw(false, true, false, false, false, false, false, false, 10900000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // At 11.05s (2.05s hold) -> triggers BLE_PHYSICAL_CONFIRM
    policy.update_raw(false, true, false, false, false, false, false, false, 11050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 1);
    assert(policy.pop_action() == ButtonAction::BLE_PHYSICAL_CONFIRM);

    printf("  [PASS] test_ble_pairing_holds\n");
}

static void test_held_before_arm_requires_release_and_repress()
{
    ButtonPolicy policy;

    // Button is pressed during discovery before challenge arms
    policy.update_raw(false, true, false, false, false, false, false, false, 1000000LL, SystemInteractionState::PAIRING_DISCOVERING);
    policy.update_raw(false, true, false, false, false, false, false, false, 1040000LL, SystemInteractionState::PAIRING_DISCOVERING);
    assert(policy.get_pending_action_count() == 0);

    // Challenge arms while button is still pressed
    policy.update_raw(false, true, false, false, false, false, false, false, 2000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // Held for 2s after press (3.05s mark) -> MUST NOT confirm!
    policy.update_raw(false, true, false, false, false, false, false, false, 3050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // Held for 2s after arm (4.05s mark) -> MUST NOT confirm!
    policy.update_raw(false, true, false, false, false, false, false, false, 4050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // Held for 6s total (7.05s mark) -> MUST NOT confirm!
    policy.update_raw(false, true, false, false, false, false, false, false, 7050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // Debounced release
    policy.update_raw(false, false, false, false, false, false, false, false, 8000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, false, false, false, false, false, false, false, 8040000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // Re-press after arming release
    policy.update_raw(false, true, false, false, false, false, false, false, 9000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, true, false, false, false, false, false, false, 9040000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // 1.9s hold -> not yet 2s
    policy.update_raw(false, true, false, false, false, false, false, false, 10900000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // 2.05s hold -> triggers BLE_PHYSICAL_CONFIRM
    policy.update_raw(false, true, false, false, false, false, false, false, 11050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 1);
    assert(policy.pop_action() == ButtonAction::BLE_PHYSICAL_CONFIRM);

    printf("  [PASS] test_held_before_arm_requires_release_and_repress\n");
}

static void test_confirm_hold_longer_than_5s_does_not_reopen_pairing()
{
    ButtonPolicy policy;
    policy.update_raw(false, false, false, false, false, false, false, false, 500000LL, SystemInteractionState::PAIRING_ARMED_PROOF);

    // Armed state, fresh press at 1.0s
    policy.update_raw(false, true, false, false, false, false, false, false, 1000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, true, false, false, false, false, false, false, 1040000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // At 2.05s hold (3.05s mark) -> BLE_PHYSICAL_CONFIRM emitted
    policy.update_raw(false, true, false, false, false, false, false, false, 3050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 1);
    assert(policy.pop_action() == ButtonAction::BLE_PHYSICAL_CONFIRM);

    // User continues holding past 5s (e.g. 6.05s mark = 5.05s hold)
    policy.update_raw(false, true, false, false, false, false, false, false, 6050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0); // MUST NOT reopen discovery!

    // Continuing to hold at 8.0s (7s hold) -> NO action
    policy.update_raw(false, true, false, false, false, false, false, false, 8000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // Even if state returns to IDLE while button is still continuously held
    policy.update_raw(false, true, false, false, false, false, false, false, 9000000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 0); // MUST NOT trigger discovery without release!

    // Debounced release
    policy.update_raw(false, false, false, false, false, false, false, false, 10000000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, false, false, false, false, false, false, 10040000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 0);

    printf("  [PASS] test_confirm_hold_longer_than_5s_does_not_reopen_pairing\n");
}

static void test_discovery_5s_hold_into_arm_does_not_confirm()
{
    ButtonPolicy policy;

    // IDLE: user holds button for 5s to open discovery
    policy.update_raw(false, true, false, false, false, false, false, false, 1000000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, true, false, false, false, false, false, false, 1040000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 0);

    // At 5.05s hold -> BLE_OPEN_DISCOVERY
    policy.update_raw(false, true, false, false, false, false, false, false, 6050000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 1);
    assert(policy.pop_action() == ButtonAction::BLE_OPEN_DISCOVERY);

    // Continues holding into PAIRING_DISCOVERING
    policy.update_raw(false, true, false, false, false, false, false, false, 7000000LL, SystemInteractionState::PAIRING_DISCOVERING);
    assert(policy.get_pending_action_count() == 0);

    // Mobile connects and arms challenge while user is STILL holding
    policy.update_raw(false, true, false, false, false, false, false, false, 8000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // 2s after arm (10.05s mark) with continuous hold -> MUST NOT confirm!
    policy.update_raw(false, true, false, false, false, false, false, false, 10050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // 5s after arm (13.05s mark) with continuous hold -> MUST NOT confirm!
    policy.update_raw(false, true, false, false, false, false, false, false, 13050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // Release
    policy.update_raw(false, false, false, false, false, false, false, false, 14000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, false, false, false, false, false, false, false, 14040000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // New fresh press in armed state
    policy.update_raw(false, true, false, false, false, false, false, false, 15000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, true, false, false, false, false, false, false, 15040000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // 2.05s hold -> NOW confirms!
    policy.update_raw(false, true, false, false, false, false, false, false, 17050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 1);
    assert(policy.pop_action() == ButtonAction::BLE_PHYSICAL_CONFIRM);

    printf("  [PASS] test_discovery_5s_hold_into_arm_does_not_confirm\n");
}

static void test_valid_new_2s_confirmation()
{
    ButtonPolicy policy;

    // Enter PAIRING_ARMED_PROOF with button released
    policy.update_raw(false, false, false, false, false, false, false, false, 1000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);

    // Short press 1.5s then release (< 2s hold) -> NO confirm
    policy.update_raw(false, true, false, false, false, false, false, false, 2000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, true, false, false, false, false, false, false, 2040000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, true, false, false, false, false, false, false, 3500000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);
    policy.update_raw(false, false, false, false, false, false, false, false, 3510000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, false, false, false, false, false, false, false, 3550000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // New press held for full 2.05s -> confirms!
    policy.update_raw(false, true, false, false, false, false, false, false, 4000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, true, false, false, false, false, false, false, 4040000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    policy.update_raw(false, true, false, false, false, false, false, false, 6050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 1);
    assert(policy.pop_action() == ButtonAction::BLE_PHYSICAL_CONFIRM);

    printf("  [PASS] test_valid_new_2s_confirmation\n");
}

static void test_old_board_expr_and_boot_pairing()
{
    // 1. Test BOOT button (arg 11) for 5s discovery and 2s confirm
    {
        ButtonPolicy policy;
        // 5s hold on BOOT in IDLE -> BLE_OPEN_DISCOVERY
        policy.update_raw(false, false, false, false, false, false, false, false, 1000000LL, SystemInteractionState::IDLE, true);
        policy.update_raw(false, false, false, false, false, false, false, false, 1040000LL, SystemInteractionState::IDLE, true);
        policy.update_raw(false, false, false, false, false, false, false, false, 6050000LL, SystemInteractionState::IDLE, true);
        assert(policy.get_pending_action_count() == 1);
        assert(policy.pop_action() == ButtonAction::BLE_OPEN_DISCOVERY);

        // Release
        policy.update_raw(false, false, false, false, false, false, false, false, 7000000LL, SystemInteractionState::PAIRING_ARMED_PROOF, false);
        policy.update_raw(false, false, false, false, false, false, false, false, 7040000LL, SystemInteractionState::PAIRING_ARMED_PROOF, false);

        // 2s hold on BOOT in PAIRING_ARMED_PROOF -> BLE_PHYSICAL_CONFIRM
        policy.update_raw(false, false, false, false, false, false, false, false, 8000000LL, SystemInteractionState::PAIRING_ARMED_PROOF, true);
        policy.update_raw(false, false, false, false, false, false, false, false, 8040000LL, SystemInteractionState::PAIRING_ARMED_PROOF, true);
        policy.update_raw(false, false, false, false, false, false, false, false, 10050000LL, SystemInteractionState::PAIRING_ARMED_PROOF, true);
        assert(policy.get_pending_action_count() == 1);
        assert(policy.pop_action() == ButtonAction::BLE_PHYSICAL_CONFIRM);
    }

    // 2. Test EXPR button (arg 3) for 2s confirm in PAIRING_ARMED_PROOF
    {
        ButtonPolicy policy;
        // Release before arm
        policy.update_raw(false, false, false, false, false, false, false, false, 1000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);

        // 2s hold on EXPR in PAIRING_ARMED_PROOF -> BLE_PHYSICAL_CONFIRM
        policy.update_raw(false, false, true, false, false, false, false, false, 2000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
        policy.update_raw(false, false, true, false, false, false, false, false, 2040000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
        policy.update_raw(false, false, true, false, false, false, false, false, 4050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
        assert(policy.get_pending_action_count() == 1);
        assert(policy.pop_action() == ButtonAction::BLE_PHYSICAL_CONFIRM);
    }

    printf("  [PASS] test_old_board_expr_and_boot_pairing\n");
}

static void test_pairing_owns_inputs_blocks_voice_and_face()
{
    ButtonPolicy policy;

    // In PAIRING_DISCOVERING:
    // Voice button -> blocked
    policy.update_raw(true, false, false, false, false, false, false, false, 100000LL, SystemInteractionState::PAIRING_DISCOVERING);
    policy.update_raw(true, false, false, false, false, false, false, false, 140000LL, SystemInteractionState::PAIRING_DISCOVERING);
    assert(policy.get_pending_action_count() == 0);
    policy.update_raw(false, false, false, false, false, false, false, false, 200000LL, SystemInteractionState::PAIRING_DISCOVERING);
    policy.update_raw(false, false, false, false, false, false, false, false, 240000LL, SystemInteractionState::PAIRING_DISCOVERING);

    // Touch pad -> blocked
    policy.update_raw(false, false, false, false, false, false, false, true, 300000LL, SystemInteractionState::PAIRING_DISCOVERING);
    policy.update_raw(false, false, false, false, false, false, false, true, 340000LL, SystemInteractionState::PAIRING_DISCOVERING);
    assert(policy.get_pending_action_count() == 0);

    // In PAIRING_ARMED_PROOF:
    // Voice button -> blocked
    policy.update_raw(true, false, false, false, false, false, false, false, 400000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(true, false, false, false, false, false, false, false, 440000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // Touch pad -> blocked
    policy.update_raw(false, false, false, false, false, false, false, true, 500000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, false, false, false, false, false, false, true, 540000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    printf("  [PASS] test_pairing_owns_inputs_blocks_voice_and_face\n");
}

static void test_volume_and_spotify_cancellation()
{
    ButtonPolicy policy;

    // Simultaneous VOL_UP and VOL_DOWN -> cancels out
    policy.update_raw(false, false, false, true, true, false, false, false, 100000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, false, true, true, false, false, false, 140000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 0);

    // Release
    policy.update_raw(false, false, false, false, false, false, false, false, 200000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, false, false, false, false, false, false, 240000LL, SystemInteractionState::IDLE);

    // Single VOL_UP -> VOLUME_UP
    policy.update_raw(false, false, false, true, false, false, false, false, 300000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, false, true, false, false, false, false, 340000LL, SystemInteractionState::IDLE);
    assert(policy.pop_action() == ButtonAction::VOLUME_UP);

    // Release
    policy.update_raw(false, false, false, false, false, false, false, false, 400000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, false, false, false, false, false, false, 440000LL, SystemInteractionState::IDLE);

    // Simultaneous SPOTIFY_NEXT and SPOTIFY_PREV -> cancels out
    policy.update_raw(false, false, false, false, false, true, true, false, 500000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, false, false, false, true, true, false, 540000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 0);

    // Release
    policy.update_raw(false, false, false, false, false, false, false, false, 600000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, false, false, false, false, false, false, 640000LL, SystemInteractionState::IDLE);

    // Single SPOTIFY_NEXT -> SPOTIFY_NEXT
    policy.update_raw(false, false, false, false, false, true, false, false, 700000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, false, false, false, true, false, false, 740000LL, SystemInteractionState::IDLE);
    assert(policy.pop_action() == ButtonAction::SPOTIFY_NEXT);

    printf("  [PASS] test_volume_and_spotify_cancellation\n");
}

static void test_expression_and_touch()
{
    ButtonPolicy policy;

    // Expression press while IDLE -> EXPRESSION_ASSET_11
    policy.update_raw(false, false, true, false, false, false, false, false, 100000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, true, false, false, false, false, false, 140000LL, SystemInteractionState::IDLE);
    assert(policy.pop_action() == ButtonAction::EXPRESSION_ASSET_11);

    // Release
    policy.update_raw(false, false, false, false, false, false, false, false, 200000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, false, false, false, false, false, false, 240000LL, SystemInteractionState::IDLE);

    // Touch press while IDLE -> TOUCH_ASSET_6
    policy.update_raw(false, false, false, false, false, false, false, true, 300000LL, SystemInteractionState::IDLE);
    policy.update_raw(false, false, false, false, false, false, false, true, 340000LL, SystemInteractionState::IDLE);
    assert(policy.pop_action() == ButtonAction::TOUCH_ASSET_6);

    printf("  [PASS] test_expression_and_touch\n");
}

int main()
{
    printf("Running Host C++ Button Policy Tests...\n");
    test_debounce();
    test_voice_button_states();
    test_ble_pairing_holds();
    test_held_before_arm_requires_release_and_repress();
    test_confirm_hold_longer_than_5s_does_not_reopen_pairing();
    test_discovery_5s_hold_into_arm_does_not_confirm();
    test_valid_new_2s_confirmation();
    test_old_board_expr_and_boot_pairing();
    test_pairing_owns_inputs_blocks_voice_and_face();
    test_volume_and_spotify_cancellation();
    test_expression_and_touch();
    printf("All Host C++ Button Policy Tests Passed!\n");
    return 0;
}
