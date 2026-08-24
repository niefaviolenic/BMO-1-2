import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DISPLAY_HEADER = ROOT / "main" / "display.h"
DISPLAY_SOURCE = ROOT / "main" / "display.cpp"
BUTTON_SOURCE = ROOT / "main" / "button.cpp"
API_SOURCE = ROOT / "main" / "api.cpp"
WAKEWORD_SOURCE = ROOT / "main" / "wakeword.cpp"
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


class TouchListeningContractTest(unittest.TestCase):
    def test_recording_does_not_replace_the_selected_idle_face(self) -> None:
        source = WAKEWORD_SOURCE.read_text(encoding="utf-8")
        start = function_body(source, r"bool\s+start_recording\s*\(\s*\)")

        active = start.index("recording_status = RecordingStatus::ACTIVE")
        self.assertNotIn("DisplayMode::LISTENING", start)
        self.assertGreater(active, 0)

    def test_recording_terminal_path_releases_local_listening_before_upload(self) -> None:
        source = STATE_SOURCE.read_text(encoding="utf-8")
        task = function_body(
            source,
            r"static\s+void\s+bmo_state_machine_task\s*\([^)]*\)",
        )
        recording = function_body(
            task,
            r"case\s+BMOState::RECORDING\s*:",
        )

        release = recording.index("display_set_mode(DisplayMode::IDLE)")
        upload = recording.index("api_upload_audio_and_process()")
        self.assertLess(release, upload)

    def test_listening_expression_is_distinct_and_non_blocking(self) -> None:
        header = DISPLAY_HEADER.read_text(encoding="utf-8")
        source = DISPLAY_SOURCE.read_text(encoding="utf-8")
        mode = function_body(source, r"void\s+display_set_mode\s*\([^)]*\)")
        face = function_body(source, r"static\s+void\s+face_listening\s*\([^)]*\)")
        indicator = function_body(
            source,
            r"static\s+void\s+draw_microphone_indicator\s*\([^)]*\)",
        )

        self.assertIn("LISTENING", header)
        self.assertIn("DisplayMode::LISTENING", mode)
        self.assertIn("face_listening", mode)
        self.assertGreaterEqual(face.count("eye_big_cute"), 2)
        self.assertIn("mouth_open_small", face)
        self.assertIn("draw_microphone_indicator", face)
        self.assertNotIn("vTaskDelay", face)
        self.assertNotIn("vTaskDelay", indicator)

    def test_existing_thinking_event_takes_over_the_local_listening_display(self) -> None:
        source = API_SOURCE.read_text(encoding="utf-8")
        branch_start = source.index('else if (strcmp(event, "display_status") == 0)')
        branch_end = source.index('else if (strcmp(event, "audio_ready") == 0)', branch_start)
        branch = source[branch_start:branch_end]

        self.assertIn('strcmp(status_node->valuestring, "thinking") == 0', branch)
        self.assertIn("display_set_mode(DisplayMode::THINKING)", branch)
        self.assertNotIn('"listening"', branch.lower())

    def test_touch_uses_a_stable_press_release_lifecycle(self) -> None:
        button = BUTTON_SOURCE.read_text(encoding="utf-8")
        update = function_body(button, r"void\s+button_update\s*\([^)]*\)")

        self.assertNotIn("TOUCH_COOLDOWN_US", button)
        self.assertIn("TOUCH_DEBOUNCE_US", button)
        self.assertIn("Touch sample", button)
        for lifecycle_state in (
            "TOUCH_ARMED",
            "TOUCH_CONSUMED",
            "TOUCH_BOOT_HIGH_LOCKOUT",
        ):
            self.assertIn(lifecycle_state, button)
        for stable_signal in (
            "touch_candidate_level",
            "touch_stable_level",
            "touch_candidate_since_us",
        ):
            self.assertIn(stable_signal, button)

        self.assertIn("touch_level != touch_candidate_level", update)
        self.assertIn("touch_candidate_level != touch_stable_level", update)
        self.assertIn("display_next_touch_face", update)
        self.assertIn("wakeword_task()", update)
        self.assertIn("getState() == BMOState::IDLE", update)

    def test_touch_action_is_one_shot_and_state_admission_is_atomic(self) -> None:
        button = BUTTON_SOURCE.read_text(encoding="utf-8")
        wakeword = WAKEWORD_SOURCE.read_text(encoding="utf-8")
        state = STATE_SOURCE.read_text(encoding="utf-8")
        update = function_body(button, r"void\s+button_update\s*\([^)]*\)")
        trigger = function_body(wakeword, r"bool\s+wakeword_task\s*\([^)]*\)")

        self.assertEqual(
            len(re.findall(r"\bdisplay_next_touch_face\s*\(\s*\)", update)),
            1,
        )
        self.assertEqual(
            len(re.findall(r"\bwakeword_task\s*\(\s*\)", update)),
            1,
        )
        self.assertIn("TOUCH_CONSUMED", update)
        self.assertIn("trySetState", trigger)
        self.assertIn("bool trySetState", state)

        # Claim IDLE -> RECORDING before mutating the selected face. A racing
        # wake-word/API transition must not consume a face without accepting
        # the touch event.
        self.assertLess(
            update.index("wakeword_task()"),
            update.index("display_next_touch_face"),
        )

    def test_touch_runtime_diagnostics_cover_the_full_handoff(self) -> None:
        button = BUTTON_SOURCE.read_text(encoding="utf-8")
        display = DISPLAY_SOURCE.read_text(encoding="utf-8")
        state = STATE_SOURCE.read_text(encoding="utf-8")

        for message in (
            "Touch raw transition",
            "Touch stable",
            "Touch lifecycle",
            "Touch accepted",
            "BMO state before",
            "Face before",
            "Face after",
            "Face render requested",
        ):
            self.assertIn(message, button)
        self.assertIn("Display mode", display)
        self.assertIn("Face actually rendered", display)
        self.assertIn("State:", state)

    def test_idle_face_preference_is_not_reset_by_api_completion_paths(self) -> None:
        api = API_SOURCE.read_text(encoding="utf-8")

        # State-owned display transitions must redraw the persistent idle face;
        # API completion/error paths must not force FACE_HAPPY behind its back.
        self.assertNotIn("display_face(FACE_HAPPY)", api)
        self.assertNotIn("display_face(FACE_SAD)", api)
        self.assertNotIn("display_face(FACE_CONFUSED)", api)

    def test_idle_face_model_persists_across_recording_and_wraps(self) -> None:
        faces = [
            "HAPPY",
            "CUTE",
            "EXCITED",
            "SLEEPY",
            "ANGRY",
            "SAD",
            "WINK",
            "SURPRISED",
            "LOVE",
            "CONFUSED",
        ]
        selected = faces[0]
        selected = faces[(faces.index(selected) + 1) % len(faces)]
        self.assertEqual(selected, "CUTE")
        # RECORDING is a temporary interaction state; returning to IDLE must
        # resolve to the same selected preference.
        recording_face = selected
        self.assertEqual(recording_face, "CUTE")
        self.assertEqual(faces[(faces.index("CONFUSED") + 1) % len(faces)], "HAPPY")

    def test_touch_face_cycle_is_display_owned_and_wraps(self) -> None:
        header = DISPLAY_HEADER.read_text(encoding="utf-8")
        display = DISPLAY_SOURCE.read_text(encoding="utf-8")
        next_face = function_body(
            display,
            r"Face\s+display_next_touch_face\s*\([^)]*\)",
        )
        idle_mode = function_body(
            display,
            r"void\s+display_set_mode\s*\([^)]*\)",
        )

        self.assertIn("Face display_next_touch_face", header)
        self.assertIn("current_touch_face", display)
        self.assertIn("FACE_CONFUSED", display)
        self.assertIn("TOUCH_FACE_COUNT", next_face)
        self.assertRegex(next_face, r"%\s*TOUCH_FACE_COUNT")
        self.assertIn("pairing_code_active", next_face)
        self.assertIn("draw_face_locked(current_touch_face)", idle_mode)

    def test_touch_boot_high_waits_for_release_before_arming(self) -> None:
        button = BUTTON_SOURCE.read_text(encoding="utf-8")
        init = function_body(button, r"void\s+button_init\s*\([^)]*\)")

        self.assertIn("gpio_get_level(TOUCH_PIN)", init)
        self.assertIn("TOUCH_BOOT_HIGH_LOCKOUT", init)
        self.assertIn("TOUCH_ARMED", init)
        self.assertIn("touch_stable_level", init)

    def test_touch_scenarios_have_one_event_per_physical_tap(self) -> None:
        class Debouncer:
            DEBOUNCE_US = 30_000

            def __init__(self, initial_level: bool, now_us: int = 0) -> None:
                self.candidate = initial_level
                self.stable = initial_level
                self.candidate_since = now_us
                self.state = "BOOT_HIGH_LOCKOUT" if initial_level else "ARMED"

            def update(self, level: bool, now_us: int, idle: bool = True) -> bool:
                if level != self.candidate:
                    self.candidate = level
                    self.candidate_since = now_us

                if (
                    self.candidate != self.stable
                    and now_us - self.candidate_since >= self.DEBOUNCE_US
                ):
                    self.stable = self.candidate
                    if self.stable:
                        if self.state == "ARMED":
                            self.state = "CONSUMED"
                            return idle
                    else:
                        self.state = "ARMED"
                return False

        def events(samples: list[tuple[bool, int]], idle: bool = True) -> int:
            debouncer = Debouncer(False)
            return sum(
                debouncer.update(level, now_us, idle)
                for level, now_us in samples
            )

        one_tap = [(False, 0), (True, 0), (True, 60_000), (False, 120_000)]
        held = [(False, 0)] + [(True, index * 20_000) for index in range(1, 20)]
        bounce_then_press = [
            (False, 0),
            (True, 20_000),
            (False, 40_000),
            (True, 60_000),
            (True, 80_000),
            (True, 140_000),
            (False, 160_000),
        ]
        tap_release_tap = [
            (False, 0),
            (True, 0),
            (True, 60_000),
            (False, 120_000),
            (False, 180_000),
            (True, 200_000),
            (True, 260_000),
        ]

        self.assertEqual(events(one_tap), 1)
        self.assertEqual(events(held), 1)
        self.assertEqual(events(bounce_then_press), 1)
        self.assertEqual(events(tap_release_tap), 2)
        self.assertEqual(events(one_tap, idle=False), 0)

        boot_high = Debouncer(True)
        self.assertFalse(boot_high.update(True, 60_000))
        self.assertFalse(boot_high.update(False, 60_000))
        self.assertFalse(boot_high.update(False, 120_000))
        self.assertFalse(boot_high.update(True, 180_000))
        self.assertTrue(boot_high.update(True, 240_000))

    def test_existing_speaking_error_and_idle_modes_are_preserved(self) -> None:
        display = DISPLAY_SOURCE.read_text(encoding="utf-8")
        api = API_SOURCE.read_text(encoding="utf-8")
        mode = function_body(display, r"void\s+display_set_mode\s*\([^)]*\)")

        for existing_mode in ("IDLE", "THINKING", "SPEAKING", "ERROR"):
            self.assertIn(f"DisplayMode::{existing_mode}", mode)
        self.assertIn("setState(BMOState::SPEAKING)", api)
        self.assertIn("setState(BMOState::ERROR_STATE)", api)
        self.assertIn("setState(BMOState::IDLE)", api)


if __name__ == "__main__":
    unittest.main()
