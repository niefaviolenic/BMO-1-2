import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MAIN = ROOT / "main"

class PlaybackWatchdogContractTest(unittest.TestCase):
    def test_watchdog_header_and_source_exist(self):
        header = (MAIN / "playback_watchdog.h").read_text(encoding="utf-8")
        source = (MAIN / "playback_watchdog.cpp").read_text(encoding="utf-8")
        
        self.assertIn("struct PlaybackJobControl", header)
        self.assertIn("http_bytes_received", header)
        self.assertIn("mp3_frames_decoded", header)
        self.assertIn("pcm_frames_written", header)
        self.assertIn("last_progress_us", header)
        self.assertIn("cancel_requested", header)
        self.assertIn("playback_watchdog_latch_stalled", header)
        self.assertIn("playback_watchdog_latch_stalled", source)
        self.assertIn("kPlaybackStallUs", header)

    def test_watchdog_latch_stalled_uses_cas_and_release(self):
        source = (MAIN / "playback_watchdog.cpp").read_text(encoding="utf-8")
        self.assertIn("compare_exchange_strong", source)
        self.assertIn("cancel_requested.store(true", source)

if __name__ == "__main__":
    unittest.main()
