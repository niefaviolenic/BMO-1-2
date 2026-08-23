import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_SOURCE = ROOT / "main" / "api.cpp"
PLAYBACK_HEADER = ROOT / "main" / "playback.h"
PLAYBACK_SOURCE = ROOT / "main" / "playback.cpp"
MAIN_CMAKE = ROOT / "main" / "CMakeLists.txt"


def function_body(source: str, signature: str) -> str:
    match = re.search(signature + r"\s*\{", source)
    if match is None:
        raise AssertionError(f"function not found: {signature}")

    depth = 1
    index = match.end()
    while index < len(source) and depth:
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
        index += 1

    if depth:
        raise AssertionError(f"function closing brace not found: {signature}")
    return source[match.end() : index - 1]


class SharedPlaybackContractTest(unittest.TestCase):
    def read(self, path: Path) -> str:
        self.assertTrue(path.exists(), f"required playback file is missing: {path}")
        return path.read_text(encoding="utf-8")

    def test_playback_module_is_built_and_exposes_job_model(self) -> None:
        header = self.read(PLAYBACK_HEADER)
        cmake = self.read(MAIN_CMAKE)

        self.assertRegex(cmake, r'idf_component_register\s*\([^)]*"playback\.cpp"')
        for declaration in (
            "enum class PlaybackOrigin",
            "VOICE_RESPONSE",
            "PROACTIVE",
            "struct PlaybackJob",
            "correlation_id",
            "audio_url",
            "expires_in_seconds",
            "source",
            "playback_admit_voice_job",
            "playback_prepare_proactive",
            "playback_mark_terminal",
            "playback_is_expired",
            "playback_url_is_valid",
        ):
            self.assertIn(declaration, header)

    def test_voice_audio_ready_adapts_into_shared_job_before_download(self) -> None:
        api = self.read(API_SOURCE)
        branch_start = api.index('else if (strcmp(event, "audio_ready") == 0)')
        branch_end = api.index('else if (strcmp(event, "request_failed") == 0)', branch_start)
        branch = api[branch_start:branch_end]

        self.assertIn("request_is_known", branch)
        self.assertIn("adopt_recovered_request", branch)
        self.assertIn("PlaybackJob", branch)
        self.assertIn("PlaybackOrigin::VOICE_RESPONSE", branch)
        self.assertIn("playback_admit_voice_job", branch)
        self.assertNotIn("proactive_audio_ready", api)
        self.assertNotIn("proactive_playback_done", api)
        self.assertNotIn("proactive_playback_failed", api)

        downloader = function_body(
            api,
            r"static\s+BMOPlaybackResult\s+download_and_play_mp3\s*\([^)]*\)",
        )
        self.assertIn("playback_is_expired", downloader)
        self.assertIn("job->audio_url", downloader)

    def test_proactive_adapter_is_isolated_from_websocket_event_parsing(self) -> None:
        api = self.read(API_SOURCE)
        playback = self.read(PLAYBACK_SOURCE)

        self.assertIn("playback_prepare_proactive", playback)
        self.assertIn("PlaybackOrigin::PROACTIVE", playback)
        self.assertIn("PlaybackAdmission", playback)
        self.assertNotIn("handle_proactive_audio_event", api)
        self.assertNotIn('strcmp(event, "proactive_audio_ready")', api)
        self.assertNotIn('strcmp(event, "proactive_playback_done")', api)
        self.assertNotIn('strcmp(event, "proactive_playback_failed")', api)

    def test_proactive_admission_checks_voice_priority_and_one_owner(self) -> None:
        playback = self.read(PLAYBACK_SOURCE)
        adapter = function_body(
            playback,
            r"PlaybackAdmission\s+playback_prepare_proactive\s*\([^)]*\)",
        )
        state_guard = function_body(
            playback,
            r"bool\s+proactive_state_blocks\s*\([^)]*\)",
        )

        for state in (
            "RECORDING",
            "UPLOADING",
            "THINKING",
            "DOWNLOADING",
            "SPEAKING",
        ):
            self.assertIn(f"PlaybackLocalState::{state}", state_guard)
        self.assertRegex(adapter, r"s_state\.active|active_job")
        self.assertIn("PlaybackAdmission::BUSY", adapter)

    def test_proactive_deduplication_is_bounded_and_retains_terminal_result(self) -> None:
        header = self.read(PLAYBACK_HEADER)
        playback = self.read(PLAYBACK_SOURCE)

        for field in (
            "current_proactive_delivery_id",
            "last_terminal_proactive_delivery_id",
            "last_terminal_proactive_result",
        ):
            self.assertIn(field, header + playback)
        self.assertIn("PlaybackAdmission::DUPLICATE", playback)
        self.assertIn("strncpy", playback)
        self.assertNotIn("std::vector", playback)
        self.assertNotIn("std::map", playback)

    def test_expiry_and_url_validation_are_shared_for_both_origins(self) -> None:
        header = self.read(PLAYBACK_HEADER)
        playback = self.read(PLAYBACK_SOURCE)

        self.assertIn("int64_t deadline_monotonic_ms", header + playback)
        self.assertIn("expires_in_seconds == 0", playback)
        self.assertIn("https://api.personalbmo.web.id/audio/", playback)
        self.assertIn("PlaybackAdmission::EXPIRED", playback)


if __name__ == "__main__":
    unittest.main()
