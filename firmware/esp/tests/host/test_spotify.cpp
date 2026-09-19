#include <cassert>
#include <cstdio>
#include <cstring>

#include "spotify_controller.h"

static void test_offline_rejection()
{
    SpotifyController ctrl;

    // While offline -> rejected
    bool queued = ctrl.queue_action(SpotifyActionType::NEXT, 1000000LL, false);
    assert(!queued);
    assert(ctrl.get_queue_count() == 0);

    // While online -> accepted
    queued = ctrl.queue_action(SpotifyActionType::NEXT, 1000000LL, true);
    assert(queued);
    assert(ctrl.get_queue_count() == 1);

    printf("  [PASS] test_offline_rejection\n");
}

static void test_queue_capacity()
{
    SpotifyController ctrl;

    // Queue 4 actions -> all accepted
    for (int i = 0; i < 4; i++) {
        bool ok = ctrl.queue_action(SpotifyActionType::NEXT, 1000000LL + i * 1000LL, true);
        assert(ok);
    }
    assert(ctrl.get_queue_count() == 4);

    // 5th action -> rejected (bounded FIFO limit)
    bool overflow = ctrl.queue_action(SpotifyActionType::NEXT, 2000000LL, true);
    assert(!overflow);
    assert(ctrl.get_queue_count() == 4);

    printf("  [PASS] test_queue_capacity\n");
}

static void test_in_flight_and_result()
{
    SpotifyController ctrl;
    ctrl.queue_action(SpotifyActionType::NEXT, 1000000LL, true);
    ctrl.queue_action(SpotifyActionType::PREVIOUS, 1005000LL, true);

    char action_id[37] = {0};
    SpotifyActionType act = SpotifyActionType::NONE;

    // Pop first to send
    bool has_send = ctrl.get_action_to_send(action_id, sizeof(action_id), &act, 1010000LL);
    assert(has_send);
    assert(act == SpotifyActionType::NEXT);
    assert(strlen(action_id) == 36);
    assert(ctrl.has_in_flight());

    // While in flight, second action CANNOT be sent
    char id2[37] = {0};
    SpotifyActionType act2 = SpotifyActionType::NONE;
    has_send = ctrl.get_action_to_send(id2, sizeof(id2), &act2, 1020000LL);
    assert(!has_send);

    // Result arrives for action_id
    ctrl.on_action_result(action_id, true, nullptr);
    assert(!ctrl.has_in_flight());

    // Now second action can be sent
    has_send = ctrl.get_action_to_send(id2, sizeof(id2), &act2, 1030000LL);
    assert(has_send);
    assert(act2 == SpotifyActionType::PREVIOUS);

    printf("  [PASS] test_in_flight_and_result\n");
}

static void test_expiration_and_disconnect()
{
    SpotifyController ctrl;
    ctrl.queue_action(SpotifyActionType::NEXT, 1000000LL, true);

    char action_id[37] = {0};
    SpotifyActionType act = SpotifyActionType::NONE;

    // After 11s (TTL is 10s) -> expired
    bool has_send = ctrl.get_action_to_send(action_id, sizeof(action_id), &act, 12000000LL);
    assert(!has_send);
    assert(ctrl.get_queue_count() == 0);

    // Queue fresh action and then disconnect
    ctrl.queue_action(SpotifyActionType::PREVIOUS, 13000000LL, true);
    assert(ctrl.get_queue_count() == 1);

    ctrl.on_disconnected();
    assert(ctrl.get_queue_count() == 0);
    assert(!ctrl.has_in_flight());

    printf("  [PASS] test_expiration_and_disconnect\n");
}

int main()
{
    printf("Running Host C++ Spotify Controller Tests...\n");
    test_offline_rejection();
    test_queue_capacity();
    test_in_flight_and_result();
    test_expiration_and_disconnect();
    printf("All Host C++ Spotify Controller Tests Passed!\n");
    return 0;
}
