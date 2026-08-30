import unittest
from pathlib import Path

ESP_ROOT = Path(__file__).resolve().parents[1]
MAIN_SOURCE = ESP_ROOT / "main" / "main.cpp"
DISPLAY_HEADER = ESP_ROOT / "main" / "display.h"
DISPLAY_SOURCE = ESP_ROOT / "main" / "display.cpp"
BLE_PROV_SOURCE = ESP_ROOT / "main" / "joy_ble_provisioning.cpp"
IDENTITY_SOURCE = ESP_ROOT / "main" / "joy_identity.cpp"


class UnpairedFaceContractTest(unittest.TestCase):
    def test_display_header_has_dead_face(self) -> None:
        header = DISPLAY_HEADER.read_text(encoding="utf-8")
        self.assertIn("FACE_DEAD", header)
        self.assertIn("FACE_SLEEPY", header)

    def test_display_source_implements_dead_and_sleepy_faces(self) -> None:
        display = DISPLAY_SOURCE.read_text(encoding="utf-8")
        self.assertIn("face_dead()", display)
        self.assertIn("face_sleepy()", display)
        self.assertIn("case FACE_DEAD:", display)
        self.assertIn("case FACE_SLEEPY:", display)

    def test_ble_provisioning_init_sets_dead_for_unpaired_and_happy_for_paired(self) -> None:
        ble_prov = BLE_PROV_SOURCE.read_text(encoding="utf-8")
        self.assertIn("display_set_idle_face(FACE_HAPPY)", ble_prov)
        self.assertIn("display_set_idle_face(FACE_DEAD)", ble_prov)
    def test_ble_pairing_lifecycle_updates_faces(self) -> None:
        ble_prov = BLE_PROV_SOURCE.read_text(encoding="utf-8")
        # Starting pairing window opens BLE pairing UI with countdown & audio
        self.assertIn("display_show_ble_pairing", ble_prov)
        self.assertIn("audio_playBleActivated()", ble_prov)
        # Arming physical confirmation asks for attention
        self.assertIn("display_set_idle_face(FACE_SURPRISED)", ble_prov)
        # Confirming physical 2s hold excites
        self.assertIn("display_set_idle_face(FACE_EXCITED)", ble_prov)
        self.assertIn("display_hide_ble_pairing()", ble_prov)
    def test_main_startup_does_not_force_happy_face_blindly(self) -> None:
        main_src = MAIN_SOURCE.read_text(encoding="utf-8")
        self.assertNotIn("display_face(FACE_HAPPY);", main_src)

    def test_display_header_has_unpaired_revert_helpers(self) -> None:
        header = DISPLAY_HEADER.read_text(encoding="utf-8")
        self.assertIn("display_is_unpaired_revert_active()", header)
        self.assertIn("display_cancel_unpaired_revert()", header)
        self.assertIn("display_trigger_unpaired_revert()", header)

    def test_display_source_implements_unpaired_auto_revert_to_dead(self) -> None:
        display = DISPLAY_SOURCE.read_text(encoding="utf-8")
        self.assertIn("is_unpaired_locked()", display)
        self.assertIn("schedule_unpaired_revert_timer_locked()", display)
        self.assertIn("cancel_unpaired_revert_timer_locked()", display)
        self.assertIn("unpaired_face_revert_timer_cb", display)
        self.assertIn("current_touch_face = FACE_DEAD;", display)
        self.assertIn("draw_face_locked(FACE_DEAD);", display)
        self.assertIn("UNPAIRED_FACE_REVERT_DELAY_US", display)

    def test_display_next_touch_face_schedules_revert_when_unpaired(self) -> None:
        display = DISPLAY_SOURCE.read_text(encoding="utf-8")
        self.assertIn("schedule_unpaired_revert_timer_locked();", display)
        self.assertIn("s_unpaired_cycle_index", display)

    def test_display_has_ble_pairing_ui(self) -> None:
        header = DISPLAY_HEADER.read_text(encoding="utf-8")
        display = DISPLAY_SOURCE.read_text(encoding="utf-8")
        self.assertIn("display_show_ble_pairing", header)
        self.assertIn("display_update_ble_countdown", header)
        self.assertIn("display_hide_ble_pairing", header)
        self.assertIn("display_ble_pairing_is_visible", header)
        self.assertIn("draw_bluetooth_icon", display)
        self.assertIn("draw_ble_pairing_overlay_locked", display)

    def test_audio_has_ble_activated_and_unpaired_sad(self) -> None:
        audio_header = (ESP_ROOT / "main" / "audio.h").read_text(encoding="utf-8")
        audio_source = (ESP_ROOT / "main" / "audio.cpp").read_text(encoding="utf-8")
        cmakelists = (ESP_ROOT / "main" / "CMakeLists.txt").read_text(encoding="utf-8")
        self.assertIn("audio_playBleActivated()", audio_header)
        self.assertIn("audio_playUnpairedSad()", audio_header)
        self.assertIn("_binary_ble_activated_wav_start", audio_source)
        self.assertIn("_binary_unpaired_sad_wav_start", audio_source)
        self.assertIn("audio_wav/ble_activated.wav", cmakelists)
        self.assertIn("audio_wav/unpaired_sad.wav", cmakelists)

if __name__ == "__main__":
    unittest.main()
