import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MAIN = ROOT / "main"

class ProactiveProtocolContractTest(unittest.TestCase):
    def test_proactive_structs_and_functions_exist(self):
        header = (MAIN / "playback.h").read_text(encoding="utf-8")
        source = (MAIN / "playback.cpp").read_text(encoding="utf-8")

        self.assertIn("struct ProactiveOffer", header)
        self.assertIn("struct ProactiveAudioReady", header)
        self.assertIn("struct ProactiveCancel", header)
        self.assertIn("enum class ProactiveRejectReason", header)
        self.assertIn("enum class ProactiveFailureReason", header)
        self.assertIn("playback_prepare_proactive_offer", header)
        self.assertIn("playback_start_proactive_ready", header)
        self.assertIn("playback_cancel_proactive", header)

        self.assertIn("playback_prepare_proactive_offer", source)
        self.assertIn("playback_start_proactive_ready", source)
        self.assertIn("playback_cancel_proactive", source)

if __name__ == "__main__":
    unittest.main()
