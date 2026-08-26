import re
import unittest
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIO_HEADER = ROOT / "main" / "audio.h"
AUDIO_SOURCE = ROOT / "main" / "audio.cpp"
WAKEWORD_SOURCE = ROOT / "main" / "wakeword.cpp"
STATE_SOURCE = ROOT / "main" / "state.cpp"
MAIN_CMAKE = ROOT / "main" / "CMakeLists.txt"
WAKE_ACK_WAV = ROOT / "main" / "audio_wav" / "wake_ack.wav"


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


class WakeAckContractTest(unittest.TestCase):
    def test_audio_header_declares_wake_ack(self) -> None:
        header = AUDIO_HEADER.read_text(encoding="utf-8")
        self.assertIn("void audio_playWakeAck();", header)
        self.assertIn("void audio_triggerWakeAck();", header)

    def test_audio_source_implements_wake_ack_and_symbols(self) -> None:
        source = AUDIO_SOURCE.read_text(encoding="utf-8")

        self.assertIn("_binary_wake_ack_wav_start", source)
        self.assertIn("_binary_wake_ack_wav_end", source)

        wake_ack_body = function_body(source, r"void\s+audio_playWakeAck\s*\(\s*\)")
        self.assertIn("audio_set_sample_rate", wake_ack_body)
        self.assertIn("_binary_wake_ack_wav_start", wake_ack_body)
        self.assertIn("speaker_write_tone", wake_ack_body)
        self.assertIn("speaker_write_silence", wake_ack_body)

        self.assertIn("audio_triggerWakeAck", source)
        self.assertIn("wake_ack_worker_task", source)
        self.assertIn("xTaskNotifyGive", source)
        self.assertIn("ulTaskNotifyTake", source)
    def test_cmake_embeds_wake_ack_wav(self) -> None:
        cmake = MAIN_CMAKE.read_text(encoding="utf-8")
        self.assertRegex(cmake, r'EMBED_FILES[\s\S]*"audio_wav/wake_ack\.wav"')

    def test_wake_ack_wav_format_and_duration(self) -> None:
        self.assertTrue(WAKE_ACK_WAV.is_file(), f"Missing WAV file: {WAKE_ACK_WAV}")

        with wave.open(str(WAKE_ACK_WAV), "rb") as wf:
            self.assertEqual(wf.getnchannels(), 1, "WAV must be mono (1 channel)")
            self.assertEqual(wf.getsampwidth(), 2, "WAV must be 16-bit PCM (2 bytes per sample)")
            self.assertEqual(wf.getframerate(), 16000, "WAV sample rate must be 16000 Hz")

            duration_ms = (wf.getnframes() * 1000) / wf.getframerate()
            self.assertGreaterEqual(duration_ms, 100.0, "Wake cue duration should be at least 100ms")
            self.assertLessEqual(duration_ms, 600.0, "Wake cue duration should be concise (<= 600ms)")

    def test_wakeword_seamless_single_breath_contract(self) -> None:
        source = WAKEWORD_SOURCE.read_text(encoding="utf-8")

        # Pre-roll rolling circular buffer definition
        match_preroll = re.search(r"#define\s+PREROLL_BUFFER_SAMPLES\s+(\d+)", source)
        self.assertIsNotNone(match_preroll, "PREROLL_BUFFER_SAMPLES must be defined in wakeword.cpp")
        preroll_samples = int(match_preroll.group(1))
        self.assertGreaterEqual(preroll_samples, 4096, "Pre-roll buffer should be at least 4096 samples (~256ms)")
        self.assertLessEqual(preroll_samples, 32000, "Pre-roll buffer should be reasonable (<= 32000 samples)")

        task_body = function_body(
            source,
            r"static\s+void\s+wakeword_listener_task\s*\([^)]*\)",
        )

        match_detect = re.search(r"if\s*\(\s*detected\s*==\s*WAKENET_DETECTED\s*\)", task_body)
        self.assertIsNotNone(match_detect, "WAKENET_DETECTED handler not found in wakeword_listener_task")

        detect_block = task_body[match_detect.end() :]
        idx_task = detect_block.find("wakeword_task()")
        self.assertNotEqual(idx_task, -1, "wakeword_task() must be called on WAKENET_DETECTED")
        self.assertIn("audio_triggerWakeAck();", detect_block, "audio_triggerWakeAck() must be called on WAKENET_DETECTED")
        self.assertNotIn("audio_playWakeAck();", detect_block, "audio_playWakeAck() must not block the microphone thread on WAKENET_DETECTED")
        # wakeword_task immediately starts recording with zero handoff latency
        wakeword_task_body = function_body(
            source,
            r"bool\s+wakeword_task\s*\(\s*\)",
        )
        self.assertIn("start_recording()", wakeword_task_body, "wakeword_task must start recording immediately")

        # start_recording commits pre-roll buffer
        start_recording_body = function_body(
            source,
            r"bool\s+start_recording\s*\(\s*\)",
        )
        self.assertIn("preroll_drain_locked", start_recording_body, "start_recording must drain pre-roll buffer")
    def test_recording_state_contract_is_not_altered(self) -> None:
        state_source = STATE_SOURCE.read_text(encoding="utf-8")
        state_task = function_body(
            state_source,
            r"static\s+void\s+joy_state_machine_task\s*\([^)]*\)",
        )
        recording_block = function_body(
            state_task,
            r"case\s+JoyState::RECORDING\s*:",
        )

        self.assertNotIn("audio_playWakeAck", recording_block)
        self.assertIn("start_recording()", recording_block)
        self.assertIn("is_recording()", recording_block)


if __name__ == "__main__":
    unittest.main()
