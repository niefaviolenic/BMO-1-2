import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WAKEWORD_SOURCE = ROOT / "main" / "wakeword.cpp"
AUDIO_SOURCE = ROOT / "main" / "audio.cpp"
STATE_SOURCE = ROOT / "main" / "state.cpp"
MAIN_SOURCE = ROOT / "main" / "main.cpp"


def function_body(source: str, signature: str) -> str:
    match = re.search(signature, source)
    if match is None:
        raise AssertionError(f"function not found: {signature}")

    opening = source.find("{", match.end())
    if opening == -1:
        raise AssertionError(f"function body not found: {signature}")

    depth = 1
    index = opening + 1
    while index < len(source) and depth:
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
        index += 1

    if depth:
        raise AssertionError(f"function closing brace not found: {signature}")
    return source[opening + 1 : index - 1]


class WakewordSilenceContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.source = WAKEWORD_SOURCE.read_text(encoding="utf-8")

    def test_silence_threshold_is_adjusted_for_boosted_speech(self) -> None:
        match = re.search(r"#define\s+SILENCE_THRESHOLD\s+(\d+)", self.source)
        self.assertIsNotNone(match, "SILENCE_THRESHOLD definition not found")
        threshold = int(match.group(1))
        self.assertEqual(threshold, 400, "SILENCE_THRESHOLD should be 400 (calibrated for 2.5x digital gain)")

    def test_mic_digital_gain_is_configured_and_saturated(self) -> None:
        match_num = re.search(r"#define\s+MIC_GAIN_NUMERATOR\s+(\d+)", self.source)
        match_den = re.search(r"#define\s+MIC_GAIN_DENOMINATOR\s+(\d+)", self.source)
        self.assertIsNotNone(match_num, "MIC_GAIN_NUMERATOR definition not found")
        self.assertIsNotNone(match_den, "MIC_GAIN_DENOMINATOR definition not found")
        numerator = int(match_num.group(1))
        denominator = int(match_den.group(1))
        gain = numerator / denominator
        self.assertGreaterEqual(gain, 2.0, "MIC digital gain should be at least 2.0x")
        self.assertLessEqual(gain, 3.5, "MIC digital gain should be at most 3.5x")

        # Verify apply_mic_gain implementation in source
        self.assertIn("apply_mic_gain", self.source)
        self.assertIn("32767", self.source)
        self.assertIn("-32768", self.source)
    def test_record_silence_duration_allows_natural_pauses(self) -> None:
        match = re.search(r"#define\s+RECORD_SILENCE_DURATION_MS\s+(\d+)", self.source)
        self.assertIsNotNone(match, "RECORD_SILENCE_DURATION_MS definition not found")
        duration = int(match.group(1))
        self.assertEqual(duration, 4000, "RECORD_SILENCE_DURATION_MS should be 4000")
    def test_record_leading_silence_timeout_is_defined(self) -> None:
        match = re.search(r"#define\s+RECORD_LEADING_SILENCE_TIMEOUT_MS\s+(\d+)", self.source)
        self.assertIsNotNone(match, "RECORD_LEADING_SILENCE_TIMEOUT_MS definition not found")
        duration = int(match.group(1))
        self.assertEqual(duration, 6000, "RECORD_LEADING_SILENCE_TIMEOUT_MS should be 6000")

    def test_min_speech_duration_grace_period_is_defined(self) -> None:
        match = re.search(r"#define\s+RECORD_MIN_SPEECH_DURATION_MS\s+(\d+)", self.source)
        self.assertIsNotNone(match, "RECORD_MIN_SPEECH_DURATION_MS definition not found")
        duration = int(match.group(1))
        self.assertGreaterEqual(duration, 300, "RECORD_MIN_SPEECH_DURATION_MS should be at least 300ms")
        self.assertLessEqual(duration, 1000, "RECORD_MIN_SPEECH_DURATION_MS should be reasonable")

    def test_silence_reached_honors_minimum_speech_duration(self) -> None:
        task_body = function_body(
            self.source,
            r"static\s+void\s+wakeword_listener_task\s*\([^)]*\)",
        )
        self.assertIn("recording_speech_detected", task_body)
        self.assertIn("RECORD_LEADING_SILENCE_TIMEOUT_MS", task_body)
        self.assertIn("RECORD_MIN_SPEECH_DURATION_MS", task_body)
        self.assertIn("min_duration_reached", task_body)
        self.assertIn("silence_reached", task_body)
        self.assertIn('finalize_recording("silence_detected")', task_body)
        self.assertIn('fail_recording(\n                    RecordingStatus::ABORTED,\n                    "leading_silence_timeout")', task_body)

    def test_wakeword_listener_task_created_in_psram(self) -> None:
        init_body = function_body(
            self.source,
            r"void\s+wakeword_init\s*\([^)]*\)",
        )
        self.assertIn("xTaskCreatePinnedToCoreWithCaps", init_body)
        self.assertIn("MALLOC_CAP_SPIRAM", init_body)
        self.assertIn("MALLOC_CAP_8BIT", init_body)
        self.assertIn("WAKEWORD_TASK_STACK_SIZE", init_body)

    def test_i2s_ports_are_separated(self) -> None:
        mic_init = function_body(self.source, r"static\s+esp_err_t\s+wakeword_i2s_init\s*\([^)]*\)")
        self.assertIn("I2S_NUM_1", mic_init)

        audio_source = AUDIO_SOURCE.read_text(encoding="utf-8")
        speaker_init = function_body(audio_source, r"void\s+audio_init\s*\([^)]*\)")
        self.assertIn("I2S_NUM_0", speaker_init)

    def test_audio_and_state_and_api_tasks_use_spiram(self) -> None:
        audio_source = AUDIO_SOURCE.read_text(encoding="utf-8")
        speaker_init = function_body(audio_source, r"void\s+audio_init\s*\([^)]*\)")
        self.assertIn("wake_ack_worker", speaker_init)
        self.assertIn("thinking_filler", speaker_init)
        self.assertIn("expression_audio", speaker_init)
        self.assertNotIn("ready_audio", speaker_init)
        self.assertEqual(speaker_init.count("xTaskCreatePinnedToCoreWithCaps"), 3)
        self.assertEqual(speaker_init.count("MALLOC_CAP_SPIRAM"), 3)

        state_source = STATE_SOURCE.read_text(encoding="utf-8")
        state_init = function_body(state_source, r"void\s+joy_state_machine_init\s*\([^)]*\)")
        self.assertIn("xTaskCreateWithCaps", state_init)
        self.assertIn("MALLOC_CAP_SPIRAM", state_init)

        main_source = MAIN_SOURCE.read_text(encoding="utf-8")
        self.assertIn("xTaskCreateWithCaps", main_source)
        self.assertIn("MALLOC_CAP_SPIRAM", main_source)

    def test_wakeword_init_called_early_in_app_main(self) -> None:
        main_source = MAIN_SOURCE.read_text(encoding="utf-8")
        app_main_body = function_body(main_source, r"extern\s+\"C\"\s+void\s+app_main\s*\([^)]*\)")
        self.assertEqual(app_main_body.count("wakeword_init();"), 1)
        audio_pos = app_main_body.find("audio_init();")
        wake_pos = app_main_body.find("wakeword_init();")
        wifi_pos = app_main_body.find("wifi_init();")
        self.assertGreater(wake_pos, audio_pos, "wakeword_init should be after audio_init")
        self.assertLess(wake_pos, wifi_pos, "wakeword_init should be called before wifi_init")

if __name__ == "__main__":
    unittest.main()
