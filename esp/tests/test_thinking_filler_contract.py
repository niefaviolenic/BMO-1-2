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
        self.assertRegex(
            header,
            r"void\s+audio_startThinkingFillerLoop\s*\(\s*\)\s*;",
            "audio.h must declare void audio_startThinkingFillerLoop();",
        )
        self.assertRegex(
            header,
            r"void\s+audio_stopThinkingFillerLoop\s*\(\s*\)\s*;",
            "audio.h must declare void audio_stopThinkingFillerLoop();",
        )
        self.assertRegex(
            header,
            r"bool\s+audio_isThinkingFillerLoopRunning\s*\(\s*\)\s*;",
            "audio.h must declare bool audio_isThinkingFillerLoopRunning();",
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

    def test_recording_completed_triggers_random_thinking_filler(self) -> None:
        state_source = STATE_SOURCE.read_text(encoding="utf-8")
        task_body = function_body(
            state_source,
            r"static\s+void\s+joy_state_machine_task\s*\([^)]*\)",
        )
        self.assertIn(
            "audio_startThinkingFillerLoop()",
            task_body,
            "state.cpp must call audio_startThinkingFillerLoop() on recording completion",
        )

        recording_case = re.search(
            r"case\s+JoyState::RECORDING\s*:(?P<body>.*?)case\s+JoyState::THINKING\s*:",
            task_body,
            re.DOTALL,
        )
        self.assertIsNotNone(recording_case, "RECORDING branch not found in state task")
        body = recording_case.group("body")
        self.assertIn(
            "audio_startThinkingFillerLoop()",
            body,
            "RECORDING state completion must trigger audio_startThinkingFillerLoop() before upload",
        )
        filler_pos = body.index("audio_startThinkingFillerLoop()")
        upload_pos = body.index("api_upload_audio_and_process()")
        self.assertLess(
            filler_pos,
            upload_pos,
            "audio_startThinkingFillerLoop() must be triggered before api_upload_audio_and_process()",
        )
        self.assertIn("setState(JoyState::THINKING)", body, "Must transition to THINKING state on recording completion")
        thinking_pos = body.index("setState(JoyState::THINKING)")
        self.assertLess(
            thinking_pos,
            filler_pos,
            "setState(JoyState::THINKING) must precede audio_startThinkingFillerLoop() so confused face renders during filler voice",
        )
    def test_api_does_not_duplicate_thinking_filler(self) -> None:
        api_source = API_SOURCE.read_text(encoding="utf-8")
        upload_proc_body = function_body(
            api_source,
            r"void\s+api_upload_audio_and_process\s*\(\s*\)",
        )
        self.assertNotIn(
            "audio_playRandomThinkingFiller()",
            upload_proc_body,
            "api_upload_audio_and_process() must not duplicate audio_playRandomThinkingFiller()",
        )

    def test_audio_source_implements_loop_controls(self) -> None:
        source = AUDIO_SOURCE.read_text(encoding="utf-8")
        self.assertIn("void audio_startThinkingFillerLoop()", source)
        self.assertIn("void audio_stopThinkingFillerLoop()", source)
        self.assertIn("bool audio_isThinkingFillerLoopRunning()", source)
        self.assertIn("thinking_filler_worker_task", source)
        self.assertIn("audio_play_embedded_wav_clip_cancellable", source)

    def test_api_stops_filler_loop_on_playback_and_errors(self) -> None:
        api_source = API_SOURCE.read_text(encoding="utf-8")
        handle_failed_body = function_body(
            api_source,
            r"static\s+void\s+handle_request_failed\s*\(\s*const\s+char\s*\*\s*code\s*\)",
        )
        self.assertIn(
            "audio_stopThinkingFillerLoop()",
            handle_failed_body,
            "handle_request_failed must stop thinking filler loop",
        )

        download_play_body = function_body(
            api_source,
            r"static\s+JoyPlaybackResult\s+download_and_play_mp3\s*\(\s*const\s+PlaybackJob\s*\*\s*job\s*\)",
        )
        self.assertIn(
            "audio_stopThinkingFillerLoop()",
            download_play_body,
            "download_and_play_mp3 must stop thinking filler loop",
        )

if __name__ == "__main__":
    unittest.main()
