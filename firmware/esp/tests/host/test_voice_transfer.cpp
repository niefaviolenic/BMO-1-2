#include <cassert>
#include <cstdio>
#include <cstring>
#include <cstdint>

#include "playback.h"

static void test_fixed_length_complete() {
    PlaybackTransferSummary summary{};
    summary.chunked = false;
    summary.http_complete = true;
    summary.content_length = 50000;
    summary.received_bytes = 50000;
    summary.decoded_frames = 150;
    summary.undecoded_bytes = 0;

    assert(playback_validate_transfer_completion(summary) == PlaybackTransferResult::COMPLETE);
    printf("  [PASS] test_fixed_length_complete\n");
}

static void test_fixed_length_truncated() {
    PlaybackTransferSummary summary{};
    summary.chunked = false;
    summary.http_complete = true;
    summary.content_length = 50000;
    summary.received_bytes = 49000; // Truncated download!
    summary.decoded_frames = 140;
    summary.undecoded_bytes = 0;

    assert(playback_validate_transfer_completion(summary) == PlaybackTransferResult::DOWNLOAD_FAILED);
    printf("  [PASS] test_fixed_length_truncated\n");
}

static void test_chunked_incomplete_http() {
    PlaybackTransferSummary summary{};
    summary.chunked = true;
    summary.http_complete = false; // Missing 0\r\n\r\n chunk terminator!
    summary.content_length = -1;
    summary.received_bytes = 30000;
    summary.decoded_frames = 90;
    summary.undecoded_bytes = 0;

    assert(playback_validate_transfer_completion(summary) == PlaybackTransferResult::DOWNLOAD_FAILED);
    printf("  [PASS] test_chunked_incomplete_http\n");
}

static void test_zero_decoded_frames() {
    PlaybackTransferSummary summary{};
    summary.chunked = false;
    summary.http_complete = true;
    summary.content_length = 1000;
    summary.received_bytes = 1000;
    summary.decoded_frames = 0; // Corrupt MP3, no valid frames!
    summary.undecoded_bytes = 1000;

    assert(playback_validate_transfer_completion(summary) == PlaybackTransferResult::DECODE_FAILED);
    printf("  [PASS] test_zero_decoded_frames\n");
}

static void test_trailing_padding_tolerated() {
    PlaybackTransferSummary summary{};
    summary.chunked = false;
    summary.http_complete = true;
    summary.content_length = 50002;
    summary.received_bytes = 50002;
    summary.decoded_frames = 150;
    summary.undecoded_bytes = 2; // Harmless trailing padding < 4 bytes

    assert(playback_validate_transfer_completion(summary) == PlaybackTransferResult::COMPLETE);
    printf("  [PASS] test_trailing_padding_tolerated\n");
}

static void test_trailing_partial_frame_rejected() {
    PlaybackTransferSummary summary{};
    summary.chunked = false;
    summary.http_complete = true;
    summary.content_length = 50020;
    summary.received_bytes = 50020;
    summary.decoded_frames = 150;
    summary.undecoded_bytes = 20; // Residual >= 4 bytes (corrupt/truncated tail)

    assert(playback_validate_transfer_completion(summary) == PlaybackTransferResult::DECODE_FAILED);
    printf("  [PASS] test_trailing_partial_frame_rejected\n");
}

int main() {
    printf("Running Host C++ Voice Transfer Tests...\n");
    test_fixed_length_complete();
    test_fixed_length_truncated();
    test_chunked_incomplete_http();
    test_zero_decoded_frames();
    test_trailing_padding_tolerated();
    test_trailing_partial_frame_rejected();
    printf("All Host C++ Voice Transfer Tests Passed!\n");
    return 0;
}
