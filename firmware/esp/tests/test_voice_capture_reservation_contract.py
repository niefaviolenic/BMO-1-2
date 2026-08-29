import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MAIN = ROOT / "main"

class VoiceCaptureReservationContractTest(unittest.TestCase):
    def test_voice_reservation_header_and_source_exist(self):
        header = (MAIN / "voice_capture_reservation.h").read_text(encoding="utf-8")
        source = (MAIN / "voice_capture_reservation.cpp").read_text(encoding="utf-8")

        self.assertIn("struct VoiceCaptureReservation", header)
        self.assertIn("voice_reservation_begin_request", header)
        self.assertIn("voice_reservation_handle_accepted", header)
        self.assertIn("voice_reservation_is_valid", header)
        self.assertIn("voice_reservation_handle_accepted", source)

if __name__ == "__main__":
    unittest.main()
