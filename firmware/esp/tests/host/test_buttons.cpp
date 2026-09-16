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

    // 2.99s hold -> not yet 3s, no action
    policy.update_raw(false, true, false, false, false, false, false, false, 3990000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 0);

    // 3.05s hold -> triggers BLE_OPEN_DISCOVERY
    policy.update_raw(false, true, false, false, false, false, false, false, 4050000LL, SystemInteractionState::IDLE);
    assert(policy.get_pending_action_count() == 1);
    assert(policy.pop_action() == ButtonAction::BLE_OPEN_DISCOVERY);

    // Continuing to hold -> NO repeat
    policy.update_raw(false, true, false, false, false, false, false, false, 5000000LL, SystemInteractionState::PAIRING_DISCOVERING);
    assert(policy.get_pending_action_count() == 0);

    // Even if state changes to PAIRING_ARMED_PROOF, keeping it held cannot trigger proof without a fresh release!
    policy.update_raw(false, true, false, false, false, false, false, false, 6000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // Debounced release
    policy.update_raw(false, false, false, false, false, false, false, false, 6100000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, false, false, false, false, false, false, false, 6140000LL, SystemInteractionState::PAIRING_ARMED_PROOF);

    // Fresh 2-second hold in PAIRING_ARMED_PROOF
    policy.update_raw(false, true, false, false, false, false, false, false, 7000000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    policy.update_raw(false, true, false, false, false, false, false, false, 7040000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    // At 8.9s (1.9s hold) -> no action
    policy.update_raw(false, true, false, false, false, false, false, false, 8900000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 0);

    // At 9.05s (2.05s hold) -> triggers BLE_PHYSICAL_CONFIRM
    policy.update_raw(false, true, false, false, false, false, false, false, 9050000LL, SystemInteractionState::PAIRING_ARMED_PROOF);
    assert(policy.get_pending_action_count() == 1);
    assert(policy.pop_action() == ButtonAction::BLE_PHYSICAL_CONFIRM);

    printf("  [PASS] test_ble_pairing_holds\n");
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
    test_volume_and_spotify_cancellation();
    test_expression_and_touch();
    printf("All Host C++ Button Policy Tests Passed!\n");
    return 0;
}
