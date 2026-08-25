import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIO_HEADER = ROOT / "main" / "audio.h"
AUDIO_SOURCE = ROOT / "main" / "audio.cpp"
STATE_SOURCE = ROOT / "main" / "state.cpp"


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


class ExpressionAudioContractTest(unittest.TestCase):
    def test_expression_change_has_a_melodic_cue_and_full_default_volume(self) -> None:
        header = AUDIO_HEADER.read_text(encoding="utf-8")
        source = AUDIO_SOURCE.read_text(encoding="utf-8")

        self.assertIn("audio_playExpressionChange", header)
        self.assertIn("audio_playExpressionAudio", header)
        cue = function_body(source, r"void\s+audio_playExpressionChange\s*\([^)]*\)")
        self.assertIn("melody_hz", cue)
        self.assertGreaterEqual(cue.count("speaker_write_tone"), 1)
        self.assertIn("speaker_write_silence", cue)
        self.assertIn("SPEAKER_DEFAULT_VOLUME 100", source)

    def test_expression_cue_is_owned_by_touch_not_voice_recording(self) -> None:
        button = (ROOT / "main" / "button.cpp").read_text(encoding="utf-8")
        source = STATE_SOURCE.read_text(encoding="utf-8")
        task = function_body(
            source,
            r"static\s+void\s+bmo_state_machine_task\s*\([^)]*\)",
        )
        recording = function_body(
            task,
            r"case\s+BMOState::RECORDING\s*:",
        )

        self.assertNotIn("audio_playExpressionChange();", recording)
        self.assertNotIn("audio_playExpressionChange();", task)
        self.assertIn("audio_playExpressionAudio((int)face_after);", button)

    def test_expression_audio_uses_named_spoken_phrase_at_full_volume(self) -> None:
        source = AUDIO_SOURCE.read_text(encoding="utf-8")
        playback = function_body(
            source,
            r"void\s+audio_playExpressionAudio\s*\([^)]*\)",
        )

        for phrase in (
            "aku happy",
            "aku cute",
            "aku excited",
            "aku sleepy",
            "aku angry",
            "aku sedih",
            "aku wink",
            "aku surprised",
            "aku love",
            "aku confused",
        ):
            self.assertIn(phrase, source)
        self.assertIn("audio_setVolume(100);", playback)


if __name__ == "__main__":
    unittest.main()
