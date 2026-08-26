import re
import unittest
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIO_HEADER = ROOT / "main" / "audio.h"
AUDIO_SOURCE = ROOT / "main" / "audio.cpp"
API_SOURCE = ROOT / "main" / "api.cpp"
STATE_SOURCE = ROOT / "main" / "state.cpp"
MAIN_CMAKE = ROOT / "main" / "CMakeLists.txt"
AUDIO_WAV_DIR = ROOT / "main" / "audio_wav"

THINKING_CLIPS = [
    ("thinking_01.wav", "bentar aku pikir dulu"),
    ("thinking_02.wav", "aku lagi proses dulu pertanyaannya"),
    ("thinking_03.wav", "tunggu sebentar ya"),
    ("thinking_04.wav", "hmm coba aku cari tahu dulu"),
    ("thinking_05.wav", "bentar ya joy lagi mikir"),
]


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


class ThinkingFillerContractTest(unittest.TestCase):
    def test_audio_header_declares_thinking_filler_functions(self) -> None:
        header = AUDIO_HEADER.read_text(encoding="utf-8")
        self.assertRegex(
            header,
            r"void\s+audio_playThinkingFiller\s*\(\s*int\s+[a-zA-Z0-9_]+\s*\)\s*;",
            "audio.h must declare void audio_playThinkingFiller(int index);",
        )
        self.assertRegex(
            header,
            r"void\s+audio_playRandomThinkingFiller\s*\(\s*\)\s*;",
            "audio.h must declare void audio_playRandomThinkingFiller();",
        )

    def test_audio_source_embeds_thinking_clips_and_phrases(self) -> None:
        source = AUDIO_SOURCE.read_text(encoding="utf-8")

        for i in range(1, 6):
            clip_start = f"_binary_thinking_{i:02d}_wav_start"
            clip_end = f"_binary_thinking_{i:02d}_wav_end"
            self.assertIn(clip_start, source, f"Missing start symbol for clip {i}")
            self.assertIn(clip_end, source, f"Missing end symbol for clip {i}")

        for _, phrase in THINKING_CLIPS:
            self.assertIn(
                phrase,
                source,
                f"audio.cpp must define spoken phrase '{phrase}' for thinking filler",
            )

        filler_body = function_body(
            source,
            r"void\s+audio_playThinkingFiller\s*\(\s*int\s+[a-zA-Z0-9_]+\s*\)",
        )
        self.assertIn("speaker_write_tone", filler_body, "audio_playThinkingFiller must support fallback tones")

        random_filler_body = function_body(
            source,
            r"void\s+audio_playRandomThinkingFiller\s*\(\s*\)",
        )
        self.assertIn("audio_playThinkingFiller", random_filler_body)

    def test_cmake_embeds_all_thinking_wavs(self) -> None:
        cmake = MAIN_CMAKE.read_text(encoding="utf-8")
        for filename, _ in THINKING_CLIPS:
            self.assertRegex(
                cmake,
                rf'EMBED_FILES[\s\S]*"audio_wav/{filename}"',
                f"CMakeLists.txt must embed audio_wav/{filename}",
            )

    def test_thinking_wav_files_format_and_duration(self) -> None:
        for filename, _ in THINKING_CLIPS:
            wav_path = AUDIO_WAV_DIR / filename
            self.assertTrue(wav_path.is_file(), f"Missing WAV file on disk: {wav_path}")

            with wave.open(str(wav_path), "rb") as wf:
                self.assertEqual(wf.getnchannels(), 1, f"{filename} must be mono (1 channel)")
                self.assertEqual(wf.getsampwidth(), 2, f"{filename} must be 16-bit PCM (2 bytes per sample)")
                self.assertEqual(wf.getframerate(), 16000, f"{filename} sample rate must be 16000 Hz")

                duration_ms = (wf.getnframes() * 1000) / wf.getframerate()
                self.assertGreaterEqual(
                    duration_ms,
                    500.0,
                    f"{filename} duration should be >= 500ms (got {duration_ms:.1f}ms)",
                )
                self.assertLessEqual(
                    duration_ms,
                    2500.0,
                    f"{filename} duration should be <= 2500ms (got {duration_ms:.1f}ms)",
                )

    def test_upload_accepted_triggers_random_thinking_filler(self) -> None:
        api_source = API_SOURCE.read_text(encoding="utf-8")
        state_source = STATE_SOURCE.read_text(encoding="utf-8")
        combined_source = api_source + "\n" + state_source

        self.assertIn(
            "audio_playRandomThinkingFiller()",
            combined_source,
            "api.cpp or state.cpp must call audio_playRandomThinkingFiller() on upload accept / recording completion",
        )

        upload_proc_body = function_body(
            api_source,
            r"void\s+api_upload_audio_and_process\s*\(\s*\)",
        )
        self.assertIn(
            "audio_playRandomThinkingFiller()",
            upload_proc_body,
            "api_upload_audio_and_process() must trigger audio_playRandomThinkingFiller() when upload is accepted",
        )


if __name__ == "__main__":
    unittest.main()
