import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECT_CMAKE = ROOT / "CMakeLists.txt"
API_SOURCE = ROOT / "main" / "api.cpp"
PAIRING_SOURCE = ROOT / "main" / "pairing.cpp"
DISPLAY_SOURCE = ROOT / "main" / "display.cpp"


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


class PairingUiSuppressionContractTest(unittest.TestCase):
    def read(self, path: Path) -> str:
        self.assertTrue(path.exists(), f"required file is missing: {path}")
        return path.read_text(encoding="utf-8")

    def test_project_flag_defaults_off_and_generates_dev_config_header(self) -> None:
        cmake = self.read(PROJECT_CMAKE)
        api = self.read(API_SOURCE)

        self.assertRegex(
            cmake,
            re.compile(
                r'option\s*\(\s*JOY_DEV_SUPPRESS_PAIRING_UI\b.*?OFF\s*\)',
                re.DOTALL,
            ),
        )
        self.assertIn("JOY_DEV_SUPPRESS_PAIRING_UI_VALUE", cmake)
        self.assertIn("joy_dev_config.h", cmake)
        self.assertIn('#include "joy_dev_config.h"', api)

    def test_suppression_guards_only_pairing_code_rendering(self) -> None:
        api = self.read(API_SOURCE)
        processor = function_body(
            api,
            r"static\s+void\s+process_pairing_actions\s*\([^)]*\)",
        )

        guarded_render = re.search(
            r"#if\s*!JOY_DEV_SUPPRESS_PAIRING_UI(?P<body>.*?)#endif",
            processor,
            re.DOTALL,
        )
        self.assertIsNotNone(guarded_render, "pairing UI suppression guard is missing")
        self.assertIn("pairing_get_snapshot", guarded_render.group("body"))
        self.assertIn("display_set_pairing_code", guarded_render.group("body"))
        self.assertNotIn("pairing_poll", guarded_render.group("body"))
        self.assertNotIn("display_clear_pairing_code", guarded_render.group("body"))
        self.assertEqual(processor.count("display_set_pairing_code"), 1)

        for preserved_side_effect in (
            "pairing_poll",
            "display_clear_pairing_code",
            "send_pairing_mode_request",
            "ws_pairing_reconnect_pending = true",
        ):
            self.assertIn(preserved_side_effect, processor)

    def test_pairing_code_state_and_expiry_paths_remain_protocol_owned(self) -> None:
        api = self.read(API_SOURCE)
        pairing = self.read(PAIRING_SOURCE)

        pairing_branch = api[
            api.index('else if (strcmp(event, "pairing_code") == 0)') :
            api.index('else if (strcmp(event, "pairing_completed") == 0)')
        ]
        self.assertIn("pairing_on_code", pairing_branch)
        self.assertNotIn("display_set_pairing_code", pairing_branch)

        code_handler = function_body(pairing, r"bool\s+pairing_on_code\s*\([^)]*\)")
        self.assertIn("std::memcpy(s_controller.snapshot.code, code, 6)", code_handler)
        self.assertIn("PairingPhase::CODE_ACTIVE", code_handler)
        self.assertIn("PAIRING_ACTION_SHOW_UI", code_handler)

        poller = function_body(pairing, r"uint8_t\s+pairing_poll\s*\([^)]*\)")
        self.assertIn("expires_at_epoch", poller)
        self.assertIn("PairingPhase::CODE_EXPIRED", poller)
        self.assertIn("PAIRING_ACTION_CLEAR_UI", poller)
        self.assertIn("PAIRING_ACTION_SEND_REQUEST", poller)

    def test_pairing_completion_and_reconnect_paths_remain_unchanged(self) -> None:
        api = self.read(API_SOURCE)
        pairing = self.read(PAIRING_SOURCE)

        completion_branch = api[
            api.index('else if (strcmp(event, "pairing_completed") == 0)') :
            api.index('else if (strcmp(event, "display_status") == 0)')
        ]
        self.assertIn("pairing_on_completed();", completion_branch)
        self.assertIn('strcmp(status_node->valuestring, "ok") == 0', completion_branch)

        completion = function_body(pairing, r"void\s+pairing_on_completed\s*\([^)]*\)")
        self.assertIn("secure_clear_code_locked", completion)
        self.assertIn("PAIRING_ACTION_CLEAR_UI", completion)
        self.assertIn("PAIRING_ACTION_RECONNECT", completion)

        monitor = function_body(api, r"static\s+void\s+ws_monitor_task\s*\([^)]*\)")
        self.assertIn('start_ws_if_network_ready("pairing_reconnect")', monitor)
        self.assertIn('stop_ws_if_started("pairing_completed")', monitor)

    def test_pairing_renderer_has_no_suppression_or_orientation_change(self) -> None:
        display = self.read(DISPLAY_SOURCE)

        self.assertNotIn("JOY_DEV_SUPPRESS_PAIRING_UI", display)
        self.assertNotIn("BMO_DEV_SUPPRESS_PAIRING_UI", display)
        self.assertIn("PAIRING_NUMERIC_GLYPHS", display)
        self.assertIn("PAIRING_GLYPH_COLUMNS - 1 - column", display)
        self.assertIn("x + column * PAIRING_GLYPH_SCALE_X", display)
        self.assertIn("y + row * PAIRING_GLYPH_SCALE_Y", display)
        self.assertIn("#define LCD_MIRROR_X true", display)
        self.assertIn("#define LCD_MIRROR_Y false", display)
        self.assertIn("esp_lcd_panel_swap_xy", display)
        self.assertIn("esp_lcd_panel_mirror", display)


if __name__ == "__main__":
    unittest.main()
