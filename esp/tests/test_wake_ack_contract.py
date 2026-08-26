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

    def test_audio_source_implements_wake_ack_and_symbols(self) -> None:
        source = AUDIO_SOURCE.read_text(encoding="utf-8")

        self.assertIn("_binary_wake_ack_wav_start", source)
        self.assertIn("_binary_wake_ack_wav_end", source)

        wake_ack_body = function_body(source, r"void\s+audio_playWakeAck\s*\(\s*\)")
        self.assertIn("audio_set_sample_rate", wake_ack_body)
        self.assertIn("_binary_wake_ack_wav_start", wake_ack_body)
        self.assertIn("speaker_write_tone", wake_ack_body)
        self.assertIn("speaker_write_silence", wake_ack_body)

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

    def test_wakeword_listener_calls_wake_ack_before_wakeword_task(self) -> None:
        source = WAKEWORD_SOURCE.read_text(encoding="utf-8")
        task_body = function_body(
            source,
            r"static\s+void\s+wakeword_listener_task\s*\([^)]*\)",
        )

        match_detect = re.search(r"if\s*\(\s*detected\s*==\s*WAKENET_DETECTED\s*\)", task_body)
        self.assertIsNotNone(match_detect, "WAKENET_DETECTED handler not found in wakeword_listener_task")

        detect_block = task_body[match_detect.end() :]
        idx_ack = detect_block.find("audio_playWakeAck();")
        idx_task = detect_block.find("wakeword_task()")

        self.assertNotEqual(idx_ack, -1, "audio_playWakeAck() must be called on WAKENET_DETECTED")
        self.assertNotEqual(idx_task, -1, "wakeword_task() must be called on WAKENET_DETECTED")
        self.assertLess(
            idx_ack,
            idx_task,
            "audio_playWakeAck() must be called before wakeword_task() to prevent recording the wake cue",
        )

    def test_recording_state_contract_is_not_altered(self) -> None:
        state_source = STATE_SOURCE.read_text(encoding="utf-8")
        state_task = function_body(
            state_source,
            r"static\s+void\s+bmo_state_machine_task\s*\([^)]*\)",
        )
        recording_block = function_body(
            state_task,
            r"case\s+BMOState::RECORDING\s*:",
        )

        self.assertNotIn("audio_playWakeAck", recording_block)
        self.assertIn("start_recording()", recording_block)
        self.assertIn("is_recording()", recording_block)


if __name__ == "__main__":
    unittest.main()
