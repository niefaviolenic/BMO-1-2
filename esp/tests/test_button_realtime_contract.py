import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUTTON_SOURCE = ROOT / "main" / "button.cpp"


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


class ButtonRealtimeContractTest(unittest.TestCase):
    def test_volume_is_edge_triggered_once_per_stable_press(self) -> None:
        source = BUTTON_SOURCE.read_text(encoding="utf-8")
        helper = function_body(
            source,
            r"static\s+bool\s+update_debounced_button\s*\([^)]*\)",
        )
        update = function_body(source, r"void\s+button_update\s*\([^)]*\)")

        self.assertNotIn("BUTTON_REPEAT_US", source)
        self.assertNotIn("last_up_us", source)
        self.assertNotIn("last_down_us", source)
        self.assertIn("BUTTON_DEBOUNCE_US", helper)
        self.assertIn("candidate_pressed != button.stable_pressed", helper)
        self.assertIn("return button.stable_pressed", helper)
        self.assertEqual(update.count("audio_adjustVolume(VOLUME_STEP)"), 1)
        self.assertEqual(update.count("audio_adjustVolume(-VOLUME_STEP)"), 1)

    def test_volume_press_model_does_not_repeat_while_held(self) -> None:
        class DebouncedButton:
            DEBOUNCE_US = 30_000

            def __init__(self) -> None:
                self.candidate = False
                self.stable = False
                self.candidate_since = 0

            def update(self, pressed: bool, now_us: int) -> bool:
                if pressed != self.candidate:
                    self.candidate = pressed
                    self.candidate_since = now_us
                if (
                    self.candidate != self.stable
                    and now_us - self.candidate_since >= self.DEBOUNCE_US
                ):
                    self.stable = self.candidate
                    return self.stable
                return False

        button = DebouncedButton()
        samples = [
            (False, 0),
            (True, 10_000),
            (True, 50_000),
            (True, 250_000),
            (True, 500_000),
            (False, 520_000),
            (False, 560_000),
            (True, 580_000),
            (True, 620_000),
        ]
        self.assertEqual(sum(button.update(level, now) for level, now in samples), 2)

    def test_gpio17_keeps_local_cycle_without_network_gate(self) -> None:
        source = BUTTON_SOURCE.read_text(encoding="utf-8")
        update = function_body(source, r"void\s+button_update\s*\([^)]*\)")

        self.assertIn("BTN_EXPRESSION GPIO_NUM_17", source)
        self.assertIn("display_next_touch_face()", update)
        self.assertIn("audio_triggerExpressionAudio((int)next_face)", update)
        self.assertNotIn("api_ws_is_authenticated", source)
        self.assertNotIn('#include "api.h"', source)
        self.assertIn("getState() == JoyState::IDLE", update)
        self.assertIn("display_pairing_code_is_visible", update)
        self.assertIn("display_qr_code_is_visible", update)


if __name__ == "__main__":
    unittest.main()
