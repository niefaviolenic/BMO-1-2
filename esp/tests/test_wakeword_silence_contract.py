import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WAKEWORD_SOURCE = ROOT / "main" / "wakeword.cpp"


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

    def test_silence_threshold_is_adjusted_for_normal_speech(self) -> None:
        match = re.search(r"#define\s+SILENCE_THRESHOLD\s+(\d+)", self.source)
        self.assertIsNotNone(match, "SILENCE_THRESHOLD definition not found")
        threshold = int(match.group(1))
        self.assertEqual(threshold, 250, "SILENCE_THRESHOLD should be 250")

    def test_record_silence_duration_allows_natural_pauses(self) -> None:
        match = re.search(r"#define\s+RECORD_SILENCE_DURATION_MS\s+(\d+)", self.source)
        self.assertIsNotNone(match, "RECORD_SILENCE_DURATION_MS definition not found")
        duration = int(match.group(1))
        self.assertEqual(duration, 1500, "RECORD_SILENCE_DURATION_MS should be 1500")

    def test_min_speech_duration_grace_period_is_defined(self) -> None:
        match = re.search(r"#define\s+RECORD_MIN_SPEECH_DURATION_MS\s+(\d+)", self.source)
        self.assertIsNotNone(match, "RECORD_MIN_SPEECH_DURATION_MS definition not found")
        duration = int(match.group(1))
        self.assertGreaterEqual(duration, 1200, "RECORD_MIN_SPEECH_DURATION_MS should be at least 1200ms")
        self.assertLessEqual(duration, 2000, "RECORD_MIN_SPEECH_DURATION_MS should be reasonable")

    def test_silence_reached_honors_minimum_speech_duration(self) -> None:
        task_body = function_body(
            self.source,
            r"static\s+void\s+wakeword_listener_task\s*\([^)]*\)",
        )
        self.assertIn("RECORD_MIN_SPEECH_DURATION_MS", task_body)
        self.assertIn("min_duration_reached", task_body)
        self.assertIn("silence_reached", task_body)
        self.assertIn('finalize_recording("silence_detected")', task_body)


if __name__ == "__main__":
    unittest.main()
