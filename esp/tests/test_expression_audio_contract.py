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
        self.assertRegex(header + source, r"SPEAKER_DEFAULT_VOLUME\s+100")

    def test_voice_recording_does_not_play_expression_cue(self) -> None:
        source = STATE_SOURCE.read_text(encoding="utf-8")
        task = function_body(
            source,
            r"static\s+void\s+joy_state_machine_task\s*\([^)]*\)",
        )
        recording = function_body(
            task,
            r"case\s+JoyState::RECORDING\s*:",
        )

        self.assertNotIn("audio_playExpressionChange();", recording)
        self.assertNotIn("audio_playExpressionChange();", task)
    def test_expression_audio_uses_named_spoken_phrase_at_runtime_volume(self) -> None:
        header = AUDIO_HEADER.read_text(encoding="utf-8")
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
        self.assertNotRegex(playback, r"audio_setVolume\((?:100|SPEAKER_DEFAULT_VOLUME)\);")
        self.assertIn("audio_triggerExpressionAudio", header)
        self.assertIn("audio_cancelExpressionAudio", header)
        self.assertIn("expression_audio_worker_task", source)
        self.assertIn("audio_play_embedded_wav_clip_cancellable", source)

    def test_runtime_volume_is_not_reset_by_local_audio_entrypoints(self) -> None:
        source = AUDIO_SOURCE.read_text(encoding="utf-8")

        for signature in (
            r"void\s+audio_playWakeAck\s*\([^)]*\)",
            r"void\s+audio_playExpressionAudio\s*\([^)]*\)",
            r"void\s+audio_playThinkingFiller\s*\([^)]*\)",
        ):
            body = function_body(source, signature)
            self.assertNotIn("audio_setVolume(SPEAKER_DEFAULT_VOLUME)", body)

        worker = function_body(
            source,
            r"static\s+void\s+thinking_filler_worker_task\s*\([^)]*\)",
        )
        self.assertNotIn("audio_setVolume(SPEAKER_DEFAULT_VOLUME)", worker)
        self.assertGreaterEqual(source.count("speaker_volume_percent()"), 5)


if __name__ == "__main__":
    unittest.main()
