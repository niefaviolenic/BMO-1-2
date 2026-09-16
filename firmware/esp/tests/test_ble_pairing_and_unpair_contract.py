import unittest
import wave
from pathlib import Path

ESP_ROOT = Path(__file__).resolve().parents[1]
AUDIO_WAV_DIR = ESP_ROOT / "main" / "audio_wav"
CMAKE_FILE = ESP_ROOT / "main" / "CMakeLists.txt"
AUDIO_H_FILE = ESP_ROOT / "main" / "audio.h"
AUDIO_CPP_FILE = ESP_ROOT / "main" / "audio.cpp"
DISPLAY_H_FILE = ESP_ROOT / "main" / "display.h"
DISPLAY_CPP_FILE = ESP_ROOT / "main" / "display.cpp"
BLE_PROV_FILE = ESP_ROOT / "main" / "joy_ble_provisioning.cpp"
BUTTON_FILE = ESP_ROOT / "main" / "button.cpp"
BLE_PROV_H_FILE = ESP_ROOT / "main" / "joy_ble_provisioning.h"
API_CPP_FILE = ESP_ROOT / "main" / "api.cpp"


class BlePairingAndUnpairContractTest(unittest.TestCase):
    def test_audio_files_exist_and_match_specs(self) -> None:
        for filename in ("ble_activated.wav", "unpaired_sad.wav"):
            wav_path = AUDIO_WAV_DIR / filename
            self.assertTrue(wav_path.exists(), f"{filename} must exist in {AUDIO_WAV_DIR}")
            with wave.open(str(wav_path), "rb") as wf:
                self.assertEqual(wf.getnchannels(), 1, f"{filename} must be mono")
                self.assertEqual(wf.getsampwidth(), 2, f"{filename} must be 16-bit PCM")
                self.assertEqual(wf.getframerate(), 16000, f"{filename} must be 16000 Hz")
                duration = wf.getnframes() / wf.getframerate()
                self.assertGreater(duration, 0.5, f"{filename} must have duration > 0.5s")
                self.assertLess(duration, 5.0, f"{filename} must have duration < 5.0s")

    def test_cmake_embeds_new_audio_clips(self) -> None:
        cmake = CMAKE_FILE.read_text(encoding="utf-8")
        self.assertIn("audio_wav/ble_activated.wav", cmake)
        self.assertIn("audio_wav/unpaired_sad.wav", cmake)

    def test_audio_header_and_source_have_playback_functions(self) -> None:
        header = AUDIO_H_FILE.read_text(encoding="utf-8")
        source = AUDIO_CPP_FILE.read_text(encoding="utf-8")

        self.assertIn("void audio_playBleActivated();", header)
        self.assertIn("void audio_playUnpairedSad();", header)

        self.assertIn("_binary_ble_activated_wav_start", source)
        self.assertIn("_binary_ble_activated_wav_end", source)
        self.assertIn("_binary_unpaired_sad_wav_start", source)
        self.assertIn("_binary_unpaired_sad_wav_end", source)

        self.assertIn("void audio_playBleActivated()", source)
        self.assertIn("void audio_playUnpairedSad()", source)

    def test_display_header_and_source_have_ble_pairing_api(self) -> None:
        header = DISPLAY_H_FILE.read_text(encoding="utf-8")
        source = DISPLAY_CPP_FILE.read_text(encoding="utf-8")

        self.assertIn("bool display_show_ble_pairing(int remaining_seconds);", header)
        self.assertIn("void display_update_ble_countdown(int remaining_seconds);", header)
        self.assertIn("void display_hide_ble_pairing();", header)
        self.assertIn("bool display_ble_pairing_is_visible();", header)

        self.assertIn("draw_bluetooth_icon", source)
        self.assertIn("draw_ble_pairing_overlay_locked", source)
        self.assertIn("ble_pairing_active", source)
        self.assertIn("ble_pairing_remaining_sec", source)

    def test_ble_provisioning_triggers_pairing_ui_and_audio(self) -> None:
        ble_src = BLE_PROV_FILE.read_text(encoding="utf-8")

        # Starting pairing window triggers BLE UI + activation audio
        self.assertIn("display_show_ble_pairing(60)", ble_src)
        self.assertIn("audio_playBleActivated()", ble_src)

        # Polling updates countdown
        self.assertIn("display_update_ble_countdown(remaining_sec)", ble_src)

        # Stopping/timeout hides BLE UI and sets FACE_DEAD for unprovisioned
        self.assertIn("display_hide_ble_pairing()", ble_src)
        self.assertIn("display_set_idle_face(FACE_DEAD)", ble_src)

        # 2s physical confirmation changes to EXCITED and hides BLE UI
        self.assertIn("display_set_idle_face(FACE_EXCITED)", ble_src)

        # Finalize changes to HAPPY, hides BLE UI, and plays happy expression audio
        self.assertIn("display_set_idle_face(FACE_HAPPY)", ble_src)
        self.assertIn("audio_triggerExpressionAudio((int)FACE_HAPPY)", ble_src)

    def test_joy_ble_unpair_contract(self) -> None:
        header = BLE_PROV_H_FILE.read_text(encoding="utf-8")
        source = BLE_PROV_FILE.read_text(encoding="utf-8")

        self.assertIn("void joy_ble_unpair(void);", header)
        self.assertIn("void joy_ble_unpair(void)", source)
        self.assertIn("joy_identity_increment_reset_epoch(nullptr);", source)
        self.assertIn("joy_runtime_clear_provisioning();", source)
        self.assertIn("joy_ble_stop_provisioning();", source)
        self.assertIn("display_set_idle_face(FACE_DEAD);", source)
        self.assertIn("audio_playUnpairedSad();", source)

    def test_button_handles_5s_hold_paired_vs_unpaired(self) -> None:
        button_src = BUTTON_FILE.read_text(encoding="utf-8")

        # 5s hold differentiates paired (calls joy_ble_unpair) vs unpaired (calls joy_ble_start_pairing_window)
        self.assertIn("was_provisioned", button_src)
        self.assertIn("joy_ble_unpair()", button_src)
        self.assertIn("joy_ble_start_pairing_window()", button_src)

    def test_api_handles_app_unpair_events(self) -> None:
        api_src = API_CPP_FILE.read_text(encoding="utf-8")

        self.assertIn("device_unpaired", api_src)
        self.assertIn("device_binding_revoked", api_src)
        self.assertIn("joy_ble_unpair()", api_src)

if __name__ == "__main__":
    unittest.main()
