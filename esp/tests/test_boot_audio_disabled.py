import re
import unittest
from pathlib import Path


MAIN_CPP = Path(__file__).resolve().parents[1] / "main" / "main.cpp"


def app_main_body(source: str) -> str:
    match = re.search(r'extern\s+"C"\s+void\s+app_main\s*\(\s*\)\s*\{', source)
    if match is None:
        raise AssertionError("app_main definition not found")

    depth = 1
    index = match.end()
    body_start = index
    while index < len(source) and depth:
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
        index += 1

    if depth:
        raise AssertionError("app_main closing brace not found")
    return source[body_start : index - 1]


class BootAudioTest(unittest.TestCase):
    def test_boot_runs_speaker_self_test_at_zero_volume(self) -> None:
        body = app_main_body(MAIN_CPP.read_text(encoding="utf-8"))

        self.assertIn("audio_init();", body)
        self.assertIn("audio_setVolume(0);", body)
        self.assertIn("audio_playHello();", body)
        self.assertIn("OUTPUT_DIAG speaker", body)


if __name__ == "__main__":
    unittest.main()
